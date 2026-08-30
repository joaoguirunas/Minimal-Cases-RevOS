-- ═══════════════════════════════════════════════════════════════════
-- 20260527160000_pipe_1_2_consolidate_pipelines.sql
-- Brief: Story PIPE-1.2 — consolida TODOS os leads dos pipelines "1 | Cursos Online"
--        e "2 | Mentoria" no pipeline "0 | Vendas", repointa webhook + ai_agent
--        que apontam para os pipelines de origem, e inativa as pipelines de origem
--        (active = false — NÃO DELETE).
--
-- Decisão de colisão (lead 2026-05-27): N/A — Zero colisões em prod (nenhuma pessoa
-- com lead em mais de uma pipeline). Estratégia winner/loser do plano v2 não precisa
-- ser invocada; usamos UPDATE direto.
--
-- Mapeamento de stages (origem → destino em "0 | Vendas") — aprovado por João:
--   2a83ef9f-...  Interesse           →  6559f629-...  Formulário
--   0f409981-...  Qualificação        →  6e6a95e5-...  Qualificação
--   4fabe472-...  Reunião Realizada   →  565cb255-...  Reunião Realizada
--   60378510-...  Pagamento           →  c9f7ca89-...  Link de Pagamento
--   cbd94993-...  Em Andamento        →  fc8a9935-...  Aluno Mentoria
--   <qualquer outro>                  →  ecffb310-...  Comentário em Post (fallback)
--
-- Volume esperado: 4 leads de "1 | Cursos Online" + 16 leads de "2 | Mentoria" = 20.
-- FK delete_rule de leads.leads_pipelines_id em prod = SET NULL (confirmado).
-- Todos os triggers user-defined em `leads` são DISABLE durante a transação:
--   - leads_changes_trigger (função track_leads_changes — audit log)
--   - trg_conversion_stage_enter (enfileira conversion events GA/Meta)
--   - on_lead_stage_changed (HTTP request externo via pg_net)
-- ENABLE/DISABLE em massa via `DISABLE TRIGGER USER` (não toca triggers internos).
--
-- Audit tables (rollback): _migration_backup_{leads,webhooks,ai_agents}_pipeline.
-- Rollback: supabase/migrations/rollbacks/20260527160000_pipe_1_2_consolidate_pipelines.rollback.sql
--
-- RUNBOOK (executar antes de rodar esta migration):
--   1. Desativar webhook "Interesse Curso Online":
--        UPDATE public.inbound_webhooks SET active=false
--        WHERE id='d52657ab-362a-461a-8fe9-626f1bbb5b2c';
--   2. Confirmar zero webhooks ativos em "1|Cursos Online"/"2|Mentoria":
--        SELECT id,name,active FROM inbound_webhooks
--        WHERE pipeline_id IN ('f8aae630-649e-49c0-93c6-bd8199682410',
--                              '2bba67aa-42bd-4f7d-8dd9-6678b37c59e4');
--   3. Rodar a migration em janela de manutenção.
--   4. Reativar o webhook (já re-apontado para 0|Vendas pelo COMMIT desta migration):
--        UPDATE public.inbound_webhooks SET active=true
--        WHERE id='d52657ab-362a-461a-8fe9-626f1bbb5b2c';
-- ═══════════════════════════════════════════════════════════════════
-- @lint-skip MIG002 reason: data migration; rollback dedicado a partir das audit tables.

BEGIN;

-- =====================================================================
-- 0. CONSTANTES (variáveis locais via DO block apenas para diagnóstico —
--    o SQL real usa literais para garantir determinismo e simplicidade de revisão)
-- =====================================================================
-- target_pipeline_id            = '3b5ece8e-fcb3-4dec-a4a0-b9ad8d9cadb6'  -- 0 | Vendas
-- target_stage_default_id       = 'ecffb310-d030-42c6-baf6-8989141d27ff'  -- Comentário em Post
-- source_pipeline_cursos_id     = 'f8aae630-649e-49c0-93c6-bd8199682410'  -- 1 | Cursos Online
-- source_pipeline_mentoria_id   = '2bba67aa-42bd-4f7d-8dd9-6678b37c59e4'  -- 2 | Mentoria
-- webhook_interesse_id          = 'd52657ab-362a-461a-8fe9-626f1bbb5b2c'
-- ai_agent_mentoria_id          = 'd7c97ca2-9b40-47da-a21e-99e59bd1c385'

