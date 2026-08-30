import { ArrowRight, CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { fmtPct, cardVariants, SECTION_CARD, TABLE_HEADER } from "./bipro-shared";
import type { RevOpsFunnelStep } from "@/hooks/useBIProRevOps";
import type { CRBenchmarkValues } from "@/hooks/useCRBenchmarks";

// ── Default benchmarks (fallback) ───────────────────────────────────────────
const DEFAULT_BENCH: CRBenchmarkValues = { cr1: 20, cr2: 40, cr3: 65, cr4: 25, cr5: 80 };

function statusFor(bench: number, value: number): 'good' | 'medium' | 'bad' {
  if (value >= bench) return 'good';
  if (value >= bench * 0.5) return 'medium';
  return 'bad';
}

const STATUS_STYLES = {
  good:   { text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50/60 dark:bg-emerald-950/30', border: 'border-emerald-200/60 dark:border-emerald-800/60', icon: CheckCircle2, iconCls: 'text-emerald-500' },
  medium: { text: 'text-amber-700 dark:text-amber-400',     bg: 'bg-amber-50/60 dark:bg-amber-950/30',     border: 'border-amber-200/60 dark:border-amber-800/60',     icon: AlertTriangle, iconCls: 'text-amber-400' },
  bad:    { text: 'text-red-600 dark:text-red-400',          bg: 'bg-red-50/60 dark:bg-red-950/30',         border: 'border-red-200/60 dark:border-red-800/60',          icon: AlertCircle,   iconCls: 'text-red-500' },
} as const;

const BAR_GRAD = {
  good: 'from-emerald-500 to-teal-400',
  medium: 'from-amber-400 to-orange-400',
  bad: 'from-red-500 to-rose-400',
} as const;

// ── Transition definitions ──────────────────────────────────────────────────
const TRANSITIONS = [
  { crKey: 'cr1', fromKey: 'lead',   toKey: 'mql',    label: 'CR1', from: 'Lead',  to: 'MQL' },
  { crKey: 'cr2', fromKey: 'mql',    toKey: 'sql',    label: 'CR2', from: 'MQL',   to: 'SQL' },
  { crKey: 'cr3', fromKey: 'sql',    toKey: 'sal',    label: 'CR3', from: 'SQL',   to: 'SAL' },
  { crKey: 'cr4', fromKey: 'sal',    toKey: 'win',    label: 'CR4', from: 'SAL',   to: 'WIN' },
  { crKey: 'cr5', fromKey: 'win',    toKey: 'commit', label: 'CR5', from: 'WIN',   to: 'COMMIT' },
] as const;

// ── Props ───────────────────────────────────────────────────────────────────
interface StageConversionMatrixProps {
  funnel: RevOpsFunnelStep[];
  crs: Record<string, number>;
  benchmarks?: CRBenchmarkValues;
}

export default function StageConversionMatrix({ funnel, crs, benchmarks }: StageConversionMatrixProps) {
  const shouldReduce = useReducedMotion();

  if (!funnel.length) return null;

  const stepMap = new Map(funnel.map(s => [s.key, s]));
  const bench = benchmarks ?? DEFAULT_BENCH;

  return (
    <motion.div
      className={SECTION_CARD}
      variants={shouldReduce ? undefined : cardVariants}
      initial={shouldReduce ? false : "hidden"}
      animate={shouldReduce ? false : "show"}
    >
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-[13px] font-semibold text-foreground">Matriz de Conversão por Etapa</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Conversão entre stages adjacentes do funil</p>
        </div>
        <span className="text-[11px] text-muted-foreground bg-muted border border-border px-2.5 py-1 rounded-full">
          {TRANSITIONS.length} transições
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className={cn("px-4 py-2.5 text-left", TABLE_HEADER)}>Transição</th>
              <th className={cn("px-4 py-2.5 text-right", TABLE_HEADER)}>Entrada</th>
              <th className={cn("px-4 py-2.5 text-right", TABLE_HEADER)}>Saída</th>
              <th className={cn("px-4 py-2.5 text-right", TABLE_HEADER)}>Perda</th>
              <th className={cn("px-4 py-2.5 text-center", TABLE_HEADER, "w-32")}>Taxa</th>
              <th className={cn("px-4 py-2.5 text-center", TABLE_HEADER, "w-28")}>vs Benchmark</th>
            </tr>
          </thead>
          <tbody>
            {TRANSITIONS.map(({ crKey, fromKey, toKey, label, from, to }) => {
              const fromStep = stepMap.get(fromKey);
              const toStep = stepMap.get(toKey);
              if (!fromStep || !toStep) return null;

              const crValue = crs[crKey] ?? 0;
              const crBench = bench[crKey as keyof CRBenchmarkValues] ?? 50;
              const status = statusFor(crBench, crValue);
              const style = STATUS_STYLES[status];
              const barPct = Math.min((crValue / crBench) * 100, 100);
              const StatusIcon = style.icon;
              const lost = fromStep.count - toStep.count;

              return (
                <tr
                  key={crKey}
                  className="border-b border-border last:border-0 hover:bg-muted transition-colors"
                >
                  {/* Transition label */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded",
                        style.bg, style.text, "border", style.border
                      )}>
                        {label}
                      </span>
                      <span className="text-[12px] text-muted-foreground flex items-center gap-1">
                        {from} <ArrowRight className="w-3 h-3 text-muted-foreground/40" /> {to}
                      </span>
                    </div>
                  </td>

                  {/* Entry count */}
                  <td className="px-4 py-3 text-right text-[13px] font-medium text-foreground tabular-nums">
                    {fromStep.count.toLocaleString('pt-BR')}
                  </td>

                  {/* Exit count */}
                  <td className="px-4 py-3 text-right text-[13px] font-semibold text-foreground tabular-nums">
                    {toStep.count.toLocaleString('pt-BR')}
                  </td>

                  {/* Lost count */}
                  <td className="px-4 py-3 text-right">
                    <span className="text-[12px] text-red-500/80 tabular-nums">
                      {lost > 0 ? `-${lost.toLocaleString('pt-BR')}` : '0'}
                    </span>
                  </td>

                  {/* CR value with progress bar */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-center gap-1">
                      <span className={cn("text-[14px] font-bold tabular-nums", style.text)}>
                        {fmtPct(crValue)}
                      </span>
                      <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700", BAR_GRAD[status])}
                          style={{ width: `${Math.max(barPct, 4)}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Benchmark comparison */}
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <StatusIcon className={cn("w-3.5 h-3.5", style.iconCls)} />
                      <span className="text-[11px] text-muted-foreground/70 tabular-nums">
                        meta ≥ {crBench}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
