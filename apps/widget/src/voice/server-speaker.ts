import type { SynthesisCallbacks } from "./speech-synthesis";

export class ServerVoiceSpeaker {
  private audio: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;

  async play(blob: Blob, callbacks: SynthesisCallbacks): Promise<void> {
    this.stop();
    const objectUrl = URL.createObjectURL(blob);
    const audio = new Audio(objectUrl);
    this.objectUrl = objectUrl;
    this.audio = audio;
    audio.onplay = () => callbacks.onStart?.();
    audio.onended = () => {
      this.cleanup();
      callbacks.onEnd();
    };
    audio.onerror = () => {
      this.cleanup();
      callbacks.onError(
        "synthesis-failed",
        "The generated voice reply could not be played.",
      );
    };
    try {
      await audio.play();
    } catch {
      this.cleanup();
      callbacks.onError(
        "synthesis-failed",
        "The browser blocked voice playback.",
      );
    }
  }

  pause(): void {
    this.audio?.pause();
  }

  resume(): void {
    void this.audio?.play();
  }

  stop(): void {
    if (this.audio) {
      this.audio.onplay = null;
      this.audio.onended = null;
      this.audio.onerror = null;
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    this.cleanup();
  }

  isSpeaking(): boolean {
    return !!this.audio && !this.audio.paused && !this.audio.ended;
  }

  isPaused(): boolean {
    return (
      !!this.audio &&
      this.audio.paused &&
      this.audio.currentTime > 0 &&
      !this.audio.ended
    );
  }

  private cleanup(): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
    this.audio = null;
  }
}
