import { fmtBRL } from '@/components/dashboard/bipro-shared';
import type { Agregado } from '@/lib/bi/reconversao';

const NIVEIS = [
  { key: 'cupom', label: 'Cupom nosso', cls: 'bg-emerald-500', hint: 'prova forte' },
  { key: 'clique', label: 'Clique rastreado', cls: 'bg-sky-500', hint: 'prova forte' },
  { key: 'janela', label: 'Janela de 7 dias', cls: 'bg-amber-500', hint: 'atribuição temporal' },
  { key: 'organico', label: 'Orgânico', cls: 'bg-muted-foreground/40', hint: 'sem toque nosso' },
] as const;

export default function AttributionCard({ receita, topCupons }: { receita: Agregado['porNivelReceita']; topCupons: Agregado['topCupons'] }) {
  const total = NIVEIS.reduce((a, n) => a + receita[n.key], 0);
  const divisor = total || 1;
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-baseline justify-between">
        <p className="text-[13px] font-medium text-foreground">Receita por prova de atribuição</p>
        <span className="text-[11px] text-muted-foreground tabular-nums">{fmtBRL(total)} pagos no período</span>
      </div>
      <div className="flex h-3 w-full rounded-full overflow-hidden bg-muted" aria-hidden>
        {NIVEIS.map((n) => <div key={n.key} className={n.cls} style={{ width: `${(receita[n.key] / divisor) * 100}%` }} />)}
      </div>
      <ul className="space-y-1.5">
        {NIVEIS.map((n) => (
          <li key={n.key} className="flex items-center justify-between text-[12px]">
            <span className="flex items-center gap-2 text-foreground"><span className={`inline-block w-2 h-2 rounded-full ${n.cls}`} />{n.label} <span className="text-muted-foreground">· {n.hint}</span></span>
            <span className="tabular-nums text-foreground">{fmtBRL(receita[n.key])} <span className="text-muted-foreground">({Math.round((receita[n.key] / divisor) * 100)}%)</span></span>
          </li>
        ))}
      </ul>
      {topCupons.length > 0 && (
        <div className="pt-3 border-t border-border">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">Cupons que mais recuperaram</p>
          <ul className="space-y-1">
            {topCupons.map((c) => (
              <li key={c.code} className="flex items-center justify-between text-[12px]">
                <span className="font-mono text-foreground">{c.code}</span>
                <span className="tabular-nums text-muted-foreground">{c.pedidos} pedido{c.pedidos === 1 ? '' : 's'} · {fmtBRL(c.receita)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
