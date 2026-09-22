import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { auth0 } from "@/lib/auth0";

export async function getStaffUserId(): Promise<string | null> {
  if (process.env.AUTH_PROVIDER === "auth0") {
    return (await auth0!.getSession())?.user.sub ?? null;
  }
  return (await auth()).userId;
}

export async function getStaffEmail(): Promise<string | null> {
  if (process.env.AUTH_PROVIDER === "auth0") {
    return (await auth0!.getSession())?.user.email ?? null;
  }
  return (await currentUser())?.emailAddresses[0]?.emailAddress ?? null;
}

export async function getStaffToken(): Promise<string | null> {
  if (process.env.AUTH_PROVIDER === "auth0") {
    return (await auth0!.getAccessToken()).token;
  }
  return (await auth()).getToken();
}
