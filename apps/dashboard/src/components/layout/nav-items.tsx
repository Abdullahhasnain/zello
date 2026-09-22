import type { ReactNode } from "react";

export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

function icon(path: string): ReactNode {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" stroke="currentColor" strokeWidth="2">
      <path d={path} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: icon("M3 12l9-9 9 9M5 10v10h14V10") },
  {
    href: "/products",
    label: "Products",
    icon: icon("M20 7L12 3 4 7m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"),
  },
  {
    href: "/orders",
    label: "Orders",
    icon: icon("M6 2l1.5 4h9L18 2M3 6h18l-1.5 13.5a2 2 0 01-2 1.5H6.5a2 2 0 01-2-1.5L3 6zM9 10v6M15 10v6"),
  },
  {
    href: "/widget-studio",
    label: "Widget Studio",
    icon: icon("M4 4h16v12H7l-3 3V4z"),
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: icon("M3 3v18h18M7 16l4-6 3 3 5-8"),
  },
];

export const SECONDARY_NAV_ITEMS: NavItem[] = [
  { href: "/team", label: "Team", icon: icon("M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75") },
  { href: "/billing", label: "Billing", icon: icon("M2 7h20M2 7v10a2 2 0 002 2h16a2 2 0 002-2V7M2 7l2-4h16l2 4M6 15h4") },
  { href: "/settings", label: "Settings", icon: icon("M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z") },
];
