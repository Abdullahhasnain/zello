"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Order } from "@zello-ai/types";
import { formatPrice, getOrder } from "@/lib/storefront/api";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export function OrderConfirmation({ slug, orderId }: { slug: string; orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOrder(slug, orderId)
      .then(setOrder)
      .catch((err: Error) => setError(err.message));
  }, [slug, orderId]);

  if (error) return <EmptyState title="Order not found" description={error} />;
  if (!order) return <Skeleton className="mx-auto h-72 w-full max-w-md rounded-card" />;

  return (
    <div className="mx-auto max-w-md rounded-card border border-border bg-surface p-8 text-center shadow-card">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-success)_16%,transparent)]">
        <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-success" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <h1 className="mt-4 font-display text-xl font-semibold text-ink">Order confirmed!</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Shukriya! Your order has been placed — the store will contact you for delivery.
      </p>

      <dl className="mt-6 space-y-2 rounded-lg border border-border bg-bg p-4 text-left text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-soft">Order number</dt>
          <dd className="font-mono text-xs text-ink">{order.id.slice(0, 8).toUpperCase()}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-soft">Total</dt>
          <dd className="font-semibold text-ink">{formatPrice(order.totalAmount, order.currency)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-soft">Payment</dt>
          <dd className="capitalize text-ink">
            {order.paymentMethod === "cod" ? "Cash on delivery" : order.paymentMethod}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-soft">Status</dt>
          <dd className="capitalize text-ink">{order.status}</dd>
        </div>
      </dl>

      <Link href={`/store/${slug}`} className="mt-6 block">
        <Button variant="secondary" className="w-full">
          Continue shopping
        </Button>
      </Link>
    </div>
  );
}
