import { ProductBrowser } from "@/components/storefront/product-browser";

export default async function StorefrontHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <details className="rounded-card border border-border bg-surface p-5">
      <summary className="cursor-pointer font-medium text-ink">Khud browse karna hai? Catalog dekhein</summary>
      <div className="mt-5"><ProductBrowser slug={slug} /></div>
    </details>
  );
}
