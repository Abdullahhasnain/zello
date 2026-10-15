"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CartDetail } from "@zello-ai/types";
import { checkout, formatPrice, getCart, type CheckoutDetails } from "@/lib/storefront/api";
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
  const [details, setDetails] = useState<CheckoutDetails>({
    customerName: "", customerPhone: "", deliveryAddress: "", deliveryCity: "", orderNotes: "",
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const errors = {
    customerName: details.customerName.trim().length < 2 ? "Enter your full name." : "",
    customerPhone: /^(?:\+92|92|0)?3\d{9}$/.test(details.customerPhone.replace(/[\s-]/g, "")) ? "" : "Enter a valid Pakistani mobile number.",
    deliveryAddress: details.deliveryAddress.trim().length < 5 ? "Enter your complete delivery address." : "",
    deliveryCity: details.deliveryCity.trim().length < 2 ? "Enter your city." : "",
  };
  const detailsValid = !Object.values(errors).some(Boolean);

  function updateDetail<K extends keyof CheckoutDetails>(key: K, value: CheckoutDetails[K]) {
    setDetails((current) => ({ ...current, [key]: value }));
  }

  useEffect(() => {
    let active = true;
    const refresh = () => { void getCart(slug).then((next) => {
      if (active) setCart(next);
    }).catch(() => { if (active) setCart(null); }); };
    refresh();
    window.addEventListener("zello:cart-changed", refresh);
    return () => { active = false; window.removeEventListener("zello:cart-changed", refresh); };
  }, [slug]);

  async function placeOrder() {
    if (isPlacing || !cart || !detailsValid) {
      setTouched({ customerName: true, customerPhone: true, deliveryAddress: true, deliveryCity: true });
      return;
    }
    setIsPlacing(true);
    try {
      const latest = await getCart(slug);
      if (!latest || JSON.stringify(latest.items) !== JSON.stringify(cart.items)) {
        setCart(latest);
        show("Your cart changed. Please review it before placing the order.", "error");
        setIsPlacing(false);
        return;
      }
      const order = await checkout(slug, paymentMethod, details);
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
      <div className="lg:col-span-2 space-y-6">
        <section>
          <h2 className="mb-3 font-display text-base font-semibold text-ink">Delivery details</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["customerName", "customerPhone", "deliveryCity"] as const).map((field) => (
              <label key={field} className={field === "customerName" ? "sm:col-span-2" : ""}>
                <span className="mb-1 block text-sm font-medium text-ink">{field === "customerName" ? "Full name" : field === "customerPhone" ? "Pakistani mobile number" : "City"}</span>
                <input value={details[field]} onChange={(event) => updateDetail(field, event.target.value)} onBlur={() => setTouched((current) => ({ ...current, [field]: true }))} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink" placeholder={field === "customerPhone" ? "03XX XXXXXXX" : undefined} />
                {touched[field] && errors[field] ? <span className="mt-1 block text-xs text-danger">{errors[field]}</span> : null}
              </label>
            ))}
            <label className="sm:col-span-2">
              <span className="mb-1 block text-sm font-medium text-ink">Complete delivery address</span>
              <textarea value={details.deliveryAddress} onChange={(event) => updateDetail("deliveryAddress", event.target.value)} onBlur={() => setTouched((current) => ({ ...current, deliveryAddress: true }))} className="min-h-20 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink" />
              {touched.deliveryAddress && errors.deliveryAddress ? <span className="mt-1 block text-xs text-danger">{errors.deliveryAddress}</span> : null}
            </label>
            <label className="sm:col-span-2"><span className="mb-1 block text-sm font-medium text-ink">Order notes <span className="text-ink-faint">(optional)</span></span><textarea value={details.orderNotes} onChange={(event) => updateDetail("orderNotes", event.target.value)} className="min-h-16 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink" /></label>
          </div>
        </section>
        <section>
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
        </section>
      </div>

      <div className="h-fit rounded-card border border-border bg-surface p-5 shadow-card">
        <h2 className="font-display text-base font-semibold text-ink">Your order</h2>
        {cart.items.every((item) => item.productTitle.startsWith("DEMO ")) ? (
          <p className="mt-2 text-sm text-ink-soft">Demo test order only — no real delivery will be arranged.</p>
        ) : null}
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
        <Button onClick={placeOrder} isLoading={isPlacing} disabled={!detailsValid} className="mt-5 w-full">
          Place order
        </Button>
        <p className="mt-2 text-center text-xs text-ink-faint">Cash on delivery — no payment taken now.</p>
      </div>
    </div>
  );
}
