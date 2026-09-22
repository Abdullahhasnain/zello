/**
 * Persistent, per-tenant customer preferences for the proactive voice
 * experience — kept separate from core/storage.ts's StoredSession
 * (session/branding/conversation cache, shared with the text bundle) so
 * these voice-only concerns never touch a file entry.text.ts also depends
 * on. Namespaced by tenant slug the same way core/storage.ts is, for the
 * same reason: one browser can visit many tenants' sites.
 */

export interface VoicePreferences {
  /** Master switch for the whole proactive voice layer — mic button,
   * proactive greeting prompt, and auto-listen-on-open all respect this.
   * Turning it off reverts to plain text chat without hiding the option to
   * turn it back on. */
  voiceEnabled: boolean;
  /** Suppresses spoken TTS output only — the mic and text chat keep
   * working normally. Distinct from "pause" (which only affects the one
   * utterance currently playing): mute persists across turns until the
   * customer unmutes. */
  muted: boolean;
}

const DEFAULTS: VoicePreferences = { voiceEnabled: true, muted: false };

function prefsKey(tenantSlug: string): string {
  return `zello:${tenantSlug}:voice-prefs`;
}

function promptShownKey(tenantSlug: string): string {
  return `zello:${tenantSlug}:proactive-prompt-shown`;
}

export function getVoicePreferences(tenantSlug: string): VoicePreferences {
  const raw = window.localStorage.getItem(prefsKey(tenantSlug));
  if (!raw) return { ...DEFAULTS };
  try {
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<VoicePreferences>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setVoicePreferences(tenantSlug: string, prefs: VoicePreferences): void {
  window.localStorage.setItem(prefsKey(tenantSlug), JSON.stringify(prefs));
}

/** The proactive greeting shows once per BROWSING SESSION per tenant —
 * sessionStorage, not localStorage, so a customer who opens the store fresh
 * (a new tab/visit) is greeted again like a salesperson noticing a new
 * arrival, but they're not re-greeted on every in-site navigation within
 * the same session (which would be nagging). */
export function hasShownProactivePrompt(tenantSlug: string): boolean {
  return window.sessionStorage.getItem(promptShownKey(tenantSlug)) === "1";
}

export function markProactivePromptShown(tenantSlug: string): void {
  window.sessionStorage.setItem(promptShownKey(tenantSlug), "1");
}