-- =====================================================================
-- 0.5 GUARD ANTI RE-EXECUÇÃO
--     Se as audit tables já foram populadas para este migration_id, ABORTA.
--     Para re-executar intencionalmente: dropar manualmente as 3 tabelas
--     _migration_backup_*_pipeline (após validar que nada precisa do snapshot).
-- =====================================================================
DO $$
BEGIN
  IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema='public' AND table_name='_migration_backup_leads_pipeline'
      )
     AND EXISTS (
        SELECT 1 FROM public._migration_backup_leads_pipeline
        WHERE migration_id='20260527160000_pipe_1_2'
        LIMIT 1
      )
  THEN
    RAISE EXCEPTION 'PIPE-1.2 ABORTADA: migration_id=20260527160000_pipe_1_2 já existe no backup — migration já foi executada anteriormente. Para re-executar, drope manualmente as tabelas _migration_backup_*_pipeline ou verifique se é necessário o rollback.';
  END IF;
END $$;

-- =====================================================================
-- 1. AUDIT BACKUP TABLES — snapshot ANTES de qualquer UPDATE
-- =====================================================================

-- 1.a Backup dos leads afetados (todos que NÃO estão em "0 | Vendas")
CREATE TABLE IF NOT EXISTS public._migration_backup_leads_pipeline (
  backup_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_id           text NOT NULL DEFAULT '20260527160000_pipe_1_2',
  snapshot_taken_at      timestamptz NOT NULL DEFAULT now(),
  lead_id                uuid NOT NULL,
  old_leads_pipelines_id uuid,
  old_leads_stages_id    uuid,
  new_leads_pipelines_id uuid NOT NULL,
  new_leads_stages_id    uuid NOT NULL,
  old_status             text,
  old_updated_at         timestamptz
);

INSERT INTO public._migration_backup_leads_pipeline
  (lead_id, old_leads_pipelines_id, old_leads_stages_id,
   new_leads_pipelines_id, new_leads_stages_id,
   old_status, old_updated_at)
SELECT
  l.id,
  l.leads_pipelines_id,
  l.leads_stages_id,
  '3b5ece8e-fcb3-4dec-a4a0-b9ad8d9cadb6'::uuid AS new_pipeline_id,
  CASE l.leads_stages_id
    WHEN '2a83ef9f-5ed3-429a-8d2d-2ceb7c6a130d'::uuid THEN '6559f629-41a2-4cee-b4c7-b761bddfcf7c'::uuid  -- Interesse → Formulário
    WHEN '0f409981-3cdf-4639-b3e0-8998427c8315'::uuid THEN '6e6a95e5-61a4-46ab-903f-808530bd2e67'::uuid  -- Qualificação → Qualificação
    WHEN '4fabe472-3483-418f-aa98-c7e722bad9a8'::uuid THEN '565cb255-90ea-4b8e-bab0-9685a20e10c8'::uuid  -- Reunião Realizada → Reunião Realizada
    WHEN '60378510-df45-481e-85f4-3b497c6924df'::uuid THEN 'c9f7ca89-65f9-4bca-bc2a-4f9ec89bb039'::uuid  -- Pagamento → Link de Pagamento
    WHEN 'cbd94993-cee2-44b1-b0dd-e4ce21fc02e0'::uuid THEN 'fc8a9935-841b-4b19-8acc-f2db529e4991'::uuid  -- Em Andamento → Aluno Mentoria
    ELSE                                                  'ecffb310-d030-42c6-baf6-8989141d27ff'::uuid  -- fallback: Comentário em Post
  END AS new_stage_id,
  l.status,
  l.updated_at
