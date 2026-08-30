import { useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MicOff, X, AlertCircle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { useGeminiLive } from '@/hooks/useGeminiLive';
import { BI_VOICE_TOOLS, executeBiTool } from '@/lib/voice/biTools';
import { GEMINI_BI_SYSTEM_INSTRUCTION } from '@/constants/gemini-bi-instructions';
import { supabase } from '@/integrations/supabase/client';
import type { GeminiLiveState } from '@/types/gemini-live';

// ── Orb animation ──────────────────────────────────────────────────────────────

const ORB_STATE: Record<GeminiLiveState, { color: string; ring: string; pulse: boolean; wave: boolean }> = {
  idle:         { color: 'bg-muted',             ring: 'ring-border',          pulse: false, wave: false },
  connecting:   { color: 'bg-[#4285F4]/20',      ring: 'ring-[#4285F4]/30',   pulse: true,  wave: false },
  reconnecting: { color: 'bg-[#4285F4]/20',      ring: 'ring-[#4285F4]/30',   pulse: true,  wave: false },
  listening:    { color: 'bg-[#4285F4]',         ring: 'ring-[#4285F4]/40',   pulse: true,  wave: false },
  thinking:     { color: 'bg-[#FBBC05]/80',      ring: 'ring-[#FBBC05]/40',   pulse: true,  wave: false },
  processing:   { color: 'bg-[#FBBC05]/80',      ring: 'ring-[#FBBC05]/40',   pulse: true,  wave: false },
  speaking:     { color: 'bg-[#34A853]',         ring: 'ring-[#34A853]/40',   pulse: false, wave: true  },
  error:        { color: 'bg-destructive/20',    ring: 'ring-destructive/30',  pulse: false, wave: false },
};

const STATE_LABELS: Record<GeminiLiveState, string> = {
  idle:         'Toque para falar',
  connecting:   'Conectando...',
  reconnecting: 'Reconectando...',
  listening:    'Ouvindo você...',
  thinking:     'Pensando...',
  processing:   'Buscando dados...',
  speaking:     'Respondendo...',
  error:        'Erro na conexão',
};

function VoiceOrb({ state, isMuted }: { state: GeminiLiveState; isMuted: boolean }) {
  const cfg = ORB_STATE[state];

  return (
    <div className="relative flex items-center justify-center w-36 h-36">
      {/* Outer pulse rings */}
      {cfg.pulse && (
        <>
          <motion.div
            className={cn('absolute inset-0 rounded-full', cfg.color, 'opacity-20')}
            animate={{ scale: [1, 1.35, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className={cn('absolute inset-0 rounded-full', cfg.color, 'opacity-10')}
            animate={{ scale: [1, 1.6, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
          />
        </>
      )}

      {/* Main orb */}
      <motion.div
        className={cn(
          'relative w-24 h-24 rounded-full ring-2 flex items-center justify-center',
          cfg.color, cfg.ring,
          'transition-colors duration-300',
        )}
        animate={cfg.wave ? { scale: [1, 1.06, 0.97, 1.04, 1] } : { scale: 1 }}
        transition={cfg.wave ? { duration: 0.8, repeat: Infinity, ease: 'easeInOut' } : {}}
      >
        {/* Google G logo */}
        <svg viewBox="0 0 24 24" className={cn('w-10 h-10', state === 'listening' || state === 'speaking' ? 'opacity-90' : 'opacity-50')} aria-hidden="true">
          <path fill={state === 'listening' || state === 'speaking' ? '#fff' : '#4285F4'} d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill={state === 'listening' || state === 'speaking' ? '#fff' : '#34A853'} d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill={state === 'listening' || state === 'speaking' ? '#fff' : '#FBBC05'} d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill={state === 'listening' || state === 'speaking' ? '#fff' : '#EA4335'} d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>

        {/* Muted indicator overlay */}
        {isMuted && (
          <div className="absolute inset-0 rounded-full bg-destructive/30 flex items-center justify-center">
            <MicOff className="w-6 h-6 text-destructive" />
          </div>
        )}
      </motion.div>

      {/* Speaking waveform bars around orb */}
      {cfg.wave && !isMuted && (
        <div className="absolute inset-0 flex items-center justify-center">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 rounded-full bg-[#34A853]/60"
              style={{
                height: 10,
                transformOrigin: 'center',
                rotate: `${i * 45}deg`,
                translateX: 52,
              }}
              animate={{ height: [6, 16, 6] }}
              transition={{
                duration: 0.5,
                repeat: Infinity,
                delay: i * 0.07,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Transcript display ─────────────────────────────────────────────────────────

function TranscriptList({ lines }: { lines: string[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines.length]);

  if (lines.length === 0) return null;

  return (
    <div className="w-full max-h-40 overflow-y-auto rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-1.5">
      {lines.map((line, i) => (
        <p key={i} className="text-[13px] text-muted-foreground leading-relaxed">{line}</p>
      ))}
      <div ref={endRef} />
    </div>
  );
}

// ── Error display ──────────────────────────────────────────────────────────────

function VoiceError({ code, message }: { code: string; message?: string }) {
  if (code === 'NotAllowedError' || message?.toLowerCase().includes('denied')) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 text-center">
        <MicOff className="w-5 h-5 text-muted-foreground" />
        <p className="text-[13px] text-muted-foreground">Permissão de microfone negada. Habilite nas configurações do navegador.</p>
      </div>
    );
  }
  if (code === 'CSP_BLOCKED' || message?.toLowerCase().includes('csp') || message?.toLowerCase().includes('not allowed by')) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 text-center">
        <AlertCircle className="w-5 h-5 text-destructive" />
        <p className="text-[13px] text-destructive font-medium">Conexão bloqueada pelo navegador</p>
        <p className="text-[11px] text-muted-foreground font-mono bg-muted/50 px-2 py-1 rounded">{message}</p>
      </div>
    );
  }
  if (code === 'gemini_not_configured') {
    return (
      <div className="flex flex-col items-center gap-2 px-6 text-center">
        <AlertCircle className="w-5 h-5 text-destructive" />
        <p className="text-[13px] text-destructive font-medium">Gemini API não configurada</p>
        <a href="/settings/general/ai-providers" className="text-xs text-muted-foreground underline flex items-center gap-1">
          Configurações → IA Providers <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2 px-6 text-center">
      <AlertCircle className="w-5 h-5 text-destructive" />
      <p className="text-[13px] text-destructive">{message ?? 'Erro de conexão'}</p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface MobileGeminiVoiceProps {
  open: boolean;
  onClose: () => void;
}

export function MobileGeminiVoice({ open, onClose }: MobileGeminiVoiceProps) {
  const { state, transcript, isMuted, error, start, stop, mute, unmute } = useGeminiLive({
    systemInstruction: GEMINI_BI_SYSTEM_INSTRUCTION,
    tools: [BI_VOICE_TOOLS],
    onToolCall: useCallback(async (call) => {
      const result = await executeBiTool(call.name, call.args, supabase);
      const first = result.functionResponses[0];
      return { id: call.id, name: first.name, response: first.response };
    }, []),
  });

  // Auto-start when drawer opens, auto-stop when it closes
  useEffect(() => {
    if (open && (state === 'idle' || state === 'error')) {
      void start();
    }
    if (!open && state !== 'idle') {
      stop();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenChange = useCallback((next: boolean) => {
    if (!next) {
      stop();
      onClose();
    }
  }, [stop, onClose]);

  const handleMicToggle = useCallback(() => {
    if (state === 'idle' || state === 'error') {
      void start();
    } else if (isMuted) {
      unmute();
    } else {
      mute();
    }
  }, [state, isMuted, start, mute, unmute]);

  const isActive = state !== 'idle' && state !== 'error';
  const isProcessing = state === 'connecting' || state === 'reconnecting';

  const allTranscriptLines = [
    ...(transcript.final),
    ...(transcript.partial ? [transcript.partial] : []),
  ];

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent
        className="focus:outline-none"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-1">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-foreground">Gemini Voz</span>
            <span className="text-[9px] font-bold bg-amber-400 text-white px-1.5 py-0.5 rounded-full leading-none">
              BETA
            </span>
          </div>
          <button
            onClick={() => { stop(); onClose(); }}
            className="p-2 -mr-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main area */}
        <div className="flex flex-col items-center gap-6 px-5 py-8">
          {/* Orb */}
          <VoiceOrb state={state} isMuted={isMuted} />

          {/* State label */}
          <AnimatePresence mode="wait">
            <motion.p
              key={state}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'text-[15px] font-medium tracking-tight',
                state === 'error' ? 'text-destructive' : 'text-foreground',
              )}
            >
              {STATE_LABELS[state]}
            </motion.p>
          </AnimatePresence>

          {/* Error detail */}
          {state === 'error' && error && (
            <VoiceError code={error.code} message={error.message} />
          )}

          {/* Transcript */}
          <TranscriptList lines={allTranscriptLines} />
        </div>

        {/* Controls */}
        <div
          className="flex items-center justify-center gap-5 px-5 pb-8"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}
        >
          {/* Mute/unmute */}
          <button
            onClick={handleMicToggle}
            disabled={isProcessing}
            aria-label={isMuted ? 'Desmutar' : 'Mutar microfone'}
            className={cn(
              'flex flex-col items-center gap-1.5',
              isProcessing && 'opacity-40 cursor-not-allowed',
            )}
          >
            <div className={cn(
              'w-14 h-14 rounded-full flex items-center justify-center transition-all',
              !isActive
                ? 'bg-primary text-primary-foreground shadow-lg'
                : isMuted
                  ? 'bg-destructive/10 ring-2 ring-destructive text-destructive'
                  : 'bg-muted text-muted-foreground',
            )}>
              {!isActive ? (
                <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden="true">
                  <path fill="currentColor" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zm-1 3a1 1 0 0 1 2 0v8a1 1 0 0 1-2 0V4zm6 8a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V21h-2v2h6v-2h-2v-2.07A7 7 0 0 0 19 12h-2z"/>
                </svg>
              ) : isMuted ? (
                <MicOff className="w-6 h-6" />
              ) : (
                <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden="true">
                  <path fill="currentColor" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zm-1 3a1 1 0 0 1 2 0v8a1 1 0 0 1-2 0V4zm6 8a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V21h-2v2h6v-2h-2v-2.07A7 7 0 0 0 19 12h-2z"/>
                </svg>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground">
              {!isActive ? 'Iniciar' : isMuted ? 'Desmutar' : 'Mutar'}
            </span>
          </button>

          {/* Stop session */}
          {isActive && (
            <button
              onClick={() => { stop(); onClose(); }}
              aria-label="Encerrar sessão de voz"
              className="flex flex-col items-center gap-1.5"
            >
              <div className="w-14 h-14 rounded-full bg-destructive/10 ring-2 ring-destructive/30 flex items-center justify-center text-destructive">
                <X className="w-6 h-6" />
              </div>
              <span className="text-[11px] text-muted-foreground">Encerrar</span>
            </button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
