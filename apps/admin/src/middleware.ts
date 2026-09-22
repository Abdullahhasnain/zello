import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth0 } from "@/lib/auth0";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)"]);

// IP allowlist is a defense-in-depth layer on top of Clerk auth + RBAC —
// see docs/architecture/auth-flow.md. In production this is better enforced
// at the load balancer / VPN layer; this check is a fallback.
const allowedRanges = (process.env.ADMIN_ALLOWED_IP_RANGES ?? "").split(",").filter(Boolean);

function ipAllowlistCheck(req: Request): NextResponse | undefined {
  if (allowedRanges.length > 0) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (ip && !allowedRanges.some((range) => ip.startsWith(range.split("/")[0] ?? range))) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }
  return undefined;
}

// Clerk middleware only runs once a publishable key is configured — same
// pattern as apps/dashboard/src/middleware.ts. The IP allowlist still
// applies either way.
const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default process.env.AUTH_PROVIDER === "auth0"
  ? async (req: NextRequest) => {
      const forbidden = ipAllowlistCheck(req);
      if (forbidden) return forbidden;
      const response = await auth0!.middleware(req);
      if (!isPublicRoute(req) && !req.nextUrl.pathname.startsWith("/auth/") && await auth0!.getSession(req)) {
        await auth0!.getAccessToken(req, response);
      }
      return response;
    }
  : clerkConfigured
  ? clerkMiddleware(async (auth, req) => {
      const forbidden = ipAllowlistCheck(req);
      if (forbidden) return forbidden;

      if (!isPublicRoute(req)) {
        await auth.protect();
      }
    })
  : (req: Request) => ipAllowlistCheck(req) ?? NextResponse.next();

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
