import type { VoiceErrorCode } from "./types";

export interface ServerRecorderCallbacks {
  onAudio: (audio: Blob) => void;
  onError: (code: VoiceErrorCode, message: string) => void;
}

const MAX_RECORDING_MS = 20_000;
const SILENCE_AFTER_SPEECH_MS = 1_100;
const SPEECH_THRESHOLD = 0.025;

function preferredMimeType(): string {
  for (const type of [
    "audio/webm;codecs=opus",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

export class ServerVoiceRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private animationFrame: number | null = null;
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private aborted = false;

  static isSupported(): boolean {
    return (
      typeof MediaRecorder !== "undefined" &&
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia
    );
  }

  async start(callbacks: ServerRecorderCallbacks): Promise<void> {
    if (this.recorder || !ServerVoiceRecorder.isSupported()) {
      callbacks.onError(
        "not-supported",
        "Audio recording isn't supported in this browser.",
      );
      return;
    }

    try {
      this.aborted = false;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      this.stream = stream;
      const mimeType = preferredMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      const chunks: BlobPart[] = [];
      this.recorder = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => {
        this.cleanup();
        callbacks.onError(
          "unknown",
          "The microphone recording failed. Please try again.",
        );
      };
      recorder.onstop = () => {
        const wasAborted = this.aborted;
        const actualType = recorder.mimeType || mimeType || "audio/webm";
        this.cleanup();
        if (wasAborted) return;
        const audio = new Blob(chunks, { type: actualType });
        if (audio.size < 200) {
          callbacks.onError(
            "no-speech",
            "I couldn't hear anything. Please try again.",
          );
          return;
        }
        callbacks.onAudio(audio);
      };

      recorder.start(250);
      this.startVoiceActivityDetection(stream);
      this.timeout = setTimeout(() => this.stop(), MAX_RECORDING_MS);
    } catch (error) {
      this.cleanup();
      const denied =
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "SecurityError");
      callbacks.onError(
        denied ? "permission-denied" : "unknown",
        denied
          ? "Microphone access was denied."
          : "Could not start the microphone.",
      );
    }
  }

  stop(): void {
    if (this.recorder?.state === "recording") this.recorder.stop();
  }

  abort(): void {
    this.aborted = true;
    if (this.recorder?.state === "recording") {
      this.recorder.stop();
    } else {
      this.cleanup();
    }
  }

  isActive(): boolean {
    return this.recorder?.state === "recording";
  }

  private startVoiceActivityDetection(stream: MediaStream): void {
    const AudioContextCtor = window.AudioContext;
    if (!AudioContextCtor) return;

    const context = new AudioContextCtor();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    let speechStarted = false;
    let lastSpeechAt = performance.now();

    const detect = () => {
      if (!this.isActive()) return;
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) {
        const centered = (sample - 128) / 128;
        sum += centered * centered;
      }
      const rms = Math.sqrt(sum / samples.length);
      const now = performance.now();
      if (rms >= SPEECH_THRESHOLD) {
        speechStarted = true;
        lastSpeechAt = now;
      } else if (
        speechStarted &&
        now - lastSpeechAt >= SILENCE_AFTER_SPEECH_MS
      ) {
        this.stop();
        return;
      }
      this.animationFrame = requestAnimationFrame(detect);
    };

    this.audioContext = context;
    this.animationFrame = requestAnimationFrame(detect);
  }

  private cleanup(): void {
    if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);
    if (this.timeout !== null) clearTimeout(this.timeout);
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.audioContext?.close();
    this.animationFrame = null;
    this.timeout = null;
    this.stream = null;
    this.audioContext = null;
    this.recorder = null;
  }
}
