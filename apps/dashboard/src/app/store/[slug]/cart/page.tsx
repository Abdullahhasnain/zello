import { CartView } from "@/components/storefront/cart-view";

export default async function StorefrontCartPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <div>
      <h1 className="mb-5 font-display text-xl font-semibold text-ink">Your cart</h1>
      <CartView slug={slug} />
    </div>
  );
}
