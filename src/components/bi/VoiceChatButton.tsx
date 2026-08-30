import { useState, useCallback, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, MessageSquare, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSettings } from '@/hooks/useSettings';
import { useGeminiLive } from '@/hooks/useGeminiLive';
import { BI_VOICE_TOOLS, executeBiTool } from '@/lib/voice/biTools';
import { GEMINI_BI_SYSTEM_INSTRUCTION } from '@/constants/gemini-bi-instructions';
import { supabase } from '@/integrations/supabase/client';
import type { GeminiLiveState } from '@/types/gemini-live';

// ── Types ─────────────────────────────────────────────────────────────────────

interface VoiceChatButtonProps {
  /** Called when user clicks "Chat texto" — caller handles opening text chat */
  onSwitchToText?: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function isMicSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined' &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof AudioContext !== 'undefined'
  );
}

const STATE_LABELS: Record<GeminiLiveState, string> = {
  idle:         'Toque para falar',
  connecting:   'Conectando...',
  listening:    'Ouvindo...',
  thinking:     'Pensando...',
  speaking:     'Respondendo...',
  processing:   'Buscando dados...',
  reconnecting: 'Reconectando...',
  error:        'Erro na conexão',
};

// ── Telemetria (fire-and-forget) ───────────────────────────────────────────────

async function logSession(payload: {
  started_at: string;
  ended_at?: string;
  error_msg?: string;
}): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: settings } = await supabase
      .from('settings')
      .select('id')
      .limit(1)
      .maybeSingle();
    if (!settings?.id) return;
    await supabase.from('bi_voice_session_log').insert({
      tenant_id: settings.id,
      user_id: user?.id ?? null,
      ...payload,
    });
  } catch {
    // telemetry non-critical
  }
}

// ── VoiceWaveform ──────────────────────────────────────────────────────────────

function VoiceWaveform({ active }: { active: boolean }) {
  const bars = 16;
  return (
    <div className="flex items-center justify-center gap-[3px] h-10" aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'w-[3px] rounded-full bg-primary transition-all duration-100',
            active ? 'animate-voice-bar' : 'opacity-30',
          )}
          style={{
            height: active ? undefined : '4px',
            minHeight: '4px',
            maxHeight: '40px',
            animationDelay: active ? `${((i / bars) * 0.8).toFixed(2)}s` : undefined,
          }}
        />
      ))}
    </div>
  );
}

// ── Transcript area ────────────────────────────────────────────────────────────

function TranscriptArea({ partial, finals }: { partial: string; finals: string[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const hasContent = partial.length > 0 || finals.length > 0;

  useEffect(() => {
    if (finals.length > 0 && !expanded) setExpanded(true);
  }, [finals.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (expanded) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [partial, finals.length, expanded]);

  if (!hasContent) return null;

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between px-1 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>Transcrição</span>
        <span>{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div
          className="max-h-[200px] overflow-y-auto rounded-md border bg-muted/40 p-3 text-sm"
          aria-live="polite"
          aria-label="Transcrição da conversa por voz"
        >
          {finals.map((line, i) => (
            <p key={i} className="mb-1 text-foreground leading-relaxed">{line}</p>
          ))}
          {partial && <p className="italic text-muted-foreground">{partial}</p>}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}

// ── Error display ──────────────────────────────────────────────────────────────

function VoiceErrorDisplay({ code, message }: { code: string; message?: string }) {
  if (code === 'NO_SUPPORT') {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border border-muted p-4 text-center text-sm w-full">
        <MicOff className="h-5 w-5 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">
          Microfone ou Web Audio não suportado neste navegador.
        </p>
      </div>
    );
  }

  if (code === 'GEMINI_NOT_CONFIGURED' || message?.includes('412')) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-center text-sm w-full">
        <AlertCircle className="h-5 w-5 text-destructive" />
        <p className="text-destructive font-medium">Gemini API não configurada</p>
        <a
          href="/settings/general/ai-providers"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground underline"
        >
          Configurações → IA Providers <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    );
  }

  if (code === 'RATE_LIMITED' || message?.includes('429')) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border border-amber-400/40 bg-amber-400/5 p-4 text-center text-sm w-full">
        <AlertCircle className="h-5 w-5 text-amber-600" />
        <p className="text-amber-700 font-medium">Limite de uso atingido</p>
        <p className="text-muted-foreground text-xs">Tente novamente em alguns minutos.</p>
      </div>
    );
  }

  if (code === 'NotAllowedError' || message?.toLowerCase().includes('denied')) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border border-muted p-4 text-center text-sm w-full">
        <MicOff className="h-5 w-5 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">
          Permissão de microfone negada. Habilite nas configurações do navegador.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-center text-sm w-full">
      <AlertCircle className="h-5 w-5 text-destructive" />
      <p className="text-destructive text-xs">{message ?? 'Erro de conexão. Tente novamente.'}</p>
    </div>
  );
}

