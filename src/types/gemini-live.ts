import type { GeminiTool } from '@/lib/voice/biTools';

// ── Session state ──────────────────────────────────────────────────────────────

export type GeminiLiveState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'processing'  // tool call in flight
  | 'reconnecting'
  | 'error';

// ── Error ──────────────────────────────────────────────────────────────────────

export interface GeminiLiveError {
  code: string;
  message: string;
  recoverable: boolean;
}

// ── Transcript ─────────────────────────────────────────────────────────────────

export interface GeminiTranscript {
  partial: string;
  final: string[];
}

// ── Token response from edge fn ────────────────────────────────────────────────

export interface GeminiTokenResponse {
  token: string;
  model_id: string;
  expires_at?: string;
}

// ── Hook options ───────────────────────────────────────────────────────────────

export interface GeminiLiveOpts {
  systemInstruction: string;
  tools: GeminiTool[];
}

// ── WebSocket wire types ───────────────────────────────────────────────────────

export interface GeminiSetupMessage {
  setup: {
    model: string;
    systemInstruction: { parts: Array<{ text: string }> };
    tools: GeminiTool[];
    generationConfig: {
      responseModalities: string[];
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: string } };
      };
    };
    inputAudioTranscription?: Record<string, never>;
    outputAudioTranscription?: Record<string, never>;
    contextWindowCompression?: {
      triggerTokens: number;
      slidingWindow: { targetTokens: number };
    };
    sessionResumption?: { handle: string };
  };
}

export interface GeminiRealtimeInputMessage {
  realtimeInput: {
    audio?: { data: string; mimeType: string };
    activityStart?: Record<string, never>;
    activityEnd?: Record<string, never>;
  };
}

export interface GeminiServerContent {
  serverContent: {
    sessionResumptionUpdate?: { newHandle?: string };
    goAway?: { timeLeft: string };
    modelTurn?: {
      parts?: Array<{
        inlineData?: { data: string; mimeType: string };
        text?: string;
      }>;
    };
    outputTranscription?: { text?: string; isFinal?: boolean };
    inputTranscription?: { text?: string; isFinal?: boolean };
    turnComplete?: boolean;
  };
}

export interface GeminiToolCall {
  toolCall: {
    functionCalls: Array<{
      id: string;
      name: string;
      args: Record<string, unknown>;
    }>;
  };
}
