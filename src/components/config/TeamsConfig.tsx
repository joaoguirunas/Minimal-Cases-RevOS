import { useState, useEffect } from "react";
import { Save, ExternalLink, CheckCircle2, AlertCircle, Copy, Check, Info, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useBIProSettings } from "@/hooks/useBIProSettings";

const AZURE_PORTAL_URL    = "https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade";
const AZURE_NEW_APP_URL   = "https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/CreateApplicationBlade";
const GRAPH_PERMISSIONS   = "https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps";

const TEAMS_SCOPES = [
  "OnlineMeetings.ReadWrite",
  "offline_access",
  "User.Read",
];

export default function TeamsConfig() {
  const { settings, isLoading, saveSettings } = useBIProSettings();
  const [clientId, setClientId]         = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [showSecret, setShowSecret]     = useState(false);
  const [copied, setCopied]             = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = settings as any;
    if (s?.ms_client_id) setClientId(s.ms_client_id);
  }, [settings]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = settings as any;
  const isIdSaved         = !!s?.ms_client_id;
  const isSecretSaved     = !!s?.ms_client_secret;
  const isFullyConfigured = isIdSaved && isSecretSaved;

  const isIdDirty     = clientId.trim() !== (s?.ms_client_id ?? "");
  const isSecretDirty = clientSecret.trim() !== "";

  const handleSaveId = () =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (saveSettings as any).mutate({ ms_client_id: clientId.trim() });
  const handleSaveSecret = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (saveSettings as any).mutate({ ms_client_secret: clientSecret.trim() });
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

  const redirectUri = `${window.location.origin}/oauth/microsoft/callback`;

  return (
    <div className="space-y-5">

      {/* Header + status */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Microsoft Teams OAuth</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Credenciais do Azure Active Directory para criar reuniões Teams automaticamente.
          </p>
        </div>
        {isFullyConfigured ? (
          <Badge variant="outline" className="gap-1.5 rounded-[4px] shrink-0 text-emerald-600 border-emerald-500/40 bg-emerald-500/5">
            <CheckCircle2 className="w-3 h-3" /> Configurado
          </Badge>
        ) : isIdSaved ? (
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

        {/* Step 1 — Register app */}
        <div className="p-4 flex gap-3">
          <StepNum n={1} />
          <div className="flex-1 min-w-0 space-y-2">
            <p className="text-sm font-medium text-foreground">Registrar app no Azure Active Directory</p>
            <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal list-inside">
              <li>Acesse o <strong>Azure Portal → App registrations</strong></li>
              <li>Clique em <strong>New registration</strong></li>
              <li>Nome: qualquer (ex: <code className="text-[11px]">Growthsales CRM</code>)</li>
              <li>Supported account types: <strong>Accounts in any organizational directory and personal Microsoft accounts</strong></li>
              <li>Redirect URI: <strong>Web</strong>, adicione a URI abaixo</li>
            </ol>
            <div className="flex items-center gap-2">
              <code className="text-[11px] bg-muted px-2 py-1 rounded-[3px] text-muted-foreground flex-1 truncate">
                {redirectUri}
              </code>
              <CopyBtn text={redirectUri} k="uri" />
            </div>
            <Link href={AZURE_NEW_APP_URL}>Abrir Azure Portal → Registrar app</Link>
          </div>
        </div>

        {/* Step 2 — Copy Application ID */}
        <div className="p-4 flex gap-3">
          <StepNum n={2} />
          <div className="flex-1 space-y-1.5">
            <p className="text-sm font-medium text-foreground">Copiar o Application (client) ID</p>
            <p className="text-xs text-muted-foreground">
              Após criar o app, na tela <strong>Overview</strong> copie o <strong>Application (client) ID</strong>. Você vai precisar dele no Passo 6.
            </p>
            <Link href={AZURE_PORTAL_URL}>Abrir App registrations</Link>
          </div>
        </div>

        {/* Step 3 — Add permissions */}
        <div className="p-4 flex gap-3">
          <StepNum n={3} />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium text-foreground">Adicionar permissões Microsoft Graph</p>
            <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal list-inside">
              <li>No app registrado, vá em <strong>API permissions → Add a permission</strong></li>
              <li>Selecione <strong>Microsoft Graph → Delegated permissions</strong></li>
              <li>Busque e adicione os escopos abaixo</li>
              <li>Clique em <strong>Grant admin consent</strong> (se disponível)</li>
            </ol>
            <div className="space-y-1 mt-1">
              {TEAMS_SCOPES.map(scope => (
                <div key={scope} className="flex items-center gap-2">
                  <CopyBtn text={scope} k={scope} />
                  <code className="text-[11px] text-muted-foreground">{scope}</code>
                </div>
              ))}
            </div>
            <Link href={GRAPH_PERMISSIONS}>Abrir App registrations → API permissions</Link>
          </div>
        </div>

        {/* Step 4 — Create secret */}
        <div className="p-4 flex gap-3">
          <StepNum n={4} />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium text-foreground">Criar um Client Secret</p>
            <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal list-inside">
              <li>No app, vá em <strong>Certificates &amp; secrets → New client secret</strong></li>
              <li>Escolha uma validade (recomendado: <strong>24 meses</strong>)</li>
              <li>Clique em <strong>Add</strong></li>
              <li>Copie o <strong>Value</strong> imediatamente — ele só é visível uma vez</li>
            </ol>
          </div>
        </div>

        {/* Step 5 — Info about mutual exclusivity */}
        <div className="p-4 flex gap-3">
          <StepNum n={5} />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium text-foreground">Como funciona a integração</p>
            <div className="flex items-start gap-2 p-2 rounded-[4px] bg-blue-500/5 border border-blue-500/20">
              <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 dark:text-blue-400">
                Cada consultor pode conectar <strong>Google Calendar OU Microsoft Teams</strong> — não os dois ao mesmo tempo. Ao conectar Teams, o Google Agenda é desconectado automaticamente.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Quando uma reunião é criada, o link do Teams é gerado automaticamente e salvo no campo "Link da Reunião".
            </p>
          </div>
        </div>

        {/* Step 6 — Client ID input */}
        <div className="p-4 flex gap-3">
          <StepNum n={6} done={isIdSaved && !isIdDirty} />
          <div className="flex-1 space-y-3">
            <p className="text-sm font-medium text-foreground">
              Inserir o Application (client) ID
              {isIdSaved && !isIdDirty && <span className="ml-2 text-xs font-normal text-emerald-600">— salvo ✓</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              O Application ID do app Azure (formato: <code className="text-[11px]">xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</code>).
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="ms-client-id" className="text-xs">Azure Application (client) ID</Label>
              <div className="flex gap-2">
                <Input
                  id="ms-client-id"
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  disabled={isLoading}
                  className={`font-mono text-xs flex-1 ${isIdSaved && !isIdDirty ? "border-emerald-500/40 bg-emerald-500/5" : ""}`}
                />
                <Button
                  size="sm"
                  className="h-[30px] px-3 rounded-[4px] shrink-0"
                  onClick={handleSaveId}
                  disabled={isLoading || saveSettings.isPending || !clientId.trim() || !isIdDirty}
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {saveSettings.isPending ? "Salvando…" : "Salvar"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Step 7 — Client Secret input */}
        <div className="p-4 flex gap-3">
          <StepNum n={7} done={isSecretSaved && !isSecretDirty} />
          <div className="flex-1 space-y-3">
            <p className="text-sm font-medium text-foreground">
              Inserir o Client Secret
              {isSecretSaved && !isSecretDirty && <span className="ml-2 text-xs font-normal text-emerald-600">— salvo ✓</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              O <strong>Value</strong> do secret criado na Etapa 4 — visível apenas no momento da criação.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="ms-client-secret" className="text-xs">Azure Client Secret</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="ms-client-secret"
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
      {isFullyConfigured && !isIdDirty && !isSecretDirty ? (
        <div className="flex items-center gap-3 p-3 rounded-[4px] border border-emerald-500/25 bg-emerald-500/5">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Microsoft Teams configurado</p>
            <p className="text-xs text-muted-foreground truncate">
              Client ID: <code className="font-mono">{s?.ms_client_id?.slice(0, 25)}…</code>
            </p>
          </div>
          <a href="/dashboard/perfil" className="text-xs text-primary hover:underline underline-offset-2 shrink-0">
            Conectar Teams →
          </a>
        </div>
      ) : isIdSaved && !isSecretSaved ? (
        <div className="flex items-center gap-3 p-3 rounded-[4px] border border-amber-500/25 bg-amber-500/5">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Client ID salvo. Preencha o <strong>Client Secret</strong> (Passo 7) para concluir.
          </p>
        </div>
      ) : null}

    </div>
  );
}
