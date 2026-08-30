-- CORREÇÃO COMPLETA DO SISTEMA RLS - RESOLVER PROBLEMA GLOBAL DE ACESSO 
-- PARTE 1: DROPAR TODAS AS POLÍTICAS QUE DEPENDEM DAS FUNÇÕES PROBLEMÁTICAS
-- ========================================================================

-- Dropar todas as políticas que usam user_has_tenant_access
DROP POLICY IF EXISTS "Users can view agendamentos followups of their tenant" ON crm_agendamentos_followups;
DROP POLICY IF EXISTS "Users can create agendamentos followups in their tenant" ON crm_agendamentos_followups;
DROP POLICY IF EXISTS "Users can update agendamentos followups of their tenant" ON crm_agendamentos_followups;
DROP POLICY IF EXISTS "Users can delete agendamentos followups of their tenant" ON crm_agendamentos_followups;

DROP POLICY IF EXISTS "Users can manage agents from their tenant" ON crm_agentes_ia;

DROP POLICY IF EXISTS "Users can view agent history from their tenant" ON crm_agentes_ia_historico;

DROP POLICY IF EXISTS "Users can manage etapas from their tenant agents" ON crm_agentes_ia_etapas;

DROP POLICY IF EXISTS "Users can view etapas history from their tenant" ON crm_agentes_ia_etapas_historico;

DROP POLICY IF EXISTS "Users can view bases from their tenant" ON crm_basesconhecimento;
DROP POLICY IF EXISTS "Users can insert bases in their tenant" ON crm_basesconhecimento;
DROP POLICY IF EXISTS "Users can update bases from their tenant" ON crm_basesconhecimento;
DROP POLICY IF EXISTS "Users can delete bases from their tenant" ON crm_basesconhecimento;

DROP POLICY IF EXISTS "Users can view chunks from their tenant" ON crm_basesconhecimento_chunks;
DROP POLICY IF EXISTS "Users can insert chunks in their tenant" ON crm_basesconhecimento_chunks;
DROP POLICY IF EXISTS "Users can update chunks from their tenant" ON crm_basesconhecimento_chunks;
DROP POLICY IF EXISTS "Users can delete chunks from their tenant" ON crm_basesconhecimento_chunks;

DROP POLICY IF EXISTS "Users can view campanha_contatos from their tenant" ON crm_campanha_contatos;
DROP POLICY IF EXISTS "Users can insert campanha_contatos in their tenant" ON crm_campanha_contatos;
DROP POLICY IF EXISTS "Users can update campanha_contatos from their tenant" ON crm_campanha_contatos;
DROP POLICY IF EXISTS "Users can delete campanha_contatos from their tenant" ON crm_campanha_contatos;

DROP POLICY IF EXISTS "Users can view campanhas from their tenant" ON crm_campanhas;
DROP POLICY IF EXISTS "Users can insert campanhas in their tenant" ON crm_campanhas;
DROP POLICY IF EXISTS "Users can update campanhas from their tenant" ON crm_campanhas;
DROP POLICY IF EXISTS "Users can delete campanhas from their tenant" ON crm_campanhas;

DROP POLICY IF EXISTS "Users can view companies from their tenant" ON crm_empresas;
DROP POLICY IF EXISTS "Users can create companies in their tenant" ON crm_empresas;
DROP POLICY IF EXISTS "Users can update companies from their tenant" ON crm_empresas;
DROP POLICY IF EXISTS "Managers can delete companies from their tenant" ON crm_empresas;

DROP POLICY IF EXISTS "Users can view usage logs from their tenant" ON crm_llm_usage_logs;
DROP POLICY IF EXISTS "Users can insert usage logs in their tenant" ON crm_llm_usage_logs;

DROP POLICY IF EXISTS "Users can view motivos from their tenant" ON crm_motivo_perda;
DROP POLICY IF EXISTS "Users can insert motivos in their tenant" ON crm_motivo_perda;
DROP POLICY IF EXISTS "Users can update motivos from their tenant" ON crm_motivo_perda;
DROP POLICY IF EXISTS "Users can delete motivos from their tenant" ON crm_motivo_perda;

DROP POLICY IF EXISTS "Users can view notes from their tenant" ON crm_negocio_notas;
DROP POLICY IF EXISTS "Users can insert notes in their tenant" ON crm_negocio_notas;
DROP POLICY IF EXISTS "Users can update notes from their tenant" ON crm_negocio_notas;
DROP POLICY IF EXISTS "Users can delete notes from their tenant" ON crm_negocio_notas;

DROP POLICY IF EXISTS "Users can view pessoa_empresas from their tenant" ON crm_pessoa_empresas;
DROP POLICY IF EXISTS "Users can insert pessoa_empresas in their tenant" ON crm_pessoa_empresas;
DROP POLICY IF EXISTS "Users can update pessoa_empresas from their tenant" ON crm_pessoa_empresas;
DROP POLICY IF EXISTS "Users can delete pessoa_empresas from their tenant" ON crm_pessoa_empresas;

DROP POLICY IF EXISTS "Users can view stage followups of their tenant" ON crm_stage_followups;
DROP POLICY IF EXISTS "Users can create stage followups in their tenant" ON crm_stage_followups;
DROP POLICY IF EXISTS "Users can update stage followups of their tenant" ON crm_stage_followups;
DROP POLICY IF EXISTS "Users can delete stage followups of their tenant" ON crm_stage_followups;

-- DROPAR TODAS AS FUNÇÕES PROBLEMÁTICAS QUE CAUSAM RECURSÃO
DROP FUNCTION IF EXISTS public.user_has_tenant_access(uuid);
DROP FUNCTION IF EXISTS public.is_user_super_admin();
DROP FUNCTION IF EXISTS public.is_user_manager_for_tenant(uuid);
DROP FUNCTION IF EXISTS public.get_current_user_tenant_id();
DROP FUNCTION IF EXISTS public.get_user_tenant_id();
DROP FUNCTION IF EXISTS public.is_current_user_super_admin();
DROP FUNCTION IF EXISTS public.get_current_user_tenant_safe();
DROP FUNCTION IF EXISTS public.is_current_user_super_admin_safe();