FROM public.leads l
WHERE l.leads_pipelines_id IN (
  'f8aae630-649e-49c0-93c6-bd8199682410'::uuid,  -- 1 | Cursos Online
  '2bba67aa-42bd-4f7d-8dd9-6678b37c59e4'::uuid   -- 2 | Mentoria
);

-- 1.a.check — count esperado é 20 (4 Cursos Online + 16 Mentoria)
DO $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count
  FROM public._migration_backup_leads_pipeline
  WHERE migration_id = '20260527160000_pipe_1_2';
  IF v_count <> 20 THEN
    RAISE EXCEPTION 'PIPE-1.2 PRE-FLIGHT FAILED: esperados 20 leads no backup (4 Cursos Online + 16 Mentoria), encontrados %. Verifique se há leads em outras pipelines ou se a contagem em prod mudou.', v_count;
  END IF;
  RAISE NOTICE '[PIPE-1.2] PRE-FLIGHT leads count OK: % = 20 esperado', v_count;
END $$;

-- 1.b Backup do webhook "Interesse Curso Online"
CREATE TABLE IF NOT EXISTS public._migration_backup_webhooks_pipeline (
  backup_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_id       text NOT NULL DEFAULT '20260527160000_pipe_1_2',
  snapshot_taken_at  timestamptz NOT NULL DEFAULT now(),
  webhook_id         uuid NOT NULL,
  old_pipeline_id    uuid,
  old_stage_id       uuid,
  old_create_mode    text,
  new_pipeline_id    uuid NOT NULL,
  new_stage_id       uuid NOT NULL,
  new_create_mode    text NOT NULL,
  old_updated_at     timestamptz
);

INSERT INTO public._migration_backup_webhooks_pipeline
  (webhook_id, old_pipeline_id, old_stage_id, old_create_mode,
   new_pipeline_id, new_stage_id, new_create_mode, old_updated_at)
SELECT
  iw.id,
  iw.pipeline_id,
  iw.stage_id,
  iw.create_mode,
  '3b5ece8e-fcb3-4dec-a4a0-b9ad8d9cadb6'::uuid,
  '6559f629-41a2-4cee-b4c7-b761bddfcf7c'::uuid,
  'criar_se_nao_existir',
  iw.updated_at
FROM public.inbound_webhooks iw
WHERE iw.id = 'd52657ab-362a-461a-8fe9-626f1bbb5b2c'::uuid;

-- 1.c Backup do AI Agent "Mentoria — João Guirunas"
-- NOTA: pipeline_ids em ai_agents é text[] (drift original — 20260501140000_ora_schema_drift_reconcile.sql).
--       stage_ids é uuid[] (recasted pela mesma migration). Por isso os tipos abaixo
--       não são simétricos.
CREATE TABLE IF NOT EXISTS public._migration_backup_ai_agents_pipeline (
  backup_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_id       text NOT NULL DEFAULT '20260527160000_pipe_1_2',
  snapshot_taken_at  timestamptz NOT NULL DEFAULT now(),
  ai_agent_id        uuid NOT NULL,
  old_pipeline_id    uuid,
  old_pipeline_ids   text[],
  old_stage_ids      uuid[],
  new_pipeline_id    uuid NOT NULL,
  new_pipeline_ids   text[] NOT NULL,
  new_stage_ids      uuid[] NOT NULL,
  old_updated_at     timestamptz
);

INSERT INTO public._migration_backup_ai_agents_pipeline
  (ai_agent_id, old_pipeline_id, old_pipeline_ids, old_stage_ids,
   new_pipeline_id, new_pipeline_ids, new_stage_ids, old_updated_at)
