import { CheckoutForm } from "@/components/storefront/checkout-form";

export default async function StorefrontCheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <div>
      <h1 className="mb-5 font-display text-xl font-semibold text-ink">Checkout</h1>
      <CheckoutForm slug={slug} />
    </div>
  );
}
