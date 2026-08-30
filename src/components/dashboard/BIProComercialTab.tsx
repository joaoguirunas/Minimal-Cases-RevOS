import { Fragment, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, Tooltip as RechartTooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  ChevronDown, ChevronRight, ChevronLeft,
  Flame, Snowflake, DollarSign, Target, Clock,
  Calendar, CheckCircle2, AlertCircle, RefreshCw,
  TrendingUp, TrendingDown, ExternalLink,
  Users, Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useBIProSchedules } from "@/hooks/useBIProSchedules";
import { useBIProCRM } from "@/hooks/useBIProCRM";
import { buildDateFilter } from "@/hooks/bipro-date-utils";
import {
  format, parseISO, getISOWeek, startOfISOWeek, endOfISOWeek, getYear,
} from "date-fns";
import {
  containerVariants, cardVariants,
  SECTION_CARD, TABLE_HEADER,
  BIProFeedback,
  SkeletonBlock,
  fmtNum,
  MetricCell,
  SectionCard,
} from "./bipro-shared";

// ─── ISO week helpers ─────────────────────────────────────────────────────────
function isoWeekKey(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    const w = getISOWeek(d);
    const y = getYear(startOfISOWeek(d));
    return `${y}-S${String(w).padStart(2, '0')}`;
  } catch { return dateStr; }
}

function isoWeekRange(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    return `${format(startOfISOWeek(d), 'dd/MM/yy')} – ${format(endOfISOWeek(d), 'dd/MM/yy')}`;
  } catch { return ''; }
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface WeekData {
  key:               string;
  range:             string;
  leads:             number;
  mqls:              number;
  mqlsL9:            number;
  mqlsL10:           number;
  leadToMqlPct:      number;
  agendamentos:      number;
  novasReunioes:     number;
  comparecimento:    number;
  noShow:            number;
  comparecimentoPct: number;
  faltaAtualizar:    number;
  vendas:            number;
}

interface CloserRow {
  userId:    string;
  name:      string;
  agendadas: number;
  realizadas: number;
  showPct:   number;
  noShow:    number;
  remarcadas: number;
  quente:    number;
  morno:     number;
  frio:      number;
  vendas:    number;
  convPct:   number;
}

type LeadRow = {
  id: string;
  score: number | null;
  created_at: string;
  status: string | null;
  won_at: string | null;
  clients_people?: { score: number | null } | null;
  user_id: string | null;
};

// ─── Weekly data builder ──────────────────────────────────────────────────────
function buildWeekData(
  evolution: Array<{ date: string; agendados: number; realizados: number; naoCompareceram: number; cancelados: number }>,
  leads: LeadRow[],
): WeekData[] {
  const meetMap = new Map<string, {
    date: string; totalMeetings: number; comparecimento: number;
    noShow: number; faltaAtualizar: number;
  }>();

  for (const d of evolution) {
    const key = isoWeekKey(d.date);
    if (!meetMap.has(key)) {
      meetMap.set(key, { date: d.date, totalMeetings: 0, comparecimento: 0, noShow: 0, faltaAtualizar: 0 });
    }
    const w = meetMap.get(key)!;
    w.totalMeetings  += d.agendados + d.realizados + d.naoCompareceram + d.cancelados;
    w.comparecimento += d.realizados;
    w.noShow         += d.naoCompareceram;
    w.faltaAtualizar += d.agendados;
  }

  const leadMap = new Map<string, { leads: number; mqls: number; mqlsL9: number; mqlsL10: number; vendas: number }>();
  for (const l of leads) {
    if (!l.created_at) continue;
    const key = isoWeekKey(l.created_at.slice(0, 10));
    if (!leadMap.has(key)) leadMap.set(key, { leads: 0, mqls: 0, mqlsL9: 0, mqlsL10: 0, vendas: 0 });
    const w = leadMap.get(key)!;
    w.leads++;
    const score = l.score ?? 0;
    if (score >= 9) {
      w.mqls++;
      if (score === 9) w.mqlsL9++;
      else if (score >= 10) w.mqlsL10++;
    }
    if (l.status === 'won') w.vendas++;
  }

  const allKeys = new Set([...meetMap.keys(), ...leadMap.keys()]);
  return [...allKeys].map(key => {
    const m = meetMap.get(key);
    const l = leadMap.get(key);
    const totalLeads     = l?.leads ?? 0;
    const mqls           = l?.mqls ?? 0;
    const comp           = m?.comparecimento ?? 0;
    const novas          = m?.totalMeetings ?? 0;
    return {
      key,
      range:             m?.date ? isoWeekRange(m.date) : '',
      leads:             totalLeads,
      mqls,
      mqlsL9:            l?.mqlsL9 ?? 0,
      mqlsL10:           l?.mqlsL10 ?? 0,
      leadToMqlPct:      totalLeads > 0 ? (mqls / totalLeads) * 100 : 0,
      agendamentos:      m?.faltaAtualizar ?? 0,
      novasReunioes:     novas,
      comparecimento:    comp,
      noShow:            m?.noShow ?? 0,
      comparecimentoPct: novas > 0 ? (comp / novas) * 100 : 0,
      faltaAtualizar:    m?.faltaAtualizar ?? 0,
      vendas:            l?.vendas ?? 0,
    };
  }).sort((a, b) => a.key.localeCompare(b.key));
}

