/**
 * Thin wrapper around the browser's SpeechRecognition (Web Speech API).
 * Chrome/Edge ship it as `webkitSpeechRecognition`; Firefox and Safari
 * don't implement it at all as of this writing — callers must check
 * `isSpeechRecognitionSupported()` first (see ui/voice-widget-element.ts,
 * which disables the mic button entirely when it's false rather than
 * letting a customer tap a button that can't work).
 *
 * SpeechRecognition is still non-standard (no official W3C type
 * definitions ship in TypeScript's lib.dom.d.ts, unlike SpeechSynthesis
 * below), so the shapes here are hand-written to match the real browser
 * API rather than relying on ambient globals that may not exist.
 */

interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternativeLike;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  readonly length: number;
  item(index: number): SpeechRecognitionResultLike;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  const globalWindow = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return globalWindow.SpeechRecognition ?? globalWindow.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null;
}

export interface SpeechRecognitionCallbacks {
  /** Fires repeatedly as the customer speaks (isFinal=false) and once more
   * with the settled transcript (isFinal=true) — the caller decides what
   * to do with interim text (e.g. live-preview it in the input box). */
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (
    code: "permission-denied" | "no-speech" | "network" | "aborted" | "not-supported" | "unknown",
    message: string,
  ) => void;
  onEnd: () => void;
}

// A hard cap on how long a single "listening" turn can run — some browsers
// occasionally never fire onend/onerror if the tab loses focus mid-capture,
// which would otherwise leave the UI stuck in "Listening…" forever.
const MAX_LISTEN_MS = 15000;

export class VoiceRecognizer {
  private recognition: SpeechRecognitionLike | null = null;
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private active = false;

  start(locale: string, callbacks: SpeechRecognitionCallbacks): void {
    if (this.active) {
      return; // ignore a duplicate start while already listening
    }

    const RecognitionCtor = getSpeechRecognitionConstructor();
    if (!RecognitionCtor) {
      callbacks.onError("not-supported", "Speech recognition isn't supported in this browser.");
      return;
    }

    const recognition = new RecognitionCtor();
    recognition.lang = locale;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalTranscript = "";

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const alternative = result?.[0];
        if (!result || !alternative) continue;

        if (result.isFinal) {
          finalTranscript += alternative.transcript;
          callbacks.onResult(finalTranscript.trim(), true);
        } else {
          callbacks.onResult((finalTranscript + alternative.transcript).trim(), false);
        }
      }
    };

    recognition.onerror = (event) => {
      const code =
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "permission-denied"
          : event.error === "no-speech"
            ? "no-speech"
            : event.error === "network"
              ? "network"
              : event.error === "aborted"
                ? "aborted"
                : "unknown";
      callbacks.onError(code, event.message || `Speech recognition error: ${event.error}`);
    };

    recognition.onend = () => {
      this.clearTimeout();
      this.active = false;
      this.recognition = null;
      callbacks.onEnd();
    };

    this.recognition = recognition;
    this.active = true;
    this.timeoutHandle = setTimeout(() => {
      // A graceful stop (not abort) so any final result the engine already
      // has gets flushed through onresult before onend fires.
      this.stop();
    }, MAX_LISTEN_MS);

    try {
      recognition.start();
    } catch {
      // Some browsers throw synchronously if start() is called while a
      // previous instance is still tearing down — surface it exactly like
      // any other failure to start rather than leaving state inconsistent.
      this.clearTimeout();
      this.active = false;
      this.recognition = null;
      callbacks.onError("unknown", "Could not start voice recognition. Please try again.");
    }
  }

  stop(): void {
    this.clearTimeout();
    this.recognition?.stop();
  }

  abort(): void {
    this.clearTimeout();
    this.recognition?.abort();
    this.active = false;
    this.recognition = null;
  }

  isActive(): boolean {
    return this.active;
  }

  private clearTimeout(): void {
    if (this.timeoutHandle !== null) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }
}
