import { SignUp } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignUpPage() {
  return (
    <div>
      <h1 className="font-display text-xl font-semibold text-ink">Create your account</h1>
      <p className="mt-1 text-sm text-ink-soft">Start selling with your own AI voice agent.</p>
      <div className="mt-6">
        <SignUp appearance={clerkAppearance} />
      </div>
    </div>
  );
}
