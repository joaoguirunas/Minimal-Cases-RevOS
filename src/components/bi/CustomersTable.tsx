// src/components/bi/CustomersTable.tsx — lista de clientes do BI (paginada no banco).
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MessageCircle, Download, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBiCustomers, fetchCustomersPage, PAGE_SIZE, type SortKey, type CustomerRow } from '@/hooks/useBiCustomers';
import { SEGMENTS, segmentMeta } from '@/lib/bi/segments';
import { fetchAllPages } from '@/lib/bi/fetchAllPages';
import { toCsv, downloadCsv } from './csv';
import { fmtBRL } from '@/components/dashboard/bipro-shared';

const MAX_EXPORT = 50_000;
const fmtDate = (s: string) => new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const COLS: { key: SortKey | 'city' | 'segment'; label: string; sortable: boolean; align?: 'right' }[] = [
  { key: 'name', label: 'Cliente', sortable: true },
  { key: 'city', label: 'Cidade/UF', sortable: false },
  { key: 'orders', label: 'Pedidos', sortable: true, align: 'right' },
  { key: 'revenue', label: 'Receita', sortable: true, align: 'right' },
  { key: 'avg_ticket', label: 'Ticket', sortable: true, align: 'right' },
  { key: 'last_order_at', label: 'Última compra', sortable: true, align: 'right' },
  { key: 'segment', label: 'Segmento', sortable: false },
];

export function CustomersTable({ segment, onSegmentChange }: { segment: string | null; onSegmentChange: (s: string | null) => void }) {
  const navigate = useNavigate();
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('revenue');
  const [desc, setDesc] = useState(true);
  const [pageState, setPageState] = useState<{ key: string; page: number }>({ key: '', page: 0 });
  const [exporting, setExporting] = useState(false);

  useEffect(() => { const t = setTimeout(() => setSearch(typed.trim()), 300); return () => clearTimeout(t); }, [typed]);
  const params = { segment, search, sort, desc };
  // mudar filtro/ordem volta para a 1ª página no mesmo render (sem buscar a página antiga com o filtro novo)
  const filterKey = JSON.stringify(params);
  const page = pageState.key === filterKey ? pageState.page : 0;
  const setPage = (fn: (p: number) => number) => setPageState({ key: filterKey, page: fn(page) });
  const { data, isLoading, isFetching, error } = useBiCustomers({ ...params, page });
  const total = data?.total ?? 0;
  const rows = data?.rows ?? [];

  const toggleSort = (k: SortKey) => { if (k === sort) setDesc((d) => !d); else { setSort(k); setDesc(k !== 'name'); } };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const all = await fetchAllPages<CustomerRow>((off, lim) => fetchCustomersPage(params, off, lim), { pageSize: 1000, max: MAX_EXPORT });
      downloadCsv(`clientes-${(segment ?? 'todos').toLowerCase().replace(/\s+/g, '-')}.csv`, toCsv(all as unknown as Record<string, unknown>[], [
        { key: 'name', label: 'Nome' }, { key: 'email', label: 'E-mail' }, { key: 'phone', label: 'Telefone' },
        { key: 'city', label: 'Cidade' }, { key: 'state', label: 'UF' }, { key: 'orders', label: 'Pedidos' },
        { key: 'revenue', label: 'Receita' }, { key: 'avg_ticket', label: 'Ticket médio' },
        { key: 'first_order_at', label: 'Primeira compra' }, { key: 'last_order_at', label: 'Última compra' },
        { key: 'days_since', label: 'Dias sem comprar' }, { key: 'segment', label: 'Segmento' },
      ]));
      if (total > MAX_EXPORT) toast.info(`Exportadas as primeiras ${MAX_EXPORT.toLocaleString('pt-BR')} linhas`);
    } catch (e) {
      toast.error('Erro ao exportar', { description: (e as Error).message });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Buscar por nome, e-mail ou telefone" className="h-8 pl-8 text-[12px]" />
        </div>
        <Select value={segment ?? '__all'} onValueChange={(v) => onSegmentChange(v === '__all' ? null : v)}>
          <SelectTrigger className="h-8 w-[190px] text-[12px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todos os segmentos</SelectItem>
            {SEGMENTS.map((s) => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <button onClick={exportCsv} disabled={exporting || total === 0}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-[12px] hover:bg-muted disabled:opacity-50">
          {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
          {exporting ? 'Exportando…' : 'Exportar CSV'}
        </button>
      </div>

      {error ? <p className="text-[12px] text-red-500">Erro ao carregar: {(error as Error).message}</p> : (
        <div className={`overflow-x-auto transition-opacity ${isFetching && !isLoading ? 'opacity-60' : ''}`}>
          <table className="w-full text-[12px]">
            <thead><tr className="border-b border-border">
              {COLS.map((c) => (
                <th key={c.key} onClick={() => c.sortable && toggleSort(c.key as SortKey)}
                  className={`py-2 px-2 font-medium text-muted-foreground whitespace-nowrap ${c.sortable ? 'cursor-pointer select-none hover:text-foreground' : ''} ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                  {c.label}{sort === c.key ? (desc ? ' ↓' : ' ↑') : ''}
                </th>))}
              <th className="py-2 px-2" />
            </tr></thead>
            <tbody>
              {isLoading ? Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}><td colSpan={COLS.length + 1} className="py-1.5"><div className="h-7 rounded bg-muted/50 animate-pulse" /></td></tr>
              )) : rows.length === 0 ? (
                <tr><td colSpan={COLS.length + 1} className="py-8 text-center text-muted-foreground">Nenhum cliente encontrado.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.customer_id} className="border-b border-border/40 hover:bg-muted/30">
                  <td className="py-2 px-2 max-w-[260px]">
                    <div className="truncate font-medium">{r.name ?? '—'}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{[r.email, r.phone].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td className="py-2 px-2 whitespace-nowrap text-muted-foreground">{[r.city, r.state].filter(Boolean).join('/') || '—'}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{r.orders}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{fmtBRL(Number(r.revenue))}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{fmtBRL(Number(r.avg_ticket))}</td>
                  <td className="py-2 px-2 text-right tabular-nums whitespace-nowrap">{fmtDate(r.last_order_at)}<div className="text-[11px] text-muted-foreground">há {r.days_since} d</div></td>
                  <td className="py-2 px-2 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: segmentMeta(r.segment).tone }} />{r.segment}</span>
                  </td>
                  <td className="py-2 px-2 text-right">
                    {r.people_id && (
                      <button onClick={() => navigate(`/omni?pessoaId=${r.people_id}`)} title="Abrir no Omni"
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-primary hover:bg-muted">
                        <MessageCircle className="size-3.5" />Omni
                      </button>)}
                  </td>
                </tr>))}
            </tbody>
          </table>
        </div>)}

      <div className="flex items-center justify-between text-[12px] text-muted-foreground">
        <span className="tabular-nums">{total === 0 ? '0 clientes' : `${(page * PAGE_SIZE + 1).toLocaleString('pt-BR')}–${Math.min(total, (page + 1) * PAGE_SIZE).toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')}`}</span>
        <div className="flex gap-1">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded-md border border-border px-2.5 py-1 hover:bg-muted disabled:opacity-40">Anterior</button>
          <button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)} className="rounded-md border border-border px-2.5 py-1 hover:bg-muted disabled:opacity-40">Próxima</button>
        </div>
      </div>
    </div>
  );
}
