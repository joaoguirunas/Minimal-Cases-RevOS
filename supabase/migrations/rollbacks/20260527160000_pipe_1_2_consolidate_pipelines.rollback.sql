-- ═══════════════════════════════════════════════════════════════════
-- 20260527160000_pipe_1_2_consolidate_pipelines.rollback.sql
-- Brief: Rollback completo da PIPE-1.2 — restaura leads, inbound_webhook e
--        ai_agent aos valores originais a partir das tabelas de backup
--        criadas em 20260527160000_pipe_1_2_consolidate_pipelines.sql,
--        e reativa as pipelines de origem (1|Cursos Online, 2|Mentoria).
--
-- Origem dos dados: public._migration_backup_{leads,webhooks,ai_agents}_pipeline
--                   WHERE migration_id = '20260527160000_pipe_1_2'
--
-- Pré-requisito: as 3 tabelas de backup ainda existem com os dados snapshotados.
--                Se foram dropadas, o rollback FALHA com mensagem clara.
-- ═══════════════════════════════════════════════════════════════════
-- @lint-skip MIG002 reason: rollback handcrafted que reverte data migration.
-- @no-rollback reason: this IS the rollback file.

BEGIN;

-- =====================================================================
-- 0. PRE-FLIGHT — backup tables must exist with rows for this migration
-- =====================================================================
DO $$
DECLARE
  v_leads     int;
  v_webhooks  int;
  v_agents    int;
BEGIN
  -- existência das tabelas
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='_migration_backup_leads_pipeline') THEN
    RAISE EXCEPTION 'PIPE-1.2 ROLLBACK ABORTED: tabela _migration_backup_leads_pipeline NÃO existe — rollback impossível';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='_migration_backup_webhooks_pipeline') THEN
    RAISE EXCEPTION 'PIPE-1.2 ROLLBACK ABORTED: tabela _migration_backup_webhooks_pipeline NÃO existe — rollback impossível';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='_migration_backup_ai_agents_pipeline') THEN
    RAISE EXCEPTION 'PIPE-1.2 ROLLBACK ABORTED: tabela _migration_backup_ai_agents_pipeline NÃO existe — rollback impossível';
  END IF;

  -- contagens — devem ser > 0
  SELECT count(*) INTO v_leads    FROM public._migration_backup_leads_pipeline    WHERE migration_id = '20260527160000_pipe_1_2';
  SELECT count(*) INTO v_webhooks FROM public._migration_backup_webhooks_pipeline WHERE migration_id = '20260527160000_pipe_1_2';
  SELECT count(*) INTO v_agents   FROM public._migration_backup_ai_agents_pipeline WHERE migration_id = '20260527160000_pipe_1_2';

  IF v_leads = 0 AND v_webhooks = 0 AND v_agents = 0 THEN
    RAISE EXCEPTION 'PIPE-1.2 ROLLBACK ABORTED: zero rows com migration_id=20260527160000_pipe_1_2 — nada para reverter';
  END IF;

  RAISE NOTICE '[PIPE-1.2 ROLLBACK] Backup encontrado: leads=%, webhooks=%, ai_agents=%', v_leads, v_webhooks, v_agents;
END $$;

-- =====================================================================
-- 1. Desabilitar TODOS os triggers user-defined em `leads` durante o rollback
--    Mesma razão do migration principal: evitar 3 triggers em massa
--    (leads_changes_trigger, trg_conversion_stage_enter, on_lead_stage_changed).
-- =====================================================================
ALTER TABLE public.leads DISABLE TRIGGER USER;

-- =====================================================================
-- 2. Restaurar leads
-- =====================================================================
UPDATE public.leads l
SET    leads_pipelines_id = b.old_leads_pipelines_id,
       leads_stages_id    = b.old_leads_stages_id,
       updated_at         = now()
FROM   public._migration_backup_leads_pipeline b
WHERE  b.migration_id = '20260527160000_pipe_1_2'
  AND  l.id           = b.lead_id;

DO $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM public._migration_backup_leads_pipeline WHERE migration_id = '20260527160000_pipe_1_2';
  RAISE NOTICE '[PIPE-1.2 ROLLBACK] leads restaurados: % linhas', v_count;
END $$;

-- =====================================================================
-- 3. Restaurar inbound_webhook
-- =====================================================================
UPDATE public.inbound_webhooks iw
SET    pipeline_id = b.old_pipeline_id,
       stage_id    = b.old_stage_id,
       create_mode = b.old_create_mode,
       updated_at  = now()