SELECT
  a.id,
  a.pipeline_id,
  a.pipeline_ids,
  a.stage_ids,
  '3b5ece8e-fcb3-4dec-a4a0-b9ad8d9cadb6'::uuid,
  -- pipeline_ids é text[] (drift histórico): cast obrigatório.
  ARRAY['3b5ece8e-fcb3-4dec-a4a0-b9ad8d9cadb6']::text[],
  -- Mapeamento stage_ids (Mentoria → 0|Vendas) — stage_ids é uuid[]:
  --   64b555af-... Interesse         → 6559f629-... Formulário
  --   0f409981-... Qualificação      → 6e6a95e5-... Qualificação
  --   f5d94f4c-... Agendamento Reuniao → 565cb255-... Reunião Realizada (decisão João 2026-05-27)
  ARRAY[
    '6559f629-41a2-4cee-b4c7-b761bddfcf7c'::uuid,  -- Formulário
    '6e6a95e5-61a4-46ab-903f-808530bd2e67'::uuid,  -- Qualificação
    '565cb255-90ea-4b8e-bab0-9685a20e10c8'::uuid   -- Reunião Realizada
  ],
  a.updated_at
FROM public.ai_agents a
WHERE a.id = 'd7c97ca2-9b40-47da-a21e-99e59bd1c385'::uuid;

-- 1.d Proteger tabelas de backup contra acesso via PostgREST (authenticated/anon)
ALTER TABLE public._migration_backup_leads_pipeline     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._migration_backup_webhooks_pipeline  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._migration_backup_ai_agents_pipeline ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._migration_backup_leads_pipeline     FROM authenticated, anon;
REVOKE ALL ON public._migration_backup_webhooks_pipeline  FROM authenticated, anon;
REVOKE ALL ON public._migration_backup_ai_agents_pipeline FROM authenticated, anon;

-- Snapshot diagnóstico
DO $$
DECLARE
  v_leads     int;
  v_webhooks  int;
  v_agents    int;
BEGIN
  SELECT count(*) INTO v_leads    FROM public._migration_backup_leads_pipeline    WHERE migration_id = '20260527160000_pipe_1_2';
  SELECT count(*) INTO v_webhooks FROM public._migration_backup_webhooks_pipeline WHERE migration_id = '20260527160000_pipe_1_2';
  SELECT count(*) INTO v_agents   FROM public._migration_backup_ai_agents_pipeline WHERE migration_id = '20260527160000_pipe_1_2';
  RAISE NOTICE '[PIPE-1.2] Backup snapshot: leads=%, webhooks=%, ai_agents=%', v_leads, v_webhooks, v_agents;

  IF v_webhooks <> 1 THEN
    RAISE EXCEPTION 'PIPE-1.2 PRE-FLIGHT FAILED: expected exactly 1 webhook backup row, got %', v_webhooks;
  END IF;
  IF v_agents <> 1 THEN
    RAISE EXCEPTION 'PIPE-1.2 PRE-FLIGHT FAILED: expected exactly 1 ai_agent backup row, got %', v_agents;
  END IF;
END $$;

-- =====================================================================
-- 1.e PRE-FLIGHT WARNING — outros ai_agents/webhooks com pipeline/stage órfãos
--      Não é blocker, mas registra no log para o operador saber que outros
--      objetos continuarão apontando para pipelines/stages inativados.
--      Cast obrigatório: pipeline_ids é text[] em ai_agents; stage_ids é uuid[].
-- =====================================================================
DO $$
DECLARE
  v_orphan_agents   int;
  v_orphan_webhooks int;
