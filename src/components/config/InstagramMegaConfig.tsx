import { useState, useEffect } from 'react';
import { supabaseUrl } from '@/integrations/supabase/client';
import { CheckCircle2, Loader2, Link2, Webhook, Eye, EyeOff, RefreshCw, TriangleAlert, Zap, Settings, UserPlus, AlertTriangle } from 'lucide-react';
import NewContactSection from './NewContactSection';
import InstagramAutomationsTab from './InstagramAutomationsTab';
import ChannelHealthBadge from './ChannelHealthBadge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useOmniChannelConfig, useUpdateOmniChannelConfig } from '@/hooks/useOmniChannelConfig';
import { useInstagramTokenStatus } from '@/hooks/useOmniChannelAlerts';
import { useToast } from '@/hooks/use-toast';
import { useBIProSettings } from '@/hooks/useBIProSettings';
import { CopyableField } from '@/components/common/CopyableField';
import { cn } from '@/lib/utils';

// ── Copy field ────────────────────────────────────────────────────────────────

// ── Step badge ─────────────────────────────────────────────────────────────────

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

// ── Tab bar ───────────────────────────────────────────────────────────────────

type Tab = 'settings' | 'first_contact' | 'automations';

const TAB_DEFS: { id: Tab; label: string; icon: typeof Settings }[] = [
  { id: 'settings',      label: 'Configuração',    icon: Settings },
  { id: 'first_contact', label: 'Primeiro Contato', icon: UserPlus },
  { id: 'automations',   label: 'Automações',      icon: Zap },
];

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex border-b border-border mb-5 -mt-1">
      {TAB_DEFS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors',
            active === id
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function InstagramMegaConfig() {
  const [tab, setTab] = useState<Tab>('settings');
  const { data: config, isLoading } = useOmniChannelConfig('instagram');
  const { mutate: update, isPending: saving } = useUpdateOmniChannelConfig();
  const { data: tokenStatus } = useInstagramTokenStatus();
  const { toast } = useToast();
  const { settings: biSettings } = useBIProSettings();

  const [isActive, setIsActive] = useState(false);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [businessHours, setBusinessHours] = useState({
    enabled: false,
    timezone: 'America/Sao_Paulo',
    start: '09:00',
    end: '18:00',
  });

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
    setSettings((config.settings as Record<string, unknown>) ?? {});
    setBusinessHours({
      enabled: config.business_hours?.enabled ?? false,
      timezone: config.business_hours?.timezone ?? 'America/Sao_Paulo',
      start: config.business_hours?.start ?? '09:00',
      end: config.business_hours?.end ?? '18:00',
    });
  }, [config]);

  const handleSave = () => {
    update(
      { channel: 'instagram', updates: { is_active: isActive, credentials, settings, business_hours: businessHours } },
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

  const [showToken, setShowToken] = useState(false);

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

  return (
    <div className="space-y-5">
      <TabBar active={tab} onChange={setTab} />

      {tab === 'automations' && <InstagramAutomationsTab />}

      {tab === 'first_contact' && (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 px-1">
            <UserPlus className="w-4 h-4 text-muted-foreground/50 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-foreground">Criar negócio automaticamente</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Quando um contato envia mensagem pela primeira vez, um negócio é criado no pipeline configurado abaixo.
              </p>
            </div>
          </div>
          <NewContactSection channels={['instagram_dm', 'instagram_comment']} />
        </div>
      )}

      {tab === 'settings' && <>

      {/* ── Connection status card ── */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-semibold text-foreground">Instagram DM</p>
            <p className="text-[11px] text-muted-foreground">Mensagens diretas — janela 7 dias</p>
          </div>
          <div className="flex items-center gap-3">
            {isConnected ? (
              <span className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border',
                tokenExpired
                  ? 'bg-red-500/20 text-red-400 border-red-500/30'
                  : tokenStatus?.color === 'yellow'
                    ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                    : 'bg-green-500/20 text-green-400 border-green-500/30'
              )}>
                <span className={cn('w-1.5 h-1.5 rounded-full',
                  tokenExpired ? 'bg-red-400' : tokenStatus?.color === 'yellow' ? 'bg-yellow-400' : 'bg-green-400'
                )} />
                {tokenExpired ? 'Token expirado' : tokenStatus?.label ?? 'Conectado'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/5 text-white/40 border border-white/10">
                <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                Não conectado
              </span>
            )}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">
                {isActive ? 'Ativo' : 'Inativo'}
              </span>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
        </div>
        {isConnected && tokenExpiresStr && !tokenExpired && (
          <p className="text-[10px] text-muted-foreground/60 mt-2.5 pt-2.5 border-t border-border">
            Token válido até {tokenExpiresStr} · <ChannelHealthBadge channel="instagram" />
          </p>
        )}
      </div>

      {/* ── Token renewal alert ── */}
      {tokenStatus && tokenStatus.status !== 'missing' && tokenStatus.latestAlert && (
        <div className={cn(
          'flex items-start gap-2 px-3 py-2.5 rounded-xl border text-[11px]',
          tokenStatus.latestAlert.alert_type === 'token_refreshed'
            ? 'border-green-500/20 bg-green-500/10'
            : 'border-yellow-500/20 bg-yellow-500/10',
        )}>
          <RefreshCw className={cn(
            'w-3.5 h-3.5 flex-shrink-0 mt-0.5',
            tokenStatus.latestAlert.alert_type === 'token_refreshed' ? 'text-green-400' : 'text-yellow-400',
          )} />
          <div>
            <p className={cn(
              'font-medium',
              tokenStatus.latestAlert.alert_type === 'token_refreshed' ? 'text-green-400' : 'text-yellow-400',
            )}>
              {tokenStatus.latestAlert.title}
            </p>
            <p className="text-white/40 mt-0.5">
              {new Date(tokenStatus.latestAlert.created_at).toLocaleString('pt-BR')}
              {tokenStatus.latestAlert.alert_type === 'token_refreshed' && ' — renovação automática ativa'}
            </p>
          </div>
        </div>
      )}

      {/* ── Step 1 — App Meta ── */}
      {biSettings?.meta_app_id ? (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-green-500/20 bg-green-500/10">
          <StepBadge n={1} done />
          <p className="text-[11px] text-green-400 font-medium">
            App Meta configurado — ID: <code className="font-mono">{biSettings.meta_app_id}</code>
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl border border-yellow-500/20 bg-yellow-500/10">
          <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
          <p className="text-[11px] text-yellow-400">
            App Meta não configurado. Configure o App ID e App Secret na aba <strong>Credenciais</strong> antes de usar o Instagram.
          </p>
        </div>
      )}

      {/* ── Step 2 — Webhook ── */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <StepBadge n={2} />
          <div className="flex-1">
            <p className="text-xs font-medium text-white">Webhook</p>
            <p className="text-[10px] text-white/40">
              Painel do app → Webhooks → cole os valores → Verificar e salvar → Assinar campo <code className="font-mono bg-white/10 px-1 rounded">messages</code>
            </p>
          </div>
          <Webhook className="w-3.5 h-3.5 text-white/30 shrink-0" />
        </div>
        <div className="space-y-3 pt-1">
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

      {/* ── Step 3 — OAuth Redirect URI ── */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <StepBadge n={3} />
          <div className="flex-1">
            <p className="text-xs font-medium text-white">Business Login for Instagram</p>
            <p className="text-[10px] text-white/40">
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

      {/* ── Step 4 — Credentials ── */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StepBadge n={4} done={isConnected && !tokenExpired} />
            <p className="text-xs font-medium text-white">Credenciais de acesso</p>
          </div>
          {isConnected && !tokenExpired && (
            <span className="text-[10px] text-green-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {tokenExpiresStr ? `válido até ${tokenExpiresStr}` : 'Conectado'}
            </span>
          )}
        </div>

        {tokenExpired && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
            <TriangleAlert className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <div className="text-[11px] space-y-1">
              <p className="font-semibold text-red-400">Token expirado em {tokenExpiresStr}</p>
              <p className="text-white/50">
                Gere um novo token no Graph API Explorer ou reconecte via OAuth abaixo.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-white/50">Page ID</Label>
              <Input
                placeholder="123456789"
                value={credentials.page_id ?? ''}
                onChange={e => setCredentials(c => ({ ...c, page_id: e.target.value }))}
                className="h-8 text-[12px] font-mono bg-white/5 border-white/10 text-white placeholder:text-white/20"
              />
              <p className="text-[10px] text-white/30">Business Suite → Configurações → Páginas → ID da Página</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-white/50">Instagram Business Account ID</Label>
              <Input
                placeholder="987654321"
                value={credentials.instagram_business_id ?? ''}
                onChange={e => setCredentials(c => ({ ...c, instagram_business_id: e.target.value }))}
                className="h-8 text-[12px] font-mono bg-white/5 border-white/10 text-white placeholder:text-white/20"
              />
              <p className="text-[10px] text-white/30">Graph API → /me/accounts?fields=instagram_business_account</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] text-white/50">
                Page Access Token
                {credentials.access_token && (
                  <span className="ml-2 text-white/20 font-mono font-normal">{credentials.access_token.length} chars</span>
                )}
              </Label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowToken(v => !v)}
                  className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 transition-colors"
                >
                  {showToken ? <EyeOff className="w-3 h-3" strokeWidth={1.5} /> : <Eye className="w-3 h-3" strokeWidth={1.5} />}
                  {showToken ? 'Ocultar' : 'Mostrar'}
                </button>
                <a
                  href="https://developers.facebook.com/tools/explorer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" strokeWidth={1.5} /> Gerar novo
                </a>
              </div>
            </div>
            <Textarea
              placeholder="EAAxxxxx... (cole o token completo aqui)"
              value={credentials.access_token ?? ''}
              onChange={e => setCredentials(c => ({ ...c, access_token: e.target.value }))}
              rows={showToken ? 4 : 2}
              className={cn(
                'text-[11px] font-mono resize-none leading-relaxed bg-white/5 border-white/10 text-white placeholder:text-white/20',
                !showToken && 'select-none',
              )}
              style={!showToken ? { color: 'transparent', textShadow: '0 0 8px rgba(255,255,255,0.3)' } : {}}
            />
            <div className="text-[10px] text-white/30 space-y-0.5">
              <p>Permissões: <code className="font-mono bg-white/10 px-0.5 rounded">instagram_manage_messages</code> · <code className="font-mono bg-white/10 px-0.5 rounded">pages_messaging</code> · <code className="font-mono bg-white/10 px-0.5 rounded">pages_show_list</code></p>
              <p className="text-yellow-500/60">Tokens de usuário expiram em ~60 dias. Use OAuth abaixo para renovação automática.</p>
            </div>
          </div>
        </div>

        <div className="pt-1 border-t border-white/[0.06]">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleConnectOAuth}
            className="w-full h-8 text-[12px] gap-1.5 bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <Link2 className="w-3 h-3" />
            {isConnected ? 'Reconectar via OAuth (renova o token)' : 'Conectar via OAuth (preenche automaticamente)'}
          </Button>
        </div>
      </div>

      {/* ── Behavior ── */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <p className="text-xs font-medium text-white/70">Comportamento</p>
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-xs text-white/70">Janela de resposta</p>
            <p className="text-[10px] text-white/30">168 horas (7 dias) desde a última mensagem do cliente</p>
          </div>
          <span className="text-xs text-white/40 font-mono bg-white/10 border border-white/10 px-2 py-0.5 rounded">7d</span>
        </div>
        <div className="flex items-center justify-between py-1">
          <p className="text-xs text-white/70">Tentativas de retry</p>
          <Input
            type="number"
            className="h-7 text-xs w-16 text-center bg-white/5 border-white/10 text-white"
            value={(settings.retry_attempts as number) ?? 2}
            onChange={e => setSettings(s => ({ ...s, retry_attempts: parseInt(e.target.value) || 2 }))}
          />
        </div>
      </div>

      {/* ── Business hours ── */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-white/70">Horário comercial</p>
          <Switch
            checked={businessHours.enabled}
            onCheckedChange={v => setBusinessHours(b => ({ ...b, enabled: v }))}
          />
        </div>
        {businessHours.enabled && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-white/50">Início</Label>
              <Input type="time" value={businessHours.start} onChange={e => setBusinessHours(b => ({ ...b, start: e.target.value }))} className="h-7 text-xs bg-white/5 border-white/10 text-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-white/50">Fim</Label>
              <Input type="time" value={businessHours.end} onChange={e => setBusinessHours(b => ({ ...b, end: e.target.value }))} className="h-7 text-xs bg-white/5 border-white/10 text-white" />
            </div>
          </div>
        )}
      </div>

      {/* ── Save ── */}
      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full h-9 text-[13px] gap-1.5 bg-[#FF4400] hover:bg-[#FF4400]/90 text-white border-0"
      >
        {saving && <Loader2 className="w-3 h-3 animate-spin" />}
        Salvar configurações
      </Button>
    </>}
    </div>
  );
}
