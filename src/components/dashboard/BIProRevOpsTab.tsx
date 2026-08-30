import { useState, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, Target,
  CheckCircle2, AlertCircle, AlertTriangle, Settings2, Save, X,
  Filter, Users, Megaphone, ChevronDown, ChevronUp, ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBIProKPIs } from "@/hooks/useBIProKPIs";
import { useBIProRevOps } from "@/hooks/useBIProRevOps";
import { useBIProFunnel } from "@/hooks/useBIProFunnel";
import { useCRBenchmarks } from "@/hooks/useCRBenchmarks";
import type { CRBenchmarkValues } from "@/hooks/useCRBenchmarks";
import BottleneckAlert from "./BottleneckAlert";
import StageConversionMatrix from "./StageConversionMatrix";
import type { RevOpsFunnelStep, RevOpsByCloser, RevOpsByCampaign, RevOpsCRBenchmark } from "@/hooks/useBIProRevOps";
import {
  fmtBRL, fmtK, fmtPct, fmtDays,
  containerVariants, cardVariants, rowVariants,
  BIProFeedback,
  GRID_KPIS_3, GRID_2COL, GRID_SEC_KPIS,
  SkeletonBlock,
  TABLE_HEADER,
} from "./bipro-shared";

// ── CR benchmarks ─────────────────────────────────────────────────────────────
const CR_DEFS = [
  { key: 'cr1' as const, label: 'CR1', sub: 'Lead → MQL' },
  { key: 'cr2' as const, label: 'CR2', sub: 'MQL → SQL' },
  { key: 'cr3' as const, label: 'CR3', sub: 'SQL → SAL' },
  { key: 'cr4' as const, label: 'CR4', sub: 'SAL → WIN' },
  { key: 'cr5' as const, label: 'CR5', sub: 'WIN → COMMIT' },
];

const crStatus = (bench: number, val: number) => {
  if (val >= bench) return 'good';
  if (val >= bench * 0.5) return 'medium';
  return 'bad';
};

// ── Progress Ring ─────────────────────────────────────────────────────────────
function ProgressRing({
  value, size = 64, strokeWidth = 5,
}: {
  value: number; size?: number; strokeWidth?: number;
}) {
  const r = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (circ * Math.min(value, 100)) / 100;
  const cx = size / 2;

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} className="text-primary">
      <circle cx={cx} cy={cx} r={r} fill="none"
        stroke="hsl(var(--border))" strokeWidth={strokeWidth} />
      <circle cx={cx} cy={cx} r={r} fill="none"
        stroke="currentColor" strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  );
}

// ── Hero KPI card ─────────────────────────────────────────────────────────────
function HeroKPI({
  label, value, sub, icon: Icon, trend, ring,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; trend?: number | null;
  ring?: { value: number };
}) {
  return (
    <motion.div
      variants={cardVariants}
      className="border border-border bg-card rounded-md overflow-hidden p-6"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="p-2 rounded-md bg-muted">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>

        {ring ? (
          <div className="relative">
            <ProgressRing value={ring.value} size={52} strokeWidth={4} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[11px] font-semibold text-foreground tabular-nums">{Math.round(ring.value)}%</span>
            </div>
          </div>
        ) : trend != null && Math.abs(trend) >= 0.5 ? (
          <span className={cn(
            'text-[11px] font-semibold flex items-center gap-0.5 tabular-nums',
            trend > 0 ? 'text-emerald-600' : 'text-red-600',
          )}>
            {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trend > 0 ? '+' : ''}{trend.toFixed(0)}%
          </span>
        ) : null}
      </div>

      <p className="text-[28px] font-bold text-foreground leading-none tracking-tight tabular-nums">{value}</p>
      <p className="text-[12px] font-medium text-muted-foreground mt-2">{label}</p>
      {sub && <p className="text-[11px] text-muted-foreground/60 mt-0.5">{sub}</p>}
    </motion.div>
  );
}

