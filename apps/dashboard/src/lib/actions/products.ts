"use server";

import { revalidatePath } from "next/cache";
import type { Brand, Category, InventoryAdjustment, Product, ProductImage, ProductVariant } from "@zello-ai/types";
import { apiFetch } from "@/lib/api-client";
import { ActionState, actionErrorMessage } from "./types";

// --- Products ---

export async function createProductAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const stockQty = Number(formData.get("stockQty") ?? 0);
    await apiFetch<Product>("/catalog/products", {
      method: "POST",
      body: JSON.stringify({
        externalId: String(formData.get("externalId") ?? "").trim(),
        title: String(formData.get("title") ?? "").trim(),
        price: String(formData.get("price") ?? "0"),
        currency: String(formData.get("currency") ?? "PKR"),
        description: (formData.get("description") as string) || undefined,
        stockQty,
        categoryId: (formData.get("categoryId") as string) || undefined,
        brandId: (formData.get("brandId") as string) || undefined,
      }),
    });
    revalidatePath("/products");
    return { success: true };
  } catch (error) {
    return { success: false, error: actionErrorMessage(error) };
  }
}

export async function updateProductAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const productId = String(formData.get("productId"));
  try {
    await apiFetch<Product>(`/catalog/products/${productId}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: String(formData.get("title") ?? "").trim(),
        description: (formData.get("description") as string) || undefined,
        price: String(formData.get("price") ?? "0"),
        categoryId: (formData.get("categoryId") as string) || undefined,
        brandId: (formData.get("brandId") as string) || undefined,
        status: String(formData.get("status") ?? "active"),
      }),
    });
    revalidatePath(`/products/${productId}`);
    revalidatePath("/products");
    return { success: true };
  } catch (error) {
    return { success: false, error: actionErrorMessage(error) };
  }
}

export async function deleteProductAction(productId: string): Promise<ActionState> {
  try {
    await apiFetch<void>(`/catalog/products/${productId}`, { method: "DELETE" });
    revalidatePath("/products");
    return { success: true };
  } catch (error) {
    return { success: false, error: actionErrorMessage(error) };
  }
}

// --- Categories & brands ---

export async function createCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await apiFetch<Category>("/catalog/categories", {
      method: "POST",
      body: JSON.stringify({
        name: String(formData.get("name") ?? "").trim(),
        slug: String(formData.get("slug") ?? "").trim(),
        parentId: (formData.get("parentId") as string) || undefined,
      }),
    });
    revalidatePath("/products");
    return { success: true };
  } catch (error) {
    return { success: false, error: actionErrorMessage(error) };
  }
}

export async function createBrandAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await apiFetch<Brand>("/catalog/brands", {
      method: "POST",
      body: JSON.stringify({
        name: String(formData.get("name") ?? "").trim(),
        slug: String(formData.get("slug") ?? "").trim(),
        logoUrl: (formData.get("logoUrl") as string) || undefined,
      }),
    });
    revalidatePath("/products");
    return { success: true };
  } catch (error) {
    return { success: false, error: actionErrorMessage(error) };
  }
}

// --- Variants ---

export async function createVariantAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const productId = String(formData.get("productId"));
  try {
    await apiFetch<ProductVariant>(`/catalog/products/${productId}/variants`, {
      method: "POST",
      body: JSON.stringify({
        sku: String(formData.get("sku") ?? "").trim(),
        stockQty: Number(formData.get("stockQty") ?? 0),
        price: (formData.get("price") as string) || undefined,
        attributes: parseAttributePairs(String(formData.get("attributes") ?? "")),
      }),
    });
    revalidatePath(`/products/${productId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: actionErrorMessage(error) };
  }
}

export async function deleteVariantAction(productId: string, variantId: string): Promise<ActionState> {
  try {
    await apiFetch<void>(`/catalog/variants/${variantId}`, { method: "DELETE" });
    revalidatePath(`/products/${productId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: actionErrorMessage(error) };
  }
}

// --- Images ---

export async function addImageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const productId = String(formData.get("productId"));
  try {
    await apiFetch<ProductImage>(`/catalog/products/${productId}/images`, {
      method: "POST",
      body: JSON.stringify({
        url: String(formData.get("url") ?? "").trim(),
        altText: (formData.get("altText") as string) || undefined,
      }),
    });
    revalidatePath(`/products/${productId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: actionErrorMessage(error) };
  }
}

export async function deleteImageAction(productId: string, imageId: string): Promise<ActionState> {
  try {
    await apiFetch<void>(`/catalog/products/${productId}/images/${imageId}`, { method: "DELETE" });
    revalidatePath(`/products/${productId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: actionErrorMessage(error) };
  }
}

export async function setPrimaryImageAction(productId: string, imageId: string): Promise<ActionState> {
  try {
    await apiFetch<ProductImage[]>(`/catalog/products/${productId}/images/${imageId}/primary`, {
      method: "PATCH",
    });
    revalidatePath(`/products/${productId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: actionErrorMessage(error) };
  }
}

// --- Inventory ---

export async function adjustInventoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const productId = String(formData.get("productId"));
  try {
    await apiFetch<InventoryAdjustment>(`/catalog/products/${productId}/inventory/adjust`, {
      method: "POST",
      body: JSON.stringify({
        delta: Number(formData.get("delta") ?? 0),
        reason: String(formData.get("reason") ?? "correction"),
        variantId: (formData.get("variantId") as string) || undefined,
      }),
    });
    revalidatePath(`/products/${productId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: actionErrorMessage(error) };
  }
}

function parseAttributePairs(raw: string): Record<string, string> {
  // Accepts "Size:M, Color:Red" from a plain-text input — a full
  // key/value repeater UI is unwarranted for a foundation module's
  // variant form; this covers the real case (a handful of attributes)
  // without building form-array state management for it.
  const result: Record<string, string> = {};
  for (const pair of raw.split(",")) {
    const [key, value] = pair.split(":").map((part) => part.trim());
    if (key && value) result[key] = value;
  }
  return result;
}
