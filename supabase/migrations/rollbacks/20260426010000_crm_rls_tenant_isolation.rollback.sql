-- ROLLBACK: 20260426010000_crm_rls_tenant_isolation
-- Restaura USING(true) em todas as 26 tabelas crm_* afetadas.

BEGIN;

-- Grupo A
DROP POLICY IF EXISTS "crm_leads_tenant_rls"                    ON public.crm_leads;
DROP POLICY IF EXISTS "crm_pessoas_tenant_rls"                   ON public.crm_pessoas;
DROP POLICY IF EXISTS "crm_empresas_tenant_rls"                  ON public.crm_empresas;
DROP POLICY IF EXISTS "crm_messages_tenant_rls"                  ON public.crm_messages;
DROP POLICY IF EXISTS "crm_pipelines_tenant_rls"                 ON public.crm_pipelines;
DROP POLICY IF EXISTS "crm_stages_tenant_rls"                    ON public.crm_stages;
DROP POLICY IF EXISTS "crm_agendamentos_tenant_rls"              ON public.crm_agendamentos;
DROP POLICY IF EXISTS "crm_agendamentos_followups_tenant_rls"    ON public.crm_agendamentos_followups;
DROP POLICY IF EXISTS "crm_agentes_ia_tenant_rls"                ON public.crm_agentes_ia;
DROP POLICY IF EXISTS "crm_basesconhecimento_tenant_rls"         ON public.crm_basesconhecimento;
DROP POLICY IF EXISTS "crm_basesconhecimento_chunks_tenant_rls"  ON public.crm_basesconhecimento_chunks;
DROP POLICY IF EXISTS "crm_campanhas_tenant_rls"                 ON public.crm_campanhas;
DROP POLICY IF EXISTS "crm_campanha_contatos_tenant_rls"         ON public.crm_campanha_contatos;
DROP POLICY IF EXISTS "crm_llm_connections_tenant_rls"           ON public.crm_llm_connections;
DROP POLICY IF EXISTS "crm_llm_usage_logs_tenant_rls"            ON public.crm_llm_usage_logs;
DROP POLICY IF EXISTS "crm_motivo_perda_tenant_rls"              ON public.crm_motivo_perda;
DROP POLICY IF EXISTS "crm_database_connections_tenant_rls"      ON public.crm_database_connections;
DROP POLICY IF EXISTS "crm_horarios_tenant_rls"                  ON public.crm_horarios;
DROP POLICY IF EXISTS "crm_times_tenant_rls"                     ON public.crm_times;
DROP POLICY IF EXISTS "crm_usuario_times_tenant_rls"             ON public.crm_usuario_times;
DROP POLICY IF EXISTS "crm_stage_followups_tenant_rls"           ON public.crm_stage_followups;
DROP POLICY IF EXISTS "crm_negocio_arquivos_tenant_rls"          ON public.crm_negocio_arquivos;
DROP POLICY IF EXISTS "crm_negocio_notas_tenant_rls"             ON public.crm_negocio_notas;
DROP POLICY IF EXISTS "crm_pessoa_empresas_tenant_rls"           ON public.crm_pessoa_empresas;

-- Grupo B
DROP POLICY IF EXISTS "crm_agentes_ia_etapas_tenant_rls"            ON public.crm_agentes_ia_etapas;
DROP POLICY IF EXISTS "crm_agentes_ia_historico_tenant_rls"          ON public.crm_agentes_ia_historico;
DROP POLICY IF EXISTS "crm_agentes_ia_etapas_historico_tenant_rls"   ON public.crm_agentes_ia_etapas_historico;

-- Restaurar USING(true)
CREATE POLICY "leads_access_policy"                    ON public.crm_leads                    FOR ALL USING (true);
CREATE POLICY "pessoas_access_policy"                  ON public.crm_pessoas                  FOR ALL USING (true);
CREATE POLICY "empresas_access_policy"                 ON public.crm_empresas                 FOR ALL USING (true);
CREATE POLICY "messages_access_policy"                 ON public.crm_messages                 FOR ALL USING (true);
CREATE POLICY "pipelines_access_policy"                ON public.crm_pipelines                FOR ALL USING (true);
CREATE POLICY "stages_access_policy"                   ON public.crm_stages                   FOR ALL USING (true);
CREATE POLICY "agendamentos_access_policy"             ON public.crm_agendamentos             FOR ALL USING (true);
CREATE POLICY "agendamentos_followups_access_policy"   ON public.crm_agendamentos_followups   FOR ALL USING (true);
CREATE POLICY "agentes_ia_access_policy"               ON public.crm_agentes_ia               FOR ALL USING (true);
CREATE POLICY "basesconhecimento_access_policy"        ON public.crm_basesconhecimento        FOR ALL USING (true);
CREATE POLICY "basesconhecimento_chunks_access_policy" ON public.crm_basesconhecimento_chunks FOR ALL USING (true);
CREATE POLICY "campanhas_access_policy"                ON public.crm_campanhas                FOR ALL USING (true);
CREATE POLICY "campanha_contatos_access_policy"        ON public.crm_campanha_contatos        FOR ALL USING (true);
CREATE POLICY "llm_connections_access_policy"          ON public.crm_llm_connections          FOR ALL USING (true);
CREATE POLICY "llm_usage_logs_access_policy"           ON public.crm_llm_usage_logs           FOR ALL USING (true);
CREATE POLICY "motivo_perda_access_policy"             ON public.crm_motivo_perda             FOR ALL USING (true);
CREATE POLICY "database_connections_access_policy"     ON public.crm_database_connections     FOR ALL USING (true);
CREATE POLICY "horarios_access_policy"                 ON public.crm_horarios                 FOR ALL USING (true);
CREATE POLICY "times_access_policy"                    ON public.crm_times                    FOR ALL USING (true);
CREATE POLICY "usuario_times_access_policy"            ON public.crm_usuario_times            FOR ALL USING (true);
CREATE POLICY "stage_followups_access_policy"          ON public.crm_stage_followups          FOR ALL USING (true);
CREATE POLICY "negocio_arquivos_access_policy"         ON public.crm_negocio_arquivos         FOR ALL USING (true);
CREATE POLICY "negocio_notas_access_policy"            ON public.crm_negocio_notas            FOR ALL USING (true);
CREATE POLICY "pessoa_empresas_access_policy"          ON public.crm_pessoa_empresas          FOR ALL USING (true);
CREATE POLICY "agentes_ia_etapas_access_policy"            ON public.crm_agentes_ia_etapas            FOR ALL USING (true);
CREATE POLICY "agentes_ia_historico_access_policy"         ON public.crm_agentes_ia_historico         FOR ALL USING (true);
CREATE POLICY "agentes_ia_etapas_historico_access_policy"  ON public.crm_agentes_ia_etapas_historico  FOR ALL USING (true);

COMMIT;
