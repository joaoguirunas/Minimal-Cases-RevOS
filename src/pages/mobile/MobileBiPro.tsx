import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Send, Plus, Bot, Trash2, Mic, Volume2, VolumeX,
  MessageSquare, Loader2, AlertCircle, History, SlidersHorizontal, GitBranch,
} from "lucide-react";
import { MobileGeminiVoice } from "@/components/bi/MobileGeminiVoice";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useElevenLabsTTS } from "@/hooks/useElevenLabsTTS";
import { useElevenLabsVoices } from "@/hooks/useElevenLabsConfig";
import { usePipelines } from "@/hooks/usePipelines";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import DynamicChart from "@/components/dashboard/DynamicChart";
import type { ChartSpec } from "@/components/dashboard/DynamicChart";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { markdownToVoiceText } from "@/utils/markdownToVoiceText";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
}

// ── LocalStorage (shared with desktop) ───────────────────────────────────────
const STORAGE_KEY = 'bipro-insights-conversations';
const ACTIVE_KEY  = 'bipro-insights-active';

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Conversation & { createdAt: string; messages: Array<Message & { createdAt: string }> }>;
    return parsed.map(c => ({
      ...c,
      createdAt: new Date(c.createdAt),
      messages: c.messages.map(m => ({ ...m, createdAt: new Date(m.createdAt) })),
    }));
  } catch { return []; }
}

function saveConversations(convs: Conversation[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(convs)); } catch { /* quota */ }
}

function loadActiveId(): string | null {
  try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; }
}

function saveActiveId(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch { /* noop */ }
}

// ── Suggestions ───────────────────────────────────────────────────────────────
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
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

// ── Voice ─────────────────────────────────────────────────────────────────────
type MicStatus = 'idle' | 'requesting' | 'listening' | 'denied' | 'unavailable' | 'error';

/* eslint-disable @typescript-eslint/no-explicit-any */
function useSpeechRecognition() {
  const [status, setStatus]       = useState<MicStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [errorMsg, setErrorMsg]   = useState<string | null>(null);
  const recognitionRef            = useRef<any>(null);
  const streamRef                 = useRef<MediaStream | null>(null);
  const finalTranscriptRef        = useRef('');

  const supported = typeof window !== 'undefined' &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const isListening = status === 'listening';

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

    setStatus('requesting');
    setErrorMsg(null);
    releaseStream();

    const requestingTimeout = setTimeout(() => {
      setStatus((prev: MicStatus) => {
        if (prev === 'requesting') {
          setErrorMsg('Tempo esgotado aguardando microfone. Tente novamente.');
          return 'idle';
        }
        return prev;
      });
    }, 5000);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Release immediately — avoids dual-capture conflict with SpeechRecognition
      stream.getTracks().forEach(t => t.stop());
    } catch (err: any) {
      clearTimeout(requestingTimeout);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setStatus('denied');
        setErrorMsg('Permissão do microfone negada. Permita nas configurações do navegador.');
      } else if (err.name === 'NotFoundError') {
        setStatus('unavailable');
        setErrorMsg('Nenhum microfone detectado.');
      } else {
        setStatus('error');
        setErrorMsg('Erro ao acessar microfone: ' + (err.message || err.name));
      }
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (e: any) => {
      let interim = '';
      let final   = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final   += r[0].transcript;
        else           interim += r[0].transcript;
      }
      if (final) finalTranscriptRef.current += final;
      setTranscript(finalTranscriptRef.current + interim);
    };

    recognition.onerror = (e: any) => {
      const errorMap: Record<string, string> = {
        'not-allowed': 'Permissão do microfone negada.',
        'no-speech':   'Nenhuma fala detectada. Toque para tentar novamente.',
        'audio-capture': 'Microfone não disponível.',
        'network':     'Erro de rede no reconhecimento de voz.',
        'aborted':     '',
      };
      const msg = errorMap[e.error] ?? `Erro de voz: ${e.error}`;
      if (e.error === 'not-allowed') setStatus('denied');
      else if (e.error === 'no-speech' || e.error === 'aborted') setStatus('idle');
      else setStatus('error');
      releaseStream();
      if (msg) setErrorMsg(msg);
    };

    recognition.onend = () => { setStatus('idle'); releaseStream(); };

    recognitionRef.current    = recognition;
    finalTranscriptRef.current = '';

    try {
      recognition.start();
      clearTimeout(requestingTimeout);
      setStatus('listening');
      setTranscript('');
    } catch (startErr: any) {
      clearTimeout(requestingTimeout);
      setStatus('error');
      setErrorMsg('Falha ao iniciar reconhecimento: ' + (startErr.message || startErr.name));
    }
  }, [releaseStream]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    releaseStream();
    setStatus('idle');
  }, [releaseStream]);

  const clearError = useCallback(() => {
    setErrorMsg(null);
    if (status === 'denied' || status === 'error' || status === 'unavailable') setStatus('idle');
  }, [status]);

  return { isListening, status, transcript, errorMsg, startListening, stopListening, supported, setTranscript, clearError };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Rich markdown with chart support ─────────────────────────────────────────
