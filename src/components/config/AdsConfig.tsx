import { useState, useEffect } from "react";
import {
  CheckCircle2, XCircle, RefreshCw, Trash2,
  ChevronDown, ChevronUp, ExternalLink, Zap, HelpCircle, Sparkles, AlertTriangle,
  Clock, Key,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBIProAdAccounts, type AdAccount } from "@/hooks/useBIProAdAccounts";
import { useBIProSettings } from "@/hooks/useBIProSettings";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────
interface PendingOAuthData {
  accounts: Array<{ id: string; name: string }>;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  has_developer_token?: boolean;
  enable_api_url?: string;
}

// ── Platform icons ────────────────────────────────────────────
function MetaIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#1877F2" />
      <path d="M22.5 20c0-2.76-2.24-5-5-5s-5 2.24-5 5 2.24 5 5 5 5-2.24 5-5z" fill="white" />
      <path d="M27.5 20c0-2.76-2.24-5-5-5s-5 2.24-5 5 2.24 5 5 5 5-2.24 5-5z" fill="white" fillOpacity=".6" />
    </svg>
  );
}

function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#fff" />
      <path d="M20.5 17.6v4.9h6.8c-.3 1.7-2 5-6.8 5-4.1 0-7.4-3.4-7.4-7.5s3.3-7.5 7.4-7.5c2.3 0 3.9.99 4.8 1.84l3.26-3.14C26.3 9.4 23.6 8 20.5 8 14.15 8 9 13.15 9 19.5S14.15 31 20.5 31c6.65 0 11.05-4.67 11.05-11.25 0-.76-.08-1.33-.18-1.91H20.5z" fill="#4285F4" />
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────
function initiateOAuth(type: 'meta' | 'google', id: string | null) {
  if (!id) {
    toast.error(`Configure as credenciais da ${type === 'meta' ? 'Meta' : 'Google'} primeiro`);
    return;
  }
  const state = crypto.randomUUID();
  if (type === 'meta') {
    sessionStorage.setItem('meta_oauth_state', state);
    const url = new URL('https://www.facebook.com/dialog/oauth');
    url.searchParams.set('client_id', id);
    url.searchParams.set('redirect_uri', `${window.location.origin}/oauth/meta/callback`);
    url.searchParams.set('scope', 'ads_read,business_management,pages_show_list,pages_read_engagement');
    url.searchParams.set('state', state);
    url.searchParams.set('response_type', 'code');
    window.location.href = url.toString();
  } else {
    sessionStorage.setItem('google_oauth_state', state);
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', id);
    url.searchParams.set('redirect_uri', `${window.location.origin}/oauth/google/callback`);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'https://www.googleapis.com/auth/adwords');
    url.searchParams.set('state', state);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    window.location.href = url.toString();
  }
}

// ── Status pill ───────────────────────────────────────────────
type StatusType = 'ok' | 'warn' | 'error' | 'idle';

function StatusPill({ status, label }: { status: StatusType; label: string }) {
  const styles: Record<StatusType, string> = {
    ok:   'text-emerald-600 dark:text-emerald-400 bg-emerald-500/8 border-emerald-200/30',
    warn: 'text-amber-600 dark:text-amber-400 bg-amber-500/8 border-amber-200/30',
    error:'text-red-600 dark:text-red-400 bg-red-500/8 border-red-200/30',
    idle: 'text-muted-foreground/35 bg-muted border-border',
  };
  const Icon =
    status === 'ok'    ? CheckCircle2 :
    status === 'warn'  ? AlertTriangle :
    status === 'error' ? XCircle : Clock;

  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border leading-none',
      styles[status]
    )}>
      <Icon className="w-3 h-3" strokeWidth={1.5} />
      {label}
    </span>
  );
}

