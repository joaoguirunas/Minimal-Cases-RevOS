import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Plus, Edit, Trash2, Save, X, ArrowLeft, GripVertical, Sparkles } from "lucide-react";
import { usePipelines, Pipeline, Stage } from "@/hooks/usePipelines";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import StageDuplicationPopover from "./StageDuplicationPopover";

interface StagesConfigProps {
  pipeline?: Pipeline;
  onBack: () => void;
}

const StagesConfig = ({ pipeline, onBack }: StagesConfigProps) => {
  const [editingStage, setEditingStage] = useState<string | null>(null);
  const [newStage, setNewStage] = useState({ nome: "", cor: "#3B82F6" });
  const [showNewForm, setShowNewForm] = useState(false);
  const [editFormData, setEditFormData] = useState({ nome: "", cor: "#3B82F6" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localStages, setLocalStages] = useState<Stage[]>([]);
  const [isReordering, setIsReordering] = useState(false);
  const [colorDraft, setColorDraft] = useState<Record<string, string>>({});

  const { pipelines, stages, criarStage, atualizarStage, deletarStage, refetch } = usePipelines();

  const pipelineStages = stages
    .filter(stage => stage.pipeline_id === pipeline?.id)
    .sort((a, b) => a.ordem - b.ordem);

  useEffect(() => {
    if (!isReordering) setLocalStages(pipelineStages);
  }, [stages, pipeline?.id, isReordering]);

  const handleCreateStage = async () => {
    if (!newStage.nome.trim()) { toast.error('Nome da etapa é obrigatório'); return; }
    if (!pipeline?.id) { toast.error('Pipeline não encontrado'); return; }
    setIsSubmitting(true);
    try {
      await criarStage.mutateAsync({ nome: newStage.nome, cor: newStage.cor, ordem: localStages.length + 1, pipeline_id: pipeline.id, ativo: true });
      setNewStage({ nome: "", cor: "#3B82F6" });
      setShowNewForm(false);
      toast.success('Etapa criada!');
    } catch (error) {
      toast.error('Erro ao criar etapa: ' + (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditStage = (stage: Stage) => {
    setEditingStage(stage.id);
    setEditFormData({ nome: stage.nome, cor: stage.cor || "#3B82F6" });
  };

  const handleSaveEdit = async (stageId: string) => {
    if (!editFormData.nome.trim()) { toast.error('Nome da etapa é obrigatório'); return; }
    setIsSubmitting(true);
    try {
      await atualizarStage.mutateAsync({ id: stageId, nome: editFormData.nome, cor: editFormData.cor });
      setEditingStage(null);
      toast.success('Etapa atualizada!');
    } catch (error) {
      toast.error('Erro ao atualizar etapa');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingStage(null);
    setEditFormData({ nome: "", cor: "#3B82F6" });
  };

  const handleToggleAiPriority = async (stage: Stage) => {
    const next = !stage.ai_priority;
    setLocalStages(prev => prev.map(s => s.id === stage.id ? { ...s, ai_priority: next } : s));
    try {
      await atualizarStage.mutateAsync({ id: stage.id, ai_priority: next });
      toast.success(next ? 'Etapa marcada como prioridade da IA' : 'Prioridade da IA removida desta etapa');
    } catch {
      setLocalStages(prev => prev.map(s => s.id === stage.id ? { ...s, ai_priority: !next } : s));
      toast.error('Erro ao atualizar prioridade da IA');
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    if (!confirm('Desativar esta etapa? Ela pode ser reativada a qualquer momento.')) return;
    try {
      await deletarStage.mutateAsync({ id: stageId, ativo: false });
      toast.success('Etapa desativada!');
    } catch (error) {
      toast.error('Erro ao desativar etapa');
    }
  };

  const handleColorChange = (stageId: string, color: string) => {
    setColorDraft(prev => ({ ...prev, [stageId]: color }));
    // Optimistic update in localStages
    setLocalStages(prev => prev.map(s => s.id === stageId ? { ...s, cor: color } : s));
  };

  const handleColorSave = async (stageId: string, color: string, originalColor: string) => {
    if (color === originalColor) return;
    try {
      await atualizarStage.mutateAsync({ id: stageId, cor: color });
    } catch {
      // Revert on error
      setLocalStages(prev => prev.map(s => s.id === stageId ? { ...s, cor: originalColor } : s));
      setColorDraft(prev => ({ ...prev, [stageId]: originalColor }));
      toast.error('Erro ao alterar cor');
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination } = result;
    if (source.index === destination.index) return;

    const reordered = Array.from(localStages);
    const [moved] = reordered.splice(source.index, 1);
    reordered.splice(destination.index, 0, moved);

    setLocalStages(reordered);
    setIsReordering(true);
    setIsSubmitting(true);
    try {
      const updates = reordered.map((s, index) =>
        supabase.from('leads_stages').update({ order_index: index }).eq('id', s.id)
      );
      const results = await Promise.all(updates);
      const err = results.find(r => r.error)?.error;
      if (err) throw err;
      await refetch();
      toast.success('Ordem atualizada!');
    } catch (error) {
      toast.error('Erro ao reordenar');
      setLocalStages(pipelineStages);
    } finally {
      setIsSubmitting(false);
      setIsReordering(false);
    }
  };

  if (!pipeline) {
    return (
      <div className="border border-border rounded-md p-8 text-center">
        <p className="text-[13px] text-muted-foreground/60 mb-3">Pipeline não encontrado.</p>
        <Button size="sm" variant="outline" onClick={onBack} className="h-[30px] text-[13px] gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[12px] text-muted-foreground/60 hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
            Voltar para Pipelines
          </button>
          <h1 className="text-[15px] font-semibold text-foreground">Etapas do Pipeline</h1>
          <p className="text-[13px] text-muted-foreground/70 mt-0.5">
            <span className="font-medium text-foreground/80">{pipeline.nome}</span>
            {" "}· arraste para reordenar
          </p>
        </div>
        <Button size="sm" onClick={() => setShowNewForm(true)} disabled={isSubmitting} className="gap-1.5 h-[30px] text-[13px]">
          <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
          Nova Etapa
        </Button>
      </div>

      {/* New stage form */}
      {showNewForm && (
        <div className="border border-border rounded-md p-4 space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            Nova Etapa
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground">Nome *</Label>
              <Input
                value={newStage.nome}
                onChange={(e) => setNewStage({ ...newStage, nome: e.target.value })}
                placeholder="Nome da etapa"
                disabled={isSubmitting}
                className="h-[30px] text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground">Cor</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={newStage.cor}
                  onChange={(e) => setNewStage({ ...newStage, cor: e.target.value })}
                  className="w-10 h-[30px] p-1 cursor-pointer"
                  disabled={isSubmitting}
                />
                <Input
                  value={newStage.cor}
                  onChange={(e) => setNewStage({ ...newStage, cor: e.target.value })}
                  placeholder="#3B82F6"
                  disabled={isSubmitting}
                  className="h-[30px] text-[13px] font-mono"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreateStage} disabled={isSubmitting || !newStage.nome.trim()} className="h-[30px] text-[13px] gap-1.5">
              <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
              {isSubmitting ? 'Salvando…' : 'Salvar'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowNewForm(false)} disabled={isSubmitting} className="h-[30px] text-[13px] gap-1.5">
              <X className="w-3.5 h-3.5" strokeWidth={1.5} />
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Stages list */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="stages-list">
          {(provided) => (
            <div
              className="border border-border rounded-md overflow-hidden"
              {...provided.droppableProps}
              ref={provided.innerRef}
            >
              {localStages.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-[13px] text-muted-foreground/60">Nenhuma etapa para este pipeline.</p>
                </div>
              ) : (
                localStages.map((stage, index) => (
                  <Draggable
                    key={stage.id}
                    draggableId={stage.id}
                    index={index}
                    isDragDisabled={isSubmitting || editingStage === stage.id}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={cn(
                          "px-4 py-3 transition-colors",
                          index < localStages.length - 1 && "border-b border-border",
                          snapshot.isDragging && "bg-accent/40",
                          isSubmitting && !snapshot.isDragging && "opacity-60"
                        )}
                      >
                        {editingStage === stage.id ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-[12px] text-muted-foreground">Nome *</Label>
                                <Input
                                  value={editFormData.nome}
                                  onChange={(e) => setEditFormData({ ...editFormData, nome: e.target.value })}
                                  placeholder="Nome da etapa"
                                  disabled={isSubmitting}
                                  className="h-[30px] text-[13px]"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[12px] text-muted-foreground">Cor</Label>
                                <div className="flex gap-2">
                                  <Input
                                    type="color"
                                    value={editFormData.cor}
                                    onChange={(e) => setEditFormData({ ...editFormData, cor: e.target.value })}
                                    className="w-10 h-[30px] p-1 cursor-pointer"
                                    disabled={isSubmitting}
                                  />
                                  <Input
                                    value={editFormData.cor}
                                    onChange={(e) => setEditFormData({ ...editFormData, cor: e.target.value })}
                                    placeholder="#3B82F6"
                                    disabled={isSubmitting}
                                    className="h-[30px] text-[13px] font-mono"
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleSaveEdit(stage.id)} disabled={isSubmitting || !editFormData.nome.trim()} className="h-[30px] text-[13px] gap-1.5">
                                <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
                                {isSubmitting ? 'Salvando…' : 'Salvar'}
                              </Button>
                              <Button size="sm" variant="outline" onClick={handleCancelEdit} disabled={isSubmitting} className="h-[30px] text-[13px] gap-1.5">
                                <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div
                              {...provided.dragHandleProps}
                              className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
                            >
                              <GripVertical className="w-4 h-4" strokeWidth={1.5} />
                            </div>
                            <label
                              title="Clique para alterar cor"
                              className="relative flex-shrink-0 cursor-pointer group"
                            >
                              <div
                                className="w-5 h-5 rounded-full ring-1 ring-black/20 group-hover:ring-2 group-hover:scale-110 transition-all"
                                style={{ backgroundColor: colorDraft[stage.id] ?? stage.cor }}
                              />
                              <input
                                type="color"
                                value={colorDraft[stage.id] ?? stage.cor ?? '#3B82F6'}
                                onChange={(e) => handleColorChange(stage.id, e.target.value)}
                                onBlur={(e) => handleColorSave(stage.id, e.target.value, stage.cor ?? '#3B82F6')}
                                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                              />
                            </label>
                            <span className="text-[11px] font-medium text-muted-foreground/40 w-5 flex-shrink-0">
                              {index + 1}
                            </span>
                            <span className="text-[13px] font-normal text-foreground flex-1 truncate">
                              {stage.nome}
                            </span>
                            <div className="flex gap-1 flex-shrink-0">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleToggleAiPriority(stage)}
                                      disabled={isSubmitting}
                                      className={cn(
                                        "h-[30px] w-[30px] p-0",
                                        stage.ai_priority
                                          ? "text-amber-500 hover:text-amber-600"
                                          : "text-muted-foreground/30 hover:text-foreground"
                                      )}
                                    >
                                      <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="max-w-[220px]">
                                    <p className="text-xs">
                                      {stage.ai_priority
                                        ? 'Prioridade da IA ativa — se o lead estiver ativo em outro pipeline ao mesmo tempo, a IA age aqui.'
                                        : 'Marcar como prioridade da IA (usado quando o lead está ativo em 2 pipelines ao mesmo tempo).'}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <StageDuplicationPopover stage={stage} pipelines={pipelines} stages={stages} />
                              <Button variant="ghost" size="sm" onClick={() => handleEditStage(stage)} disabled={isSubmitting} className="h-[30px] w-[30px] p-0 text-muted-foreground/50 hover:text-foreground">
                                <Edit className="w-3.5 h-3.5" strokeWidth={1.5} />
                              </Button>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" onClick={() => handleDeleteStage(stage.id)} disabled={isSubmitting} className="h-[30px] w-[30px] p-0 text-muted-foreground/50 hover:text-destructive">
                                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="left">
                                    <p className="text-xs">Desativar etapa (pode ser reativada)</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Draggable>
                ))
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};

export default StagesConfig;
