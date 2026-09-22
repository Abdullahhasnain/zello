import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  // Customer-facing storefront — shoppers are anonymous guests (their
  // identity is the self-issued customer JWT, not a Clerk session).
  "/store(.*)",
]);

// No publishable key configured yet (local preview before Clerk is wired up
// with real credentials) — skip Clerk entirely rather than crashing every
// request. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to enable auth.
const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default clerkConfigured
  ? clerkMiddleware(async (auth, req) => {
      if (!isPublicRoute(req)) {
        await auth.protect();
      }
    })
  : () => NextResponse.next();

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
