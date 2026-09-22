"use server";

import { getStaffEmail } from "@/lib/staff-auth";
import type { Tenant } from "@zello-ai/types";
import { apiFetch } from "@/lib/api-client";
import { ActionState, actionErrorMessage } from "./types";

export async function createStoreAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    // Email comes from the server-side Clerk session, never from the form —
    // the backend binds this Clerk identity as the new store's owner.
    const email = await getStaffEmail();
    if (!email) {
      return { success: false, error: "Could not read your account email. Please sign in again." };
    }

    await apiFetch<Tenant>("/tenants", {
      method: "POST",
      body: JSON.stringify({
        name: String(formData.get("name") ?? "").trim(),
        slug: String(formData.get("slug") ?? "")
          .trim()
          .toLowerCase(),
        email,
      }),
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: actionErrorMessage(error) };
  }
}
