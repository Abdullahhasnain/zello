"use client";

import { useActionState, useEffect } from "react";
import type { InventoryAdjustment } from "@zello-ai/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldError, Input, Label, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { adjustInventoryAction } from "@/lib/actions/products";
import { INITIAL_ACTION_STATE } from "@/lib/actions/types";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function ProductInventoryPanel({
  productId,
  history,
}: {
  productId: string;
  history: InventoryAdjustment[];
}) {
  const [state, formAction, isPending] = useActionState(adjustInventoryAction, INITIAL_ACTION_STATE);
  const { show } = useToast();

  useEffect(() => {
    if (state.success) show("Inventory adjusted", "success");
  }, [state.success, show]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory history</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {history.length === 0 ? (
          <EmptyState title="No adjustments yet" description="Stock changes will be logged here." />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {history.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between px-3 py-2.5 text-sm">
                <div>
                  <p className="font-medium text-ink capitalize">{entry.reason}</p>
                  <p className="text-xs text-ink-faint">{formatDate(entry.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className={entry.delta >= 0 ? "font-medium text-success" : "font-medium text-danger"}>
                    {entry.delta >= 0 ? `+${entry.delta}` : entry.delta}
                  </p>
                  <p className="text-xs text-ink-faint">Now {entry.resultingStockQty}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form action={formAction} className="grid grid-cols-2 gap-3 border-t border-border pt-4">
          <input type="hidden" name="productId" value={productId} />
          <div>
            <Label htmlFor="delta">Adjustment</Label>
            <Input id="delta" name="delta" type="number" required placeholder="e.g. 10 or -5" />
          </div>
          <div>
            <Label htmlFor="reason">Reason</Label>
            <Select id="reason" name="reason" defaultValue="correction">
              <option value="restock">Restock</option>
              <option value="sale">Sale</option>
              <option value="correction">Correction</option>
              <option value="return">Return</option>
            </Select>
          </div>
          {state.error ? (
            <div className="col-span-2">
              <FieldError>{state.error}</FieldError>
            </div>
          ) : null}
          <div className="col-span-2 flex justify-end">
            <Button type="submit" variant="secondary" size="sm" isLoading={isPending}>
              Apply adjustment
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
