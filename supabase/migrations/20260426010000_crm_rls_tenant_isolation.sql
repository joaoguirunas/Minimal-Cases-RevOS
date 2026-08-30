-- =============================================================================
-- MIGRATION: 20260426010000_crm_rls_tenant_isolation.sql
-- P0-15: Corrigir políticas RLS de 26 tabelas crm_* que estavam com USING(true)
--
-- Guard: se crm_leads não existir neste DB (ex: tenant sem módulo CRM),
-- toda a migration é skipped gracefully.
--
-- Depends on: get_current_user_tenant_id() — criada em 20260422000450
-- Idempotente: DROP POLICY IF EXISTS + CREATE
-- =============================================================================

DO $$
BEGIN
  IF to_regclass('public.crm_leads') IS NULL THEN
    RAISE NOTICE 'SKIP 20260426010000: crm_* tables not found in this DB — CRM module not installed';
    RETURN;
  END IF;

  -- ── GRUPO A: tabelas com tenant_id direto ────────────────────────────────

  -- crm_leads
  EXECUTE 'DROP POLICY IF EXISTS "leads_access_policy" ON public.crm_leads';
  EXECUTE $p$CREATE POLICY "crm_leads_tenant_rls"
    ON public.crm_leads FOR ALL TO authenticated
    USING (tenant_id = public.get_current_user_tenant_id())
    WITH CHECK (tenant_id = public.get_current_user_tenant_id())$p$;

  -- crm_pessoas
  EXECUTE 'DROP POLICY IF EXISTS "pessoas_access_policy" ON public.crm_pessoas';
  EXECUTE $p$CREATE POLICY "crm_pessoas_tenant_rls"
    ON public.crm_pessoas FOR ALL TO authenticated
    USING (tenant_id = public.get_current_user_tenant_id())
    WITH CHECK (tenant_id = public.get_current_user_tenant_id())$p$;

  -- crm_empresas
  EXECUTE 'DROP POLICY IF EXISTS "empresas_access_policy" ON public.crm_empresas';
  EXECUTE $p$CREATE POLICY "crm_empresas_tenant_rls"
    ON public.crm_empresas FOR ALL TO authenticated
    USING (tenant_id = public.get_current_user_tenant_id())
    WITH CHECK (tenant_id = public.get_current_user_tenant_id())$p$;

  -- crm_messages
  EXECUTE 'DROP POLICY IF EXISTS "messages_access_policy" ON public.crm_messages';
  EXECUTE $p$CREATE POLICY "crm_messages_tenant_rls"
    ON public.crm_messages FOR ALL TO authenticated
    USING (tenant_id = public.get_current_user_tenant_id())
    WITH CHECK (tenant_id = public.get_current_user_tenant_id())$p$;

  -- crm_pipelines
  EXECUTE 'DROP POLICY IF EXISTS "pipelines_access_policy" ON public.crm_pipelines';
  EXECUTE $p$CREATE POLICY "crm_pipelines_tenant_rls"
    ON public.crm_pipelines FOR ALL TO authenticated
    USING (tenant_id = public.get_current_user_tenant_id())
    WITH CHECK (tenant_id = public.get_current_user_tenant_id())$p$;

  -- crm_stages
  EXECUTE 'DROP POLICY IF EXISTS "stages_access_policy" ON public.crm_stages';
  EXECUTE $p$CREATE POLICY "crm_stages_tenant_rls"
    ON public.crm_stages FOR ALL TO authenticated
    USING (tenant_id = public.get_current_user_tenant_id())
    WITH CHECK (tenant_id = public.get_current_user_tenant_id())$p$;

  -- crm_agendamentos
  EXECUTE 'DROP POLICY IF EXISTS "agendamentos_access_policy" ON public.crm_agendamentos';
  EXECUTE $p$CREATE POLICY "crm_agendamentos_tenant_rls"
    ON public.crm_agendamentos FOR ALL TO authenticated
    USING (tenant_id = public.get_current_user_tenant_id())
    WITH CHECK (tenant_id = public.get_current_user_tenant_id())$p$;

  -- crm_agendamentos_followups
  EXECUTE 'DROP POLICY IF EXISTS "agendamentos_followups_access_policy" ON public.crm_agendamentos_followups';
  EXECUTE $p$CREATE POLICY "crm_agendamentos_followups_tenant_rls"
    ON public.crm_agendamentos_followups FOR ALL TO authenticated
    USING (tenant_id = public.get_current_user_tenant_id())
    WITH CHECK (tenant_id = public.get_current_user_tenant_id())$p$;

  -- crm_agentes_ia
  EXECUTE 'DROP POLICY IF EXISTS "agentes_ia_access_policy" ON public.crm_agentes_ia';
  EXECUTE $p$CREATE POLICY "crm_agentes_ia_tenant_rls"
    ON public.crm_agentes_ia FOR ALL TO authenticated
    USING (tenant_id = public.get_current_user_tenant_id())
    WITH CHECK (tenant_id = public.get_current_user_tenant_id())$p$;

  -- crm_basesconhecimento
  EXECUTE 'DROP POLICY IF EXISTS "basesconhecimento_access_policy" ON public.crm_basesconhecimento';
  EXECUTE $p$CREATE POLICY "crm_basesconhecimento_tenant_rls"
    ON public.crm_basesconhecimento FOR ALL TO authenticated
    USING (tenant_id = public.get_current_user_tenant_id())
    WITH CHECK (tenant_id = public.get_current_user_tenant_id())$p$;

  -- crm_basesconhecimento_chunks
  EXECUTE 'DROP POLICY IF EXISTS "basesconhecimento_chunks_access_policy" ON public.crm_basesconhecimento_chunks';
  EXECUTE $p$CREATE POLICY "crm_basesconhecimento_chunks_tenant_rls"
    ON public.crm_basesconhecimento_chunks FOR ALL TO authenticated
    USING (tenant_id = public.get_current_user_tenant_id())
    WITH CHECK (tenant_id = public.get_current_user_tenant_id())$p$;

  -- crm_campanhas
  EXECUTE 'DROP POLICY IF EXISTS "campanhas_access_policy" ON public.crm_campanhas';
  EXECUTE $p$CREATE POLICY "crm_campanhas_tenant_rls"
    ON public.crm_campanhas FOR ALL TO authenticated
    USING (tenant_id = public.get_current_user_tenant_id())
    WITH CHECK (tenant_id = public.get_current_user_tenant_id())$p$;

  -- crm_campanha_contatos
  EXECUTE 'DROP POLICY IF EXISTS "campanha_contatos_access_policy" ON public.crm_campanha_contatos';
  EXECUTE $p$CREATE POLICY "crm_campanha_contatos_tenant_rls"
    ON public.crm_campanha_contatos FOR ALL TO authenticated
    USING (tenant_id = public.get_current_user_tenant_id())
    WITH CHECK (tenant_id = public.get_current_user_tenant_id())$p$;

  -- crm_llm_connections
  EXECUTE 'DROP POLICY IF EXISTS "llm_connections_access_policy" ON public.crm_llm_connections';
  EXECUTE $p$CREATE POLICY "crm_llm_connections_tenant_rls"
    ON public.crm_llm_connections FOR ALL TO authenticated
    USING (tenant_id = public.get_current_user_tenant_id())
    WITH CHECK (tenant_id = public.get_current_user_tenant_id())$p$;

  -- crm_llm_usage_logs
  EXECUTE 'DROP POLICY IF EXISTS "llm_usage_logs_access_policy" ON public.crm_llm_usage_logs';
  EXECUTE $p$CREATE POLICY "crm_llm_usage_logs_tenant_rls"
    ON public.crm_llm_usage_logs FOR ALL TO authenticated
    USING (tenant_id = public.get_current_user_tenant_id())
    WITH CHECK (tenant_id = public.get_current_user_tenant_id())$p$;

  -- crm_motivo_perda
  EXECUTE 'DROP POLICY IF EXISTS "motivo_perda_access_policy" ON public.crm_motivo_perda';
  EXECUTE $p$CREATE POLICY "crm_motivo_perda_tenant_rls"
    ON public.crm_motivo_perda FOR ALL TO authenticated
    USING (tenant_id = public.get_current_user_tenant_id())
    WITH CHECK (tenant_id = public.get_current_user_tenant_id())$p$;

  -- crm_database_connections
  EXECUTE 'DROP POLICY IF EXISTS "database_connections_access_policy" ON public.crm_database_connections';
  EXECUTE $p$CREATE POLICY "crm_database_connections_tenant_rls"
    ON public.crm_database_connections FOR ALL TO authenticated
    USING (tenant_id = public.get_current_user_tenant_id())
    WITH CHECK (tenant_id = public.get_current_user_tenant_id())$p$;

  -- crm_horarios
  EXECUTE 'DROP POLICY IF EXISTS "horarios_access_policy" ON public.crm_horarios';
  EXECUTE $p$CREATE POLICY "crm_horarios_tenant_rls"
    ON public.crm_horarios FOR ALL TO authenticated
    USING (tenant_id = public.get_current_user_tenant_id())
    WITH CHECK (tenant_id = public.get_current_user_tenant_id())$p$;

  -- crm_times
  EXECUTE 'DROP POLICY IF EXISTS "times_access_policy" ON public.crm_times';
  EXECUTE $p$CREATE POLICY "crm_times_tenant_rls"
    ON public.crm_times FOR ALL TO authenticated
    USING (tenant_id = public.get_current_user_tenant_id())
    WITH CHECK (tenant_id = public.get_current_user_tenant_id())$p$;

  -- crm_usuario_times
  EXECUTE 'DROP POLICY IF EXISTS "usuario_times_access_policy" ON public.crm_usuario_times';
  EXECUTE $p$CREATE POLICY "crm_usuario_times_tenant_rls"
    ON public.crm_usuario_times FOR ALL TO authenticated
    USING (tenant_id = public.get_current_user_tenant_id())
    WITH CHECK (tenant_id = public.get_current_user_tenant_id())$p$;

  -- crm_stage_followups
  EXECUTE 'DROP POLICY IF EXISTS "stage_followups_access_policy" ON public.crm_stage_followups';
  EXECUTE $p$CREATE POLICY "crm_stage_followups_tenant_rls"
    ON public.crm_stage_followups FOR ALL TO authenticated
    USING (tenant_id = public.get_current_user_tenant_id())
    WITH CHECK (tenant_id = public.get_current_user_tenant_id())$p$;

  -- crm_negocio_arquivos
  EXECUTE 'DROP POLICY IF EXISTS "negocio_arquivos_access_policy" ON public.crm_negocio_arquivos';
  EXECUTE $p$CREATE POLICY "crm_negocio_arquivos_tenant_rls"
    ON public.crm_negocio_arquivos FOR ALL TO authenticated
    USING (tenant_id = public.get_current_user_tenant_id())
    WITH CHECK (tenant_id = public.get_current_user_tenant_id())$p$;

  -- crm_negocio_notas
  EXECUTE 'DROP POLICY IF EXISTS "negocio_notas_access_policy" ON public.crm_negocio_notas';
  EXECUTE $p$CREATE POLICY "crm_negocio_notas_tenant_rls"
    ON public.crm_negocio_notas FOR ALL TO authenticated
    USING (tenant_id = public.get_current_user_tenant_id())
    WITH CHECK (tenant_id = public.get_current_user_tenant_id())$p$;

  -- crm_pessoa_empresas
  EXECUTE 'DROP POLICY IF EXISTS "pessoa_empresas_access_policy" ON public.crm_pessoa_empresas';
  EXECUTE $p$CREATE POLICY "crm_pessoa_empresas_tenant_rls"
    ON public.crm_pessoa_empresas FOR ALL TO authenticated
    USING (tenant_id = public.get_current_user_tenant_id())
    WITH CHECK (tenant_id = public.get_current_user_tenant_id())$p$;

  -- ── GRUPO B: filhos de crm_agentes_ia (sem tenant_id, FK via agente_ia_id) ──

  -- crm_agentes_ia_etapas
  EXECUTE 'DROP POLICY IF EXISTS "agentes_ia_etapas_access_policy" ON public.crm_agentes_ia_etapas';
  EXECUTE $p$CREATE POLICY "crm_agentes_ia_etapas_tenant_rls"
    ON public.crm_agentes_ia_etapas FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.crm_agentes_ia
        WHERE id = crm_agentes_ia_etapas.agente_ia_id
          AND tenant_id = public.get_current_user_tenant_id()
      )
    )$p$;

  -- crm_agentes_ia_historico
  EXECUTE 'DROP POLICY IF EXISTS "agentes_ia_historico_access_policy" ON public.crm_agentes_ia_historico';
  EXECUTE $p$CREATE POLICY "crm_agentes_ia_historico_tenant_rls"
    ON public.crm_agentes_ia_historico FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.crm_agentes_ia
        WHERE id = crm_agentes_ia_historico.agente_ia_id
          AND tenant_id = public.get_current_user_tenant_id()
      )
    )$p$;

  -- crm_agentes_ia_etapas_historico
  EXECUTE 'DROP POLICY IF EXISTS "agentes_ia_etapas_historico_access_policy" ON public.crm_agentes_ia_etapas_historico';
  EXECUTE $p$CREATE POLICY "crm_agentes_ia_etapas_historico_tenant_rls"
    ON public.crm_agentes_ia_etapas_historico FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.crm_agentes_ia
        WHERE id = crm_agentes_ia_etapas_historico.agente_ia_id
          AND tenant_id = public.get_current_user_tenant_id()
      )
    )$p$;

END $$;
