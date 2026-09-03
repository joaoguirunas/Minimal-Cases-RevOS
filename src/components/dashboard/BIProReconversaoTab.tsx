/**
 * BIProReconversaoTab — BI da esteira de recuperação (BI-REC-2).
 *
 * Números EXATOS de reconversão: um pedido só conta como "reconvertido por nós"
 * quando o pagamento aconteceu depois de pelo menos um toque enviado (e-mail /
 * WhatsApp / SMS), dentro da janela de atribuição de 7 dias — gravado no momento
 * do pedido pago pelo yampi-process-event (esteira_reconversions).
 */

import { motion, type Variants } from 'framer-motion';
import { CheckCircle2, Mail, MessageCircle, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReconversaoBI, type ReconversionRow } from '@/hooks/useReconversaoBI';
import {
  cardVariants, containerVariants, fmtBRL, SkeletonBlock, TABLE_HEADER,
} from './bipro-shared';
import KpiHero from './reconversao/KpiHero';
import FunnelCard from './reconversao/FunnelCard';
import AttributionCard from './reconversao/AttributionCard';
import DailyChart from './reconversao/DailyChart';

// bipro-shared declara os variants como objeto plano; o motion do framer 11 exige Variants.
const cardV = cardVariants as unknown as Variants;
const containerV = containerVariants as unknown as Variants;
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  dateFrom?: string;
  dateTo?: string;
}

const fmtHoras = (h: number | null) => {
  if (h === null) return '—';
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} d`;
};

function TouchIcons({ r }: { r: ReconversionRow }) {
  return (
    <span className="inline-flex items-center gap-2">
      {r.touches_email > 0 && (
        <span className="inline-flex items-center gap-0.5 text-sky-400"><Mail className="w-3 h-3" strokeWidth={1.5} />{r.touches_email}</span>
      )}
      {r.touches_whatsapp > 0 && (
        <span className="inline-flex items-center gap-0.5 text-emerald-400"><MessageCircle className="w-3 h-3" strokeWidth={1.5} />{r.touches_whatsapp}</span>
      )}
      {r.touches_sms > 0 && (
        <span className="inline-flex items-center gap-0.5 text-violet-400"><Smartphone className="w-3 h-3" strokeWidth={1.5} />{r.touches_sms}</span>
      )}
      {r.touches_total === 0 && <span className="text-muted-foreground/50">—</span>}
    </span>
  );
}

export default function BIProReconversaoTab({ dateFrom, dateTo }: Props) {
  const { data, isLoading, isError, error, refetch } = useReconversaoBI(dateFrom, dateTo);

  if (isError) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center space-y-3">
        <p className="text-[13px] text-foreground font-medium">Não consegui carregar os dados de reconversão.</p>
        <p className="text-[12px] text-muted-foreground">{(error as Error)?.message ?? 'Erro desconhecido'}</p>
        <button onClick={() => refetch()} className="text-[12px] text-primary underline underline-offset-4">Tentar de novo</button>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr_1fr] gap-4">
            <SkeletonBlock height={160} /><SkeletonBlock height={160} /><SkeletonBlock height={160} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SkeletonBlock height={84} /><SkeletonBlock height={84} /><SkeletonBlock height={84} />
          </div>
        </div>
        <SkeletonBlock height={260} />
        <SkeletonBlock height={320} />
      </div>
    );
  }

  return (
    <motion.div variants={containerV} initial="hidden" animate="show" className="space-y-5">
      {/* ── KPIs principais ─────────────────────────────────────────────── */}
      <KpiHero agregado={data.agregado} />

      {/* ── Funil e atribuição ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FunnelCard funil={data.agregado.funil} />
        <AttributionCard receita={data.agregado.porNivelReceita} topCupons={data.agregado.topCupons} />
      </div>

      {/* ── Série diária ────────────────────────────────────────────────── */}
      <motion.div variants={cardV}>
        <DailyChart porDia={data.agregado.porDia} />
      </motion.div>

      {/* ── Tabela de reconvertidos ─────────────────────────────────────── */}
      <motion.div variants={cardV} className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-[13px] font-medium text-foreground">Pedidos pagos no período</p>
          <p className="text-[11px] text-muted-foreground">
            atribuição: toque enviado antes do pagamento, janela de 7 dias
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-border">
                <th className={cn(TABLE_HEADER, 'text-left px-4 py-2')}>Cliente</th>
                <th className={cn(TABLE_HEADER, 'text-left px-4 py-2')}>Toques</th>
                <th className={cn(TABLE_HEADER, 'text-left px-4 py-2')}>Último toque → pagou</th>
                <th className={cn(TABLE_HEADER, 'text-right px-4 py-2')}>Valor</th>
                <th className={cn(TABLE_HEADER, 'text-left px-4 py-2')}>Pago em</th>
                <th className={cn(TABLE_HEADER, 'text-left px-4 py-2')}>Atribuição</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-[12px]">
                  Nenhum pedido pago no período.
                </td></tr>
              ) : data.rows.map((r) => (
                <tr key={r.id} className={cn(!r.attributed && 'opacity-60')}>
                  <td className="px-4 py-2.5 text-foreground truncate max-w-[220px]">
                    {r.pessoa?.name ?? '—'}
                    <span className="text-muted-foreground/50 text-[11px] ml-2">#{r.order_id}</span>
                  </td>
                  <td className="px-4 py-2.5"><TouchIcons r={r} /></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{fmtHoras(r.hours_since_last_touch)}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-foreground tabular-nums">
                    {r.order_total !== null ? fmtBRL(r.order_total) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                    {format(new Date(r.paid_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.attributed ? (
                      <span
                        title={r.attribution_level === 'cupom'
                          ? `Usou o nosso cupom ${r.coupon_code ?? ''} — prova forte`
                          : r.attribution_level === 'clique'
                            ? 'Clicou em link rastreado nosso antes de pagar'
                            : 'Recebeu toque antes de pagar (janela de 7 dias)'}
                        className={cn(
                          'inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full border',
                          r.attribution_level === 'cupom'
                            ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30'
                            : r.attribution_level === 'clique'
                              ? 'text-sky-400 bg-sky-400/10 border-sky-400/25'
                              : 'text-amber-500 bg-amber-500/10 border-amber-500/25',
                        )}
                      >
                        <CheckCircle2 className="w-3 h-3" strokeWidth={1.5} />
                        {r.attribution_level === 'cupom'
                          ? `Cupom ${r.coupon_code ?? ''}`
                          : r.attribution_level === 'clique' ? 'Clique rastreado' : 'Janela 7d'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[11px] font-medium px-1.5 py-0.5 rounded-full border text-muted-foreground bg-muted border-border">
                        Orgânico
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}
