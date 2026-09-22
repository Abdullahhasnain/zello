"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Category, Product } from "@zello-ai/types";
import { listCategories, listProducts, searchProducts } from "@/lib/storefront/api";
import { ProductCard } from "./product-card";
import { Input, Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

export function ProductBrowser({ slug }: { slug: string }) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setProducts(null);
    setError(null);
    listProducts(slug, categoryId || undefined)
      .then((items) => {
        if (!cancelled) setProducts(items);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, categoryId]);

  useEffect(() => {
    listCategories(slug)
      .then(setCategories)
      .catch(() => undefined);
  }, [slug]);

  // Debounced search — semantic when the backend supports it, local
  // filter fallback otherwise (handled inside searchProducts).
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!query.trim()) return;
    searchTimer.current = setTimeout(() => {
      searchProducts(slug, query.trim())
        .then(setProducts)
        .catch((err: Error) => setError(err.message));
    }, 350);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [slug, query]);

  const visible = useMemo(() => products ?? [], [products]);

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <Input
          aria-label="Search products"
          placeholder="Search products… (Roman Urdu bhi chalega)"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="sm:max-w-sm"
        />
        <Select
          aria-label="Filter by category"
          value={categoryId}
          onChange={(event) => {
            setCategoryId(event.target.value);
            setQuery("");
          }}
          className="sm:w-48"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
      </div>

      {error ? (
        <EmptyState title="Couldn't load products" description={error} />
      ) : products === null ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-[4/5] rounded-card" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          title={query ? "No products match your search" : "No products yet"}
          description={query ? "Try a different search term." : "This store hasn't added products yet."}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((product) => (
            <ProductCard key={product.id} slug={slug} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
