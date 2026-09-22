"use client";

import { useActionState, useEffect, useState } from "react";
import type { Brand, Category } from "@zello-ai/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { createProductAction } from "@/lib/actions/products";
import { INITIAL_ACTION_STATE } from "@/lib/actions/types";

export function ProductFormDialog({ categories, brands }: { categories: Category[]; brands: Brand[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createProductAction, INITIAL_ACTION_STATE);
  const { show } = useToast();

  useEffect(() => {
    if (state.success) {
      show("Product created", "success");
      setOpen(false);
    }
  }, [state.success, show]);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Add product
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Add product">
        <form action={formAction} className="space-y-4">
          <div>
            <Label htmlFor="externalId">SKU / External ID</Label>
            <Input id="externalId" name="externalId" required placeholder="SKU-1024" />
          </div>
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required placeholder="Men's Kurta — Navy" />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" placeholder="Optional product description" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="price">Price (PKR)</Label>
              <Input id="price" name="price" type="number" min="0" step="0.01" required placeholder="2500" />
            </div>
            <div>
              <Label htmlFor="stockQty">Stock quantity</Label>
              <Input id="stockQty" name="stockQty" type="number" min="0" step="1" defaultValue={0} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="categoryId">Category</Label>
              <Select id="categoryId" name="categoryId" defaultValue="">
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
              <Select id="brandId" name="brandId" defaultValue="">
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
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isPending}>
              Create product
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