function RichMarkdown({ text }: { text: string }) {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const components = useMemo(() => ({
    code({ className, children, ...props }: any) {
      if (className === 'language-chart') {
        try {
          const spec: ChartSpec = JSON.parse(String(children).trim());
          return (
            <div className="w-full min-w-0 my-2">
              <DynamicChart spec={{ ...spec, height: spec.height ? Math.min(spec.height, 220) : 200 }} />
            </div>
          );
        } catch {
          return <pre className="text-[11px] text-red-400 bg-red-950/20 p-2 rounded overflow-x-auto">{String(children)}</pre>;
        }
      }
      const isInline = !className && !String(children).includes('\n');
      if (isInline) return <code className="text-[12px] bg-muted px-1.5 py-0.5 rounded font-mono" {...props}>{children}</code>;
      return <pre className="text-[11px] bg-muted p-3 rounded overflow-x-auto my-2"><code {...props}>{children}</code></pre>;
    },
    table({ children }: any) {
      return (
        <div className="overflow-x-auto my-2 rounded border border-border">
          <table className="w-full text-[12px]">{children}</table>
        </div>
      );
    },
    thead({ children }: any) { return <thead className="bg-muted">{children}</thead>; },
    th({ children }: any) { return <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">{children}</th>; },
    td({ children }: any) { return <td className="px-3 py-2 border-b border-border tabular-nums text-muted-foreground">{children}</td>; },
    h2({ children }: any) { return <h2 className="text-[14px] font-bold text-foreground mt-3 mb-1">{children}</h2>; },
    h3({ children }: any) { return <h3 className="text-[13px] font-semibold text-foreground mt-2 mb-1">{children}</h3>; },
    ul({ children }: any) { return <ul className="space-y-0.5 pl-1">{children}</ul>; },
    ol({ children }: any) { return <ol className="space-y-0.5 pl-1 list-decimal list-inside">{children}</ol>; },
    li({ children }: any) { return <li className="text-[13px] leading-relaxed text-muted-foreground">{children}</li>; },
    p({ children }: any) { return <p className="text-[13px] leading-relaxed mb-1 text-muted-foreground">{children}</p>; },
    strong({ children }: any) { return <strong className="font-semibold text-foreground">{children}</strong>; },
  }), []);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (
    <div className="prose-sm max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{text}</ReactMarkdown>
    </div>
  );
}

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

// ── Voice bars (recording) ────────────────────────────────────────────────────
function VoicePulse() {
  return (
    <div className="flex items-center gap-[3px] h-4">
      {[0, 1, 2, 3, 4].map(i => (
        <motion.div key={i}
          className="w-[3px] rounded-full bg-red-500"
          animate={{ height: ['6px', '14px', '6px'] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// ── Speaking bars (TTS) ───────────────────────────────────────────────────────
function SpeakingOrb() {
  return (
    <div className="flex items-center gap-[2px] h-3.5">
      {[0, 1, 2, 3, 4, 5, 6].map(i => (
        <motion.div key={i}
          className="w-[2px] rounded-full bg-primary"
          animate={{ height: ['3px', `${8 + Math.random() * 6}px`, '3px'] }}
          transition={{ duration: 0.4 + Math.random() * 0.3, repeat: Infinity, delay: i * 0.06, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({ message, index, onSpeak, isSpeaking, isLoadingAudio }: {
  message: Message;
  index: number;
  onSpeak: (text: string) => void;
  isSpeaking: boolean;
  isLoadingAudio: boolean;
}) {
  const isUser  = message.role === 'user';
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
          isError     ? "bg-red-500/10 ring-1 ring-red-500/20"
          : isSpeaking ? "bg-primary ring-2 ring-primary/30"
                       : "bg-primary"
        )}>
          {isError ? <AlertCircle className="w-3.5 h-3.5 text-red-500" />
           : isSpeaking ? <SpeakingOrb />
           : <Bot className="w-3.5 h-3.5 text-primary-foreground" />}
        </div>
      )}
      <div className="flex flex-col gap-1 max-w-[82%] min-w-0">
        <div className={cn(
          "px-3.5 py-2.5 text-[13px] leading-[1.65] min-w-0",
          isUser
            ? "bg-primary text-primary-foreground rounded-lg rounded-tr-sm whitespace-pre-wrap"
            : isError
              ? "bg-red-950/20 text-red-400 rounded-lg rounded-tl-sm border border-red-900/40 whitespace-pre-wrap"
              : "bg-card text-foreground rounded-lg rounded-tl-sm border border-border"
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
          <button
            onClick={() => onSpeak(message.content)}
            disabled={isLoadingAudio}
            aria-label={isSpeaking ? "Parar narração" : "Ouvir resposta"}
            className="opacity-50 hover:opacity-100 active:opacity-100 transition-opacity ml-1 text-muted-foreground/50 hover:text-foreground"
          >
            {isLoadingAudio ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
             : isSpeaking    ? <VolumeX className="w-3.5 h-3.5" />
             :                 <Volume2 className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ── Period options ────────────────────────────────────────────────────────────
const PERIOD_OPTIONS = [
  { label: 'Últimos 7 dias', value: '7d' },
  { label: 'Últimos 30 dias', value: '30d' },
  { label: 'Últimos 90 dias', value: '90d' },
  { label: 'Este mês', value: 'month' },
  { label: 'Todos os dados', value: 'all' },
];

// ── Main component ────────────────────────────────────────────────────────────
export default function MobileBiPro() {
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations);
  const [activeConvId, setActiveConvId]   = useState<string | null>(loadActiveId);
  const [inputText, setInputText]         = useState('');
  const [isLoading, setIsLoading]         = useState(false);
  const [historyOpen, setHistoryOpen]       = useState(false);
  const [filtersOpen, setFiltersOpen]       = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [suggestions]                     = useState(() => pickRandom(ALL_SUGGESTIONS, 6));

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const autoPlayRef    = useRef<string | null>(null);
  const sendMessageRef = useRef<(text: string) => void>(() => {});

  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(() => localStorage.getItem('bipro-voice-id'));
  const [autoSpeak, setAutoSpeak]             = useState(() => localStorage.getItem('bipro-auto-speak') !== 'false');
  const [geminiVoiceOpen, setGeminiVoiceOpen] = useState(false);

  const speech = useSpeechRecognition();
  const { data: voices } = useElevenLabsVoices();
  const { pipelines } = usePipelines();
  const tts    = useElevenLabsTTS(selectedVoiceId);

  // Persist state
  useEffect(() => { saveConversations(conversations); }, [conversations]);
  useEffect(() => {
    if (selectedVoiceId !== null) localStorage.setItem('bipro-voice-id', selectedVoiceId);
    else localStorage.removeItem('bipro-voice-id');
  }, [selectedVoiceId]);
  useEffect(() => { localStorage.setItem('bipro-auto-speak', String(autoSpeak)); }, [autoSpeak]);
  useEffect(() => { saveActiveId(activeConvId); }, [activeConvId]);

  const activeConversation = conversations.find(c => c.id === activeConvId) ?? null;

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages, isLoading]);

  // Auto-play last assistant message (skip initial mount)
  const initialLoadRef = useRef(true);
  useEffect(() => {
    if (initialLoadRef.current) {
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
      // iOS: user already tapped mic (user gesture) — TTS play is allowed.
      // If blocked by autoplay policy, useElevenLabsTTS sets autoplayBlocked=true
      // and the "tap to hear" banner appears automatically.
      if (autoSpeak) tts.speak(markdownToVoiceText(last.content)).catch(() => { /* handled inside useElevenLabsTTS */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversation?.messages.length]);

  // Voice loop prevention: stop mic when TTS starts speaking
  useEffect(() => {
    if (tts.isPlaying && speech.isListening) {
      speech.stopListening();
    }
  }, [tts.isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fill input from speech transcript
  useEffect(() => {
    if (speech.transcript) setInputText(speech.transcript);
  }, [speech.transcript]);

  // Auto-send when speech ends with content
  useEffect(() => {
    if (!speech.isListening && speech.transcript.trim()) {
      const text = speech.transcript.trim();
      speech.setTranscript('');
      setInputText('');
      sendMessageRef.current(text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.isListening]);

  // Auto-dismiss speech error after 5s
  useEffect(() => {
    if (!speech.errorMsg) return;
    const timer = setTimeout(() => speech.clearError(), 5000);
    return () => clearTimeout(timer);
  }, [speech.errorMsg]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Conversation management ───────────────────────────────────────────────
  const createConversation = useCallback(() => {
    const id = crypto.randomUUID();
    setConversations(prev => [{ id, title: 'Nova Conversa', messages: [], createdAt: new Date() }, ...prev]);
    setActiveConvId(id);
    return id;
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvId === id) setActiveConvId(null);
  }, [activeConvId]);

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    let convId = activeConvId;
    if (!convId) convId = createConversation();

    const userMsg: Message = { role: 'user', content: text.trim(), createdAt: new Date() };

    const stripCharts = (t: string) => t.replace(/```chart\n[\s\S]*?```/g, '[gráfico gerado]');
    let history: Array<{ role: string; content: string }> = [];

    setConversations(prev => {
      const conv = prev.find(c => c.id === convId);
      history = (conv?.messages ?? []).slice(-20).map(m => ({
        role: m.role,
        content: m.role === 'assistant' ? stripCharts(m.content) : m.content,
      }));
      return prev.map(c =>
        c.id === convId
          ? { ...c, title: c.messages.length === 0 ? text.trim().slice(0, 45) : c.title, messages: [...c.messages, userMsg] }
          : c
      );
    });
    setInputText('');
    setIsLoading(true);

    try {
      const contextHint: Record<string, string> = {};
      if (selectedPeriod !== 'all') contextHint.period = selectedPeriod;
      if (selectedPipelineId) {
        const pipeline = pipelines.find(p => p.id === selectedPipelineId);
        if (pipeline) contextHint.pipeline = pipeline.nome || pipeline.name;
      }

      const { data, error } = await supabase.functions.invoke('bi-insights-chat', {
        body: { message: text.trim(), history, context_hint: contextHint },
      });

      if (error) throw error;

      setConversations(prev => prev.map(c =>
        c.id === convId
          ? { ...c, messages: [...c.messages, { role: 'assistant' as const, content: data?.response ?? 'Desculpe, não consegui processar sua pergunta.', createdAt: new Date() }] }
          : c
      ));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setConversations(prev => prev.map(c =>
        c.id === convId
          ? { ...c, messages: [...c.messages, { role: 'assistant' as const, content: `Erro ao chamar o assistente: ${errMsg}`, createdAt: new Date() }] }
          : c
      ));
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [activeConvId, createConversation, isLoading, selectedPeriod, selectedPipelineId, pipelines]);

  sendMessageRef.current = sendMessage;

  // ── Voice toggle ──────────────────────────────────────────────────────────
  const toggleVoice = () => {
    if (tts.isPlaying) {
      tts.stop();
      setTimeout(() => { speech.clearError(); speech.startListening(); }, 300);
      return;
    }
    if (speech.isListening) speech.stopListening();
    else { speech.clearError(); speech.startListening(); }
  };

  const hasMessages = (activeConversation?.messages.length ?? 0) > 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">

      {/* ── Inner header ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-foreground leading-none truncate">
              {activeConversation?.title ?? 'Insights AI'}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Pergunte sobre funil, vendas e mais</p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setFiltersOpen(true)}
            aria-label="Filtros"
            className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors relative"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {(selectedPeriod !== 'all' || selectedPipelineId !== null) && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
            )}
          </button>
          <button
            onClick={() => setHistoryOpen(true)}
            aria-label="Histórico de conversas"
            className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors relative"
          >
            <History className="w-4 h-4" />
            {conversations.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
            )}
          </button>
          <button
            onClick={createConversation}
            aria-label="Nova conversa"
            className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Messages area ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {!hasMessages ? (
          /* Welcome screen */
          <div className="flex flex-col items-center justify-center h-full gap-6 px-6 py-8">
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.1 }}
            >
              <div className="w-14 h-14 rounded-md bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="text-center space-y-2 max-w-xs"
            >
              <h2 className="text-lg font-semibold text-foreground tracking-tight">Insights AI</h2>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Pergunte qualquer coisa sobre seus dados — funil, mensagens, agendamentos, calls e prospecção.
              </p>
            </motion.div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 px-4 py-4">
            <AnimatePresence initial={false}>
              {activeConversation?.messages.map((msg, i) => (
                <MessageBubble
                  key={`${msg.createdAt.getTime()}-${i}`}
                  message={msg}
                  index={i}
                  onSpeak={text => tts.speak(markdownToVoiceText(text))}
                  isSpeaking={tts.isPlaying}
                  isLoadingAudio={false}
                />
              ))}
            </AnimatePresence>
            {isLoading && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
                <div className="bg-card border border-border rounded-lg rounded-tl-sm">
                  <LoadingDots />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── Suggestion chips (horizontal scroll) ─────────────────── */}
      {!hasMessages && (
        <div className="flex-shrink-0 px-0 pb-1">
          <div className="flex overflow-x-auto gap-2 px-4 py-2 scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
            {suggestions.map(s => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="flex-shrink-0 text-[12px] text-muted-foreground border border-border bg-card rounded-full px-3.5 py-1.5 hover:border-primary/40 hover:text-foreground hover:bg-primary/[0.03] transition-all whitespace-nowrap"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Speech error toast ────────────────────────────────────── */}
      <AnimatePresence>
        {speech.errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="flex-shrink-0 mx-4 mb-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-md text-[12px] text-destructive"
          >
            {speech.errorMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Autoplay blocked banner (iOS Safari) ─────────────────── */}
      <AnimatePresence>
        {tts.autoplayBlocked && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onClick={tts.resumeFromAutoplayBlock}
            className="flex-shrink-0 mx-4 mb-2 flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-md text-[12px] text-primary hover:bg-primary/15 transition-colors w-[calc(100%-2rem)]"
            aria-label="Toque para ouvir a resposta"
          >
            <Volume2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Toque para ouvir a resposta</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Input bar ─────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 bg-background border-t border-border px-3 py-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
      >
        <div className="flex items-end gap-2">
          {/* Gemini Live — real-time voice conversation */}
          <button
            onClick={() => setGeminiVoiceOpen(true)}
            aria-label="Conversa por voz com Gemini"
            className="h-11 w-11 flex-shrink-0 flex items-center justify-center rounded-full bg-white border border-[#4285F4]/40 shadow-sm active:scale-95 transition-all"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          </button>

          {/* Mic — voice-to-text for chat */}
          {speech.supported ? (
            <button
              onClick={toggleVoice}
              disabled={speech.status === 'requesting'}
              aria-label={speech.isListening ? "Parar gravação" : "Gravar voz"}
              className={cn(
                "h-11 w-11 flex-shrink-0 flex items-center justify-center rounded-full transition-all",
                speech.isListening
                  ? "bg-red-500 text-white shadow-lg shadow-red-500/25"
                  : speech.status === 'requesting'
                    ? "bg-muted text-muted-foreground cursor-wait"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {speech.status === 'requesting' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : speech.isListening ? (
                <VoicePulse />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>
          ) : null}

          {/* Text input */}
          <div className="flex-1 flex items-end gap-2 bg-muted rounded-[12px] px-3 py-2.5 min-h-[44px]">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(inputText); }
              }}
              placeholder={speech.isListening ? "Ouvindo..." : "Pergunte sobre seus dados..."}
              rows={1}
              className="flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground resize-none outline-none leading-[1.4] max-h-[120px] self-center"
              style={{ scrollbarWidth: 'none' }}
            />
            <button
              onClick={() => sendMessage(inputText)}
              disabled={!inputText.trim() || isLoading}
              aria-label="Enviar mensagem"
              className={cn(
                "flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-all",
                inputText.trim() && !isLoading
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "bg-muted-foreground/20 text-muted-foreground/40 cursor-not-allowed"
              )}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Gemini Live voice drawer ──────────────────────────────── */}
      <MobileGeminiVoice
        open={geminiVoiceOpen}
        onClose={() => setGeminiVoiceOpen(false)}
      />

      {/* ── History drawer ────────────────────────────────────────── */}
      <Drawer open={historyOpen} onOpenChange={setHistoryOpen}>
        <DrawerContent className="max-h-[70vh]">
          <DrawerHeader className="border-b border-border pb-3">
            <DrawerTitle className="text-[15px]">Histórico de conversas</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto flex-1 px-2 py-2">
            <button
              onClick={() => { createConversation(); setHistoryOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] border border-border rounded-md text-foreground hover:bg-muted transition-colors mb-3"
            >
              <Plus className="w-4 h-4" />
              Nova conversa
            </button>
            {conversations.length === 0 ? (
              <div className="py-8 text-center">
                <MessageSquare className="w-6 h-6 mx-auto mb-2 text-muted-foreground/20" />
                <p className="text-[12px] text-muted-foreground/40">Nenhuma conversa ainda</p>
              </div>
            ) : (
              <div className="space-y-1">
                {conversations.map(conv => (
                  <div key={conv.id} className="group flex items-center gap-2 relative">
                    <button
                      onClick={() => { setActiveConvId(conv.id); setHistoryOpen(false); }}
                      className={cn(
                        "flex-1 text-left px-3 py-2.5 text-[13px] rounded-md transition-colors truncate",
                        conv.id === activeConvId
                          ? "bg-muted text-foreground font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <span className="block truncate">{conv.title}</span>
                      <span className="text-[11px] text-muted-foreground/50 block mt-0.5">
                        {conv.createdAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </span>
                    </button>
                    <button
                      onClick={() => deleteConversation(conv.id)}
                      className="flex-shrink-0 p-2 opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-destructive transition-all"
                      aria-label="Deletar conversa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* ── Filters drawer ────────────────────────────────────────── */}
      <Drawer open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DrawerContent>
          <DrawerHeader className="border-b border-border pb-3">
            <DrawerTitle className="text-[15px]">Filtros</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 py-4 space-y-5 overflow-y-auto">
            {/* Period */}
            <div>
              <p className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Período</p>
              <div className="space-y-1">
                {PERIOD_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedPeriod(opt.value)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-md text-[13px] transition-colors flex items-center justify-between",
                      selectedPeriod === opt.value
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {opt.label}
                    {selectedPeriod === opt.value && <span className="text-[10px] opacity-70">✓</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Audio */}
            <div>
              <p className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Volume2 className="w-3 h-3" />
                Áudio
              </p>
              <button
                onClick={() => setAutoSpeak(v => !v)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-md text-[13px] transition-colors",
                  autoSpeak ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                Narração automática de respostas
                {autoSpeak && <span className="text-[10px] opacity-70">✓</span>}
              </button>
              {tts.isElevenLabs && voices && voices.length > 0 && (
                <div className="mt-1 space-y-1">
                  <p className="text-[11px] text-muted-foreground/50 px-3 pt-1">Voz do assistente</p>
                  <button
                    onClick={() => setSelectedVoiceId(null)}
                    className={cn("w-full text-left px-3 py-2.5 rounded-md text-[13px] transition-colors flex items-center justify-between", !selectedVoiceId ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted")}
                  >
                    Voz padrão
                    {!selectedVoiceId && <span className="text-[10px] opacity-70">✓</span>}
                  </button>
                  {voices.map(v => (
                    <button
                      key={v.voice_id}
                      onClick={() => setSelectedVoiceId(v.voice_id)}
                      className={cn("w-full text-left px-3 py-2.5 rounded-md text-[13px] transition-colors flex items-center justify-between", selectedVoiceId === v.voice_id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted")}
                    >
                      {v.name}{v.language && <span className="ml-1 text-[11px] opacity-60">({v.language})</span>}
                      {selectedVoiceId === v.voice_id && <span className="text-[10px] opacity-70">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Pipeline */}
            {pipelines.length > 0 && (
              <div>
                <p className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <GitBranch className="w-3 h-3" />
                  Pipeline
                </p>
                <div className="space-y-1">
                  <button
                    onClick={() => setSelectedPipelineId(null)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-md text-[13px] transition-colors flex items-center justify-between",
                      selectedPipelineId === null
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    Todos os pipelines
                    {selectedPipelineId === null && <span className="text-[10px] opacity-70">✓</span>}
                  </button>
                  {pipelines.map(pipeline => (
                    <button
                      key={pipeline.id}
                      onClick={() => setSelectedPipelineId(pipeline.id)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 rounded-md text-[13px] transition-colors flex items-center justify-between",
                        selectedPipelineId === pipeline.id
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {pipeline.nome || pipeline.name}
                      {selectedPipelineId === pipeline.id && <span className="text-[10px] opacity-70">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="px-4 pb-6">
            <Button
              onClick={() => setFiltersOpen(false)}
              className="w-full"
            >
              Aplicar filtros
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

    </div>
  );
}
