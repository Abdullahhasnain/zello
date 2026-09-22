/**
 * Widget configuration comes entirely from the embedding <script> tag's
 * data-attributes — this bundle is served once from a CDN and embedded on
 * many different partner sites, so there's no build-time env var that
 * could hold a single tenant's slug or branding override.
 *
 * Usage on the partner site:
 *   <script
 *     src="https://cdn.zello.ai/widget/zello-widget.text.js"
 *     data-tenant-slug="khaadi-pilot"
 *     data-api-base-url="https://api.zello.ai/api/v1"
 *     async
 *   ></script>
 */

export interface WidgetConfig {
  tenantSlug: string;
  apiBaseUrl: string;
  language: "roman_urdu" | "urdu" | "english";
  position: "bottom-right" | "bottom-left";
}

const DEFAULT_API_BASE_URL = "https://api.zello.ai/api/v1";

function currentScriptElement(): HTMLScriptElement | null {
  if (document.currentScript instanceof HTMLScriptElement) {
    return document.currentScript;
  }
  // Fallback for bundlers/loaders that don't preserve document.currentScript
  // (e.g. a script injected by a tag manager) — the widget script is
  // identifiable by its own data-tenant-slug attribute, so pick the last
  // matching <script> tag on the page instead of guessing.
  const candidates = Array.from(document.querySelectorAll<HTMLScriptElement>("script[data-tenant-slug]"));
  return candidates.length > 0 ? candidates[candidates.length - 1] : null;
}

/**
 * The language the assistant OPENS in — its greeting and first question.
 *
 * A tenant can pin one with `data-language` (a store that always wants to
 * greet in Roman Urdu, say). When they haven't, we follow the visitor's own
 * browser preference instead of assuming: an English-speaking shopper should
 * be greeted in English, an Urdu one in Urdu. This only sets the OPENING
 * language — from the first thing the customer says, the backend detects the
 * language of each turn and replies in kind (see
 * app/modules/search/normalization.py's detect_language), so a shopper whose
 * browser is English but who speaks Roman Urdu is answered in Roman Urdu.
 *
 * Hindi maps to Roman Urdu deliberately: the two are close enough spoken that
 * a Hindi-preferring visitor is far better served by Roman Urdu than by
 * English, and Hindi isn't one of the three languages the assistant writes.
 */
function resolveInitialLanguage(explicit: string | undefined): WidgetConfig["language"] {
  if (explicit === "urdu" || explicit === "english" || explicit === "roman_urdu") {
    return explicit;
  }

  const preferred = (navigator.languages?.[0] || navigator.language || "").toLowerCase();
  if (preferred.startsWith("ur")) return "urdu";
  if (preferred.startsWith("hi")) return "roman_urdu";
  return "english";
}

export function loadWidgetConfig(): WidgetConfig {
  const script = currentScriptElement();
  const tenantSlug = script?.dataset.tenantSlug;

  if (!tenantSlug) {
    throw new Error(
      "Zello widget: missing required data-tenant-slug attribute on the embed <script> tag.",
    );
  }

  const position = script?.dataset.position;

  return {
    tenantSlug,
    apiBaseUrl: script?.dataset.apiBaseUrl || DEFAULT_API_BASE_URL,
    language: resolveInitialLanguage(script?.dataset.language),
    position: position === "bottom-left" ? "bottom-left" : "bottom-right",
  };
}
