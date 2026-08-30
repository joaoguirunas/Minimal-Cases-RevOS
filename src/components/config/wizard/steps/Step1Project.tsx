import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ConfigWizardStep from "../ConfigWizardStep";

interface Step1ProjectProps {
  isFocused: boolean;
  onNext: () => void;
}

export default function Step1Project({ isFocused, onNext }: Step1ProjectProps) {
  const [projectId, setProjectId] = useState("");

  return (
    <ConfigWizardStep
      stepNumber={1}
      title="Criar ou selecionar projeto Google"
      instruction="Crie ou selecione um projeto no Google Cloud Console. Todos os próximos passos precisam estar dentro do mesmo projeto."
      externalUrl="https://console.cloud.google.com/projectcreate"
      externalLabel="Criar projeto no Google Cloud"
      ctaLabel="Tenho um projeto, continuar"
      onCta={onNext}
      onSkip={onNext}
      skipLabel="Já tenho um projeto"
      isOptional
      isFocused={isFocused}
    >
      <div className="space-y-1.5">
        <Label htmlFor="gcp-project-id" className="text-xs font-medium text-foreground">
          ID do projeto (para referência)
        </Label>
        <Input
          id="gcp-project-id"
          value={projectId}
          onChange={e => setProjectId(e.target.value)}
          placeholder="Exemplo: growthsales-production"
          className="text-xs rounded-[4px]"
        />
        <p className="text-[11px] text-muted-foreground/60">
          Não salvamos isso — apenas referência para você.
        </p>
      </div>
    </ConfigWizardStep>
  );
}
