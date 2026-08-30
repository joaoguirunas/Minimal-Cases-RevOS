import { useMemo } from 'react';
import {
  usePipelines as usePipelinesReal,
  useStages,
  useCreatePipeline,
  useUpdatePipeline,
  useDeletePipeline,
  useReorderPipelines,
  useCreateStage,
  useUpdateStage,
  Pipeline as PipelineReal,
  Stage as StageReal
} from './usePipelinesReal';
import { useMyAllowedPipelineIds } from './useTeamsNew';

// Re-export types
export type Pipeline = PipelineReal;
export type Stage = StageReal;

export interface PipelineReturn {
  pipelines: Pipeline[];
  stages: Stage[];
  isLoading: boolean;
  error: any;
  refetch: () => Promise<any>;
  createPipeline: ReturnType<typeof useCreatePipeline>;
  updatePipeline: ReturnType<typeof useUpdatePipeline>;
  deletePipeline: ReturnType<typeof useDeletePipeline>;
  reorderPipelines: ReturnType<typeof useReorderPipelines>;
  criarPipeline: ReturnType<typeof useCreatePipeline>;
  atualizarPipeline: ReturnType<typeof useUpdatePipeline>;
  deletarPipeline: ReturnType<typeof useDeletePipeline>;
  reordenarPipelines: ReturnType<typeof useReorderPipelines>;
  criarStage: ReturnType<typeof useCreateStage>;
  atualizarStage: ReturnType<typeof useUpdateStage>;
  deletarStage: ReturnType<typeof useUpdateStage>; // Reuse update for soft delete
}

export const usePipelines = (): PipelineReturn => {
  const { data: pipelinesRaw = [], isLoading: pipelinesLoading, error: pipelinesError, refetch: refetchPipelines } = usePipelinesReal();
  const { data: stages = [], isLoading: stagesLoading, error: stagesError, refetch: refetchStages } = useStages();
  const { data: allowedPipelineIds } = useMyAllowedPipelineIds();

  // Usuário 'comercial' numa equipe restrita a certos pipelines só vê esses
  // (allowedPipelineIds !== null). Todos os demais casos (admin/manager/user,
  // ou comercial numa equipe universal/sem equipe) veem tudo, sem filtro.
  // useMemo é obrigatório aqui: sem ele, .filter() cria um array novo a cada
  // render, o que faz qualquer efeito que dependa de `pipelines` (ex.
  // NegocioSingle.tsx) disparar em loop infinito — travava a navegação de
  // usuários 'comercial' com pipeline restrito (tela presa, URL muda mas a
  // tela não atualiza).
  const pipelines = useMemo(
    () => (allowedPipelineIds ? pipelinesRaw.filter((p) => allowedPipelineIds.includes(p.id)) : pipelinesRaw),
    [pipelinesRaw, allowedPipelineIds],
  );

  console.log('📊 usePipelines status:', {
    pipelinesCount: pipelines.length,
    stagesCount: stages.length,
    pipelinesLoading,
    stagesLoading,
    isLoading: pipelinesLoading || stagesLoading,
    pipelinesError,
    stagesError
  });
  
  const createPipeline = useCreatePipeline();
  const updatePipeline = useUpdatePipeline();
  const deletePipeline = useDeletePipeline();
  const reorderPipelines = useReorderPipelines();
  const createStage = useCreateStage();
  const updateStage = useUpdateStage();
  
  const refetch = async () => {
    await Promise.all([refetchPipelines(), refetchStages()]);
  };
  
  return {
    pipelines,
    stages,
    isLoading: pipelinesLoading || stagesLoading,
    error: pipelinesError || stagesError,
    refetch,
    createPipeline,
    updatePipeline,
    deletePipeline,
    reorderPipelines,
    criarPipeline: createPipeline,
    atualizarPipeline: updatePipeline,
    deletarPipeline: deletePipeline,
    reordenarPipelines: reorderPipelines,
    criarStage: createStage,
    atualizarStage: updateStage,
    deletarStage: updateStage,
  };
};

export default usePipelines;
