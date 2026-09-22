import { headers } from "next/headers";
import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/nextjs/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

/**
 * Syncs Clerk user lifecycle events into the backend's `store_users` table
 * (see services/api/app/modules/users). Verified via Svix per Clerk's
 * webhook spec — see docs/architecture/auth-flow.md.
 */
export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  const internalToken = process.env.INTERNAL_SERVICE_TOKEN;
  if (!webhookSecret || !internalToken) {
    return new Response("Missing CLERK_WEBHOOK_SECRET or INTERNAL_SERVICE_TOKEN", { status: 500 });
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const body = await req.text();
  const wh = new Webhook(webhookSecret);

  let event: WebhookEvent;
  try {
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "user.created") {
    const user = event.data;
    const email = user.email_addresses?.[0]?.email_address;
    // `tenantSlug` is captured at sign-up time (e.g. via an invite link
    // that pre-fills unsafeMetadata on Clerk's <SignUp> component) — the
    // onboarding UI module owns actually setting this; this route only
    // forwards whatever is there.
    const tenantSlug = (user.unsafe_metadata as { tenantSlug?: string } | undefined)?.tenantSlug;

    if (!email || !tenantSlug) {
      return new Response("Missing email or tenantSlug in Clerk user metadata", { status: 422 });
    }

    const syncResponse = await fetch(`${API_BASE_URL}/users/internal/clerk-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Token": internalToken,
      },
      body: JSON.stringify({ clerkUserId: user.id, email, tenantSlug }),
    });

    if (!syncResponse.ok) {
      return new Response(`Backend sync failed: ${syncResponse.status}`, { status: 502 });
    }
  }

  return new Response("ok", { status: 200 });
}
