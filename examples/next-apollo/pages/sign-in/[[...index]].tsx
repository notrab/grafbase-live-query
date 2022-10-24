import { SignIn } from "@clerk/nextjs";

const SignInPage = () => (
  <div className="px-6 py-4 md:py-24 mx-auto max-w-4xl flex items-center justify-center">
    <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" />
  </div>
);

export default SignInPage;
