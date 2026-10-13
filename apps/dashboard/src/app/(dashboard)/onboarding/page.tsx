import Link from "next/link";
import { listBrands, listCategories, listProducts } from "@/lib/api/products";
import { getMyTenant } from "@/lib/api/tenants";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductFormDialog } from "@/components/products/product-form-dialog";

const CATALOG_OPTIONS = [
  { name: "Manual catalog", description: "Add products, inventory, images and variants in Zello now.", status: "Available" },
  { name: "Catalog API", description: "Sync an existing platform through Zello's authenticated product upsert API.", status: "Available" },
  { name: "Shopify sync", description: "Automatic OAuth product and cart sync is the next connector.", status: "Planned" },
  { name: "WooCommerce sync", description: "Automatic REST product and cart sync follows the Shopify launch.", status: "Planned" },
];

export default async function OnboardingPage() {
  const [tenant, products, categories, brands] = await Promise.all([
    getMyTenant(),
    listProducts({ limit: 1 }),
    listCategories(),
    listBrands(),
  ]);

  const hasProducts = products.length > 0;

  return (
    <div>
      <PageHeader
        title={`Get ${tenant.name} live`}
        description="Three steps to put your AI sales agent in front of customers."
      />

      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
                1
              </span>
              <CardTitle>Add your catalog</CardTitle>
            </div>
            {hasProducts ? <Badge tone="success">Done</Badge> : <Badge tone="warning">Pending</Badge>}
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-ink-soft">
              Add products manually now, or use the authenticated catalog API from an existing platform. Zello
              only recommends products that exist in this store's catalog.
            </p>
            <div className="mb-4 flex flex-wrap gap-3">
              {CATALOG_OPTIONS.map((connector) => (
                <div
                  key={connector.name}
                  className="flex min-w-[180px] flex-1 items-center justify-between gap-3 rounded-lg border border-dashed border-border px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium text-ink-soft">{connector.name}</p>
                    <p className="text-xs text-ink-faint">{connector.description}</p>
                  </div>
                  <Badge tone={connector.status === "Available" ? "success" : "neutral"}>{connector.status}</Badge>
                </div>
              ))}
            </div>
            <ProductFormDialog categories={categories} brands={brands} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
                2
              </span>
              <CardTitle>Customize your AI agent</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-ink-soft">
              Set your brand color, greeting, and the languages your agent should speak.
            </p>
            <Link href="/widget-studio">
              <Button variant="secondary" size="sm">
                Open Widget Studio
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
              3
            </span>
            <CardTitle>Embed on your storefront</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-ink-soft">
              Copy the embed snippet from Widget Studio and paste it on your storefront to go live.
            </p>
            <Link href="/widget-studio">
              <Button variant="secondary" size="sm">
                Get embed code
              </Button>
            </Link>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Link href="/dashboard">
            <Button size="sm">Go to dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
