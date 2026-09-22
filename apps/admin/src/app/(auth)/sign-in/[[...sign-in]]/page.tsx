import { SignIn } from "@clerk/nextjs";

// Ops accounts are provisioned via SSO, not self-serve sign-up — no /sign-up route here.
export default function SignInPage() {
  return <SignIn />;
}
