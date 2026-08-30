import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Sparkles, Send, Plus, Bot, Trash2, Mic, MicOff, Volume2, VolumeX,
  MessageSquare, PanelLeftClose, PanelLeft, Loader2, ChevronDown, AlertCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useElevenLabsTTS } from "@/hooks/useElevenLabsTTS";
import { useInsightsConversations } from "@/hooks/useInsightsConversations";
import type { Message } from "@/hooks/useInsightsConversations";
import { VoicePlayerBar } from "./VoicePlayerBar";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import DynamicChart from "./DynamicChart";
import type { ChartSpec } from "./DynamicChart";
import { markdownToVoiceText } from "@/utils/markdownToVoiceText";
import { VoiceChatButton } from "@/components/bi/VoiceChatButton";

// ── Loading dots ──────────────────────────────────────────────────────────────
function LoadingDots() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      {[0, 1, 2].map(i => (
        <motion.span key={i}
          className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.55, repeat: Infinity, delay: i * 0.14, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// ── Voice pulse animation (recording indicator) ──────────────────────────────
function VoicePulse() {
  return (
    <div className="flex items-center gap-[3px] h-5">
      {[0, 1, 2, 3, 4].map(i => (
        <motion.div key={i}
          className="w-[3px] rounded-full bg-red-500"
          animate={{ height: ['8px', '18px', '8px'] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// ── Speaking waveform (plays when assistant speaks via ElevenLabs) ────────────
function SpeakingOrb() {
  return (
    <div className="flex items-center gap-[2px] h-4">
      {[0, 1, 2, 3, 4, 5, 6].map(i => (
        <motion.div key={i}
          className="w-[2px] rounded-full bg-primary"
          animate={{ height: ['4px', `${10 + Math.random() * 8}px`, '4px'] }}
          transition={{ duration: 0.4 + Math.random() * 0.3, repeat: Infinity, delay: i * 0.06, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// ── Rich markdown renderer with chart support ───────────────────────────────
function RichMarkdown({ text }: { text: string }) {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const components = useMemo(() => ({
    // Intercept code blocks — render ```chart specs as DynamicChart
    code({ className, children, ...props }: any) {
      const isChart = className === 'language-chart';
      if (isChart) {
        try {
          const spec: ChartSpec = JSON.parse(String(children).trim());
          return <DynamicChart spec={spec} />;
        } catch {
          return <pre className="text-[11px] text-red-400 bg-red-50 dark:bg-red-950/20 p-2 rounded-md overflow-x-auto">{String(children)}</pre>;
        }
      }
      // Inline code
      const isInline = !className && !String(children).includes('\n');
      if (isInline) {
        return <code className="text-[12px] bg-muted px-1.5 py-0.5 rounded font-mono" {...props}>{children}</code>;
      }
      // Regular code block
      return <pre className="text-[11px] bg-muted p-3 rounded-md overflow-x-auto my-2"><code {...props}>{children}</code></pre>;
    },
    // Tables
    table({ children }: any) {
      return (
        <div className="overflow-x-auto my-2 rounded-md border border-border">
          <table className="w-full text-[12px]">{children}</table>
        </div>
      );
    },
    thead({ children }: any) {
      return <thead className="bg-muted">{children}</thead>;
    },
    th({ children }: any) {
      return <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">{children}</th>;
    },
    td({ children }: any) {
      return <td className="px-3 py-2 border-b border-border tabular-nums text-muted-foreground">{children}</td>;
    },
    // Headers
    h2({ children }: any) { return <h2 className="text-[14px] font-bold text-foreground mt-3 mb-1">{children}</h2>; },
    h3({ children }: any) { return <h3 className="text-[13px] font-semibold text-foreground mt-2 mb-1">{children}</h3>; },
    // Lists
    ul({ children }: any) { return <ul className="space-y-0.5 pl-1">{children}</ul>; },
    ol({ children }: any) { return <ol className="space-y-0.5 pl-1 list-decimal list-inside">{children}</ol>; },
    li({ children }: any) { return <li className="text-[13px] leading-relaxed text-muted-foreground">{children}</li>; },
    // Paragraphs
    p({ children }: any) { return <p className="text-[13px] leading-relaxed mb-1 text-muted-foreground">{children}</p>; },
    // Strong
    strong({ children }: any) { return <strong className="font-semibold text-foreground">{children}</strong>; },
  }), []);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (
    <div className="prose-sm max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({ message, index, onSpeak, isSpeaking, isLoadingAudio, isSpeakingThisMessage }: {
  message: Message;
  index: number;
  onSpeak: (text: string) => void;
  isSpeaking: boolean;
  isLoadingAudio: boolean;
  isSpeakingThisMessage: boolean;
}) {
  const isUser = message.role === 'user';
  const isError = !isUser && message.content.startsWith('Erro ao chamar o assistente:');
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 32, delay: index * 0.02 }}
      className={cn("flex gap-2.5 group", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser && (
        <div className={cn(
          "w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 transition-all",
          isError
            ? "bg-red-500/10 ring-1 ring-red-500/20"
            : isSpeaking
              ? "bg-primary ring-2 ring-primary/30"
              : "bg-primary"
        )}>
          {isError
            ? <AlertCircle className="w-3.5 h-3.5 text-red-500" />
            : isSpeaking ? <SpeakingOrb /> : <Bot className="w-3.5 h-3.5 text-primary-foreground" />}
        </div>
      )}
      <div className="flex flex-col gap-1 max-w-[78%]">
        <div className={cn(
          "px-4 py-2.5 text-[13px] leading-[1.65] select-text",
          isUser
            ? "bg-primary text-primary-foreground rounded-lg rounded-tr-sm whitespace-pre-wrap"
            : isError
              ? "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 rounded-lg rounded-tl-sm border border-red-200 dark:border-red-900/40 whitespace-pre-wrap"
              : cn(
                  "bg-card text-foreground rounded-lg rounded-tl-sm border border-border",
                  isSpeakingThisMessage && "border-l-2 border-l-primary"
                )
        )}>
          {isUser ? message.content : isError ? (
            <div className="flex flex-col gap-1">
              <span className="font-medium text-[12px]">Falha ao processar</span>
              <span className="text-[11px] opacity-80">{message.content.replace('Erro ao chamar o assistente: ', '')}</span>
              <span className="text-[10px] opacity-60 mt-0.5">Tente novamente ou reformule a pergunta.</span>
            </div>
          ) : <RichMarkdown text={message.content} />}
        </div>
        {!isUser && !isError && (
          <div className="flex items-center gap-2 opacity-40 group-hover:opacity-100 transition-opacity ml-1">
            <button
              onClick={() => onSpeak(message.content)}
              disabled={isLoadingAudio}
              aria-label={isLoadingAudio ? "Carregando áudio" : isSpeakingThisMessage ? "Parar narração" : "Ouvir resposta"}
              className={cn(
                "flex items-center justify-center w-9 h-9 rounded text-muted-foreground/50 hover:text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                isLoadingAudio && "opacity-50 cursor-wait",
              )}
              title={isLoadingAudio ? "Carregando áudio..." : isSpeakingThisMessage ? "Parar narração" : "Ouvir resposta"}
            >
              {isLoadingAudio
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : isSpeakingThisMessage
                  ? <VolumeX className="w-3.5 h-3.5" />
                  : <Volume2 className="w-3.5 h-3.5" />
              }
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Welcome screen ────────────────────────────────────────────────────────────
const ALL_SUGGESTIONS = [
  "Qual etapa do funil tem mais gargalo?",
  "Quais são os principais motivos de perda?",
  "Como está a taxa de conversão este mês?",
  "Qual canal de mensagem tem mais volume?",
  "Quantas conversas estão sem resposta?",
  "Qual closer tem melhor show rate?",
  "Quantas chamadas foram atendidas esta semana?",
  "Qual fonte UTM gera mais leads ganhos?",
  "Como estão as campanhas de prospecção?",
  "Qual é o ticket médio das vendas do mês?",
  "Qual vendedor tem mais reuniões agendadas?",
  "Me dá um resumo geral do funil",
];

function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function WelcomeScreen({ onSuggestion }: { onSuggestion: (t: string) => void }) {
  const [suggestions] = useState(() => pickRandom(ALL_SUGGESTIONS, 4));
  const prefersReduced = useReducedMotion();

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-6">
      {/* Icon */}
      <motion.div
        initial={prefersReduced ? {} : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.2 }}
      >
        <div className="w-14 h-14 rounded-md bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-primary" />
        </div>
      </motion.div>

      {/* Title */}
      <motion.div
        initial={prefersReduced ? {} : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="text-center space-y-2 max-w-sm"
      >
        <h2 className="text-lg font-semibold text-foreground tracking-tight">Insights AI</h2>
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          Pergunte qualquer coisa sobre seus dados — funil, mensagens, agendamentos, calls, marketing e prospecção. Mencione período, pipeline ou vendedor direto na conversa.
        </p>
      </motion.div>

      {/* Suggestions grid */}
      <motion.div
        initial={prefersReduced ? {} : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="grid grid-cols-2 gap-2 w-full max-w-md"
      >
        {suggestions.map((s, i) => (
          <motion.button
            key={s}
            initial={prefersReduced ? {} : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.55 + i * 0.06 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSuggestion(s)}
            className="text-left px-3.5 py-3 text-[12px] text-muted-foreground border border-border bg-card backdrop-blur-sm rounded-md hover:border-primary/30 hover:text-foreground hover:bg-primary/[0.03] transition-all leading-snug"
          >
            {s}
          </motion.button>
        ))}
      </motion.div>

      <motion.p
        initial={prefersReduced ? {} : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="text-[11px] text-muted-foreground/40 flex items-center gap-1.5"
      >
        <Mic className="w-3 h-3" /> Você pode também enviar áudio
      </motion.p>
    </div>
  );
}

// ── Speech recognition with permission handling, error feedback & device enumeration ──
type MicStatus = 'idle' | 'requesting' | 'listening' | 'denied' | 'unavailable' | 'error';

interface AudioDevice { deviceId: string; label: string; }

/* eslint-disable @typescript-eslint/no-explicit-any */
function useSpeechRecognition() {
  const [status, setStatus] = useState<MicStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const finalTranscriptRef = useRef('');

  const isListening = status === 'listening';

  // Enumerate audio input devices (requires permission first)
  const refreshDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices
        .filter(d => d.kind === 'audioinput' && d.deviceId)
        .map(d => ({ deviceId: d.deviceId, label: d.label || `Microfone ${d.deviceId.slice(0, 6)}` }));
      setAudioDevices(audioInputs);
    } catch { /* ignore — devices unavailable */ }
  }, []);

  // Refresh devices on mount and when devices change
  useEffect(() => {
    refreshDevices();
    const handler = () => refreshDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', handler);
    return () => { navigator.mediaDevices?.removeEventListener?.('devicechange', handler); };
  }, [refreshDevices]);

  // Release active mic stream
  const releaseStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startListening = useCallback(async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatus('unavailable');
      setErrorMsg('Reconhecimento de voz não suportado neste navegador.');
      return;
    }

    // Request mic permission (and validate selected device), then release immediately
    // so SpeechRecognition can acquire the device without conflict on macOS.
    setStatus('requesting');
    setErrorMsg(null);
    releaseStream(); // Release any previous stream

    // Safety timeout: if status stays 'requesting' for >5s, reset to idle
    const requestingTimeout = setTimeout(() => {
      setStatus((prev: MicStatus) => {
        if (prev === 'requesting') {
          console.warn('[SpeechRecognition] Status stuck in requesting — resetting to idle');
          setErrorMsg('Tempo esgotado aguardando microfone. Tente novamente.');
          return 'idle';
        }
        return prev;
      });
    }, 5000);

    try {
      const constraints: MediaStreamConstraints = {
        audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
      };
      console.debug('[SpeechRecognition] Requesting getUserMedia…');
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      // Release stream immediately — avoids dual-capture conflict with SpeechRecognition
      stream.getTracks().forEach(t => t.stop());
      // After permission granted, refresh device list (labels become available)
      refreshDevices();
    } catch (err: any) {
      clearTimeout(requestingTimeout);
      console.warn('[SpeechRecognition] getUserMedia error:', err.name, err.message);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setStatus('denied');
        setErrorMsg('Permissão do microfone negada. Permita nas configurações do navegador.');
      } else if (err.name === 'NotFoundError') {
        setStatus('unavailable');
        setErrorMsg('Nenhum microfone detectado.');
      } else if (err.name === 'OverconstrainedError') {
        // Selected device no longer available, fall back to default
        setSelectedDeviceId(null);
        setStatus('error');
        setErrorMsg('Microfone selecionado não disponível. Usando padrão do sistema.');
      } else {
        setStatus('error');
        setErrorMsg('Erro ao acessar microfone: ' + (err.message || err.name));
      }
      return;
    }

    // Permission granted — start recognition
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (e: any) => {
      let interim = '';
      let final = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          final += r[0].transcript;
        } else {
          interim += r[0].transcript;
        }
      }
      if (final) finalTranscriptRef.current += final;
      setTranscript(finalTranscriptRef.current + interim);
    };

    recognition.onerror = (e: any) => {
      console.warn('[SpeechRecognition] onerror:', e.error);
      const errorMap: Record<string, string> = {
        'not-allowed': 'Permissão do microfone negada.',
        'no-speech': 'Nenhuma fala detectada. Toque para tentar novamente.',
        'audio-capture': 'Microfone não disponível.',
        'network': 'Erro de rede no reconhecimento de voz.',
        'aborted': '',
      };
      const msg = errorMap[e.error] ?? `Erro de voz: ${e.error}`;
      if (e.error === 'not-allowed') {
        setStatus('denied');
        releaseStream();
      } else if (e.error === 'no-speech' || e.error === 'aborted') {
        setStatus('idle');
        releaseStream();
      } else {
        setStatus('error');
        releaseStream();
      }
      if (msg) setErrorMsg(msg);
    };

    recognition.onend = () => {
      setStatus('idle');
      releaseStream();
    };

    recognitionRef.current = recognition;
    finalTranscriptRef.current = '';

    // Wrap recognition.start() in try-catch — uncaught throw here was the primary bug
    // causing status to stick at 'requesting' with the button permanently disabled
    try {
      recognition.start();
      clearTimeout(requestingTimeout);
      console.debug('[SpeechRecognition] recognition.start() OK — listening');
      setStatus('listening');
      setTranscript('');
    } catch (startErr: any) {
      clearTimeout(requestingTimeout);
      console.error('[SpeechRecognition] recognition.start() threw:', startErr.name, startErr.message);
      setStatus('error');
      setErrorMsg('Falha ao iniciar reconhecimento de voz: ' + (startErr.message || startErr.name));
    }
  }, [selectedDeviceId, refreshDevices, releaseStream]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    releaseStream();
    setStatus('idle');
  }, [releaseStream]);

  const clearError = useCallback(() => {
    setErrorMsg(null);
    if (status === 'denied' || status === 'error' || status === 'unavailable') {
      setStatus('idle');
    }
  }, [status]);

  const supported = typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  return {
    isListening, status, transcript, errorMsg,
    startListening, stopListening, supported, setTranscript, clearError,
    audioDevices, selectedDeviceId, setSelectedDeviceId,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Voice selection persistence ──────────────────────────────────────────────
const VOICE_ID_KEY = 'bipro-insights-voice-id';

function loadVoiceId(): string | null {
  try { return localStorage.getItem(VOICE_ID_KEY); } catch { return null; }
}
function saveVoiceId(id: string | null) {
  try { if (id) localStorage.setItem(VOICE_ID_KEY, id); else localStorage.removeItem(VOICE_ID_KEY); } catch { /* noop */ }
}

// ── Props (date/pipeline filters from Dashboard) ─────────────────────────────
interface Props {
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  pipelineId?: string;
}

// ── Resolve period to date range (only for explicit custom ranges) ─────────────
// The Insights chat is conversational — it should receive ALL data so the AI
// can answer questions about any period. Only custom date ranges are forwarded.
function resolvePeriodDates(dateFrom?: string, dateTo?: string) {
  if (dateFrom || dateTo) return { date_from: dateFrom, date_to: dateTo };
  return {};
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function BIProInsightsTab({ period, dateFrom, dateTo, pipelineId }: Props) {
  const navigate = useNavigate();
  const {
    conversations,
    activeConversation: activeConversationFromHook,
    activeConvId,
    setActiveConvId,
    createConversation,
    deleteConversation,
    appendMessage,
    updateTitle,
  } = useInsightsConversations();
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(loadVoiceId);
  const [micDropdownOpen, setMicDropdownOpen] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(() => localStorage.getItem('bipro-auto-speak') === 'true');
  const [hasSetAutoSpeak, setHasSetAutoSpeak] = useState(() => localStorage.getItem('bipro-auto-speak-set') === 'true');

  useEffect(() => {
    localStorage.setItem('bipro-auto-speak', String(autoSpeak));
  }, [autoSpeak]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const autoPlayRef = useRef<string | null>(null);

  const prefersReducedMotion = useReducedMotion();
  const speech = useSpeechRecognition();
  const tts = useElevenLabsTTS(selectedVoiceId);
  const sendMessageRef = useRef<(text: string) => void>(() => {});
  const chatControllerRef = useRef<AbortController | null>(null);
  const isListeningRef = useRef(false);

  // Keep refs in sync
  isListeningRef.current = speech.isListening;

  // Persist voice preferences
  useEffect(() => { saveVoiceId(selectedVoiceId); }, [selectedVoiceId]);

  const activeConversation = activeConversationFromHook;

  const handleAutoSpeakConsent = (enable: boolean) => {
    setAutoSpeak(enable);
    localStorage.setItem('bipro-auto-speak', String(enable));
    localStorage.setItem('bipro-auto-speak-set', 'true');
    setHasSetAutoSpeak(true);
    if (enable && activeConversation) {
      const msgs = activeConversation.messages;
      const last = msgs[msgs.length - 1];
      if (last?.role === 'assistant') tts.speak(markdownToVoiceText(last.content));
    }
  };

  const shouldShowBanner = !hasSetAutoSpeak &&
    (activeConversation?.messages.some(m => m.role === 'assistant') ?? false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages, isLoading]);

  // Auto-play last assistant message when voice mode is on
  // Skip initial mount — only play after NEW messages arrive from user interaction
  const initialLoadRef = useRef(true);
  useEffect(() => {
    if (initialLoadRef.current) {
      // On first render, mark existing messages as "already seen" so they don't auto-play
      if (activeConversation?.messages.length) {
        const last = activeConversation.messages[activeConversation.messages.length - 1];
        if (last?.role === 'assistant') autoPlayRef.current = last.content;
      }
      initialLoadRef.current = false;
      return;
    }
    if (!activeConversation) return;
    const msgs = activeConversation.messages;
    const last = msgs[msgs.length - 1];
    if (last?.role === 'assistant' && autoPlayRef.current !== last.content) {
      autoPlayRef.current = last.content;
      if (autoSpeak) tts.speak(markdownToVoiceText(last.content));
    }
  }, [activeConversation?.messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Voice-loop prevention: stop mic the moment TTS starts speaking ─────────
  // This prevents the microphone from capturing the agent's own TTS audio output
  // as a new user question, which would create an infinite loop.
  const isAgentSpeaking = tts.isPlaying;
  const isAgentSpeakingRef = useRef(false);
  isAgentSpeakingRef.current = isAgentSpeaking;

  useEffect(() => {
    if (isAgentSpeaking && speech.isListening) {
      // TTS just started — kill the mic immediately
      speech.stopListening();
    }
  }, [isAgentSpeaking]); // eslint-disable-line react-hooks/exhaustive-deps

  // Esc key stops TTS when playing
  useEffect(() => {
    if (!tts.isPlaying) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') tts.stop(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tts.isPlaying, tts.stop]);

  // When speech transcript updates, fill input
  useEffect(() => {
    if (speech.transcript) setInputText(speech.transcript);
  }, [speech.transcript]);

  // Auto-send when speech ends with content (uses ref to avoid stale closure)
  useEffect(() => {
    if (!speech.isListening && speech.transcript.trim()) {
      const text = speech.transcript.trim();
      speech.setTranscript('');
      setInputText('');
      sendMessageRef.current(text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.isListening]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    let convId = activeConvId;
    if (!convId) convId = createConversation();

    const userMsg: Message = { role: 'user', content: text.trim(), createdAt: new Date() };

    // Build history snapshot BEFORE appending the user message
    const stripCharts = (t: string) => t.replace(/```chart\n[\s\S]*?```/g, '[gráfico gerado]');
    const currentConv = conversations.find(c => c.id === convId);
    const history = (currentConv?.messages ?? []).slice(-20).map(m => ({
      role: m.role,
      content: m.role === 'assistant' ? stripCharts(m.content) : m.content,
    }));

    // Set title on first message
    if (!currentConv?.messages.length) {
      updateTitle(convId, text.trim().slice(0, 45));
    }
    appendMessage(convId, userMsg);
    setInputText('');
    setIsLoading(true);

    chatControllerRef.current?.abort();
    chatControllerRef.current = new AbortController();
    const { signal } = chatControllerRef.current;

    try {
      const { data, error } = await supabase.functions.invoke('bi-insights-chat', {
        body: {
          message: text.trim(),
          history,
          context_hint: {
            ...resolvePeriodDates(dateFrom, dateTo),
            ...(pipelineId ? { pipeline_id: pipelineId } : {}),
          },
        },
        signal,
      });

      if (error) throw error;

      const assistantMsg: Message = {
        role: 'assistant',
        content: data?.response ?? 'Desculpe, não consegui processar sua pergunta.',
        createdAt: new Date(),
      };
      appendMessage(convId, assistantMsg);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const errMsg = err instanceof Error ? err.message : String(err);
      appendMessage(convId, {
        role: 'assistant',
        content: `Erro ao chamar o assistente: ${errMsg}`,
        createdAt: new Date(),
      });
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [activeConvId, conversations, createConversation, appendMessage, updateTitle, isLoading]);

  // Keep ref in sync so auto-send effect always uses latest sendMessage
  sendMessageRef.current = sendMessage;

  useEffect(() => () => { chatControllerRef.current?.abort(); }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(inputText); }
  };

  const toggleVoice = () => {
    // If agent is speaking via TTS, stop TTS first before opening mic
    if (isAgentSpeaking) {
      tts.stop();
      // Give a brief pause for audio output to stop, then start mic
      setTimeout(() => {
        speech.clearError();
        speech.startListening();
      }, 300);
      return;
    }
    if (speech.isListening) {
      speech.stopListening();
    } else {
      speech.clearError();
      speech.startListening();
    }
  };

  // Auto-dismiss error after 5s
  useEffect(() => {
    if (!speech.errorMsg) return;
    const timer = setTimeout(() => speech.clearError(), 5000);
    return () => clearTimeout(timer);
  }, [speech.errorMsg]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="h-[calc(100vh-180px)] min-h-[500px] flex rounded-lg border border-border bg-background overflow-hidden">

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 240, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            className="flex-shrink-0 border-r border-border flex flex-col bg-background overflow-hidden"
          >
            <div className="px-3 py-4">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={createConversation}
                aria-label="Iniciar nova conversa"
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-[12px] font-medium border border-border text-foreground rounded-md hover:bg-muted transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Nova conversa
              </motion.button>
            </div>

            <div className="flex-1 overflow-y-auto px-1.5 pb-2">
              <AnimatePresence>
                {conversations.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <MessageSquare className="w-5 h-5 mx-auto mb-2 text-muted-foreground/20" />
                    <p className="text-[11px] text-muted-foreground/40">Nenhuma conversa</p>
                  </div>
                ) : (
                  conversations.map(conv => (
                    <motion.div
                      key={conv.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8, height: 0 }}
                      className="group relative"
                    >
                      <button
                        onClick={() => setActiveConvId(conv.id)}
                        className={cn(
                          "w-full text-left px-3 py-2.5 text-[11px] transition-all rounded-md mx-0.5 pr-8",
                          conv.id === activeConvId
                            ? "bg-muted text-foreground font-medium"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <span className="block truncate">{conv.title}</span>
                      </button>
                      <button
                        onClick={() => deleteConversation(conv.id)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-destructive transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Chat area ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Minimal header */}
        <div className="px-4 py-3 border-b border-border flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? "Fechar histórico de conversas" : "Abrir histórico de conversas"}
            className="text-muted-foreground/60 hover:text-foreground transition-colors p-1 -ml-1"
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-foreground leading-none">Insights AI</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Pergunte sobre funil, vendas, marketing e mais</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <VoicePlayerBar
              tts={tts}
              selectedVoiceId={selectedVoiceId}
              onVoiceChange={setSelectedVoiceId}
              autoSpeak={autoSpeak}
              onAutoSpeakChange={setAutoSpeak}
            />

            {/* ── Mic device selector — always visible (Story 1.4) ──── */}
            <div className="relative">
              <button
                aria-label="Selecionar microfone"
                onClick={() => setMicDropdownOpen(!micDropdownOpen)}
                title={speech.audioDevices.length <= 1 ? "Conecte outro microfone para alternar" : undefined}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 text-[12px] rounded-md transition-colors",
                  speech.audioDevices.length > 1
                    ? "text-muted-foreground hover:text-foreground hover:bg-muted"
                    : "text-muted-foreground/50 hover:text-muted-foreground cursor-help"
                )}
              >
                <Mic className="w-3 h-3 shrink-0" />
                <span className="max-w-[140px] truncate">
                  {speech.audioDevices.length > 1
                    ? `Mic: ${speech.audioDevices.find(d => d.deviceId === speech.selectedDeviceId)?.label || 'Mic padrão'}`
                    : 'Microfone padrão'}
                </span>
                <ChevronDown className="w-2.5 h-2.5 shrink-0" />
              </button>
              {micDropdownOpen && speech.audioDevices.length > 1 && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMicDropdownOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-popover border border-border rounded-md py-1 max-h-48 overflow-y-auto">
                    <button
                      onClick={() => { speech.setSelectedDeviceId(null); setMicDropdownOpen(false); }}
                      className={cn(
                        "w-full text-left px-3 py-1.5 text-[11px] hover:bg-muted transition-colors",
                        !speech.selectedDeviceId && "text-foreground font-medium"
                      )}
                    >
                      Mic padrão do sistema
                    </button>
                    {speech.audioDevices.map(d => (
                      <button
                        key={d.deviceId}
                        onClick={() => { speech.setSelectedDeviceId(d.deviceId); setMicDropdownOpen(false); }}
                        className={cn(
                          "w-full text-left px-3 py-1.5 text-[11px] hover:bg-muted transition-colors truncate",
                          speech.selectedDeviceId === d.deviceId && "text-foreground font-medium"
                        )}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

          </div>
        </div>

        {/* Messages / Welcome */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <AnimatePresence mode="wait">
            {!activeConversation || activeConversation.messages.length === 0 ? (
              <motion.div
                key="welcome"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full"
              >
                <WelcomeScreen onSuggestion={(t) => sendMessage(t)} />
              </motion.div>
            ) : (
              <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {activeConversation.messages.map((msg, i) => (
                  <MessageBubble
                    key={`${msg.role}-${msg.createdAt.getTime()}-${i}`}
                    message={msg}
                    index={i}
                    onSpeak={(text) => tts.speak(markdownToVoiceText(text))}
                    isSpeaking={tts.isPlaying}
                    isLoadingAudio={tts.isLoadingAudio}
                    isSpeakingThisMessage={tts.currentSpeakingText === markdownToVoiceText(msg.content)}
                  />
                ))}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-2.5 justify-start"
                    role="status"
                    aria-label="Analisando dados"
                  >
                    <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5 text-primary-foreground" />
                    </div>
                    <div className="bg-muted rounded-lg rounded-tl-sm border border-border flex items-center gap-2 pr-4">
                      <LoadingDots />
                      <span className="text-[11px] text-muted-foreground/50">Analisando seus dados...</span>
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Consent banner — sticky above input ────────────────── */}
        <AnimatePresence>
          {shouldShowBanner && (
            <motion.div
              key="auto-speak-banner"
              role="dialog"
              aria-label="Confirmar narração automática"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? {} : { opacity: 0, y: 8, transition: { duration: 0.15, ease: 'easeOut' } }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="mx-4 mb-2 rounded-lg border border-border bg-card px-4 py-3 flex flex-col gap-3"
            >
              <span className="text-sm text-foreground">Narrar respostas em voz automaticamente?</span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAutoSpeakConsent(true)}
                  aria-label="Ativar narração automática"
                  className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Ativar narração
                </button>
                <button
                  onClick={() => handleAutoSpeakConsent(false)}
                  aria-label="Manter narração desativada"
                  className="text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Não, obrigado
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Input bar ──────────────────────────────────────────── */}
        <div className="px-4 pb-4 pt-2">
          <div className={cn(
            "flex items-end gap-2 border border-border rounded-lg bg-card px-3 py-2 transition-all",
            "focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/30",
            speech.isListening && "ring-2 ring-red-500/20 border-red-400/40",
            speech.status === 'requesting' && "ring-2 ring-amber-500/20 border-amber-400/40",
          )}>
            {/* Voice button */}
            {speech.supported && (
              <button
                onClick={toggleVoice}
                disabled={isLoading || speech.status === 'requesting'}
                aria-label={speech.isListening ? "Parar gravação de voz" : "Enviar por voz"}
                className={cn(
                  "flex-shrink-0 w-9 h-9 rounded-md flex items-center justify-center transition-all",
                  speech.isListening
                    ? "bg-red-500/10 text-red-500"
                    : speech.status === 'requesting'
                      ? "text-muted-foreground/30 animate-pulse"
                      : speech.status === 'denied'
                        ? "text-red-400/60"
                        : "text-muted-foreground/50 hover:text-foreground hover:bg-muted"
                )}
                title={
                  speech.status === 'requesting' ? "Aguardando permissão do microfone..." :
                  speech.status === 'denied' ? "Microfone bloqueado — permita nas configurações" :
                  speech.isListening ? "Parar gravação" : "Enviar por voz"
                }
              >
                {speech.status === 'requesting'
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : speech.status === 'denied'
                    ? <MicOff className="w-4 h-4" />
                    : speech.isListening
                      ? <VoicePulse />
                      : <Mic className="w-4 h-4" />
                }
              </button>
            )}

            {/* Textarea */}
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={speech.isListening ? "Ouvindo..." : "Pergunte sobre seus dados..."}
              disabled={isLoading}
              rows={1}
              className={cn(
                "flex-1 resize-none bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/40",
                "focus:outline-none py-2",
                "min-h-[36px] max-h-[100px]",
                isLoading && "opacity-50 cursor-not-allowed",
              )}
              onInput={e => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
              }}
            />

            {/* Send */}
            <motion.button
              whileHover={inputText.trim() && !isLoading ? { scale: 1.05 } : {}}
              whileTap={inputText.trim() && !isLoading ? { scale: 0.95 } : {}}
              onClick={() => sendMessage(inputText)}
              disabled={isLoading || !inputText.trim()}
              aria-label="Enviar mensagem"
              className={cn(
                "flex-shrink-0 w-9 h-9 rounded-md flex items-center justify-center transition-all",
                inputText.trim() && !isLoading
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "text-muted-foreground/30"
              )}
            >
              <Send className="w-4 h-4" />
            </motion.button>
          </div>
          {/* Voice error feedback */}
          {speech.errorMsg ? (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-[10px] text-red-500 mt-1.5 text-center flex items-center justify-center gap-1"
            >
              <MicOff className="w-3 h-3" />
              {speech.errorMsg}
            </motion.p>
          ) : tts.lastError ? (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[10px] text-amber-500 mt-1.5 text-center flex items-center justify-center gap-1"
            >
              <VolumeX className="w-3 h-3" />
              {tts.lastError}
            </motion.p>
          ) : (
            <p className="text-[10px] text-muted-foreground/30 mt-1.5 text-center">
              Shift+Enter nova linha · Mencione período, pipeline ou vendedor na conversa
            </p>
          )}
        </div>
      </div>

      <VoiceChatButton onSwitchToText={() => inputRef.current?.focus()} />
    </div>
  );
}
