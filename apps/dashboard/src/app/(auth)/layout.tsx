import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const VALUE_PROPS = [
  { title: "Voice-first checkout", detail: "Customers speak, Zello listens, and the sale closes itself." },
  { title: "Roman Urdu native", detail: "The only assistant built for how Pakistani shoppers actually type and talk." },
  { title: "Live in minutes", detail: "Connect your catalog and the widget is on your storefront the same day." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-ink p-10 text-white lg:flex">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent font-display text-sm font-bold text-white">
            Z
          </span>
          <span className="font-display text-base font-semibold">Zello AI</span>
        </Link>
        <div className="max-w-md">
          <h2 className="font-display text-3xl font-semibold leading-snug">
            Pakistan&apos;s first AI voice sales agent.
          </h2>
          <ul className="mt-8 space-y-6">
            {VALUE_PROPS.map((item) => (
              <li key={item.title}>
                <p className="font-display text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-sm text-white/60">{item.detail}</p>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/40">© {new Date().getFullYear()} Zello AI. All rights reserved.</p>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6 lg:justify-end">
          <Link href="/" className="flex items-center gap-2 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent font-display text-sm font-bold text-white">
              Z
            </span>
            <span className="font-display text-base font-semibold text-ink">Zello AI</span>
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-12 sm:px-6">
          <div className="w-full max-w-sm rounded-card border border-border bg-surface p-6 shadow-card sm:p-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