// ─── Recharts color constants ─────────────────────────────────────────────────
const CHART_COLORS = {
  blue:    '#3B82F6',
  green:   '#22C55E',
  purple:  '#8B5CF6',
  orange:  '#F97316',
  mint:    '#86efac',
  red:     '#EF4444',
  amber:   '#F59E0B',
  muted:   '#6B7785',
  grid:    '#1E2936',
} as const;

// ─── Primitive components ─────────────────────────────────────────────────────
function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted-foreground/60">—</span>;
  const cls =
    score >= 10 ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25' :
    score === 9 ? 'bg-green-600/10 text-green-600 border-green-600/25' :
    score >= 7  ? 'bg-amber-500/10 text-amber-500 border-amber-500/25' :
                  'bg-muted text-muted-foreground/60 border-border';
  return (
    <span className={cn("inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums border", cls)}>
      S{score}
    </span>
  );
}

type Temperature = 'quente' | 'morno' | 'frio';

function classifyTemperature(score: number | null, leadStatus: string | null): Temperature {
  if (leadStatus === 'won' || (score != null && score >= 8)) return 'quente';
  if (leadStatus === 'lost' || (score != null && score <= 4)) return 'frio';
  return 'morno';
}

const TEMP_STYLES: Record<Temperature, { cls: string; icon: typeof Flame; label: string }> = {
  quente: { cls: 'bg-red-500/10 text-red-500 border-red-500/25', icon: Flame,     label: 'Quente' },
  morno:  { cls: 'bg-amber-500/10 text-amber-500 border-amber-500/25', icon: Target, label: 'Morno' },
  frio:   { cls: 'bg-blue-500/10 text-blue-500 border-blue-500/25', icon: Snowflake, label: 'Frio' },
};

function TemperatureBadge({ score, leadStatus }: { score: number | null; leadStatus: string | null }) {
  const temp = classifyTemperature(score, leadStatus);
  const s = TEMP_STYLES[temp];
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-bold border", s.cls)}>
      <Icon className="w-3 h-3" />
      {s.label}
    </span>
  );
}

function DeltaBadge({ prev, curr }: { prev: number; curr: number }) {
  if (!prev) return <span className="text-muted-foreground/40">—</span>;
  const pct = ((curr - prev) / prev) * 100;
  const up  = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-medium tabular-nums", up ? "text-emerald-500" : "text-red-500")}>
      <Icon className="w-2.5 h-2.5" />
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function Btn({
  children, active = false, onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 font-medium rounded-md border transition-colors text-[12px] px-2.5 py-1.5",
        active
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
      )}
    >
      {children}
    </button>
  );
}

function Td({
  children, colorClass, leftBorder = false, align = 'center'
}: {
  children: React.ReactNode;
  colorClass?: string;
  leftBorder?: boolean;
  align?: 'left' | 'center' | 'right';
}) {
  return (
    <td
      className={cn(
        "px-4 py-3.5 text-[13px] font-semibold tabular-nums",
        colorClass ?? "text-muted-foreground",
        leftBorder && "border-l border-border",
        align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center',
      )}
    >
      {children}
    </td>
  );
}

