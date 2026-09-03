
import { useMemo } from "react";
import { Stage } from "@/hooks/usePipelines";
import StageColumn from "./StageColumn";
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { useUpdateNegocioStage } from "@/hooks/useUpdateNegocioStage";
import { useNegociosByStage } from "@/hooks/useNegociosOptimized";
import { useQueryClient } from '@tanstack/react-query';
import { NegocioOptimized } from "@/hooks/useNegociosOptimized";

interface KanbanBoardProps {
  stages: Stage[];
  onStageChange: (negocioId: string, newStageId: string) => void;
  dataInicio?: string;
  dataFim?: string;
  pipelineId?: string;
  stageFilter?: string | null;
  statusFilter?: string | null;
  teamFilter?: string;
  responsavelFilter?: string;
  campanhaFilter?: string;
  sourceFilter?: string;
  mediumFilter?: string;
  termFilter?: string;
  contentFilter?: string;
  searchFilter?: string;
  motivoFilter?: string | null;
  productFilter?: string;
  tagFilter?: string;
  channelFilter?: string;
}

const KanbanBoard = ({
  stages,
  onStageChange,
  dataInicio,
  dataFim,
  pipelineId,
  stageFilter,
  statusFilter,
  teamFilter,
  responsavelFilter,
  campanhaFilter,
  sourceFilter,
  mediumFilter,
  termFilter,
  contentFilter,
  searchFilter,
  motivoFilter,
  productFilter,
  tagFilter,
  channelFilter
}: KanbanBoardProps) => {
  const updateNegocioStage = useUpdateNegocioStage();
  const queryClient = useQueryClient();

  // Get all stage IDs for the current pipeline to prevent droppable errors
  const pipelineStageIds = useMemo(
    () => stages.map(s => s.id),
    [stages]
  );

  const { negociosByStage, totalByStage, isLoading } = useNegociosByStage(
    pipelineId || '',
    pipelineStageIds,
    {
      status: statusFilter || undefined,
      user_id: responsavelFilter || undefined,
      teams_id: teamFilter || undefined,
      dataInicio,
      dataFim,
      searchFilter: searchFilter || undefined,
      utm_campaign: campanhaFilter || undefined,
      utm_source: sourceFilter || undefined,
      utm_medium: mediumFilter || undefined,
      utm_term: termFilter || undefined,
      utm_content: contentFilter || undefined,
      motivoFilter: motivoFilter || undefined,
      productId: productFilter || undefined,
      tagId: tagFilter || undefined,
      channelId: channelFilter || undefined
    }
  );

  // Filter stages for display - when no filter, show all stages
  // When filter is applied, only show that stage
  const displayStages = useMemo(() => {
    if (!stageFilter) {
      return stages;
    }
    return stages.filter(stage => stage.id === stageFilter);
  }, [stages, stageFilter]);

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) {
      return;
    }

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    // Atualização otimista: atualizar UI imediatamente
    const filters = {
      status: statusFilter || undefined,
      user_id: responsavelFilter || undefined,
      teams_id: teamFilter || undefined,
      dataInicio,
      dataFim,
      searchFilter: searchFilter || undefined,
      productId: productFilter || undefined,
      tagId: tagFilter || undefined,
      channelId: channelFilter || undefined
    };

    const queryKey = ['negocios-pipeline', pipelineId, filters];

    // Snapshot for rollback on error
    const previousData = queryClient.getQueryData<NegocioOptimized[]>(queryKey);

    queryClient.setQueryData<NegocioOptimized[]>(queryKey, (old) => {
      if (!old) return old;

      return old.map(negocio =>
        negocio.id === draggableId
          ? { ...negocio, leads_stages_id: destination.droppableId }
          : negocio
      );
    });

    // Fazer a mutação no servidor — revert on error
    updateNegocioStage.mutate(
      { negocioId: draggableId, stageId: destination.droppableId },
      {
        onError: () => {
          // Rollback optimistic update
          if (previousData) {
            queryClient.setQueryData(queryKey, previousData);
          }
        },
      },
    );

    onStageChange(draggableId, destination.droppableId);
  };

  const totalLeads = displayStages.reduce((acc, s) => acc + (negociosByStage[s.id]?.length ?? 0), 0);

  return (
    <DragDropContext onDragEnd={handleDragEnd} key={displayStages.map(s => s.id).join('-')}>
      <div className="flex-1 min-h-0 bg-background overflow-hidden relative" role="region" aria-label="Pipeline Kanban">
        <div className="h-full overflow-x-auto px-4 py-3">
          <div className="flex gap-3 min-w-max h-full" role="list" aria-label="Etapas do pipeline">
            {displayStages.map((stage) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                negocios={negociosByStage[stage.id] || []}
                totalValue={totalByStage[stage.id] || 0}
                isLoading={isLoading}
                totalLeads={totalLeads}
                pipelineId={pipelineId || ''}
              />
            ))}
          </div>
        </div>
      </div>
    </DragDropContext>
  );
};

export default KanbanBoard;
