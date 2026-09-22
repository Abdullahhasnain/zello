"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, SECONDARY_NAV_ITEMS, type NavItem } from "./nav-items";

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive ? "bg-accent-soft text-accent-ink" : "text-ink-soft hover:bg-surface-hover hover:text-ink",
      )}
      aria-current={isActive ? "page" : undefined}
    >
      {item.icon}
      {item.label}
    </Link>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
      <div className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} onNavigate={onNavigate} />
        ))}
      </div>
      <div className="flex flex-col gap-1 border-t border-border pt-4">
        {SECONDARY_NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} onNavigate={onNavigate} />
        ))}
      </div>
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent font-display text-sm font-bold text-white">
          Z
        </span>
        <span className="font-display text-base font-semibold text-ink">Zello AI</span>
      </div>
      <SidebarNav />
    </aside>
  );
}