// ─── SEÇÃO 1 — Resumo Consolidado (KPI strip, matching Marketing pattern) ────
function ResumoConsolidado({
  kpis,
  byVendedor,
  closers,
}: {
  kpis: { total: number; showRate: number; noShows: number; remarcacoes: number; closingRate: number } | undefined;
  byVendedor: Array<{ fechamentos: number }>;
  closers: CloserRow[];
}) {
  const novas       = kpis?.total ?? 0;
  const showPct     = kpis?.showRate ?? 0;
  const comp        = Math.round(novas * showPct / 100);
  const noShow      = kpis?.noShows ?? 0;
  const atualizar   = kpis?.remarcacoes ?? 0;
  const closingRate = kpis?.closingRate ?? 0;
  const vendas      = byVendedor.reduce((s, v) => s + v.fechamentos, 0);
  const totalQuente = closers.reduce((s, c) => s + c.quente, 0);
  const totalMorno  = closers.reduce((s, c) => s + c.morno, 0);
  const totalFrio   = closers.reduce((s, c) => s + c.frio, 0);

  const showAccent = showPct >= 70 ? 'text-emerald-600' : showPct >= 50 ? 'text-amber-600' : 'text-red-600';
  const closingAccent = closingRate >= 30 ? 'text-emerald-600' : undefined;

  return (
    <div className={SECTION_CARD}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCell icon={Calendar} label="Novas Reuniões" value={fmtNum(novas)} />
        <MetricCell icon={CheckCircle2} label="Compareceram" value={fmtNum(comp)} className="lg:border-l border-border" />
        <MetricCell icon={Percent} label="Comparecimento" value={`${showPct.toFixed(0)}%`} accent={showAccent} className="lg:border-l border-border" />
        <MetricCell icon={AlertCircle} label="No Show" value={fmtNum(noShow)} accent={noShow > 0 ? 'text-red-600' : undefined} className="lg:border-l border-border" />
        <MetricCell icon={Clock} label="Atualizar" value={fmtNum(atualizar)} accent={atualizar > 0 ? 'text-amber-600' : undefined} className="lg:border-l border-border" />
      </div>
      <div className="border-t border-border" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCell icon={Flame} label="Prop. Quente" value={fmtNum(totalQuente)} accent={totalQuente > 0 ? 'text-red-600' : undefined} />
        <MetricCell icon={Target} label="Prop. Morna" value={fmtNum(totalMorno)} accent={totalMorno > 0 ? 'text-amber-600' : undefined} className="lg:border-l border-border" />
        <MetricCell icon={Snowflake} label="Prop. Fria" value={fmtNum(totalFrio)} className="lg:border-l border-border" />
        <MetricCell icon={DollarSign} label="Vendas" value={fmtNum(vendas)} accent={vendas > 0 ? 'text-emerald-600' : undefined} className="lg:border-l border-border" />
        <MetricCell icon={Percent} label="RR / Venda %" value={`${closingRate.toFixed(0)}%`} accent={closingAccent} className="lg:border-l border-border" />
      </div>
    </div>
  );
}

// ─── SEÇÃO 2+3 — Comparativo por Data + Evolução ─────────────────────────────
const SERIES_CFG = [
  { key: 'leads',            label: 'Leads',           color: CHART_COLORS.blue },
  { key: 'mqls',             label: 'Lead 8',          color: CHART_COLORS.green },
  { key: 'agendamentos',     label: 'Qualificação',    color: CHART_COLORS.purple },
  { key: 'novasReunioes',    label: 'Agendamentos',    color: CHART_COLORS.orange },
  { key: 'comparecimento',   label: 'Novas Reuniões',  color: CHART_COLORS.mint },
  { key: 'noShow',           label: 'Comparecimento',  color: '#34d399' },
  { key: 'comparecimentoPct',label: 'No-Show',         color: CHART_COLORS.red },
  { key: 'faltaAtualizar',   label: 'Comp. %',         color: CHART_COLORS.amber },
] as const;

type SeriesKey = typeof SERIES_CFG[number]['key'];

interface MetricDef {
  label:   string;
  key:     keyof WeekData;
  isChild?: boolean;
  noColor?: boolean;
}

const METRIC_ROWS: MetricDef[] = [
  { label: 'Leads Gerados',       key: 'leads' },
  { label: 'Lead 8',              key: 'mqls' },
  { label: '  → L9',              key: 'mqlsL9',    isChild: true },
  { label: '  → L10',             key: 'mqlsL10',   isChild: true },
  { label: 'Lead → Lead 8 %',     key: 'leadToMqlPct', noColor: true },
  { label: 'Qualificação',        key: 'agendamentos' },
  { label: '  > Agendamentos',    key: 'agendamentos', isChild: true },
  { label: 'Novas Reuniões',      key: 'novasReunioes' },
  { label: 'Comparecimento #',    key: 'comparecimento' },
  { label: 'No-Show #',           key: 'noShow' },
  { label: 'Comparecimento %',    key: 'comparecimentoPct', noColor: true },
  { label: 'Vendas',              key: 'vendas' },
];

function fmtMetric(v: number, key: keyof WeekData): string {
  if (key === 'leadToMqlPct' || key === 'comparecimentoPct') return `${v.toFixed(1)}%`;
  return v.toLocaleString('pt-BR');
}

function getValueColorClass(v: number, key: keyof WeekData, prev: number | undefined): string {
  if (prev === undefined) return 'text-foreground';
  const bad = key === 'noShow' || key === 'faltaAtualizar';
  if (v > prev) return bad ? 'text-red-400' : 'text-emerald-400';
  if (v < prev) return bad ? 'text-emerald-400' : 'text-red-400';
  return 'text-muted-foreground';
}

