"use client";

import { useActionState, useEffect, useState } from "react";
import type { Tenant } from "@zello-ai/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { updateBrandingAction } from "@/lib/actions/tenants";
import { INITIAL_ACTION_STATE } from "@/lib/actions/types";
import { WidgetLivePreview } from "./widget-live-preview";
import { WidgetEmbedSnippet } from "./widget-embed-snippet";

const LANGUAGE_OPTIONS = [
  { value: "roman_urdu", label: "Roman Urdu" },
  { value: "urdu", label: "Urdu" },
  { value: "english", label: "English" },
] as const;

export function WidgetStudioClient({ tenant }: { tenant: Tenant }) {
  const [state, formAction, isPending] = useActionState(updateBrandingAction, INITIAL_ACTION_STATE);
  const { show } = useToast();

  const [primaryColor, setPrimaryColor] = useState(tenant.branding.primaryColor ?? "#b6602a");
  const [greetingPersona, setGreetingPersona] = useState(tenant.branding.greetingPersona ?? "");
  const [logoUrl, setLogoUrl] = useState(tenant.branding.logoUrl ?? "");
  const [languageMix, setLanguageMix] = useState<string[]>(
    tenant.branding.languageMix && tenant.branding.languageMix.length > 0
      ? tenant.branding.languageMix
      : ["roman_urdu"],
  );
  const [position, setPosition] = useState<"bottom-right" | "bottom-left">("bottom-right");

  useEffect(() => {
    if (state.success) show("Widget branding updated", "success");
  }, [state.success, show]);

  function toggleLanguage(value: string) {
    setLanguageMix((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    );
  }

  const previewLanguage: "roman_urdu" | "urdu" | "english" =
    languageMix[0] === "urdu" || languageMix[0] === "english" ? languageMix[0] : "roman_urdu";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div>
              <Label htmlFor="primaryColor">Primary color</Label>
              <div className="flex items-center gap-3">
                <input
                  id="primaryColor"
                  name="primaryColor"
                  type="color"
                  value={primaryColor}
                  onChange={(event) => setPrimaryColor(event.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-surface"
                />
                <Input
                  aria-label="Primary color hex value"
                  value={primaryColor}
                  onChange={(event) => setPrimaryColor(event.target.value)}
                  className="max-w-[140px]"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="greetingPersona">Greeting message</Label>
              <Textarea
                id="greetingPersona"
                name="greetingPersona"
                value={greetingPersona}
                onChange={(event) => setGreetingPersona(event.target.value)}
                placeholder="Leave blank to use the default per-language greeting"
              />
            </div>
            <div>
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                name="logoUrl"
                type="url"
                value={logoUrl}
                onChange={(event) => setLogoUrl(event.target.value)}
                placeholder="https://cdn.example.com/logo.png"
              />
            </div>
            <div>
              <Label>Languages the agent should speak</Label>
              <div className="flex flex-wrap gap-2">
                {LANGUAGE_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-ink has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
                  >
                    <input
                      type="checkbox"
                      name="languageMix"
                      value={option.value}
                      checked={languageMix.includes(option.value)}
                      onChange={() => toggleLanguage(option.value)}
                      className="accent-[var(--color-accent)]"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
            {state.error ? <FieldError>{state.error}</FieldError> : null}
            <div className="flex justify-end">
              <Button type="submit" isLoading={isPending}>
                Save branding
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Live preview</CardTitle>
          </CardHeader>
          <CardContent>
            <WidgetLivePreview
              primaryColor={primaryColor}
              greetingPersona={greetingPersona}
              logoUrl={logoUrl}
              language={previewLanguage}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Embed on your storefront</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="position">Widget position</Label>
              <Select
                id="position"
                value={position}
                onChange={(event) => setPosition(event.target.value as "bottom-right" | "bottom-left")}
                className="max-w-[200px]"
              >
                <option value="bottom-right">Bottom right</option>
                <option value="bottom-left">Bottom left</option>
              </Select>
            </div>
            <WidgetEmbedSnippet tenantSlug={tenant.slug} language={previewLanguage} position={position} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
