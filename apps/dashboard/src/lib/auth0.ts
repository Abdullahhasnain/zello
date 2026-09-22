import { Auth0Client } from "@auth0/nextjs-auth0/server";

// The Clerk path remains available for existing installations. Auth0 is used
// only when explicitly selected in the deployment environment.
export const auth0 = process.env.AUTH_PROVIDER === "auth0"
  ? new Auth0Client({
      authorizationParameters: {
        audience: process.env.AUTH0_AUDIENCE,
        scope: "openid profile email offline_access",
      },
    })
  : null;
