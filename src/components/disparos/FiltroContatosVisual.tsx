import * as React from 'react';
import { cn } from '@/lib/utils';
import { Check, GitBranch, Layers, Activity, Target, Users } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { SendFilters } from '@/types/sends';
import { usePipelines } from '@/hooks/usePipelines';
import { useUsuarios } from '@/hooks/useUsuarios';
import { useScoreFramings } from '@/hooks/useScoreFramings';
import { useScoreInvestments } from '@/hooks/useScoreInvestments';
import { useScoreObjectives } from '@/hooks/useScoreObjectives';
import { useScoreSettings } from '@/hooks/useScoreSettings';

interface Props {
  filters: SendFilters;
  onFilterChange: (newFilters: Partial<SendFilters>) => void;
}

// Toggle value in array (multiselect). Returns undefined when empty (clean filter).
function toggleArr<T>(arr: T[] | undefined, val: T): T[] | undefined {
  const cur = arr ?? [];
  const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val];
  return next.length > 0 ? next : undefined;
}

// Toggle single value — radio-like, deselects on re-click
function toggleOne(cur: string | undefined, val: string): string | undefined {
  return cur === val ? undefined : val;
}

// ─── Chip ────────────────────────────────────────────────────────────────────
function Chip({
  label,
  selected,
  onClick,
  dotColor,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  dotColor?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all duration-150 select-none cursor-pointer',
        selected
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-background text-muted-foreground border-border hover:border-primary/60 hover:text-foreground hover:bg-muted'
      )}
    >
      {dotColor ? (
        <span className={cn('w-2 h-2 rounded-full shrink-0', dotColor)} />
      ) : selected ? (
        <Check className="w-3 h-3 shrink-0" />
      ) : null}
      <span>{label}</span>
    </button>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm font-semibold text-foreground">{label}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FiltroContatosVisual({ filters, onFilterChange }: Props) {
  const { pipelines, stages: allStages, isLoading: pipelinesLoading } = usePipelines();
  const { data: usuarios } = useUsuarios();
  const { data: framings } = useScoreFramings();
  const { data: investments } = useScoreInvestments();
  const { data: objectives } = useScoreObjectives();
  const { data: scoreLabels } = useScoreSettings();

  const stagesForPipeline = allStages?.filter(
    s => s.leads_pipelines_id === filters.pipeline_id
  ) ?? [];

  const LEAD_STATUSES: { value: 'in_progress' | 'won' | 'lost'; label: string; dot: string }[] = [
    { value: 'in_progress', label: 'Em Andamento', dot: 'bg-blue-500' },
    { value: 'won',        label: 'Ganho',        dot: 'bg-green-500' },
    { value: 'lost',      label: 'Perdido',      dot: 'bg-red-500' },
  ];

  const activeFramings    = framings?.filter(f => f.active)    ?? [];
  const activeInvestments = investments?.filter(i => i.active) ?? [];
  const activeObjectives  = objectives?.filter(o => o.active)  ?? [];
  const hasScores = activeFramings.length > 0 || activeInvestments.length > 0 || activeObjectives.length > 0;

  return (
    <div className="space-y-6">

      {/* ── PIPELINE ─────────────────────────────────────────────────────── */}
      <div>
        <SectionTitle icon={<GitBranch className="w-4 h-4" />} label="Pipeline *" />

        {pipelinesLoading ? (
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-9 w-32 rounded-[4px]" />
            ))}
          </div>
        ) : !pipelines?.length ? (
          <p className="text-sm text-muted-foreground">Nenhum pipeline encontrado</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {pipelines.map(p => {
              const selected = filters.pipeline_id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    onFilterChange({
                      pipeline_id: selected ? undefined : p.id,
                      stage_ids: undefined,
                    })
                  }
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 rounded-[4px] border text-sm transition-all duration-150 cursor-pointer',
                    selected
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-foreground border-border hover:border-primary/60 hover:bg-muted'
                  )}
                >
                  {selected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  <span>{p.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── ETAPAS ────────────────────────────────────────────────────────── */}
      {filters.pipeline_id && stagesForPipeline.length > 0 && (
        <>
          <Separator />
          <div>
            <SectionTitle icon={<Layers className="w-4 h-4" />} label="Etapas" />
            <div className="flex flex-wrap gap-2">
              <Chip
                label="Todas"
                selected={!filters.stage_ids || filters.stage_ids.length === 0}
                onClick={() => onFilterChange({ stage_ids: undefined })}
              />
              {stagesForPipeline.map(s => (
                <Chip
                  key={s.id}
                  label={s.name}
                  selected={filters.stage_ids?.includes(s.id) ?? false}
                  onClick={() =>
                    onFilterChange({ stage_ids: toggleArr(filters.stage_ids, s.id) })
                  }
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── STATUS DO LEAD ────────────────────────────────────────────────── */}
      <Separator />
      <div>
        <SectionTitle icon={<Activity className="w-4 h-4" />} label="Status do Lead" />
        <div className="flex flex-wrap gap-2">
          {LEAD_STATUSES.map(s => (
            <Chip
              key={s.value}
              label={s.label}
              selected={filters.lead_status?.includes(s.value) ?? false}
              onClick={() =>
                onFilterChange({
                  lead_status: toggleArr(filters.lead_status, s.value),
                })
              }
              dotColor={s.dot}
            />
          ))}
        </div>
      </div>

      {/* ── SCORES ────────────────────────────────────────────────────────── */}
      {hasScores && (
        <>
          <Separator />
          <div className="space-y-4">
            <SectionTitle icon={<Target className="w-4 h-4" />} label="Score" />

            {/* Segmentos / Framings */}
            {activeFramings.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  {scoreLabels?.framingsLabel ?? 'Segmentos'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {activeFramings.map(f => (
                    <Chip
                      key={f.id}
                      label={f.name}
                      selected={filters.score_framing_id === f.id}
                      onClick={() =>
                        onFilterChange({
                          score_framing_id: toggleOne(filters.score_framing_id, f.id),
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Faixas de Investimento */}
            {activeInvestments.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  {scoreLabels?.investmentsLabel ?? 'Faixas de Investimento'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {activeInvestments.map(inv => (
                    <Chip
                      key={inv.id}
                      label={inv.name}
                      selected={filters.score_investment_id === inv.id}
                      onClick={() =>
                        onFilterChange({
                          score_investment_id: toggleOne(filters.score_investment_id, inv.id),
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Objetivos */}
            {activeObjectives.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  {scoreLabels?.objectivesLabel ?? 'Objetivos'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {activeObjectives.map(obj => (
                    <Chip
                      key={obj.id}
                      label={obj.name}
                      selected={filters.score_objective_id === obj.id}
                      onClick={() =>
                        onFilterChange({
                          score_objective_id: toggleOne(filters.score_objective_id, obj.id),
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── RESPONSÁVEIS ──────────────────────────────────────────────────── */}
      {!!usuarios?.length && (
        <>
          <Separator />
          <div>
            <SectionTitle icon={<Users className="w-4 h-4" />} label="Responsáveis" />
            <div className="flex flex-wrap gap-2">
              {usuarios.map(user => (
                <Chip
                  key={user.id}
                  label={user.name}
                  selected={filters.user_id?.includes(user.id) ?? false}
                  onClick={() =>
                    onFilterChange({ user_id: toggleArr(filters.user_id, user.id) })
                  }
                />
              ))}
            </div>
          </div>
        </>
      )}

    </div>
  );
}
