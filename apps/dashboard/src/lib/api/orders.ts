import "server-only";
import type { Order } from "@zello-ai/types";
import { apiFetch } from "@/lib/api-client";

export async function listOrders(params: { limit?: number; offset?: number } = {}): Promise<Order[]> {
  const query = new URLSearchParams();
  if (params.limit) query.set("limit", String(params.limit));
  if (params.offset) query.set("offset", String(params.offset));
  return apiFetch<Order[]>(`/orders?${query.toString()}`);
}