// ── Central mic button ─────────────────────────────────────────────────────────

function MicButton({
  voiceState,
  isMuted,
  disabled,
  onClick,
}: {
  voiceState: GeminiLiveState;
  isMuted: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const isListening = voiceState === 'listening';
  const isSpeaking = voiceState === 'speaking';
  const isProcessing =
    voiceState === 'connecting' ||
    voiceState === 'thinking' ||
    voiceState === 'processing' ||
    voiceState === 'reconnecting';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={
        voiceState === 'idle' || voiceState === 'error'
          ? 'Iniciar conversa por voz'
          : 'Parar conversa por voz'
      }
      aria-pressed={isListening || isSpeaking}
      className={cn(
        'relative flex h-16 w-16 items-center justify-center rounded-full transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        (voiceState === 'idle' || voiceState === 'error') &&
          'bg-primary text-primary-foreground hover:bg-primary/90',
        isProcessing && 'bg-muted text-muted-foreground cursor-wait',
        isListening && cn(
          'bg-primary text-primary-foreground',
          isMuted && 'ring-4 ring-destructive ring-offset-2',
        ),
        isSpeaking && 'bg-emerald-500 text-white',
      )}
    >
      {isListening && !isMuted && (
        <>
          <span
            className="absolute inset-0 rounded-full bg-primary/25 animate-voice-pulse"
            aria-hidden="true"
          />
          <span
            className="absolute inset-0 rounded-full bg-primary/15 animate-voice-pulse [animation-delay:0.75s]"
            aria-hidden="true"
          />
        </>
      )}

      {isProcessing ? (
        <Loader2 className="h-7 w-7 animate-spin" />
      ) : isSpeaking ? (
        <Volume2 className="h-7 w-7" />
      ) : isMuted ? (
        <MicOff className="h-7 w-7" />
      ) : (
        <Mic className="h-7 w-7" />
      )}
    </button>
  );
}

// ── Modal content ──────────────────────────────────────────────────────────────

