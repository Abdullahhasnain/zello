import { notFound } from "next/navigation";
import type { TenantPublic } from "@zello-ai/types";
import { StorefrontHeader } from "@/components/storefront/storefront-header";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

/** Public, unauthenticated read — the storefront layout can't use the
 * dashboard's apiFetch (that attaches a Clerk session; shoppers have none). */
async function getStoreInfo(slug: string): Promise<TenantPublic | null> {
  const res = await fetch(`${API_BASE_URL}/tenants/storefront/${slug}`, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as TenantPublic;
}

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await getStoreInfo(slug);
  if (!store) notFound();

  return (
    <div className="min-h-dvh bg-bg">
      <StorefrontHeader slug={slug} storeName={store.name} primaryColor={store.branding.primaryColor} />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      <footer className="border-t border-border py-6">
        <p className="text-center text-xs text-ink-faint">
          Powered by <span className="font-semibold text-accent">Zello AI</span>
        </p>
      </footer>
      {/* The AI shopping assistant — same script a real tenant would embed
          on their own site (see apps/widget/src/config.ts), just served
          from our own /public here since this storefront IS the demo site.
          The .voice.js bundle is the Phase 2+ build (text chat + mic/TTS);
          a Phase 1 tenant's real embed snippet would point at .text.js
          instead — see Widget Studio for that gating. */}
      {/* No data-language: the widget then greets in the visitor's own
          browser language, and switches per turn to whatever they actually
          speak (see apps/widget/src/config.ts). Pin data-language only if a
          store wants every visitor greeted in one fixed language. */}
      <script
        src="/zello-widget.voice.js"
        data-tenant-slug={slug}
        data-api-base-url={API_BASE_URL}
        data-position="bottom-right"
        async
      />
    </div>
  );
}
