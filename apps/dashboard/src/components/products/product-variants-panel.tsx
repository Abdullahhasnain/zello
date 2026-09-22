"use client";

import { useActionState, useState, useTransition } from "react";
import type { ProductVariant } from "@zello-ai/types";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldError, Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { createVariantAction, deleteVariantAction } from "@/lib/actions/products";
import { INITIAL_ACTION_STATE } from "@/lib/actions/types";

export function ProductVariantsPanel({
  productId,
  variants,
}: {
  productId: string;
  variants: ProductVariant[];
}) {
  const [state, formAction, isPending] = useActionState(createVariantAction, INITIAL_ACTION_STATE);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const { show } = useToast();

  function handleDelete(variantId: string) {
    setPendingDeleteId(variantId);
    startDeleteTransition(async () => {
      const result = await deleteVariantAction(productId, variantId);
      if (result.success) {
        show("Variant removed", "success");
      } else {
        show(result.error ?? "Failed to remove variant", "error");
      }
      setPendingDeleteId(null);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Variants</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {variants.length === 0 ? (
          <EmptyState title="No variants" description="Add size, color, or other purchasable variations." />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {variants.map((variant) => (
              <li key={variant.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{variant.sku}</p>
                  <p className="truncate text-xs text-ink-faint">
                    {Object.entries(variant.attributes)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join(", ") || "No attributes"}
                    {" · "}
                    Stock {variant.stockQty}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={statusTone(variant.status)}>{variant.status.replace("_", " ")}</Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    isLoading={isDeleting && pendingDeleteId === variant.id}
                    onClick={() => handleDelete(variant.id)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form action={formAction} className="space-y-3 border-t border-border pt-4">
          <input type="hidden" name="productId" value={productId} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" name="sku" required placeholder="SKU-1024-M" />
            </div>
            <div>
              <Label htmlFor="variantStockQty">Stock quantity</Label>
              <Input id="variantStockQty" name="stockQty" type="number" min="0" defaultValue={0} />
            </div>
          </div>
          <div>
            <Label htmlFor="attributes">Attributes</Label>
            <Input id="attributes" name="attributes" placeholder="Size:M, Color:Navy" />
          </div>
          {state.error ? <FieldError>{state.error}</FieldError> : null}
          <div className="flex justify-end">
            <Button type="submit" variant="secondary" size="sm" isLoading={isPending}>
              Add variant
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
