import { getStaffUserId } from "@/lib/staff-auth";
import { redirect } from "next/navigation";
import { getMyProfile } from "@/lib/api/users";
import { ApiError } from "@/lib/api-client";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getStaffUserId();
  if (!userId) redirect("/sign-in");

  // Signed in with Clerk but not yet linked to a store (fresh signup) —
  // send them to self-serve store creation instead of a wall of 401s.
  let hasStore = true;
  try {
    await getMyProfile();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      hasStore = false;
    } else {
      throw error;
    }
  }
  if (!hasStore) redirect("/create-store");

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
