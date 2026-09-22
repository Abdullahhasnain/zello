"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/input";
import { createStoreAction } from "@/lib/actions/stores";
import { INITIAL_ACTION_STATE } from "@/lib/actions/types";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function CreateStoreForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createStoreAction, INITIAL_ACTION_STATE);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    if (state.success) {
      router.replace("/dashboard");
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="name">Store name</Label>
        <Input
          id="name"
          name="name"
          required
          placeholder="Khaadi Outlet"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (!slugTouched) setSlug(slugify(event.target.value));
          }}
        />
      </div>
      <div>
        <Label htmlFor="slug">Store URL</Label>
        <Input
          id="slug"
          name="slug"
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          placeholder="khaadi-outlet"
          value={slug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(slugify(event.target.value));
          }}
        />
        <FieldHint>
          Your storefront will live at <span className="font-mono">/store/{slug || "your-slug"}</span>
        </FieldHint>
      </div>
      {state.error ? <FieldError>{state.error}</FieldError> : null}
      <Button type="submit" className="w-full" isLoading={isPending}>
        Create store
      </Button>
    </form>
  );
}
