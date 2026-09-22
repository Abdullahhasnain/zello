"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.zello.ai/api/v1";

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
  src="https://cdn.zello.ai/widget/zello-widget.text.js"
  data-tenant-slug="${tenantSlug}"
  data-api-base-url="${API_BASE_URL}"
  data-language="${language}"
  data-position="${position}"
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
        Paste this before the closing <code>&lt;/body&gt;</code> tag on your storefront.
      </p>
    </div>
  );
}