function VoiceModalContent({
  voiceState,
  isMuted,
  transcript,
  noMicSupport,
  error,
  onToggleMic,
  onToggleMute,
  onSwitchToText,
  onClose,
}: {
  voiceState: GeminiLiveState;
  isMuted: boolean;
  transcript: { partial: string; final: string[] };
  noMicSupport: boolean;
  error: { code: string; message: string } | null;
  onToggleMic: () => void;
  onToggleMute: () => void;
  onSwitchToText?: () => void;
  onClose: () => void;
}) {
  const isIdle = voiceState === 'idle' || voiceState === 'error';
  const micDisabled =
    noMicSupport || voiceState === 'connecting' || voiceState === 'reconnecting';

  return (
    <div className="flex flex-col items-center gap-5 px-4 pb-8 pt-2">
      {noMicSupport && <VoiceErrorDisplay code="NO_SUPPORT" />}
      {!noMicSupport && error && (
        <VoiceErrorDisplay code={error.code} message={error.message} />
      )}

      <VoiceWaveform active={voiceState === 'speaking'} />

      <MicButton
        voiceState={voiceState}
        isMuted={isMuted}
        disabled={micDisabled}
        onClick={onToggleMic}
      />

      <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
        {noMicSupport ? '' : STATE_LABELS[voiceState]}
      </p>

      <TranscriptArea partial={transcript.partial} finals={transcript.final} />

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleMute}
          disabled={isIdle || noMicSupport}
          aria-label={isMuted ? 'Desmutar microfone' : 'Mutar microfone'}
          aria-pressed={isMuted}
          className={cn(isMuted && 'border-destructive text-destructive hover:border-destructive')}
        >
          {isMuted ? (
            <MicOff className="mr-1.5 h-4 w-4" />
          ) : (
            <Mic className="mr-1.5 h-4 w-4" />
          )}
          {isMuted ? 'Desmutado' : 'Mutar'}
        </Button>

        {onSwitchToText && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onClose();
              onSwitchToText();
            }}
          >
            <MessageSquare className="mr-1.5 h-4 w-4" />
            Chat texto
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function VoiceChatButton({ onSwitchToText }: VoiceChatButtonProps) {
  const isMobile = useIsMobile();
  const { data: settings } = useSettings();
  const [open, setOpen] = useState(false);
  const sessionStartRef = useRef<string | null>(null);
  const noMicSupport = !isMicSupported();
  const betaEnabled = settings?.bi_voice_chat_beta_enabled ?? false;

  const { state, transcript, isMuted, error, start, stop, mute, unmute } = useGeminiLive({
    systemInstruction: GEMINI_BI_SYSTEM_INSTRUCTION,
    tools: [BI_VOICE_TOOLS],
    onToolCall: useCallback(async (call) => {
      const result = await executeBiTool(call.name, call.args, supabase, settings?.id);
      const first = result.functionResponses[0];
      return { id: call.id, name: first.name, response: first.response };
    }, [settings?.id]),
  });

  // Telemetria: log session start/end
  useEffect(() => {
    if (state === 'listening' && !sessionStartRef.current) {
      sessionStartRef.current = new Date().toISOString();
      void logSession({ started_at: sessionStartRef.current });
    }
    if ((state === 'idle' || state === 'error') && sessionStartRef.current) {
      void logSession({
        started_at: sessionStartRef.current,
        ended_at: new Date().toISOString(),
        error_msg: state === 'error' ? (error?.message ?? undefined) : undefined,
      });
      sessionStartRef.current = null;
    }
  }, [state, error]);

  const handleOpenChange = useCallback((next: boolean) => {
    if (!next && state !== 'idle' && state !== 'error') stop();
    setOpen(next);
  }, [state, stop]);

  const handleToggleMic = useCallback(() => {
    if (noMicSupport) return;
    if (state === 'idle' || state === 'error') void start();
    else stop();
  }, [noMicSupport, state, start, stop]);

  const handleToggleMute = useCallback(() => {
    if (isMuted) unmute();
    else mute();
  }, [isMuted, mute, unmute]);

  const modalTitle = (
    <span className="flex items-center gap-2">
      Assistente de voz · Gemini
      <Badge
        variant="outline"
        className="border-amber-400 text-amber-600 text-[10px] px-1.5 py-0 shrink-0"
      >
        BETA
      </Badge>
    </span>
  );

  const modalContent = (
    <VoiceModalContent
      voiceState={state}
      isMuted={isMuted}
      transcript={transcript}
      noMicSupport={noMicSupport}
      error={error}
      onToggleMic={handleToggleMic}
      onToggleMute={handleToggleMute}
      onSwitchToText={onSwitchToText}
      onClose={() => handleOpenChange(false)}
    />
  );

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Iniciar conversa por voz com Gemini"
            className={cn(
              'fixed z-40 flex items-center gap-2 rounded-full shadow-xl px-4',
              'bg-white border-2 border-[#4285F4] text-[#4285F4]',
              'hover:bg-[#4285F4] hover:text-white active:scale-95',
              'transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4285F4] focus-visible:ring-offset-2',
              'bottom-6 right-6 h-14',
              isMobile && 'bottom-20 right-4 h-12 px-3',
            )}
          >
            {/* Google G logo via SVG */}
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <Mic className="h-5 w-5 shrink-0" />
            {!isMobile && <span className="text-[13px] font-semibold whitespace-nowrap">Gemini Voz</span>}
            <span className="absolute -top-1.5 -right-1 rounded-full bg-amber-400 px-1.5 text-[9px] font-bold text-white leading-4">
              BETA
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>Conversa por voz em tempo real com Gemini Flash</p>
        </TooltipContent>
      </Tooltip>

      {isMobile ? (
        <Drawer open={open} onOpenChange={handleOpenChange}>
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle>{modalTitle}</DrawerTitle>
            </DrawerHeader>
            {modalContent}
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent className="max-w-sm" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>{modalTitle}</DialogTitle>
            </DialogHeader>
            {modalContent}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
