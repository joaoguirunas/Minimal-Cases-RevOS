
import { useState, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Plus, Edit, Trash2, Save, X, Settings, Eye, EyeOff, GripVertical } from "lucide-react";
import { usePipelines, type Pipeline, type Stage } from "@/hooks/usePipelines";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  useKiwifyStatus, useKiwifyProducts, useManualProducts, mergeProducts, type KiwifyProduct,
} from "@/hooks/useKiwifyProductsCatalog";
import CursoBadges, { productColor } from "@/components/negocios/CursoBadges";
import StagesConfig from "./StagesConfig";
import PipelineVisualization from "./PipelineVisualization";

interface PipelinesConfigProps {
  selectedTenantId?: string; // unused — kept for API compat with parent callers
}

interface PipelineFormData {
  nome: string;
  descricao: string;
  kiwify_product_id: string;
  move_existing_leads: boolean;
}

interface SortablePipelineRowProps {
  pipeline: Pipeline;
  stages: Stage[];
  editingPipeline: string | null;
  editFormData: PipelineFormData;
  isSubmitting: boolean;
  expandedPipelines: Set<string>;
  kiwifyProducts: KiwifyProduct[];
  onEdit: (pipeline: Pipeline) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, current: boolean) => void;
  onToggleExpand: (id: string) => void;
  onSelectStages: (id: string) => void;
  onEditFormChange: (data: PipelineFormData) => void;
}

