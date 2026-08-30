import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TranscriptSegment {
  speaker: string;
  text: string;
  startTime: number; // seconds
  endTime: number;   // seconds
}

export interface MeetingTranscriptViewerProps {
  transcript_json: TranscriptSegment[];
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Stable colour for a speaker name based on a simple hash. */
const SPEAKER_COLOURS = [
  'bg-violet-500/20 text-violet-400 border-violet-500/30',
  'bg-sky-500/20 text-sky-400 border-sky-500/30',
  'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'bg-rose-500/20 text-rose-400 border-rose-500/30',
  'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
];

function speakerHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return h % SPEAKER_COLOURS.length;
}

function speakerColour(name: string): string {
  return SPEAKER_COLOURS[speakerHash(name)];
}

function speakerInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/** Highlight search term in text — returns an array of React nodes. */
function HighlightedText({
  text,
  query,
}: {
  text: string;
  query: string;
}): React.ReactElement {
  if (!query.trim()) return <>{text}</>;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="bg-amber-400/30 text-foreground rounded-[2px] px-0.5"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function MeetingTranscriptViewer({
  transcript_json,
}: MeetingTranscriptViewerProps) {
  const [query, setQuery] = useState('');
  const [activeSpeakers, setActiveSpeakers] = useState<Set<string>>(new Set());

  // Unique speakers in order of first appearance
  const speakers = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const seg of transcript_json) {
      if (!seen.has(seg.speaker)) {
        seen.add(seg.speaker);
        result.push(seg.speaker);
      }
    }
    return result;
  }, [transcript_json]);

  const toggleSpeaker = (name: string) => {
    setActiveSpeakers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const filteredSegments = useMemo(() => {
    return transcript_json.filter((seg) => {
      const matchesSpeaker =
        activeSpeakers.size === 0 || activeSpeakers.has(seg.speaker);
      const matchesQuery =
        !query.trim() ||
        seg.text.toLowerCase().includes(query.toLowerCase()) ||
        seg.speaker.toLowerCase().includes(query.toLowerCase());
      return matchesSpeaker && matchesQuery;
    });
  }, [transcript_json, activeSpeakers, query]);

  if (transcript_json.length === 0) {
    return (
      <div className="flex items-center justify-center py-10 text-[12px] text-muted-foreground">
        Sem transcrição disponível
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquisar na transcrição..."
          className="h-[30px] pl-8 text-xs"
        />
      </div>

      {/* Speaker chips */}
      {speakers.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {speakers.map((speaker) => {
            const active = activeSpeakers.has(speaker);
            const colour = speakerColour(speaker);
            return (
              <button
                key={speaker}
                type="button"
                onClick={() => toggleSpeaker(speaker)}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[11px] font-medium border transition-opacity',
                  colour,
                  !active && activeSpeakers.size > 0 && 'opacity-40',
                )}
              >
                {speaker}
              </button>
            );
          })}
        </div>
      )}

      {/* Segments list */}
      {filteredSegments.length === 0 ? (
        <p className="text-[12px] text-muted-foreground py-4 text-center">
          Nenhum resultado para "{query}"
        </p>
      ) : (
        <div className="space-y-0">
          {filteredSegments.map((seg, idx) => {
            const prevSeg = filteredSegments[idx - 1];
            const speakerChanged = idx === 0 || prevSeg?.speaker !== seg.speaker;
            const colour = speakerColour(seg.speaker);

            return (
              <div key={idx}>
                {/* Separator when speaker changes (after the first segment) */}
                {speakerChanged && idx > 0 && (
                  <div className="border-t border-border/40 my-2" />
                )}

                <div className="flex items-start gap-2.5 py-1.5">
                  {/* Avatar — show only on speaker change */}
                  <div className="shrink-0 w-6 mt-0.5">
                    {speakerChanged ? (
                      <span
                        className={cn(
                          'flex items-center justify-center w-6 h-6 rounded-full text-[9px] font-bold border',
                          colour,
                        )}
                      >
                        {speakerInitials(seg.speaker)}
                      </span>
                    ) : (
                      <span className="block w-6 h-6" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-0.5">
                    {/* Speaker name + timestamp — show on speaker change */}
                    {speakerChanged && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-foreground">
                          {seg.speaker}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground/60 cursor-default select-none">
                          {formatTimestamp(seg.startTime)}
                        </span>
                      </div>
                    )}
                    {/* Text */}
                    <p className="text-[12px] text-muted-foreground leading-relaxed">
                      <HighlightedText text={seg.text} query={query} />
                    </p>
                  </div>

                  {/* Timestamp for non-speaker-change rows */}
                  {!speakerChanged && (
                    <span className="text-[10px] font-mono text-muted-foreground/40 shrink-0 mt-0.5 cursor-default select-none">
                      {formatTimestamp(seg.startTime)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
