"use client";

import Link from "next/link";
import type { Product } from "@zello-ai/types";
import { formatPrice } from "@/lib/storefront/api";

export function ProductCard({ slug, product }: { slug: string; product: Product }) {
  const outOfStock = product.status === "out_of_stock" || product.stockQty <= 0;
  const image = product.images[0];

  return (
    <Link
      href={`/store/${slug}/product/${product.id}`}
      className="group overflow-hidden rounded-card border border-border bg-surface shadow-card transition-transform hover:-translate-y-0.5"
    >
      <div className="relative aspect-square bg-surface-hover">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- tenant-supplied external URLs
          <img
            src={image}
            alt={product.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-faint">
            <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4h16v16H4zM4 15l4-4 4 4 4-5 4 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
        {outOfStock ? (
          <span className="absolute left-2 top-2 rounded-full bg-ink/70 px-2 py-0.5 text-[11px] font-medium text-white">
            Out of stock
          </span>
        ) : null}
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-medium text-ink">{product.title}</p>
        <p className="mt-1 text-sm font-semibold text-accent">
          {formatPrice(product.price, product.currency)}
        </p>
      </div>
    </Link>
  );
}
