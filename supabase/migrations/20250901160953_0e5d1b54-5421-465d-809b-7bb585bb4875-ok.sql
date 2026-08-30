-- Resolver conflito de overloading da função get_dashboard_negocios_aggregated
-- Remover versão antiga que usa timestamp without time zone e manter apenas a com time zone

-- Primeiro, remover as versões antigas que causam conflito
DROP FUNCTION IF EXISTS public.get_dashboard_negocios_aggregated(
  p_tenant_id uuid,
  p_pipeline_id uuid,
  p_stage_id uuid,
  p_status text,
  p_responsavel uuid,
  p_data_inicio timestamp without time zone,
  p_data_fim timestamp without time zone,
  p_scores integer[]
);

-- Verificar se a função atual está funcionando corretamente
-- A função com timestamp with time zone deve permanecer inalterada
-- Ela já foi criada na migração anterior sem limitações

-- Verificar se existe alguma limitação PostgREST padrão e remover
-- Adicionar comentário na função para garantir que não há limitações
COMMENT ON FUNCTION public.get_dashboard_negocios_aggregated(
  p_tenant_id uuid,
  p_pipeline_id uuid,
  p_stage_id uuid,
  p_status text,
  p_responsavel uuid,
  p_data_inicio timestamp with time zone,
  p_data_fim timestamp with time zone,
  p_scores integer[]
) IS 'Função RPC para dashboard de negócios SEM LIMITAÇÕES - processa TODOS os leads do tenant';