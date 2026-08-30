import { useState, useMemo, useRef, useEffect, useCallback, useDeferredValue } from "react";
import { Check, Play, Square, Search, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useElevenLabsVoices } from "@/hooks/useElevenLabsConfig";
import type { ElevenLabsVoice } from "@/hooks/useElevenLabsConfig";

// ── Language display names ────────────────────────────────────────────────────

const LANG_ORDER = ['pt', 'en', 'es'];

const LANG_LABELS: Record<string, string> = {
  pt: 'Português',
  'pt-BR': 'Português (Brasil)',
  'pt-PT': 'Português (Portugal)',
  en: 'English',
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
  es: 'Español',
  'es-ES': 'Español',
  'es-MX': 'Español (México)',
};

function langLabel(lang: string | null): string {
  if (!lang) return 'Outros';
  return LANG_LABELS[lang] ?? lang;
}

function langGroup(lang: string | null): string {
  if (!lang) return 'outros';
  const prefix = lang.split('-')[0];
  return LANG_ORDER.includes(prefix) ? prefix : 'outros';
}

function sortGroups(groups: string[]): string[] {
  const ordered = LANG_ORDER.filter(g => groups.includes(g));
  const rest = groups.filter(g => !LANG_ORDER.includes(g)).sort();
  return [...ordered, ...rest];
}

// ── Gender chip ───────────────────────────────────────────────────────────────

