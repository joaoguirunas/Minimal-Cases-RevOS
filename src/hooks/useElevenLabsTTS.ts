import { useReducer, useCallback, useRef, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useElevenLabsConfig } from './useElevenLabsConfig';
import { ttsCacheGet, ttsCacheSet, sha256CacheKey } from '@/utils/ttsCache';

/*
 * State machine:
 *   speak()              audio.oncanplay / play() ok
 *   idle ──────────────▶ loading ──────────────────▶ playing
 *    ▲                      │                            │
 *    │ END / STOP           │ error                      │ PAUSE
 *    │                      ▼                            ▼
 *    └────────────────── error ◀── ERROR (any) ──── paused
 *                                                        │ RESUME
 *                                                        └──────▶ playing
 */

// ── State ────────────────────────────────────────────────────────────────────

type State =
  | { kind: 'idle' }
  | { kind: 'loading'; text: string }
  | { kind: 'playing'; text: string; autoplayBlocked: boolean }
  | { kind: 'paused'; text: string }
  | { kind: 'error'; message: string };

// ── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'PLAY_REQUESTED'; text: string }
  | { type: 'LOAD_SUCCESS' }
  | { type: 'LOAD_FAIL'; message: string }
  | { type: 'PLAY_STARTED' }
  | { type: 'AUTOPLAY_BLOCKED' }
  | { type: 'RESUME_BLOCKED' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'STOP' }
  | { type: 'END' }
  | { type: 'ERROR'; message: string };

// ── Reducer ──────────────────────────────────────────────────────────────────

const initial: State = { kind: 'idle' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'PLAY_REQUESTED':
      return { kind: 'loading', text: action.text };

    case 'LOAD_SUCCESS':
      if (state.kind !== 'loading') return state;
      return { kind: 'playing', text: state.text, autoplayBlocked: false };

    case 'LOAD_FAIL':
      return { kind: 'error', message: action.message };

    case 'PLAY_STARTED':
      if (state.kind !== 'loading') return state;
      return { kind: 'playing', text: state.text, autoplayBlocked: false };

    case 'AUTOPLAY_BLOCKED':
      if (state.kind !== 'playing') return state;
      return { kind: 'playing', text: state.text, autoplayBlocked: true };

    case 'RESUME_BLOCKED':
      if (state.kind !== 'playing') return state;
      return { kind: 'playing', text: state.text, autoplayBlocked: false };

    case 'PAUSE':
      if (state.kind !== 'playing') return state;
      return { kind: 'paused', text: state.text };

    case 'RESUME':
      if (state.kind !== 'paused') return state;
      return { kind: 'playing', text: state.text, autoplayBlocked: false };

    case 'STOP':
    case 'END':
      return { kind: 'idle' };

    case 'ERROR':
      return { kind: 'error', message: action.message };

    default:
      return state;
  }
}

// ── Retry ─────────────────────────────────────────────────────────────────────

const RETRYABLE_STATUS = new Set([0, 500, 502, 503, 504]);
const BACKOFF_MS = [250, 750];

async function invokeWithRetry<T>(fn: () => Promise<T>, signal: AbortSignal): Promise<T> {
  for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
    if (signal.aborted) throw new DOMException('aborted', 'AbortError');
    try {
      return await fn();
    } catch (err: unknown) {
      const status =
        (err as { status?: number })?.status ??
        (err as { context?: { status?: number } })?.context?.status ??
        0;
      const isNetwork = err instanceof Error && err.message?.includes('network');
      const retryable = RETRYABLE_STATUS.has(status) || isNetwork;
      if (!retryable || attempt === BACKOFF_MS.length) throw err;
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, BACKOFF_MS[attempt]);
        signal.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('aborted', 'AbortError')); });
      });
    }
  }
  throw new Error('retry exhausted');
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function cleanForTTS(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^[-•]\s*/gm, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/️/gu, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function browserSpeak(text: string, rate = 1.05): { stop: () => void; onEnd: Promise<void> } {
  const clean = cleanForTTS(text);
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = 'pt-BR';
  utterance.rate = rate;

  const voices = window.speechSynthesis.getVoices();
  const ptVoice = voices.find(v => v.lang.startsWith('pt'));
  if (ptVoice) utterance.voice = ptVoice;

  const onEnd = new Promise<void>((resolve) => {
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
  });

  window.speechSynthesis.speak(utterance);
  return {
    stop: () => window.speechSynthesis.cancel(),
    onEnd,
  };
}

function fallbackToSpeechSynthesis(
  text: string,
  clean: string,
  dispatch: (a: Action) => void,
  browserStopRef: React.MutableRefObject<(() => void) | null>,
  rate: number,
) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  dispatch({ type: 'PLAY_REQUESTED', text });
  dispatch({ type: 'PLAY_STARTED' });
  const browser = browserSpeak(clean, rate);
  browserStopRef.current = browser.stop;
  browser.onEnd.then(() => {
    dispatch({ type: 'END' });
    browserStopRef.current = null;
  });
}