function KiwifyProductField({
  products, value, onChange, moveExisting, onMoveExistingChange, disabled,
}: {
  products: KiwifyProduct[];
  value: string;
  onChange: (v: string) => void;
  moveExisting: boolean;
  onMoveExistingChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12px] text-muted-foreground">Produto Kiwify (opcional)</Label>
      <Select value={value || '__none__'} onValueChange={(v) => onChange(v === '__none__' ? '' : v)} disabled={disabled}>
        <SelectTrigger className="h-[30px] text-[13px]"><SelectValue placeholder="Nenhum produto vinculado" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Nenhum produto vinculado</SelectItem>
          {products.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              <span className="inline-flex items-center gap-1.5">
                <span className={cn('w-2 h-2 rounded-full shrink-0', productColor(p.id).dot)} />
                {p.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-[11px] text-muted-foreground/60">
        Vincular um produto faz todo lead desse produto (novo ou já existente) cair automaticamente aqui.
      </p>
      {value && (
        <label className="flex items-center gap-2 text-[12px] text-muted-foreground pt-1 cursor-pointer">
          <Checkbox checked={moveExisting} onCheckedChange={(v) => onMoveExistingChange(v === true)} />
          Mover leads existentes desse produto pra este pipeline agora
        </label>
      )}
    </div>
  );
}

const SortablePipelineRow = ({
  pipeline,
  stages,
  editingPipeline,
  editFormData,
  isSubmitting,
  expandedPipelines,
  kiwifyProducts,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onToggleActive,
  onToggleExpand,
  onSelectStages,
  onEditFormChange,
}: SortablePipelineRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pipeline.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const stageCount = stages.filter(s => s.pipeline_id === pipeline.id).length;
  const isEditing = editingPipeline === pipeline.id;

  return (
    <div ref={setNodeRef} style={style} className="px-5 py-4 border-b border-border last:border-b-0">
      {isEditing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground">Nome *</Label>
              <Input
                value={editFormData.nome}
                onChange={(e) => onEditFormChange({ ...editFormData, nome: e.target.value })}
                placeholder="Nome do pipeline"
                disabled={isSubmitting}
                className="h-[30px] text-[13px]"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground">Descrição</Label>
              <Textarea
                value={editFormData.descricao}
                onChange={(e) => onEditFormChange({ ...editFormData, descricao: e.target.value })}
                placeholder="Descrição"
                disabled={isSubmitting}
                className="text-[13px] min-h-[32px] resize-none"
                rows={1}
              />
            </div>
          </div>
          <KiwifyProductField
            products={kiwifyProducts}
            value={editFormData.kiwify_product_id}
            onChange={(v) => onEditFormChange({ ...editFormData, kiwify_product_id: v })}
            moveExisting={editFormData.move_existing_leads}
            onMoveExistingChange={(v) => onEditFormChange({ ...editFormData, move_existing_leads: v })}
            disabled={isSubmitting}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onSaveEdit(pipeline.id)} disabled={isSubmitting || !editFormData.nome.trim()} className="h-[30px] text-[13px] gap-1.5">
              <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
              {isSubmitting ? 'Salvando…' : 'Salvar'}
            </Button>
            <Button size="sm" variant="outline" onClick={onCancelEdit} disabled={isSubmitting} className="h-[30px] text-[13px] gap-1.5">
              <X className="w-3.5 h-3.5" strokeWidth={1.5} />
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <button
                className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/70 flex-shrink-0 touch-none"
                {...attributes}
                {...listeners}
                aria-label="Arrastar para reordenar"
              >
                <GripVertical className="w-4 h-4" strokeWidth={1.5} />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-foreground truncate">
                    {pipeline.nome}
                  </span>
                  {!pipeline.ativo && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground/60 border-border">
                      Inativo
                    </Badge>
                  )}
                  {pipeline.kiwify_product_id && (
                    <CursoBadges
                      cursos={[{ product_id: pipeline.kiwify_product_id, product_name: pipeline.kiwify_product_name || pipeline.kiwify_product_id }]}
                      max={1}
                    />
                  )}
                </div>
                {pipeline.descricao && (
                  <p className="text-[12px] text-muted-foreground/60 mt-0.5 truncate">{pipeline.descricao}</p>
                )}
                <p className="text-[11px] text-muted-foreground/40 mt-1">
                  {stageCount} etapa{stageCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0 ml-4">
              <div className="flex items-center gap-2">
                <Label className="text-[12px] text-muted-foreground/60">Ativo</Label>
                <Switch
                  checked={pipeline.ativo}
                  onCheckedChange={() => onToggleActive(pipeline.id, pipeline.ativo)}
                />
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => onToggleExpand(pipeline.id)} className="h-[30px] w-[30px] p-0 text-muted-foreground/60 hover:text-foreground">
                  {expandedPipelines.has(pipeline.id)
                    ? <EyeOff className="w-3.5 h-3.5" strokeWidth={1.5} />
                    : <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onSelectStages(pipeline.id)} className="h-[30px] w-[30px] p-0 text-muted-foreground/60 hover:text-foreground">
                  <Settings className="w-3.5 h-3.5" strokeWidth={1.5} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onEdit(pipeline)} className="h-[30px] w-[30px] p-0 text-muted-foreground/60 hover:text-foreground">
                  <Edit className="w-3.5 h-3.5" strokeWidth={1.5} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(pipeline.id)} className="h-[30px] w-[30px] p-0 text-muted-foreground/60 hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                </Button>
              </div>
            </div>
          </div>

          {expandedPipelines.has(pipeline.id) && (
            <div className="mt-2 p-3 bg-muted border border-border rounded-[4px] ml-6">
              <PipelineVisualization pipeline={pipeline} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const emptyPipelineForm = (): PipelineFormData => ({ nome: "", descricao: "", kiwify_product_id: "", move_existing_leads: true });

const PipelinesConfig = ({ selectedTenantId: _selectedTenantId }: PipelinesConfigProps) => {
  const [editingPipeline, setEditingPipeline] = useState<string | null>(null);
  const [newPipeline, setNewPipeline] = useState<PipelineFormData>(emptyPipelineForm());
  const [showNewForm, setShowNewForm] = useState(false);
  const [editFormData, setEditFormData] = useState<PipelineFormData>(emptyPipelineForm());
  const [selectedPipelineForStages, setSelectedPipelineForStages] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedPipelines, setExpandedPipelines] = useState<Set<string>>(new Set());
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);

  const { pipelines, stages, isLoading, criarPipeline, atualizarPipeline, deletePipeline, reordenarPipelines } = usePipelines();
  const queryClient = useQueryClient();
  const { data: kiwifyStatus } = useKiwifyStatus();
  const { data: apiProducts = [] } = useKiwifyProducts(kiwifyStatus?.status === 'connected');
  const { manualProducts } = useManualProducts();
  const kiwifyProducts = useMemo(() => mergeProducts(apiProducts, manualProducts), [apiProducts, manualProducts]);

  /** Sincroniza o vínculo produto↔pipeline via RPC (não é uma escrita direta na tabela). */
  const syncKiwifyProductLink = async (pipelineId: string, productId: string) => {
    if (productId) {
      const product = kiwifyProducts.find((p) => p.id === productId);
      const { data, error } = await supabase.rpc('link_pipeline_to_kiwify_product', {
        p_pipeline_id: pipelineId,
        p_product_id: productId,
        p_product_name: product?.name ?? productId,
        p_move_existing_leads: editFormData.move_existing_leads,
      });
      if (error) throw error;
      const result = data as { mappings_synced: number; leads_moved: number };
      toast.success(`Produto vinculado — ${result.mappings_synced} mapeamentos sincronizados, ${result.leads_moved} lead(s) movido(s).`);
    } else {
      const { error } = await supabase.rpc('unlink_pipeline_kiwify_product', { p_pipeline_id: pipelineId });
      if (error) throw error;
      toast.success('Produto desvinculado do pipeline.');
    }
    await queryClient.invalidateQueries({ queryKey: ['pipelines'] });
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const orderedPipelines = localOrder
    ? localOrder.map(id => pipelines.find(p => p.id === id)).filter(Boolean) as typeof pipelines
    : pipelines;

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const currentOrder = localOrder ?? pipelines.map(p => p.id);
    const oldIndex = currentOrder.indexOf(active.id as string);
    const newIndex = currentOrder.indexOf(over.id as string);
    const newOrder = arrayMove(currentOrder, oldIndex, newIndex);
    setLocalOrder(newOrder);

    try {
      await reordenarPipelines.mutateAsync(newOrder);
    } catch {
      setLocalOrder(null);
      toast.error('Erro ao reordenar pipelines');
    }
  };

  const handleCreatePipeline = async () => {
    if (!newPipeline.nome.trim()) { toast.error('Nome do pipeline é obrigatório'); return; }
    setIsSubmitting(true);
    try {
      const created = await criarPipeline.mutateAsync({ nome: newPipeline.nome, descricao: newPipeline.descricao, ativo: true });
      if (newPipeline.kiwify_product_id && created?.id) {
        try {
          await syncKiwifyProductLink(created.id, newPipeline.kiwify_product_id);
        } catch (linkError) {
          toast.error('Pipeline criado, mas falhou ao vincular o produto: ' + (linkError as Error).message);
        }
      }
      setNewPipeline(emptyPipelineForm());
      setShowNewForm(false);
      setLocalOrder(null);
      toast.success('Pipeline criado com sucesso!');
    } catch (error) {
      toast.error('Erro ao criar pipeline: ' + (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditPipeline = (pipeline: Pipeline) => {
    setEditingPipeline(pipeline.id);
    setEditFormData({
      nome: pipeline.nome,
      descricao: pipeline.descricao || "",
      kiwify_product_id: pipeline.kiwify_product_id || "",
      move_existing_leads: true,
    });
  };

  const handleSaveEdit = async (pipelineId: string) => {
    if (!editFormData.nome.trim()) { toast.error('Nome do pipeline é obrigatório'); return; }
    setIsSubmitting(true);
    try {
      await atualizarPipeline.mutateAsync({ id: pipelineId, nome: editFormData.nome, descricao: editFormData.descricao });
      const original = pipelines.find((p) => p.id === pipelineId);
      const originalProductId = original?.kiwify_product_id || "";
      if (editFormData.kiwify_product_id !== originalProductId) {
        try {
          await syncKiwifyProductLink(pipelineId, editFormData.kiwify_product_id);
        } catch (linkError) {
          toast.error('Erro ao sincronizar produto: ' + (linkError as Error).message);
        }
      }
      setEditingPipeline(null);
    } catch {
      toast.error('Erro ao atualizar pipeline');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingPipeline(null);
    setEditFormData(emptyPipelineForm());
  };

  const handleDeletePipeline = async (pipelineId: string) => {
    if (!confirm('⚠️ Esta ação irá excluir permanentemente o pipeline. Confirmar?')) return;
    setIsSubmitting(true);
    try {
      await deletePipeline.mutateAsync(pipelineId);
      setLocalOrder(null);
      toast.success('Pipeline excluído!');
    } catch {
      toast.error('Erro ao excluir pipeline. Pode haver negócios vinculados.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (pipelineId: string, currentStatus: boolean) => {
    try {
      await atualizarPipeline.mutateAsync({ id: pipelineId, ativo: !currentStatus });
    } catch {
      toast.error('Erro ao atualizar status');
    }
  };

  const togglePipelineExpansion = (pipelineId: string) => {
    const next = new Set(expandedPipelines);
    next.has(pipelineId) ? next.delete(pipelineId) : next.add(pipelineId);
    setExpandedPipelines(next);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-muted animate-pulse rounded-[2px]" />
        ))}
      </div>
    );
  }

  if (selectedPipelineForStages) {
    const selectedPipeline = pipelines.find(p => p.id === selectedPipelineForStages);
    return <StagesConfig pipeline={selectedPipeline} onBack={() => setSelectedPipelineForStages(null)} />;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-[15px] font-semibold text-foreground">Pipelines e Etapas</h1>
          <p className="text-[13px] text-muted-foreground/70 mt-0.5">Configure os fluxos de vendas da empresa</p>
        </div>
        <Button size="sm" onClick={() => setShowNewForm(true)} className="gap-1.5 h-[30px] text-[13px]">
          <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
          Novo Pipeline
        </Button>
      </div>

      {/* New pipeline form */}
      {showNewForm && (
        <div className="border border-border rounded-[2px] p-4 space-y-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            Novo Pipeline
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground">Nome *</Label>
              <Input
                value={newPipeline.nome}
                onChange={(e) => setNewPipeline({ ...newPipeline, nome: e.target.value })}
                placeholder="Nome do pipeline"
                disabled={isSubmitting}
                className="h-[30px] text-[13px]"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground">Descrição</Label>
              <Textarea
                value={newPipeline.descricao}
                onChange={(e) => setNewPipeline({ ...newPipeline, descricao: e.target.value })}
                placeholder="Descrição opcional"
                disabled={isSubmitting}
                className="text-[13px] min-h-[32px] resize-none"
                rows={1}
              />
            </div>
          </div>
          <KiwifyProductField
            products={kiwifyProducts}
            value={newPipeline.kiwify_product_id}
            onChange={(v) => setNewPipeline({ ...newPipeline, kiwify_product_id: v })}
            moveExisting={newPipeline.move_existing_leads}
            onMoveExistingChange={(v) => setNewPipeline({ ...newPipeline, move_existing_leads: v })}
            disabled={isSubmitting}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreatePipeline} disabled={isSubmitting || !newPipeline.nome.trim()} className="h-[30px] text-[13px] gap-1.5">
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

      {/* Pipeline list */}
      {orderedPipelines.length === 0 ? (
        <div className="border border-border rounded-[2px] p-8 text-center">
          <p className="text-[13px] text-muted-foreground/60 mb-3">Nenhum pipeline cadastrado.</p>
          <Button size="sm" onClick={() => setShowNewForm(true)} className="gap-1.5 h-[30px] text-[13px]">
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            Criar Primeiro Pipeline
          </Button>
        </div>
      ) : (
        <div className="border border-border rounded-[2px] overflow-hidden">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedPipelines.map(p => p.id)} strategy={verticalListSortingStrategy}>
              {orderedPipelines.map((pipeline) => (
                <SortablePipelineRow
                  key={pipeline.id}
                  pipeline={pipeline}
                  stages={stages}
                  editingPipeline={editingPipeline}
                  editFormData={editFormData}
                  isSubmitting={isSubmitting}
                  expandedPipelines={expandedPipelines}
                  kiwifyProducts={kiwifyProducts}
                  onEdit={handleEditPipeline}
                  onSaveEdit={handleSaveEdit}
                  onCancelEdit={handleCancelEdit}
                  onDelete={handleDeletePipeline}
                  onToggleActive={handleToggleActive}
                  onToggleExpand={togglePipelineExpansion}
                  onSelectStages={setSelectedPipelineForStages}
                  onEditFormChange={setEditFormData}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
};

export default PipelinesConfig;
