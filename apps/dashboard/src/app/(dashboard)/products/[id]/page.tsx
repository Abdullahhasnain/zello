import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getInventoryHistory,
  getProduct,
  listBrands,
  listCategories,
  listImages,
  listVariants,
} from "@/lib/api/products";
import { ApiError } from "@/lib/api-client";
import { PageHeader } from "@/components/ui/page-header";
import { ProductEditForm } from "@/components/products/product-edit-form";
import { ProductVariantsPanel } from "@/components/products/product-variants-panel";
import { ProductImagesPanel } from "@/components/products/product-images-panel";
import { ProductInventoryPanel } from "@/components/products/product-inventory-panel";

export default async function ProductDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let product;
  try {
    product = await getProduct(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const [categories, brands, variants, images, inventoryHistory] = await Promise.all([
    listCategories(),
    listBrands(),
    listVariants(id),
    listImages(id),
    getInventoryHistory(id),
  ]);

  return (
    <div>
      <PageHeader
        title={product.title}
        description={
          <>
            <Link href="/products" className="text-accent hover:text-accent-ink">
              Products
            </Link>
            {" / "}
            {product.externalId}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ProductEditForm product={product} categories={categories} brands={brands} />
        <ProductImagesPanel productId={id} images={images} />
        <ProductVariantsPanel productId={id} variants={variants} />
        <ProductInventoryPanel productId={id} history={inventoryHistory} />
      </div>
    </div>
  );
}
