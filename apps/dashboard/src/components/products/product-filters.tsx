"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Brand, Category } from "@zello-ai/types";
import { Select } from "@/components/ui/input";

export function ProductFilters({ categories, brands }: { categories: Category[]; brands: Brand[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Select
        aria-label="Filter by category"
        className="w-44"
        defaultValue={searchParams.get("categoryId") ?? ""}
        onChange={(event) => updateParam("categoryId", event.target.value)}
      >
        <option value="">All categories</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by brand"
        className="w-44"
        defaultValue={searchParams.get("brandId") ?? ""}
        onChange={(event) => updateParam("brandId", event.target.value)}
      >
        <option value="">All brands</option>
        {brands.map((brand) => (
          <option key={brand.id} value={brand.id}>
            {brand.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