// ── Account row ───────────────────────────────────────────────
function AccountRow({ account, onSync, onDelete, isSyncing }: {
  account: AdAccount;
  onSync: (id: string, from: string, to: string) => void;
  onDelete: (id: string) => void;
  isSyncing: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const to = new Date().toISOString().split('T')[0];

  const now = new Date();
  const expiresAt = account.token_expires_at ? new Date(account.token_expires_at) : null;
  const expired = expiresAt ? expiresAt <= now : false;
  const expiringSoon = !expired && expiresAt
    ? expiresAt.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000
    : false;
  const daysUntilExpiry = expiresAt && !expired
    ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const lastSync = account.last_sync_at
    ? new Date(account.last_sync_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="border border-border rounded-[2px] overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        {account.platform === 'meta' ? <MetaIcon size={24} /> : <GoogleIcon size={24} />}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-normal text-foreground truncate">{account.account_name}</p>
          <p className="text-[11px] text-muted-foreground/50 font-mono">{account.account_id}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={cn(
            "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border leading-none",
            expired
              ? "text-red-600 dark:text-red-400 bg-red-500/8 border-red-200/30"
              : expiringSoon
              ? "text-amber-600 dark:text-amber-400 bg-amber-500/8 border-amber-200/30"
              : "text-emerald-600 dark:text-emerald-400 bg-emerald-500/8 border-emerald-200/30"
          )}>
            {expired
              ? <><XCircle className="w-2.5 h-2.5" strokeWidth={1.5} /> Token expirado</>
              : expiringSoon
              ? <><AlertTriangle className="w-2.5 h-2.5" strokeWidth={1.5} /> Expira em {daysUntilExpiry}d</>
              : <><CheckCircle2 className="w-2.5 h-2.5" strokeWidth={1.5} /> Conectado</>
            }
          </span>
          <button
            onClick={() => setOpen(v => !v)}
            className="text-muted-foreground/40 hover:text-foreground transition-colors p-1"
          >
            {open
              ? <ChevronUp className="w-3.5 h-3.5" strokeWidth={1.5} />
              : <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border px-4 pb-3.5 pt-3 space-y-3 bg-muted">
          {lastSync && (
            <p className="text-[11px] text-muted-foreground/50">Último sync: {lastSync}</p>
          )}
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label className="text-[12px] text-muted-foreground">De</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)}
                className="h-[30px] text-[13px]" />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label className="text-[12px] text-muted-foreground">Até</Label>
              <Input type="date" value={to} disabled
                className="h-[30px] text-[13px] opacity-50" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onSync(account.id, from, to)} disabled={isSyncing}
              className="flex-1 h-[30px] text-[13px] gap-1.5">
              <RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin")} strokeWidth={1.5} />
              {isSyncing ? 'Sincronizando…' : 'Sincronizar dados'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onDelete(account.id)}
              className="h-[30px] w-[30px] p-0 text-muted-foreground/50 hover:text-destructive">
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Platform section ──────────────────────────────────────────
function PlatformSection({
  type, label, Icon, clientId, hasDeveloperToken, accounts, onSync, onDelete, syncingId, isLoading
}: {
  type: 'meta' | 'google';
  label: string;
  Icon: React.FC<{ size?: number }>;
  clientId: string | null;
  hasDeveloperToken?: boolean;
  accounts: AdAccount[];
  onSync: (id: string, from: string, to: string) => void;
  onDelete: (id: string) => void;
  syncingId: string | null;
  isLoading: boolean;
}) {
  const { createAccount } = useBIProAdAccounts();
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [manualAccountId, setManualAccountId] = useState('');
  const [manualAccountName, setManualAccountName] = useState('');

  function handleManualSave() {
    const rawId = manualAccountId.trim().replace(/^act_/, '');
    if (!rawId || !manualToken.trim()) {
      toast.error('Preencha o Access Token e o ID da conta.');
      return;
    }
    createAccount.mutate(
      {
        platform: 'meta',
        account_id: rawId,
        account_name: manualAccountName.trim() || `Meta Ads ${rawId}`,
        access_token: manualToken.trim(),
      },
      {
        onSuccess: () => {
          setShowManualForm(false);
          setManualToken('');
          setManualAccountId('');
          setManualAccountName('');
          toast.success('Conta Meta adicionada com sucesso.');
        },
        onError: (err: Error) => {
          toast.error(err.message ?? 'Erro ao adicionar conta.');
        },
      },
    );
  }

  const configured = !!clientId;
  const connected = accounts.length > 0;
  const missingDevToken = type === 'google' && configured && !hasDeveloperToken;

  // Status computations
  const credStatus: StatusType = configured ? 'ok' : 'error';
  const devTokenStatus: StatusType = type !== 'google' ? 'ok'
    : !configured ? 'idle'
    : hasDeveloperToken ? 'ok' : 'warn';
  const oauthStatus: StatusType = !configured ? 'idle'
    : connected ? 'ok' : 'warn';
  const now = new Date();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const hasExpired = accounts.some(a => a.token_expires_at && new Date(a.token_expires_at) <= now);
  const hasExpiringSoon = !hasExpired && accounts.some(a => {
    if (!a.token_expires_at) return false;
    const exp = new Date(a.token_expires_at);
    return exp > now && exp.getTime() - now.getTime() < sevenDaysMs;
  });
  const tokenStatus: StatusType = !connected ? 'idle'
    : hasExpired ? 'error'
    : hasExpiringSoon ? 'warn'
    : 'ok';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Icon size={20} />
          <span className="text-[13px] font-medium text-foreground">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {type === 'meta' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowManualForm((v) => !v)}
              className="h-[30px] text-[13px] gap-1.5 text-muted-foreground"
              title="Inserir token manualmente"
            >
              <Key className="w-3.5 h-3.5" strokeWidth={1.5} />
              Token manual
            </Button>
          )}
          <Button
            size="sm"
            variant={connected ? "outline" : "default"}
            onClick={() => initiateOAuth(type, clientId)}
            disabled={!configured}
            className="h-[30px] text-[13px] gap-1.5"
          >
            <Zap className="w-3.5 h-3.5" strokeWidth={1.5} />
            {connected ? 'Adicionar conta' : 'Conectar'}
          </Button>
        </div>
      </div>

      {/* Manual token form — Meta only */}
      {type === 'meta' && showManualForm && (
        <div className="border border-border rounded-[4px] p-3 space-y-3 bg-muted/30">
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Adicionar conta via token</p>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Access Token *</Label>
            <Input
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="EAAxxxxxx..."
              className="h-[30px] text-sm rounded-[4px] font-mono"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Ad Account ID *</Label>
            <Input
              value={manualAccountId}
              onChange={(e) => setManualAccountId(e.target.value)}
              placeholder="123456789 ou act_123456789"
              className="h-[30px] text-sm rounded-[4px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Nome da conta (opcional)</Label>
            <Input
              value={manualAccountName}
              onChange={(e) => setManualAccountName(e.target.value)}
              placeholder="Ex: Campanha Verão 2025"
              className="h-[30px] text-sm rounded-[4px]"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              onClick={handleManualSave}
              disabled={createAccount.isPending}
              className="h-[28px] text-[12px]"
            >
              {createAccount.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setShowManualForm(false); setManualToken(''); setManualAccountId(''); setManualAccountName(''); }}
              className="h-[28px] text-[12px] text-muted-foreground"
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Status row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <StatusPill status={credStatus} label="Credenciais" />
        {type === 'google' && <StatusPill status={devTokenStatus} label="Dev Token" />}
        <StatusPill status={oauthStatus} label={connected ? `${accounts.length} conta${accounts.length > 1 ? 's' : ''} OAuth` : 'OAuth'} />
        {connected && <StatusPill status={tokenStatus} label={tokenStatus === 'error' ? 'Token expirado' : tokenStatus === 'warn' ? 'Token expirando' : 'Token válido'} />}
      </div>

      {!configured && (
        <p className="text-[12px] text-amber-600 dark:text-amber-400 bg-amber-500/8 border border-amber-200/30 rounded-[2px] px-3 py-2">
          Configure as credenciais da {label} na seção abaixo antes de conectar.
        </p>
      )}

      {missingDevToken && (
        <div className="flex items-start gap-2 text-[12px] text-amber-700 dark:text-amber-300 bg-amber-500/8 border border-amber-200/30 rounded-[4px] px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
          <span>
            <strong>Developer Token não configurado.</strong> Cole o token do API Center e solicite o{' '}
            <strong>Nível de acesso às Análises</strong> para sincronizar contas reais.{' '}
            <a href="https://ads.google.com/aw/apicenter" target="_blank" rel="noopener noreferrer"
              className="underline hover:no-underline inline-flex items-center gap-0.5">
              Abrir API Center <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
            </a>
          </span>
        </div>
      )}

      {/* Google: dev token configured but may need approval for production accounts */}
      {type === 'google' && hasDeveloperToken && connected && (
        <div className="flex items-start gap-2 text-[12px] text-blue-700 dark:text-blue-300 bg-blue-500/8 border border-blue-200/30 rounded-[4px] px-3 py-2.5">
          <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
          <span>
            Se a sincronização falhar com <em>"Developer Token not approved"</em>, seu token ainda está no nível{' '}
            <strong>Test Account</strong> e precisa de aprovação do Google para contas reais.{' '}
            Acesse o <strong>API Center → Solicitar acesso → Nível de acesso às Análises</strong>.{' '}
            A aprovação pode levar alguns dias.{' '}
            <a href="https://ads.google.com/aw/apicenter" target="_blank" rel="noopener noreferrer"
              className="underline hover:no-underline font-medium inline-flex items-center gap-0.5">
              Abrir API Center <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
            </a>
          </span>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-14 w-full rounded-[2px]" />
      ) : accounts.length > 0 ? (
        <div className="space-y-2">
          {accounts.map(acc => (
            <AccountRow
              key={acc.id}
              account={acc}
              onSync={onSync}
              onDelete={onDelete}
              isSyncing={syncingId === acc.id}
            />
          ))}
        </div>
      ) : configured ? (
        <p className="text-[12px] text-muted-foreground/40">Nenhuma conta conectada ainda.</p>
      ) : null}
    </div>
  );
}

