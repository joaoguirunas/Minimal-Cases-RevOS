import type { Agregado } from '@/lib/bi/reconversao';

export default function FunnelCard({ funil }: { funil: Agregado['funil'] }) {
  const steps = [
    { label: 'Leads tocados', value: funil.tocados, hint: 'receberam pelo menos um toque' },
    { label: 'Clicaram no link', value: funil.clicaram, hint: 'abriram o carrinho por um link nosso' },
    { label: 'Pagaram', value: funil.pagaram, hint: 'pedido pago atribuído à esteira' },
  ];
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <p className="text-[13px] font-medium text-foreground">Funil de recuperação</p>
      <div className="space-y-3">
        {steps.map((s, i) => {
          const prev = i > 0 ? steps[i - 1].value : null;
          const conv = prev ? Math.min(100, Math.round((s.value / prev) * 100)) : null;
          return (
            <div key={s.label} className="space-y-1">
              <div className="flex items-baseline justify-between text-[12px]">
                <span className="text-foreground">{s.label} <span className="text-muted-foreground">· {s.hint}</span></span>
                <span className="tabular-nums font-semibold text-foreground">{s.value}{conv !== null && <span className="ml-2 text-[11px] font-normal text-muted-foreground">{conv}% da etapa anterior</span>}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden" aria-hidden>
                <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${(s.value / max) * 100}%`, opacity: 1 - i * 0.25 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
