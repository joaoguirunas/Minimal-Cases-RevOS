import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GitFork, X, Plus } from "lucide-react";
import { toast } from "sonner";
import type { Pipeline, Stage } from "@/hooks/usePipelines";
import {
  useStageDuplicationRules, useCreateStageDuplicationRule, useDeleteStageDuplicationRule,
} from "@/hooks/useStageDuplicationRules";

const FIRST_STAGE_VALUE = "__first__";

interface StageDuplicationPopoverProps {
  stage: Stage;
  pipelines: Pipeline[];
  stages: Stage[];
}

const StageDuplicationPopover = ({ stage, pipelines, stages }: StageDuplicationPopoverProps) => {
  const [open, setOpen] = useState(false);
  const [showNewRule, setShowNewRule] = useState(false);
  const [newTargetPipeline, setNewTargetPipeline] = useState("");
  const [newTargetStage, setNewTargetStage] = useState(FIRST_STAGE_VALUE);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: rules = [] } = useStageDuplicationRules(stage.id);
  const createRule = useCreateStageDuplicationRule();
  const deleteRule = useDeleteStageDuplicationRule();

  const availableTargetPipelines = pipelines.filter(
    p => (p.ativo ?? p.active) && p.id !== stage.pipeline_id && !rules.some(r => r.target_pipeline_id === p.id)
  );
  const newTargetStages = stages.filter(s => s.pipeline_id === newTargetPipeline).sort((a, b) => a.ordem - b.ordem);

  const resetForm = () => {
    setShowNewRule(false);
    setNewTargetPipeline("");
    setNewTargetStage(FIRST_STAGE_VALUE);
  };

  const handleAddRule = async () => {
    if (!newTargetPipeline) { toast.error('Escolha o pipeline de destino'); return; }
    setIsSubmitting(true);
    try {
      await createRule.mutateAsync({
        source_stage_id: stage.id,
        target_pipeline_id: newTargetPipeline,
        target_stage_id: newTargetStage === FIRST_STAGE_VALUE ? null : newTargetStage,
      });
      toast.success('Regra de duplicação criada!');
      resetForm();
    } catch (error) {
      toast.error('Erro ao criar regra: ' + (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      await deleteRule.mutateAsync({ id: ruleId, source_stage_id: stage.id });
      toast.success('Regra removida!');
    } catch {
      toast.error('Erro ao remover regra');
    }
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={rules.length > 0
                  ? "h-[30px] w-[30px] p-0 text-sky-500 hover:text-sky-600"
                  : "h-[30px] w-[30px] p-0 text-muted-foreground/30 hover:text-foreground"}
              >
                <GitFork className="w-3.5 h-3.5" strokeWidth={1.5} />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-[220px]">
            <p className="text-xs">
              {rules.length > 0
                ? `Duplica automaticamente pra ${rules.length} pipeline(s) ao entrar aqui.`
                : 'Duplicar lead pra outro pipeline automaticamente ao entrar nesta etapa.'}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent className="w-[280px] p-3 space-y-3" align="end">
        <div className="space-y-1">
          <p className="text-[12px] font-medium text-foreground">Duplicar automaticamente</p>
          <p className="text-[11px] text-muted-foreground/60">
            Ao um lead entrar em "{stage.nome}", cria uma cópia ativa no(s) pipeline(s) abaixo.
          </p>
        </div>

        {rules.length > 0 && (
          <div className="space-y-1.5">
            {rules.map(rule => {
              const targetPipeline = pipelines.find(p => p.id === rule.target_pipeline_id);
              const targetStage = stages.find(s => s.id === rule.target_stage_id);
              return (
                <div key={rule.id} className="flex items-center justify-between gap-2 bg-muted/50 rounded-[4px] px-2 py-1.5">
                  <div className="min-w-0">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{targetPipeline?.nome || '—'}</Badge>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5 truncate">
                      {targetStage?.nome || 'Primeira etapa (automático)'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteRule(rule.id)}
                    className="h-[24px] w-[24px] p-0 text-muted-foreground/40 hover:text-destructive flex-shrink-0"
                  >
                    <X className="w-3 h-3" strokeWidth={1.5} />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {showNewRule ? (
          <div className="space-y-2 border-t border-border pt-2.5">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Pipeline de destino</Label>
              <Select value={newTargetPipeline} onValueChange={(v) => { setNewTargetPipeline(v); setNewTargetStage(FIRST_STAGE_VALUE); }}>
                <SelectTrigger className="h-[28px] text-[12px]"><SelectValue placeholder="Escolher pipeline" /></SelectTrigger>
                <SelectContent>
                  {availableTargetPipelines.map(p => (
                    <SelectItem key={p.id} value={p.id} className="text-[12px]">{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {newTargetPipeline && (
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Etapa de destino</Label>
                <Select value={newTargetStage} onValueChange={setNewTargetStage}>
                  <SelectTrigger className="h-[28px] text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FIRST_STAGE_VALUE} className="text-[12px]">Primeira etapa (automático)</SelectItem>
                    {newTargetStages.map(s => (
                      <SelectItem key={s.id} value={s.id} className="text-[12px]">{s.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-1.5">
              <Button size="sm" onClick={handleAddRule} disabled={isSubmitting || !newTargetPipeline} className="h-[26px] text-[11px] flex-1">
                Salvar
              </Button>
              <Button size="sm" variant="outline" onClick={resetForm} disabled={isSubmitting} className="h-[26px] text-[11px]">
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          availableTargetPipelines.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNewRule(true)}
              className="h-[26px] text-[11px] w-full gap-1"
            >
              <Plus className="w-3 h-3" strokeWidth={1.5} />
              Nova regra
            </Button>
          )
        )}
      </PopoverContent>
    </Popover>
  );
};

export default StageDuplicationPopover;
