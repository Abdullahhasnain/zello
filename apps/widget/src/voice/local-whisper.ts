/**
 * Quota-free speech-to-text for the demo/pilot widget.
 *
 * Transformers.js and the quantized Whisper model are downloaded lazily on
 * the shopper's first voice turn and then kept in the browser cache. Audio
 * never leaves the device on this path. If loading or inference fails, the
 * voice widget falls back to the existing authenticated Gemini endpoint.
 */

const TRANSFORMERS_MODULE_URL =
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/+esm";
const WHISPER_MODEL = "Xenova/whisper-tiny";
const SAMPLE_RATE = 16_000;

interface TranscriptionResult {
  text?: string;
}

type Transcriber = (
  audio: Float32Array,
  options: Record<string, unknown>,
) => Promise<TranscriptionResult | TranscriptionResult[]>;

interface TransformersModule {
  env: {
    allowLocalModels: boolean;
    useBrowserCache: boolean;
  };
  pipeline: (
    task: "automatic-speech-recognition",
    model: string,
    options: Record<string, unknown>,
  ) => Promise<Transcriber>;
}

interface NavigatorWithDeviceMemory extends Navigator {
  deviceMemory?: number;
}

async function decodeToMono16Khz(audio: Blob): Promise<Float32Array> {
  const AudioContextCtor = window.AudioContext;
  if (!AudioContextCtor || typeof OfflineAudioContext === "undefined") {
    throw new Error("Local audio decoding is unavailable.");
  }

  const context = new AudioContextCtor();
  try {
    const decoded = await context.decodeAudioData(await audio.arrayBuffer());
    const frameCount = Math.max(1, Math.ceil(decoded.duration * SAMPLE_RATE));
    const offline = new OfflineAudioContext(1, frameCount, SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start(0);
    const rendered = await offline.startRendering();
    return rendered.getChannelData(0).slice();
  } finally {
    await context.close();
  }
}

export class LocalWhisperTranscriber {
  private transcriberPromise: Promise<Transcriber> | null = null;

  static isSupported(): boolean {
    if (
      typeof window === "undefined" ||
      typeof WebAssembly === "undefined" ||
      !window.AudioContext ||
      typeof OfflineAudioContext === "undefined"
    ) {
      return false;
    }

    // Avoid forcing a large model onto genuinely constrained phones. Modern
    // laptops and capable phones use local Whisper; smaller devices retain
    // the lightweight server path.
    const memory = (navigator as NavigatorWithDeviceMemory).deviceMemory;
    const cores = navigator.hardwareConcurrency;
    return (memory === undefined || memory >= 4) && (cores === undefined || cores >= 4);
  }

  async prepare(): Promise<void> {
    await this.getTranscriber();
  }

  async transcribe(audio: Blob): Promise<string> {
    const [transcriber, samples] = await Promise.all([
      this.getTranscriber(),
      decodeToMono16Khz(audio),
    ]);
    const result = await transcriber(samples, {
      task: "transcribe",
      chunk_length_s: 20,
      stride_length_s: 3,
      return_timestamps: false,
    });
    const first = Array.isArray(result) ? result[0] : result;
    const text = first?.text?.trim() ?? "";
    if (!text) throw new Error("Local Whisper returned an empty transcript.");
    return text;
  }

  private getTranscriber(): Promise<Transcriber> {
    if (!this.transcriberPromise) {
      this.transcriberPromise = this.loadTranscriber().catch((error) => {
        this.transcriberPromise = null;
        throw error;
      });
    }
    return this.transcriberPromise;
  }

  private async loadTranscriber(): Promise<Transcriber> {
    const transformers = (await import(
      /* @vite-ignore */ TRANSFORMERS_MODULE_URL
    )) as unknown as TransformersModule;
    transformers.env.allowLocalModels = false;
    transformers.env.useBrowserCache = true;
    return transformers.pipeline(
      "automatic-speech-recognition",
      WHISPER_MODEL,
      {
        dtype: "q8",
        device: "wasm",
      },
    );
  }
}
