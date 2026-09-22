/**
 * BCP-47 locale tags for the Web Speech API, keyed by the app's own
 * language codes (see services/api/app/modules/search/normalization.py's
 * `Language` type on the backend, which these three values mirror).
 *
 * Roman Urdu has no speech locale of its own — there's no separate
 * "spoken Roman Urdu" the way there's a separate *written* Latin-script
 * convention for it. A customer speaking Roman-Urdu-flavored words out
 * loud is, acoustically, speaking Urdu; recognizing and synthesizing that
 * as real Urdu ("ur-PK") is the linguistically correct behavior even
 * though the text-chat side of the widget would render their words back
 * in Latin script. Script only exists for text, not for audio.
 */
export type AppLanguage = "english" | "roman_urdu" | "urdu";

const RECOGNITION_LOCALES: Record<AppLanguage, string> = {
  english: "en-US",
  roman_urdu: "ur-PK",
  urdu: "ur-PK",
};

const SYNTHESIS_LOCALES: Record<AppLanguage, string> = {
  english: "en-US",
  roman_urdu: "ur-PK",
  urdu: "ur-PK",
};

function normalize(language: string): AppLanguage {
  return language === "english" || language === "urdu" || language === "roman_urdu"
    ? language
    : "english";
}

export function recognitionLocaleFor(language: string): string {
  return RECOGNITION_LOCALES[normalize(language)];
}

export function synthesisLocaleFor(language: string): string {
  return SYNTHESIS_LOCALES[normalize(language)];
}
