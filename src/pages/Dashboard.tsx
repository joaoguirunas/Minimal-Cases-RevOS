import { lazy, Suspense, useEffect, useState } from "react";
import type { ComponentType } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { DateRange } from "react-day-picker";
import { TrendingUp, Briefcase, Megaphone, Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useBIProAdAccounts } from "@/hooks/useBIProAdAccounts";

import { useLoading } from "@/contexts/LoadingContext";
import StandardPageLoader from "@/components/loading/StandardPageLoader";
import SectionErrorBoundary from "@/components/error-boundaries/SectionErrorBoundary";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { useTranslation } from "@/hooks/useTranslation";

import BIProSummaryBar from "@/components/dashboard/BIProSummaryBar";

const BIProRevOpsTab    = lazy(() => import("@/components/dashboard/BIProRevOpsTab"));
const BIProComercialTab = lazy(() => import("@/components/dashboard/BIProComercialTab"));
const BIProMarketingTab = lazy(() => import("@/components/dashboard/BIProMarketingTab"));
const BIProInsightsTab  = lazy(() => import("@/components/dashboard/BIProInsightsTab"));

type TabKey = 'revops' | 'comercial' | 'marketing' | 'insights';

const TAB_TRIGGER_CLASS =
  'flex items-center gap-1.5 px-4 h-full text-[13px] font-medium transition-colors ' +
  'border-b-2 rounded-none bg-transparent shadow-none ' +
  'border-transparent text-muted-foreground hover:text-foreground ' +
  'data-[state=active]:border-primary data-[state=active]:text-foreground ' +
  'data-[state=active]:bg-transparent data-[state=active]:shadow-none';

