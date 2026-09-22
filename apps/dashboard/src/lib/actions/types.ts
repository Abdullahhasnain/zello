/** Shared shape every Server Action in lib/actions/*.ts resolves to —
 * matches what React 19's useActionState expects as its reducer-style
 * state, so every form in the app handles success/error the same way. */
export interface ActionState {
  success: boolean;
  error?: string;
}

export const INITIAL_ACTION_STATE: ActionState = { success: false };

export function actionErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "body" in error) {
    const body = (error as { body?: unknown }).body;
    if (body && typeof body === "object" && "detail" in body) {
      const detail = (body as { detail?: unknown }).detail;
      if (typeof detail === "string") return detail;
    }
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
