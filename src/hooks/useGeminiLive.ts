import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase, supabaseUrl } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';
import { executeBiTool } from '@/lib/voice/biTools';
import { createWorkletBlobUrl } from '@/utils/audio/audioWorkletProcessor';
import { arrayBufferToBase64, base64ToPcm16, pcm16ToFloat32 } from '@/utils/audio/pcm';
import type {
  GeminiLiveOpts,
  GeminiLiveState,
  GeminiLiveError,
  GeminiTranscript,
  GeminiTokenResponse,
  GeminiSetupMessage,
  GeminiRealtimeInputMessage,
  GeminiServerContent,
  GeminiToolCall,
} from '@/types/gemini-live';

const GEMINI_WS_BASE = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const EDGE_FN_URL = `${supabaseUrl}/functions/v1/gemini-live-token`;
// iOS Safari blocks direct wss://generativelanguage.googleapis.com — proxy via Supabase
const _SUPABASE_WS = supabaseUrl.replace(/^https?:\/\//, 'wss://');
const PROXY_WS_BASE = `${_SUPABASE_WS}/functions/v1/gemini-ws-proxy`;
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const AUDIO_INPUT_MIME = 'audio/pcm;rate=16000';
const AUDIO_OUTPUT_SAMPLE_RATE = 24000;
const RECONNECT_DELAY_MS = 500;
const GO_AWAY_BUFFER_MS = 15_000; // reconnect 15s before goAway

interface UseGeminiLiveReturn {
  state: GeminiLiveState;
  transcript: GeminiTranscript;
  isMuted: boolean;
  error: GeminiLiveError | null;
  start: () => Promise<void>;
  stop: () => void;
  mute: () => void;
  unmute: () => void;
}

export function useGeminiLive(opts: GeminiLiveOpts): UseGeminiLiveReturn {
  const [state, setState] = useState<GeminiLiveState>('idle');
  const [transcript, setTranscript] = useState<GeminiTranscript>({ partial: '', final: [] });
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<GeminiLiveError | null>(null);

  // All refs — avoid stale closures in audio/WS callbacks
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxInputRef = useRef<AudioContext | null>(null);
  const audioCtxOutputRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const workletBlobUrlRef = useRef<string | null>(null);
  const isMutedRef = useRef(false);
  const sessionHandleRef = useRef<string | null>(null);
  const goAwayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbackQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const stoppedRef = useRef(false);
  const reconnectCountRef = useRef(0);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // ── Helpers ──────────────────────────────────────────────────────────────

  const setErr = useCallback((code: string, message: string, recoverable: boolean) => {
    logger.error(`[GeminiLive] ${code}: ${message}`);
    setState('error');
    setError({ code, message, recoverable });
  }, []);

  const cleanup = useCallback(() => {
    stoppedRef.current = true;

    if (goAwayTimerRef.current) clearTimeout(goAwayTimerRef.current);

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (audioCtxInputRef.current) {
      void audioCtxInputRef.current.suspend();
      audioCtxInputRef.current = null;
    }
    if (audioCtxOutputRef.current) {
      void audioCtxOutputRef.current.suspend();
      audioCtxOutputRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    if (workletBlobUrlRef.current) {
      URL.revokeObjectURL(workletBlobUrlRef.current);
      workletBlobUrlRef.current = null;
    }

    playbackQueueRef.current = [];
    isPlayingRef.current = false;
  }, []);

  // ── Token fetch ───────────────────────────────────────────────────────────
  // Always calls gemini-live-token to validate key + enforce rate limiting.
  // Desktop: uses returned ephemeral Gemini token for direct WS.
  // iOS:     uses Supabase JWT for gemini-ws-proxy (Safari blocks direct wss://generativelanguage.googleapis.com).

  const fetchToken = useCallback(async (): Promise<GeminiTokenResponse> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('No auth session');

    const res = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string; message?: string };
      const errCode = body?.error === 'gemini_not_configured' ? 'GEMINI_NOT_CONFIGURED'
                    : res.status === 429 ? 'RATE_LIMITED'
                    : 'START_FAILED';
      throw Object.assign(
        new Error(body?.message ?? body?.error ?? `Token fetch failed: ${res.status}`),
        { code: errCode },
      );
    }

    const tokenData = await res.json() as GeminiTokenResponse;

    // iOS Safari: proxy authenticates via Supabase JWT, uses model_id from edge fn
    if (IS_IOS) {
      return { token: session.access_token, model_id: tokenData.model_id };
    }
    return tokenData;
  }, []);

  // ── Playback ──────────────────────────────────────────────────────────────

  const schedulePlayback = useCallback((audioBuffer: AudioBuffer) => {
    if (!audioCtxOutputRef.current || stoppedRef.current) return;
    playbackQueueRef.current.push(audioBuffer);

    if (isPlayingRef.current) return;

    const playNext = () => {
      const ctx = audioCtxOutputRef.current;
      if (!ctx || stoppedRef.current || playbackQueueRef.current.length === 0) {
        isPlayingRef.current = false;
        if (!stoppedRef.current) setState(prev => prev === 'speaking' ? 'listening' : prev);
        return;
      }
      isPlayingRef.current = true;
      const buf = playbackQueueRef.current.shift()!;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.onended = playNext;
      src.start();
    };

    playNext();
  }, []);

  const enqueuePcmChunk = useCallback((b64: string) => {
    const ctx = audioCtxOutputRef.current;
    if (!ctx || stoppedRef.current) return;

    const int16 = base64ToPcm16(b64);
    const float32 = pcm16ToFloat32(int16);
    const audioBuffer = ctx.createBuffer(1, float32.length, AUDIO_OUTPUT_SAMPLE_RATE);
    audioBuffer.copyToChannel(float32, 0);

    setState('speaking');
    schedulePlayback(audioBuffer);
  }, [schedulePlayback]);

  // ── WebSocket message handler ─────────────────────────────────────────────

  const handleServerMessage = useCallback((raw: string) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      logger.warn('[GeminiLive] unparseable message');
      return;
    }

    if ('setupComplete' in msg) {
      setState('listening');
      logger.info('[GeminiLive] setup complete');
      return;
    }

    if ('serverContent' in msg) {
      const sc = (msg as GeminiServerContent).serverContent;

      // Session resumption handle
      if (sc.sessionResumptionUpdate?.newHandle) {
        sessionHandleRef.current = sc.sessionResumptionUpdate.newHandle;
        logger.info('[GeminiLive] resumption handle updated');
      }

      // goAway — schedule reconnect before it fires
      if (sc.goAway?.timeLeft) {
        const msLeft = Math.max(0, parseDuration(sc.goAway.timeLeft) - GO_AWAY_BUFFER_MS);
        if (goAwayTimerRef.current) clearTimeout(goAwayTimerRef.current);
        goAwayTimerRef.current = setTimeout(() => void reconnect(), msLeft);
      }

      // Audio output
      sc.modelTurn?.parts?.forEach(part => {
        if (part.inlineData?.data && part.inlineData.mimeType.startsWith('audio/pcm')) {
          enqueuePcmChunk(part.inlineData.data);
        }
      });

      // Transcripts
      if (sc.outputTranscription?.text) {
        setTranscript(prev => ({
          ...prev,
          partial: sc.outputTranscription!.isFinal ? '' : (sc.outputTranscription!.text ?? ''),
          final: sc.outputTranscription!.isFinal
            ? [...prev.final, sc.outputTranscription!.text ?? '']
            : prev.final,
        }));
      }
      if (sc.inputTranscription?.text && sc.inputTranscription.isFinal) {
        setTranscript(prev => ({
          ...prev,
          final: [...prev.final, `[User]: ${sc.inputTranscription!.text ?? ''}`],
        }));
      }

      if (sc.turnComplete) {
        if (!isPlayingRef.current) setState('listening');
        else setState('speaking');
      }
      return;
    }

    if ('toolCall' in msg) {
      const tc = (msg as GeminiToolCall).toolCall;
      setState('processing');

      void (async () => {
        for (const call of tc.functionCalls) {
          const toolResp = await executeBiTool(call.name, call.args, supabase);
          const responseMsg = {
            toolResponse: {
              functionResponses: toolResp.functionResponses.map(r => ({
                id: call.id,
                ...r,
              })),
            },
          };
          wsRef.current?.send(JSON.stringify(responseMsg));
        }
        setState('listening');
      })();
    }
  }, [enqueuePcmChunk]); // reconnect added below via ref

  // ── Open WebSocket ────────────────────────────────────────────────────────

  const setupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openWebSocket = useCallback((token: string, modelId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const url = IS_IOS
        ? `${PROXY_WS_BASE}?token=${encodeURIComponent(token)}`
        : `${GEMINI_WS_BASE}?key=${encodeURIComponent(token)}`;
      const ws = new WebSocket(url);
      ws.binaryType = 'arraybuffer'; // server sends binary frames — parse as arraybuffer not Blob
      wsRef.current = ws;

      ws.onopen = () => {
        // Strip non-standard fields + uppercase parameter types (API requires "OBJECT" not "object")
        const cleanTools = optsRef.current.tools.map(tool => ({
          functionDeclarations: tool.functionDeclarations.map(({ name, description, parameters }) => ({
            name,
            description,
            parameters: {
              ...parameters,
              type: parameters.type.toUpperCase(),
              properties: Object.fromEntries(
                Object.entries(parameters.properties).map(([k, v]) => [
                  k,
                  { ...v, type: v.type.toUpperCase() },
                ]),
              ),
            },
          })),
        }));

        const setup: GeminiSetupMessage = {
          setup: {
            model: modelId,
            systemInstruction: {
              parts: [{ text: optsRef.current.systemInstruction }],
            },
            tools: cleanTools,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } },
              },
            },
          },
        };
        ws.send(JSON.stringify(setup));

        // Start a watchdog: if setupComplete doesn't arrive in 15s, bail
        setupTimeoutRef.current = setTimeout(() => {
          if (stoppedRef.current) return;
          ws.close();
          setErr('SETUP_TIMEOUT', 'Servidor não respondeu ao setup em 15s. Verifique a chave Gemini e tente novamente.', true);
        }, 15_000);

        resolve(); // resolve immediately so startMicCapture runs in parallel
      };

      ws.onmessage = (ev) => {
        // Server sends ArrayBuffer frames — decode to string before parsing
        let raw: string;
        if (ev.data instanceof ArrayBuffer) {
          raw = new TextDecoder().decode(ev.data);
        } else {
          raw = ev.data as string;
        }
        try {
          const msg = JSON.parse(raw) as Record<string, unknown>;
          if ('error' in msg) {
            if (setupTimeoutRef.current) clearTimeout(setupTimeoutRef.current);
            const errMsg = (msg.error as Record<string, unknown>)?.message as string ?? 'Erro do servidor Gemini';
            setErr('SERVER_ERROR', errMsg, true);
            ws.close();
            return;
          }
          if ('setupComplete' in msg) {
            if (setupTimeoutRef.current) clearTimeout(setupTimeoutRef.current);
          }
        } catch { /* handled in handleServerMessage */ }
        handleServerMessage(raw);
      };

      ws.onerror = (ev) => {
        if (setupTimeoutRef.current) clearTimeout(setupTimeoutRef.current);
        const msg = (ev instanceof ErrorEvent && ev.message) ? ev.message : 'WebSocket connection failed';
        reject(Object.assign(new Error(msg), { code: msg.toLowerCase().includes('csp') || msg.toLowerCase().includes('not allowed') ? 'CSP_BLOCKED' : 'WS_ERROR' }));
      };

      ws.onclose = (ev) => {
        if (setupTimeoutRef.current) clearTimeout(setupTimeoutRef.current);
        if (stoppedRef.current) return;
        logger.warn(`[GeminiLive] WS closed: ${ev.code} "${ev.reason}"`);
        reconnectCountRef.current += 1;
        if (reconnectCountRef.current > 3) {
          setErr('CONNECTION_LOST', `Servidor encerrou a conexão (código ${ev.code}${ev.reason ? ': ' + ev.reason : ''}). Clique para tentar novamente.`, true);
          return;
        }
        setTimeout(() => void reconnect(), RECONNECT_DELAY_MS);
      };
    });
  }, [handleServerMessage, setErr]); // reconnect ref below

  // ── Reconnect ─────────────────────────────────────────────────────────────

  // Use a ref so handleServerMessage and onclose can call it without circular deps
  const reconnectRef = useRef<() => Promise<void>>();

  const reconnect = useCallback(async () => {
    if (stoppedRef.current) return;
    logger.info('[GeminiLive] reconnecting...');
    setState('reconnecting');

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      const tokenData = await fetchToken();
      await openWebSocket(tokenData.token, tokenData.model_id);
    } catch (err) {
      setErr('RECONNECT_FAILED', err instanceof Error ? err.message : 'Reconnect failed', true);
    }
  }, [fetchToken, openWebSocket, setErr]);

  reconnectRef.current = reconnect;

  // ── Mic capture ───────────────────────────────────────────────────────────

  const sendAudioChunk = useCallback((pcm16Buffer: ArrayBuffer) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (isMutedRef.current) return;

    const b64 = arrayBufferToBase64(pcm16Buffer);
    const msg: GeminiRealtimeInputMessage = {
      realtimeInput: {
        audio: { data: b64, mimeType: AUDIO_INPUT_MIME },
      },
    };
    wsRef.current.send(JSON.stringify(msg));
  }, []);

  const startMicCapture = useCallback(async (): Promise<void> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('getUserMedia not supported in this browser');
    }
    if (typeof AudioContext === 'undefined') {
      throw new Error('Web Audio API not supported in this browser');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    streamRef.current = stream;

    const audioCtx = new AudioContext({ sampleRate: 16000 });
    audioCtxInputRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(stream);

    if (audioCtx.audioWorklet) {
      // Preferred: AudioWorklet
      const blobUrl = createWorkletBlobUrl();
      workletBlobUrlRef.current = blobUrl;
      await audioCtx.audioWorklet.addModule(blobUrl);
      const workletNode = new AudioWorkletNode(audioCtx, 'pcm-capture-processor');
      workletNodeRef.current = workletNode;
      workletNode.port.onmessage = (ev) => {
        const { pcm16 } = ev.data as { pcm16: ArrayBuffer };
        sendAudioChunk(pcm16);
      };
      source.connect(workletNode);
      workletNode.connect(audioCtx.destination);
    } else {
      // Fallback: ScriptProcessorNode (deprecated but broad compat)
      const bufferSize = 4096;
      const scriptProcessor = audioCtx.createScriptProcessor(bufferSize, 1, 1);
      scriptProcessorRef.current = scriptProcessor;
      scriptProcessor.onaudioprocess = (ev) => {
        const float32 = ev.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        sendAudioChunk(int16.buffer);
      };
      source.connect(scriptProcessor);
      scriptProcessor.connect(audioCtx.destination);
    }

    // Output context for 24kHz playback
    audioCtxOutputRef.current = new AudioContext({ sampleRate: AUDIO_OUTPUT_SAMPLE_RATE });
  }, [sendAudioChunk]);

  // ── Public API ────────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    if (state !== 'idle' && state !== 'error') return;

    stoppedRef.current = false;
    reconnectCountRef.current = 0;
    setError(null);
    setTranscript({ partial: '', final: [] });
    setState('connecting');

    try {
      if (typeof AudioContext === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw Object.assign(new Error('Web Audio API or getUserMedia not supported'), { code: 'NO_SUPPORT' });
      }

      const tokenData = await fetchToken();
      await openWebSocket(tokenData.token, tokenData.model_id);
      await startMicCapture();
    } catch (err) {
      cleanup();
      const msg = err instanceof Error ? err.message : 'Failed to start voice session';
      const code = (err as { code?: string }).code ?? 'START_FAILED';
      setErr(code, msg, code !== 'NO_SUPPORT');
    }
  }, [state, fetchToken, openWebSocket, startMicCapture, cleanup, setErr]);

  const stop = useCallback(() => {
    cleanup();
    setState('idle');
    setError(null);
    sessionHandleRef.current = null;
  }, [cleanup]);

  const mute = useCallback(() => {
    isMutedRef.current = true;
    setIsMuted(true);
    // Signal VAD off
    wsRef.current?.send(JSON.stringify({ realtimeInput: { activityEnd: {} } }));
  }, []);

  const unmute = useCallback(() => {
    isMutedRef.current = false;
    setIsMuted(false);
    wsRef.current?.send(JSON.stringify({ realtimeInput: { activityStart: {} } }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => { cleanup(); };
  }, [cleanup]);

  return { state, transcript, isMuted, error, start, stop, mute, unmute };
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/** Parse Go duration string (e.g. "120s", "2m30s") to milliseconds. */
function parseDuration(d: string): number {
  let ms = 0;
  const mMatch = d.match(/(\d+)m/);
  const sMatch = d.match(/(\d+)s/);
  if (mMatch) ms += parseInt(mMatch[1], 10) * 60_000;
  if (sMatch) ms += parseInt(sMatch[1], 10) * 1_000;
  return ms || 600_000; // default 10min if unparseable
}
