import { useState } from "react";
import { Check, Copy, Info, ExternalLink } from "lucide-react";
import ConfigWizardStep from "../ConfigWizardStep";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

interface Step3ConsentProps {
  isFocused: boolean;
  onNext: () => void;
}

export default function Step3Consent({ isFocused, onNext }: Step3ConsentProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  };

  return (
    <ConfigWizardStep
      stepNumber={3}
      title="Configurar tela de consentimento OAuth"
      instruction='Configure a tela de consentimento OAuth para autorizar acesso ao Google Calendar dos consultores.'
      externalUrl="https://console.cloud.google.com/auth/overview"
      externalLabel="Abrir Auth Platform"
      ctaLabel="Já configurei, continuar"
      onCta={onNext}
      isFocused={isFocused}
    >
      {/* Sub-instruções */}
      <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1 leading-relaxed">
        <li>Clique em <strong className="text-foreground">"Get started"</strong> e preencha nome do app e email de contato</li>
        <li>Em <strong className="text-foreground">"Audience"</strong>: selecione <strong className="text-foreground">"External"</strong></li>
        <li>Em <strong className="text-foreground">"Scopes"</strong>: adicione os escopos abaixo</li>
        <li>Em <strong className="text-foreground">"Test Users"</strong> (se External + Testing): adicione emails dos consultores</li>
      </ol>

      {/* Escopos a copiar */}
      <div className="border border-border rounded-[4px] bg-muted/30 divide-y divide-border">
        {SCOPES.map((scope, i) => (
          <div key={i} className="flex items-center justify-between gap-2 px-3 py-2">
            <code className="text-[10px] text-muted-foreground font-mono truncate">{scope}</code>
            <button
              type="button"
              onClick={() => handleCopy(scope, scope)}
              aria-label={`Copiar ${scope}`}
              className="shrink-0 p-1.5 rounded-[3px] hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              {copied === scope
                ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        ))}
      </div>

      {/* Callout Testing vs Production */}
      <div className="flex items-start gap-2.5 p-3 rounded-[4px] border border-blue-500/20 bg-blue-500/5">
        <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-xs font-medium text-blue-700 dark:text-blue-400">Modo Testing</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Apps em "Testing" expiram tokens após 7 dias. Quando pronto, publique o app em "Audience" para duração indefinida.
          </p>
          <a
            href="https://console.cloud.google.com/auth/audience"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Abrir Audience (abre em nova aba)"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline underline-offset-2"
          >
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
            Abrir Audience
          </a>
        </div>
      </div>
    </ConfigWizardStep>
  );
}
