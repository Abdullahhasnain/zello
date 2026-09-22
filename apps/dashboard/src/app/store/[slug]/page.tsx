import { ProductBrowser } from "@/components/storefront/product-browser";

export default async function StorefrontHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ProductBrowser slug={slug} />;
}
