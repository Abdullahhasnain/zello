import type { WidgetConfig } from "../config";
import { ApiError } from "../transport/api-client";
import {
  recognitionLocaleFor,
  synthesisLocaleFor,
} from "../voice/language-map";
import { ServerVoiceRecorder } from "../voice/server-recorder";
import { ServerVoiceSpeaker } from "../voice/server-speaker";
import {
  isSpeechRecognitionSupported,
  VoiceRecognizer,
} from "../voice/speech-recognition";
import {
  isSpeechSynthesisSupported,
  VoiceSpeaker,
} from "../voice/speech-synthesis";
import type { VoiceState } from "../voice/types";
import {
  getVoicePreferences,
  hasShownProactivePrompt,
  markProactivePromptShown,
  setVoicePreferences,
  type VoicePreferences,
} from "../voice/voice-preferences";
import { ZelloWidgetElement } from "./widget-element";
import { buildVoiceStyles } from "./voice-styles";

const MIC_ICON = `
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M19 11a7 7 0 01-14 0M12 19v3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`;

const MIC_OFF_ICON = `
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 15a3 3 0 003-3V6a3 3 0 00-5.94-.7M9 9.35V12a3 3 0 004.6 2.54" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M19 11a7 7 0 01-1.13 3.82M6.16 6.16A7 7 0 0019 11M12 19v3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M3 3l18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>
`;

const STOP_ICON = `
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>
  </svg>
`;

const PAUSE_ICON = `
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/>
    <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>
  </svg>
`;

const PLAY_ICON = `
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 5v14l11-7z" fill="currentColor"/>
  </svg>
`;

const SPEAKER_ICON = `
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11 5L6 9H3v6h3l5 4V5z" fill="currentColor"/>
    <path d="M15.5 8.5a5 5 0 010 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>
`;

const SPEAKER_MUTED_ICON = `
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11 5L6 9H3v6h3l5 4V5z" fill="currentColor"/>
    <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>
`;

// Bounds how long the voice UI waits for the AI's reply before giving up
// and telling the customer to retry — the underlying request (same
// api-client.ts call the text flow uses) may still resolve after this and
// quietly update the transcript; this only bounds how long the *voice* UI
// stays in "Thinking…".
const AI_RESPONSE_TIMEOUT_MS = 45000;

// How long the store's website has been open before the assistant
// proactively surfaces itself — long enough not to feel like a pop-up ad
// firing instantly, short enough that a shopper who's clearly browsing
// still sees it while the page is fresh in mind.
const PROACTIVE_GREETING_DELAY_MS = 4000;

/**
 * Phase 2+ widget: everything ZelloWidgetElement does (text chat, session
 * bootstrap, tenant isolation, product-card results), plus:
 *  - voice input/output (mic, TTS) layered on via composition with
 *    VoiceRecognizer/VoiceSpeaker (Module 6),
 *  - a proactive greeting prompt that appears on its own after a short
 *    delay and lets the shopper start talking in one tap — no manual
 *    "open chat" or "select voice mode" step first (Module 7),
 *  - persistent mute / voice-on-off controls the shopper fully controls.
 *
 * Deliberately a SUBCLASS rather than a fork — the entire text-conversation
 * code path (bootstrap, handleSend, product-card rendering) is inherited
 * unchanged, so a voice-initiated turn goes through the exact same AI
 * Customer Assistant, product search, and conversation history as a typed
 * one.
 */
export class ZelloVoiceWidgetElement extends ZelloWidgetElement {
  private readonly recognizer = new VoiceRecognizer();
  private readonly speaker = new VoiceSpeaker();
  private readonly serverRecorder = new ServerVoiceRecorder();
  private readonly serverSpeaker = new ServerVoiceSpeaker();
  private readonly voiceSupported: boolean;
  private serverTranscriptionUnavailable = false;
  private serverSpeechUnavailable = false;
  private activeSpeaker: "server" | "browser" | null = null;
  private speechRequestId = 0;
  private readonly tenantSlug: string;
  private readonly position: WidgetConfig["position"];

