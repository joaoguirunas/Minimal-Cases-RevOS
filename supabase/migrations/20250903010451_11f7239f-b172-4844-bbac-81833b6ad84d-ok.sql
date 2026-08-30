-- Atualizar todas as etapas de agentes IA para usar o primeiro pipeline do tenant
WITH primeiro_pipeline_por_tenant AS (
  SELECT DISTINCT ON (tenant_id) 
    id as pipeline_id,
    tenant_id
  FROM crm_pipelines 
  WHERE ativo = true
  ORDER BY tenant_id, created_at ASC
),
primeira_stage_por_pipeline AS (
  SELECT DISTINCT ON (pipeline_id)
    id as stage_id,
    pipeline_id
  FROM crm_stages
  WHERE ativo = true
  ORDER BY pipeline_id, ordem ASC
)
UPDATE crm_agentes_ia_etapas 
SET 
  pipeline_id = pp.pipeline_id,
  stage_id = ps.stage_id,
  updated_at = now()
FROM crm_agentes_ia ai
JOIN primeiro_pipeline_por_tenant pp ON ai.tenant_id = pp.tenant_id
LEFT JOIN primeira_stage_por_pipeline ps ON pp.pipeline_id = ps.pipeline_id
WHERE crm_agentes_ia_etapas.agente_ia_id = ai.id
  AND (crm_agentes_ia_etapas.pipeline_id IS NULL 
       OR crm_agentes_ia_etapas.pipeline_id != pp.pipeline_id);

-- Log das atualizações realizadas
DO $$
DECLARE
  total_updated INTEGER;
BEGIN
  GET DIAGNOSTICS total_updated = ROW_COUNT;
  RAISE LOG 'Atualizadas % etapas de agentes IA com pipeline padrão', total_updated;
END $$;