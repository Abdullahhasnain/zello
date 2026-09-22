"use client";

import { useActionState, useState, useTransition } from "react";
import type { ProductImage } from "@zello-ai/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldError, Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { addImageAction, deleteImageAction, setPrimaryImageAction } from "@/lib/actions/products";
import { INITIAL_ACTION_STATE } from "@/lib/actions/types";
import { cn } from "@/lib/utils";

export function ProductImagesPanel({ productId, images }: { productId: string; images: ProductImage[] }) {
  const [state, formAction, isPending] = useActionState(addImageAction, INITIAL_ACTION_STATE);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isMutating, startTransition] = useTransition();
  const { show } = useToast();

  function handleDelete(imageId: string) {
    setPendingId(imageId);
    startTransition(async () => {
      const result = await deleteImageAction(productId, imageId);
      show(result.success ? "Image removed" : result.error ?? "Failed to remove image", result.success ? "success" : "error");
      setPendingId(null);
    });
  }

  function handleSetPrimary(imageId: string) {
    setPendingId(imageId);
    startTransition(async () => {
      const result = await setPrimaryImageAction(productId, imageId);
      show(result.success ? "Primary image updated" : result.error ?? "Failed to update", result.success ? "success" : "error");
      setPendingId(null);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Images</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {images.length === 0 ? (
          <EmptyState title="No images" description="Add an image URL so customers can see the product." />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((image) => (
              <div key={image.id} className="group relative overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary external URLs, not build-time known */}
                <img src={image.url} alt={image.altText ?? ""} className="h-28 w-full object-cover" />
                {image.isPrimary ? (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white">
                    Primary
                  </span>
                ) : null}
                <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-ink/70 p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  {!image.isPrimary ? (
                    <button
                      type="button"
                      disabled={isMutating && pendingId === image.id}
                      onClick={() => handleSetPrimary(image.id)}
                      className={cn("flex-1 rounded bg-white/10 py-1 text-[11px] font-medium text-white hover:bg-white/20")}
                    >
                      Make primary
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={isMutating && pendingId === image.id}
                    onClick={() => handleDelete(image.id)}
                    className="flex-1 rounded bg-white/10 py-1 text-[11px] font-medium text-white hover:bg-white/20"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <form action={formAction} className="space-y-3 border-t border-border pt-4">
          <input type="hidden" name="productId" value={productId} />
          <div>
            <Label htmlFor="imageUrl">Image URL</Label>
            <Input id="imageUrl" name="url" type="url" required placeholder="https://cdn.example.com/product.jpg" />
          </div>
          <div>
            <Label htmlFor="altText">Alt text</Label>
            <Input id="altText" name="altText" placeholder="Front view" />
          </div>
          {state.error ? <FieldError>{state.error}</FieldError> : null}
          <div className="flex justify-end">
            <Button type="submit" variant="secondary" size="sm" isLoading={isPending}>
              Add image
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
