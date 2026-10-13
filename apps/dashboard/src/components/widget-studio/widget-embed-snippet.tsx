"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.zello.ai/api/v1";
const APP_BASE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const WIDGET_BUNDLE_URL = `${APP_BASE_URL}/zello-widget.voice.js`;

export function WidgetEmbedSnippet({
  tenantSlug,
  language,
  position,
}: {
  tenantSlug: string;
  language: "roman_urdu" | "urdu" | "english";
  position: "bottom-right" | "bottom-left";
}) {
  const [copied, setCopied] = useState(false);

  const snippet = `<script
  src="${WIDGET_BUNDLE_URL}"
  data-tenant-slug="${tenantSlug}"
  data-api-base-url="${API_BASE_URL}"
  data-language="${language}"
  data-position="${position}"
  data-voice-mode="browser"
  data-auto-open="true"
  async
></script>`;

  async function handleCopy() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      <pre className="overflow-x-auto rounded-lg border border-border bg-bg p-4 text-xs text-ink-soft">
        <code>{snippet}</code>
      </pre>
      <Button type="button" variant="secondary" size="sm" onClick={handleCopy}>
        {copied ? "Copied!" : "Copy embed code"}
      </Button>
      <p className="text-xs text-ink-faint">
        Paste this before the closing <code>&lt;/body&gt;</code> tag on your storefront. The widget opens
        ready for a voice-first conversation; browsers may ask the shopper for microphone permission.
      </p>
    </div>
  );
}
