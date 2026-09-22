import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { auth0 } from "@/lib/auth0";

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

export default process.env.AUTH_PROVIDER === "auth0"
  ? async (req: NextRequest) => {
      const response = await auth0!.middleware(req);
      // Server Components cannot persist a refreshed access token themselves.
      // Refresh through middleware, where the SDK can update the session cookie.
      if (!isPublicRoute(req) && !req.nextUrl.pathname.startsWith("/auth/") && await auth0!.getSession(req)) {
        await auth0!.getAccessToken(req, response);
      }
      return response;
    }
  : clerkConfigured
  ? clerkMiddleware(async (auth, req) => {
      if (!isPublicRoute(req)) {
        await auth.protect();
      }
    })
  : () => NextResponse.next();

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
