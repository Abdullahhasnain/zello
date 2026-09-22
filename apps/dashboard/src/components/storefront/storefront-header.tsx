"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCart } from "@/lib/storefront/api";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function StorefrontHeader({
  slug,
  storeName,
  primaryColor,
}: {
  slug: string;
  storeName: string;
  primaryColor?: string;
}) {
  const [itemCount, setItemCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getCart(slug)
      .then((cart) => {
        if (!cancelled && cart) {
          setItemCount(cart.items.reduce((sum, item) => sum + item.quantity, 0));
        }
      })
      .catch(() => undefined);

    // Product pages dispatch this after add-to-cart so the badge updates
    // without a page reload.
    const onCartChange = (event: Event) => {
      const detail = (event as CustomEvent<{ count: number }>).detail;
      if (detail) setItemCount(detail.count);
    };
    window.addEventListener("zello:cart-changed", onCartChange);
    return () => {
      cancelled = true;
      window.removeEventListener("zello:cart-changed", onCartChange);
    };
  }, [slug]);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href={`/store/${slug}`} className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg font-display text-sm font-bold text-white"
            style={{ backgroundColor: primaryColor || "var(--color-accent)" }}
          >
            {storeName.charAt(0).toUpperCase()}
          </span>
          <span className="font-display text-base font-semibold text-ink">{storeName}</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href={`/store/${slug}/cart`}
            className="relative flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-surface-hover hover:text-ink"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" stroke="currentColor" strokeWidth="2">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 2l1.5 4h9L18 2M3 6h18l-1.5 13.5a2 2 0 01-2 1.5H6.5a2 2 0 01-2-1.5L3 6z"
              />
            </svg>
            Cart
            {itemCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold text-white">
                {itemCount}
              </span>
            ) : null}
          </Link>
        </div>
      </div>
    </header>
  );
}

/** Fired by add-to-cart / cart mutations so the header badge stays live. */
export function emitCartChanged(count: number) {
  window.dispatchEvent(new CustomEvent("zello:cart-changed", { detail: { count } }));
}
