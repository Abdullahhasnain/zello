import type { StorefrontProduct } from "../types";

/**
 * Renders the real catalog data the assistant's reply was grounded in —
 * title, price, image straight from the tenant's own product record (see
 * ui/widget-element.ts's attachProductResults, which fetches these by id
 * from `intent.matched_product_ids`). This is what makes "the AI never
 * invents a product" visible to the shopper, not just true on the backend:
 * whatever appears here is exactly what `/catalog/storefront/products/{id}`
 * returned, nothing composed or guessed by the model.
 */
export function buildProductRow(products: StorefrontProduct[]): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "zello-product-row";

  for (const product of products) {
    row.appendChild(buildProductCard(product));
  }

  return row;
}

function buildProductCard(product: StorefrontProduct): HTMLDivElement {
  const card = document.createElement("div");
  card.className = "zello-product-card";

  const image = document.createElement("div");
  image.className = "zello-product-image";
  const imageUrl = product.images[0];
  if (imageUrl) {
    const img = document.createElement("img");
    img.src = imageUrl;
    img.alt = product.title;
    img.loading = "lazy";
    image.appendChild(img);
  } else {
    image.classList.add("zello-product-image-placeholder");
  }
  card.appendChild(image);

  const title = document.createElement("div");
  title.className = "zello-product-title";
  title.textContent = product.title;
  card.appendChild(title);

  const price = document.createElement("div");
  price.className = "zello-product-price";
  price.textContent = formatPrice(product.price, product.currency);
  card.appendChild(price);

  if (product.status === "out_of_stock" || product.stockQty <= 0) {
    const badge = document.createElement("div");
    badge.className = "zello-product-badge";
    badge.textContent = "Out of stock";
    card.appendChild(badge);
  }

  return card;
}

function formatPrice(price: number | string, currency: string): string {
  const value = typeof price === "string" ? Number(price) : price;
  if (Number.isNaN(value)) {
    return `${currency} ${price}`;
  }
  return `${currency} ${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
