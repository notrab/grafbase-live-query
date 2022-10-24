import type { AppProps } from "next/app";
import type { PropsWithChildren } from "react";
import { useMemo, Fragment } from "react";
import {
  HttpLink,
  ApolloClient,
  ApolloProvider,
  InMemoryCache,
  from,
  split,
  ApolloLink,
  Operation,
  FetchResult,
  Observable,
} from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import {
  useAuth,
  ClerkLoaded,
  ClerkProvider,
  RedirectToSignIn,
  SignedIn,
  SignedOut,
} from "@clerk/nextjs";
import { isLiveQueryOperationDefinitionNode } from "@n1ru4l/graphql-live-query";
import { Repeater } from "@repeaterjs/repeater";
import { print, getOperationAST } from "graphql";
import { applyLiveQueryJSONPatch } from "@n1ru4l/graphql-live-query-patch-json-patch";
import { applyAsyncIterableIteratorToSink } from "@n1ru4l/push-pull-async-iterable-iterator";
import ReconnectingEventSource from "reconnecting-eventsource";

const publicPages = [
  "/",
  "/about-us",
  "/privacy-policy",
  "/sign-in/[[...index]]",
  "/sign-up/[[...index]]",
];

function makeEventStreamSource(url: string, options: any) {
  return new Repeater<FetchResult>(async (push, end) => {
    const eventsource = new ReconnectingEventSource(url, options);
    eventsource.onmessage = function (event) {
      const data = JSON.parse(event.data);

      push(data);
      if (eventsource.readyState === 2) {
        end();
      }
    };
    eventsource.onerror = function (error) {
      end(error);
    };
    await end;
    eventsource.close();
  });
}

class GrafbaseLink extends ApolloLink {
  private options;

  constructor(options: any) {
    super();
    this.options = options;
  }

  public request(operation: Operation): Observable<FetchResult> {
    const { headers } = operation.getContext();

    const url = new URL(this.options.uri);

    if (headers["authorization"]) {
      url.searchParams.append("authorization", headers["authorization"]);
    }

    url.searchParams.append("query", print(operation.query));

    url.searchParams.append(
      "extensions",
      JSON.stringify(operation.operationName)
    );

    url.searchParams.append("variables", JSON.stringify(operation.variables));

    if (operation.extensions) {
      url.searchParams.append(
        "extensions",
        JSON.stringify(operation.extensions)
      );
    }

    return new Observable((sink) =>
      applyAsyncIterableIteratorToSink(
        applyLiveQueryJSONPatch(
          makeEventStreamSource(url.toString(), this.options)
        ),
        sink
      )
    );
  }
}

const httpLink = new HttpLink({
  uri: process.env.NEXT_PUBLIC_GRAFBASE_API_URL,
});

const grafbaseLink = new GrafbaseLink({
  uri: process.env.NEXT_PUBLIC_GRAFBASE_API_URL,
});

export const ApolloProviderWrapper = ({ children }: PropsWithChildren) => {
  const { getToken } = useAuth();

  const client = useMemo(() => {
    const authMiddleware = setContext(async (operation, { headers }) => {
      const token = await getToken({ template: "grafbase" });

      return {
        headers: {
          ...headers,
          authorization: `Bearer ${token}`,
        },
      };
    });

    return new ApolloClient({
      link: from([
        authMiddleware,
        split(
          ({ query, operationName, variables }) => {
            const definition = getOperationAST(query, operationName);
            const isSubscription =
              definition?.kind === "OperationDefinition" &&
              definition.operation === "subscription";

            const isLiveQuery =
              !!definition &&
              isLiveQueryOperationDefinitionNode(definition, variables);

            return isSubscription || isLiveQuery;
          },
          grafbaseLink,
          httpLink
        ),
      ]),
      cache: new InMemoryCache(),
    });
  }, [getToken]);

  return <ApolloProvider client={client}>{children}</ApolloProvider>;
};

const MyApp = ({ Component, pageProps, router }: AppProps) => {
  return (
    <ClerkProvider {...pageProps}>
      <ClerkLoaded>
        <ApolloProviderWrapper>
          {publicPages.includes(router.pathname) ? (
            <Component {...pageProps} />
          ) : (
            <Fragment>
              <SignedIn>
                <Component {...pageProps} />
              </SignedIn>
              <SignedOut>
                <RedirectToSignIn />
              </SignedOut>
            </Fragment>
          )}
        </ApolloProviderWrapper>
      </ClerkLoaded>
    </ClerkProvider>
  );
};

export default MyApp;
