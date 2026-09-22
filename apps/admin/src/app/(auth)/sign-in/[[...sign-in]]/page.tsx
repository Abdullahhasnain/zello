import { SignIn } from "@clerk/nextjs";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Ops accounts are provisioned via SSO, not self-serve sign-up — no /sign-up route here.
export default function SignInPage() {
  if (process.env.AUTH_PROVIDER === "auth0") redirect("/auth/login?returnTo=/partners");
  return <SignIn />;
}
