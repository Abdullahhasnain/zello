"use client";

import type { CartDetail, CartItem, Category, GuestSession, Order, Product } from "@zello-ai/types";

/**
 * Client-side API layer for the public storefront (/store/[slug]). Unlike
 * the dashboard's server-side apiFetch (Clerk session), shoppers are
 * anonymous guests: the widget's guest-session flow issues a self-signed
 * customer JWT per browser, persisted in localStorage so the same shopper
 * keeps their cart across page loads.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

const sessionKey = (slug: string) => `zello.storefront.session.${slug}`;
const cartKey = (slug: string) => `zello.storefront.cart.${slug}`;

export class StorefrontApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail);
  }
}

async function rawFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => undefined);
    const detail =
      body && typeof body === "object" && "detail" in body && typeof body.detail === "string"
        ? body.detail
        : `Request failed (${res.status})`;
    throw new StorefrontApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function bootstrapSession(slug: string): Promise<GuestSession> {
  const session = await rawFetch<GuestSession>("/auth/guest-session", {
    method: "POST",
    body: JSON.stringify({ tenantSlug: slug }),
  });
  const raced = storedSession(slug);
  if (raced) return raced;
  localStorage.setItem(sessionKey(slug), JSON.stringify(session));
  return session;
}

function storedSession(slug: string): GuestSession | null {
  const raw = localStorage.getItem(sessionKey(slug)) ?? localStorage.getItem(`zello:${slug}:session`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GuestSession;
  } catch {
    return null;
  }
}

/** Authenticated storefront call — bootstraps a guest session on first use
 * and transparently re-bootstraps once if the stored token has expired. */
async function storefrontFetch<T>(slug: string, path: string, init: RequestInit = {}): Promise<T> {
  let session = storedSession(slug) ?? (await bootstrapSession(slug));

  const attempt = (token: string) =>
    rawFetch<T>(path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });

  try {
    return await attempt(session.accessToken);
  } catch (error) {
    if (error instanceof StorefrontApiError && error.status === 401) {
      try {
        session = await rawFetch<GuestSession>("/auth/refresh", {
          method: "POST", body: JSON.stringify({ refreshToken: session.refreshToken }),
        });
        localStorage.setItem(sessionKey(slug), JSON.stringify(session));
      } catch {
        localStorage.removeItem(cartKey(slug));
        localStorage.removeItem(sessionKey(slug));
        localStorage.removeItem(`zello:${slug}:session`);
        session = await bootstrapSession(slug);
      }
      return attempt(session.accessToken);
    }
    throw error;
  }
}

// --- Products ---

export function listProducts(slug: string, categoryId?: string): Promise<Product[]> {
  const query = new URLSearchParams({ limit: "100" });
  if (categoryId) query.set("category_id", categoryId);
  return storefrontFetch<Product[]>(slug, `/catalog/storefront/products?${query.toString()}`);
}

export function getProduct(slug: string, productId: string): Promise<Product> {
  return storefrontFetch<Product>(slug, `/catalog/storefront/products/${productId}`);
}

export function listCategories(slug: string): Promise<Category[]> {
  return storefrontFetch<Category[]>(slug, "/catalog/storefront/categories");
}

export async function searchProducts(slug: string, query: string): Promise<Product[]> {
  // Storefront filtering is deliberately lexical and exhaustive. Semantic
  // retrieval is useful inside the sales conversation, but a search box must
  // never render a white product for the literal query "black" merely because
  // its embedding is nearby. Attributes include imported colour/category and
  // searchable tags from Shopify/WooCommerce catalogues.
  const [all, categories] = await Promise.all([listProducts(slug), listCategories(slug)]);
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const tokens = searchTokens(query);
  if (tokens.length === 0) return all;

  return all.filter((product) => {
    const searchable = normalizeSearchText([
      product.title,
      product.description ?? "",
      product.categoryId ? categoryNames.get(product.categoryId) ?? "" : "",
      flattenSearchValues(product.attributes),
    ].join(" "));
    return tokens.every((token) => searchable.includes(token));
  });
}

