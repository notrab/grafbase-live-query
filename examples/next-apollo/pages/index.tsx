import type { NextPage } from "next";
import { useQuery, gql } from "@apollo/client";

const query = gql`
  query GetPosts @live {
    postCollection(first: 100) {
      edges {
        node {
          id
          title
        }
      }
    }
  }
`;

const Home: NextPage = () => {
  const { data } = useQuery(query);

  return <pre>{JSON.stringify(data, null, 2)}</pre>;
};

export default Home;
