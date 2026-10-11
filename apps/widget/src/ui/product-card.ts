import type { StorefrontProduct } from "../types";

/** Visual state is driven only by the real conversation/cart operation.
 * The rank is the backend search result order, not an invented rating. */
export interface ProductRowOptions {
  onAdd?: (product: StorefrontProduct) => void;
  pendingProductId?: string | null;
  addedProductId?: string | null;
}

export function buildProductRow(
  products: StorefrontProduct[],
  options: ProductRowOptions = {},
): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "zello-product-row";
  row.setAttribute("aria-label", "Recommended products");

  for (const [index, product] of products.entries()) {
    row.appendChild(buildProductCard(product, index, options));
  }
  return row;
}

function buildProductCard(
  product: StorefrontProduct,
  rank: number,
  { onAdd, pendingProductId, addedProductId }: ProductRowOptions,
): HTMLDivElement {
  const card = document.createElement("div");
  card.className = "zello-product-card";
  if (product.id === pendingProductId) card.classList.add("zello-product-card-pending");
  if (product.id === addedProductId) card.classList.add("zello-product-card-added");

  // The backend deliberately returns ranked products. "Top match" is the
  // one recommendation label the widget can truthfully show without ratings,
  // discount, review, or preference-score fields in the catalog API.
  if (rank === 0) {
    const recommendation = document.createElement("span");
    recommendation.className = "zello-product-recommendation";
    recommendation.textContent = "✦ Top match";
    card.appendChild(recommendation);
  }

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

  const available = product.status === "active" && product.stockQty > 0;
  const status = document.createElement("div");
  status.className = "zello-product-stock";
  status.textContent = available ? "● In stock" : "Out of stock";
  card.appendChild(status);

  const isPending = product.id === pendingProductId;
  const isAdded = product.id === addedProductId;
  if (onAdd || isPending || isAdded) {
    const add = document.createElement("button");
    add.type = "button";
    add.className = "zello-product-add";
    add.setAttribute("aria-label", `Add ${product.title} to cart`);
    add.disabled = !available || isPending || isAdded || !onAdd;
    add.textContent = isAdded ? "✓ Added" : isPending ? "Adding…" : "🛒 Add to cart";
    if (onAdd && !isPending && !isAdded) add.addEventListener("click", () => onAdd(product));
    card.appendChild(add);
  }

  if (!available) {
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