  private voicePrefs: VoicePreferences;
  private voiceState: VoiceState = "idle";
  private lastReplyLanguage: string;
  // The actual greeting text (branding-aware, from the backend) so the
  // proactive prompt can SPEAK the same words it shows. Set in
  // onBootstrapped once the conversation greeting exists.
  private greetingText = "";
  // Guards the greeting so it's spoken at most once, whether it fires
  // automatically (autoplay-allowed) or on the customer's first tap.
  private greetingStarted = false;

  private voiceStyleEl!: HTMLStyleElement;
  private voiceStatusEl!: HTMLDivElement;
  private micButton!: HTMLButtonElement;
  private pauseButton!: HTMLButtonElement;
  private muteButton!: HTMLButtonElement;
  private voiceToggleButton!: HTMLButtonElement;

  private proactiveBubble: HTMLDivElement | null = null;
  private proactiveTimer: ReturnType<typeof setTimeout> | null = null;

  // Browsers block audio until the page has had a real user gesture (a
  // mouse move doesn't count — only click/scroll/keypress/touch). Rather
  // than only greeting the lucky shoppers whose gesture happened to land
  // before our timer, we arm a one-time listener for the FIRST such gesture
  // anywhere on the page and greet by voice the instant it arrives — which
  // is almost always within a second or two of opening the store, so it
  // feels like the assistant welcoming you as you walk in.
  private audioUnlocked = false;
  private readonly unlockAudio = (): void => {
    this.audioUnlocked = true;
    this.tryAutoGreet();
  };

  constructor(config: WidgetConfig) {
    super(config);
    this.tenantSlug = config.tenantSlug;
    this.position = config.position;
    this.lastReplyLanguage = config.language;
    this.voiceSupported =
      ServerVoiceRecorder.isSupported() ||
      (isSpeechRecognitionSupported() && isSpeechSynthesisSupported());
    this.voicePrefs = getVoicePreferences(this.tenantSlug);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.addVoiceStyles();
    this.addVoiceControls();
    this.addHeaderControls();
    this.launcherButton.addEventListener("click", () =>
      this.handleLauncherToggled(),
    );

    // Listen on the whole page (not just the widget) for the first real
    // gesture — a shopper clicking a product, scrolling, or tapping anywhere
    // unlocks audio, at which point the greeting can speak. `once` means each
    // fires at most one time; whichever comes first wins.
    if (this.voiceSupported) {
      const opts = { once: true, capture: true, passive: true } as const;
      window.addEventListener("pointerdown", this.unlockAudio, opts);
      window.addEventListener("keydown", this.unlockAudio, opts);
      window.addEventListener("touchstart", this.unlockAudio, opts);
      window.addEventListener("scroll", this.unlockAudio, opts);
    }
  }

  disconnectedCallback(): void {
    // The widget is only ever removed if the partner page navigates away
    // or the script re-mounts — either way, an in-flight recognition
    // session, utterance, or pending proactive-prompt timer must not keep
    // running against a detached node.
    this.recognizer.abort();
    this.serverRecorder.abort();
    this.stopSpeech();
    if (this.proactiveTimer !== null) {
      clearTimeout(this.proactiveTimer);
    }
    window.removeEventListener("pointerdown", this.unlockAudio, true);
    window.removeEventListener("keydown", this.unlockAudio, true);
    window.removeEventListener("touchstart", this.unlockAudio, true);
    window.removeEventListener("scroll", this.unlockAudio, true);
  }