FROM   public._migration_backup_webhooks_pipeline b
WHERE  b.migration_id = '20260527160000_pipe_1_2'
  AND  iw.id          = b.webhook_id;

DO $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM public._migration_backup_webhooks_pipeline WHERE migration_id = '20260527160000_pipe_1_2';
  RAISE NOTICE '[PIPE-1.2 ROLLBACK] inbound_webhooks restaurados: % linha(s)', v_count;
END $$;

-- =====================================================================
-- 4. Restaurar ai_agent (pipeline_id + pipeline_ids + stage_ids)
-- =====================================================================
UPDATE public.ai_agents a
SET    pipeline_id  = b.old_pipeline_id,
       pipeline_ids = b.old_pipeline_ids,
       stage_ids    = b.old_stage_ids,
       updated_at   = now()
FROM   public._migration_backup_ai_agents_pipeline b
WHERE  b.migration_id = '20260527160000_pipe_1_2'
  AND  a.id           = b.ai_agent_id;

DO $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM public._migration_backup_ai_agents_pipeline WHERE migration_id = '20260527160000_pipe_1_2';
  RAISE NOTICE '[PIPE-1.2 ROLLBACK] ai_agents restaurados: % linha(s)', v_count;
END $$;

-- =====================================================================
-- 5. Reativar as pipelines de origem
-- =====================================================================
UPDATE public.leads_pipelines lp
SET    active = true,
       updated_at = now()
WHERE  lp.id IN (
         'f8aae630-649e-49c0-93c6-bd8199682410'::uuid,  -- 1 | Cursos Online
         '2bba67aa-42bd-4f7d-8dd9-6678b37c59e4'::uuid   -- 2 | Mentoria
       )
  AND  lp.active = false;

DO $$
DECLARE v_active int;
BEGIN
  SELECT count(*) INTO v_active
  FROM public.leads_pipelines
  WHERE id IN (
          'f8aae630-649e-49c0-93c6-bd8199682410'::uuid,
          '2bba67aa-42bd-4f7d-8dd9-6678b37c59e4'::uuid
        )
    AND active = true;
  RAISE NOTICE '[PIPE-1.2 ROLLBACK] pipelines de origem reativadas: %/2', v_active;
END $$;

-- =====================================================================
-- 6. Reabilitar todos os triggers user-defined em `leads`
-- =====================================================================
ALTER TABLE public.leads ENABLE TRIGGER USER;

-- =====================================================================
-- 7. POST-ROLLBACK INTEGRITY
-- =====================================================================
DO $$
DECLARE
  v_still_in_target int;
  v_total_backed_up int;
BEGIN
  -- Quantos leads do backup ainda estão em "0 | Vendas" (esperado 0 se o backup
  -- original NÃO incluía leads que já estavam em "0 | Vendas")
  SELECT count(*) INTO v_still_in_target
  FROM public.leads l
  JOIN public._migration_backup_leads_pipeline b
    ON b.lead_id = l.id AND b.migration_id = '20260527160000_pipe_1_2'
  WHERE l.leads_pipelines_id = '3b5ece8e-fcb3-4dec-a4a0-b9ad8d9cadb6'::uuid;

  SELECT count(*) INTO v_total_backed_up
  FROM public._migration_backup_leads_pipeline
  WHERE migration_id = '20260527160000_pipe_1_2';

  IF v_still_in_target > 0 THEN
    RAISE EXCEPTION 'PIPE-1.2 ROLLBACK CHECK FAILED: % leads do backup ainda apontam para "0 | Vendas" após restore (de % no total)', v_still_in_target, v_total_backed_up;
  END IF;

  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  RAISE NOTICE '[PIPE-1.2 ROLLBACK] CONCLUÍDO COM SUCESSO';
  RAISE NOTICE '  leads restaurados:       %', v_total_backed_up;
  RAISE NOTICE '  webhooks restaurados:    1';
  RAISE NOTICE '  ai_agents restaurados:   1';
  RAISE NOTICE '  pipelines reativadas:    2 (1|Cursos Online + 2|Mentoria)';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  RAISE NOTICE '[NOTA] As tabelas _migration_backup_* foram PRESERVADAS para auditoria.';
  RAISE NOTICE '       Para limpá-las depois de validar o rollback, execute manualmente:';
  RAISE NOTICE '         DROP TABLE public._migration_backup_leads_pipeline;';
  RAISE NOTICE '         DROP TABLE public._migration_backup_webhooks_pipeline;';
  RAISE NOTICE '         DROP TABLE public._migration_backup_ai_agents_pipeline;';
END $$;

COMMIT;
