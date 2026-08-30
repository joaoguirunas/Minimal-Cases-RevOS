import { AlertTriangle } from "lucide-react";
import ConfigWizardStep from "../ConfigWizardStep";

interface Step2EnableApiProps {
  isFocused: boolean;
  onNext: () => void;
}

export default function Step2EnableApi({ isFocused, onNext }: Step2EnableApiProps) {
  return (
    <ConfigWizardStep
      stepNumber={2}
      title="Habilitar Google Calendar API"
      instruction="Habilite a Google Calendar API no projeto que você selecionou. Sem ela, a integração não funciona."
      externalUrl="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com"
      externalLabel="Abrir Calendar API no Google Cloud"
      ctaLabel="Já habilitei"
      onCta={onNext}
      isFocused={isFocused}
    >
      <div className="flex items-start gap-2.5 p-3 rounded-[4px] border border-amber-500/30 bg-amber-500/5">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Após abrir o link:</p>
          <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-0.5">
            <li>Verifique que o projeto correto está selecionado (topo da tela)</li>
            <li>Clique em <strong>"Enable"</strong></li>
            <li>Volte aqui e clique "Já habilitei"</li>
          </ol>
        </div>
      </div>
    </ConfigWizardStep>
  );
}
