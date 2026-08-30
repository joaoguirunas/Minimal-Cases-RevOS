import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabaseUrl } from '@/integrations/supabase/client';
import {
  CheckCircle2, AlertTriangle, Loader2, Copy, Check,
  Settings, UserPlus, FileText, RefreshCw, Eye, EyeOff,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import NewContactSection from './NewContactSection';
import { useOmniChannelConfig, useUpdateOmniChannelConfig } from '@/hooks/useOmniChannelConfig';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────

function CopyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <Input value={value} readOnly className="h-[30px] text-xs font-mono bg-muted flex-1" />
        <Button size="icon" variant="ghost" onClick={copy} className="h-[30px] w-8 shrink-0">
          {copied
            ? <Check className="w-3.5 h-3.5 text-green-500" />
            : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
        </Button>
      </div>
      {hint && <p className="text-[10px] text-muted-foreground leading-relaxed">{hint}</p>}
    </div>
  );
}

// ── TikTok Logo icon ──────────────────────────────────────────────────────────

function TikTokLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.16 8.16 0 0 0 4.77 1.52V6.76a4.85 4.85 0 0 1-1-.07z" />
    </svg>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

type Tab = 'settings' | 'first_contact' | 'logs';

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
    { id: 'settings',      label: 'Configuração',    icon: Settings  },
    { id: 'first_contact', label: 'Primeiro Contato', icon: UserPlus  },
    { id: 'logs',          label: 'Logs',            icon: FileText  },
  ];
  return (
    <div className="flex border-b border-border mb-5 -mt-1">
      {tabs.map(({ id, label, icon: Icon }) => (
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

const DEFAULT_APP_ID = 'sbawma1uwbrucrpyd7';

export default function TikTokMegaConfig() {
  const [tab, setTab] = useState<Tab>('settings');
  const [searchParams, setSearchParams] = useSearchParams();
  // 'tiktok' not yet in OmniChannel type until migration T-01 lands — cast via any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: config, isLoading } = useOmniChannelConfig('tiktok' as any);
  const { mutate: update, isPending: saving } = useUpdateOmniChannelConfig();
  const { toast } = useToast();

  const [isActive, setIsActive] = useState(false);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [showSecret, setShowSecret] = useState(false);
  const [businessHours, setBusinessHours] = useState({
    enabled: false,
    timezone: 'America/Sao_Paulo',
    start: '09:00',
    end: '18:00',
  });

  const webhookUrl  = `${supabaseUrl}/functions/v1/tiktok-inbound`;
  const callbackUrl = `${window.location.origin}/tiktok/callback`;

  // Handle OAuth redirect params
  useEffect(() => {
    if (searchParams.get('connected') === '1') {
      toast({ title: 'TikTok conectado com sucesso!' });
      setSearchParams((prev) => {
        prev.delete('connected');
        return prev;
      }, { replace: true });
    } else if (searchParams.get('error')) {
      toast({
        title: 'Erro ao conectar TikTok',
        description: decodeURIComponent(searchParams.get('error') ?? ''),
        variant: 'destructive',
      });
      setSearchParams((prev) => {
        prev.delete('error');
        return prev;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams, toast]);

  useEffect(() => {
    if (!config) {
      setCredentials((prev) => (prev.app_id ? prev : { ...prev, app_id: DEFAULT_APP_ID }));
      return;
    }
    setIsActive(config.is_active ?? false);
    const loaded = (config.credentials as Record<string, string>) ?? {};
    setCredentials(loaded.app_id ? loaded : { ...loaded, app_id: DEFAULT_APP_ID });
    setBusinessHours({
      enabled: config.business_hours?.enabled ?? false,
      timezone: config.business_hours?.timezone ?? 'America/Sao_Paulo',
      start: config.business_hours?.start ?? '09:00',
      end: config.business_hours?.end ?? '18:00',
    });
  }, [config]);

  const handleSave = () => {
    update(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { channel: 'tiktok' as any, updates: { is_active: isActive, credentials, business_hours: businessHours } },
      {
        onSuccess: () => toast({ title: 'Configuração salva' }),
        onError: (err: Error) => toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' }),
      },
    );
  };

  const handleConnectOAuth = () => {
    const appId = credentials.app_id;
    if (!appId) {
      toast({ title: 'Configure o App ID antes de conectar', variant: 'destructive' });
      return;
    }
    const state = crypto.randomUUID();
    sessionStorage.setItem('tiktok_oauth_state', state);

    const oauthUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
    oauthUrl.searchParams.set('client_key', appId);
    oauthUrl.searchParams.set('response_type', 'code');
    // dm.messages.* requires "Direct Message API" product approved in TikTok Developer App.
    // Until approved, use basic scope to allow account connection.
    oauthUrl.searchParams.set('scope', 'user.info.basic');
    oauthUrl.searchParams.set('redirect_uri', callbackUrl);
    oauthUrl.searchParams.set('state', state);
    window.location.href = oauthUrl.toString();
  };

  const isConnected  = !!(credentials.access_token && credentials.open_id);
  const displayHandle = credentials.display_name
    ? `@${credentials.display_name}`
    : credentials.open_id || null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <TabBar active={tab} onChange={setTab} />

      {/* ── Tab: Primeiro Contato ── */}
      {tab === 'first_contact' && (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 px-1">
            <UserPlus className="w-4 h-4 text-muted-foreground/50 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-foreground">Criar negócio automaticamente</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Quando um contato envia DM pela primeira vez no TikTok, um negócio é criado no pipeline configurado abaixo.
              </p>
            </div>
          </div>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <NewContactSection channels={['tiktok'] as any} />
        </div>
      )}

      {/* ── Tab: Logs ── */}
      {tab === 'logs' && (
        <div className="space-y-3">
          <p className="text-[12px] text-muted-foreground/60 text-center py-8">
            Logs de alertas TikTok aparecerão aqui após a integração ser ativada.
          </p>
        </div>
      )}

      {/* ── Tab: Configuração ── */}
      {tab === 'settings' && (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[4px] bg-muted flex items-center justify-center text-foreground">
                <TikTokLogo size={18} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">TikTok DMs</h2>
                <p className="text-xs text-muted-foreground">Mensagens diretas via TikTok Messaging API v2 — janela 7 dias</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isConnected
                ? <Badge variant="outline" className="text-[10px] h-5 gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-2.5 h-2.5" strokeWidth={2} /> Conectado
                  </Badge>
                : <Badge variant="outline" className="text-[10px] h-5 gap-1 border-amber-500/30 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-2.5 h-2.5" strokeWidth={2} /> Desconectado
                  </Badge>
              }
              <span className="text-xs text-muted-foreground">{isActive ? 'Ativo' : 'Inativo'}</span>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          {/* Connection status */}
          {isConnected && displayHandle && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-[4px] border border-emerald-500/20 bg-emerald-500/5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" strokeWidth={1.5} />
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium flex-1">
                Conta conectada: <code className="font-mono">{displayHandle}</code>
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleConnectOAuth}
                className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="w-3 h-3 mr-1" strokeWidth={1.5} />
                Reconectar
              </Button>
            </div>
          )}

          {/* ── Passo 1: Credenciais do App ── */}
          <div className="border border-border rounded-[4px] p-4 space-y-3">
            <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
              Credenciais do App TikTok
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                  App ID (client_key)
                  {credentials.app_id && <CheckCircle2 className="w-3 h-3 text-emerald-500" strokeWidth={1.5} />}
                </Label>
                <Input
                  placeholder={DEFAULT_APP_ID}
                  value={credentials.app_id ?? ''}
                  onChange={(e) => setCredentials((p) => ({ ...p, app_id: e.target.value }))}
                  className="h-[30px] text-[13px] font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                  App Secret
                  {credentials.app_secret && <CheckCircle2 className="w-3 h-3 text-emerald-500" strokeWidth={1.5} />}
                </Label>
                <div className="relative">
                  <Input
                    type={showSecret ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={credentials.app_secret ?? ''}
                    onChange={(e) => setCredentials((p) => ({ ...p, app_secret: e.target.value }))}
                    className="h-[30px] text-[13px] font-mono pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showSecret ? 'Ocultar' : 'Exibir'}
                  >
                    {showSecret
                      ? <EyeOff className="w-3.5 h-3.5" strokeWidth={1.5} />
                      : <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground">
                Verify Token (para validação HMAC do webhook)
              </Label>
              <Input
                placeholder="token-secreto-customizado"
                value={credentials.verify_token ?? ''}
                onChange={(e) => setCredentials((p) => ({ ...p, verify_token: e.target.value }))}
                className="h-[30px] text-[13px] font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Crie um token aleatório e registre este mesmo valor no TikTok Developer App.
              </p>
            </div>
          </div>

          {/* ── Passo 2: Conectar conta ── */}
          <div className="border border-border rounded-[4px] p-4 space-y-3">
            <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
              Conexão OAuth
            </p>
            <p className="text-[11px] text-muted-foreground">
              Autorize o CRM a acessar as mensagens da conta TikTok Business.
              Após clicar, você será redirecionado para o TikTok para autorização.
            </p>
            <Button
              onClick={handleConnectOAuth}
              disabled={!credentials.app_id}
              className="h-[32px] text-[12px] gap-2"
            >
              <TikTokLogo size={14} />
              {isConnected ? 'Reconectar TikTok Business' : 'Conectar TikTok Business'}
              <ExternalLink className="w-3 h-3 ml-auto" strokeWidth={1.5} />
            </Button>
            {!credentials.app_id && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" strokeWidth={1.5} />
                Configure o App ID acima antes de conectar
              </p>
            )}
          </div>

          {/* ── Passo 3: Webhook ── */}
          <div className="border border-border rounded-[4px] p-4 space-y-3">
            <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
              Webhook — Registrar no TikTok Developer App
            </p>
            <CopyField
              label="URL do Webhook (Endpoint)"
              value={webhookUrl}
              hint="Registre esta URL em: TikTok Developer App → App Management → Messaging API → Webhook URL"
            />
            <CopyField
              label="Redirect URI (OAuth Callback)"
              value={callbackUrl}
              hint="Registre esta URL em: TikTok Developer App → Login Kit → Redirect domain"
            />
          </div>

          {/* ── Business Hours ── */}
          <div className="border border-border rounded-[4px] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                Horário comercial
              </p>
              <Switch
                checked={businessHours.enabled}
                onCheckedChange={(v) => setBusinessHours((h) => ({ ...h, enabled: v }))}
              />
            </div>
            {businessHours.enabled && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[12px] text-muted-foreground">Início</Label>
                  <Input
                    type="time"
                    value={businessHours.start}
                    onChange={(e) => setBusinessHours((h) => ({ ...h, start: e.target.value }))}
                    className="h-[30px] text-[12px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px] text-muted-foreground">Fim</Label>
                  <Input
                    type="time"
                    value={businessHours.end}
                    onChange={(e) => setBusinessHours((h) => ({ ...h, end: e.target.value }))}
                    className="h-[30px] text-[12px]"
                  />
                </div>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">
              Janela de mensagem TikTok: <strong>7 dias</strong> — igual ao Instagram DM.
            </p>
          </div>

          {/* Save */}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-[32px] text-[13px] gap-1.5"
          >
            {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />}
            Salvar configuração
          </Button>
        </div>
      )}
    </div>
  );
}
