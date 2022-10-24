import { SignUp } from "@clerk/nextjs";

const SignUpPage = () => (
  <div className="px-6 py-4 md:py-24 mx-auto max-w-4xl flex items-center justify-center">
    <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" />
  </div>
);

export default SignUpPage;