const Dashboard = () => {
  const { t } = useTranslation();
  const { setLoading } = useLoading();
  const queryClient = useQueryClient();
  const { accounts, syncAccount } = useBIProAdAccounts();
  const [activeTab, setActiveTab] = useState<TabKey>('insights');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Shared filter state
  const [periodFilter,     setPeriodFilter]     = useState('today');
  const [customDateRange,  setCustomDateRange]  = useState<DateRange | undefined>(undefined);
  const [pipelineFilter,   setPipelineFilter]   = useState('all');
  const [scoreFilter,      setScoreFilter]      = useState<number[]>([]);

  const handleClearFilters = () => {
    setPeriodFilter('today');
    setCustomDateRange(undefined);
    setPipelineFilter('all');
    setScoreFilter([]);
  };

  const handlePeriodChange = (value: string) => {
    setPeriodFilter(value);
    if (value !== 'personalizado') setCustomDateRange(undefined);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['bi-pro-kpis'] });
    await queryClient.invalidateQueries({ queryKey: ['bi-pro-attribution'] });
    setIsRefreshing(false);
  };

  const handleMetaSync = async () => {
    const active = accounts.filter(a => a.is_active);
    if (active.length === 0 || isSyncing) return;
    setIsSyncing(true);
    const today = new Date();
    const ago = new Date(today);
    ago.setDate(today.getDate() - 30);
    for (const acc of active) {
      try {
        await syncAccount.mutateAsync({
          ad_account_id: acc.id,
          date_from: ago.toISOString().slice(0, 10),
          date_to: today.toISOString().slice(0, 10),
        });
      } catch { /* handled by mutation */ }
    }
    await queryClient.invalidateQueries({ queryKey: ['bi-pro-attribution'] });
    setIsSyncing(false);
  };

  const biProPeriod   = periodFilter !== 'personalizado' ? periodFilter : undefined;
  const biProDateFrom = periodFilter === 'personalizado' && customDateRange?.from
    ? customDateRange.from.toISOString() : undefined;
  const biProDateTo   = periodFilter === 'personalizado' && customDateRange?.to
    ? customDateRange.to.toISOString() : undefined;
  const biProPipeline = pipelineFilter !== 'all' ? pipelineFilter : undefined;

  useEffect(() => {
    setLoading('dashboard-init', true, 'Loading dashboard...');
    setTimeout(() => setLoading('dashboard-init', false), 800);
  }, [setLoading]);

  const tabs: Array<{
    key: TabKey;
    label: string;
    icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  }> = [
    { key: 'insights',  label: 'Insights',  icon: Sparkles   },
    { key: 'revops',    label: 'RevOps',    icon: TrendingUp },
    { key: 'comercial', label: 'Comercial', icon: Briefcase  },
    { key: 'marketing', label: 'Marketing', icon: Megaphone  },
  ];

  const tabLoader = (
    <div className="flex items-center justify-center h-64">
      <StandardPageLoader size="medium" message={t('dashboard.loading')} />
    </div>
  );

  return (
    <Tabs
      value={activeTab}
      onValueChange={v => setActiveTab(v as TabKey)}
      className="flex flex-col h-full"
    >
      {/* ── Tab bar — full-bleed, flush with header ──────────────────────── */}
      <div className="flex-none border-b border-border bg-zinc-100 dark:bg-zinc-950 h-[45px]">
        <div className="flex items-center h-full px-3 sm:px-6 overflow-x-auto scrollbar-none">
          <TabsList className="flex flex-1 justify-start items-center h-full bg-transparent p-0 rounded-none border-none gap-0">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.key}
                  value={tab.key}
                  className={TAB_TRIGGER_CLASS}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMetaSync}
              disabled={isSyncing}
              className="h-[30px] rounded-[4px] text-xs text-muted-foreground hover:text-foreground"
              title="Sincronizar Meta Ads"
            >
              {isSyncing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              <span className="hidden sm:inline">{isSyncing ? 'Sync...' : 'Meta Sync'}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-[30px] w-[30px] rounded-[4px] text-muted-foreground hover:text-foreground"
              title="Atualizar dados"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Filters bar — hidden on Insights (pure chat) ────────────────── */}
      {activeTab !== 'insights' && (
        <div className="flex-none border-b border-border bg-background">
          <div className="px-3 sm:px-6 py-2">
            <DashboardFilters
              periodFilter={periodFilter}
              customDateRange={customDateRange}
              pipelineFilter={pipelineFilter}
              scoreFilter={scoreFilter}
              onPeriodChange={handlePeriodChange}
              onCustomDateRangeChange={setCustomDateRange}
              onPipelineChange={setPipelineFilter}
              onScoreChange={setScoreFilter}
              onClearFilters={handleClearFilters}
            />
          </div>
        </div>
      )}

      {/* ── Scrollable content ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-3 sm:p-6">

          {/* ── Executive Summary Bar — only on RevOps (other tabs have their own KPIs) ──── */}
          {activeTab === 'revops' && (
            <div className="mb-5">
              <SectionErrorBoundary section="BI PRO Summary">
                <BIProSummaryBar
                  period={biProPeriod}
                  dateFrom={biProDateFrom}
                  dateTo={biProDateTo}
                  pipelineId={biProPipeline}
                  scoreFilter={scoreFilter}
                />
              </SectionErrorBoundary>
            </div>
          )}

          <TabsContent value="revops" className="mt-0 space-y-5">
            <SectionErrorBoundary section="BI PRO RevOps">
              <Suspense fallback={tabLoader}>
                <BIProRevOpsTab
                  period={biProPeriod}
                  dateFrom={biProDateFrom}
                  dateTo={biProDateTo}
                  pipelineId={biProPipeline}
                  scoreFilter={scoreFilter}
                />
              </Suspense>
            </SectionErrorBoundary>
          </TabsContent>

          <TabsContent value="comercial" className="mt-0">
            <SectionErrorBoundary section="BI PRO Comercial">
              <Suspense fallback={tabLoader}>
                <BIProComercialTab
                  period={biProPeriod}
                  dateFrom={biProDateFrom}
                  dateTo={biProDateTo}
                  pipelineId={biProPipeline}
                  scoreFilter={scoreFilter}
                />
              </Suspense>
            </SectionErrorBoundary>
          </TabsContent>

          <TabsContent value="marketing" className="mt-0 space-y-5">
            <SectionErrorBoundary section="BI PRO Marketing">
              <Suspense fallback={tabLoader}>
                <BIProMarketingTab
                  period={biProPeriod}
                  dateFrom={biProDateFrom}
                  dateTo={biProDateTo}
                  pipelineId={biProPipeline}
                  scoreFilter={scoreFilter}
                />
              </Suspense>
            </SectionErrorBoundary>
          </TabsContent>

          <TabsContent value="insights" className="mt-0 space-y-5">
            <SectionErrorBoundary section="BI PRO Insights">
              <Suspense fallback={tabLoader}>
                <BIProInsightsTab
                  period={biProPeriod}
                  dateFrom={biProDateFrom}
                  dateTo={biProDateTo}
                  pipelineId={biProPipeline}
                />
              </Suspense>
            </SectionErrorBoundary>
          </TabsContent>

        </div>
      </div>
    </Tabs>
  );
};

export default Dashboard;
