/**
 * Thin wrapper around the browser's SpeechSynthesis (Web Speech API) —
 * standard and widely supported (Chrome, Edge, Safari, Firefox all ship
 * it), unlike SpeechRecognition. Actual *voice* availability for a given
 * locale still varies by OS — selectVoice() falls back to the browser's
 * default voice when no exact-locale voice is installed, rather than
 * failing outright.
 */

export interface SynthesisCallbacks {
  onStart?: () => void;
  onEnd: () => void;
  onError: (code: "not-supported" | "synthesis-failed", message: string) => void;
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function selectVoice(locale: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  const exact = voices.find((voice) => voice.lang.toLowerCase() === locale.toLowerCase());
  if (exact) return exact;

  const languageOnly = locale.split("-")[0]?.toLowerCase();
  const partial = languageOnly ? voices.find((voice) => voice.lang.toLowerCase().startsWith(languageOnly)) : undefined;
  return partial ?? null;
}

/** Chrome (notably) loads its voice list asynchronously — `getVoices()` can
 * return an empty array on the very first call after page load. Waits
 * briefly for the `voiceschanged` event exactly once in that case, rather
 * than always speaking with the browser's unlabeled default voice. */
async function ensureVoicesLoaded(): Promise<void> {
  if (window.speechSynthesis.getVoices().length > 0) return;
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, 1000);
    window.speechSynthesis.addEventListener(
      "voiceschanged",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
}

export class VoiceSpeaker {
  async speak(text: string, locale: string, callbacks: SynthesisCallbacks): Promise<void> {
    if (!isSpeechSynthesisSupported()) {
      callbacks.onError("not-supported", "Voice playback isn't supported in this browser.");
      return;
    }
    if (!text.trim()) {
      callbacks.onEnd();
      return;
    }

    // Any previous utterance must fully stop before starting the next one —
    // overlapping speech is confusing, and some browsers silently drop a
    // second `speak()` call instead of queuing it audibly.
    window.speechSynthesis.cancel();
    await ensureVoicesLoaded();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale;
    const voice = selectVoice(locale);
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => callbacks.onStart?.();
    utterance.onend = () => callbacks.onEnd();
    utterance.onerror = (event) => {
      // "interrupted"/"canceled" fire whenever WE call stop()/cancel()
      // ourselves (customer taps stop, or a new reply arrives mid-speech)
      // — that's expected flow control, not a failure worth surfacing.
      if (event.error === "interrupted" || event.error === "canceled") {
        callbacks.onEnd();
        return;
      }
      callbacks.onError("synthesis-failed", `Speech synthesis error: ${event.error}`);
    };

    window.speechSynthesis.speak(utterance);
  }

  pause(): void {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
    }
  }

  resume(): void {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  }

  stop(): void {
    window.speechSynthesis.cancel();
  }

  isSpeaking(): boolean {
    return window.speechSynthesis.speaking;
  }

  isPaused(): boolean {
    return window.speechSynthesis.paused;
  }
}
