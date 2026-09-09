/**
 * AbTestCard — card "Teste A/B" do BI da esteira (Task 14).
 *
 * Um bloco por experimento (running/paused/finished recente): tabela
 * compacta por variante + barra comparativa de taxa + veredito de
 * confiança estatística (Task 9b · `aggregateAbTest`).
 */

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Chip, type ChipTone } from '@/components/ui/chip';
import { fmtBRL } from '@/components/dashboard/bipro-shared';
import { useAbTestBI, type AbTestBIEntry } from '@/hooks/useAbTestBI';
import { abStatusLabel, variantTone, type AbStatus } from '@/lib/followups/ab';
import type { AbVariantStats } from '@/lib/bi/abTest';

const STATUS_TONE: Record<AbStatus, ChipTone> = {
  draft: 'neutral',
  running: 'success',
  paused: 'warning',
  finished: 'neutral',
};

const BAR_TONE: Record<ChipTone, string> = {
  neutral: 'bg-muted-foreground/40',
  info: 'bg-sky-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  violet: 'bg-violet-400',
};

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);
const num = (v: number) => new Intl.NumberFormat('pt-BR').format(v);
const fmtDesde = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? `desde ${format(d, 'dd/MM', { locale: ptBR })}` : null;
};
const fmtP = (p: number) => p.toFixed(2).replace('.', ',');

function veredito({ experiment, stats, confidence }: AbTestBIEntry): string {
  if (confidence.nivel === 'insuficiente') return 'Amostra insuficiente (mínimo 30 leads por variante)';
  if (confidence.nivel === 'baixa') return confidence.p !== null ? `Confiança baixa · p=${fmtP(confidence.p)}` : 'Confiança baixa';
  if (confidence.nivel === 'media') return confidence.p !== null ? `Confiança média · p=${fmtP(confidence.p)}` : 'Confiança média';
  // alta
  const controle = stats.find((v) => v.isControl) ?? stats[0] ?? null;
  const melhor = stats.find((v) => v.key === confidence.melhor) ?? null;
  if (controle && melhor && melhor !== controle && confidence.lift !== null) {
    return `Confiança alta — ${melhor.key} converte ${Math.round(confidence.lift * 100)}% mais que ${controle.key}`;
  }
  return 'Confiança alta';
}

function ExperimentBlock({ entry }: { entry: AbTestBIEntry }) {
  const { experiment, stats } = entry;
  const periodo = fmtDesde(experiment.started_at ?? experiment.created_at);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-[13px] font-medium text-foreground truncate">{experiment.name}</p>
          <Chip tone={STATUS_TONE[experiment.status]}>{abStatusLabel(experiment.status)}</Chip>
        </div>
        {periodo && <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">{periodo}</span>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="text-left font-medium pb-1.5 pr-2">Variante</th>
              <th className="text-right font-medium pb-1.5 px-2">Leads</th>
              <th className="text-right font-medium pb-1.5 px-2">Tocados</th>
              <th className="text-right font-medium pb-1.5 px-2">CTR</th>
              <th className="text-right font-medium pb-1.5 px-2">Reconv.</th>
              <th className="text-right font-medium pb-1.5 px-2">Taxa</th>
              <th className="text-right font-medium pb-1.5 pl-2">Receita</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((v: AbVariantStats) => (
              <tr key={v.id} className="border-t border-border">
                <td className="py-1.5 pr-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Chip tone={variantTone(v.key)}>{v.key}</Chip>
                    <span className="truncate text-foreground">{v.name}</span>
                  </div>
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">{num(v.leads)}</td>
                <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">{num(v.tocados)}</td>
                <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">{pct(v.ctr)}</td>
                <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">{num(v.reconvertidos)}</td>
                <td className="py-1.5 px-2 text-right font-semibold tabular-nums text-foreground">{pct(v.taxa)}</td>
                <td className="py-1.5 pl-2 text-right tabular-nums text-muted-foreground">{fmtBRL(v.receita)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-1.5">
        {stats.map((v) => (
          <div key={v.id} className="h-1.5 w-full rounded-full bg-muted overflow-hidden" aria-hidden>
            <div className={`h-full rounded-full ${BAR_TONE[variantTone(v.key)]}`} style={{ width: `${Math.round((v.taxa ?? 0) * 100)}%` }} />
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground">{veredito(entry)}</p>
    </div>
  );
}

export default function AbTestCard() {
  const { data } = useAbTestBI();
  if (!data || data.length === 0) return null;

  return (
    <>
      {data.map((entry) => (
        <ExperimentBlock key={entry.experiment.id} entry={entry} />
      ))}
    </>
  );
}