function GenderChip({ gender }: { gender: string | null }) {
  const label = gender === 'female' ? 'F' : gender === 'male' ? 'M' : '-';
  return (
    <span className={cn(
      "inline-flex items-center justify-center w-4 h-4 rounded-[2px] text-[9px] font-bold",
      label === 'F' ? "bg-pink-500/15 text-pink-400" :
      label === 'M' ? "bg-blue-500/15 text-blue-400" :
      "bg-muted text-muted-foreground/50"
    )}>
      {label}
    </span>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface VoicePickerProps {
  selectedVoiceId: string | null;
  onChange: (voiceId: string | null) => void;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VoicePicker({ selectedVoiceId, onChange, onClose }: VoicePickerProps) {
  const { data: voices } = useElevenLabsVoices();
  const [query, setQuery] = useState('');
  const deferredSearch = useDeferredValue(query);
  const [focusedId, setFocusedId] = useState<string | null>(selectedVoiceId);
  const [playingPreviewId, setPlayingPreviewId] = useState<string | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const stopPreview = useCallback(() => {
    if (previewRef.current) {
      previewRef.current.pause();
      previewRef.current = null;
    }
    setPlayingPreviewId(null);
  }, []);

  const togglePreview = useCallback((voice: ElevenLabsVoice) => {
    if (playingPreviewId === voice.voice_id) {
      stopPreview();
      return;
    }
    stopPreview();
    if (!voice.preview_url) return;
    const audio = new Audio(voice.preview_url);
    audio.volume = 0.7;
    audio.play().catch(() => {});
    audio.onended = () => {
      previewRef.current = null;
      setPlayingPreviewId(null);
    };
    previewRef.current = audio;
    setPlayingPreviewId(voice.voice_id);
  }, [playingPreviewId, stopPreview]);

  useEffect(() => () => stopPreview(), [stopPreview]);

  const grouped = useMemo(() => {
    const q = deferredSearch.toLowerCase();
    const filtered = (voices ?? []).filter(v =>
      !q ||
      v.name.toLowerCase().includes(q) ||
      (v.language ?? '').toLowerCase().includes(q)
    );
    const byGroup: Record<string, ElevenLabsVoice[]> = {};
    filtered.forEach(v => {
      const g = langGroup(v.language);
      (byGroup[g] ??= []).push(v);
    });
    return byGroup;
  }, [voices, deferredSearch]);

  const flatList = useMemo(() => {
    const groups = sortGroups(Object.keys(grouped));
    return groups.flatMap(g => grouped[g] ?? []);
  }, [grouped]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { stopPreview(); onClose(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = flatList.findIndex(v => v.voice_id === focusedId);
      const next = e.key === 'ArrowDown'
        ? Math.min(idx + 1, flatList.length - 1)
        : Math.max(idx - 1, 0);
      setFocusedId(flatList[next]?.voice_id ?? null);
      const el = listRef.current?.querySelector(`[data-voice-id="${flatList[next]?.voice_id}"]`);
      (el as HTMLElement)?.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (e.key === 'Enter') {
      const v = flatList.find(v => v.voice_id === focusedId);
      if (v) { stopPreview(); onChange(v.voice_id); onClose(); }
      return;
    }
    if (e.key === ' ') {
      e.preventDefault();
      const v = flatList.find(v => v.voice_id === focusedId);
      if (v) togglePreview(v);
    }
  }, [flatList, focusedId, onChange, onClose, stopPreview, togglePreview]);

  const sortedGroups = sortGroups(Object.keys(grouped));

  return (
    <div
      className="w-64 bg-popover border border-border rounded-[2px] shadow-lg flex flex-col"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label="Selecionar voz"
    >
      {/* Search */}
      <div className="px-2 pt-2 pb-1 border-b border-border">
        <div className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-[4px]">
          <Search className="w-3 h-3 text-muted-foreground/50 shrink-0" />
          <input
            ref={searchRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar voz ou idioma..."
            className="flex-1 bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
          />
        </div>
      </div>

      {/* Default voice option */}
      <div className="px-1 pt-1">
        <button
          onClick={() => { stopPreview(); onChange(null); onClose(); }}
          className={cn(
            "w-full flex items-center gap-2 px-2 py-1.5 text-[11px] rounded-[2px] transition-colors hover:bg-muted",
            !selectedVoiceId && "bg-primary/5 text-foreground font-medium"
          )}
        >
          {!selectedVoiceId ? <Check className="w-3 h-3 text-primary shrink-0" /> : <span className="w-3 shrink-0" />}
          <span>Voz padrão</span>
        </button>
      </div>

      {/* Voice list */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto max-h-64 px-1 pb-1"
        role="listbox"
        aria-label="Vozes disponíveis"
      >
        {sortedGroups.length === 0 ? (
          <div className="px-3 py-4 text-center">
            <p className="text-[11px] text-muted-foreground/50">Nenhuma voz encontrada</p>
          </div>
        ) : (
          sortedGroups.map(group => (
            <div key={group}>
              {/* Group header */}
              <div className="flex items-center gap-1.5 px-2 py-1 mt-1">
                <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/30" />
                <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/40">
                  {langLabel(group === 'outros' ? null : group)}
                </span>
              </div>

              {/* Voice rows */}
              {(grouped[group] ?? []).map(voice => {
                const isSelected = voice.voice_id === selectedVoiceId;
                const isFocused = voice.voice_id === focusedId;
                const isPreviewing = voice.voice_id === playingPreviewId;

                return (
                  <div
                    key={voice.voice_id}
                    data-voice-id={voice.voice_id}
                    role="option"
                    aria-selected={isSelected}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1.5 rounded-[2px] transition-colors cursor-pointer group",
                      isSelected ? "bg-primary/5" : isFocused ? "bg-muted" : "hover:bg-muted"
                    )}
                    onClick={() => { stopPreview(); onChange(voice.voice_id); onClose(); }}
                    onMouseEnter={() => setFocusedId(voice.voice_id)}
                  >
                    {/* Selected check */}
                    {isSelected
                      ? <Check className="w-3 h-3 text-primary shrink-0" />
                      : <span className="w-3 shrink-0" />
                    }

                    {/* Name */}
                    <span className={cn(
                      "flex-1 text-[11px] truncate",
                      isSelected ? "text-foreground font-medium" : "text-muted-foreground"
                    )}>
                      {voice.name}
                    </span>

                    {/* Gender chip */}
                    <GenderChip gender={voice.gender} />

                    {/* Language chip */}
                    {voice.language && (
                      <span className="text-[9px] text-muted-foreground/40 shrink-0">
                        {voice.language}
                      </span>
                    )}

                    {/* Preview button */}
                    {voice.preview_url && (
                      <button
                        onClick={e => { e.stopPropagation(); togglePreview(voice); }}
                        aria-label={isPreviewing ? `Parar preview de ${voice.name}` : `Preview de ${voice.name}`}
                        className={cn(
                          "p-0.5 rounded-[2px] transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                          isPreviewing
                            ? "text-violet-500"
                            : "text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-foreground"
                        )}
                      >
                        {isPreviewing
                          ? <Square className="w-2.5 h-2.5 fill-current" />
                          : <Play className="w-2.5 h-2.5 fill-current" />
                        }
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