function ComparativoPorDataBlock({ weeks }: { weeks: WeekData[] }) {
  const [viewType,   setViewType]   = useState<'semana' | 'mes'>('semana');
  const [endIdx,     setEndIdx]     = useState(() => weeks.length - 1);
  const [activeSer,  setActiveSer]  = useState<Set<SeriesKey>>(
    () => new Set(['leads', 'mqls', 'comparecimento', 'noShow'])
  );

  const safeEnd   = Math.min(endIdx, weeks.length - 1);
  const safeStart = Math.max(0, safeEnd - 4);
  const display   = weeks.slice(safeStart, safeEnd + 1);
  const current   = display[display.length - 1];

  const toggleSeries = (k: SeriesKey) => {
    setActiveSer(s => {
      const n = new Set(s);
      if (n.has(k)) { if (n.size > 1) n.delete(k); } else n.add(k);
      return n;
    });
  };

  // Totals for KPI summary below chart
  const totalLeads = weeks.reduce((s, w) => s + w.leads, 0);
  const totalMqls  = weeks.reduce((s, w) => s + w.mqls, 0);
  const totalAgend = weeks.reduce((s, w) => s + w.agendamentos, 0);
  const totalComp  = weeks.reduce((s, w) => s + w.comparecimento, 0);
  const totalAll   = weeks.reduce((s, w) => s + w.novasReunioes, 0);
  const avgCompPct = totalAll > 0 ? (totalComp / totalAll) * 100 : 0;

  return (
    <SectionCard
      title="Comparativo de Período"
      subtitle="Métricas semanais lado a lado"
      right={
        <>
          <Btn active={viewType === 'semana'} onClick={() => setViewType('semana')}>Semana</Btn>
          <Btn active={viewType === 'mes'}    onClick={() => setViewType('mes')}>Mês</Btn>
          <div className="flex items-center gap-1 ml-1">
            <button
              className="w-7 h-7 flex items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setEndIdx(i => Math.max(4, i - 1))}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <select
              className="text-[12px] font-mono min-w-[100px] text-center text-foreground bg-card border border-border rounded px-1 py-0.5 cursor-pointer"
              value={safeEnd}
              onChange={e => setEndIdx(Number(e.target.value))}
            >
              {weeks.map((w, i) => (
                <option key={w.key} value={i}>
                  {w.key}  {w.range}
                </option>
              ))}
            </select>
            <button
              className="w-7 h-7 flex items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setEndIdx(i => Math.min(weeks.length - 1, i + 1))}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {current && (
            <span className="text-[11px] ml-1 text-muted-foreground/60">{current.range}</span>
          )}
        </>
      }
    >

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="bg-muted/40 border-b border-border">
              <th
                className={cn(TABLE_HEADER, "px-5 py-3 text-left")}
                style={{ width: 200 }}
              >
                Métrica
              </th>
              {display.map((w, i) => {
                const isCurrent = i === display.length - 1;
                return (
                  <th
                    key={w.key}
                    className={cn(
                      "px-4 py-3 text-center",
                      isCurrent && "border-l-2 border-l-primary",
                    )}
                    style={{ minWidth: 110 }}
                  >
                    <span className={cn(
                      "block text-[12px]",
                      isCurrent ? "text-foreground font-semibold" : "text-muted-foreground font-medium",
                    )}>
                      {w.key.split('-')[1]}
                    </span>
                    <span className="block text-[10px] mt-0.5 text-muted-foreground/60">
                      {w.range}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {METRIC_ROWS.map((m, mi) => (
              <tr
                key={`${m.key}-${mi}`}
                className="transition-colors group border-b border-border hover:bg-muted/40"
              >
                <td
                  className={cn(
                    "px-5 py-3.5 text-[13px]",
                    m.isChild ? "text-muted-foreground pl-10" : "text-muted-foreground font-medium",
                  )}
                >
                  {m.label}
                </td>
                {display.map((w, i) => {
                  const v    = w[m.key] as number;
                  const prev = i > 0 ? display[i - 1][m.key] as number : undefined;
                  const isCurrent = i === display.length - 1;
                  const colorCls = isCurrent && !m.noColor
                    ? getValueColorClass(v, m.key, prev)
                    : isCurrent ? 'text-foreground' : 'text-muted-foreground/70';
                  return (
                    <td
                      key={w.key}
                      className={cn(
                        "px-4 py-3.5 text-center",
                        isCurrent && "border-l-2 border-l-primary",
                      )}
                    >
                      <span className={cn("block text-[13px] font-semibold tabular-nums", colorCls)}>
                        {fmtMetric(v, m.key)}
                      </span>
                      {isCurrent && prev !== undefined && (
                        <span className="block mt-0.5">
                          <DeltaBadge prev={prev} curr={v} />
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* SEÇÃO 3 — Evolução por Semana */}
      <div className="border-t border-border px-6 pt-5 pb-5">
        <div className="flex items-center justify-between mb-4 gap-4">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Evolução no Período</p>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {SERIES_CFG.map(s => {
              const on = activeSer.has(s.key);
              return (
                <button
                  key={s.key}
                  onClick={() => toggleSeries(s.key)}
                  aria-pressed={on}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md border transition-colors",
                    on
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40",
                  )}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: on ? s.color : 'hsl(var(--muted-foreground) / 0.5)' }}
                  />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={weeks} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis
              dataKey="key"
              tick={{ fontSize: 11, fill: CHART_COLORS.muted }}
              tickLine={false}
              axisLine={false}
              tickFormatter={k => k.split('-')[1] ?? k}
            />
            <YAxis
              tick={{ fontSize: 11, fill: CHART_COLORS.muted }}
              tickLine={false}
              axisLine={false}
            />
            <RechartTooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 6,
                boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 600, marginBottom: 4 }}
              itemStyle={{ color: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            />
            {SERIES_CFG.filter(s => activeSer.has(s.key)).map(s => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={{ r: 3, fill: s.color, strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>

        {/* KPI summary below chart */}
        <div className="grid grid-cols-2 lg:grid-cols-4 mt-5 pt-5 border-t border-border">
          <MetricCell icon={Users} label="Total Leads" value={totalLeads.toLocaleString('pt-BR')} />
          <MetricCell icon={TrendingUp} label="Lead 8" value={totalMqls.toLocaleString('pt-BR')} className="lg:border-l border-border" />
          <MetricCell icon={Calendar} label="Agendamentos" value={totalAgend.toLocaleString('pt-BR')} className="lg:border-l border-border" />
          <MetricCell icon={Percent} label="Taxa Comparecimento" value={`${avgCompPct.toFixed(0)}%`} className="lg:border-l border-border" />
        </div>
      </div>
    </SectionCard>
  );
}

// ─── SEÇÃO 5 — Lead detail table (inside expanded closer row) ─────────────────
type DetailFilter = 'todos' | 'compareceu' | 'no_show' | 'atualizar' | 'remarcar';

type MeetingDetailRow = {
  meetingId:   string;
  leadId:      string | null;
  score:       number | null;
  status:      string | null;
  leadStatus:  string | null;
  venda:       boolean;
};

function CloserLeadTable({
  userId,
  dateFilter,
}: {
  userId:     string;
  dateFilter: { from: string; to: string } | null;
}) {
  const [filter, setFilter] = useState<DetailFilter>('todos');

  const { data = [], isLoading } = useQuery({
    queryKey: ['closer-lead-detail', userId, dateFilter?.from, dateFilter?.to],
    queryFn: async (): Promise<MeetingDetailRow[]> => {
      let q = supabase
        .from('meetings')
        .select('id, status, lead_id, lead:leads!meetings_leads_id_fkey(id, score, status)')
        .eq('user_id', userId);

      if (dateFilter) {
        q = q
          .gte('date', dateFilter.from.split('T')[0])
          .lte('date', dateFilter.to.split('T')[0]);
      }

      const { data: rows } = await q;
      return (rows ?? []).map((r: {
        id: string;
        status: string | null;
        lead_id: string | null;
        lead?: { id: string; score?: number | null; status?: string | null };
      }) => ({
        meetingId:   r.id,
        leadId:      r.lead?.id ?? r.lead_id,
        score:       r.lead?.score ?? null,
        status:      r.status,
        leadStatus:  r.lead?.status ?? null,
        venda:       r.lead?.status === 'won',
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  const counts = {
    todos:      data.length,
    compareceu: data.filter(r => r.status === 'compareceu').length,
    no_show:    data.filter(r => r.status === 'nao compareceu').length,
    atualizar:  data.filter(r => r.status === 'agendado').length,
    remarcar:   0,
  };

  const filtered = data.filter(r => {
    if (filter === 'compareceu') return r.status === 'compareceu';
    if (filter === 'no_show')    return r.status === 'nao compareceu';
    if (filter === 'atualizar')  return r.status === 'agendado';
    return true;
  });

  const filterChips: Array<{ key: DetailFilter; label: string }> = [
    { key: 'todos',      label: 'Todos' },
    { key: 'atualizar',  label: 'Atualizar' },
    { key: 'compareceu', label: 'Compareceu' },
    { key: 'no_show',    label: 'No Show' },
    { key: 'remarcar',   label: 'Remarcar' },
  ];

  const StatusIcon = ({ status }: { status: string | null }) => {
    if (status === 'compareceu')       return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    if (status === 'nao compareceu')   return <AlertCircle  className="w-4 h-4 text-red-500" />;
    if (status === 'agendado')         return <Clock        className="w-4 h-4 text-amber-500" />;
    return <RefreshCw className="w-4 h-4 text-muted-foreground/60" />;
  };

  return (
    <div className="px-6 py-5">
      {/* filter chips */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {filterChips.map(fc => {
          const active = filter === fc.key;
          const count  = counts[fc.key];
          return (
            <button
              key={fc.key}
              onClick={() => setFilter(fc.key)}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-2 text-[12px] font-medium px-3 py-1.5 rounded-md border transition-colors",
                active
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40",
              )}
            >
              {fc.label}
              <span
                className={cn(
                  "text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded",
                  active ? "bg-primary/15 text-primary" : "bg-muted/60 text-muted-foreground",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-2 py-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-8 rounded-md animate-pulse bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-[13px] py-6 text-center text-muted-foreground/60">
          Nenhum lead encontrado para este filtro.
        </p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {['Cliente', 'Score', 'Reunião', 'Temperatura', 'Venda', ''].map(h => (
                <th
                  key={h}
                  className={cn(TABLE_HEADER, "px-4 py-2.5 text-left")}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr
                key={r.meetingId}
                className="transition-colors border-b border-border last:border-0 hover:bg-muted/40"
              >
                <td className="px-4 py-3.5 text-[13px] font-medium text-foreground">
                  {r.leadId ? `#${r.leadId.slice(-8)}` : '—'}
                </td>
                <td className="px-4 py-3.5">
                  <ScoreBadge score={r.score} />
                </td>
                <td className="px-4 py-3.5">
                  <StatusIcon status={r.status} />
                </td>
                <td className="px-4 py-3.5">
                  <TemperatureBadge score={r.score} leadStatus={r.leadStatus} />
                </td>
                <td className="px-4 py-3.5">
                  <DollarSign
                    className={cn("w-4 h-4", r.venda ? "text-emerald-500" : "text-muted-foreground/30")}
                  />
                </td>
                <td className="px-4 py-3.5">
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/40 hover:text-primary cursor-pointer transition-colors" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── SEÇÃO 4 — Comparativo por Closer ─────────────────────────────────────────
type CloserFilter = 'todos' | 'atualizar' | 'compareceu' | 'no_show' | 'remarcar';

function CloserTable({
  closers,
  dateFilter,
}: {
  closers:    CloserRow[];
  dateFilter: { from: string; to: string } | null;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [closerFilter, setCloserFilter] = useState<CloserFilter>('todos');

  const toggle = (id: string) =>
    setExpandedId(prev => (prev === id ? null : id));

  // Filter counts
  const counts = useMemo(() => ({
    todos:       closers.length,
    atualizar:   closers.filter(c => c.remarcadas > 0).length,
    compareceu:  closers.filter(c => c.realizadas > 0).length,
    no_show:     closers.filter(c => c.noShow > 0).length,
    remarcar:    closers.filter(c => c.remarcadas > 0).length,
  }), [closers]);

  const filteredClosers = useMemo(() => {
    switch (closerFilter) {
      case 'atualizar':  return closers.filter(c => c.remarcadas > 0);
      case 'compareceu': return closers.filter(c => c.realizadas > 0);
      case 'no_show':    return closers.filter(c => c.noShow > 0);
      case 'remarcar':   return closers.filter(c => c.remarcadas > 0);
      default:           return closers;
    }
  }, [closers, closerFilter]);

  if (!closers.length) return (
    <BIProFeedback variant="empty" title="Sem dados de closers no período selecionado" />
  );

  const filterTabs: { id: CloserFilter; label: string }[] = [
    { id: 'todos',       label: 'Todos' },
    { id: 'atualizar',   label: 'Atualizar' },
    { id: 'compareceu',  label: 'Compareceu' },
    { id: 'no_show',     label: 'No Show' },
    { id: 'remarcar',    label: 'Remarcar' },
  ];

  return (
    <SectionCard
      title="Comparativo por Closer"
      subtitle="Ranking por performance de reuniões e vendas"
      badge={`${closers.length} closers`}
    >
      {/* Filter tabs */}
      <div className="flex items-center gap-2 px-6 py-3.5 border-b border-border flex-wrap">
        {filterTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setCloserFilter(tab.id)}
            aria-pressed={closerFilter === tab.id}
            className={cn(
              "inline-flex items-center gap-2 text-[12px] font-medium px-3 py-1.5 rounded-md border transition-colors",
              closerFilter === tab.id
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40",
            )}
          >
            {tab.label}
            <span className={cn(
              "text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded",
              closerFilter === tab.id ? "bg-primary/15 text-primary" : "bg-muted/60 text-muted-foreground",
            )}>
              {counts[tab.id]}
            </span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            {/* Group labels */}
            <tr className="bg-muted/40 border-b border-border">
              <th className="px-5 py-2" />
              <th
                colSpan={5}
                className={cn(TABLE_HEADER, "px-4 py-2 text-center border-l border-border")}
              >
                Reuniões
              </th>
              <th
                colSpan={3}
                className={cn(TABLE_HEADER, "px-4 py-2 text-center border-l border-border")}
                title="Quente: score ≥ 8 ou won | Morno: score 5-7 | Frio: score ≤ 4 ou lost"
              >
                Temperatura
              </th>
              <th
                colSpan={3}
                className={cn(TABLE_HEADER, "px-4 py-2 text-center border-l border-border")}
              >
                Vendas
              </th>
            </tr>
            {/* Sub-header row */}
            <tr className="bg-muted/40 border-b border-border">
              <th
                className={cn(TABLE_HEADER, "px-5 py-2.5 text-left")}
                style={{ minWidth: 180 }}
              >
                Closer
              </th>
              {/* Reunioes — texto curto */}
              <th className={cn(TABLE_HEADER, "px-4 py-2.5 text-center border-l border-border")} title="Agendadas">Agend.</th>
              <th className={cn(TABLE_HEADER, "px-4 py-2.5 text-center")} title="Compareceram">Real.</th>
              <th className={cn(TABLE_HEADER, "px-4 py-2.5 text-center")} title="Taxa de Comparecimento">Show%</th>
              <th className={cn(TABLE_HEADER, "px-4 py-2.5 text-center")} title="No Show">N/S</th>
              <th className={cn(TABLE_HEADER, "px-4 py-2.5 text-center")} title="Pendente">Pend.</th>
              {/* Temperatura — sub-headers preservados (HOLD D1) */}
              <th className="px-3 py-2.5 text-center border-l border-border" title="Quente">
                <Flame className="w-3.5 h-3.5 mx-auto text-red-500" />
              </th>
              <th className="px-3 py-2.5 text-center" title="Morno">
                <Target className="w-3.5 h-3.5 mx-auto text-amber-500" />
              </th>
              <th className="px-3 py-2.5 text-center" title="Frio">
                <Snowflake className="w-3.5 h-3.5 mx-auto text-blue-500" />
              </th>
              {/* Vendas — texto curto */}
              <th className={cn(TABLE_HEADER, "px-4 py-2.5 text-center border-l border-border")} title="Vendas">Vendas</th>
              <th className={cn(TABLE_HEADER, "px-4 py-2.5 text-center")} title="Conversão %">Conv.</th>
              <th className={cn(TABLE_HEADER, "px-4 py-2.5 text-center")} title="Conv % label">%</th>
            </tr>
          </thead>
          <tbody>
            {filteredClosers.map(c => {
              const expanded = expandedId === c.userId;
              return (
                <Fragment key={c.userId}>
                  <tr
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      expanded ? "bg-muted/60" : "hover:bg-muted/40",
                    )}
                    onClick={() => toggle(c.userId)}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0 bg-primary/10 text-primary">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[13px] font-medium text-foreground">{c.name}</span>
                        <span className="ml-auto">
                          {expanded
                            ? <ChevronDown  className="w-3.5 h-3.5 text-primary" />
                            : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                          }
                        </span>
                      </div>
                    </td>
                    {/* Reunioes */}
                    <Td leftBorder>{c.agendadas}</Td>
                    <Td>{c.realizadas}</Td>
                    <Td colorClass={c.showPct >= 70 ? 'text-emerald-600' : c.showPct >= 50 ? 'text-amber-600' : 'text-red-600'}>
                      {c.showPct.toFixed(0)}%
                    </Td>
                    <Td colorClass={c.noShow > 0 ? 'text-red-600' : 'text-muted-foreground'}>{c.noShow}</Td>
                    <Td>{c.remarcadas}</Td>
                    {/* Temperatura — preservado (HOLD D1) */}
                    <Td leftBorder colorClass={c.quente > 0 ? 'text-red-600' : undefined}>{c.quente}</Td>
                    <Td colorClass={c.morno > 0 ? 'text-amber-600' : undefined}>{c.morno}</Td>
                    <Td colorClass={c.frio > 0 ? 'text-blue-600' : undefined}>{c.frio}</Td>
                    {/* Vendas */}
                    <Td leftBorder colorClass={c.vendas > 0 ? 'text-emerald-600' : 'text-muted-foreground'}>{c.vendas}</Td>
                    <Td>{c.convPct.toFixed(0)}%</Td>
                    <Td colorClass={c.convPct >= 30 ? 'text-emerald-600' : c.convPct >= 15 ? 'text-amber-600' : 'text-muted-foreground'}>
                      {c.convPct.toFixed(0)}%
                    </Td>
                  </tr>

                  {/* Expanded lead detail (SEÇÃO 5) */}
                  {expanded && (
                    <tr className="border-b border-border">
                      <td colSpan={13} className="p-0">
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden bg-muted/30 border-t border-border"
                        >
                          <CloserLeadTable
                            userId={c.userId}
                            dateFilter={dateFilter}
                          />
                        </motion.div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function ComercialSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonBlock height={160} />
      <SkeletonBlock height={500} />
      <SkeletonBlock height={400} />
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  period?:      string;
  dateFrom?:    string;
  dateTo?:      string;
  pipelineId?:  string;
  scoreFilter?: number[];
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function BIProComercialTab({ period, dateFrom, dateTo, pipelineId, scoreFilter }: Props) {
  const shouldReduce = useReducedMotion();

  const dateFilter = useMemo(
    () => buildDateFilter(period ?? 'all', dateFrom, dateTo),
    [period, dateFrom, dateTo]
  );

  const { data: schedules, isLoading: schedLoading, error: schedError, refetch: refetchSched } =
    useBIProSchedules({ period, dateFrom, dateTo, pipelineId, scoreFilter });

  const { data: crm, isLoading: crmLoading, error: crmError, refetch: refetchCrm } =
    useBIProCRM({ period, dateFrom, dateTo, pipelineId, scoreFilter });

  const { data: leadsRaw = [], isLoading: leadsLoading, error: leadsError } = useQuery({
    queryKey: ['bi-comercial-leads', dateFilter?.from, dateFilter?.to, scoreFilter],
    queryFn: async (): Promise<LeadRow[]> => {
      let q = supabase
        .from('leads')
        .select('id, created_at, status, won_at, user_id, clients_people(score)');
      if (scoreFilter && scoreFilter.length > 0) {
        q = q
          .select('id, created_at, status, won_at, user_id, clients_people!inner(score)')
          .in('clients_people.score', scoreFilter);
      }
      if (dateFilter) {
        q = q
          .gte('created_at', dateFilter.from)
          .lte('created_at', dateFilter.to);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        score: (r.clients_people as { score: number | null } | null)?.score ?? null,
        created_at: r.created_at as string,
        status: r.status as string | null,
        won_at: r.won_at as string | null,
        user_id: r.user_id as string | null,
      })) as LeadRow[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
  });

  // ── All computed values (ABOVE any early return) ──────────────────────────
  const weeks = useMemo(
    () => buildWeekData(schedules?.evolution ?? [], leadsRaw),
    [schedules?.evolution, leadsRaw]
  );

  const closers = useMemo<CloserRow[]>(
    () => {
      const byVendedor = schedules?.byVendedor ?? [];
      const crmByV     = crm?.byVendedor       ?? [];
      return byVendedor.map(sv => {
        const cv  = crmByV.find(c => c.userId === sv.userId)
          ?? crmByV.find(c => c.user.toLowerCase() === sv.name.toLowerCase());
        const realized = Math.round(sv.agendamentos * sv.showRate / 100);
        const userLeads = leadsRaw.filter(l => l.user_id === sv.userId);
        let quente = 0, morno = 0, frio = 0;
        for (const l of userLeads) {
          const t = classifyTemperature(l.score, l.status);
          if (t === 'quente') quente++;
          else if (t === 'morno') morno++;
          else frio++;
        }
        return {
          userId:    sv.userId,
          name:      sv.name,
          agendadas: sv.agendamentos,
          realizadas: realized,
          showPct:   sv.showRate,
          noShow:    Math.max(0, sv.agendamentos - realized),
          remarcadas: 0,
          quente,
          morno,
          frio,
          vendas:    sv.fechamentos,
          convPct:   cv?.taxaConv ?? 0,
        };
      });
    },
    [schedules?.byVendedor, crm?.byVendedor, leadsRaw]
  );

  // ── Early return AFTER all hooks ──────────────────────────────────────────
  if (schedLoading || crmLoading || leadsLoading) return <ComercialSkeleton />;
  if (schedError || crmError || leadsError) return (
    <BIProFeedback
      variant="error"
      title="Erro ao carregar dados comerciais"
      description={(schedError ?? crmError ?? leadsError)?.message ?? 'Não foi possível carregar os dados. Verifique sua conexão e tente novamente.'}
      icon={AlertCircle}
      action={{ label: 'Tentar novamente', onClick: () => { refetchSched(); refetchCrm(); } }}
    />
  );

  const animate = shouldReduce ? false : 'show';

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate={animate}
    >
      {/* SEÇÃO 1 — Resumo Consolidado (topo) */}
      <motion.div variants={cardVariants}>
        <ResumoConsolidado kpis={schedules?.kpis} byVendedor={schedules?.byVendedor ?? []} closers={closers} />
      </motion.div>

      {/* SEÇÃO 2+3 — Comparativo por Data + Evolução por Semana */}
      <motion.div variants={cardVariants}>
        <ComparativoPorDataBlock weeks={weeks} />
      </motion.div>

      {/* SEÇÃO 4+5 — Comparativo por Closer + detail expandido */}
      <motion.div variants={cardVariants}>
        <CloserTable closers={closers} dateFilter={dateFilter} />
      </motion.div>
    </motion.div>
  );
}
