import { motion, useReducedMotion } from "framer-motion";
import {
  TrendingUp, TrendingDown, DollarSign, Target, Users, Clock, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBIProKPIs } from "@/hooks/useBIProKPIs";
import {
  fmtBRL, fmtK, fmtPct, fmtNum, fmtDays,
  cardVariants, containerVariants, SECTION_CARD,
} from "./bipro-shared";

interface BIProSummaryBarProps {
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  pipelineId?: string;
  scoreFilter?: number[];
}

interface KPICardProps {
  label: string;
  value: string;
  icon: typeof DollarSign;
  growth?: number | null;
  accent?: 'critical' | 'neutral';
}

function GrowthBadge({ growth }: { growth: number | null | undefined }) {
  if (growth == null || growth === 0) return null;
  const up = growth > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums",
      up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
    )}>
      <Icon className="w-3 h-3" />
      {Math.abs(growth).toFixed(0)}%
    </span>
  );
}

function KPICard({ label, value, icon: Icon, growth, accent = 'neutral' }: KPICardProps) {
  return (
    <div className="flex items-start gap-3 min-w-[160px] flex-1 px-5 py-4">
      <div className="flex items-center justify-center w-9 h-9 rounded-md bg-muted shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1.5 min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground truncate">
          {label}
        </p>
        <div className="flex items-baseline gap-2">
          <p className={cn(
            "text-[22px] font-semibold tabular-nums leading-none tracking-tight",
            accent === 'critical' ? "text-red-600 dark:text-red-400" : "text-foreground",
          )}>
            {value}
          </p>
          <GrowthBadge growth={growth} />
        </div>
      </div>
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className={cn(SECTION_CARD, "flex flex-wrap items-center gap-2 px-5 py-4 overflow-x-auto")}>
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="flex items-start gap-3 min-w-[160px] flex-1 px-5 py-4">
          <div className="w-9 h-9 rounded-md animate-pulse bg-muted" />
          <div className="flex flex-col gap-2">
            <div className="w-20 h-2.5 rounded animate-pulse bg-muted" />
            <div className="w-14 h-5 rounded animate-pulse bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function BIProSummaryBar({
  period, dateFrom, dateTo, pipelineId, scoreFilter,
}: BIProSummaryBarProps) {
  const shouldReduce = useReducedMotion();

  const { kpis, isLoading } = useBIProKPIs({
    period, dateFrom, dateTo, pipelineId, scoreFilter,
  });

  if (isLoading || !kpis) return <SummarySkeleton />;

  // Accent only when conversion is critically low — every other number stays neutral foreground.
  const convAccent: 'critical' | 'neutral' =
    kpis.overallConversionRate < 5 ? 'critical' : 'neutral';

  // CPL = total ad spend / total leads (null if no spend or no leads)
  const cpl = kpis.totalAdSpend != null && kpis.totalAdSpend > 0 && kpis.totalLeads > 0
    ? kpis.totalAdSpend / kpis.totalLeads
    : null;

  const cards: KPICardProps[] = [
    {
      label: 'Receita Total',
      value: fmtK(kpis.totalRevenue),
      icon: DollarSign,
      growth: kpis.revenueGrowth,
    },
    {
      label: 'CPL',
      value: cpl != null ? fmtBRL(cpl) : '—',
      icon: Target,
    },
    {
      label: 'CAC Estimado',
      value: kpis.estimatedCAC != null ? fmtBRL(kpis.estimatedCAC) : '—',
      icon: Target,
    },
    {
      label: 'Conversao Geral',
      value: fmtPct(kpis.overallConversionRate),
      icon: Activity,
      accent: convAccent,
    },
    {
      label: 'Leads Ativos',
      value: fmtNum(kpis.activeLeads),
      icon: Users,
    },
    {
      label: 'Ciclo Medio',
      value: fmtDays(kpis.avgSalesCycle),
      icon: Clock,
    },
  ];

  return (
    <motion.div
      className={cn(
        SECTION_CARD,
        "flex flex-wrap items-center divide-x divide-border overflow-x-auto scrollbar-none",
      )}
      variants={containerVariants}
      initial={shouldReduce ? false : "hidden"}
      animate={shouldReduce ? false : "show"}
    >
      {cards.map(card => (
        <motion.div
          key={card.label}
          variants={shouldReduce ? undefined : cardVariants}
          className="flex-1 min-w-[160px]"
        >
          <KPICard {...card} />
        </motion.div>
      ))}
    </motion.div>
  );
}