// ── Customer Journey Funnel (2D horizontal bars — Linear/Metabase style) ─────
function CustomerJourneyFunnel({ steps }: { steps: RevOpsFunnelStep[] }) {
  const shouldReduce = useReducedMotion();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!steps.length) return (
    <BIProFeedback variant="empty" title="Nenhum lead no período selecionado" description="Ajuste o período ou filtros para visualizar o funil de conversão" icon={Filter} />
  );

  const topCount = steps[0]?.count || 1;
  const lastCount = steps[steps.length - 1]?.count ?? 0;
  const overallPct = topCount > 0 ? (lastCount / topCount) * 100 : 0;
  const ROW_GRID = 'minmax(72px, 96px) 1fr minmax(80px, 110px) minmax(60px, 80px)';

  return (
    <div className="border border-border bg-card rounded-md overflow-hidden">
      <div className="px-6 py-5 border-b border-border flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-foreground">Customer Journey</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">Funil de conversão por etapa</p>
        </div>
        <span className="text-[11px] font-medium text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full whitespace-nowrap">
          {topCount.toLocaleString('pt-BR')} leads totais
        </span>
      </div>

      <div className="px-6 py-6">
        <div className="flex flex-col">
          {steps.map((step, i) => {
            const isHovered = hoveredIdx === i;
            const widthPct = topCount > 0 ? Math.max((step.count / topCount) * 100, 4) : 4;
            const sharePct = topCount > 0 ? (step.count / topCount) * 100 : 0;
            const isLast = i === steps.length - 1;
            const next = steps[i + 1];

            return (
              <div key={step.key}>
                <motion.div
                  className="grid items-center gap-3 cursor-default select-none py-1"
                  style={{ gridTemplateColumns: ROW_GRID }}
                  initial={shouldReduce ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide truncate">
                    {step.label}
                  </span>

                  <div className="relative h-9 bg-muted/30 rounded-md overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-md",
                        isHovered ? "bg-primary/25" : "bg-primary/15",
                      )}
                      style={{
                        width: `${widthPct}%`,
                        transition: 'width 0.6s ease, background-color 0.2s ease',
                      }}
                    />
                  </div>

                  <span className={cn(
                    "text-[14px] tabular-nums tracking-tight text-right",
                    isHovered ? "font-bold text-foreground" : "font-semibold text-foreground",
                  )}>
                    {step.count.toLocaleString('pt-BR')}
                  </span>

                  <span className="text-[11px] font-medium tabular-nums text-muted-foreground text-right">
                    {sharePct.toFixed(1)}%
                  </span>
                </motion.div>

                {!isLast && next && (
                  <div
                    className="grid items-center gap-3"
                    style={{ gridTemplateColumns: ROW_GRID }}
                  >
                    <span />
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80 tabular-nums py-1">
                      <ArrowDown className="w-3 h-3 flex-shrink-0 text-muted-foreground/50" />
                      <span className="text-red-500 dark:text-red-400 font-medium">−{next.dropCount.toLocaleString('pt-BR')}</span>
                      <span className="text-muted-foreground/40">·</span>
                      <span>CR <span className="font-medium text-foreground/80">{fmtPct(next.cr)}</span></span>
                    </div>
                    <span />
                    <span />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-5 pt-4 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{steps.length} etapas</span>
          <span className="tabular-nums">
            Conv. global: <span className="font-semibold text-foreground">{fmtPct(overallPct)}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Top Closers Full Table ─────────────────────────────────────────────────────
function TopClosersTable({ closers }: { closers: RevOpsByCloser[] }) {
  if (!closers.length) return (
    <BIProFeedback variant="empty" title="Nenhum closer com vendas neste período" description="Aumente o período ou verifique se há reuniões registradas" icon={Users} />
  );

  return (
    <div className="border border-border bg-card rounded-md overflow-hidden">
      <div className="px-6 py-5 border-b border-border flex items-center justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-semibold text-foreground">Top Closers</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">Ranking completo por performance de fechamento</p>
        </div>
        <span className="text-[11px] font-medium text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full">
          {closers.length} closers
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className={cn(TABLE_HEADER, "px-4 py-3 text-left w-8")}>#</th>
              <th className={cn(TABLE_HEADER, "px-4 py-3 text-left")}>Nome</th>
              <th className={cn(TABLE_HEADER, "px-4 py-3 text-right")}>SAL</th>
              <th className={cn(TABLE_HEADER, "px-4 py-3 text-right")}>WIN</th>
              <th className={cn(TABLE_HEADER, "px-4 py-3 text-right")}>CR4%</th>
              <th className={cn(TABLE_HEADER, "px-4 py-3 text-right")}>Ticket Médio</th>
              <th className={cn(TABLE_HEADER, "px-4 py-3 text-right")}>Ciclo (dias)</th>
            </tr>
          </thead>
          <tbody>
            {closers.map((c, i) => (
              <tr
                key={c.userId}
                className="border-b border-border last:border-0 transition-colors hover:bg-muted/40"
              >
                <td className="px-4 py-3.5">
                  <span className="text-[12px] text-muted-foreground/60 tabular-nums font-medium">{i + 1}</span>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground flex-shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[13px] font-medium text-foreground">
                      {c.name}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-right text-[13px] text-muted-foreground tabular-nums">{c.sal}</td>
                <td className="px-4 py-3.5 text-right text-[13px] font-semibold text-foreground tabular-nums">{c.win}</td>
                <td className="px-4 py-3.5 text-right">
                  <span className={cn(
                    "text-[12px] font-semibold tabular-nums px-2 py-0.5 rounded-full",
                    c.cr4 >= 25
                      ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400"
                      : c.cr4 >= 12
                      ? "text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400"
                      : "text-red-700 bg-red-50 dark:bg-red-950/40 dark:text-red-400"
                  )}>
                    {fmtPct(c.cr4)}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right text-[13px] font-semibold text-foreground tabular-nums">
                  {c.ticketMedio > 0 ? fmtK(c.ticketMedio) : '—'}
                </td>
                <td className="px-4 py-3.5 text-right text-[13px] text-muted-foreground tabular-nums">
                  {fmtDays(c.cicloMedioSalWin)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Campaign Performance Table ─────────────────────────────────────────────────
function CampaignPerformanceTable({ campaigns }: { campaigns: RevOpsByCampaign[] }) {
  if (!campaigns.length) return (
    <BIProFeedback variant="empty" title="Nenhuma campanha rastreada" description="Conecte UTMs nas suas campanhas para visualizar a performance" icon={Megaphone} />
  );

  const top8 = campaigns.slice(0, 8);

  return (
    <div className="border border-border bg-card rounded-md overflow-hidden">
      <div className="px-6 py-5 border-b border-border flex items-center justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-semibold text-foreground">Performance por Campanha</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">Atribuição UTM — top 8 campanhas por volume</p>
        </div>
        <span className="text-[11px] font-medium text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full">
          {campaigns.length} campanhas
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className={cn(TABLE_HEADER, "px-4 py-3 text-left")}>Campanha</th>
              <th className={cn(TABLE_HEADER, "px-4 py-3 text-right")}>Leads</th>
              <th className={cn(TABLE_HEADER, "px-4 py-3 text-right")}>CR1%</th>
              <th className={cn(TABLE_HEADER, "px-4 py-3 text-right")}>SAL</th>
              <th className={cn(TABLE_HEADER, "px-4 py-3 text-right")}>WIN</th>
              <th className={cn(TABLE_HEADER, "px-4 py-3 text-right")}>CR4%</th>
            </tr>
          </thead>
          <tbody>
            {top8.map((c) => {
              const maxLeads = top8[0]?.leads ?? 1;
              const barWidth = maxLeads > 0 ? (c.leads / maxLeads) * 100 : 0;

              return (
                <tr key={c.campaign} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[13px] font-medium text-foreground max-w-[200px] truncate">
                        {c.campaign}
                      </span>
                      <div className="h-1 bg-muted rounded-full overflow-hidden w-32">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(barWidth, 4)}%`, transition: 'width 0.6s ease' }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right text-[13px] font-semibold text-foreground tabular-nums">
                    {c.leads.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className={cn(
                      "text-[12px] font-semibold tabular-nums",
                      c.cr1 >= 20 ? "text-emerald-600" : c.cr1 >= 10 ? "text-amber-600" : "text-muted-foreground"
                    )}>
                      {fmtPct(c.cr1)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right text-[13px] text-muted-foreground tabular-nums">{c.sal}</td>
                  <td className="px-4 py-3.5 text-right text-[13px] font-semibold text-foreground tabular-nums">{c.win}</td>
                  <td className="px-4 py-3.5 text-right">
                    <span className={cn(
                      "text-[12px] font-semibold tabular-nums px-2 py-0.5 rounded-full",
                      c.cr4 >= 25
                        ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400"
                        : c.cr4 >= 12
                        ? "text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400"
                        : c.cr4 > 0
                        ? "text-red-700 bg-red-50 dark:bg-red-950/40 dark:text-red-400"
                        : "text-muted-foreground"
                    )}>
                      {c.cr4 > 0 ? fmtPct(c.cr4) : '—'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Secondary KPI card ────────────────────────────────────────────────────────
function SecKPI({ label, value, sub }: {
  label: string; value: string; sub?: string;
}) {
  return (
    <motion.div
      variants={cardVariants}
      className="border border-border bg-card rounded-md p-5"
    >
      <p className="text-[22px] font-semibold text-foreground leading-none tabular-nums tracking-tight">{value}</p>
      <p className="text-[11px] font-medium text-muted-foreground mt-2 uppercase tracking-wide">{label}</p>
      {sub && <p className="text-[11px] text-muted-foreground/60 mt-1">{sub}</p>}
    </motion.div>
  );
}

// ── CR Benchmarks ─────────────────────────────────────────────────────────────
function CRBenchmarks({
  crs, benchmarks, isEditing, editValues, onToggleEdit, onEditChange, onSave, onCancel, isSaving, diagnosisData,
}: {
  crs: Record<string, number>;
  benchmarks: CRBenchmarkValues;
  isEditing: boolean;
  editValues: CRBenchmarkValues;
  onToggleEdit: () => void;
  onEditChange: (key: keyof CRBenchmarkValues, value: number) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  diagnosisData?: Record<string, RevOpsCRBenchmark>;
}) {
  const [expandedCR, setExpandedCR] = useState<string | null>(null);

  return (
    <div className="border border-border bg-card rounded-md overflow-hidden">
      <div className="px-6 py-5 border-b border-border flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-[15px] font-semibold text-foreground">CR Benchmarks</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">Taxas de conversão vs benchmark {isEditing ? '— editando metas' : 'de mercado'}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {isEditing ? (
            <>
              <button
                onClick={onCancel}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-md border border-border hover:bg-muted/40 transition-colors"
              >
                <X className="w-3 h-3" /> Cancelar
              </button>
              <button
                onClick={onSave}
                disabled={isSaving}
                className="flex items-center gap-1 text-[11px] text-primary-foreground bg-primary hover:bg-primary/90 px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50"
              >
                <Save className="w-3 h-3" /> {isSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </>
          ) : (
            <button
              onClick={onToggleEdit}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-md border border-border hover:bg-muted/40 transition-colors"
              title="Editar benchmarks"
            >
              <Settings2 className="w-3 h-3" /> Editar metas
            </button>
          )}
        </div>
      </div>
      <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {CR_DEFS.map(({ key, label, sub }) => {
          const val = crs[key] ?? 0;
          const bench = isEditing ? editValues[key] : benchmarks[key];
          const st = crStatus(bench, val);
          const pct = Math.min((val / bench) * 100, 100);
          const diag = diagnosisData?.[key];
          const hasDiagnosis = diag && diag.diagnosis.length > 0;
          const isExpanded = expandedCR === key;

          const barColor = st === 'good' ? 'bg-emerald-500'
            : st === 'medium' ? 'bg-amber-500'
            : 'bg-red-500';

          const valColor = st === 'good' ? 'text-emerald-600'
            : st === 'medium' ? 'text-amber-600'
            : 'text-red-600';

          const StatusIcon = st === 'good' ? CheckCircle2
            : st === 'medium' ? AlertTriangle
            : AlertCircle;

          const iconColor = st === 'good' ? 'text-emerald-500'
            : st === 'medium' ? 'text-amber-500'
            : 'text-red-500';

          return (
            <div key={key} className="border border-border rounded-md p-5 flex flex-col gap-2.5">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">{sub}</p>
                </div>
                <StatusIcon className={cn("w-3.5 h-3.5 flex-shrink-0 mt-0.5", iconColor)} />
              </div>

              <span className={cn('text-[28px] font-bold leading-none tabular-nums tracking-tight', valColor)}>
                {fmtPct(val)}
              </span>

              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-700", barColor)}
                  style={{ width: `${Math.max(pct, 4)}%` }}
                />
              </div>

              {isEditing ? (
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-muted-foreground/70">meta ≥</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={editValues[key]}
                    onChange={e => onEditChange(key, Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                    className="w-12 text-[11px] font-semibold text-foreground bg-background border border-border rounded-md px-1.5 py-0.5 tabular-nums text-center focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="text-[11px] text-muted-foreground/70">%</span>
                </div>
              ) : (
                <span className="text-[11px] text-muted-foreground/70 tabular-nums">meta ≥ {bench}%</span>
              )}

              {/* Diagnosis toggle — only for bad/medium */}
              {hasDiagnosis && !isEditing && (
                <button
                  onClick={() => setExpandedCR(isExpanded ? null : key)}
                  className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide mt-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {diag.diagnosis.length} {diag.diagnosis.length === 1 ? 'ponto' : 'pontos'}
                </button>
              )}

              {/* Collapsible diagnosis list */}
              {hasDiagnosis && isExpanded && !isEditing && (
                <div className="mt-1 pt-2.5 border-t border-border space-y-1.5 bg-muted/40 -mx-5 -mb-5 px-5 pb-4 pt-3 rounded-b-md">
                  {diag.diagnosis.map((d, i) => (
                    <p key={i} className="text-[11px] leading-snug text-muted-foreground">
                      • {d}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function EvoTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-md shadow-sm p-3 text-xs">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold text-foreground tabular-nums">{p.value.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function RevOpsTabSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className={GRID_KPIS_3}>
        {[0,1,2].map(i => <SkeletonBlock key={i} height={144} />)}
      </div>
      <SkeletonBlock height={288} />
      <div className={GRID_2COL}>
        <div className={GRID_SEC_KPIS}>
          {[0,1,2,3].map(i => <SkeletonBlock key={i} height={96} />)}
        </div>
        <SkeletonBlock height={208} />
      </div>
      <SkeletonBlock height={112} />
      <SkeletonBlock height={192} />
      <SkeletonBlock height={192} />
      <SkeletonBlock height={224} />
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  pipelineId?: string;
  scoreFilter?: number[];
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function BIProRevOpsTab({ period, dateFrom, dateTo, pipelineId, scoreFilter }: Props) {
  const shouldReduce = useReducedMotion();
  const { benchmarks: crBenchmarks, saveBenchmarks, DEFAULT_BENCHMARKS } = useCRBenchmarks();
  const { kpis, isLoading: kpisLoading, error: kpisError, refetch: refetchKpis } = useBIProKPIs({ period, dateFrom, dateTo, pipelineId, scoreFilter });
  const { data: revOps, isLoading: revOpsLoading, error: revOpsError, refetch: refetchRevOps } = useBIProRevOps({
    period, dateFrom, dateTo, pipelineId, scoreFilter,
    crBenchmarkOverrides: crBenchmarks,
  });
  const { selectedFunnel, error: funnelError, refetch: refetchFunnel } = useBIProFunnel({ period, dateFrom, dateTo, pipelineId, scoreFilter });

  // CR Benchmark editing state
  const [isEditingBenchmarks, setIsEditingBenchmarks] = useState(false);
  const [editBenchmarkValues, setEditBenchmarkValues] = useState<CRBenchmarkValues>(crBenchmarks);

  const handleToggleEdit = useCallback(() => {
    setEditBenchmarkValues(crBenchmarks);
    setIsEditingBenchmarks(true);
  }, [crBenchmarks]);

  const handleEditChange = useCallback((key: keyof CRBenchmarkValues, value: number) => {
    setEditBenchmarkValues(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSaveBenchmarks = useCallback(() => {
    saveBenchmarks.mutate(editBenchmarkValues, {
      onSuccess: () => setIsEditingBenchmarks(false),
    });
  }, [editBenchmarkValues, saveBenchmarks]);

  const handleCancelEdit = useCallback(() => {
    setIsEditingBenchmarks(false);
    setEditBenchmarkValues(crBenchmarks);
  }, [crBenchmarks]);

  if (kpisLoading || revOpsLoading) return <RevOpsTabSkeleton />;
  if (kpisError || revOpsError || funnelError || !kpis || !revOps) return (
    <BIProFeedback
      variant="error"
      title="Erro ao carregar dados RevOps"
      description={(kpisError ?? revOpsError ?? funnelError)?.message ?? 'Não foi possível carregar os dados. Verifique sua conexão e tente novamente.'}
      icon={AlertCircle}
      action={{ label: 'Tentar novamente', onClick: () => { refetchKpis(); refetchRevOps(); refetchFunnel(); } }}
    />
  );

  const { funnel, crs, byCloser, byCampaign, evolution } = revOps;

  const totalLeads = funnel[0]?.count ?? 0;
  const totalWin = funnel.find(s => s.key === 'win')?.count ?? 0;
  const overallCR = totalLeads > 0 ? (totalWin / totalLeads) * 100 : 0;

  const evoChartData = evolution.map(d => ({
    ...d,
    week: d.week.includes('-W') ? `W${d.week.split('-W')[1]}` : d.week,
  }));

  const animate = shouldReduce ? false : 'show';

  return (
    <div className="space-y-6">

      {/* ── Row 1: 3 Hero KPIs ────────────────────────────────────────── */}
      <motion.div
        className={GRID_KPIS_3}
        variants={containerVariants}
        initial="hidden"
        animate={animate}
      >
        <HeroKPI
          label="Receita Total"
          value={fmtK(kpis.totalRevenue)}
          sub={kpis.periodLabel}
          icon={DollarSign}
          trend={kpis.revenueGrowth}
        />
        <HeroKPI
          label="CAC Estimado"
          value={kpis.estimatedCAC !== null ? fmtBRL(kpis.estimatedCAC) : '—'}
          sub={kpis.estimatedCAC !== null ? 'custo por cliente adquirido' : 'conecte suas contas de Ads'}
          icon={Target}
        />
        <HeroKPI
          label="Conversão Global"
          value={fmtPct(overallCR)}
          sub={`${totalWin} ganhos de ${totalLeads} leads`}
          icon={TrendingUp}
          ring={{ value: overallCR }}
        />
      </motion.div>

      {/* ── Bottleneck Alert (conditional) ──────────────────────────── */}
      {selectedFunnel && (
        <BottleneckAlert
          bottleneckStageId={selectedFunnel.bottleneckStageId}
          bottleneckDropRate={selectedFunnel.bottleneckDropRate}
          stages={selectedFunnel.stages}
        />
      )}

      {/* ── Row 2: 3D Customer Journey Funnel ────────────────────────── */}
      <motion.div variants={rowVariants} initial="hidden" animate={animate}>
        <CustomerJourneyFunnel steps={funnel} />
      </motion.div>

      {/* ── Row 3: 4 KPIs secundários + Diagnóstico ──────────────────── */}
      <motion.div
        className={GRID_2COL}
        variants={containerVariants}
        initial="hidden"
        animate={animate}
      >
        <motion.div variants={cardVariants} className={GRID_SEC_KPIS}>
          <SecKPI
            label="Ticket Médio"
            value={kpis.avgDealValue > 0 ? fmtBRL(kpis.avgDealValue) : '—'}
            sub="por deal ganho"
          />
          <SecKPI
            label="Ciclo de Vendas"
            value={fmtDays(kpis.avgSalesCycle)}
            sub="criação ao fechamento"
          />
          <SecKPI
            label="Leads Novos"
            value={kpis.newLeads.toLocaleString('pt-BR')}
            sub="no período"
          />
          <SecKPI
            label="Receita Projetada"
            value={kpis.projectedRevenue > 0 ? fmtK(kpis.projectedRevenue) : '—'}
            sub="leads ativos"
          />
        </motion.div>

        {/* Diagnóstico */}
        <motion.div variants={cardVariants} className="border border-border bg-card rounded-md overflow-hidden">
          <div className="px-6 py-5 border-b border-border">
            <h3 className="text-[15px] font-semibold text-foreground">Diagnóstico do Período</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5">Indicadores-chave de saúde do funil</p>
          </div>
          <div className="p-4 space-y-2">
            {[
              { label: 'Leads ativos', value: kpis.activeLeads.toLocaleString('pt-BR'), accentClass: 'bg-primary' },
              { label: 'Leads perdidos', value: kpis.lostLeads.toLocaleString('pt-BR'), accentClass: 'bg-red-500' },
              { label: 'Lead → Reunião', value: fmtPct(kpis.leadToMeetingRate), accentClass: 'bg-primary/60' },
              { label: 'Reunião → WIN', value: fmtPct(kpis.meetingToWonRate), accentClass: 'bg-emerald-500' },
            ].map(({ label, value, accentClass }) => (
              <div
                key={label}
                className="flex items-center justify-between py-2.5 px-3 rounded-md bg-muted/40 hover:bg-muted/60 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className={cn("w-1 h-6 rounded-full flex-shrink-0", accentClass)} />
                  <span className="text-[12px] text-muted-foreground">{label}</span>
                </div>
                <span className="text-[14px] font-semibold text-foreground tabular-nums">{value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>

      {/* ── Row 4: CR Benchmarks ──────────────────────────────────────── */}
      <motion.div variants={rowVariants} initial="hidden" animate={animate}>
        <CRBenchmarks
          crs={crs}
          benchmarks={crBenchmarks}
          isEditing={isEditingBenchmarks}
          editValues={editBenchmarkValues}
          onToggleEdit={handleToggleEdit}
          onEditChange={handleEditChange}
          onSave={handleSaveBenchmarks}
          onCancel={handleCancelEdit}
          isSaving={saveBenchmarks.isPending}
          diagnosisData={revOps.benchmarks}
        />
      </motion.div>

      {/* ── Row 5: Stage Conversion Matrix ─────────────────────────── */}
      <StageConversionMatrix funnel={funnel} crs={crs} benchmarks={crBenchmarks} />

      {/* ── Row 6: Top Closers Table ──────────────────────────────────── */}
      <motion.div variants={rowVariants} initial="hidden" animate={animate}>
        <TopClosersTable closers={byCloser} />
      </motion.div>

      {/* ── Row 7: Campaign Performance ──────────────────────────────── */}
      <motion.div variants={rowVariants} initial="hidden" animate={animate}>
        <CampaignPerformanceTable campaigns={byCampaign} />
      </motion.div>

      {/* ── Row 8: Evolução semanal ───────────────────────────────────── */}
      {evoChartData.length > 1 && (
        <motion.div
          variants={rowVariants}
          initial="hidden"
          animate={animate}
          className="border border-border bg-card rounded-md overflow-hidden"
        >
          <div className="px-6 py-5 border-b border-border flex items-center justify-between gap-4">
            <div>
              <h3 className="text-[15px] font-semibold text-foreground">Evolução Semanal — CRs</h3>
              <p className="text-[12px] text-muted-foreground mt-0.5">Taxas de conversão ao longo das semanas</p>
            </div>
            <span className="text-[11px] font-medium text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full">
              {evoChartData.length} semanas
            </span>
          </div>
          <div className="p-6">
            <div className="flex items-center gap-5 mb-4 flex-wrap">
              {([
                { key: 'cr1', label: 'CR1 Lead→MQL',  color: '#3b82f6' },
                { key: 'cr2', label: 'CR2 MQL→SQL',   color: '#8b5cf6' },
                { key: 'cr3', label: 'CR3 SQL→SAL',   color: '#06b6d4' },
                { key: 'cr4', label: 'CR4 SAL→WIN',   color: '#10b981' },
              ] as const).map(({ key, label, color }) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className="w-7 h-0.5 rounded-full inline-block" style={{ backgroundColor: color }} />
                  <span className="text-[11px] text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>

            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={evoChartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <defs>
                  {([
                    { key: 'cr1', color: '#3b82f6' },
                    { key: 'cr2', color: '#8b5cf6' },
                    { key: 'cr3', color: '#06b6d4' },
                    { key: 'cr4', color: '#10b981' },
                  ] as const).map(({ key, color }) => (
                    <linearGradient key={key} id={`gEvo-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={color} stopOpacity={0.12} />
                      <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                <Tooltip content={<EvoTooltip />} />
                {([
                  { key: 'cr1', name: 'CR1', color: '#3b82f6' },
                  { key: 'cr2', name: 'CR2', color: '#8b5cf6' },
                  { key: 'cr3', name: 'CR3', color: '#06b6d4' },
                  { key: 'cr4', name: 'CR4', color: '#10b981' },
                ] as const).map(({ key, name, color }) => (
                  <Area key={key} type="monotone" dataKey={key} name={name}
                    stroke={color} strokeWidth={2} fill={`url(#gEvo-${key})`}
                    dot={false} activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

    </div>
  );
}
