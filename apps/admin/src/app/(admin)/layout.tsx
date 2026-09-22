import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

// Structure-only shell. RBAC role check (super-admin / ops / support / finance —
// FR-3.9) reads the role claim the backend attaches to the Clerk session via
// its public metadata sync — see docs/architecture/auth-flow.md.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return <div data-shell="admin">{children}</div>;
}
