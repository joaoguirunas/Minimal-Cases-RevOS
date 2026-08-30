import { useState, useEffect } from 'react';
import {
  CheckCircle2, XCircle, AlertTriangle, Loader2,
  RefreshCw, Eye, EyeOff, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useBIProSettings } from '@/hooks/useBIProSettings';
import { toast } from 'sonner';

// ── TikTok Logo ───────────────────────────────────────────────────────────────

function TikTokLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.16 8.16 0 0 0 4.77 1.52V6.76a4.85 4.85 0 0 1-1-.07z" />
    </svg>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-[4px] p-4 space-y-3">
      <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">{title}</p>
      {children}
    </div>
  );
}

// ── Status pill ───────────────────────────────────────────────────────────────

type StatusType = 'idle' | 'ok' | 'warn' | 'error' | 'loading';

function StatusPill({ status, label }: { status: StatusType; label: string }) {
  const styles: Record<StatusType, string> = {
    idle:    'bg-muted text-muted-foreground border-border',
    ok:      'bg-emerald-500/8 text-emerald-600 dark:text-emerald-400 border-emerald-200/30',
    warn:    'bg-amber-500/8 text-amber-600 dark:text-amber-400 border-amber-200/30',
    error:   'bg-red-500/8 text-red-600 dark:text-red-400 border-red-200/30',
    loading: 'bg-muted text-muted-foreground border-border',
  };
  const icons: Record<StatusType, React.ReactNode> = {
    idle:    null,
    ok:      <CheckCircle2 className="w-3 h-3" strokeWidth={1.5} />,
    warn:    <AlertTriangle className="w-3 h-3" strokeWidth={1.5} />,
    error:   <XCircle className="w-3 h-3" strokeWidth={1.5} />,
    loading: <Loader2 className="w-3 h-3 animate-spin" strokeWidth={1.5} />,
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border leading-none ${styles[status]}`}>
      {icons[status]}
      {label}
    </span>
  );
}

// ── Ad account row ────────────────────────────────────────────────────────────

interface AdAccount {
  advertiser_id: string;
  advertiser_name: string;
  selected: boolean;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function TikTokAdsConfig() {
  const { settings, isLoading, saveSettings } = useBIProSettings();

  // Local credential fields (stored in bi_settings via any cast — columns added by migration T-04)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = settings as any;

  const [appId,     setAppId]     = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [syncing,   setSyncing]   = useState(false);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);

  const isConnected = !!(s?.tiktok_access_token && s?.tiktok_advertiser_id);
  const advertiserId = s?.tiktok_advertiser_id as string | undefined;
  const lastSync    = s?.tiktok_last_sync as string | undefined;

  useEffect(() => {
    if (isLoading) return;
    setAppId(s?.tiktok_app_id ?? '');
    setAppSecret(s?.tiktok_app_secret ? '••••••••' : '');
    if (advertiserId) {
      setAdAccounts([{
        advertiser_id: advertiserId,
        advertiser_name: s?.tiktok_advertiser_name ?? advertiserId,
        selected: true,
      }]);
    }
  }, [isLoading, s?.tiktok_app_id, s?.tiktok_app_secret, advertiserId, s?.tiktok_advertiser_name]);

  const isMasked = (v: string) => v === '••••••••';

  const handleSaveCredentials = () => {
    const update: Record<string, string | null> = { tiktok_app_id: appId || null };
    if (!isMasked(appSecret)) update.tiktok_app_secret = appSecret || null;
    saveSettings.mutate(update as Parameters<typeof saveSettings.mutate>[0], {
      onSuccess: () => toast.success('Credenciais TikTok salvas'),
      onError: (err: Error) => toast.error(`Erro: ${err.message}`),
    });
  };

  const handleConnectOAuth = () => {
    if (!appId) {
      toast.error('Configure o App ID antes de conectar');
      return;
    }
    const state = crypto.randomUUID();
    sessionStorage.setItem('tiktok_oauth_state', state);

    const redirectUri = `${window.location.origin}/tiktok/callback`;
    const oauthUrl = new URL('https://business-api.tiktok.com/portal/auth');
    oauthUrl.searchParams.set('app_id', appId);
    oauthUrl.searchParams.set('state', state);
    oauthUrl.searchParams.set('redirect_uri', redirectUri);
    // Ads scopes
    oauthUrl.searchParams.set('scope', 'advertiser.read,report.read,campaign.read,adgroup.read,ad.read');
    window.location.href = oauthUrl.toString();
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('tiktok-ads-sync', {});
      if (error) throw error;
      toast.success('Sincronização TikTok Ads concluída!');
    } catch (err) {
      toast.error(`Erro na sincronização: ${(err as Error).message}`);
    } finally {
      setSyncing(false);
    }
  };

  if (isLoading) return <Skeleton className="h-40 w-full rounded-[4px]" />;

  const oauthStatus: StatusType = isConnected ? 'ok' : 'idle';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[4px] bg-muted flex items-center justify-center text-foreground">
          <TikTokLogo size={18} />
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-semibold text-foreground">TikTok Ads</p>
          <p className="text-[11px] text-muted-foreground/70">
            Sincronize gastos e métricas de campanhas TikTok no BI PRO™
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={oauthStatus} label={isConnected ? 'OAuth ativo' : 'Desconectado'} />
        </div>
      </div>

      {/* Section 1 — App credentials */}
      <Section title="Credenciais do App TikTok">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground flex items-center gap-1.5">
              App ID
              {s?.tiktok_app_id && <CheckCircle2 className="w-3 h-3 text-emerald-500" strokeWidth={1.5} />}
            </Label>
            <Input
              placeholder="7xxxxxxxxxxxxx"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              className="h-[30px] text-[13px] font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground flex items-center gap-1.5">
              App Secret
              {s?.tiktok_app_secret && <CheckCircle2 className="w-3 h-3 text-emerald-500" strokeWidth={1.5} />}
            </Label>
            <div className="relative">
              <Input
                type={showSecret ? 'text' : 'password'}
                placeholder="••••••••"
                value={appSecret}
                onFocus={(e) => { if (isMasked(e.target.value)) setAppSecret(''); }}
                onChange={(e) => setAppSecret(e.target.value)}
                className="h-[30px] text-[13px] font-mono pr-8"
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showSecret ? 'Ocultar' : 'Exibir'}
              >
                {showSecret
                  ? <EyeOff className="w-3.5 h-3.5" strokeWidth={1.5} />
                  : <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />}
              </button>
            </div>
          </div>
        </div>
        <Button
          size="sm"
          onClick={handleSaveCredentials}
          disabled={saveSettings.isPending}
          className="w-full h-[30px] text-[13px] gap-1.5"
        >
          {saveSettings.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />}
          Salvar credenciais
        </Button>
      </Section>

      {/* Section 2 — OAuth connection */}
      <Section title="Conexão OAuth">
        {isConnected && advertiserId && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-[4px] border border-emerald-500/20 bg-emerald-500/5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" strokeWidth={1.5} />
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 flex-1">
              Conta conectada — Advertiser ID: <code className="font-mono">{advertiserId}</code>
            </p>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Autorize o CRM a acessar os dados de campanhas TikTok Ads. Você será redirecionado para o TikTok Business Center.
        </p>
        <Button
          onClick={handleConnectOAuth}
          disabled={!appId}
          variant={isConnected ? 'outline' : 'default'}
          className="h-[32px] text-[12px] gap-2"
        >
          <TikTokLogo size={14} />
          {isConnected ? 'Reconectar TikTok Ads' : 'Conectar TikTok Ads'}
          <ExternalLink className="w-3 h-3 ml-auto" strokeWidth={1.5} />
        </Button>
        {!appId && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" strokeWidth={1.5} />
            Configure o App ID nas Credenciais acima antes de conectar
          </p>
        )}
      </Section>

      {/* Section 3 — Ad accounts (post-OAuth) */}
      {isConnected && adAccounts.length > 0 && (
        <Section title="Ad Accounts">
          <div className="space-y-2">
            {adAccounts.map((acc) => (
              <div
                key={acc.advertiser_id}
                className="flex items-center justify-between px-3 py-2 rounded-[4px] border border-border"
              >
                <div>
                  <p className="text-[12px] font-medium text-foreground">{acc.advertiser_name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{acc.advertiser_id}</p>
                </div>
                <StatusPill status="ok" label="Ativo" />
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Section 4 — Sync */}
      <Section title="Sincronização">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12px] text-foreground font-medium">Última sincronização</p>
            <p className="text-[11px] text-muted-foreground">
              {lastSync
                ? new Date(lastSync).toLocaleString('pt-BR')
                : 'Nenhuma sincronização realizada'}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSyncNow}
            disabled={!isConnected || syncing}
            className="h-[30px] text-[12px] gap-1.5"
          >
            {syncing
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
              : <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />}
            {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Sincronização automática a cada 6 horas via pg_cron após ativação.
        </p>
      </Section>
    </div>
  );
}
