import { cn } from '@/lib/utils';

export interface FunnelStage { id: string; nome: string; cor?: string | null; count: number }
interface Props { stages: FunnelStage[]; activeStageId: string | null; onSelect: (stageId: string | null) => void }

/** Distribuição dos leads por etapa em uma barra segmentada; clique filtra a etapa. */
export default function PipelineFunnelStrip({ stages, activeStageId, onSelect }: Props) {
  const total = stages.reduce((a, s) => a + s.count, 0);
  if (total === 0) return null;
  return (
    <div className="px-4 pt-3 pb-1 space-y-1.5">
      <div className="flex h-2 w-full rounded-full overflow-hidden bg-muted" role="img" aria-label={`Distribuição: ${stages.map((s) => `${s.nome} ${s.count}`).join(', ')}`}>
        {stages.filter((s) => s.count > 0).map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(activeStageId === s.id ? null : s.id)}
            title={`${s.nome} · ${s.count} (${Math.round((s.count / total) * 100)}%)`}
            className={cn('h-full transition-opacity hover:opacity-100', activeStageId && activeStageId !== s.id ? 'opacity-30' : 'opacity-90')}
            style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.cor || 'hsl(var(--muted-foreground))' }}
            aria-label={`Filtrar ${s.nome}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {stages.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(activeStageId === s.id ? null : s.id)}
            className={cn('inline-flex items-center gap-1.5 text-[11px] rounded-full px-1 -mx-1 transition-colors',
              activeStageId === s.id ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground')}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.cor || 'hsl(var(--muted-foreground))' }} />
            {s.nome} <span className="tabular-nums">{s.count}</span>
          </button>
        ))}
        <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">{total} leads</span>
      </div>
    </div>
  );
}
