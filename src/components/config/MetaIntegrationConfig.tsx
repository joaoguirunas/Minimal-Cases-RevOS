import { lazy, Suspense, useState, useEffect, useCallback, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import NewContactSection from '@/components/config/NewContactSection';
import { useOmniNewContactSettings } from '@/hooks/useOmniNewContactSettings';
import { usePipelines, useStages } from '@/hooks/usePipelinesReal';
import {
  CheckCircle2, XCircle, RefreshCw, Webhook, AlertTriangle, Search, UserPlus, MessageSquareReply, Loader2,
  Link2, Eye, EyeOff, TriangleAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBIProSettings } from '@/hooks/useBIProSettings';
import { supabase, supabaseUrl } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CopyableField } from '@/components/common/CopyableField';
import { useOmniChannelConfig, useUpdateOmniChannelConfig } from '@/hooks/useOmniChannelConfig';
import { useInstagramTokenStatus } from '@/hooks/useOmniChannelAlerts';
import { useToast } from '@/hooks/use-toast';
import ChannelHealthBadge from '@/components/config/ChannelHealthBadge';
import { cn } from '@/lib/utils';

const WhatsappChannelsConfig  = lazy(() => import('@/components/config/WhatsappChannelsConfig'));
const WhatsappTemplatesConfig = lazy(() =>
  import('@/components/config/WhatsappTemplatesConfig').then((m) => ({ default: m.WhatsappTemplatesConfig })),
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function SuspenseFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
    </div>
  );
}

// ── Validation result ─────────────────────────────────────────────────────────

interface ValidationResult {
  ok?: boolean;
  error?: string;
  system_user_name?: string;
  instagram_username?: string;
  page_name?: string;
  ad_accounts_count?: number;
  ad_accounts_error?: string;
  permissions_granted?: number;
  permissions_total?: number;
  missing_permissions?: string[];
}

