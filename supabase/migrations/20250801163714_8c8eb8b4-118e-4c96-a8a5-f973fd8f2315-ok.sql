-- Remover tabelas dos módulos de Agentes IA
DROP TABLE IF EXISTS crm_agentes_ia_logs CASCADE;
DROP TABLE IF EXISTS crm_agentes_ia_versionamento CASCADE;
DROP TABLE IF EXISTS crm_agentes_ia_conhecimento CASCADE;
DROP TABLE IF EXISTS crm_agentes_ia_etapas CASCADE;
DROP TABLE IF EXISTS crm_agentes_ia CASCADE;

-- Remover tabelas dos módulos de Reservas
DROP TABLE IF EXISTS crm_reservas_reservas CASCADE;
DROP TABLE IF EXISTS crm_reservas_espaco_disponibilidades CASCADE;
DROP TABLE IF EXISTS crm_reservas_espacos CASCADE;
DROP TABLE IF EXISTS crm_reservas_locais CASCADE;

-- Atualizar tenants removendo módulos de visitas e reservas
UPDATE crm_tenants 
SET modulos_ativos = jsonb_set(
  jsonb_set(
    modulos_ativos,
    '{visitas}',
    'null'::jsonb
  ),
  '{reservas}',
  'null'::jsonb
)
WHERE modulos_ativos ? 'visitas' OR modulos_ativos ? 'reservas';