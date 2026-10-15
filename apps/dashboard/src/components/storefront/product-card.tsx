"use client";

import Link from "next/link";
import type { Product } from "@zello-ai/types";
import { formatPrice } from "@/lib/storefront/api";

export function ProductCard({ slug, product }: { slug: string; product: Product }) {
  const outOfStock = product.status === "out_of_stock" || product.stockQty <= 0;
  const image = product.images[0] || "/zello-product-fallback.svg";

  return (
    <Link
      href={`/store/${slug}/product/${product.id}`}
      className="group overflow-hidden rounded-card border border-border bg-surface shadow-card transition-transform hover:-translate-y-0.5"
    >
      <div className="relative aspect-square bg-surface-hover">
        {/* eslint-disable-next-line @next/next/no-img-element -- tenant-supplied external URLs */}
        <img src={image} alt={product.title} onError={(event) => { event.currentTarget.src = "/zello-product-fallback.svg"; }} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
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
