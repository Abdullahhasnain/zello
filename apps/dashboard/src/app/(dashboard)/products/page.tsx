import Link from "next/link";
import { listBrands, listCategories, listProducts } from "@/lib/api/products";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { ProductFilters } from "@/components/products/product-filters";

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency, maximumFractionDigits: 0 }).format(
    amount,
  );
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string; brandId?: string }>;
}) {
  const { categoryId, brandId } = await searchParams;

  const [products, categories, brands] = await Promise.all([
    listProducts({ limit: 100, categoryId, brandId }),
    listCategories(),
    listBrands(),
  ]);

  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const brandNames = new Map(brands.map((brand) => [brand.id, brand.name]));

  return (
    <div>
      <PageHeader
        title="Products"
        description="Manage the catalog your AI agent sells from."
        action={<ProductFormDialog categories={categories} brands={brands} />}
      />

      <div className="mb-4">
        <ProductFilters categories={categories} brands={brands} />
      </div>

      {products.length === 0 ? (
        <EmptyState
          title={categoryId || brandId ? "No products match these filters" : "No products yet"}
          description={
            categoryId || brandId
              ? "Try clearing the category or brand filter."
              : "Add your first product, or connect a catalog source from onboarding."
          }
          action={
            !categoryId && !brandId ? (
              <Link href="/onboarding">
                <Button size="sm" variant="secondary">
                  Connect catalog
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <TableWrap>
          <Table>
            <Thead>
              <Tr>
                <Th>Product</Th>
                <Th>Category</Th>
                <Th>Brand</Th>
                <Th>Price</Th>
                <Th>Stock</Th>
                <Th>Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              {products.map((product) => (
                <Tr key={product.id}>
                  <Td>
                    <Link
                      href={`/products/${product.id}`}
                      className="font-medium text-ink hover:text-accent"
                    >
                      {product.title}
                    </Link>
                    <p className="text-xs text-ink-faint">{product.externalId}</p>
                  </Td>
                  <Td className="text-ink-soft">
                    {product.categoryId ? categoryNames.get(product.categoryId) ?? "—" : "—"}
                  </Td>
                  <Td className="text-ink-soft">
                    {product.brandId ? brandNames.get(product.brandId) ?? "—" : "—"}
                  </Td>
                  <Td className="font-medium">{formatCurrency(product.price, product.currency)}</Td>
                  <Td className="tabular-nums text-ink-soft">{product.stockQty}</Td>
                  <Td>
                    <Badge tone={statusTone(product.status)}>{product.status.replace("_", " ")}</Badge>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableWrap>
      )}
    </div>
  );
}