const SEARCH_ALIASES: Record<string, string> = {
  kala: "black", kaala: "black", kale: "black", kaale: "black", kali: "black",
  safed: "white", bhura: "brown", neela: "blue",
  joota: "shoes", jootay: "shoes", juta: "shoes", jute: "shoes",
  sneaker: "shoes", sneakers: "shoes", footwear: "shoes",
  tshirt: "shirt", "t-shirt": "shirt", shirts: "shirt",
};

const SEARCH_STOP_WORDS = new Set([
  "mujhe", "mein", "main", "koi", "ka", "ki", "ke", "hai", "hain",
  "chahiye", "dikhao", "dikhayein", "show", "me", "please", "products",
]);

function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase("en-PK")
    .replace(/[_/]+/g, " ")
    .replace(/[^\p{L}\p{N}-]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => SEARCH_ALIASES[token] ?? token)
    .join(" ");
}

function searchTokens(query: string): string[] {
  return [...new Set(normalizeSearchText(query).split(" "))]
    .filter((token) => token.length > 1 && !SEARCH_STOP_WORDS.has(token));
}

function flattenSearchValues(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(flattenSearchValues).join(" ");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .flatMap(([key, nested]) => [key, flattenSearchValues(nested)])
      .join(" ");
  }
  return String(value);
}

// --- Cart ---

function storedCartId(slug: string): string | null {
  return localStorage.getItem(cartKey(slug));
}

async function ensureCart(slug: string): Promise<string> {
  const existing = storedCartId(slug);
  if (existing && await getCart(slug)) return existing;
  const cart = await storefrontFetch<{ id: string }>(slug, "/orders/carts", { method: "POST" });
  localStorage.setItem(cartKey(slug), cart.id);
  return cart.id;
}

export async function addToCart(slug: string, productId: string, quantity: number): Promise<CartItem> {
  const cartId = await ensureCart(slug);
  return storefrontFetch<CartItem>(slug, `/orders/carts/${cartId}/items`, {
    method: "POST",
    body: JSON.stringify({ productId, quantity }),
  });
}

export async function getCart(slug: string): Promise<CartDetail | null> {
  const cartId = storedCartId(slug);
  if (!cartId) return null;
  try {
    const cart = await storefrontFetch<CartDetail>(slug, `/orders/carts/${cartId}`);
    if (cart.status !== "open") {
      localStorage.removeItem(cartKey(slug));
      return null;
    }
    return cart;
  } catch (error) {
    if (error instanceof StorefrontApiError && error.status === 404) {
      localStorage.removeItem(cartKey(slug));
      return null;
    }
    throw error;
  }
}

export function updateCartItem(
  slug: string,
  cartId: string,
  itemId: string,
  quantity: number,
): Promise<CartDetail> {
  return storefrontFetch<CartDetail>(slug, `/orders/carts/${cartId}/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify({ quantity }),
  });
}

export function removeCartItem(slug: string, cartId: string, itemId: string): Promise<CartDetail> {
  return storefrontFetch<CartDetail>(slug, `/orders/carts/${cartId}/items/${itemId}`, {
    method: "DELETE",
  });
}

// --- Checkout ---

export interface CheckoutDetails {
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryCity: string;
  orderNotes?: string;
}

export async function checkout(slug: string, paymentMethod: string, details: CheckoutDetails): Promise<Order> {
  const cartId = storedCartId(slug);
  if (!cartId) throw new StorefrontApiError(400, "Your cart is empty");
  const order = await storefrontFetch<Order>(slug, "/orders/checkout", {
    method: "POST",
    body: JSON.stringify({ cartId, paymentMethod, ...details }),
  });
  // The cart converted into an order — next add-to-cart starts fresh.
  localStorage.removeItem(cartKey(slug));
  return order;
}

export function getOrder(slug: string, orderId: string): Promise<Order> {
  return storefrontFetch<Order>(slug, `/orders/${orderId}`);
}

// --- Display helpers ---

export function formatPrice(value: number | string, currency = "PKR"): string {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value));
}
