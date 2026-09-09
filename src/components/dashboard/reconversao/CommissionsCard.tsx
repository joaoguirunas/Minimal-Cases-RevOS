/**
 * CommissionsCard — comissões por comercial (mês × pessoa), com export CSV
 * (Task 10 · aggregateComissoes / comissoesToCsv).
 */

import { Download } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { fmtBRL } from '@/components/dashboard/bipro-shared';
import { comissoesToCsv, type ComissaoLinha } from '@/lib/bi/comissoes';

export default function CommissionsCard({ linhas }: { linhas: ComissaoLinha[] }) {
  const exportar = () => {
    const blob = new Blob(['﻿' + comissoesToCsv(linhas)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `comissoes-${format(new Date(), 'yyyyMMdd')}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div><p className="text-[13px] font-medium text-foreground">Comissões por comercial</p><p className="text-[11px] text-muted-foreground">Pedidos recuperados por pessoa, por mês — base cupom ou janela de 7 dias</p></div>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12px]" onClick={exportar} disabled={linhas.length === 0}><Download className="h-3.5 w-3.5" strokeWidth={1.5} />CSV</Button>
      </div>
      {linhas.length === 0 ? <p className="text-[12px] text-muted-foreground">Nenhuma recuperação no período.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="text-[11px] uppercase tracking-wide text-muted-foreground/70"><tr><th className="text-left py-1.5">Mês</th><th className="text-left">Comercial</th><th className="text-right">Pedidos</th><th className="text-right">Receita</th><th className="text-right">Cupom</th><th className="text-right">Janela</th><th className="text-right">%</th><th className="text-right">Comissão</th></tr></thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={`${l.mes}|${l.comercialId ?? 'auto'}`} className="border-t border-border/60">
                  <td className="py-1.5 tabular-nums">{l.mes}</td><td className={l.comercialId ? '' : 'text-muted-foreground'}>{l.comercial}</td>
                  <td className="text-right tabular-nums">{l.pedidos}</td><td className="text-right tabular-nums">{fmtBRL(l.receita)}</td>
                  <td className="text-right tabular-nums">{l.porCupom}</td><td className="text-right tabular-nums">{l.porJanela}</td>
                  <td className="text-right tabular-nums">{l.pctMedio === null ? '—' : `${l.pctMedio}%`}</td>
                  <td className="text-right tabular-nums font-medium">{l.comercialId ? fmtBRL(l.comissao) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
