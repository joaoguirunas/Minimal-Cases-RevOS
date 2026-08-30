import { PromptEtapaEditor, type Etapa } from './PromptEtapaEditor';
import { ToolWidgetPanel } from './ToolWidgetPanel';
import { Switch } from '@/components/ui/switch';
import type { AgenteIA } from '@/hooks/useAgentesIA';

interface PromptsTabProps {
  agente: AgenteIA;
  etapas: Etapa[];
  onAgentChange: (data: Partial<AgenteIA>) => void;
  onEtapasChange: (etapas: Etapa[]) => void;
  pipelines?: Array<{ id: string; nome: string }>;
  stages?: Array<{ id: string; nome: string; pipeline_id: string; ordem: number }>;
}

export const PromptsTab = ({
  agente,
  etapas,
  onAgentChange,
  onEtapasChange,
  pipelines = [],
  stages = [],
}: PromptsTabProps) => {
  const etapasValidas =
    etapas.length > 0
      ? etapas
      : [{ id: 'etapa-1', controle: 1, prompt: '', nome: 'Etapa 1' }];

  return (
    <div className="flex h-full">

      {/* ── Center — prompt editor ── */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xs font-semibold text-foreground">
                Prompts por Controle
              </h3>
              {!(agente.usa_etapas ?? false) ? (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                  Desativado — o agente IGNORA estes controles e usa só Identidade + Regras Gerais
                </p>
              ) : etapasValidas.length > 1 ? (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {etapasValidas.length} controles configurados — o campo{' '}
                  <code className="font-mono text-primary/80 bg-muted px-0.5 rounded">control</code>{' '}
                  do lead determina qual executa
                </p>
              ) : (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Um controle executa para todos os leads nesta etapa
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 pt-0.5">
              <Switch
                checked={agente.usa_etapas ?? false}
                onCheckedChange={(v) => onAgentChange({ usa_etapas: v })}
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {(agente.usa_etapas ?? false) ? 'Controles ativos' : 'Controles off'}
              </span>
            </div>
          </div>

          <PromptEtapaEditor
            etapas={etapasValidas}
            onChange={onEtapasChange}
          />
        </div>
      </div>

      {/* ── Right sidebar 300px — Tool Widgets ── */}
      <div className="w-[300px] shrink-0 border-l border-white/[0.06] overflow-y-auto bg-background">
        <div className="p-3">
          <ToolWidgetPanel
            pipelines={pipelines}
            stages={stages}
            agentPipelineId={agente.pipeline_id ?? undefined}
          />
        </div>
      </div>

    </div>
  );
};
