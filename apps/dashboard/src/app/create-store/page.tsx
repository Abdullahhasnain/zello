import { getStaffUserId } from "@/lib/staff-auth";
import { redirect } from "next/navigation";
import { getMyProfile } from "@/lib/api/users";
import { ApiError } from "@/lib/api-client";
import { CreateStoreForm } from "@/components/stores/create-store-form";

export default async function CreateStorePage() {
  const userId = await getStaffUserId();
  if (!userId) redirect("/sign-in");

  // Already linked to a store → nothing to create here.
  let hasStore = false;
  try {
    await getMyProfile();
    hasStore = true;
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401)) throw error;
  }
  if (hasStore) redirect("/dashboard");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md rounded-card border border-border bg-surface p-6 shadow-card sm:p-8">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent font-display text-base font-bold text-white">
            Z
          </span>
          <h1 className="font-display text-xl font-semibold text-ink">Create your store</h1>
          <p className="mt-1 text-sm text-ink-soft">
            One last step — give your store a name and you&apos;re in.
          </p>
        </div>
        <CreateStoreForm />
      </div>
    </div>
  );
}
