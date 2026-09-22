import { SignIn } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignInPage() {
  return (
    <div>
      <h1 className="font-display text-xl font-semibold text-ink">Welcome back</h1>
      <p className="mt-1 text-sm text-ink-soft">Sign in to your Zello AI dashboard.</p>
      <div className="mt-6">
        <SignIn appearance={clerkAppearance} />
      </div>
    </div>
  );
}
