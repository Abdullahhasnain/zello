import "server-only";
import type { ConversionSummary } from "@zello-ai/types";
import { apiFetch } from "@/lib/api-client";

export async function getConversionSummary(): Promise<ConversionSummary> {
  return apiFetch<ConversionSummary>("/analytics/summary");
}
