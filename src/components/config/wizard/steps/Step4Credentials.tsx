import { useState } from "react";
import { Check, Copy, Eye, EyeOff, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import ConfigWizardStep, { CtaState } from "../ConfigWizardStep";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";

const PROD_ORIGIN = "https://crm.joaoguirunas.com";
const CURRENT_ORIGIN = typeof window !== "undefined" ? window.location.origin : PROD_ORIGIN;
const IS_PROD_ORIGIN = CURRENT_ORIGIN === PROD_ORIGIN;
const CLIENT_ID_REGEX = /^.+\.apps\.googleusercontent\.com$/;
const CLIENT_SECRET_REGEX = /^GOCSPX-/;

interface UriRowProps {
  label: string;
  uri: string;
  copied: string | null;
  onCopy: (uri: string) => void;
}

function UriRow({ label, uri, copied, onCopy }: UriRowProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-muted-foreground/60 mb-0.5">{label}</p>
        <code className="text-[11px] text-muted-foreground font-mono truncate block">{uri}</code>
      </div>
      <button
        type="button"
        onClick={() => onCopy(uri)}
        aria-label={`Copiar ${label}`}
        className="shrink-0 p-1.5 rounded-[3px] hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
      >
        {copied === uri
          ? <Check className="w-3.5 h-3.5 text-emerald-500" />
          : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

interface Step4CredentialsProps {
  isFocused: boolean;
  onNext: () => void;
}

export default function Step4Credentials({ isFocused, onNext }: Step4CredentialsProps) {
  const { data: settings } = useSettings();
  const saveSettings = useUpdateSettings();

  const [clientId, setClientId] = useState(settings?.google_client_id ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [ctaState, setCtaState] = useState<CtaState>('idle');
  const [ctaError, setCtaError] = useState<string | undefined>();
  const [copied, setCopied] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  const isIdValid = CLIENT_ID_REGEX.test(clientId.trim());
  const isSecretValid = CLIENT_SECRET_REGEX.test(clientSecret.trim()) || (!!settings?.google_client_secret && clientSecret === "");
  const canSave = clientId.trim() && isIdValid && (clientSecret.trim() ? CLIENT_SECRET_REGEX.test(clientSecret.trim()) : !!settings?.google_client_secret);

  const handleCopy = (uri: string) => {
    navigator.clipboard.writeText(uri);
    setCopied(uri);
    setTimeout(() => setCopied(null), 1800);
  };

  const handleSave = () => {
    setCtaState('loading');
    setCtaError(undefined);

    const payload: Record<string, string> = { google_client_id: clientId.trim() };
    if (clientSecret.trim()) payload.google_client_secret = clientSecret.trim();

    saveSettings.mutate(payload as Parameters<typeof saveSettings.mutate>[0], {
      onSuccess: () => {
        setCtaState('success');
        setClientSecret("");
        setTimeout(() => onNext(), 1500);
      },
      onError: (err) => {
        setCtaState('error');
        setCtaError(err instanceof Error ? err.message : 'Erro ao salvar. Tente novamente.');
      },
    });
  };

  return (
    <ConfigWizardStep
      stepNumber={4}
      title="Criar credenciais OAuth 2.0"
      instruction='Crie uma credencial OAuth 2.0 do tipo "Web application" e cole as URIs abaixo antes de copiar as credenciais.'
      externalUrl="https://console.cloud.google.com/apis/credentials"
      externalLabel="Abrir Credenciais"
      ctaLabel="Salvar credenciais"
      ctaState={ctaState}
      ctaDisabled={!canSave}
      ctaError={ctaError}
      onCta={handleSave}
      isFocused={isFocused}
    >
      {/* URIs em destaque */}
      <div className="border border-primary/20 rounded-[4px] bg-muted/40 p-3 space-y-3">
        <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide">
          URIs que devem ser adicionadas nas credenciais
        </p>

        <div className="space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground">JavaScript Origins</p>
          <div className="space-y-1.5 border border-border rounded-[3px] bg-card divide-y divide-border">
            {!IS_PROD_ORIGIN && (
              <div className="p-2">
                <UriRow label="Origem atual (este acesso)" uri={CURRENT_ORIGIN} copied={copied} onCopy={handleCopy} />
              </div>
            )}
            <div className="p-2">
              <UriRow label="Produção" uri={PROD_ORIGIN} copied={copied} onCopy={handleCopy} />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground">Redirect URIs</p>
          <div className="space-y-1.5 border border-border rounded-[3px] bg-card divide-y divide-border">
            {!IS_PROD_ORIGIN && (
              <div className="p-2">
                <UriRow
                  label="Origem atual (este acesso)"
                  uri={`${CURRENT_ORIGIN}/oauth/google/callback`}
                  copied={copied}
                  onCopy={handleCopy}
                />
              </div>
            )}
            <div className="p-2">
              <UriRow
                label="Produção"
                uri={`${PROD_ORIGIN}/oauth/google/callback`}
                copied={copied}
                onCopy={handleCopy}
              />
            </div>
            <div className="p-2">
              <UriRow
                label="Dev (localhost)"
                uri="http://localhost:8080/oauth/google/callback"
                copied={copied}
                onCopy={handleCopy}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Campos de credenciais */}
      <div className="space-y-3">
        {/* Client ID */}
        <div className="space-y-1.5">
          <Label htmlFor="s4-client-id" className="text-xs font-medium text-foreground">
            Client ID <span className="text-destructive">*</span>
          </Label>
          <Input
            id="s4-client-id"
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            placeholder="xxxxxxxxxx-xxxx.apps.googleusercontent.com"
            className={`font-mono text-xs rounded-[4px] ${clientId && isIdValid ? "border-emerald-500/40 bg-emerald-500/5" : ""}`}
          />
          {clientId && !isIdValid && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
              Deve terminar em <code className="text-[11px]">.apps.googleusercontent.com</code>
            </p>
          )}
        </div>

        {/* Client Secret */}
        <div className="space-y-1.5">
          <Label htmlFor="s4-client-secret" className="text-xs font-medium text-foreground">
            Client Secret <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Input
              id="s4-client-secret"
              type={showSecret ? "text" : "password"}
              value={clientSecret}
              onChange={e => setClientSecret(e.target.value)}
              placeholder={settings?.google_client_secret
                ? "•••••• (salvo — cole para substituir)"
                : "GOCSPX-..."}
              className={`font-mono text-xs pr-9 rounded-[4px] ${settings?.google_client_secret && !clientSecret ? "border-emerald-500/40 bg-emerald-500/5" : ""}`}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowSecret(v => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showSecret ? "Ocultar secret" : "Mostrar secret"}
            >
              {showSecret
                ? <EyeOff className="w-3.5 h-3.5" />
                : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          {clientSecret && !CLIENT_SECRET_REGEX.test(clientSecret) && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
              O Client Secret do Google começa com <code className="text-[11px]">GOCSPX-</code>
            </p>
          )}
        </div>
      </div>

      {/* Guia colapsável */}
      <Collapsible open={guideOpen} onOpenChange={setGuideOpen}>
        <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          {guideOpen
            ? <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            : <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />}
          Como criar a credencial passo a passo
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ol className="mt-2 text-xs text-muted-foreground list-decimal list-inside space-y-1 leading-relaxed pl-1">
            <li>Na página de Credenciais, clique <strong className="text-foreground">"+ Create Credentials"</strong> → <strong className="text-foreground">"OAuth client ID"</strong></li>
            <li>Tipo: <strong className="text-foreground">"Web application"</strong></li>
            <li>Adicione as JavaScript Origins e Redirect URIs acima</li>
            <li>Clique <strong className="text-foreground">"Create"</strong></li>
            <li>Copie o Client ID e Client Secret que aparecerão no modal</li>
          </ol>
        </CollapsibleContent>
      </Collapsible>
    </ConfigWizardStep>
  );
}
