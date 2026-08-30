import { useState } from "react";
import { motion } from "framer-motion";
import { Volume2, VolumeOff, ChevronDown, Loader2, Square, AlertCircle, RefreshCw, Timer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useElevenLabsVoices } from "@/hooks/useElevenLabsConfig";
import { VoicePicker } from "./VoicePicker";
import type { useElevenLabsTTS } from "@/hooks/useElevenLabsTTS";

// ── Speaking waveform ─────────────────────────────────────────────────────────
function SpeakingOrb() {
  return (
    <div className="flex items-center gap-[2px] h-4">
      {[0, 1, 2, 3, 4, 5, 6].map(i => (
        <motion.div key={i}
          className="w-[2px] rounded-full bg-violet-500"
          animate={{ height: ['4px', `${10 + Math.random() * 8}px`, '4px'] }}
          transition={{ duration: 0.4 + Math.random() * 0.3, repeat: Infinity, delay: i * 0.06, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface VoicePlayerBarProps {
  tts: ReturnType<typeof useElevenLabsTTS>;
  selectedVoiceId: string | null;
  onVoiceChange: (voiceId: string | null) => void;
  autoSpeak: boolean;
  onAutoSpeakChange: (enabled: boolean) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VoicePlayerBar({
  tts,
  selectedVoiceId,
  onVoiceChange,
  autoSpeak,
  onAutoSpeakChange,
}: VoicePlayerBarProps) {
  const navigate = useNavigate();
  const [voicePickerOpen, setVoicePickerOpen] = useState(false);
  const { data: voices } = useElevenLabsVoices();

  const selectedVoiceName = voices?.find(v => v.voice_id === selectedVoiceId)?.name;

  return (
    <div className="flex items-center gap-3" aria-live="polite">
      {/* ── Auto-speak toggle ──── */}
      <button
        onClick={() => onAutoSpeakChange(!autoSpeak)}
        title={autoSpeak ? 'Desativar narração automática' : 'Ativar narração automática'}
        aria-label={autoSpeak ? 'Desativar narração automática' : 'Ativar narração automática'}
        aria-pressed={autoSpeak}
        className={cn(
          "p-1 rounded-[4px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          autoSpeak ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground/40 hover:text-muted-foreground'
        )}
      >
        {autoSpeak ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeOff className="w-3.5 h-3.5" />}
      </button>

      {/* ── Voice selector ──── */}
      <div className="relative">
        <button
          aria-label="Selecionar voz"
          aria-haspopup="listbox"
          aria-expanded={voicePickerOpen}
          onClick={() => {
            if (!tts.isElevenLabs) {
              navigate('/settings/general/integracoes');
              return;
            }
            setVoicePickerOpen(!voicePickerOpen);
          }}
          title={!tts.isElevenLabs ? "Configure ElevenLabs em Configurações para voz premium" : undefined}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 text-[12px] rounded-[4px] transition-colors",
            tts.isElevenLabs
              ? "text-muted-foreground hover:text-foreground hover:bg-muted"
              : "text-muted-foreground/50 hover:text-muted-foreground cursor-help"
          )}
        >
          <Volume2 className="w-3 h-3 shrink-0" />
          <span className="max-w-[140px] truncate">
            {tts.isElevenLabs
              ? `Voz: ${selectedVoiceName || 'Voz padrão'}`
              : 'Voz do navegador'}
          </span>
          <ChevronDown className="w-2.5 h-2.5 shrink-0" />
        </button>

        {voicePickerOpen && tts.isElevenLabs && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setVoicePickerOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-50">
              <VoicePicker
                selectedVoiceId={selectedVoiceId}
                onChange={(id) => { onVoiceChange(id); }}
                onClose={() => setVoicePickerOpen(false)}
              />
            </div>
          </>
        )}
      </div>

      {/* ── Speed control ──── */}
      {(tts.isPlaying || tts.isLoadingAudio) && (
        <div
          className="flex items-center border border-border rounded-[4px] overflow-hidden"
          role="group"
          aria-label="Velocidade de reprodução"
        >
          {([0.75, 1, 1.25, 1.5] as const).map(rate => (
            <button
              key={rate}
              onClick={() => tts.setPlaybackRate(rate)}
              aria-label={`Velocidade ${rate} vezes`}
              aria-pressed={tts.playbackRate === rate}
              className={cn(
                "px-1.5 py-0.5 text-[10px] transition-colors border-r border-border last:border-r-0",
                tts.playbackRate === rate
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground/50 hover:text-foreground hover:bg-muted"
              )}
            >
              {rate}×
            </button>
          ))}
        </div>
      )}

      {/* ── Status indicator / stop button / error ──── */}
      <div role="status" aria-atomic="true">
        {tts.isPlaying ? (
          <div className="flex items-center gap-2">
            <button
              onClick={tts.stop}
              aria-label="Parar narração"
              className="flex items-center gap-1.5 cursor-pointer rounded-[4px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Square className="w-3 h-3 text-violet-500 fill-violet-500" />
              <SpeakingOrb />
              <span className="text-[10px] text-violet-500 font-medium">
                {tts.isElevenLabs
                  ? (selectedVoiceName || 'ElevenLabs')
                  : 'Navegador'}
              </span>
            </button>
            {tts.isElevenLabs && tts.elapsed > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/50">
                <Timer className="w-2.5 h-2.5" />
                {Math.floor(tts.elapsed / 60)}:{String(Math.floor(tts.elapsed % 60)).padStart(2, '0')}
              </span>
            )}
          </div>
        ) : tts.isLoadingAudio ? (
          <div className="flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground/50" />
            <span className="text-[10px] text-muted-foreground/50">Gerando áudio...</span>
          </div>
        ) : tts.lastError ? (
          <button
            onClick={() => { if (tts.currentSpeakingText) tts.speak(tts.currentSpeakingText); }}
            aria-label="Tentar narração novamente"
            className="flex items-center gap-1.5 text-amber-500 hover:text-amber-400 transition-colors rounded-[4px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <AlertCircle className="w-3 h-3" />
            <span className="text-[10px] font-medium">ElevenLabs falhou</span>
            <RefreshCw className="w-2.5 h-2.5" />
            <span className="text-[10px]">Tentar novamente</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <motion.span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                tts.isElevenLabs ? "bg-emerald-500" : "bg-amber-500"
              )}
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <span className="text-[10px] text-muted-foreground/60">
              {tts.isElevenLabs ? 'Online' : 'Voz do navegador'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
