/**
 * BIProReconversaoTab — BI da esteira de recuperação (BI-REC-2).
 *
 * Números EXATOS de reconversão: um pedido só conta como "reconvertido por nós"
 * quando o pagamento aconteceu depois de pelo menos um toque enviado (e-mail /
 * WhatsApp / SMS), dentro da janela de atribuição de 7 dias — gravado no momento
 * do pedido pago pelo yampi-process-event (esteira_reconversions).
 */

import { motion, type Variants } from 'framer-motion';
import { useReconversaoBI } from '@/hooks/useReconversaoBI';
import { useTrackedClicksRealtime } from '@/hooks/useTrackedLinks';
import {
  cardVariants, containerVariants, SkeletonBlock,
} from './bipro-shared';
import KpiHero from './reconversao/KpiHero';
import InsightsStrip from './reconversao/InsightsStrip';
import FunnelCard from './reconversao/FunnelCard';
import AttributionCard from './reconversao/AttributionCard';
import ClickRateCard from './reconversao/ClickRateCard';
import DailyChart from './reconversao/DailyChart';
import ReconversionsTable from './reconversao/ReconversionsTable';

// bipro-shared declara os variants como objeto plano; o motion do framer 11 exige Variants.
const cardV = cardVariants as unknown as Variants;
const containerV = containerVariants as unknown as Variants;

interface Props {
  dateFrom?: string;
  dateTo?: string;
}

export default function BIProReconversaoTab({ dateFrom, dateTo }: Props) {
  const { data, isLoading, isError, error, refetch } = useReconversaoBI(dateFrom, dateTo);
  useTrackedClicksRealtime();

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
      <InsightsStrip agregado={data.agregado} />

      {/* ── Funil, atribuição e clique por toque ─────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <FunnelCard funil={data.agregado.funil} />
        <AttributionCard receita={data.agregado.porNivelReceita} topCupons={data.agregado.topCupons} />
        <ClickRateCard linhas={data.agregado.cliquesPorToque} geral={data.agregado.ctrGeral} />
      </div>

      {/* ── Série diária ────────────────────────────────────────────────── */}
      <motion.div variants={cardV}>
        <DailyChart porDia={data.agregado.porDia} />
      </motion.div>

      {/* ── Tabela de reconvertidos ─────────────────────────────────────── */}
      <motion.div variants={cardV}>
        <ReconversionsTable rows={data.rows} />
      </motion.div>
    </motion.div>
  );
}
