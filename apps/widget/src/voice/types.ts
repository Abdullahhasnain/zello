/**
 * Voice UI state machine — mirrors exactly the five states Module 6's spec
 * requires the widget to show: idle, listening, processing, speaking,
 * error. One source of truth so ui/voice-widget-element.ts never has to
 * juggle several booleans (isListening/isSpeaking/isProcessing) that could
 * disagree with each other.
 */
export type VoiceState =
  "idle" | "listening" | "processing" | "speaking" | "error";

export type VoiceErrorCode =
  | "permission-denied"
  | "no-speech"
  | "network"
  | "not-supported"
  | "synthesis-failed"
  | "transcription-failed"
  | "aborted"
  | "unknown";
