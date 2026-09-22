import { OrderConfirmation } from "@/components/storefront/order-confirmation";

export default async function StorefrontOrderPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  return <OrderConfirmation slug={slug} orderId={id} />;
}