BEGIN
  SELECT count(*) INTO v_orphan_agents
  FROM public.ai_agents
  WHERE id <> 'd7c97ca2-9b40-47da-a21e-99e59bd1c385'::uuid
    AND (
      pipeline_id IN (
        'f8aae630-649e-49c0-93c6-bd8199682410'::uuid,
        '2bba67aa-42bd-4f7d-8dd9-6678b37c59e4'::uuid
      )
      OR pipeline_ids && ARRAY[
        'f8aae630-649e-49c0-93c6-bd8199682410',
        '2bba67aa-42bd-4f7d-8dd9-6678b37c59e4'
      ]::text[]
      OR stage_ids && ARRAY[
        '2a83ef9f-5ed3-429a-8d2d-2ceb7c6a130d',
        '0f409981-3cdf-4639-b3e0-8998427c8315',
        '4fabe472-3483-418f-aa98-c7e722bad9a8',
        '60378510-df45-481e-85f4-3b497c6924df',
        'cbd94993-cee2-44b1-b0dd-e4ce21fc02e0',
        '64b555af-1be8-4832-8490-a43bd2c19253',
        'f5d94f4c-284b-4851-b954-e7c444b8d99f'
      ]::uuid[]
    );

  SELECT count(*) INTO v_orphan_webhooks
  FROM public.inbound_webhooks
  WHERE id <> 'd52657ab-362a-461a-8fe9-626f1bbb5b2c'::uuid
    AND pipeline_id IN (
      'f8aae630-649e-49c0-93c6-bd8199682410'::uuid,
      '2bba67aa-42bd-4f7d-8dd9-6678b37c59e4'::uuid
    );

  IF v_orphan_agents > 0 OR v_orphan_webhooks > 0 THEN
    RAISE WARNING '[PIPE-1.2] ATENÇÃO: % ai_agents e % webhooks adicionais apontam para pipelines/stages de origem (além dos tratados nesta migration). Eles continuarão funcionando mas referenciam pipelines inativas após o COMMIT.', v_orphan_agents, v_orphan_webhooks;
  END IF;
  RAISE NOTICE '[PIPE-1.2] PRE-FLIGHT orphans: % ai_agents extras, % webhooks extras', v_orphan_agents, v_orphan_webhooks;
END $$;

-- =====================================================================
-- 2. PRE-FLIGHT — sanity check: o mapeamento deve cobrir todos os stages
--    referenciados pelos leads afetados. Stages "imprevistos" caem no fallback
--    "ecffb310" (Comentário em Post). Avisamos via NOTICE quantos cairão no fallback.
-- =====================================================================
DO $$
DECLARE
  v_fallback_count int;
  v_total_dest_stages_invalid int;
BEGIN
  -- Quantos leads usarão o stage fallback (stage origem não está no mapeamento)
  SELECT count(*) INTO v_fallback_count
  FROM public._migration_backup_leads_pipeline
  WHERE migration_id   = '20260527160000_pipe_1_2'
    AND new_leads_stages_id = 'ecffb310-d030-42c6-baf6-8989141d27ff'::uuid;

  RAISE NOTICE '[PIPE-1.2] PRE-FLIGHT: % leads serão redirecionados ao stage fallback "Comentário em Post"', v_fallback_count;

  -- Sanity: todo new_leads_stages_id no backup deve pertencer ao pipeline destino "0 | Vendas"
  SELECT count(*) INTO v_total_dest_stages_invalid
  FROM public._migration_backup_leads_pipeline b
  LEFT JOIN public.leads_stages s ON s.id = b.new_leads_stages_id
  WHERE b.migration_id = '20260527160000_pipe_1_2'
    AND (s.id IS NULL OR s.leads_pipelines_id IS DISTINCT FROM '3b5ece8e-fcb3-4dec-a4a0-b9ad8d9cadb6'::uuid);

  IF v_total_dest_stages_invalid > 0 THEN
    RAISE EXCEPTION 'PIPE-1.2 PRE-FLIGHT FAILED: % leads no backup têm new_leads_stages_id que NÃO pertence ao pipeline "0 | Vendas" (3b5ece8e-...) ou não existe. Verifique mapeamento.', v_total_dest_stages_invalid;
  END IF;

  RAISE NOTICE '[PIPE-1.2] PRE-FLIGHT OK: todos os new_leads_stages_id pertencem ao pipeline destino';
END $$;

-- =====================================================================
-- 3. Desabilitar TODOS os triggers user-defined em `leads` durante a transação
--    Razão: 3 triggers user-level (`leads_changes_trigger` audit,
--    `trg_conversion_stage_enter` GA/Meta events, `on_lead_stage_changed`
--    HTTP via pg_net) disparariam em massa durante o UPDATE. Pausamos via
--    DISABLE TRIGGER USER (que NÃO afeta triggers internos do Postgres /
--    constraints, só os definidos por usuário). Reabilitamos antes do COMMIT.
-- =====================================================================
ALTER TABLE public.leads DISABLE TRIGGER USER;

