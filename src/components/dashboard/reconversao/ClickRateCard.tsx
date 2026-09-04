import { Chip } from '@/components/ui/chip';
import type { Agregado } from '@/lib/bi/reconversao';

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

export default function ClickRateCard({ linhas, geral }: { linhas: Agregado['cliquesPorToque']; geral: Agregado['ctrGeral'] }) {
  const top = linhas.slice(0, 6);
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-baseline justify-between">
        <p className="text-[13px] font-medium text-foreground">Taxa de clique por toque</p>
        <span className="text-[11px] text-muted-foreground tabular-nums">{geral.clicados} de {geral.enviados} links abertos · {pct(geral.ctr)}</span>
      </div>
      {top.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">Nenhum link enviado no período.</p>
      ) : (
        <ul className="space-y-2">
          {top.map((r) => (
            <li key={r.key} className="space-y-1">
              <div className="flex items-center justify-between text-[12px]">
                <span className="truncate text-foreground">{r.label}</span>
                <span className="tabular-nums text-muted-foreground">{r.clicados}/{r.enviados} · <span className="font-semibold text-foreground">{pct(r.ctr)}</span></span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden" aria-hidden>
                <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.round((r.ctr ?? 0) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-muted-foreground">Só cliques humanos contam — visitas de robôs de preview (WhatsApp, e-mail) ficam de fora.</p>
      {linhas.length > top.length && <Chip>+{linhas.length - top.length} toques</Chip>}
    </div>
  );
}