  /** Overrides the text-only base's no-op — fires once real conversation
   * content (the actual, branding-aware greeting) exists, so the proactive
   * prompt can show the SAME greeting text the chat panel itself would,
   * rather than a second hard-coded copy that could drift out of sync. */
  protected onBootstrapped(): void {
    if (
      !this.voicePrefs.voiceEnabled ||
      hasShownProactivePrompt(this.tenantSlug)
    ) {
      return;
    }

    const greetingBubble = this.messages.find(
      (message) => message.role === "assistant",
    );
    this.greetingText =
      greetingBubble?.content ?? "Hello! How can I help you today?";

    this.proactiveTimer = setTimeout(() => {
      if (!this.isOpen) {
        this.showProactivePrompt(this.greetingText);
      }
    }, PROACTIVE_GREETING_DELAY_MS);

    // The shopper may have already clicked/scrolled (unlocking audio) before
    // bootstrap finished — in that case greet right away rather than waiting
    // out the full delay.
    this.tryAutoGreet();
  }

  /** Greets by voice as soon as BOTH the greeting text is ready AND audio is
   * unlocked (a real gesture has happened). Safe to call repeatedly — the
   * greetingStarted guard makes it fire at most once. Shows the visual
   * bubble too, so the greeting is never audio-only. Never fires once the
   * shopper has opened the panel themselves (they're already engaged). */
  private tryAutoGreet(): void {
    // onBootstrapped already returned early if this session was greeted, so
    // reaching here with greetingText set means we haven't greeted yet.
    // greetingStarted guards against speaking twice; the rest are the same
    // "is voice wanted right now" conditions used everywhere else.
    if (
      this.greetingStarted ||
      !this.audioUnlocked ||
      !this.greetingText ||
      this.isOpen ||
      !this.voicePrefs.voiceEnabled ||
      this.voicePrefs.muted
    ) {
      return;
    }
    this.showProactivePrompt(this.greetingText);
    this.startVoiceGreeting(false);
  }

