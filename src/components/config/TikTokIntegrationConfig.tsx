import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const TikTokMegaConfig = lazy(() => import('@/components/config/TikTokMegaConfig'));
const TikTokAdsConfig  = lazy(() => import('@/components/config/TikTokAdsConfig'));

// ── TikTok Logo ───────────────────────────────────────────────────────────────

function TikTokLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.16 8.16 0 0 0 4.77 1.52V6.76a4.85 4.85 0 0 1-1-.07z" />
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Fallback() {
  return (
    <div className="min-h-[200px] flex items-center justify-center">
      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
    </div>
  );
}

// ── Tab definitions ───────────────────────────────────────────────────────────

const TAB_DEFS = [
  { value: 'dms', label: 'DMs (OMNI PRO)' },
  { value: 'ads', label: 'Ads (BI PRO)'   },
] as const;

type TikTokTab = (typeof TAB_DEFS)[number]['value'];
const VALID_TABS = TAB_DEFS.map((t) => t.value) as unknown as readonly TikTokTab[];

// ── Main export ───────────────────────────────────────────────────────────────

export default function TikTokIntegrationConfig() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawSection = searchParams.get('tiktok-section');
  const activeTab: TikTokTab =
    VALID_TABS.includes(rawSection as TikTokTab) ? (rawSection as TikTokTab) : 'dms';

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('tiktok-section', value);
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="pb-4 border-b border-border">
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-5 h-5 flex items-center justify-center text-foreground">
            <TikTokLogo size={16} />
          </div>
          <h1 className="text-[15px] font-semibold text-foreground">TikTok</h1>
        </div>
        <p className="text-[13px] text-muted-foreground/70">
          Configure DMs (OMNI PRO™) e anúncios (BI PRO™) em um único Developer App TikTok.
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="h-auto w-full justify-start gap-0 bg-muted border border-border rounded-[2px] p-1 flex-wrap">
          {TAB_DEFS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="text-[11px] h-[26px] px-3 data-[state=active]:bg-background data-[state=active]:rounded-[3px]"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <Suspense fallback={<Fallback />}>
          <TabsContent value="dms" className="mt-4">
            <TikTokMegaConfig />
          </TabsContent>

          <TabsContent value="ads" className="mt-4">
            <TikTokAdsConfig />
          </TabsContent>
        </Suspense>
      </Tabs>
    </div>
  );
}