-- =====================================================================
-- 4. UPDATE leads — re-aponta pipeline_id e mapeia stage_id
-- =====================================================================
UPDATE public.leads l
SET    leads_pipelines_id = b.new_leads_pipelines_id,
       leads_stages_id    = b.new_leads_stages_id,
       updated_at         = now()
FROM   public._migration_backup_leads_pipeline b
WHERE  b.migration_id = '20260527160000_pipe_1_2'
  AND  l.id           = b.lead_id;

-- Diagnóstico pós-UPDATE
DO $$
DECLARE
  v_moved int;
  v_in_target int;
BEGIN
  SELECT count(*) INTO v_moved
  FROM public._migration_backup_leads_pipeline
  WHERE migration_id = '20260527160000_pipe_1_2';

  SELECT count(*) INTO v_in_target
  FROM public.leads
  WHERE leads_pipelines_id = '3b5ece8e-fcb3-4dec-a4a0-b9ad8d9cadb6'::uuid;

  RAISE NOTICE '[PIPE-1.2] UPDATE leads: % linhas atualizadas; total agora em "0 | Vendas" = %', v_moved, v_in_target;
END $$;

-- =====================================================================
-- 5. UPDATE inbound_webhooks — webhook "Interesse Curso Online"
-- =====================================================================
UPDATE public.inbound_webhooks iw
SET    pipeline_id  = '3b5ece8e-fcb3-4dec-a4a0-b9ad8d9cadb6'::uuid,
       stage_id     = '6559f629-41a2-4cee-b4c7-b761bddfcf7c'::uuid,
       create_mode  = 'criar_se_nao_existir',
       updated_at   = now()
WHERE  iw.id = 'd52657ab-362a-461a-8fe9-626f1bbb5b2c'::uuid;

DO $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.inbound_webhooks
  WHERE id = 'd52657ab-362a-461a-8fe9-626f1bbb5b2c'::uuid
    AND pipeline_id = '3b5ece8e-fcb3-4dec-a4a0-b9ad8d9cadb6'::uuid
    AND stage_id    = '6559f629-41a2-4cee-b4c7-b761bddfcf7c'::uuid
    AND create_mode = 'criar_se_nao_existir';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'PIPE-1.2 webhook UPDATE FAILED — expected 1 row matching target state, got %', v_count;
  END IF;
  RAISE NOTICE '[PIPE-1.2] inbound_webhook d52657ab-... repointado para "0 | Vendas"/Formulário, create_mode=criar_se_nao_existir';
END $$;

-- =====================================================================
-- 6. UPDATE ai_agents — agent "Mentoria — João Guirunas"
--    Atualiza: pipeline_id, pipeline_ids (array), stage_ids (array)
--    stage_ids mapping (Mentoria → 0|Vendas, decisão João 2026-05-27):
--      64b555af-... Interesse          → 6559f629-... Formulário
--      0f409981-... Qualificação       → 6e6a95e5-... Qualificação
--      f5d94f4c-... Agendamento Reuniao → 565cb255-... Reunião Realizada
-- =====================================================================
UPDATE public.ai_agents a
SET    pipeline_id  = b.new_pipeline_id,
       pipeline_ids = b.new_pipeline_ids,
       stage_ids    = b.new_stage_ids,
       updated_at   = now()
FROM   public._migration_backup_ai_agents_pipeline b
WHERE  b.migration_id = '20260527160000_pipe_1_2'
  AND  a.id           = b.ai_agent_id;

