import { useState } from 'react';
import { ArrowLeft, Settings2, Trophy, XCircle, RotateCcw, Loader2, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useNavigate } from 'react-router-dom';
import { useNegocio, useUpdateNegocio } from '@/hooks/useNegocios';
import { usePipelines, type Stage } from '@/hooks/usePipelines';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MobileNegocioTabs } from './MobileNegocioTabs';
import { MobileNegocioSidebar } from './MobileNegocioSidebar';
import MotivoPerdasModal from '@/components/negocios/MotivoPerdasModal';
import { cn } from '@/lib/utils';

interface MobileNegocioSingleProps {
  negocioId: string;
  onBack?: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  won: 'text-emerald-600 bg-emerald-500/8',
  lost: 'text-red-600 bg-red-500/8',
  in_progress: 'text-blue-600 bg-blue-500/8',
};

const STATUS_LABELS: Record<string, string> = {
  won: 'Ganho',
  lost: 'Perdido',
  in_progress: 'Em Andamento',
};

export const MobileNegocioSingle = ({ negocioId, onBack }: MobileNegocioSingleProps) => {
  const navigate = useNavigate();
  const handleBack = () => onBack ? onBack() : navigate(-1);
  const { data: negocio, isLoading, isError } = useNegocio(negocioId);
  const updateNegocio = useUpdateNegocio();
  const { pipelines, stages } = usePipelines();

  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showMotivoPerdasModal, setShowMotivoPerdasModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === 'lost') {
      setShowMotivoPerdasModal(true);
      return;
    }
    await updateNegocio.mutateAsync({ id: negocioId, status: newStatus });
  };

  const handleConfirmPerda = async (motivoId: string, motivoTexto?: string) => {
    await updateNegocio.mutateAsync({
      id: negocioId,
      status: 'lost',
      leads_loss_reasons_id: motivoId,
      loss_reason: motivoTexto,
    });
    setShowMotivoPerdasModal(false);
  };

  const handleUpdateNegocio = async (data: Parameters<typeof updateNegocio.mutateAsync>[0]) => {
    await updateNegocio.mutateAsync(data);
  };

  const handleDeleteNegocio = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('leads').delete().eq('id', negocioId);
      if (error) throw error;
      toast.success('Negócio eliminado');
      queryClient.invalidateQueries({ queryKey: ['negocios'] });
      handleBack();
    } catch {
      toast.error('Erro ao eliminar negócio');
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['negocio', negocioId] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!negocio || isError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen px-4 text-center">
        <p className="text-muted-foreground">Negócio não encontrado</p>
        <Button onClick={() => handleBack()} className="mt-4">Voltar</Button>
      </div>
    );
  }

  const status = negocio.status || 'in_progress';
  const showGanhar = status === 'in_progress';
  const showPerder = status === 'in_progress';
  const showReabrir = status === 'won' || status === 'lost';
  const clientName = negocio.pessoa?.name || negocio.pessoa?.nome || negocio.title || 'Sem nome';
  const pipelineName = negocio.pipeline?.name || negocio.pipeline?.nome || 'Pipeline';
  const stageName = negocio.stage?.name || negocio.stage?.nome || 'Etapa';

  // Stages for progress bar
  const pipelineStages = (stages as Stage[] || [])
    .filter((s) => s.leads_pipelines_id === negocio.leads_pipelines_id)
    .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  const currentStageIndex = pipelineStages.findIndex((s) => s.id === negocio.leads_stages_id);

  const handleStageClick = async (stageId: string) => {
    if (stageId !== negocio.leads_stages_id) {
      try {
        await updateNegocio.mutateAsync({ id: negocioId, leads_stages_id: stageId });
      } catch {
        // toast already shown by useUpdateNegocio
      }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header fixo */}
      <div className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleBack()}
            className="shrink-0 min-h-[44px] min-w-[44px]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-base truncate">{clientName}</h2>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground truncate">{pipelineName} &bull; {stageName}</span>
              <span className={cn(
                'inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full leading-none',
                STATUS_STYLES[status] || STATUS_STYLES.in_progress,
              )}>
                {STATUS_LABELS[status] || 'Em Andamento'}
              </span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            className="shrink-0 min-h-[44px] min-w-[44px]"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowDeleteDialog(true)}
            className="shrink-0 min-h-[44px] min-w-[44px] text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="shrink-0 min-h-[44px] min-w-[44px]"
          >
            <Settings2 className="h-5 w-5" />
          </Button>
        </div>

        {/* Barra de ações de status */}
        <div className="flex items-center gap-2 px-4 pb-3">
          {showGanhar && (
            <Button
              size="sm"
              className="h-9 min-h-[44px] flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              onClick={() => handleStatusChange('won')}
            >
              <Trophy className="h-3.5 w-3.5" /> Ganhar
            </Button>
          )}
          {showPerder && (
            <Button
              size="sm"
              variant="destructive"
              className="h-9 min-h-[44px] flex-1 gap-1.5 text-xs"
              onClick={() => handleStatusChange('lost')}
            >
              <XCircle className="h-3.5 w-3.5" /> Perder
            </Button>
          )}
          {showReabrir && (
            <Button
              size="sm"
              variant="outline"
              className="h-9 min-h-[44px] flex-1 gap-1.5 text-xs"
              onClick={() => handleStatusChange('in_progress')}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reabrir
            </Button>
          )}
        </div>

        {/* Stage progress bar (T4) */}
        {pipelineStages.length > 0 && (
          <div className="flex gap-1 px-4 pb-3 overflow-x-auto snap-x">
            {pipelineStages.map((stage, idx) => {
              const isCurrent = stage.id === negocio.leads_stages_id;
              const isPast = idx < currentStageIndex;
              return (
                <button
                  key={stage.id}
                  onClick={() => handleStageClick(stage.id)}
                  className={cn(
                    'shrink-0 text-[10px] font-medium px-2.5 py-1.5 min-h-[32px] rounded-full border snap-start transition-colors',
                    isCurrent
                      ? 'bg-primary text-primary-foreground border-primary'
                      : isPast
                        ? 'bg-primary/15 text-primary border-primary/30'
                        : 'bg-card text-muted-foreground border-border',
                  )}
                >
                  {stage.color && (
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full mr-1"
                      style={{ backgroundColor: stage.color }}
                    />
                  )}
                  {stage.name || stage.nome}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Tabs reais */}
      <MobileNegocioTabs
        negocioId={negocioId}
        clientName={clientName}
        leadValue={negocio.value}
        pessoaId={negocio.pessoa?.id}
        scoreMatrixId={negocio.pessoa?.score_matrix_id}
        score={negocio.pessoa?.score}
        pipelineId={negocio.leads_pipelines_id}
        pessoaData={negocio.pessoa}
      />

      {/* Sidebar Sheet */}
      <MobileNegocioSidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        negocio={negocio}
        pipelines={pipelines || []}
        stages={stages || []}
        onUpdateNegocio={handleUpdateNegocio}
      />

      {/* Modal Motivo de Perda */}
      <MotivoPerdasModal
        isOpen={showMotivoPerdasModal}
        onClose={() => setShowMotivoPerdasModal(false)}
        onConfirm={handleConfirmPerda}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar negócio?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. O negócio &quot;{clientName}&quot; será permanentemente eliminado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-[44px]">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteNegocio}
              disabled={isDeleting}
              className="min-h-[44px] bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
