
import { useMemo } from "react";
import type { ReactNode } from "react";
import { Stage } from "@/hooks/usePipelines";
import StageColumn from "./StageColumn";
import PipelineFunnelStrip from "./PipelineFunnelStrip";
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { useUpdateNegocioStage } from "@/hooks/useUpdateNegocioStage";
import { useNegociosByStage } from "@/hooks/useNegociosOptimized";
import { useQueryClient } from '@tanstack/react-query';
import { NegocioOptimized } from "@/hooks/useNegociosOptimized";
import { useTrackedClicksRealtime } from "@/hooks/useTrackedLinks";
import { groupByColumn, stageColumns, type KanbanColumn } from "@/lib/comercial/kanban";
import { useSkuImages } from "@/hooks/useComercial";

interface KanbanBoardProps {
  stages: Stage[];
  onStageChange: (negocioId: string, newStageId: string) => void;
  dataInicio?: string;
  dataFim?: string;
  pipelineId?: string;
  stageFilter?: string | null;
  onStageFilterChange?: (id: string | null) => void;
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
  columns?: KanbanColumn[];
  readOnly?: boolean;
  renderCardExtra?: (n: NegocioOptimized) => ReactNode;
  ownerNames?: Record<string, string>;
}

const KanbanBoard = ({
  stages,
  onStageChange,
  dataInicio,
  dataFim,
  pipelineId,
  stageFilter,
  onStageFilterChange,
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
  channelFilter,
  columns,
  readOnly,
  renderCardExtra,
  ownerNames
}: KanbanBoardProps) => {
  const updateNegocioStage = useUpdateNegocioStage();
  const queryClient = useQueryClient();
  useTrackedClicksRealtime();

  // Colunas: default = 1 stage por coluna (comportamento de hoje); ou colunas
  // compostas passadas via prop (ex.: visão do comercial agrupando 3 stages).
  const cols = useMemo(() => columns ?? stageColumns(stages), [columns, stages]);

  // Get all stage IDs for the current pipeline to prevent droppable errors
  const pipelineStageIds = useMemo(
    () => cols.flatMap((c) => c.stageIds),
    [cols]
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

  // negociosByStage agrupa por stage (useNegociosByStage não sabe de colunas);
  // reagrupamos aqui por coluna, que pode somar múltiplos stages.
  const allNegocios = useMemo(() => Object.values(negociosByStage).flat(), [negociosByStage]);
  // Colunas compostas (visão do comercial) não cobrem todos os stages do pipeline:
  // sem fallback, o lead em "Pagamento recusado"/"Perdido" some do board em vez de
  // aparecer como carrinho disponível. O kanban padrão (1 stage = 1 coluna) mantém o
  // fallback — lá ele nunca dispara.
  const negociosByColumn = useMemo(
    () => groupByColumn(allNegocios, cols, { fallbackToFirst: !columns }),
    [allNegocios, cols, columns]
  );
  // Foto da capa por SKU: os negócios já estão aqui, não vale pagar um segundo fetch
  // (+ canal de realtime) do pipeline inteiro só pra juntar os sku_id.
  const { data: skuImages = {} } = useSkuImages(
    useMemo(
      () => allNegocios.map((n) => n.sku_id).filter((v): v is number => typeof v === 'number'),
      [allNegocios]
    )
  );
  const totalByColumn = useMemo(
    () => Object.fromEntries(cols.map((c) => [c.id, c.stageIds.reduce((a, s) => a + (totalByStage[s] ?? 0), 0)])),
    [cols, totalByStage]
  );

  // Filter columns for display - when no filter, show all columns
  // When filter is applied, only show the column containing that stage
  const displayColumns = useMemo(() => {
    if (!stageFilter) {
      return cols;
    }
    return cols.filter((c) => c.id === stageFilter || c.stageIds.includes(stageFilter));
  }, [cols, stageFilter]);

  const handleDragEnd = (result: DropResult) => {
    if (readOnly) return;
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

    // A droppableId agora é o id da COLUNA (que pode agrupar N stages); o
    // stage de destino real é sempre o primeiro stage daquela coluna.
    const targetStageId = cols.find((c) => c.id === destination.droppableId)?.stageIds[0] ?? destination.droppableId;

    // Snapshot for rollback on error
    const previousData = queryClient.getQueryData<NegocioOptimized[]>(queryKey);

    queryClient.setQueryData<NegocioOptimized[]>(queryKey, (old) => {
      if (!old) return old;

      return old.map(negocio =>
        negocio.id === draggableId
          ? { ...negocio, leads_stages_id: targetStageId }
          : negocio
      );
    });

    // Fazer a mutação no servidor — revert on error
    updateNegocioStage.mutate(
      { negocioId: draggableId, stageId: targetStageId },
      {
        onError: () => {
          // Rollback optimistic update
          if (previousData) {
            queryClient.setQueryData(queryKey, previousData);
          }
        },
      },
    );

    onStageChange(draggableId, targetStageId);
  };

  const totalLeads = displayColumns.reduce((acc, c) => acc + (negociosByColumn[c.id]?.length ?? 0), 0);

  return (
    <DragDropContext onDragEnd={handleDragEnd} key={displayColumns.map(c => c.id).join('-')}>
      <div className="flex-1 min-h-0 bg-background overflow-hidden relative flex flex-col" role="region" aria-label="Pipeline Kanban">
        <PipelineFunnelStrip
          stages={cols.map((c) => ({ id: c.id, nome: c.nome, cor: c.cor, count: negociosByColumn[c.id]?.length ?? 0 }))}
          activeStageId={stageFilter ?? null}
          onSelect={(id) => onStageFilterChange?.(id)}
        />
        <div className="flex-1 min-h-0 overflow-x-auto px-4 py-3">
          <div className="flex gap-3 min-w-max h-full" role="list" aria-label="Etapas do pipeline">
            {displayColumns.map((col) => (
              <StageColumn
                key={col.id}
                column={col}
                negocios={negociosByColumn[col.id] || []}
                totalValue={totalByColumn[col.id] || 0}
                isLoading={isLoading}
                totalLeads={totalLeads}
                pipelineId={pipelineId || ''}
                readOnly={readOnly}
                renderCardExtra={renderCardExtra}
                ownerNames={ownerNames}
                skuImages={skuImages}
              />
            ))}
          </div>
        </div>
      </div>
    </DragDropContext>
  );
};

export default KanbanBoard;
