"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Product } from "@zello-ai/types";
import { addToCart, formatPrice, getCart, getProduct } from "@/lib/storefront/api";
import { emitCartChanged } from "./storefront-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

export function ProductDetail({ slug, productId }: { slug: string; productId: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const { show } = useToast();

  useEffect(() => {
    let cancelled = false;
    getProduct(slug, productId)
      .then((p) => {
        if (!cancelled) setProduct(p);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, productId]);

  async function handleAddToCart() {
    setIsAdding(true);
    try {
      await addToCart(slug, productId, quantity);
      const cart = await getCart(slug);
      if (cart) emitCartChanged(cart.items.reduce((sum, item) => sum + item.quantity, 0));
      show("Added to cart", "success");
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not add to cart", "error");
    } finally {
      setIsAdding(false);
    }
  }

  if (error) return <EmptyState title="Product not found" description={error} />;
  if (!product) {
    return (
      <div className="grid gap-8 lg:grid-cols-2">
        <Skeleton className="aspect-square rounded-card" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  const outOfStock = product.status === "out_of_stock" || product.stockQty <= 0;
  const images = product.images;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <div className="aspect-square overflow-hidden rounded-card border border-border bg-surface-hover">
          {images[activeImage] ? (
            // eslint-disable-next-line @next/next/no-img-element -- tenant-supplied external URLs
            <img src={images[activeImage]} alt={product.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-ink-faint">
              <svg viewBox="0 0 24 24" fill="none" className="h-14 w-14" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 4h16v16H4zM4 15l4-4 4 4 4-5 4 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
        </div>
        {images.length > 1 ? (
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {images.map((image, index) => (
              <button
                key={image}
                type="button"
                onClick={() => setActiveImage(index)}
                className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border ${
                  index === activeImage ? "border-accent" : "border-border"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- tenant-supplied external URLs */}
                <img src={image} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">{product.title}</h1>
        <p className="mt-2 text-2xl font-bold text-accent">
          {formatPrice(product.price, product.currency)}
        </p>
        <p className="mt-1 text-sm text-ink-faint">
          {outOfStock ? "Out of stock" : `${product.stockQty} in stock`}
        </p>

        {product.description ? (
          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
            {product.description}
          </p>
        ) : null}

        <div className="mt-6 flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-border">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="h-10 w-10 text-ink-soft hover:bg-surface-hover disabled:opacity-40"
              disabled={quantity <= 1}
            >
              −
            </button>
            <span className="w-10 text-center text-sm font-medium tabular-nums text-ink">{quantity}</span>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => setQuantity((q) => q + 1)}
              className="h-10 w-10 text-ink-soft hover:bg-surface-hover"
            >
              +
            </button>
          </div>
          <Button onClick={handleAddToCart} isLoading={isAdding} disabled={outOfStock} className="flex-1">
            {outOfStock ? "Out of stock" : "Add to cart"}
          </Button>
        </div>

        <div className="mt-4">
          <Link href={`/store/${slug}/cart`} className="text-sm font-medium text-accent hover:text-accent-ink">
            View cart →
          </Link>
        </div>
      </div>
    </div>
  );
}
