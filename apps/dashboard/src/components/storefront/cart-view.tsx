"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CartDetail } from "@zello-ai/types";
import { formatPrice, getCart, removeCartItem, updateCartItem } from "@/lib/storefront/api";
import { emitCartChanged } from "./storefront-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

export function CartView({ slug }: { slug: string }) {
  const [cart, setCart] = useState<CartDetail | null | undefined>(undefined);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const { show } = useToast();

  useEffect(() => {
    getCart(slug)
      .then(setCart)
      .catch(() => setCart(null));
  }, [slug]);

  function applyCart(next: CartDetail) {
    setCart(next);
    emitCartChanged(next.items.reduce((sum, item) => sum + item.quantity, 0));
  }

  async function changeQuantity(itemId: string, quantity: number) {
    if (!cart) return;
    setBusyItemId(itemId);
    try {
      if (quantity < 1) {
        applyCart(await removeCartItem(slug, cart.id, itemId));
      } else {
        applyCart(await updateCartItem(slug, cart.id, itemId, quantity));
      }
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not update cart", "error");
    } finally {
      setBusyItemId(null);
    }
  }

  async function handleRemove(itemId: string) {
    if (!cart) return;
    setBusyItemId(itemId);
    try {
      applyCart(await removeCartItem(slug, cart.id, itemId));
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not remove item", "error");
    } finally {
      setBusyItemId(null);
    }
  }

  if (cart === undefined) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-card" />
        <Skeleton className="h-20 w-full rounded-card" />
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        description="Browse the store and add something you like."
        action={
          <Link href={`/store/${slug}`}>
            <Button size="sm">Browse products</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <ul className="space-y-3 lg:col-span-2">
        {cart.items.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-4 rounded-card border border-border bg-surface p-3 shadow-card"
          >
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-hover">
              {item.productImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- tenant-supplied external URLs
                <img src={item.productImageUrl} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <Link
                href={`/store/${slug}/product/${item.productId}`}
                className="block truncate text-sm font-medium text-ink hover:text-accent"
              >
                {item.productTitle}
              </Link>
              <p className="mt-0.5 text-sm text-ink-soft">{formatPrice(item.unitPrice)}</p>
            </div>
            <div className="flex items-center rounded-lg border border-border">
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={busyItemId === item.id}
                onClick={() => changeQuantity(item.id, item.quantity - 1)}
                className="h-8 w-8 text-ink-soft hover:bg-surface-hover disabled:opacity-40"
              >
                −
              </button>
              <span className="w-8 text-center text-sm tabular-nums text-ink">{item.quantity}</span>
              <button
                type="button"
                aria-label="Increase quantity"
                disabled={busyItemId === item.id}
                onClick={() => changeQuantity(item.id, item.quantity + 1)}
                className="h-8 w-8 text-ink-soft hover:bg-surface-hover disabled:opacity-40"
              >
                +
              </button>
            </div>
            <div className="w-20 text-right text-sm font-semibold tabular-nums text-ink">
              {formatPrice(Number(item.unitPrice) * item.quantity)}
            </div>
            <button
              type="button"
              aria-label={`Remove ${item.productTitle}`}
              disabled={busyItemId === item.id}
              onClick={() => handleRemove(item.id)}
              className="rounded-md p-1.5 text-ink-faint hover:bg-danger-soft hover:text-danger disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </li>
        ))}
      </ul>

      <div className="h-fit rounded-card border border-border bg-surface p-5 shadow-card">
        <h2 className="font-display text-base font-semibold text-ink">Order summary</h2>
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-ink-soft">Subtotal</span>
          <span className="font-semibold text-ink">{formatPrice(cart.subtotal)}</span>
        </div>
        <p className="mt-1 text-xs text-ink-faint">Delivery calculated at the door — cash on delivery.</p>
        <Link href={`/store/${slug}/checkout`} className="mt-5 block">
          <Button className="w-full">Proceed to checkout</Button>
        </Link>
      </div>
    </div>
  );
}
