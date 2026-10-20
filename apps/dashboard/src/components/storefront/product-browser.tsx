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
  const requestVersion = useRef(0);

  useEffect(() => {
    const version = ++requestVersion.current;
    const searchQuery = query.trim();
    setError(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);

    const load = () => {
      const request = searchQuery
        ? searchProducts(slug, searchQuery)
        : listProducts(slug, categoryId || undefined);
      request
        .then((items) => {
          if (requestVersion.current === version) setProducts(items);
        })
        .catch((err: Error) => {
          if (requestVersion.current === version) setError(err.message);
        });
    };

    if (searchQuery) searchTimer.current = setTimeout(load, 350);
    else load();

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [slug, categoryId, query]);

  useEffect(() => {
    listCategories(slug)
      .then(setCategories)
      .catch(() => undefined);
  }, [slug]);

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