function playAudio(
  url: string,
  dispatch: (a: Action) => void,
  audioRef: React.MutableRefObject<HTMLAudioElement | null>,
  blockedAudioRef: React.MutableRefObject<HTMLAudioElement | null>,
  playbackRate: number,
  onTimeUpdate: (t: number) => void,
) {
  const audio = new Audio(url);
  audio.playbackRate = playbackRate;
  audioRef.current = audio;
  dispatch({ type: 'LOAD_SUCCESS' });
  audio.ontimeupdate = () => onTimeUpdate(audio.currentTime);
  audio.onended = () => { dispatch({ type: 'END' }); onTimeUpdate(0); audioRef.current = null; };
  audio.onerror = () => { dispatch({ type: 'END' }); onTimeUpdate(0); audioRef.current = null; };
  audio.play().catch((err: unknown) => {
    const isBlocked = err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'AbortError');
    if (isBlocked) {
      blockedAudioRef.current = audio;
      dispatch({ type: 'AUTOPLAY_BLOCKED' });
    } else {
      dispatch({ type: 'END' });
      onTimeUpdate(0);
    }
  });
}

// ── Speed persistence ─────────────────────────────────────────────────────────

const SPEED_KEY = 'bipro-tts-speed';
const VALID_RATES = [0.75, 1, 1.25, 1.5] as const;
type PlaybackRate = typeof VALID_RATES[number];