// ── Step-by-step guide (collapsible) ─────────────────────────
function SetupGuide({ steps, defaultOpen = true }: {
  steps: { title: string; detail: string; link?: { label: string; href: string } }[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-[2px] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 hover:bg-muted/50 transition-colors"
      >
        <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" strokeWidth={1.5} />
        <span className="flex-1 text-left text-[12px] font-medium text-foreground/70">
          Como configurar — passo a passo
        </span>
        {open
          ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/40" strokeWidth={1.5} />
          : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40" strokeWidth={1.5} />}
      </button>
      {open && (
        <ol className="px-3.5 pb-3.5 space-y-3 border-t border-border pt-3">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <div className="space-y-0.5">
                <p className="text-[12px] font-medium text-foreground">{step.title}</p>
                <p className="text-[11px] text-muted-foreground/60 leading-relaxed whitespace-pre-line">{step.detail}</p>
                {step.link && (
                  <a href={step.link.href} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline mt-0.5">
                    {step.link.label} <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const META_STEPS = [
  { title: 'Crie um App no Meta for Developers', detail: 'Acesse o portal de desenvolvedores da Meta e clique em "Criar app". Escolha o tipo "Empresa" (Business).', link: { label: 'Abrir Meta for Developers', href: 'https://developers.facebook.com/apps' } },
  { title: 'Adicione os produtos "Marketing API" e "Facebook Login"', detail: 'Em "Adicionar produto", selecione "Marketing API" e também "Facebook Login for Business". Ambos são necessários.' },
  {
    title: 'Configure o domínio e URI de redirecionamento OAuth',
    detail: `OBRIGATÓRIO — sem isso, o erro "Não é possível carregar a URL" aparece.\n\n1. Em Configurações > Básico > Domínios do app, adicione:\n   ${typeof window !== 'undefined' ? new URL(window.location.origin).hostname : 'seu-dominio.com'}\n\n2. Em Facebook Login > Configurações > URIs de redirecionamento OAuth válidos, adicione:\n   ${typeof window !== 'undefined' ? window.location.origin : 'https://seu-dominio.com'}/oauth/meta/callback\n\n3. Ative "Login do cliente OAuth" e "Login do OAuth para web" nessa mesma página.`,
  },
  { title: 'Copie o App ID e o App Secret', detail: 'Em Configurações > Básico, você verá o App ID e o App Secret. Copie e cole nos campos abaixo.' },
  { title: 'Salve as credenciais e autorize via OAuth', detail: 'Clique em "Salvar credenciais Meta" e depois em "Conectar" na seção "Contas Conectadas" acima.' },
];

const GOOGLE_STEPS = [
  { title: 'Crie um projeto no Google Cloud Console', detail: 'Acesse o Google Cloud Console e crie um novo projeto (ou use um existente).', link: { label: 'Abrir Google Cloud Console', href: 'https://console.cloud.google.com' } },
  { title: 'Ative a Google Ads API', detail: 'No menu "APIs e serviços > Biblioteca", pesquise por "Google Ads API" e ative-a.' },
  { title: 'Crie credenciais OAuth 2.0', detail: 'Em "APIs e serviços > Credenciais", clique em "Criar credenciais > ID do cliente OAuth". Selecione "Aplicativo da Web".', link: { label: 'Abrir Credenciais', href: 'https://console.cloud.google.com/apis/credentials' } },
  { title: 'Preencha as origens e o URI de redirecionamento', detail: `Origens: ${typeof window !== 'undefined' ? window.location.origin : 'https://seu-dominio.com'}\n\nRedirecionamento: ${typeof window !== 'undefined' ? window.location.origin : 'https://seu-dominio.com'}/oauth/google/callback` },
  { title: 'Copie o Client ID e Client Secret', detail: 'Após salvar, copie o "ID do cliente" e o "Segredo do cliente" e cole nos campos abaixo.' },
  { title: 'Obtenha o Developer Token e solicite acesso para análises', detail: 'No Google Ads API Center, copie o Developer Token. Em seguida, clique em "Solicitar acesso" e escolha "Nível de acesso às Análises" — é o nível ideal para sincronização de dados e funciona com contas reais.', link: { label: 'Abrir Google Ads API Center', href: 'https://ads.google.com/aw/apicenter' } },
  { title: 'Salve e conecte', detail: 'Clique em "Salvar credenciais Google" e depois em "Conectar" para autorizar via OAuth.' },
];

// ── Meta credentials form ─────────────────────────────────────
function MetaCredentialsForm() {
  const { settings, isLoading, saveSettings } = useBIProSettings();
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');

  useEffect(() => {
    if (isLoading) return;
    setAppId(settings?.meta_app_id ?? '');
    setAppSecret(settings?.meta_app_secret ? '••••••••' : '');
  }, [isLoading, settings?.meta_app_id, settings?.meta_app_secret]);

  const isMasked = (v: string) => v === '••••••••';

  const handleSave = () => {
    const update: Record<string, string | null> = { meta_app_id: appId || null };
    if (!isMasked(appSecret)) update.meta_app_secret = appSecret || null;
    saveSettings.mutate(update);
  };

  if (isLoading) return <Skeleton className="h-24 w-full rounded-[2px]" />;

  const metaSaved = !!settings?.meta_app_id;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MetaIcon size={18} />
        <span className="text-[13px] font-medium text-foreground">Meta Ads</span>
        {metaSaved
          ? <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/8 border border-emerald-200/30 px-1.5 py-0.5 rounded-full leading-none">
              <CheckCircle2 className="w-2.5 h-2.5" strokeWidth={1.5} /> Configurado
            </span>
          : <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 dark:text-red-400 bg-red-500/8 border border-red-200/30 px-1.5 py-0.5 rounded-full leading-none">
              <XCircle className="w-2.5 h-2.5" strokeWidth={1.5} /> Não configurado
            </span>
        }
      </div>

      <SetupGuide steps={META_STEPS} defaultOpen={!settings?.meta_app_id} />

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-[12px] text-muted-foreground flex items-center gap-1.5">
            App ID <span className="opacity-50">— passo 3</span>
            {settings?.meta_app_id && <CheckCircle2 className="w-3 h-3 text-emerald-500" strokeWidth={1.5} />}
          </Label>
          <Input placeholder="123456789" value={appId}
            onChange={e => setAppId(e.target.value)}
            className="h-[30px] text-[13px] font-mono" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[12px] text-muted-foreground flex items-center gap-1.5">
            App Secret <span className="opacity-50">— passo 3</span>
            {settings?.meta_app_secret && <CheckCircle2 className="w-3 h-3 text-emerald-500" strokeWidth={1.5} />}
          </Label>
          <Input type="password" placeholder="••••••••" value={appSecret}
            onFocus={e => { if (isMasked(e.target.value)) setAppSecret(''); }}
            onChange={e => setAppSecret(e.target.value)}
            className="h-[30px] text-[13px] font-mono" />
        </div>
      </div>
      <Button size="sm" onClick={handleSave} disabled={saveSettings.isPending}
        className="w-full h-[30px] text-[13px] gap-1.5">
        {saveSettings.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />}
        Salvar credenciais Meta
      </Button>
    </div>
  );
}

// ── Google credentials form ───────────────────────────────────
function GoogleCredentialsForm() {
  // google_client_id/secret live in settings (Schedule PRO owns them, shared with Google Ads)
  const { data: appSettings, isLoading: appLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  // google_developer_token is BI-only and lives in bi_settings
  const { settings: biSettings, isLoading: biLoading, saveSettings } = useBIProSettings();

  const isLoading = appLoading || biLoading;

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [developerToken, setDeveloperToken] = useState('');

  useEffect(() => {
    if (isLoading) return;
    setClientId(appSettings?.google_client_id ?? '');
    setClientSecret(appSettings?.google_client_secret ? '••••••••' : '');
    setDeveloperToken(biSettings?.google_developer_token ? '••••••••' : '');
  }, [isLoading, appSettings?.google_client_id, appSettings?.google_client_secret, biSettings?.google_developer_token]);

  const isMasked = (v: string) => v === '••••••••';

  const handleSave = () => {
    // Save google_client_id/secret to settings table
    const settingsUpdate: Record<string, string | null> = { google_client_id: clientId || null };
    if (!isMasked(clientSecret)) settingsUpdate.google_client_secret = clientSecret || null;
    updateSettings.mutate(settingsUpdate);
    // Save developer_token to bi_settings if changed
    if (!isMasked(developerToken)) {
      saveSettings.mutate({ google_developer_token: developerToken || null });
    }
  };

  const isPending = updateSettings.isPending || saveSettings.isPending;

  if (isLoading) return <Skeleton className="h-32 w-full rounded-[2px]" />;

  const googleSaved = !!appSettings?.google_client_id;
  const devTokenSaved = !!biSettings?.google_developer_token;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <GoogleIcon size={18} />
        <span className="text-[13px] font-medium text-foreground">Google Ads</span>
        {googleSaved
          ? <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/8 border border-emerald-200/30 px-1.5 py-0.5 rounded-full leading-none">
              <CheckCircle2 className="w-2.5 h-2.5" strokeWidth={1.5} /> Configurado
            </span>
          : <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 dark:text-red-400 bg-red-500/8 border border-red-200/30 px-1.5 py-0.5 rounded-full leading-none">
              <XCircle className="w-2.5 h-2.5" strokeWidth={1.5} /> Não configurado
            </span>
        }
        {googleSaved && !devTokenSaved && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/8 border border-amber-200/30 px-1.5 py-0.5 rounded-full leading-none">
            <AlertTriangle className="w-2.5 h-2.5" strokeWidth={1.5} /> Dev Token ausente
          </span>
        )}
      </div>

      <SetupGuide steps={GOOGLE_STEPS} defaultOpen={!appSettings?.google_client_id} />

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-[12px] text-muted-foreground flex items-center gap-1.5">
            Client ID <span className="opacity-50">— passo 5</span>
            {appSettings?.google_client_id && <CheckCircle2 className="w-3 h-3 text-emerald-500" strokeWidth={1.5} />}
          </Label>
          <Input placeholder="xxx.apps.googleusercontent.com" value={clientId}
            onChange={e => setClientId(e.target.value)}
            className="h-[30px] text-[13px] font-mono" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[12px] text-muted-foreground flex items-center gap-1.5">
            Client Secret <span className="opacity-50">— passo 5</span>
            {appSettings?.google_client_secret && <CheckCircle2 className="w-3 h-3 text-emerald-500" strokeWidth={1.5} />}
          </Label>
          <Input type="password" placeholder="••••••••" value={clientSecret}
            onFocus={e => { if (isMasked(e.target.value)) setClientSecret(''); }}
            onChange={e => setClientSecret(e.target.value)}
            className="h-[30px] text-[13px] font-mono" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-[12px] text-muted-foreground flex items-center gap-1.5">
          Developer Token <span className="opacity-50">— passo 6, obrigatório para sync</span>
          {biSettings?.google_developer_token
            ? <CheckCircle2 className="w-3 h-3 text-emerald-500" strokeWidth={1.5} />
            : <AlertTriangle className="w-3 h-3 text-amber-500" strokeWidth={1.5} />
          }
        </Label>
        <Input type="password" placeholder="••••••••" value={developerToken}
          onFocus={e => { if (isMasked(e.target.value)) setDeveloperToken(''); }}
          onChange={e => setDeveloperToken(e.target.value)}
          className="h-[30px] text-[13px] font-mono" />
      </div>
      <Button size="sm" onClick={handleSave} disabled={isPending}
        className="w-full h-[30px] text-[13px] gap-1.5">
        {isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />}
        Salvar credenciais Google
      </Button>
    </div>
  );
}

// ── Account Picker (shared Meta + Google) ────────────────────
function AccountPicker({ platform, pending, onDone }: {
  platform: 'meta' | 'google';
  pending: PendingOAuthData;
  onDone: () => void;
}) {
  const { createAccount } = useBIProAdAccounts();
  // Start with empty selection — user picks what they want
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedGoogleId, setSelectedGoogleId] = useState<string>(
    () => pending.accounts.length === 1 ? pending.accounts[0].id : ''
  );
  const [saving, setSaving] = useState(false);
  const [manualCustomerId, setManualCustomerId] = useState('');
  const [search, setSearch] = useState('');

  const hasAccounts = pending.accounts.length > 0;
  const isManualMode = platform === 'google' && !hasAccounts;
  const isGoogleSelect = platform === 'google' && hasAccounts;

  // Strip "(Read-Only)" suffix for display, keep flag
  const normalizeAccount = (a: { id: string; name: string }) => ({
    ...a,
    displayName: a.name.replace(/\s*\(Read-Only\)\s*$/i, '').trim(),
    isReadOnly: /\(Read-Only\)/i.test(a.name),
  });

  const filteredAccounts = pending.accounts
    .map(normalizeAccount)
    .filter(a =>
      search === '' ||
      a.displayName.toLowerCase().includes(search.toLowerCase()) ||
      a.id.includes(search)
    );

  const allFilteredIds = new Set(filteredAccounts.map(a => a.id));
  const allSelected = filteredAccounts.length > 0 && filteredAccounts.every(a => selected.has(a.id));

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const toggleAll = () => {
    if (allSelected) {
      setSelected(prev => { const next = new Set(prev); allFilteredIds.forEach(id => next.delete(id)); return next; });
    } else {
      setSelected(prev => { const next = new Set(prev); allFilteredIds.forEach(id => next.add(id)); return next; });
    }
  };

  const handleAdd = async () => {
    let toAdd: Array<{ id: string; name: string }>;

    if (isManualMode) {
      const cid = manualCustomerId.replace(/-/g, '').trim();
      if (!cid) { toast.error('Informe o Customer ID da conta Google Ads.'); return; }
      toAdd = [{ id: cid, name: `Google Ads ${cid}` }];
    } else if (isGoogleSelect) {
      if (!selectedGoogleId) { toast.error('Selecione uma conta Google Ads.'); return; }
      const account = pending.accounts.find(a => a.id === selectedGoogleId);
      if (!account) { toast.error('Conta não encontrada.'); return; }
      toAdd = [account];
    } else {
      toAdd = pending.accounts.filter(a => selected.has(a.id));
      if (toAdd.length === 0) { toast.error('Selecione pelo menos uma conta.'); return; }
    }

    setSaving(true);
    let errors = 0;
    for (const account of toAdd) {
      await new Promise<void>(resolve =>
        createAccount.mutate(
          {
            platform,
            account_id: account.id,
            account_name: account.name,
            access_token: pending.access_token,
            refresh_token: pending.refresh_token ?? undefined,
            token_expires_at: pending.token_expires_at ?? undefined,
          },
          { onSuccess: () => resolve(), onError: () => { errors++; resolve(); } }
        )
      );
    }
    setSaving(false);
    if (errors === 0) {
      toast.success(`${toAdd.length} conta${toAdd.length > 1 ? 's' : ''} adicionada${toAdd.length > 1 ? 's' : ''}`);
    } else {
      toast.warning(`${toAdd.length - errors} adicionada(s), ${errors} com erro.`);
    }
    onDone();
  };

  const PlatIcon = platform === 'meta' ? MetaIcon : GoogleIcon;

  return (
    <div className="border border-primary/20 rounded-[4px] overflow-hidden bg-card">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-primary/10 bg-primary/5">
        <PlatIcon size={16} />
        <span className="text-[13px] font-semibold text-foreground flex-1">
          {isManualMode
            ? 'Google Ads — Autorizado'
            : `${pending.accounts.length} conta${pending.accounts.length !== 1 ? 's' : ''} encontrada${pending.accounts.length !== 1 ? 's' : ''}`
          }
        </span>
        <button onClick={onDone} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors text-[11px]">
          Fechar
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* API disabled warning */}
        {isManualMode && pending.enable_api_url && (
          <div className="flex items-start gap-2 text-[12px] text-amber-700 dark:text-amber-300 bg-amber-500/8 border border-amber-200/30 rounded-[4px] px-3 py-2.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <span>
              <strong>Google Ads API não ativada</strong> neste projeto.{' '}
              <a href={pending.enable_api_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 underline hover:no-underline font-medium">
                Ativar agora <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
              </a>
            </span>
          </div>
        )}

        {/* Meta multi-select */}
        {!isManualMode && !isGoogleSelect && (
          <>
            {/* Search + select-all bar */}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Buscar conta…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-[30px] text-[12px] flex-1"
              />
              <button
                onClick={toggleAll}
                className="flex-shrink-0 h-[30px] px-3 text-[12px] font-medium border border-border rounded-[4px] hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
              >
                {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
            </div>

            {/* Account list */}
            <div className="space-y-1 max-h-64 overflow-y-auto pr-0.5">
              {filteredAccounts.length === 0 && (
                <p className="text-[12px] text-muted-foreground/50 py-4 text-center">Nenhuma conta encontrada.</p>
              )}
              {filteredAccounts.map(account => (
                <label
                  key={account.id}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-[4px] border cursor-pointer transition-colors",
                    selected.has(account.id)
                      ? "border-primary/30 bg-primary/5"
                      : "border-border bg-background hover:bg-muted/50"
                  )}
                >
                  <Checkbox
                    checked={selected.has(account.id)}
                    onCheckedChange={() => toggle(account.id)}
                    className="flex-shrink-0"
                  />
                  <PlatIcon size={16} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[13px] font-medium text-foreground truncate">{account.displayName}</span>
                      {account.isReadOnly && (
                        <span className="text-[10px] font-medium text-muted-foreground/50 bg-muted border border-border px-1.5 py-0.5 rounded-full leading-none flex-shrink-0">
                          Read-Only
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground/40 font-mono mt-0.5">{account.id}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* Selection summary */}
            <p className="text-[11px] text-muted-foreground/50">
              {selected.size === 0
                ? 'Nenhuma conta selecionada'
                : `${selected.size} conta${selected.size > 1 ? 's' : ''} selecionada${selected.size > 1 ? 's' : ''}`
              }
            </p>
          </>
        )}

        {/* Google single-select dropdown */}
        {isGoogleSelect && (
          <Select value={selectedGoogleId} onValueChange={setSelectedGoogleId}>
            <SelectTrigger className="h-[30px] text-[13px]">
              <SelectValue placeholder="Selecione uma conta…" />
            </SelectTrigger>
            <SelectContent>
              {pending.accounts.map(normalizeAccount).map(account => (
                <SelectItem key={account.id} value={account.id}>
                  <span className="font-normal">{account.displayName}</span>
                  {account.isReadOnly && (
                    <span className="ml-1.5 text-[10px] text-muted-foreground/50">Read-Only</span>
                  )}
                  <span className="ml-2 text-muted-foreground/50 font-mono text-[11px]">{account.id}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Manual Google input */}
        {isManualMode && (
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">Customer ID</Label>
            <Input
              placeholder="123-456-7890"
              value={manualCustomerId}
              onChange={e => setManualCustomerId(e.target.value)}
              className="h-[30px] text-[13px] font-mono"
            />
            <p className="text-[11px] text-muted-foreground/50">Ex: 1234567890 ou 123-456-7890.</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={saving || (isGoogleSelect && !selectedGoogleId) || (!isManualMode && !isGoogleSelect && selected.size === 0)}
            className="flex-1 h-[30px] text-[13px] gap-1.5"
          >
            {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />}
            {isManualMode || isGoogleSelect
              ? 'Adicionar conta'
              : selected.size > 0
                ? `Adicionar ${selected.size} conta${selected.size > 1 ? 's' : ''}`
                : 'Selecione ao menos uma conta'
            }
          </Button>
          <Button size="sm" variant="outline" onClick={onDone}
            className="h-[30px] text-[13px] text-muted-foreground">
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────
export default function AdsConfig({ platform, hideCredentials = false }: { platform?: 'meta' | 'google'; hideCredentials?: boolean } = {}) {
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [pendingGoogle, setPendingGoogle] = useState<PendingOAuthData | null>(null);
  const [pendingMeta, setPendingMeta] = useState<PendingOAuthData | null>(null);
  const { settings: biSettings } = useBIProSettings();
  const { data: appSettings } = useSettings();
  const { metaAccounts, googleAccounts, isLoading, deleteAccount, syncAccount } = useBIProAdAccounts();

  useEffect(() => {
    const readPending = (key: string, requireAccounts: boolean): PendingOAuthData | null => {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      sessionStorage.removeItem(key);
      try {
        const parsed = JSON.parse(raw) as PendingOAuthData;
        if (!parsed.access_token) return null;
        if (requireAccounts && (parsed.accounts?.length ?? 0) === 0) return null;
        return parsed;
      } catch { return null; }
    };

    const google = readPending('google_oauth_pending', false);
    const meta   = readPending('meta_oauth_pending', true);
    if (google) setPendingGoogle(google);
    if (meta)   setPendingMeta(meta);
  }, []);

  const handleSync = (id: string, from: string, to: string) => {
    setSyncingId(id);
    syncAccount.mutate(
      { ad_account_id: id, date_from: from, date_to: to },
      { onSettled: () => setSyncingId(null) }
    );
  };

  const handleDelete = (id: string) => {
    if (!confirm('Remover esta conta? Os dados de gasto sincronizados serão mantidos.')) return;
    deleteAccount.mutate(id);
  };

  const showMeta = !platform || platform === 'meta';
  const showGoogle = !platform || platform === 'google';

  const title = platform === 'meta' ? 'Meta Ads' : platform === 'google' ? 'Google Ads' : 'Integrações de Ads';
  const description = platform === 'meta'
    ? 'Conecte contas de Meta Ads (Facebook & Instagram) para sincronizar gastos e calcular CAC real.'
    : platform === 'google'
    ? 'Conecte contas de Google Ads para sincronizar gastos e calcular CAC real.'
    : 'Conecte contas de Meta e Google Ads para sincronizar gastos e calcular CAC real.';

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div className="pb-4 border-b border-border">
        <h1 className="text-[15px] font-semibold text-foreground">{title}</h1>
        <p className="text-[13px] text-muted-foreground/70 mt-0.5">{description}</p>
      </div>

      {/* Account pickers — shown after OAuth redirect */}
      {showMeta && pendingMeta && (
        <AccountPicker platform="meta" pending={pendingMeta} onDone={() => setPendingMeta(null)} />
      )}
      {showGoogle && pendingGoogle && (
        <AccountPicker platform="google" pending={pendingGoogle} onDone={() => setPendingGoogle(null)} />
      )}

      {/* Connected accounts */}
      <div className="border border-border rounded-[2px] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border bg-muted">
          <p className="text-[13px] font-medium text-foreground">Contas Conectadas</p>
          <p className="text-[12px] text-muted-foreground/50 mt-0.5">
            Sincronize para importar gastos e calcular CAC real.
          </p>
        </div>
        <div className="px-5 py-5 space-y-5">
          {showMeta && (
            <PlatformSection
              type="meta" label="Meta Ads — Facebook & Instagram" Icon={MetaIcon}
              clientId={biSettings?.meta_app_id ?? null}
              accounts={metaAccounts} onSync={handleSync} onDelete={handleDelete}
              syncingId={syncingId} isLoading={isLoading}
            />
          )}
          {showMeta && showGoogle && <div className="border-t border-border" />}
          {showGoogle && (
            <PlatformSection
              type="google" label="Google Ads" Icon={GoogleIcon}
              clientId={appSettings?.google_client_id ?? null}
              hasDeveloperToken={!!biSettings?.google_developer_token}
              accounts={googleAccounts} onSync={handleSync} onDelete={handleDelete}
              syncingId={syncingId} isLoading={isLoading}
            />
          )}
        </div>
      </div>

      {/* Credentials */}
      {!hideCredentials && (
        <div className="border border-border rounded-[2px] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border bg-muted">
            <p className="text-[13px] font-medium text-foreground">Credenciais OAuth</p>
            <p className="text-[12px] text-muted-foreground/50 mt-0.5">
              Armazenados de forma segura no servidor.
            </p>
          </div>
          <div className="px-5 py-5 space-y-5">
            {showMeta && <MetaCredentialsForm />}
            {showMeta && showGoogle && <div className="border-t border-border" />}
            {showGoogle && <GoogleCredentialsForm />}
          </div>
        </div>
      )}
    </div>
  );
}
