import { useState } from "react";
import { useUpdateNegocio } from '@/hooks/useNegocios';
import { usePipelines } from '@/hooks/usePipelines';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ExternalLink, Edit2, Check, X, Flame, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MotivoPerdasModal from '@/components/negocios/MotivoPerdasModal';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

interface NegociosSectionProps {
  negocios: Array<{
    id: string;
    valor?: number;
    status: string;
    pre_sale_temperature?: number;
    close_probability?: number;
    pipeline: { id: string; nome: string };
    stage: { id: string; nome: string };
    motivo_perda?: string;
  }>;
  tenantId: string;
}

const NegociosSection = ({ negocios, tenantId }: NegociosSectionProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<{ negocioId: string; value: string } | null>(null);
  const [showMotivoModal, setShowMotivoModal] = useState<string | null>(null);
  
  const updateNegocio = useUpdateNegocio();
  const { pipelines, stages } = usePipelines();

  const handleNegocioClick = (negocioId: string) => {
    navigate(`/crm/kanban/${negocioId}`);
  };

  const startEditingValue = (negocioId: string, currentValue?: number) => {
    setEditingValue({ 
      negocioId, 
      value: currentValue ? currentValue.toString() : "" 
    });
  };

  const saveValue = async (negocioId: string) => {
    if (!editingValue || editingValue.negocioId !== negocioId) return;
    
    if (!editingValue.value.trim()) {
      setEditingValue(null);
      return;
    }

    const numericValue = parseFloat(editingValue.value.replace(/[^\d,.-]/g, '').replace(',', '.'));
    
    if (isNaN(numericValue)) {
      toast({
        title: "Erro",
        description: "Valor inválido",
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(negocioId);
    
    try {
      console.log('💰 NegociosSection: Atualizando valor', { negocioId, value: numericValue });
      await updateNegocio.mutateAsync({
        id: negocioId,
        value: numericValue
      });
      console.log('✅ NegociosSection: Valor atualizado com sucesso');

      setEditingValue(null);
      
      // Invalidar queries específicas com prefixo parcial
      await queryClient.invalidateQueries({ 
        queryKey: ['conversas-simples-v4'], 
        exact: false,
        refetchType: 'active'
      });

      await queryClient.invalidateQueries({ 
        queryKey: ['conversas-paginadas'], 
        exact: false,
        refetchType: 'active'
      });

      // Forçar refetch das queries ativas
      await queryClient.refetchQueries({ 
        queryKey: ['conversas-simples-v4'],
        exact: false,
        type: 'active'
      });
      
      console.log('🔄 NegociosSection: Cache invalidado (valor)', {
        component: 'NegociosSection',
        negocioId,
        campo: 'valor',
        novoValor: numericValue
      });
      
      toast({
        title: "Sucesso",
        description: "Valor atualizado com sucesso",
      });
    } catch (error) {
      console.error('Erro ao atualizar valor:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o valor",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => {
        setIsUpdating(null);
      }, 100);
    }
  };

  const cancelEdit = () => {
    setEditingValue(null);
  };

  const handleTemperatureUpdate = async (negocioId: string, field: 'pre_sale_temperature' | 'close_probability', currentValue: number | undefined, newLevel: number) => {
    const value = currentValue === newLevel ? null : newLevel;
    try {
      await updateNegocio.mutateAsync({ id: negocioId, [field]: value });
      await queryClient.invalidateQueries({ queryKey: ['conversas-simples-v4'], exact: false, refetchType: 'active' });
      await queryClient.invalidateQueries({ queryKey: ['conversas-paginadas'], exact: false, refetchType: 'active' });
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível atualizar", variant: "destructive" });
    }
  };

  const formatCurrency = (value?: number) => {
    if (!value) return "Não informado";
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // DB já armazena English (P8): 'in_progress' | 'won' | 'lost' | 'archived'
  const normalizeStatusForSelect = (status: string) => status;

  const handlePipelineChange = async (negocioId: string, newPipelineId: string, currentPipelineId: string) => {
    if (newPipelineId === currentPipelineId) return;
    
    // Get first stage of new pipeline
    const newPipelineStages = stages
      ?.filter((stage: any) => stage.pipeline_id === newPipelineId)
      ?.sort((a: any, b: any) => a.ordem - b.ordem) || [];
    const firstStage = newPipelineStages[0];
    
    setIsUpdating(negocioId);
    
    try {
      console.log('📊 NegociosSection: Alterando pipeline', { negocioId, newPipelineId, newStageId: firstStage?.id });
      await updateNegocio.mutateAsync({
        id: negocioId,
        leads_pipelines_id: newPipelineId,
        leads_stages_id: firstStage?.id
      });
      console.log('✅ NegociosSection: Pipeline alterado com sucesso');

      await invalidateConversasQueries();
      
      toast({
        title: "Sucesso",
        description: "Pipeline atualizado com sucesso",
      });
      
    } catch (error) {
      console.error('Erro ao alterar pipeline:', error);
      toast({
        title: "Erro",
        description: "Não foi possível alterar o pipeline",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => setIsUpdating(null), 100);
    }
  };

  const handleStageChange = async (negocioId: string, newStageId: string, currentStageId: string) => {
    if (newStageId === currentStageId) return;
    
    setIsUpdating(negocioId);
    
    try {
      console.log('📊 NegociosSection: Alterando etapa', { negocioId, newStageId });
      await updateNegocio.mutateAsync({
        id: negocioId,
        leads_stages_id: newStageId
      });
      console.log('✅ NegociosSection: Etapa alterada com sucesso');

      await invalidateConversasQueries();
      
      toast({
        title: "Sucesso",
        description: "Etapa atualizada com sucesso",
      });
      
    } catch (error) {
      console.error('Erro ao alterar etapa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível alterar a etapa",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => setIsUpdating(null), 100);
    }
  };
  
  const invalidateConversasQueries = async () => {
    await queryClient.invalidateQueries({ 
      queryKey: ['conversas-simples-v4'], 
      exact: false,
      refetchType: 'active'
    });
    await queryClient.invalidateQueries({ 
      queryKey: ['conversas-paginadas'], 
      exact: false,
      refetchType: 'active'
    });
    await queryClient.refetchQueries({ 
      queryKey: ['conversas-simples-v4'],
      exact: false,
      type: 'active'
    });
  };

  const handleStatusChange = async (negocioId: string, newStatus: string) => {
    if (newStatus === 'lost') {
      setShowMotivoModal(negocioId);
      return;
    }
    
    setIsUpdating(negocioId);
    
    try {
      const updateData: any = {
        id: negocioId,
        status: newStatus,
      };

      if (newStatus === 'won') {
        updateData.won_at = new Date().toISOString();
      }

      await updateNegocio.mutateAsync(updateData);
      
      // Invalidar queries específicas com prefixo parcial
      await queryClient.invalidateQueries({ 
        queryKey: ['conversas-simples-v4'], 
        exact: false,
        refetchType: 'active'
      });

      await queryClient.invalidateQueries({ 
        queryKey: ['conversas-paginadas'], 
        exact: false,
        refetchType: 'active'
      });

      // Forçar refetch das queries ativas
      await queryClient.refetchQueries({ 
        queryKey: ['conversas-simples-v4'],
        exact: false,
        type: 'active'
      });
      
      console.log('🔄 NegociosSection: Cache invalidado (status)', {
        component: 'NegociosSection',
        negocioId,
        campo: 'status',
        novoValor: newStatus
      });
      
      toast({
        title: "Sucesso",
        description: `Status alterado para ${newStatus === 'won' ? 'Ganho' : newStatus === 'lost' ? 'Perdido' : newStatus === 'in_progress' ? 'Em andamento' : 'Arquivado'}`,
      });
      
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      
      toast({
        title: "Erro",
        description: "Não foi possível alterar o status",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => {
        setIsUpdating(null);
      }, 100);
    }
  };

  const handleMotivoPerda = async (motivoId: string, motivoTexto?: string) => {
    if (!showMotivoModal) return;

    setIsUpdating(showMotivoModal);
    try {
      console.log('❌ NegociosSection: Marcando como perdido', { negocioId: showMotivoModal, motivoId, motivoTexto });
      await updateNegocio.mutateAsync({
        id: showMotivoModal,
        status: 'lost',
        leads_loss_reasons_id: motivoId,
        loss_reason: motivoTexto
      });
      console.log('✅ NegociosSection: Status alterado para perdido');

      // Invalidar queries específicas com prefixo parcial
      await queryClient.invalidateQueries({ 
        queryKey: ['conversas-simples-v4'], 
        exact: false,
        refetchType: 'active'
      });

      await queryClient.invalidateQueries({ 
        queryKey: ['conversas-paginadas'], 
        exact: false,
        refetchType: 'active'
      });

      // Forçar refetch das queries ativas
      await queryClient.refetchQueries({ 
        queryKey: ['conversas-simples-v4'],
        exact: false,
        type: 'active'
      });
      
      console.log('🔄 NegociosSection: Cache invalidado (perdido)', {
        component: 'NegociosSection',
        negocioId: showMotivoModal,
        campo: 'status',
        novoValor: 'lost',
        motivoId,
        motivoTexto
      });
      
      toast({
        title: "Sucesso",
        description: "Status alterado para Perdido",
      });
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível alterar o status",
        variant: "destructive",
      });
    } finally {
      setShowMotivoModal(null);
      setTimeout(() => {
        setIsUpdating(null);
      }, 100);
    }
  };

  const getStageTimeline = (currentStageId: string, pipelineId: string) => {
    const pipelineStages = stages
      ?.filter((stage: any) => stage.pipeline_id === pipelineId || stage.leads_pipelines_id === pipelineId)
      ?.sort((a: any, b: any) => (a.ordem || a.order_index || 0) - (b.ordem || b.order_index || 0)) || [];

    const currentIndex = pipelineStages.findIndex(stage => stage.id === currentStageId);

    return pipelineStages.map((stage: any, index: number) => ({
      ...stage,
      status: index < currentIndex ? 'completed' : 
              index === currentIndex ? 'current' : 'pending'
    }));
  };

  if (negocios.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        No deals found
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {negocios.map((negocio) => {
          const timeline = getStageTimeline(negocio.stage.id, negocio.pipeline.id);
          const isCurrentNegocioUpdating = isUpdating === negocio.id;
          
          const getStatusStyles = () => {
            switch (negocio.status) {
              case 'won':
                return 'border-green-200 bg-green-50/30 dark:bg-green-950/20';
              case 'lost':
                return 'border-red-200 bg-red-50/30 dark:bg-red-950/20';
              default:
                return 'border-border bg-card';
            }
          };
          
          return (
            <div key={negocio.id} className={`border-2 p-3 rounded-md relative transition-all duration-300 ${getStatusStyles()} ${isCurrentNegocioUpdating ? 'opacity-60 pointer-events-none animate-pulse' : ''}`}>
              {isCurrentNegocioUpdating && (
                <div className="absolute inset-0 flex items-center justify-center bg-card/70 backdrop-blur-sm z-10 rounded">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                    <div className="text-xs text-muted-foreground font-medium">Atualizando...</div>
                  </div>
                </div>
              )}

              {/* Pipeline Selector */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Select
                    value={negocio.pipeline.id}
                    onValueChange={(value) => handlePipelineChange(negocio.id, value, negocio.pipeline.id)}
                    disabled={isCurrentNegocioUpdating}
                  >
                    <SelectTrigger className="h-6 text-xs bg-secondary/50 border-0 w-auto max-w-[140px]">
                      <SelectValue>{negocio.pipeline.nome}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {pipelines?.filter((p: any) => p.ativo || p.active).map((pipeline: any) => (
                        <SelectItem key={pipeline.id} value={pipeline.id} className="text-xs">
                          {pipeline.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {negocio.status === 'lost' && (
                    <Badge variant="destructive" className="text-xs shrink-0">
                      Perdido{negocio.motivo_perda ? `: ${negocio.motivo_perda}` : ''}
                    </Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 w-6 p-0 shrink-0"
                  onClick={() => handleNegocioClick(negocio.id)}
                >
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </div>

              {/* Temperature & Probability — editable */}
              <div className="rounded-md bg-card divide-y divide-border/40 mb-2">
                <div className="flex items-center justify-between px-2.5 py-1.5">
                  <span className="text-[11px] text-muted-foreground/60">Temperatura</span>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map(level => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => handleTemperatureUpdate(negocio.id, 'pre_sale_temperature', negocio.pre_sale_temperature, level)}
                        className="p-0.5 transition-transform hover:scale-110"
                        title={`${level}/5`}
                      >
                        <Flame
                          className={cn(
                            "w-3.5 h-3.5 transition-colors",
                            level <= (negocio.pre_sale_temperature || 0)
                              ? "text-orange-500 fill-orange-500"
                              : "text-muted-foreground/20"
                          )}
                          strokeWidth={1.5}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between px-2.5 py-1.5">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-muted-foreground/60">Fechamento</span>
                    {negocio.close_probability ? (
                      <span className="text-[10px] font-medium text-muted-foreground/40">{negocio.close_probability * 20}%</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map(level => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => handleTemperatureUpdate(negocio.id, 'close_probability', negocio.close_probability, level)}
                        className="p-0.5 transition-transform hover:scale-110"
                        title={`${level * 20}%`}
                      >
                        <Star
                          className={cn(
                            "w-3.5 h-3.5 transition-colors",
                            level <= (negocio.close_probability || 0)
                              ? "text-amber-500 fill-amber-500"
                              : "text-muted-foreground/20"
                          )}
                          strokeWidth={1.5}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Valor */}
              <div className="mb-3">
                <div className="text-xs text-muted-foreground mb-1">Valor</div>
                {editingValue?.negocioId === negocio.id ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={editingValue.value}
                      onChange={(e) => setEditingValue({ ...editingValue, value: e.target.value })}
                      placeholder="0,00"
                      className="h-7 text-xs flex-1"
                      onKeyPress={(e) => e.key === 'Enter' && saveValue(negocio.id)}
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => saveValue(negocio.id)}
                    >
                      <Check className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={cancelEdit}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <div
                    className="flex items-center gap-1 cursor-pointer hover:bg-muted p-2 -m-1 rounded"
                    onClick={() => startEditingValue(negocio.id, negocio.valor)}
                  >
                    <span className={`text-sm font-medium ${negocio.valor ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {formatCurrency(negocio.valor)}
                    </span>
                    <Edit2 className="w-3 h-3 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Stage dropdown */}
              <div className="space-y-1.5">
                <div className="text-xs text-muted-foreground">Etapa</div>
                <Select
                  value={negocio.stage.id}
                  onValueChange={(value) => handleStageChange(negocio.id, value, negocio.stage.id)}
                  disabled={isCurrentNegocioUpdating}
                >
                  <SelectTrigger className="h-8 text-[12px]">
                    <SelectValue placeholder="Selecionar etapa..." />
                  </SelectTrigger>
                  <SelectContent>
                    {stages
                      ?.filter((s: any) => s.pipeline_id === negocio.pipeline.id || s.leads_pipelines_id === negocio.pipeline.id)
                      ?.sort((a: any, b: any) => (a.ordem || a.order_index || 0) - (b.ordem || b.order_index || 0))
                      ?.map((stage: any) => (
                        <SelectItem key={stage.id} value={stage.id} className="text-[12px]">
                          {stage.nome}
                        </SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>

              {/* Status do Negócio */}
              <div className="mt-3 pt-2 border-t">
                <div className="text-xs text-muted-foreground mb-1">Status</div>
                <Select
                  value={normalizeStatusForSelect(negocio.status)}
                  onValueChange={(value) => handleStatusChange(negocio.id, value)}
                  disabled={isCurrentNegocioUpdating}
                >
                  <SelectTrigger className="h-8 bg-background border border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_progress">Em andamento</SelectItem>
                    <SelectItem value="won">Ganho</SelectItem>
                    <SelectItem value="lost">Perdido</SelectItem>
                    <SelectItem value="archived">Arquivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Motivo de Perda */}
      {showMotivoModal && (
        <MotivoPerdasModal
          isOpen={!!showMotivoModal}
          onClose={() => setShowMotivoModal(null)}
          onConfirm={handleMotivoPerda}
          isLoading={isUpdating === showMotivoModal}
        />
      )}
    </>
  );
};

export default NegociosSection;