  /** Whether the browser will let us play the greeting audio without a
   * fresh click. Browsers block autoplay until the page has been interacted
   * with at least once (`userActivation.hasBeenActive`); by the time the
   * 4-second delay passes, a shopper who's been browsing normally usually
   * has, so the greeting can speak on its own — true voice-first. A shopper
   * who's touched nothing yet gets the visible bubble and one-tap-to-hear
   * instead, which is both the compliant and the non-intrusive behaviour. */
  private canAutoplayAudio(): boolean {
    const activation = (
      navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }
    ).userActivation;
    return activation?.hasBeenActive === true;
  }

  /** Speaks the greeting (once), then — only when the customer engaged
   * explicitly by tapping — opens the panel and starts listening for their
   * reply, like a salesperson greeting you and then waiting to hear what you
   * need. On automatic (autoplay) greeting we only speak; we don't force the
   * mic open or cover the page, keeping it non-intrusive. */
  private startVoiceGreeting(opened: boolean): void {
    if (this.greetingStarted) {
      return;
    }
    this.greetingStarted = true;

    const canSpeak =
      this.voiceSupported &&
      this.voicePrefs.voiceEnabled &&
      !this.voicePrefs.muted &&
      !!this.greetingText;

    if (!canSpeak) {
      // Voice off / muted / unsupported — the greeting text is already
      // visible; just engage the mic if they explicitly opened the panel.
      if (opened) {
        this.maybeAutoListen();
      }
      return;
    }

    this.setVoiceState("speaking");
    void this.speakText(this.greetingText, this.lastReplyLanguage, {
      onEnd: () => {
        if (this.voiceState === "speaking") {
          this.setVoiceState("idle");
        }
        if (opened) {
          this.maybeAutoListen();
        }
      },
      onError: () => {
        // Autoplay was blocked after all, or synthesis failed — no problem,
        // the greeting is still on screen; just listen if they're engaged.
        if (this.voiceState === "speaking") {
          this.setVoiceState("idle");
        }
        if (opened) {
          this.maybeAutoListen();
        }
      },
    });
  }

  // --- DOM: voice-only additions layered onto the inherited panel ---

  private addVoiceStyles(): void {
    this.voiceStyleEl = document.createElement("style");
    this.voiceStyleEl.textContent = buildVoiceStyles();
    this.shadow.appendChild(this.voiceStyleEl);
  }

  private addVoiceControls(): void {
    const inputRow = this.shadow.querySelector(".zello-input-row");
    if (!inputRow) {
      return; // defensive — the base class always creates this, but never crash the widget if it didn't
    }

    this.voiceStatusEl = document.createElement("div");
    this.voiceStatusEl.className = "zello-voice-status";
    this.voiceStatusEl.setAttribute("role", "status");
    this.voiceStatusEl.setAttribute("aria-live", "polite");
    const disclosure = document.createElement("div");
    disclosure.className = "zello-voice-disclosure";
    disclosure.textContent = "Voice replies are AI-generated.";
    this.panel.insertBefore(disclosure, inputRow);
    this.panel.insertBefore(this.voiceStatusEl, inputRow);

    this.pauseButton = document.createElement("button");
    this.pauseButton.type = "button";
    this.pauseButton.className = "zello-pause-button zello-hidden";
    this.pauseButton.innerHTML = PAUSE_ICON;
    this.pauseButton.setAttribute("aria-label", "Pause speaking");
    this.pauseButton.addEventListener("click", () => this.handlePauseClick());

    this.micButton = document.createElement("button");
    this.micButton.type = "button";
    this.micButton.className = "zello-mic-button";
    this.micButton.innerHTML = MIC_ICON;

    if (!this.voiceSupported) {
      this.micButton.disabled = true;
      this.micButton.title = "Voice isn't supported in this browser";
      this.micButton.setAttribute(
        "aria-label",
        "Voice input unavailable in this browser",
      );
    } else {
      this.micButton.setAttribute("aria-label", "Start voice input");
      this.micButton.addEventListener("click", () => this.handleMicClick());
    }

    inputRow.insertBefore(this.pauseButton, this.sendButton);
    inputRow.insertBefore(this.micButton, this.sendButton);
    this.updateMicButtonVisibility();
  }

  private addHeaderControls(): void {
    this.muteButton = document.createElement("button");
    this.muteButton.type = "button";
    this.muteButton.className = "zello-header-icon-button";
    this.muteButton.addEventListener("click", () => this.toggleMute());
    this.updateMuteButton();

    this.voiceToggleButton = document.createElement("button");
    this.voiceToggleButton.type = "button";
    this.voiceToggleButton.className = "zello-header-icon-button";
    this.voiceToggleButton.addEventListener("click", () =>
      this.toggleVoiceEnabled(),
    );
    this.updateVoiceToggleButton();

    // Both go just before the header's existing close button (see
    // ui/widget-element.ts's buildHeader()) so close stays the rightmost,
    // most-expected-position control.
    const closeButton = this.headerEl.querySelector(".zello-close-button");
    this.headerEl.insertBefore(this.voiceToggleButton, closeButton);
    this.headerEl.insertBefore(this.muteButton, closeButton);
  }

  // --- Launcher: opening the panel this way also engages voice directly —
  // no separate "open chat" then "select voice mode" steps. ---

  private handleLauncherToggled(): void {
    this.dismissProactivePrompt();
    if (!this.isOpen) {
      // Panel just closed (the base class's own listener, registered
      // before this one, already flipped `isOpen` for this same click) —
      // stop any in-flight voice activity rather than leaving it running
      // against a hidden panel.
      this.recognizer.abort();
      this.serverRecorder.abort();
      this.stopSpeech();
      if (this.voiceState !== "idle") {
        this.setVoiceState("idle");
      }
      return;
    }
    // Opening via the launcher on the first interaction should still greet
    // by voice (then listen), so the experience is the same however they
    // engaged; after that it just goes straight to listening.
    if (!this.greetingStarted) {
      this.startVoiceGreeting(true);
    } else {
      this.maybeAutoListen();
    }
  }

  private maybeAutoListen(): void {
    if (
      this.voiceSupported &&
      this.voicePrefs.voiceEnabled &&
      this.voiceState === "idle"
    ) {
      this.startListening();
    }
  }

  // --- Proactive greeting prompt ---

  private showProactivePrompt(greetingText: string): void {
    // Idempotent — the 4s timer and an earlier first-gesture can both reach
    // here; only the first should build a bubble. Clear the timer so it
    // can't fire a second one after a gesture already showed it.
    if (this.proactiveBubble) {
      return;
    }
    if (this.proactiveTimer !== null) {
      clearTimeout(this.proactiveTimer);
      this.proactiveTimer = null;
    }

    const bubble = document.createElement("div");
    bubble.className = `zello-proactive-bubble zello-position-${this.position}`;
    bubble.setAttribute("role", "button");
    bubble.setAttribute("tabindex", "0");

    const dismissButton = document.createElement("button");
    dismissButton.type = "button";
    dismissButton.className = "zello-proactive-dismiss";
    dismissButton.setAttribute("aria-label", "Dismiss");
    dismissButton.textContent = "✕";
    dismissButton.addEventListener("click", (event) => {
      event.stopPropagation();
      this.dismissProactivePrompt();
    });

    const textEl = document.createElement("div");
    textEl.className = "zello-proactive-text";
    textEl.textContent = greetingText;

    const hintEl = document.createElement("div");
    hintEl.className = "zello-proactive-hint";
    hintEl.textContent = this.voiceSupported
      ? "🎤 Tap to talk"
      : "💬 Tap to chat";

    bubble.appendChild(dismissButton);
    bubble.appendChild(textEl);
    bubble.appendChild(hintEl);
    // Explicit engagement: open the panel, speak the greeting, then listen
    // for their reply.
    bubble.addEventListener("click", () => {
      this.dismissProactivePrompt();
      this.setOpen(true);
      this.startVoiceGreeting(true);
    });

    this.shadow.appendChild(bubble);
    this.proactiveBubble = bubble;
    this.launcherButton.classList.add("zello-launcher-attention");
    markProactivePromptShown(this.tenantSlug);

    // If audio is already unlocked (a first gesture landed, or the browser
    // reports prior activation), greet by voice automatically — the core
    // voice-first moment. Otherwise the bubble waits, and the armed
    // first-gesture listener will speak it the moment the shopper interacts.
    if (this.audioUnlocked || this.canAutoplayAudio()) {
      this.startVoiceGreeting(false);
    }
  }

  private dismissProactivePrompt(): void {
    if (this.proactiveTimer !== null) {
      clearTimeout(this.proactiveTimer);
      this.proactiveTimer = null;
    }
    this.proactiveBubble?.remove();
    this.proactiveBubble = null;
    this.launcherButton.classList.remove("zello-launcher-attention");
  }

  // --- Mic button: starts/stops listening, or stops playback ---

  private handleMicClick(): void {
    if (!this.voicePrefs.voiceEnabled) {
      return;
    }
    switch (this.voiceState) {
      case "listening":
        this.recognizer.stop();
        this.serverRecorder.stop();
        return;
      case "speaking":
        this.stopSpeech();
        this.setVoiceState("idle");
        this.startListening();
        return;
      case "processing":
        return; // one request in flight at a time — ignore taps until it resolves
      case "idle":
      case "error":
        this.startListening();
    }
  }

  private startListening(): void {
    this.setVoiceState("listening");
    if (
      ServerVoiceRecorder.isSupported() &&
      !this.serverTranscriptionUnavailable
    ) {
      void this.serverRecorder.start({
        onAudio: (audio) => {
          this.setVoiceState("processing");
          void this.transcribeAndSend(audio);
        },
        onError: (code, message) => {
          if (code === "no-speech" || code === "aborted") {
            this.setVoiceState("idle");
            return;
          }
          this.setVoiceState("error", this.describeVoiceError(code, message));
        },
      });
      return;
    }

    this.startBrowserListening();
  }

  private startBrowserListening(): void {
    if (!isSpeechRecognitionSupported()) {
      this.setVoiceState(
        "error",
        "Voice transcription is unavailable right now.",
      );
      return;
    }
    const locale = recognitionLocaleFor(this.lastReplyLanguage);

    this.recognizer.start(locale, {
      onResult: (transcript, isFinal) => {
        this.inputEl.value = transcript;
        if (isFinal && transcript) {
          this.setVoiceState("processing");
          void this.sendVoiceMessage(transcript);
        }
      },
      onError: (code, message) => {
        if (code === "no-speech" || code === "aborted") {
          // Silence timeout, or a stop() we ourselves triggered — both are
          // routine, not failures worth alarming the customer over.
          this.setVoiceState("idle");
          return;
        }
        this.setVoiceState("error", this.describeVoiceError(code, message));
      },
      onEnd: () => {
        if (this.voiceState === "listening") {
          this.setVoiceState("idle");
        }
      },
    });
  }

  private async transcribeAndSend(audio: Blob): Promise<void> {
    try {
      const transcript = (await this.apiClient.transcribeAudio(audio)).trim();
      if (!transcript) {
        this.setVoiceState(
          "error",
          "I couldn't hear that clearly. Please try again.",
        );
        return;
      }
      this.inputEl.value = transcript;
      await this.sendVoiceMessage(transcript);
    } catch (error) {
      if (error instanceof ApiError && error.status === 503) {
        this.serverTranscriptionUnavailable = true;
      }
      this.setVoiceState(
        "error",
        isSpeechRecognitionSupported()
          ? "Server transcription is unavailable. Tap the mic to retry with browser speech."
          : "Voice transcription is temporarily unavailable. Please type your message.",
      );
    }
  }

  // --- Sending what was heard — through the SAME handleSend() the text
  // input uses, so voice turns hit the identical AI Customer Assistant
  // endpoint, the same conversation history, product search, and
  // tenant-scoped session as typed messages. ---

  private async sendVoiceMessage(transcript: string): Promise<void> {
    this.inputEl.value = transcript;

    const TIMED_OUT = Symbol("timed-out");
    const outcome = await Promise.race([
      this.handleSend().then(() => "sent" as const),
      new Promise<typeof TIMED_OUT>((resolve) => {
        setTimeout(() => resolve(TIMED_OUT), AI_RESPONSE_TIMEOUT_MS);
      }),
    ]);

    if (outcome === TIMED_OUT) {
      this.setVoiceState(
        "error",
        "That's taking longer than expected. Please try again in a moment.",
      );
      return;
    }

    if (this.lastAssistantIntent === null) {
      // handleSend() swallows its own errors (network/API failure, or a
      // guard like a not-yet-ready conversationId) and already rendered a
      // text bubble for it — lastAssistantIntent staying null is how the
      // voice layer learns that happened without duplicating that logic.
      this.setVoiceState(
        "error",
        "That message couldn't be sent. Please check your connection and try again.",
      );
      return;
    }

    const detectedLanguage =
      typeof this.lastAssistantIntent.detected_language === "string"
        ? this.lastAssistantIntent.detected_language
        : this.lastReplyLanguage;
    this.lastReplyLanguage = detectedLanguage;

    const lastMessage = this.messages[this.messages.length - 1];
    this.speakReply(lastMessage?.content ?? "");
  }

  // --- Speaking the reply ---

  private speakReply(text: string): void {
    if (this.voicePrefs.muted || !this.voicePrefs.voiceEnabled) {
      // The text reply and any product cards are already visible (rendered
      // by the inherited handleSend()) — muted only skips the audio.
      this.setVoiceState("idle");
      this.maybeAutoListen();
      return;
    }

    this.setVoiceState("speaking");
    void this.speakText(text, this.lastReplyLanguage, {
      onEnd: () => {
        if (this.voiceState === "speaking") {
          this.setVoiceState("idle");
          this.maybeAutoListen();
        }
      },
      onError: (code, message) =>
        this.setVoiceState("error", this.describeVoiceError(code, message)),
    });
  }

  private async speakText(
    text: string,
    language: string,
    callbacks: {
      onEnd: () => void;
      onError: (
        code: "not-supported" | "synthesis-failed",
        message: string,
      ) => void;
    },
  ): Promise<void> {
    const requestId = ++this.speechRequestId;
    const finish = () => {
      if (requestId !== this.speechRequestId) return;
      this.activeSpeaker = null;
      callbacks.onEnd();
    };
    const fail = (
      code: "not-supported" | "synthesis-failed",
      message: string,
    ) => {
      if (requestId !== this.speechRequestId) return;
      this.activeSpeaker = null;
      callbacks.onError(code, message);
    };

    if (!this.serverSpeechUnavailable) {
      try {
        const audio = await this.apiClient.synthesizeSpeech(text, language);
        if (requestId !== this.speechRequestId) return;
        this.activeSpeaker = "server";
        await this.serverSpeaker.play(audio, { onEnd: finish, onError: fail });
        return;
      } catch (error) {
        if (error instanceof ApiError && error.status === 503) {
          this.serverSpeechUnavailable = true;
        }
      }
    }

    if (!isSpeechSynthesisSupported()) {
      fail("not-supported", "Voice playback isn't supported in this browser.");
      return;
    }
    if (requestId !== this.speechRequestId) return;
    this.activeSpeaker = "browser";
    const locale = synthesisLocaleFor(language);
    await this.speaker.speak(text, locale, { onEnd: finish, onError: fail });
  }

  private handlePauseClick(): void {
    const active =
      this.activeSpeaker === "server" ? this.serverSpeaker : this.speaker;
    if (active.isPaused()) {
      active.resume();
      this.pauseButton.innerHTML = PAUSE_ICON;
      this.pauseButton.setAttribute("aria-label", "Pause speaking");
    } else {
      active.pause();
      this.pauseButton.innerHTML = PLAY_ICON;
      this.pauseButton.setAttribute("aria-label", "Resume speaking");
    }
  }

  private stopSpeech(): void {
    this.speechRequestId += 1;
    this.activeSpeaker = null;
    this.speaker.stop();
    this.serverSpeaker.stop();
  }

  // --- Mute / voice on-off — persistent, customer-controlled ---

  private toggleMute(): void {
    this.voicePrefs = { ...this.voicePrefs, muted: !this.voicePrefs.muted };
    setVoicePreferences(this.tenantSlug, this.voicePrefs);
    if (this.voicePrefs.muted && this.voiceState === "speaking") {
      this.stopSpeech();
      this.setVoiceState("idle");
    }
    this.updateMuteButton();
  }

  private updateMuteButton(): void {
    this.muteButton.innerHTML = this.voicePrefs.muted
      ? SPEAKER_MUTED_ICON
      : SPEAKER_ICON;
    const label = this.voicePrefs.muted
      ? "Unmute voice replies"
      : "Mute voice replies";
    this.muteButton.setAttribute("aria-label", label);
    this.muteButton.title = label;
  }

  private toggleVoiceEnabled(): void {
    this.voicePrefs = {
      ...this.voicePrefs,
      voiceEnabled: !this.voicePrefs.voiceEnabled,
    };
    setVoicePreferences(this.tenantSlug, this.voicePrefs);
    if (!this.voicePrefs.voiceEnabled) {
      this.recognizer.abort();
      this.serverRecorder.abort();
      this.stopSpeech();
      this.setVoiceState("idle");
      this.dismissProactivePrompt();
    }
    this.updateVoiceToggleButton();
    this.updateMicButtonVisibility();
  }

  private updateVoiceToggleButton(): void {
    this.voiceToggleButton.innerHTML = this.voicePrefs.voiceEnabled
      ? MIC_ICON
      : MIC_OFF_ICON;
    const label = this.voicePrefs.voiceEnabled
      ? "Turn voice off"
      : "Turn voice on";
    this.voiceToggleButton.setAttribute("aria-label", label);
    this.voiceToggleButton.title = label;
  }

  private updateMicButtonVisibility(): void {
    const shouldShow = this.voiceSupported && this.voicePrefs.voiceEnabled;
    this.micButton.classList.toggle("zello-hidden", !shouldShow);
    if (!shouldShow) {
      this.pauseButton.classList.add("zello-hidden");
    }
  }

  // --- State + error presentation ---

  private describeVoiceError(code: string, message: string): string {
    switch (code) {
      case "permission-denied":
        return "Microphone access was denied. Please allow microphone access in your browser settings and try again.";
      case "network":
        return "A network problem interrupted voice recognition. Please try again.";
      case "not-supported":
        return "Voice isn't supported in this browser.";
      case "synthesis-failed":
        return "Couldn't play the voice reply. You can still read the response above.";
      case "transcription-failed":
        return "I couldn't understand that audio. Please try again.";
      default:
        return message || "Something went wrong with voice. Please try again.";
    }
  }

  private setVoiceState(state: VoiceState, errorMessage?: string): void {
    this.voiceState = state;

    this.micButton.classList.remove(
      "zello-mic-listening",
      "zello-mic-processing",
      "zello-mic-speaking",
      "zello-mic-error",
    );
    this.voiceStatusEl.classList.remove(
      "zello-voice-status-visible",
      "zello-voice-status-error",
    );
    this.voiceStatusEl.textContent = "";
    this.pauseButton.classList.add("zello-hidden");
    this.micButton.disabled =
      !this.voiceSupported || !this.voicePrefs.voiceEnabled;

    switch (state) {
      case "listening":
        this.micButton.classList.add("zello-mic-listening");
        this.micButton.innerHTML = STOP_ICON;
        this.micButton.setAttribute("aria-label", "Stop listening");
        this.voiceStatusEl.textContent = "Listening…";
        this.voiceStatusEl.classList.add("zello-voice-status-visible");
        break;

      case "processing":
        this.micButton.classList.add("zello-mic-processing");
        this.micButton.disabled = true;
        this.micButton.innerHTML = MIC_ICON;
        this.voiceStatusEl.textContent = "Thinking…";
        this.voiceStatusEl.classList.add("zello-voice-status-visible");
        break;

      case "speaking":
        this.micButton.classList.add("zello-mic-speaking");
        this.micButton.innerHTML = STOP_ICON;
        this.micButton.setAttribute("aria-label", "Stop speaking");
        if (this.voiceSupported && this.voicePrefs.voiceEnabled) {
          this.pauseButton.classList.remove("zello-hidden");
        }
        this.pauseButton.innerHTML = PAUSE_ICON;
        this.pauseButton.setAttribute("aria-label", "Pause speaking");
        this.voiceStatusEl.textContent = "Speaking…";
        this.voiceStatusEl.classList.add("zello-voice-status-visible");
        break;

      case "error":
        this.micButton.classList.add("zello-mic-error");
        this.micButton.innerHTML = MIC_ICON;
        this.micButton.setAttribute("aria-label", "Start voice input");
        this.voiceStatusEl.textContent =
          errorMessage ?? "Something went wrong.";
        this.voiceStatusEl.classList.add(
          "zello-voice-status-visible",
          "zello-voice-status-error",
        );
        break;

      case "idle":
      default:
        this.micButton.innerHTML = MIC_ICON;
        this.micButton.setAttribute("aria-label", "Start voice input");
        break;
    }
  }
}