function ValidationSection({ result }: { result: ValidationResult }) {
  const Check = ({ ok, label }: { ok: boolean; label: string }) => (
    <div className="flex items-start gap-2 text-[12px]">
      {ok
        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" strokeWidth={1.5} />
        : <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" strokeWidth={1.5} />}
      <span className={ok ? 'text-foreground' : 'text-red-400'}>{label}</span>
    </div>
  );

  if (!result.ok && result.error && !result.system_user_name) {
    return (
      <div className="border border-red-500/20 rounded-lg p-4 space-y-2 bg-red-500/5">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Resultado da validação</p>
        <div className="flex items-start gap-2 text-[12px]">
          <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" strokeWidth={1.5} />
          <span className="text-red-400">{result.error}</span>
        </div>
      </div>
    );
  }

  const tokenOk = !!result.system_user_name;
  const igOk    = !!result.instagram_username;
  const pageOk  = !!result.page_name;
  const adsOk   = result.ad_accounts_count !== undefined && !result.ad_accounts_error;
  const missingPerms = result.missing_permissions ?? [];
  const permsOk = missingPerms.length === 0;

  return (
    <div className="border border-border rounded-lg p-4 space-y-2">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Resultado da validação</p>
      <Check
        ok={tokenOk}
        label={tokenOk ? `Token — Usuário do Sistema: ${result.system_user_name}` : `Token — ${result.error ?? 'inválido'}`}
      />
      <Check
        ok={igOk}
        label={igOk ? `Instagram — @${result.instagram_username}` : 'Instagram — não encontrado'}
      />
      <Check
        ok={pageOk}
        label={pageOk ? `Página — ${result.page_name}` : 'Página — não encontrada'}
      />
      <Check
        ok={adsOk}
        label={adsOk
          ? `Contas de anúncio — ${result.ad_accounts_count} conta(s) sincronizada(s)`
          : `Contas de anúncio — não foi possível listar`}
      />
      <div className="flex items-start gap-2 text-[12px]">
        {permsOk
          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" strokeWidth={1.5} />
          : <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" strokeWidth={1.5} />}
        <div>
          <span className={permsOk ? 'text-foreground' : 'text-amber-400'}>
            Permissões — {result.permissions_granted ?? 0}/{result.permissions_total ?? 10} concedidas
          </span>
          {missingPerms.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {missingPerms.map((p) => (
                <li key={p} className="text-[11px] text-amber-400 font-mono">{p}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ── WhatsApp first-reply section ──────────────────────────────────────────────

function WhatsAppFirstReplySection({ compact }: { compact?: boolean }) {
  const { settings, isLoading, updateSetting, isUpdating } = useOmniNewContactSettings();
  const { data: allPipelines = [] } = usePipelines();
  const { data: allStages = [] } = useStages();

  const waSetting = settings.find(s => s.channel === 'whatsapp') ?? {
    id: '', channel: 'whatsapp' as const,
    auto_create_negocio: false, pipeline_id: null, stage_id: null, title_template: '',
    on_first_reply_enabled: false, on_first_reply_stage_id: null,
  };

  const [localPipelineId, setLocalPipelineId] = useState<string | null>(waSetting.pipeline_id);

  const stagesForPipeline = allStages.filter(
    s => s.pipeline_id === localPipelineId || s.leads_pipelines_id === localPipelineId
  );

  const handleToggle = useCallback(
    (checked: boolean) => updateSetting({ channel: 'whatsapp', on_first_reply_enabled: checked }),
    [updateSetting]
  );
  const handlePipeline = useCallback((value: string) => {
    setLocalPipelineId(value);
    updateSetting({ channel: 'whatsapp', pipeline_id: value, on_first_reply_stage_id: null });
  }, [updateSetting]);
  const handleStage = useCallback(
    (value: string) => updateSetting({ channel: 'whatsapp', on_first_reply_stage_id: value }),
    [updateSetting]
  );

  const disabled = !waSetting.on_first_reply_enabled;

  if (isLoading) return (
    <div className="flex items-center justify-center py-6">
      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
    </div>
  );

  const inner = (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-foreground">Ativar automação</span>
        <div className="flex items-center gap-2">
          {isUpdating && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
          <Switch checked={waSetting.on_first_reply_enabled} onCheckedChange={handleToggle} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[12px] text-muted-foreground">Pipeline</Label>
          <Select value={localPipelineId ?? ''} onValueChange={handlePipeline} disabled={disabled}>
            <SelectTrigger className="h-8 text-[13px]">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {allPipelines.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[12px] text-muted-foreground">Mover para etapa</Label>
          <Select
            value={waSetting.on_first_reply_stage_id ?? ''}
            onValueChange={handleStage}
            disabled={disabled || !localPipelineId}
          >
            <SelectTrigger className="h-8 text-[13px]">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {stagesForPipeline.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  if (compact) return inner;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5 px-1">
        <MessageSquareReply className="w-4 h-4 text-muted-foreground/50 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-medium text-foreground">Primeira mensagem recebida</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Move automaticamente para a etapa configurada. Só dispara uma vez por lead.
          </p>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        {inner}
      </div>
    </div>
  );
}

// ── Instagram channel config query ────────────────────────────────────────────

interface OmniChannelCredentials {
  instagram_business_id?: string;
  page_id?: string;
  access_token?: string;
  token_expires_at?: string;
  [key: string]: unknown;
}

function useInstagramChannelConfig() {
  return useQuery({
    queryKey: ['omni_channel_configs', 'instagram'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('omni_channel_configs')
        .select('credentials')
        .eq('channel', 'instagram')
        .maybeSingle();
      if (error) throw error;
      return (data?.credentials as OmniChannelCredentials) ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ── StepBadge ─────────────────────────────────────────────────────────────────

function StepBadge({ n, done }: { n: number; done?: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold shrink-0',
      done ? 'bg-green-500/15 text-green-600' : 'bg-muted text-muted-foreground',
    )}>
      {done ? '✓' : n}
    </span>
  );
}

// ── Tab definitions ────────────────────────────────────────────────────────────

type MetaTab = 'geral' | 'whatsapp' | 'instagram';

// ── Credenciais section ───────────────────────────────────────────────────────

interface CredenciaisProps {
  settings: ReturnType<typeof useBIProSettings>['settings'];
  queryClient: ReturnType<typeof useQueryClient>;
  igCredentials: OmniChannelCredentials | null;
  igLoading: boolean;
}

function CredenciaisSection({ settings, queryClient, igCredentials, igLoading }: CredenciaisProps) {
  const [appId,       setAppId]       = useState('');
  const [appSecret,   setAppSecret]   = useState('');
  const [systemToken, setSystemToken] = useState('');
  const [isPending,   setIsPending]   = useState(false);
  const [validation,  setValidation]  = useState<ValidationResult | null>(null);

  interface DiscoveredPage {
    id: string;
    name: string;
    instagram_business_account?: { id: string; name?: string; username?: string };
  }
  const [discovering,    setDiscovering]    = useState(false);
  const [discoverError,  setDiscoverError]  = useState<string | null>(null);
  const [pages,          setPages]          = useState<DiscoveredPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState('');
  const selectedPage = pages.find(p => p.id === selectedPageId) ?? null;
  const instagramBusinessId = selectedPage?.instagram_business_account?.id ?? '';
  const pageId = selectedPageId;

  useEffect(() => {
    setAppId(settings?.meta_app_id ?? '');
    setAppSecret(settings?.meta_app_secret ? '••••••••' : '');
  }, [settings?.meta_app_id, settings?.meta_app_secret]);

  useEffect(() => {
    if (igLoading || !igCredentials || pages.length > 0) return;
    const savedPageId = igCredentials.page_id ?? '';
    if (savedPageId) {
      setPages([{
        id: savedPageId,
        name: 'Página configurada',
        instagram_business_account: igCredentials.instagram_business_id
          ? { id: igCredentials.instagram_business_id }
          : undefined,
      }]);
      setSelectedPageId(savedPageId);
    }
  }, [igLoading, igCredentials, pages.length]);

  const handleDiscover = async () => {
    const token = systemToken.trim();
    if (!token) { setDiscoverError('Cole o System User Token primeiro.'); return; }
    setDiscovering(true);
    setDiscoverError(null);
    setPages([]);
    setSelectedPageId('');
    try {
      const url = `https://graph.facebook.com/v25.0/me/accounts?fields=id,name,instagram_business_account{id,name,username}&access_token=${encodeURIComponent(token)}`;
      const res = await fetch(url);
      const json = await res.json() as { data?: DiscoveredPage[]; error?: { message: string } };
      if (json.error) { setDiscoverError(json.error.message); return; }
      const list = json.data ?? [];
      if (list.length === 0) { setDiscoverError('Nenhuma Página encontrada para este token. Verifique se o Usuário do Sistema tem acesso às Páginas no Business Manager.'); return; }
      setPages(list);
      if (list.length === 1) setSelectedPageId(list[0].id);
    } catch {
      setDiscoverError('Erro ao contactar o Graph API. Verifique a sua conexão.');
    } finally {
      setDiscovering(false);
    }
  };

  const isMasked = (v: string) => v === '••••••••';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setValidation(null);
    try {
      const { data, error } = await supabase.functions.invoke('meta-save-credentials', {
        body: {
          app_id: appId,
          app_secret: isMasked(appSecret) ? undefined : appSecret,
          system_token: systemToken,
          instagram_business_id: instagramBusinessId,
          page_id: pageId,
        },
      });
      if (error) {
        setValidation({ ok: false, error: error.message });
      } else {
        setValidation(data as ValidationResult);
        queryClient.invalidateQueries({ queryKey: ['bi-pro-settings'] });
        queryClient.invalidateQueries({ queryKey: ['omni_channel_configs', 'instagram'] });
      }
    } catch (err: unknown) {
      setValidation({ ok: false, error: err instanceof Error ? err.message : 'Erro desconhecido' });
    } finally {
      setIsPending(false);
    }
  };

  const tokenSavedAt = (settings as (typeof settings & { meta_system_token_saved_at?: string | null }) | null)
    ?.meta_system_token_saved_at;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* App Meta */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">App Meta</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[13px]">App ID</Label>
              <Input
                placeholder="123456789"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">App Secret</Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={appSecret}
                onFocus={(e) => { if (isMasked(e.target.value)) setAppSecret(''); }}
                onChange={(e) => setAppSecret(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>
        </div>
        <p className="text-[12px] text-muted-foreground">
          Encontre em: Meta Business Suite → Configurações → App → Configurações Básicas
        </p>
      </div>

      {/* System User Token */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">System User Token</p>
        <div className="space-y-1.5">
          <Label className="text-[13px]">Token de Acesso</Label>
          <Textarea
            rows={3}
            placeholder="Cole o token gerado no Meta Business Manager → Usuários do Sistema → Gerar Token"
            value={systemToken}
            onChange={(e) => setSystemToken(e.target.value)}
            className="font-mono resize-none text-[12px]"
          />
          {tokenSavedAt ? (
            <p className="text-[12px] text-muted-foreground">
              Token salvo em{' '}
              {new Date(tokenSavedAt).toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}. Preencha acima para substituir.
            </p>
          ) : (
            <p className="text-[12px] text-muted-foreground">
              Meta Business Manager → Configurações → Usuários do Sistema → selecione o usuário → Gerar Token
            </p>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleDiscover}
          disabled={discovering || !systemToken.trim()}
          className="w-full gap-1.5"
        >
          {discovering
            ? <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
            : <Search className="w-3.5 h-3.5" strokeWidth={1.5} />}
          {discovering ? 'Buscando contas...' : 'Descobrir Páginas e contas Instagram'}
        </Button>

        {discoverError && (
          <p className="text-[12px] text-destructive leading-relaxed">{discoverError}</p>
        )}

        {pages.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-border">
            <Label className="text-[13px] mt-3 block">Página conectada</Label>
            <Select value={selectedPageId} onValueChange={setSelectedPageId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma Página..." />
              </SelectTrigger>
              <SelectContent>
                {pages.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {p.instagram_business_account?.username
                      ? ` · @${p.instagram_business_account.username}`
                      : p.instagram_business_account?.id
                        ? ' · Instagram vinculado'
                        : ' · sem Instagram vinculado'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPage && !selectedPage.instagram_business_account && (
              <p className="text-[12px] text-amber-600 dark:text-amber-400">
                Esta Página não tem conta Instagram Business vinculada. Vincule em Business Manager → Contas → Contas do Instagram.
              </p>
            )}
            {selectedPage?.instagram_business_account && (
              <p className="text-[12px] text-muted-foreground font-mono">
                Instagram ID: {selectedPage.instagram_business_account.id} · Página ID: {selectedPage.id}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        {!selectedPageId && pages.length === 0 && systemToken.trim() ? (
          <p className="text-[12px] text-muted-foreground">
            Clique em "Descobrir" para listar as contas disponíveis
          </p>
        ) : <span />}
        <Button
          type="submit"
          size="sm"
          disabled={isPending || !selectedPageId}
          className="gap-1.5 min-w-[140px]"
        >
          {isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />}
          {isPending ? 'Salvando...' : 'Salvar e validar'}
        </Button>
      </div>

      {validation && <ValidationSection result={validation} />}
    </form>
  );
}

// ── Instagram section (absorbed from InstagramMegaConfig) ─────────────────────

function InstagramSection() {
  const { data: config, isLoading } = useOmniChannelConfig('instagram');
  const { mutate: update, isPending: saving } = useUpdateOmniChannelConfig();
  const { data: tokenStatus } = useInstagramTokenStatus();
  const { toast } = useToast();
  const { settings: biSettings } = useBIProSettings();

  const [isActive, setIsActive] = useState(false);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [igSettings, setIgSettings] = useState<Record<string, unknown>>({});
  const [businessHours, setBusinessHours] = useState({
    enabled: false,
    timezone: 'America/Sao_Paulo',
    start: '09:00',
    end: '18:00',
  });
  const [showToken, setShowToken] = useState(false);

  const webhookUrl = `${supabaseUrl}/functions/v1/meta-inbound`;
  const oauthCallbackUrl = `${supabaseUrl}/functions/v1/instagram-oauth`;
  const verifyToken = 'growthsales_meta_verify';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === '1') {
      toast({ title: 'Instagram conectado com sucesso!' });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('error')) {
      toast({
        title: 'Erro ao conectar Instagram',
        description: decodeURIComponent(params.get('error') ?? ''),
        variant: 'destructive',
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [toast]);

  useEffect(() => {
    if (!config) return;
    setIsActive(config.is_active ?? false);
    setCredentials((config.credentials as Record<string, string>) ?? {});
    setIgSettings((config.settings as Record<string, unknown>) ?? {});
    setBusinessHours({
      enabled: config.business_hours?.enabled ?? false,
      timezone: config.business_hours?.timezone ?? 'America/Sao_Paulo',
      start: config.business_hours?.start ?? '09:00',
      end: config.business_hours?.end ?? '18:00',
    });
  }, [config]);

  const handleSave = () => {
    update(
      { channel: 'instagram', updates: { is_active: isActive, credentials, settings: igSettings, business_hours: businessHours } },
      {
        onSuccess: () => toast({ title: 'Configuração salva' }),
        onError: (err: Error) => toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' }),
      },
    );
  };

  const handleConnectOAuth = () => {
    const appId = biSettings?.meta_app_id;
    if (!appId) {
      toast({ title: 'Configure o App ID nas Credenciais do App acima antes de conectar', variant: 'destructive' });
      return;
    }
    const scope = [
      'instagram_basic', 'instagram_manage_messages',
      'pages_messaging', 'pages_show_list', 'pages_read_engagement',
    ].join(',');
    const oauthUrl = new URL('https://www.facebook.com/dialog/oauth');
    oauthUrl.searchParams.set('client_id', appId);
    oauthUrl.searchParams.set('redirect_uri', oauthCallbackUrl);
    oauthUrl.searchParams.set('scope', scope);
    oauthUrl.searchParams.set('response_type', 'code');
    oauthUrl.searchParams.set('state', crypto.randomUUID());
    window.location.href = oauthUrl.toString();
  };

  const isConnected = !!(credentials.access_token && credentials.instagram_business_id);
  const tokenExpiresAt = credentials.token_expires_at
    ? new Date(credentials.token_expires_at)
    : null;
  const tokenExpired = tokenExpiresAt ? tokenExpiresAt < new Date() : false;
  const tokenExpiresStr = tokenExpiresAt ? tokenExpiresAt.toLocaleDateString('pt-BR') : null;

  if (isLoading) return (
    <div className="flex items-center justify-center h-40">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  );

  return <InstagramSectionInner
    isActive={isActive} setIsActive={setIsActive}
    credentials={credentials} setCredentials={setCredentials}
    igSettings={igSettings} setIgSettings={setIgSettings}
    businessHours={businessHours} setBusinessHours={setBusinessHours}
    showToken={showToken} setShowToken={setShowToken}
    isConnected={isConnected} tokenExpired={tokenExpired} tokenExpiresStr={tokenExpiresStr}
    tokenStatus={tokenStatus} biSettings={biSettings}
    webhookUrl={webhookUrl} oauthCallbackUrl={oauthCallbackUrl} verifyToken={verifyToken}
    saving={saving} handleSave={handleSave} handleConnectOAuth={handleConnectOAuth}
  />;
}

type IgSubTab = 'conexao' | 'automacoes';

type SetState<T> = (value: T | ((prev: T) => T)) => void;

interface InstagramSectionInnerProps {
  isActive: boolean;
  setIsActive: (v: boolean) => void;
  credentials: Record<string, string>;
  setCredentials: SetState<Record<string, string>>;
  igSettings: Record<string, unknown>;
  setIgSettings: SetState<Record<string, unknown>>;
  businessHours: { enabled: boolean; timezone: string; start: string; end: string };
  setBusinessHours: SetState<{ enabled: boolean; timezone: string; start: string; end: string }>;
  showToken: boolean;
  setShowToken: SetState<boolean>;
  isConnected: boolean;
  tokenExpired: boolean;
  tokenExpiresStr: string | null;
  tokenStatus: ReturnType<typeof useInstagramTokenStatus>['data'];
  biSettings: ReturnType<typeof useBIProSettings>['settings'];
  webhookUrl: string;
  oauthCallbackUrl: string;
  verifyToken: string;
  saving: boolean;
  handleSave: () => void;
  handleConnectOAuth: () => void;
}

function InstagramSectionInner({
  isActive, setIsActive,
  credentials, setCredentials,
  igSettings, setIgSettings,
  businessHours, setBusinessHours,
  showToken, setShowToken,
  isConnected, tokenExpired, tokenExpiresStr,
  tokenStatus, biSettings,
  webhookUrl, oauthCallbackUrl, verifyToken,
  saving, handleSave, handleConnectOAuth,
}: InstagramSectionInnerProps) {
  const [subTab, setSubTab] = useState<IgSubTab>('conexao');
  const navigate = useNavigate();

  return (
    <div className="space-y-0">
      <Tabs value={subTab} onValueChange={(v) => { if (v === 'automacoes') { navigate('/omni/automacoes'); return; } setSubTab(v as IgSubTab); }}>
        <TabsList className="h-8 justify-start gap-0 bg-transparent border-b border-border rounded-none p-0 w-full mb-5">
          {([
            { value: 'conexao',    label: 'Conexão' },
            { value: 'automacoes', label: 'Automações' },
          ] as const).map(({ value, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="h-8 px-4 text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground text-muted-foreground"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="conexao" className="space-y-5 mt-0">
          {/* Status card */}
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-foreground">Instagram DM</p>
                <p className="text-[12px] text-muted-foreground mt-0.5">Mensagens diretas — janela 7 dias</p>
              </div>
              <div className="flex items-center gap-3">
                {isConnected ? (
                  <span className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border',
                    tokenExpired
                      ? 'bg-red-500/10 text-red-500 border-red-500/20'
                      : tokenStatus?.color === 'yellow'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  )}>
                    <span className={cn('w-1.5 h-1.5 rounded-full',
                      tokenExpired ? 'bg-red-500' : tokenStatus?.color === 'yellow' ? 'bg-amber-500' : 'bg-emerald-500'
                    )} />
                    {tokenExpired ? 'Token expirado' : tokenStatus?.label ?? 'Conectado'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                    Não conectado
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-muted-foreground">{isActive ? 'Ativo' : 'Inativo'}</span>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
              </div>
            </div>
            {isConnected && tokenExpiresStr && !tokenExpired && (
              <p className="text-[12px] text-muted-foreground mt-2.5 pt-2.5 border-t border-border">
                Token válido até {tokenExpiresStr} · <ChannelHealthBadge channel="instagram" />
              </p>
            )}
          </div>

          {/* Token renewal alert */}
          {tokenStatus && tokenStatus.status !== 'missing' && tokenStatus.latestAlert && (
            <div className={cn(
              'flex items-start gap-2 px-3 py-2.5 rounded-lg border text-[11px]',
              tokenStatus.latestAlert.alert_type === 'token_refreshed'
                ? 'border-emerald-500/20 bg-emerald-500/10'
                : 'border-amber-500/20 bg-amber-500/10',
            )}>
              <RefreshCw className={cn(
                'w-3.5 h-3.5 flex-shrink-0 mt-0.5',
                tokenStatus.latestAlert.alert_type === 'token_refreshed' ? 'text-emerald-500' : 'text-amber-500',
              )} />
              <div>
                <p className={cn(
                  'font-medium',
                  tokenStatus.latestAlert.alert_type === 'token_refreshed' ? 'text-emerald-500' : 'text-amber-500',
                )}>
                  {tokenStatus.latestAlert.title}
                </p>
                <p className="text-muted-foreground mt-0.5">
                  {new Date(tokenStatus.latestAlert.created_at).toLocaleString('pt-BR')}
                  {tokenStatus.latestAlert.alert_type === 'token_refreshed' && ' — renovação automática ativa'}
                </p>
              </div>
            </div>
          )}

          {/* App Meta status */}
          {biSettings?.meta_app_id ? (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10">
              <StepBadge n={1} done />
              <p className="text-[12px] text-emerald-600 dark:text-emerald-400 font-medium">
                App Meta configurado — ID: <code className="font-mono">{biSettings.meta_app_id}</code>
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-amber-500/20 bg-amber-500/10">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
              <p className="text-[12px] text-amber-600 dark:text-amber-400">
                App Meta não configurado. Configure o App ID e App Secret na aba <strong>Geral</strong> antes de usar o Instagram.
              </p>
            </div>
          )}

          {/* Webhook */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <StepBadge n={2} />
              <div className="flex-1">
                <p className="text-[13px] font-medium text-foreground">Webhook</p>
                <p className="text-[12px] text-muted-foreground">
                  Painel do app → Webhooks → cole os valores → Verificar e salvar → Assinar campo <code className="font-mono bg-muted px-1 rounded text-[11px]">messages</code>
                </p>
              </div>
              <Webhook className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
            </div>
            <div className="space-y-3 pt-1 border-t border-border">
              {webhookUrl && (
                <CopyableField
                  label="URL do Webhook"
                  value={webhookUrl}
                  hint='Cole em: Webhooks → "URL de retorno de chamada"'
                />
              )}
              <CopyableField
                label="Token de verificação"
                value={verifyToken}
                hint='Cole em: Webhooks → "Token de verificação" → Verificar e salvar → Assinar messages'
              />
            </div>
          </div>

          {/* OAuth redirect URI */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <StepBadge n={3} />
              <div className="flex-1">
                <p className="text-[13px] font-medium text-foreground">Business Login for Instagram</p>
                <p className="text-[12px] text-muted-foreground">
                  Painel do app → Instagram → Business Login for Instagram → OAuth Redirect URIs → cole abaixo → Salvar
                </p>
              </div>
            </div>
            {oauthCallbackUrl && (
              <CopyableField
                label="URI de redirecionamento OAuth"
                value={oauthCallbackUrl}
                hint='Business Login for Instagram → "URIs de redirecionamento OAuth válidos"'
              />
            )}
          </div>

          {/* Credentials */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StepBadge n={4} done={isConnected && !tokenExpired} />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Credenciais de acesso</p>
              </div>
              {isConnected && !tokenExpired && (
                <span className="text-[12px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                  {tokenExpiresStr ? `válido até ${tokenExpiresStr}` : 'Conectado'}
                </span>
              )}
            </div>

            {tokenExpired && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-red-500/20 bg-red-500/10">
                <TriangleAlert className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                <div className="text-[12px] space-y-0.5">
                  <p className="font-semibold text-red-500">Token expirado em {tokenExpiresStr}</p>
                  <p className="text-muted-foreground">
                    Gere um novo token no Graph API Explorer ou reconecte via OAuth abaixo.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Page ID</Label>
                <Input
                  placeholder="123456789"
                  value={credentials.page_id ?? ''}
                  onChange={e => setCredentials(c => ({ ...c, page_id: e.target.value }))}
                  className="font-mono"
                />
                <p className="text-[12px] text-muted-foreground">Business Suite → Configurações → Páginas → ID da Página</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Instagram Business Account ID</Label>
                <Input
                  placeholder="987654321"
                  value={credentials.instagram_business_id ?? ''}
                  onChange={e => setCredentials(c => ({ ...c, instagram_business_id: e.target.value }))}
                  className="font-mono"
                />
                <p className="text-[12px] text-muted-foreground">Graph API → /me/accounts?fields=instagram_business_account</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[13px]">
                  Page Access Token
                  {credentials.access_token && (
                    <span className="ml-2 text-muted-foreground/50 font-mono font-normal text-[12px]">{credentials.access_token.length} chars</span>
                  )}
                </Label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowToken(v => !v)}
                    className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showToken ? <EyeOff className="w-3.5 h-3.5" strokeWidth={1.5} /> : <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />}
                    {showToken ? 'Ocultar' : 'Mostrar'}
                  </button>
                  <a
                    href="https://developers.facebook.com/tools/explorer"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} /> Gerar novo
                  </a>
                </div>
              </div>
              <Textarea
                placeholder="EAAxxxxx... (cole o token completo aqui)"
                value={credentials.access_token ?? ''}
                onChange={e => setCredentials(c => ({ ...c, access_token: e.target.value }))}
                rows={showToken ? 4 : 2}
                className={cn(
                  'font-mono resize-none text-[12px]',
                  !showToken && 'select-none',
                )}
                style={!showToken && credentials.access_token ? { color: 'transparent', textShadow: '0 0 8px rgba(128,128,128,0.5)' } : {}}
              />
              <div className="text-[12px] text-muted-foreground space-y-0.5">
                <p>Permissões: <code className="font-mono bg-muted px-0.5 rounded text-[11px]">instagram_manage_messages</code> · <code className="font-mono bg-muted px-0.5 rounded text-[11px]">pages_messaging</code> · <code className="font-mono bg-muted px-0.5 rounded text-[11px]">pages_show_list</code></p>
                <p className="text-amber-600 dark:text-amber-400">Tokens de usuário expiram em ~60 dias. Use OAuth abaixo para renovação automática.</p>
              </div>
            </div>

            <div className="pt-1 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={handleConnectOAuth}
                className="w-full gap-1.5"
              >
                <Link2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                {isConnected ? 'Reconectar via OAuth (renova o token)' : 'Conectar via OAuth (preenche automaticamente)'}
              </Button>
            </div>
          </div>

          {/* Comportamento */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Comportamento</p>
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-[13px] text-foreground">Janela de resposta</p>
                <p className="text-[12px] text-muted-foreground">168 horas (7 dias) desde a última mensagem do cliente</p>
              </div>
              <span className="text-[12px] text-muted-foreground font-mono bg-muted border border-border px-2 py-0.5 rounded">7d</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <p className="text-[13px] text-foreground">Tentativas de retry</p>
              <Input
                type="number"
                className="h-8 text-[13px] w-16 text-center"
                value={(igSettings.retry_attempts as number) ?? 2}
                onChange={e => setIgSettings(s => ({ ...s, retry_attempts: parseInt(e.target.value) || 2 }))}
              />
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-border">
              <p className="text-[13px] text-foreground">Horário comercial</p>
              <Switch
                checked={businessHours.enabled}
                onCheckedChange={v => setBusinessHours(b => ({ ...b, enabled: v }))}
              />
            </div>
            {businessHours.enabled && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Início</Label>
                  <Input type="time" value={businessHours.start} onChange={e => setBusinessHours(b => ({ ...b, start: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Fim</Label>
                  <Input type="time" value={businessHours.end} onChange={e => setBusinessHours(b => ({ ...b, end: e.target.value }))} />
                </div>
              </div>
            )}
          </div>

          {/* Save */}
          <div className="flex items-center justify-between">
            <span />
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 min-w-[140px]">
              {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />}
              {saving ? 'Salvando...' : 'Salvar configurações'}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="automacoes" className="space-y-4 mt-0">
          <div className="rounded-lg border border-border bg-card p-5 flex flex-col items-center gap-3 text-center py-8">
            <p className="text-[13px] text-muted-foreground">
              As automações foram movidas para o painel OMNI PRO.
            </p>
            <Button variant="outline" size="sm" onClick={() => navigate('/omni/automacoes')}>
              Gerenciar automações
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function MetaIntegrationConfig() {
  const { settings, isLoading }    = useBIProSettings();
  const { data: igCredentials, isLoading: igLoading } = useInstagramChannelConfig();
  const queryClient                = useQueryClient();
  const [activeTab, setActiveTab]  = useState<MetaTab>('geral');

  const configured = !!settings?.meta_app_id;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-7 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MetaTab)} className="space-y-5">
      {/* Section header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <img src="/logos/meta.png" alt="Meta" className="w-7 h-7 object-contain" />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-foreground leading-tight">Meta & WhatsApp</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">Gerencie credenciais, canais, templates e Instagram</p>
          </div>
        </div>
        {configured
          ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Conectado
            </span>
          : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
              Não configurado
            </span>
        }
      </div>

      <TabsList className="h-auto w-full justify-start gap-0 bg-muted border border-border rounded-md p-1">
        {([
          { value: 'geral',     label: 'Geral' },
          { value: 'whatsapp',  label: 'WhatsApp' },
          { value: 'instagram', label: 'Instagram' },
        ] as const).map(({ value, label }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="text-[11px] h-[26px] px-3 data-[state=active]:bg-background data-[state=active]:rounded-md"
          >
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="geral">
        <CredenciaisSection
          settings={settings}
          queryClient={queryClient}
          igCredentials={igCredentials ?? null}
          igLoading={igLoading}
        />
      </TabsContent>

      <TabsContent value="whatsapp">
        <WhatsAppTabContent />
      </TabsContent>

      <TabsContent value="instagram">
        <InstagramSection />
      </TabsContent>
    </Tabs>
  );
}

// ── WhatsApp tab (canais + templates + automações) ────────────────────────────

const WHATSAPP_VERIFY_TOKEN = 'growthsales2026';

type WaSubTab = 'canais' | 'templates' | 'automacoes';

function WhatsAppTabContent() {
  const [subTab, setSubTab] = useState<WaSubTab>('canais');
  const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-inbound`;
  return (
    <div className="space-y-0">
      <Tabs value={subTab} onValueChange={(v) => setSubTab(v as WaSubTab)}>
        <TabsList className="h-8 justify-start gap-0 bg-transparent border-b border-border rounded-none p-0 w-full mb-5">
          {([
            { value: 'canais',     label: 'Canais' },
            { value: 'templates',  label: 'Templates' },
            { value: 'automacoes', label: 'Automações' },
          ] as const).map(({ value, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="h-8 px-4 text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground text-muted-foreground"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="canais" className="space-y-4 mt-0">
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-1">
            <p className="text-[12px] font-medium text-amber-600 dark:text-amber-400">Dois tipos de canal WhatsApp</p>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              Esta seção configura canais <span className="font-medium text-foreground">WhatsApp Business API (WABA)</span> — números gerenciados pelo Meta para disparos em massa e templates.
              Canais de atendimento via Evolution API são configurados em{' '}
              <span className="font-mono bg-muted px-1 rounded text-[11px]">Atendimento → Canais</span>.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Webhook className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
              <div>
                <p className="text-[13px] font-medium text-foreground">Webhook</p>
                <p className="text-[12px] text-muted-foreground">
                  Configure no painel do app Meta → Webhooks → Assinar campo <code className="font-mono bg-muted px-1 rounded text-[11px]">messages</code>
                </p>
              </div>
            </div>
            <div className="space-y-3 pt-1 border-t border-border">
              <CopyableField
                label="URL do Webhook"
                value={webhookUrl}
                hint='Cole em: Webhooks → "URL de retorno de chamada"'
              />
              <CopyableField
                label="Token de verificação"
                value={WHATSAPP_VERIFY_TOKEN}
                hint='Cole em: Webhooks → "Token de verificação" → Verificar e salvar → Assinar campo messages'
              />
            </div>
          </div>

          <Suspense fallback={<SuspenseFallback />}>
            <WhatsappChannelsConfig />
          </Suspense>
        </TabsContent>

        <TabsContent value="templates" className="mt-0">
          <Suspense fallback={<SuspenseFallback />}>
            <WhatsappTemplatesConfig provider="meta" />
          </Suspense>
        </TabsContent>

        <TabsContent value="automacoes" className="space-y-4 mt-0">
          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                <UserPlus className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-[13px] font-medium text-foreground">Novo lead no primeiro contato</p>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  Cria um negócio automaticamente quando o contato manda a primeira mensagem e ainda não tem lead ativo.
                </p>
              </div>
            </div>
            <div className="pt-1 border-t border-border">
              <NewContactSection channels={['whatsapp']} compact />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                <MessageSquareReply className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-[13px] font-medium text-foreground">Mover etapa na primeira resposta</p>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  Quando o lead responde pela primeira vez, move automaticamente para a etapa configurada. Só dispara uma vez por lead.
                </p>
              </div>
            </div>
            <div className="pt-1 border-t border-border">
              <WhatsAppFirstReplySection compact />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