DO $$
DECLARE v_count int;
BEGIN
  -- pipeline_ids é text[] (drift histórico): comparação como text.
  -- stage_ids é uuid[]: comparação como uuid.
  SELECT count(*) INTO v_count
  FROM public.ai_agents
  WHERE id = 'd7c97ca2-9b40-47da-a21e-99e59bd1c385'::uuid
    AND pipeline_id  = '3b5ece8e-fcb3-4dec-a4a0-b9ad8d9cadb6'::uuid
    AND '3b5ece8e-fcb3-4dec-a4a0-b9ad8d9cadb6'::text = ANY(pipeline_ids)
    AND '6559f629-41a2-4cee-b4c7-b761bddfcf7c'::uuid = ANY(stage_ids)
    AND '6e6a95e5-61a4-46ab-903f-808530bd2e67'::uuid = ANY(stage_ids)
    AND '565cb255-90ea-4b8e-bab0-9685a20e10c8'::uuid = ANY(stage_ids);
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'PIPE-1.2 ai_agent UPDATE FAILED — expected 1 row matching target state (pipeline_id + pipeline_ids + stage_ids), got %', v_count;
  END IF;
  RAISE NOTICE '[PIPE-1.2] ai_agent d7c97ca2-... repointado para "0 | Vendas" (pipeline_id + pipeline_ids + stage_ids)';
END $$;

-- =====================================================================
-- 7. POST-MOVE INTEGRITY CHECKS — devem retornar 0; senão, transação aborta
-- =====================================================================

-- 7.a Nenhum lead pode ter pipeline ≠ "0 | Vendas"
DO $$
DECLARE v_orphans int;
BEGIN
  SELECT count(*) INTO v_orphans
  FROM public.leads
  WHERE leads_pipelines_id IS DISTINCT FROM '3b5ece8e-fcb3-4dec-a4a0-b9ad8d9cadb6'::uuid;
  IF v_orphans > 0 THEN
    RAISE EXCEPTION 'PIPE-1.2 POST-MOVE CHECK FAILED: % leads ainda fora do pipeline "0 | Vendas"', v_orphans;
  END IF;
  RAISE NOTICE '[PIPE-1.2] POST-MOVE 7.a OK — 0 leads fora de "0 | Vendas"';
END $$;

-- 7.b Nenhum lead pode ter stage_id que NÃO pertence a "0 | Vendas"
DO $$
DECLARE v_mismatch int;
BEGIN
  SELECT count(*) INTO v_mismatch
  FROM public.leads l
  JOIN public.leads_stages s ON s.id = l.leads_stages_id
  WHERE s.leads_pipelines_id IS DISTINCT FROM '3b5ece8e-fcb3-4dec-a4a0-b9ad8d9cadb6'::uuid;
  IF v_mismatch > 0 THEN
    RAISE EXCEPTION 'PIPE-1.2 POST-MOVE CHECK FAILED: % leads com stage_id que pertence a outro pipeline', v_mismatch;
  END IF;
  RAISE NOTICE '[PIPE-1.2] POST-MOVE 7.b OK — todos os leads.stage pertencem a "0 | Vendas"';
END $$;

-- 7.c Nenhuma colisão (people_id, pipeline_id) com status ativo — Zero esperado
DO $$
DECLARE v_dups int;
BEGIN
  SELECT count(*) INTO v_dups FROM (
    SELECT people_id
    FROM public.leads
    WHERE people_id IS NOT NULL
      AND leads_pipelines_id = '3b5ece8e-fcb3-4dec-a4a0-b9ad8d9cadb6'::uuid
      AND status NOT IN ('won','lost','archived')
    GROUP BY people_id
    HAVING count(*) > 1
  ) s;
  IF v_dups > 0 THEN
    RAISE EXCEPTION 'PIPE-1.2 POST-MOVE CHECK FAILED: % pessoas com >1 lead ATIVO em "0 | Vendas" — verifique decisão de colisão', v_dups;
  END IF;
  RAISE NOTICE '[PIPE-1.2] POST-MOVE 7.c OK — 0 colisões ativas em "0 | Vendas"';
END $$;

-- =====================================================================
-- 8. INATIVAR PIPELINES DE ORIGEM (active = false — NÃO DELETE)
-- =====================================================================
UPDATE public.leads_pipelines lp
SET    active = false,
       updated_at = now()