function loadRate(): PlaybackRate {
  const raw = parseFloat(localStorage.getItem(SPEED_KEY) ?? '1');
  return (VALID_RATES as readonly number[]).includes(raw) ? raw as PlaybackRate : 1;
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export function useElevenLabsTTS(voiceId?: string | null) {
  const { isConfigured } = useElevenLabsConfig();
  const [state, dispatch] = useReducer(reducer, initial);
  const [playbackRate, setPlaybackRateState] = useState<PlaybackRate>(loadRate);
  const [elapsed, setElapsed] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blockedAudioRef = useRef<HTMLAudioElement | null>(null);
  const browserStopRef = useRef<(() => void) | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const playbackRateRef = useRef<PlaybackRate>(playbackRate);

  const stop = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (browserStopRef.current) {
      browserStopRef.current();
      browserStopRef.current = null;
    }
    if (blockedAudioRef.current) {
      blockedAudioRef.current.pause();
      blockedAudioRef.current = null;
    }
    setElapsed(0);
    dispatch({ type: 'STOP' });
  }, []);

  const setPlaybackRate = useCallback((rate: PlaybackRate) => {
    playbackRateRef.current = rate;
    setPlaybackRateState(rate);
    localStorage.setItem(SPEED_KEY, String(rate));
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, []);

  const speak = useCallback(async (text: string) => {
    if (state.kind === 'playing' || state.kind === 'loading') {
      stop();
      return;
    }

    const clean = cleanForTTS(text);
    if (!clean) return;

    // ── Fallback: browser speech if ElevenLabs not configured ──────────
    if (!isConfigured) {
      if (typeof window === 'undefined' || !window.speechSynthesis) return;
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        dispatch({ type: 'STOP' });
        return;
      }
      dispatch({ type: 'PLAY_REQUESTED', text });
      dispatch({ type: 'PLAY_STARTED' });
      const browser = browserSpeak(clean, playbackRateRef.current);
      browserStopRef.current = browser.stop;
      browser.onEnd.then(() => {
        dispatch({ type: 'END' });
        browserStopRef.current = null;
      });
      return;
    }

    // ── ElevenLabs TTS ─────────────────────────────────────────────────
    const effectiveVoiceId = voiceId || '';
    const cacheKey = await sha256CacheKey(clean, effectiveVoiceId, 'eleven_multilingual_v2');
    const cachedUrl = await ttsCacheGet(cacheKey);

    if (cachedUrl) {
      dispatch({ type: 'PLAY_REQUESTED', text });
      playAudio(cachedUrl, dispatch, audioRef, blockedAudioRef, playbackRateRef.current, setElapsed);
      return;
    }

    // Call edge function with retry
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    const { signal } = controllerRef.current;

    dispatch({ type: 'PLAY_REQUESTED', text });

    try {
      const body: Record<string, string> = { text: clean };
      if (voiceId) body.voice_id = voiceId;

      const { data, error } = await invokeWithRetry(
        () => supabase.functions.invoke('elevenlabs-tts', { body, signal }),
        signal,
      );

      if (error || !data?.url) {
        const status = (error as { status?: number } | null)?.status ?? 0;

        if (status === 429) {
          dispatch({ type: 'ERROR', message: 'Limite ElevenLabs mensal atingido' });
          fallbackToSpeechSynthesis(text, clean, dispatch, browserStopRef, playbackRateRef.current);
          return;
        }
        if (status === 422) {
          dispatch({ type: 'ERROR', message: 'ElevenLabs não configurado' });
          fallbackToSpeechSynthesis(text, clean, dispatch, browserStopRef, playbackRateRef.current);
          return;
        }

        const errDetail = (error as { message?: string } | null)?.message || data?.error || 'Sem URL de áudio';
        console.warn('ElevenLabs TTS failed, falling back to browser:', errDetail);
        dispatch({ type: 'LOAD_FAIL', message: `ElevenLabs indisponível: ${errDetail}` });
        fallbackToSpeechSynthesis(text, clean, dispatch, browserStopRef, playbackRateRef.current);
        return;
      }

      await ttsCacheSet(cacheKey, data.url, clean);
      playAudio(data.url, dispatch, audioRef, blockedAudioRef, playbackRateRef.current, setElapsed);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;

      const status =
        (err as { status?: number })?.status ??
        (err as { context?: { status?: number } })?.context?.status ??
        0;

      if (status === 429) {
        dispatch({ type: 'ERROR', message: 'Limite ElevenLabs mensal atingido' });
        fallbackToSpeechSynthesis(text, clean, dispatch, browserStopRef, playbackRateRef.current);
        return;
      }
      if (status === 422) {
        dispatch({ type: 'ERROR', message: 'ElevenLabs não configurado' });
        fallbackToSpeechSynthesis(text, clean, dispatch, browserStopRef, playbackRateRef.current);
        return;
      }

      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn('ElevenLabs TTS error:', errMsg);
      dispatch({ type: 'ERROR', message: `Erro ElevenLabs: ${errMsg}` });
      fallbackToSpeechSynthesis(text, clean, dispatch, browserStopRef, playbackRateRef.current);
    }
  }, [state.kind, isConfigured, voiceId, stop]);

  useEffect(() => () => {
    controllerRef.current?.abort();
    stop();
  }, [stop]);

  const resumeFromAutoplayBlock = useCallback(() => {
    const audio = blockedAudioRef.current;
    if (!audio) return;
    blockedAudioRef.current = null;
    dispatch({ type: 'RESUME_BLOCKED' });
    audioRef.current = audio;
    audio.play().catch(() => { dispatch({ type: 'END' }); audioRef.current = null; });
  }, []);

  // ── Derived public API (backward-compatible) ──────────────────────────────

  const isPlaying = state.kind === 'playing';
  const isLoadingAudio = state.kind === 'loading';
  const autoplayBlocked = state.kind === 'playing' && state.autoplayBlocked;
  const lastError = state.kind === 'error' ? state.message : null;
  const currentSpeakingText =
    state.kind === 'playing' || state.kind === 'loading' || state.kind === 'paused'
      ? state.text
      : null;

  return {
    speak,
    stop,
    isPlaying,
    isLoadingAudio,
    isElevenLabs: isConfigured,
    lastError,
    autoplayBlocked,
    resumeFromAutoplayBlock,
    currentSpeakingText,
    playbackRate,
    setPlaybackRate,
    elapsed,
  };
}
