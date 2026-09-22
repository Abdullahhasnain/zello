"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CartDetail } from "@zello-ai/types";
import { checkout, formatPrice, getCart } from "@/lib/storefront/api";
import { emitCartChanged } from "./storefront-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

const PAYMENT_METHODS = [
  {
    value: "cod",
    label: "Cash on Delivery",
    description: "Pay in cash when your order arrives.",
    enabled: true,
  },
  {
    value: "jazzcash",
    label: "JazzCash",
    description: "Coming soon — mobile wallet payment.",
    enabled: false,
  },
  {
    value: "easypaisa",
    label: "Easypaisa",
    description: "Coming soon — mobile wallet payment.",
    enabled: false,
  },
];

export function CheckoutForm({ slug }: { slug: string }) {
  const router = useRouter();
  const { show } = useToast();
  const [cart, setCart] = useState<CartDetail | null | undefined>(undefined);
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [isPlacing, setIsPlacing] = useState(false);

  useEffect(() => {
    getCart(slug)
      .then(setCart)
      .catch(() => setCart(null));
  }, [slug]);

  async function placeOrder() {
    setIsPlacing(true);
    try {
      const order = await checkout(slug, paymentMethod);
      emitCartChanged(0);
      router.replace(`/store/${slug}/order/${order.id}`);
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not place the order", "error");
      setIsPlacing(false);
    }
  }

  if (cart === undefined) {
    return <Skeleton className="h-64 w-full max-w-lg rounded-card" />;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <EmptyState
        title="Nothing to check out"
        description="Your cart is empty."
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
      <div className="lg:col-span-2">
        <h2 className="mb-3 font-display text-base font-semibold text-ink">Payment method</h2>
        <div className="space-y-2">
          {PAYMENT_METHODS.map((method) => (
            <label
              key={method.value}
              className={`flex cursor-pointer items-start gap-3 rounded-card border p-4 ${
                paymentMethod === method.value ? "border-accent bg-accent-soft/40" : "border-border bg-surface"
              } ${method.enabled ? "" : "cursor-not-allowed opacity-50"}`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value={method.value}
                checked={paymentMethod === method.value}
                disabled={!method.enabled}
                onChange={() => setPaymentMethod(method.value)}
                className="mt-1 accent-[var(--color-accent)]"
              />
              <span>
                <span className="block text-sm font-medium text-ink">{method.label}</span>
                <span className="block text-xs text-ink-soft">{method.description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="h-fit rounded-card border border-border bg-surface p-5 shadow-card">
        <h2 className="font-display text-base font-semibold text-ink">Your order</h2>
        <ul className="mt-3 space-y-2">
          {cart.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 text-sm">
              <span className="truncate text-ink-soft">
                {item.productTitle} <span className="text-ink-faint">× {item.quantity}</span>
              </span>
              <span className="shrink-0 tabular-nums text-ink">
                {formatPrice(Number(item.unitPrice) * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
          <span className="font-medium text-ink">Total</span>
          <span className="font-display text-lg font-semibold text-ink">{formatPrice(cart.subtotal)}</span>
        </div>
        <Button onClick={placeOrder} isLoading={isPlacing} className="mt-5 w-full">
          Place order
        </Button>
        <p className="mt-2 text-center text-xs text-ink-faint">Cash on delivery — no payment taken now.</p>
      </div>
    </div>
  );
}
