import { UserButton } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { MobileNav } from "./mobile-nav";

export function Topbar() {
  return (
    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-border bg-surface px-4 sm:px-6">
      <div className="flex items-center gap-3 md:hidden">
        <MobileNav />
        <span className="font-display text-sm font-semibold text-ink">Zello AI</span>
      </div>
      <div className="hidden md:block" />
      <div className="flex items-center gap-2">
        <ThemeToggle />
        {process.env.AUTH_PROVIDER === "auth0"
          ? <a href="/auth/logout" className="text-sm text-ink-soft hover:text-ink">Sign out</a>
          : <UserButton afterSignOutUrl="/sign-in" />}
      </div>
    </header>
  );
}
