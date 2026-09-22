"use client";

import { useActionState, useEffect } from "react";
import type { Brand, Category, Product } from "@zello-ai/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { updateProductAction } from "@/lib/actions/products";
import { INITIAL_ACTION_STATE } from "@/lib/actions/types";

export function ProductEditForm({
  product,
  categories,
  brands,
}: {
  product: Product;
  categories: Category[];
  brands: Brand[];
}) {
  const [state, formAction, isPending] = useActionState(updateProductAction, INITIAL_ACTION_STATE);
  const { show } = useToast();

  useEffect(() => {
    if (state.success) show("Product updated", "success");
  }, [state.success, show]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="productId" value={product.id} />
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" defaultValue={product.title} required />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" defaultValue={product.description ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="price">Price (PKR)</Label>
              <Input id="price" name="price" type="number" min="0" step="0.01" defaultValue={product.price} />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue={product.status}>
                <option value="active">Active</option>
                <option value="out_of_stock">Out of stock</option>
                <option value="archived">Archived</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="categoryId">Category</Label>
              <Select id="categoryId" name="categoryId" defaultValue={product.categoryId ?? ""}>
                <option value="">None</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="brandId">Brand</Label>
              <Select id="brandId" name="brandId" defaultValue={product.brandId ?? ""}>
                <option value="">None</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {state.error ? <FieldError>{state.error}</FieldError> : null}
          <div className="flex justify-end">
            <Button type="submit" isLoading={isPending}>
              Save changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
