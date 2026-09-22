import "server-only";
import type { StoreUser } from "@zello-ai/types";
import { apiFetch } from "@/lib/api-client";

export async function getMyProfile(): Promise<StoreUser> {
  return apiFetch<StoreUser>("/users/me");
}

export async function listTeam(): Promise<StoreUser[]> {
  return apiFetch<StoreUser[]>("/users/team");
}
