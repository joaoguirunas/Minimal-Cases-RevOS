import { useState, useEffect } from "react";
import { Save, ExternalLink, CheckCircle2, AlertCircle, Copy, Check, Info, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useBIProSettings } from "@/hooks/useBIProSettings";

const ZOOM_MARKETPLACE_URL = "https://marketplace.zoom.us/";
const ZOOM_NEW_APP_URL     = "https://marketplace.zoom.us/develop/create";

export default function ZoomConfig() {
  const { settings, isLoading, saveSettings } = useBIProSettings();
  const [accountId, setAccountId]     = useState("");
  const [clientId, setClientId]       = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [showSecret, setShowSecret]   = useState(false);
  const [copied, setCopied]           = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = settings as any;
    if (s?.zoom_account_id) setAccountId(s.zoom_account_id);
    if (s?.zoom_client_id)  setClientId(s.zoom_client_id);
  }, [settings]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = settings as any;
  const isAccountIdSaved  = !!s?.zoom_account_id;
  const isClientIdSaved   = !!s?.zoom_client_id;
  const isSecretSaved     = !!s?.zoom_client_secret;
  const isFullyConfigured = isClientIdSaved && isSecretSaved;

  const isAccountIdDirty = accountId.trim() !== (s?.zoom_account_id ?? "");
  const isClientIdDirty  = clientId.trim() !== (s?.zoom_client_id ?? "");
  const isSecretDirty    = clientSecret.trim() !== "";

  const handleSaveAccountId = () =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (saveSettings as any).mutate({ zoom_account_id: accountId.trim() });

  const handleSaveClientId = () =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (saveSettings as any).mutate({ zoom_client_id: clientId.trim() });

  const handleSaveSecret = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (saveSettings as any).mutate({ zoom_client_secret: clientSecret.trim() });
    setClientSecret("");
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  };

  const CopyBtn = ({ text, k }: { text: string; k: string }) => (
    <button
      onClick={() => handleCopy(text, k)}
      className="shrink-0 p-1.5 rounded-[3px] hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      title="Copiar"
    >
      {copied === k ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );

  const Link = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline underline-offset-2"
    >
      {children}
      <ExternalLink className="w-3 h-3" />
    </a>
  );

  const StepNum = ({ n, done }: { n: number; done?: boolean }) => (
    <div className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5 ${done ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary"}`}>
      {done ? <CheckCircle2 className="w-3 h-3" /> : n}
    </div>
  );

  const redirectUri = `${window.location.origin}/oauth/zoom/callback`;

  return (
    <div className="space-y-5">

      {/* Header + status */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Zoom OAuth</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Credenciais do Zoom Marketplace para criar reuniões automaticamente.
          </p>
        </div>
        {isFullyConfigured ? (
          <Badge variant="outline" className="gap-1.5 rounded-[4px] shrink-0 text-emerald-600 border-emerald-500/40 bg-emerald-500/5">
            <CheckCircle2 className="w-3 h-3" /> Configurado
          </Badge>
        ) : isClientIdSaved ? (
          <Badge variant="outline" className="gap-1.5 rounded-[4px] shrink-0 text-amber-600 border-amber-500/40 bg-amber-500/5">
            <AlertCircle className="w-3 h-3" /> Secret pendente
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1.5 rounded-[4px] shrink-0 text-muted-foreground border-border bg-muted">
            <AlertCircle className="w-3 h-3" /> Não configurado
          </Badge>
        )}
      </div>

      {/* Steps */}
      <div className="border border-border rounded-[4px] bg-card divide-y divide-border">

        {/* Step 1 — Create app */}
        <div className="p-4 flex gap-3">
          <StepNum n={1} />
          <div className="flex-1 min-w-0 space-y-2">
            <p className="text-sm font-medium text-foreground">Criar app no Zoom Marketplace</p>
            <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal list-inside">
              <li>Acesse o <strong>Zoom Marketplace → Develop</strong></li>
              <li>Clique em <strong>Build App</strong> e selecione <strong>User-managed OAuth app</strong></li>
              <li>Nome: qualquer (ex: <code className="text-[11px]">Growthsales CRM</code>)</li>
              <li>Em <strong>OAuth Information</strong>, adicione a Redirect URI abaixo</li>
            </ol>
            <div className="flex items-center gap-2">
              <code className="text-[11px] bg-muted px-2 py-1 rounded-[3px] text-muted-foreground flex-1 truncate">
                {redirectUri}
              </code>
              <CopyBtn text={redirectUri} k="uri" />
            </div>
            <Link href={ZOOM_NEW_APP_URL}>Abrir Zoom Marketplace → Build App</Link>
          </div>
        </div>

        {/* Step 2 — Scopes */}
        <div className="p-4 flex gap-3">
          <StepNum n={2} />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium text-foreground">Adicionar escopos (Scopes)</p>
            <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal list-inside">
              <li>Na app criada, acesse a aba <strong>Scopes</strong></li>
              <li>Adicione os seguintes escopos:</li>
            </ol>
            <div className="space-y-1 mt-1">
              {["meeting:write:user", "user:read:user"].map(scope => (
                <div key={scope} className="flex items-center gap-2">
                  <CopyBtn text={scope} k={scope} />
                  <code className="text-[11px] text-muted-foreground">{scope}</code>
                </div>
              ))}
            </div>
            <Link href={ZOOM_MARKETPLACE_URL}>Abrir Zoom Marketplace</Link>
          </div>
        </div>

        {/* Step 3 — How it works */}
        <div className="p-4 flex gap-3">
          <StepNum n={3} />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium text-foreground">Como funciona a integração</p>
            <div className="flex items-start gap-2 p-2 rounded-[4px] bg-blue-500/5 border border-blue-500/20">
              <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 dark:text-blue-400">
                Cada consultor conecta a sua própria conta Zoom (OAuth User-Level). Ao criar uma reunião com Zoom como provider, o link é gerado automaticamente e salvo no campo "Link da Reunião".
              </p>
            </div>
          </div>
        </div>

        {/* Step 4 — Account ID */}
        <div className="p-4 flex gap-3">
          <StepNum n={4} done={isAccountIdSaved && !isAccountIdDirty} />
          <div className="flex-1 space-y-3">
            <p className="text-sm font-medium text-foreground">
              Inserir o Account ID
              {isAccountIdSaved && !isAccountIdDirty && <span className="ml-2 text-xs font-normal text-emerald-600">— salvo ✓</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              Encontrado em <strong>Zoom Marketplace → App → App Credentials → Account ID</strong>.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="zoom-account-id" className="text-xs">Zoom Account ID</Label>
              <div className="flex gap-2">
                <Input
                  id="zoom-account-id"
                  value={accountId}
                  onChange={e => setAccountId(e.target.value)}
                  placeholder="xxxxxxxxxxxxxxxxxx"
                  disabled={isLoading}
                  className={`font-mono text-xs flex-1 ${isAccountIdSaved && !isAccountIdDirty ? "border-emerald-500/40 bg-emerald-500/5" : ""}`}
                />
                <Button
                  size="sm"
                  className="h-[30px] px-3 rounded-[4px] shrink-0"
                  onClick={handleSaveAccountId}
                  disabled={isLoading || saveSettings.isPending || !accountId.trim() || !isAccountIdDirty}
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {saveSettings.isPending ? "Salvando…" : "Salvar"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Step 5 — Client ID */}
        <div className="p-4 flex gap-3">
          <StepNum n={5} done={isClientIdSaved && !isClientIdDirty} />
          <div className="flex-1 space-y-3">
            <p className="text-sm font-medium text-foreground">
              Inserir o Client ID
              {isClientIdSaved && !isClientIdDirty && <span className="ml-2 text-xs font-normal text-emerald-600">— salvo ✓</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              Encontrado em <strong>Zoom Marketplace → App → App Credentials → Client ID</strong>.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="zoom-client-id" className="text-xs">Zoom Client ID</Label>
              <div className="flex gap-2">
                <Input
                  id="zoom-client-id"
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  placeholder="xxxxxxxxxxxxxxxxxx"
                  disabled={isLoading}
                  className={`font-mono text-xs flex-1 ${isClientIdSaved && !isClientIdDirty ? "border-emerald-500/40 bg-emerald-500/5" : ""}`}
                />
                <Button
                  size="sm"
                  className="h-[30px] px-3 rounded-[4px] shrink-0"
                  onClick={handleSaveClientId}
                  disabled={isLoading || saveSettings.isPending || !clientId.trim() || !isClientIdDirty}
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {saveSettings.isPending ? "Salvando…" : "Salvar"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Step 6 — Client Secret */}
        <div className="p-4 flex gap-3">
          <StepNum n={6} done={isSecretSaved && !isSecretDirty} />
          <div className="flex-1 space-y-3">
            <p className="text-sm font-medium text-foreground">
              Inserir o Client Secret
              {isSecretSaved && !isSecretDirty && <span className="ml-2 text-xs font-normal text-emerald-600">— salvo ✓</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              Encontrado em <strong>Zoom Marketplace → App → App Credentials → Client Secret</strong> — visível apenas uma vez.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="zoom-client-secret" className="text-xs">Zoom Client Secret</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="zoom-client-secret"
                    type={showSecret ? "text" : "password"}
                    value={clientSecret}
                    onChange={e => setClientSecret(e.target.value)}
                    placeholder={isSecretSaved ? "•••••••••• (configurado — cole para substituir)" : "Valor do secret…"}
                    disabled={isLoading}
                    className={`font-mono text-xs pr-9 ${isSecretSaved && !isSecretDirty ? "border-emerald-500/40 bg-emerald-500/5" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <Button
                  size="sm"
                  className="h-[30px] px-3 rounded-[4px] shrink-0"
                  onClick={handleSaveSecret}
                  disabled={isLoading || saveSettings.isPending || !isSecretDirty}
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {saveSettings.isPending ? "Salvando…" : "Salvar"}
                </Button>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Status banner */}
      {isFullyConfigured && !isClientIdDirty && !isSecretDirty ? (
        <div className="flex items-center gap-3 p-3 rounded-[4px] border border-emerald-500/25 bg-emerald-500/5">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Zoom configurado</p>
            <p className="text-xs text-muted-foreground truncate">
              Client ID: <code className="font-mono">{s?.zoom_client_id?.slice(0, 25)}…</code>
            </p>
          </div>
          <a href="/settings/general/integracoes?tab=zoom" className="text-xs text-primary hover:underline underline-offset-2 shrink-0">
            Conectar Zoom →
          </a>
        </div>
      ) : isClientIdSaved && !isSecretSaved ? (
        <div className="flex items-center gap-3 p-3 rounded-[4px] border border-amber-500/25 bg-amber-500/5">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Client ID salvo. Preencha o <strong>Client Secret</strong> (Passo 6) para concluir.
          </p>
        </div>
      ) : null}

    </div>
  );
}
