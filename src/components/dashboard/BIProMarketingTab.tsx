import { motion, useReducedMotion } from "framer-motion";
import {
  Globe2, AlertCircle,
  DollarSign, Eye, MousePointerClick, Percent, BarChart3, Users, Target, TrendingUp,
  Layers,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import { useBIProAttribution } from "@/hooks/useBIProAttribution";
import type { ChannelAttribution, CampaignAttribution, TimeSeriesPoint } from "@/hooks/useBIProAttribution";
import { fmtBRL, fmtBRL2, fmtK, fmtPct, fmtNum, fmtNumK, cardVariants, rowVariants, SECTION_CARD, TABLE_HEADER, STATUS_COLORS, BIProFeedback, SkeletonBlock, MetricCell, SectionCard } from "./bipro-shared";

// ── Platform colors ───────────────────────────────────────────────────────────
const PLATFORM_COLORS: Record<string, string> = {
  meta:     '#1877F2',
  google:   '#34A853',
  organic:  '#22c55e',
  direct:   '#94a3b8',
  linkedin: '#0A66C2',
  email:    '#f97316',
  youtube:  '#FF0000',
};

const getPlatformColor = (p: string) => PLATFORM_COLORS[p.toLowerCase()] ?? '#6366f1';

const CHART_COLORS = {
  spend:  '#8B5CF6',
  leads:  '#3B82F6',
  clicks: '#F97316',
  grid:   'hsl(var(--border))',
  muted:  '#A1A1AA',
};

// ── ROI badge ─────────────────────────────────────────────────────────────────
function ROIBadge({ roi }: { roi: number | null }) {
  if (roi === null) return <span className="text-[12px] text-muted-foreground">—</span>;
  const sc = roi > 0 ? STATUS_COLORS.good : STATUS_COLORS.bad;
  return (
    <span className={cn("text-[12px] font-bold px-2 py-0.5 rounded-full tabular-nums border", sc.text, sc.bg, sc.border)}>
      {roi > 0 ? '+' : ''}{fmtPct(roi)}
    </span>
  );
}

// ── Trend line chart ──────────────────────────────────────────────────────────
function TrendChart({ data }: { data: TimeSeriesPoint[] }) {
  if (data.length < 2) return null;

  return (
    <div className="px-6 py-5 border-t border-border">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Evolução no Período</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: CHART_COLORS.muted }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 10, fill: CHART_COLORS.muted }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 10, fill: CHART_COLORS.muted }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}`}
          />
          <RechartTooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 6,
              boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
              fontSize: 11,
            }}
            labelStyle={{ color: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 600, marginBottom: 4 }}
            itemStyle={{ color: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            formatter={(value: number, name: string) => {
              if (name === 'Investimento' || name === 'CPL') return [`R$ ${value.toFixed(0)}`, name];
              return [value.toLocaleString('pt-BR'), name];
            }}
          />
          <Line yAxisId="left" type="monotone" dataKey="leads" name="Leads" stroke={CHART_COLORS.leads} strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS.leads, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
          <Line yAxisId="right" type="monotone" dataKey="spend" name="Investimento" stroke={CHART_COLORS.spend} strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS.spend, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
          <Line yAxisId="left" type="monotone" dataKey="clicks" name="Cliques" stroke={CHART_COLORS.clicks} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-5 mt-2">
        {[
          { color: CHART_COLORS.leads, label: 'Leads' },
          { color: CHART_COLORS.spend, label: 'Investimento' },
          { color: CHART_COLORS.clicks, label: 'Cliques', dashed: true },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span
              className="w-3 h-0.5 rounded-full inline-block"
              style={{
                backgroundColor: s.dashed ? 'transparent' : s.color,
                ...(s.dashed ? { backgroundImage: `repeating-linear-gradient(90deg, ${s.color} 0 4px, transparent 4px 7px)` } : {}),
              }}
            />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Unified attribution table (Canal + Campanha share same columns) ──────────
type AttrRow = {
  name: string;
  platform: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  cpm: number | null;
  leads: number;
  cpl: number | null;
  won: number;
  roi: number | null;
};

function AttrTable({ rows, nameHeader, emptyIcon, emptyTitle, emptyDesc }: {
  rows: AttrRow[];
  nameHeader: string;
  emptyIcon?: React.ElementType;
  emptyTitle?: string;
  emptyDesc?: string;
}) {
  if (!rows.length) {
    const Icon = emptyIcon ?? Globe2;
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        <Icon className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="font-medium">{emptyTitle ?? 'Sem dados disponíveis'}</p>
        {emptyDesc && <p className="text-xs mt-1">{emptyDesc}</p>}
      </div>
    );
  }

  const headers = [nameHeader, 'Invest.', 'Impr.', 'Cliques', 'CTR', 'CPM', 'Leads', 'CPL', 'Ganhos', 'ROI'];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px]">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {headers.map(h => (
              <th
                key={h}
                className={cn(
                  TABLE_HEADER, "px-4 py-3 whitespace-nowrap",
                  h === nameHeader ? 'text-left' : 'text-right'
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 10).map((row, i) => {
            const isTop = i === 0;
            return (
              <tr
                key={`${row.name}-${row.platform}-${i}`}
                className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
              >
                <td className={cn(
                  "px-4 py-3.5 max-w-[240px]",
                  isTop && "border-l-2 border-l-primary",
                )}>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: getPlatformColor(row.platform) }}
                      title={row.platform}
                    />
                    <span className="text-[13px] font-medium text-foreground truncate" title={row.name}>
                      {row.name}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-right text-[13px] text-muted-foreground tabular-nums">
                  {row.spend > 0 ? fmtK(row.spend) : '—'}
                </td>
                <td className="px-4 py-3.5 text-right text-[13px] text-muted-foreground tabular-nums">
                  {row.impressions > 0 ? fmtNumK(row.impressions) : '—'}
                </td>
                <td className="px-4 py-3.5 text-right text-[13px] text-muted-foreground tabular-nums">
                  {row.clicks > 0 ? fmtNum(row.clicks) : '—'}
                </td>
                <td className="px-4 py-3.5 text-right text-[13px] text-muted-foreground tabular-nums">
                  {row.ctr !== null ? fmtPct(row.ctr) : '—'}
                </td>
                <td className="px-4 py-3.5 text-right text-[13px] text-muted-foreground tabular-nums">
                  {row.cpm !== null ? fmtBRL2(row.cpm) : '—'}
                </td>
                <td className="px-4 py-3.5 text-right text-[13px] font-semibold text-foreground tabular-nums">
                  {fmtNum(row.leads)}
                </td>
                <td className="px-4 py-3.5 text-right text-[13px] text-muted-foreground tabular-nums">
                  {row.cpl !== null ? fmtBRL(row.cpl) : '—'}
                </td>
                <td className="px-4 py-3.5 text-right text-[13px] font-bold text-foreground tabular-nums">
                  {fmtNum(row.won)}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <ROIBadge roi={row.roi} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function MarketingSkeleton() {
  return (
    <div className="space-y-5">
      <SkeletonBlock height={130} />
      <SkeletonBlock height={320} />
      <SkeletonBlock height={320} />
      <SkeletonBlock height={208} />
      <SkeletonBlock height={160} />
    </div>
  );
}

// ── Helpers: convert attribution data to unified rows ─────────────────────────
function channelToRows(channels: ChannelAttribution[]): AttrRow[] {
  return channels.map(c => ({
    name: c.channel,
    platform: c.platform,
    spend: c.totalAdSpend,
    impressions: c.impressions,
    clicks: c.clicks,
    ctr: c.ctr,
    cpm: c.cpm,
    leads: c.totalLeads,
    cpl: c.costPerLead,
    won: c.wonLeads,
    roi: c.roi,
  }));
}

function campaignToRows(campaigns: CampaignAttribution[]): AttrRow[] {
  return campaigns.map(c => ({
    name: c.campaignName,
    platform: c.platform,
    spend: c.totalAdSpend,
    impressions: c.impressions,
    clicks: c.clicks,
    ctr: c.ctr,
    cpm: c.cpm,
    leads: c.totalLeads,
    cpl: c.costPerLead,
    won: c.wonLeads,
    roi: c.roi,
  }));
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  pipelineId?: string;
  scoreFilter?: number[];
}

// ── Main component ────────────────────────────────────────────────────────────
export default function BIProMarketingTab({ period, dateFrom, dateTo, pipelineId, scoreFilter }: Props) {
  const shouldReduce = useReducedMotion();
  const { attribution, isLoading, error, refetch } = useBIProAttribution({ period, dateFrom, dateTo, pipelineId, scoreFilter });

  if (isLoading) return <MarketingSkeleton />;
  if (error || !attribution) return (
    <BIProFeedback
      variant="error"
      title="Erro ao carregar dados de marketing"
      description={error?.message ?? 'Não foi possível carregar os dados. Verifique sua conexão e tente novamente.'}
      icon={AlertCircle}
      action={{ label: 'Tentar novamente', onClick: () => refetch() }}
    />
  );

  const animate = shouldReduce ? false : 'show';

  const byChannel = attribution?.byChannel ?? [];
  const byCampaign = attribution?.byCampaign ?? [];
  const formPro = attribution?.formPro;
  const timeSeries = attribution?.timeSeries ?? [];
  const totalSpend = attribution?.totalTrackedSpend ?? 0;
  const totalImpressions = attribution?.totalImpressions ?? 0;
  const totalClicks = attribution?.totalClicks ?? 0;
  const totalRevenue = attribution?.totalRevenue ?? 0;
  const totalLeads = attribution?.totalPeriodLeads ?? 0;
  const overallCTR = attribution?.overallCTR ?? null;
  const overallCPM = attribution?.overallCPM ?? null;
  const overallROI = attribution?.overallROI ?? null;
  const overallCPL = totalSpend > 0 && totalLeads > 0 ? totalSpend / totalLeads : null;
  const coverage = attribution?.attributionCoverage ?? 0;

  const roiAccent = overallROI !== null
    ? overallROI > 0 ? 'text-emerald-600' : 'text-red-600'
    : undefined;

  const attributedLeads = byCampaign.reduce((sum, c) => sum + c.totalLeads, 0);
  const unattributedLeads = Math.max(0, totalLeads - attributedLeads);

  return (
    <div className="space-y-6">

      {/* ── KPI Summary Strip ──────────────────────────────────────────── */}
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate={animate}
        className={SECTION_CARD}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4">
          <MetricCell icon={DollarSign} label="Investimento" value={totalSpend > 0 ? fmtK(totalSpend) : '—'} />
          <MetricCell icon={Eye} label="Impressões" value={totalImpressions > 0 ? fmtNumK(totalImpressions) : '—'} className="sm:border-l border-border" />
          <MetricCell icon={MousePointerClick} label="Cliques" value={totalClicks > 0 ? fmtNum(totalClicks) : '—'} className="sm:border-l border-border" />
          <MetricCell icon={Percent} label="CTR" value={overallCTR !== null ? fmtPct(overallCTR) : '—'} className="sm:border-l border-border" />
        </div>
        <div className="border-t border-border" />
        <div className="grid grid-cols-2 sm:grid-cols-4">
          <MetricCell icon={BarChart3} label="CPM" value={overallCPM !== null ? fmtBRL2(overallCPM) : '—'} />
          <MetricCell
            icon={Users}
            label="Leads"
            value={totalLeads > 0 ? fmtNum(totalLeads) : '—'}
            sub={attributedLeads > 0 && unattributedLeads > 0 ? `${attributedLeads} atribuídos · ${unattributedLeads} orgânico` : undefined}
            className="sm:border-l border-border"
          />
          <MetricCell icon={Target} label="CPL" value={overallCPL !== null ? fmtBRL(overallCPL) : '—'} className="sm:border-l border-border" />
          <MetricCell
            icon={TrendingUp}
            label="ROI"
            value={overallROI !== null ? `${overallROI > 0 ? '+' : ''}${fmtPct(overallROI)}` : '—'}
            accent={roiAccent}
            className="sm:border-l border-border"
          />
        </div>
      </motion.div>

      {/* ── Por Canal ──────────────────────────────────────────────────── */}
      <motion.div variants={rowVariants} initial="hidden" animate={animate}>
        <SectionCard
          title="Por Canal"
          subtitle="Performance por fonte de tráfego"
          badge={coverage > 0 ? `Cobertura: ${fmtPct(coverage)}` : (byChannel.length > 0 ? `${byChannel.length} canais` : undefined)}
        >
          <AttrTable
            rows={channelToRows(byChannel)}
            nameHeader="Canal"
            emptyTitle="Nenhum dado de canal disponível"
            emptyDesc="Aguardando leads com UTMs ou sincronização de contas."
          />
          <TrendChart data={timeSeries} />
        </SectionCard>
      </motion.div>

      {/* ── Por Campanha ───────────────────────────────────────────────── */}
      <motion.div variants={rowVariants} initial="hidden" animate={animate}>
        <SectionCard
          title="Por Campanha"
          subtitle="Performance detalhada por campanha de anúncios"
          badge={byCampaign.length > 0 ? `${byCampaign.length} campanha${byCampaign.length !== 1 ? 's' : ''}` : undefined}
        >
          <AttrTable
            rows={campaignToRows(byCampaign)}
            nameHeader="Campanha"
            emptyIcon={Globe2}
            emptyTitle="Nenhuma campanha sincronizada"
            emptyDesc="Use o botão Sincronizar acima ou conecte contas em Integrações."
          />
          {byCampaign.length > 0 && unattributedLeads > 0 && (
            <div className="px-6 py-3 border-t border-border text-[12px] text-muted-foreground flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
              {attributedLeads} de {totalLeads} leads atribuídos a campanhas — {unattributedLeads} via orgânico/direto
            </div>
          )}
        </SectionCard>
      </motion.div>

      {/* ── Por Grupo de Anúncios ──────────────────────────────────────── */}
      <motion.div variants={rowVariants} initial="hidden" animate={animate}>
        <SectionCard
          title="Por Grupo de Anúncios"
          subtitle="Performance por ad set / grupo de anúncios"
        >
          <div className="py-12 text-center text-muted-foreground">
            <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-[13px] font-medium">Em breve</p>
            <p className="text-[12px] mt-1 text-muted-foreground/70">
              Dados de grupos de anúncios serão sincronizados na próxima versão.
            </p>
          </div>
        </SectionCard>
      </motion.div>

      {/* ── FORM PRO™ ──────────────────────────────────────────────────── */}
      {formPro && (formPro.totalLeads > 0 || formPro.byForm.length > 0) && (
        <motion.div variants={rowVariants} initial="hidden" animate={animate}>
          <div className={SECTION_CARD}>
            <div className="px-6 py-5 border-b border-border">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-[15px] font-semibold text-foreground">FORM PRO — Formulários</h3>
                  <p className="text-[12px] text-muted-foreground mt-0.5">Leads e conversões por formulário</p>
                </div>
                <div className="flex items-center gap-3 text-[12px]">
                  <span className="text-muted-foreground tabular-nums">{fmtNum(formPro.totalLeads)} leads</span>
                  <span className="text-emerald-600 font-semibold tabular-nums">{fmtNum(formPro.wonLeads)} ganhos</span>
                  {formPro.revenue > 0 && (
                    <span className="text-[12px] font-semibold text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full tabular-nums">
                      {fmtK(formPro.revenue)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {formPro.byForm.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      {['Formulário', 'Leads', 'Ganhos', 'Receita', 'Conv%'].map(h => (
                        <th
                          key={h}
                          className={cn(
                            TABLE_HEADER, "px-4 py-3",
                            h === 'Formulário' ? 'text-left' : 'text-right'
                          )}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {formPro.byForm.map((form) => {
                      const sc = form.conversionRate >= 15 ? STATUS_COLORS.good : form.conversionRate >= 5 ? STATUS_COLORS.medium : STATUS_COLORS.bad;
                      return (
                        <tr key={form.formId} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                          <td className="px-4 py-3.5">
                            <span className="text-[13px] font-medium text-foreground truncate max-w-[280px] block">{form.formName}</span>
                          </td>
                          <td className="px-4 py-3.5 text-right text-[13px] text-muted-foreground tabular-nums">{fmtNum(form.totalLeads)}</td>
                          <td className="px-4 py-3.5 text-right text-[13px] font-bold text-foreground tabular-nums">{fmtNum(form.wonLeads)}</td>
                          <td className="px-4 py-3.5 text-right text-[13px] tabular-nums text-foreground">
                            {form.revenue > 0 ? fmtK(form.revenue) : '—'}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full tabular-nums border", sc.text, sc.bg, sc.border)}>
                              {fmtPct(form.conversionRate)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {totalRevenue === 0 && byChannel.length === 0 && (
        <motion.div variants={rowVariants} initial="hidden" animate={animate}>
          <BIProFeedback
            variant="nodata"
            title="Sem dados de atribuição"
            description="Sincronize suas contas Meta Ads ou aguarde UTMs nos formulários."
            icon={Globe2}
          />
        </motion.div>
      )}

    </div>
  );
}
