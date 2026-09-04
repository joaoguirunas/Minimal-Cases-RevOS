import { useMemo, useState } from 'react';
import { Chip } from '@/components/ui/chip';
import FollowupModal from './FollowupModal';
import TimelineMarker from './TimelineMarker';
import { variantTone } from '@/lib/followups/ab';
import {
  buildStageTimeline, labelPlacement, snapOffset, minToParts, formatTempo,
  type Lane, type VariantLite,
} from '@/lib/followups/timeline';
import type { StageFollowup } from '@/hooks/useFollowups';
import type { WhatsappTemplate } from '@/hooks/useWhatsappTemplates';
import type { ClickRateRow } from '@/lib/bi/clicks';
import { cn } from '@/lib/utils';

const MARK_CANDIDATES = [0, 60, 360, 1440, 2880, 4320, 5760, 7200, 8640, 10080];
const markLabel = (m: number): string => {
  if (m === 0) return '0';
  if (m < 60) return `${m}min`;
  if (m < 1440) return `${m / 60}h`;
  return `${m / 1440}d`;
};

const laneLabel = (lane: Lane): string => {
  if (lane.key === 'comum') return 'Comum';
  if (lane.key === 'orfa') return 'Variante encerrada';
  return `${lane.key} · ${lane.name}`;
};

interface ModalState {
  open: boolean;
  followup: StageFollowup | null;
  initialOffsetMin?: number;
  initialVariantId?: string | null;
}

interface StageTimelineCardProps {
  stage: { id: string; nome: string };
  followups: StageFollowup[];
  templates: WhatsappTemplate[];
  clickRates: ClickRateRow[];
  /** Variantes do experimento vivo (running|paused) — vazio quando não há teste rodando. */
  variants: VariantLite[];
}

/** Um stage do pipeline: régua de tempo + uma raia por lane (comum/A/B/variante encerrada). */
const StageTimelineCard = ({ stage, followups, templates, clickRates, variants }: StageTimelineCardProps) => {
  const [modal, setModal] = useState<ModalState>({ open: false, followup: null });

  const followupById = useMemo(() => new Map(followups.map((f) => [f.id, f])), [followups]);
  const knownVariantIds = useMemo(() => new Set(variants.map((v) => v.id)), [variants]);
  const orphanFollowups = useMemo(
    () => followups.filter((f) => f.ab_variant_id && !knownVariantIds.has(f.ab_variant_id)),
    [followups, knownVariantIds],
  );

  const timeline = useMemo(
    () => buildStageTimeline(followups, templates, clickRates, variants)[0],
    [followups, templates, clickRates, variants],
  );

  const rawMax = timeline?.maxOffsetMin ?? 0;
  const maxOffsetMin = followups.length === 0 ? 4320 : Math.max(rawMax, 60);

  const lanes: Lane[] = timeline?.lanes ?? [
    { variantId: null, key: 'comum', name: 'Comum', rules: [] },
    ...variants.map((v) => ({ variantId: v.id, key: v.key, name: v.name, rules: [] })),
  ];

  const orphanLane: Lane | null = useMemo(() => {
    if (orphanFollowups.length === 0) return null;
    const nulled = orphanFollowups.map((f) => ({ ...f, ab_variant_id: null }));
    const t = buildStageTimeline(nulled, templates, clickRates, [])[0];
    const rules = t?.lanes[0]?.rules ?? [];
    const placements = labelPlacement(rules.map((r) => r.offsetMin), maxOffsetMin);
    const withPlacement = rules.map((r, i) => ({ ...r, placement: placements[i] }));
    return { variantId: null, key: 'orfa', name: 'Variante encerrada', rules: withPlacement };
  }, [orphanFollowups, templates, clickRates, maxOffsetMin]);

  const allLanes = orphanLane ? [...lanes, orphanLane] : lanes;
  const marks = MARK_CANDIDATES.filter((m) => m <= maxOffsetMin);
  const headerParts = minToParts(rawMax);
  const headerTempo = formatTempo(headerParts.dias, headerParts.horas, headerParts.minutos);
  const ruleCount = followups.length;

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>, lane: Lane) => {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = rect.width > 0 ? Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) : 0;
    const min = snapOffset(Math.round(pct * maxOffsetMin), maxOffsetMin);
    setModal({ open: true, followup: null, initialOffsetMin: min, initialVariantId: lane.variantId });
  };

  const closeModal = () => setModal({ open: false, followup: null });

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-foreground">{stage.nome}</span>
        <span className="text-[11px] text-muted-foreground">
          {ruleCount} toque{ruleCount !== 1 ? 's' : ''} · até {headerTempo}
        </span>
      </div>

      {/* Régua */}
      <div className="relative mb-2 ml-24 mr-4 h-3">
        {marks.map((m) => (
          <span
            key={m}
            className="absolute -translate-x-1/2 text-[10px] tabular-nums text-muted-foreground"
            style={{ left: `${maxOffsetMin > 0 ? (m / maxOffsetMin) * 100 : 0}%` }}
          >
            {markLabel(m)}
          </span>
        ))}
      </div>

      <div className="divide-y divide-border/50">
        {allLanes.map((lane) => (
          <div key={lane.key} className={cn('relative flex min-h-[72px] items-center', lane.key === 'orfa' && 'opacity-60')}>
            <div className="w-24 flex-shrink-0 pr-2">
              <Chip tone={variantTone(lane.key)}>{laneLabel(lane)}</Chip>
            </div>
            <div
              className="absolute inset-y-0 left-24 right-4 cursor-pointer"
              onClick={(e) => handleTrackClick(e, lane)}
            >
              <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-px bg-border" />
              {lane.rules.map((rule, i) => (
                <TimelineMarker
                  key={rule.id}
                  rule={rule}
                  followup={followupById.get(rule.id) as StageFollowup}
                  index={i + 1}
                  scaleMax={maxOffsetMin}
                  lanes={lanes}
                  templates={templates}
                  onEdit={(f) => setModal({ open: true, followup: f })}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <FollowupModal
        isOpen={modal.open}
        onClose={closeModal}
        stageId={stage.id}
        followup={modal.followup}
        initialOffsetMin={modal.initialOffsetMin}
        initialVariantId={modal.initialVariantId}
      />
    </div>
  );
};

export default StageTimelineCard;
