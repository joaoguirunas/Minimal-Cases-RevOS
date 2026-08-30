import { useEffect, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell, PieChart, Pie,
} from "recharts";

// ── Chart Spec Schema ────────────────────────────────────────────────────────
export interface ChartSpec {
  type: 'bar' | 'line' | 'area' | 'horizontal-bar' | 'donut';
  title?: string;
  data: Array<Record<string, string | number>>;
  xKey: string;
  yKey: string;
  yKey2?: string;
  color?: string;
  height?: number;
  format?: 'brl' | 'pct' | 'number';
}

// ── Formatters ───────────────────────────────────────────────────────────────
const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const fmtNum = (v: number) => v.toLocaleString('pt-BR');

function getFormatter(format?: string) {
  if (format === 'brl') return fmtBRL;
  if (format === 'pct') return fmtPct;
  return fmtNum;
}

// ── Color palette ────────────────────────────────────────────────────────────
const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

// ── Dark mode detection ──────────────────────────────────────────────────────
function useIsDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const check = () => setDark(document.documentElement.classList.contains('dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

// ── Shared axis/grid props (resolved per-render for dark mode) ──────────────
function useChartTheme() {
  const dark = useIsDark();
  return {
    axisProps: { tick: { fontSize: 11, fill: dark ? '#94a3b8' : '#64748b' }, tickLine: false, axisLine: false },
    gridProps: { strokeDasharray: '3 3', stroke: dark ? '#334155' : '#e2e8f0', strokeOpacity: 0.5 },
    labelFill: dark ? '#94a3b8' : '#64748b',
  };
}

// ── Custom Tooltip ───────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-[2px] px-3 py-2 text-[11px]">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any, i: number) => (
        <p key={i} className="tabular-nums text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: p.color }} />
          {formatter(Number(p.value))}
        </p>
      ))}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function DynamicChart({ spec }: { spec: ChartSpec }) {
  const { type, title, data, xKey, yKey, yKey2, color, height = 220, format } = spec;
  const fmt = getFormatter(format);
  const primaryColor = color || COLORS[0];
  const { axisProps, gridProps, labelFill } = useChartTheme();

  if (!data?.length) return null;

  return (
    <div className="my-3 p-3 rounded-[2px] border border-border bg-card">
      {title && (
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">{title}</p>
      )}
      <ResponsiveContainer width="100%" height={height}>
        {type === 'bar' ? (
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey={xKey} {...axisProps} />
            <YAxis {...axisProps} tickFormatter={(v) => format === 'brl' ? `${(v/1000).toFixed(0)}k` : String(v)} />
            <Tooltip content={<ChartTooltip formatter={fmt} />} />
            <Bar dataKey={yKey} fill={primaryColor} radius={[4, 4, 0, 0]} maxBarSize={48} />
            {yKey2 && <Bar dataKey={yKey2} fill={COLORS[1]} radius={[4, 4, 0, 0]} maxBarSize={48} />}
          </BarChart>
        ) : type === 'horizontal-bar' ? (
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 60, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis type="number" {...axisProps} tickFormatter={(v) => format === 'brl' ? `${(v/1000).toFixed(0)}k` : String(v)} />
            <YAxis type="category" dataKey={xKey} {...axisProps} width={55} tick={{ fontSize: 10, fill: labelFill }} />
            <Tooltip content={<ChartTooltip formatter={fmt} />} />
            <Bar dataKey={yKey} fill={primaryColor} radius={[0, 4, 4, 0]} maxBarSize={28} />
          </BarChart>
        ) : type === 'line' ? (
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey={xKey} {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip content={<ChartTooltip formatter={fmt} />} />
            <Line type="monotone" dataKey={yKey} stroke={primaryColor} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            {yKey2 && <Line type="monotone" dataKey={yKey2} stroke={COLORS[1]} strokeWidth={2} dot={{ r: 3 }} />}
          </LineChart>
        ) : type === 'area' ? (
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={primaryColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey={xKey} {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip content={<ChartTooltip formatter={fmt} />} />
            <Area type="monotone" dataKey={yKey} stroke={primaryColor} strokeWidth={2} fill="url(#areaGrad)" />
          </AreaChart>
        ) : type === 'donut' ? (
          <PieChart>
            <Pie
              data={data}
              dataKey={yKey}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              innerRadius={height * 0.25}
              outerRadius={height * 0.38}
              paddingAngle={2}
              label={({ name, percent, x, y }) => (
                <text x={x} y={y} fill={labelFill} fontSize={11} textAnchor="middle" dominantBaseline="central">
                  {`${name} ${(percent * 100).toFixed(0)}%`}
                </text>
              )}
              labelLine={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip formatter={fmt} />} />
          </PieChart>
        ) : null}
      </ResponsiveContainer>
    </div>
  );
}