WHERE  lp.id IN (
         'f8aae630-649e-49c0-93c6-bd8199682410'::uuid,  -- 1 | Cursos Online
         '2bba67aa-42bd-4f7d-8dd9-6678b37c59e4'::uuid   -- 2 | Mentoria
       )
  AND  lp.active = true;

DO $$
DECLARE v_inactive int;
BEGIN
  SELECT count(*) INTO v_inactive
  FROM public.leads_pipelines
  WHERE id IN (
          'f8aae630-649e-49c0-93c6-bd8199682410'::uuid,
          '2bba67aa-42bd-4f7d-8dd9-6678b37c59e4'::uuid
        )
    AND active = false;
  IF v_inactive <> 2 THEN
    RAISE EXCEPTION 'PIPE-1.2 INATIVATE CHECK FAILED: expected 2 inactive source pipelines, got %', v_inactive;
  END IF;
  RAISE NOTICE '[PIPE-1.2] Pipelines de origem inativadas: 1|Cursos Online + 2|Mentoria';
END $$;

-- =====================================================================
-- 9. REABILITAR todos os triggers user-defined em `leads`
-- =====================================================================
ALTER TABLE public.leads ENABLE TRIGGER USER;

-- =====================================================================
-- 10. SUMMARY FINAL
-- =====================================================================
DO $$
DECLARE
  v_total           int;
  v_in_target       int;
  v_backup_leads    int;
  v_backup_webhooks int;
  v_backup_agents   int;
BEGIN
  SELECT count(*) INTO v_total           FROM public.leads;
  SELECT count(*) INTO v_in_target       FROM public.leads WHERE leads_pipelines_id = '3b5ece8e-fcb3-4dec-a4a0-b9ad8d9cadb6'::uuid;
  SELECT count(*) INTO v_backup_leads    FROM public._migration_backup_leads_pipeline    WHERE migration_id = '20260527160000_pipe_1_2';
  SELECT count(*) INTO v_backup_webhooks FROM public._migration_backup_webhooks_pipeline WHERE migration_id = '20260527160000_pipe_1_2';
  SELECT count(*) INTO v_backup_agents   FROM public._migration_backup_ai_agents_pipeline WHERE migration_id = '20260527160000_pipe_1_2';

  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  RAISE NOTICE '[PIPE-1.2] MIGRATION SUMMARY';
  RAISE NOTICE '  total leads no sistema:       %', v_total;
  RAISE NOTICE '  leads agora em "0 | Vendas":  % (deve == total)', v_in_target;
  RAISE NOTICE '  leads movidos (backup):       % (esperado 20: 4 + 16)', v_backup_leads;
  RAISE NOTICE '  webhooks repointados:         % (esperado 1)', v_backup_webhooks;
  RAISE NOTICE '  ai_agents repointados:        % (esperado 1)', v_backup_agents;
  RAISE NOTICE '  pipelines inativadas:         2 (1|Cursos Online + 2|Mentoria)';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';

  IF v_total <> v_in_target THEN
    RAISE EXCEPTION 'PIPE-1.2 FINAL CHECK FAILED: total leads (%) != leads em "0 | Vendas" (%)', v_total, v_in_target;
  END IF;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- Expected affected rows (smoke test pós-COMMIT):
--   leads:             20 (4 de "1 | Cursos Online" + 16 de "2 | Mentoria")
--   inbound_webhooks:   1 (id d52657ab-362a-461a-8fe9-626f1bbb5b2c)
--   ai_agents:          1 (id d7c97ca2-9b40-47da-a21e-99e59bd1c385)
--   leads_pipelines:    2 (active false em f8aae630-... e 2bba67aa-...)
--
-- Audit backup tables persistem (NÃO drop). Rollback usa:
--   supabase/migrations/rollbacks/20260527160000_pipe_1_2_consolidate_pipelines.rollback.sql
-- ═══════════════════════════════════════════════════════════════════
