import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, Download, Mail, MessageSquare, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { cn } from '@/lib/utils';
import { fmtBRL, TABLE_HEADER } from '@/components/dashboard/bipro-shared';
import type { ReconversionRow } from '@/hooks/useReconversaoBI';

type Filtro = 'todos' | 'atribuidos' | 'organicos' | 'cupom' | 'clique' | 'janela';
type Ordem = { by: 'paid_at' | 'order_total'; dir: 'asc' | 'desc' };
const PAGE = 25;

const csvCell = (v: unknown) => { const s = v === null || v === undefined ? '' : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function toCsv(rows: ReconversionRow[]): string {
  const head = ['cliente', 'pedido', 'valor', 'pago_em', 'atribuicao', 'cupom', 'toques_email', 'toques_whatsapp', 'toques_sms', 'horas_ultimo_toque'];
  const lines = rows.map((r) => [r.pessoa?.name ?? '', r.order_id, r.order_total ?? '', r.paid_at, r.attributed ? r.attribution_level ?? '' : 'organico', r.coupon_code ?? '', r.touches_email, r.touches_whatsapp, r.touches_sms, r.hours_since_last_touch ?? ''].map(csvCell).join(';'));
  return [head.join(';'), ...lines].join('\n');
}

const fmtHoras = (h: number | null) => (h === null ? '—' : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} d`);

export default function ReconversionsTable({ rows }: { rows: ReconversionRow[] }) {
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [ordem, setOrdem] = useState<Ordem>({ by: 'paid_at', dir: 'desc' });
  const [page, setPage] = useState(1);

  const visiveis = useMemo(() => {
    const f = rows.filter((r) => filtro === 'todos' ? true : filtro === 'atribuidos' ? r.attributed : filtro === 'organicos' ? !r.attributed : r.attribution_level === filtro);
    return [...f].sort((a, b) => {
      const va = ordem.by === 'paid_at' ? a.paid_at : (a.order_total ?? 0);
      const vb = ordem.by === 'paid_at' ? b.paid_at : (b.order_total ?? 0);
      return (va < vb ? -1 : va > vb ? 1 : 0) * (ordem.dir === 'asc' ? 1 : -1);
    });
  }, [rows, filtro, ordem]);
  const pages = Math.max(1, Math.ceil(visiveis.length / PAGE));
  const slice = visiveis.slice((page - 1) * PAGE, page * PAGE);

  useEffect(() => { if (page > pages) setPage(1); }, [pages, page]);

  const toggle = (by: Ordem['by']) => { setOrdem((o) => ({ by, dir: o.by === by && o.dir === 'desc' ? 'asc' : 'desc' })); setPage(1); };
  const exportar = () => {
    const blob = new Blob(['﻿' + toCsv(visiveis)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `reconversoes-${format(new Date(), 'yyyyMMdd')}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  const SortIcon = ({ by }: { by: Ordem['by'] }) => ordem.by !== by ? null : ordem.dir === 'asc' ? <ArrowUp className="inline h-3 w-3 ml-0.5" /> : <ArrowDown className="inline h-3 w-3 ml-0.5" />;

  const FILTROS: Array<{ k: Filtro; label: string }> = [
    { k: 'todos', label: 'Todos' }, { k: 'atribuidos', label: 'Atribuídos' }, { k: 'organicos', label: 'Orgânicos' },
    { k: 'cupom', label: 'Cupom' }, { k: 'clique', label: 'Clique' }, { k: 'janela', label: 'Janela' },
  ];

  const navigateToLead = (leadId: string) => navigate(`/crm/kanban/${leadId}`);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-2">
        <p className="text-[13px] font-medium text-foreground mr-2">Pedidos pagos no período</p>
        <div className="flex gap-1">
          {FILTROS.map((f) => (
            <button key={f.k} type="button" onClick={() => { setFiltro(f.k); setPage(1); }}
              className={cn('text-[11px] px-2 py-0.5 rounded-full border transition-colors', filtro === f.k ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground border-border hover:text-foreground')}>
              {f.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">{visiveis.length} pedidos</span>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-[11.5px]" onClick={exportar} disabled={visiveis.length === 0}>
          <Download className="h-3.5 w-3.5" strokeWidth={1.5} />CSV
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-border">
              <th className={cn(TABLE_HEADER, 'text-left px-4 py-2')}>Cliente</th>
              <th className={cn(TABLE_HEADER, 'text-left px-4 py-2')}>Toques</th>
              <th className={cn(TABLE_HEADER, 'text-left px-4 py-2')}>Último toque → pagou</th>
              <th className={cn(TABLE_HEADER, 'text-right px-4 py-2')} aria-sort={ordem.by === 'order_total' ? (ordem.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <button type="button" onClick={() => toggle('order_total')} className="cursor-pointer select-none">
                  Valor<SortIcon by="order_total" />
                </button>
              </th>
              <th className={cn(TABLE_HEADER, 'text-left px-4 py-2')} aria-sort={ordem.by === 'paid_at' ? (ordem.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <button type="button" onClick={() => toggle('paid_at')} className="cursor-pointer select-none">
                  Pago em<SortIcon by="paid_at" />
                </button>
              </th>
              <th className={cn(TABLE_HEADER, 'text-left px-4 py-2')}>Atribuição</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {slice.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-[12px]">Nenhum pedido neste filtro.</td></tr>
            ) : slice.map((r) => (
              <tr key={r.id}
                onClick={() => r.lead_id && navigateToLead(r.lead_id)}
                onKeyDown={r.lead_id ? (e) => { if (e.key === 'Enter') { e.preventDefault(); navigateToLead(r.lead_id as string); } } : undefined}
                tabIndex={r.lead_id ? 0 : undefined}
                role={r.lead_id ? 'link' : undefined}
                aria-label={r.lead_id ? `Abrir lead de ${r.pessoa?.name ?? 'cliente'}` : undefined}
                className={cn(r.lead_id && 'cursor-pointer hover:bg-muted/40', !r.attributed && 'opacity-70')}>
                <td className="px-4 py-2.5 text-foreground truncate max-w-[220px]">{r.pessoa?.name ?? '—'}<span className="text-muted-foreground/50 text-[11px] ml-2">#{r.order_id}</span></td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1">
                    {r.touches_email > 0 && <Chip tone="info" icon={Mail}>{r.touches_email}</Chip>}
                    {r.touches_whatsapp > 0 && <Chip tone="success" icon={MessageSquare}>{r.touches_whatsapp}</Chip>}
                    {r.touches_sms > 0 && <Chip tone="violet" icon={Smartphone}>{r.touches_sms}</Chip>}
                    {r.touches_total === 0 && <span className="text-muted-foreground/50 text-[11px]">—</span>}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{fmtHoras(r.hours_since_last_touch)}</td>
                <td className="px-4 py-2.5 text-right font-medium text-foreground tabular-nums">{r.order_total !== null ? fmtBRL(r.order_total) : '—'}</td>
                <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{format(new Date(r.paid_at), 'dd/MM/yy HH:mm', { locale: ptBR })}</td>
                <td className="px-4 py-2.5">
                  {r.attributed ? (
                    <Chip size="md" icon={CheckCircle2} tone={r.attribution_level === 'cupom' ? 'success' : r.attribution_level === 'clique' ? 'info' : 'warning'}
                      title={r.attribution_level === 'cupom' ? `Usou o nosso cupom ${r.coupon_code ?? ''}` : r.attribution_level === 'clique' ? 'Clicou em link rastreado nosso antes de pagar' : 'Recebeu toque antes de pagar (janela de 7 dias)'}>
                      {r.attribution_level === 'cupom' ? `Cupom ${r.coupon_code ?? ''}` : r.attribution_level === 'clique' ? 'Clique rastreado' : 'Janela 7d'}
                    </Chip>
                  ) : <Chip size="md">Orgânico</Chip>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="px-4 py-2.5 border-t border-border flex items-center justify-between text-[11.5px] text-muted-foreground">
          <span className="tabular-nums">página {page} de {pages}</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-7 text-[11.5px]" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <Button variant="ghost" size="sm" className="h-7 text-[11.5px]" disabled={page === pages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        </div>
      )}
    </div>
  );
}
