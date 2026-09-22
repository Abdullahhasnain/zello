import "server-only";
import type { Brand, Category, InventoryAdjustment, Product, ProductImage, ProductVariant } from "@zello-ai/types";
import { apiFetch } from "@/lib/api-client";

export async function listProducts(params: {
  limit?: number;
  offset?: number;
  categoryId?: string;
  brandId?: string;
}): Promise<Product[]> {
  const query = new URLSearchParams();
  if (params.limit) query.set("limit", String(params.limit));
  if (params.offset) query.set("offset", String(params.offset));
  if (params.categoryId) query.set("category_id", params.categoryId);
  if (params.brandId) query.set("brand_id", params.brandId);
  return apiFetch<Product[]>(`/catalog/products?${query.toString()}`);
}

export async function getProduct(id: string): Promise<Product> {
  return apiFetch<Product>(`/catalog/products/${id}`);
}

export async function listCategories(): Promise<Category[]> {
  return apiFetch<Category[]>("/catalog/categories");
}

export async function listBrands(): Promise<Brand[]> {
  return apiFetch<Brand[]>("/catalog/brands");
}

export async function listVariants(productId: string): Promise<ProductVariant[]> {
  return apiFetch<ProductVariant[]>(`/catalog/products/${productId}/variants`);
}

export async function listImages(productId: string): Promise<ProductImage[]> {
  return apiFetch<ProductImage[]>(`/catalog/products/${productId}/images`);
}

export async function getInventoryHistory(productId: string, limit = 20): Promise<InventoryAdjustment[]> {
  return apiFetch<InventoryAdjustment[]>(
    `/catalog/products/${productId}/inventory/history?limit=${limit}`,
  );
}
