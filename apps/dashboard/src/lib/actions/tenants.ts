"use server";

import { revalidatePath } from "next/cache";
import type { Tenant } from "@zello-ai/types";
import { apiFetch } from "@/lib/api-client";
import { ActionState, actionErrorMessage } from "./types";

export async function updateBrandingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const languageMix = formData.getAll("languageMix").map(String);
    await apiFetch<Tenant>("/tenants/me/branding", {
      method: "PATCH",
      body: JSON.stringify({
        branding: {
          primaryColor: String(formData.get("primaryColor") ?? "").trim() || undefined,
          greetingPersona: (formData.get("greetingPersona") as string)?.trim() || undefined,
          logoUrl: (formData.get("logoUrl") as string)?.trim() || undefined,
          languageMix: languageMix.length > 0 ? languageMix : undefined,
        },
      }),
    });
    revalidatePath("/widget-studio");
    return { success: true };
  } catch (error) {
    return { success: false, error: actionErrorMessage(error) };
  }
}
