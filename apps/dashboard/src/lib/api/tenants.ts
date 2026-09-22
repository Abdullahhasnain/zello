import "server-only";
import type { Tenant } from "@zello-ai/types";
import { apiFetch } from "@/lib/api-client";

export async function getMyTenant(): Promise<Tenant> {
  return apiFetch<Tenant>("/tenants/me");
}
