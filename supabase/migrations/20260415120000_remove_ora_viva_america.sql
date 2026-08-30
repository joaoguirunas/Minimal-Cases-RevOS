-- ================================================================
-- MIGRATION: 20260415120000_remove_ora_viva_america.sql
-- JOB-034 — Remove clientes Ora e Viva América do control plane
--
-- Clientes removidos:
--   • Ora          — slug='ora',          supabase_ref='gkvnotsebzjbwiskwnjr'
--   • Viva América — slug='vivaamerica',  supabase_ref='tipahegkywzgrzheckou'
--
-- Ordem de deleção (respeito a FKs):
--   1. adm_migration_runs  — client_id sem FK formal; deleção manual obrigatória
--   2. adm_sync_logs       — FK → adm_sync_jobs (CASCADE), explicitado para auditoria
--   3. adm_sync_jobs       — FK → adm_clients (CASCADE), explicitado para auditoria
--   4. adm_clients         — registro principal
--
-- Banco alvo: control plane ohzwetkaazgxafubzvop
-- Autor: R2-D2 (data-engineer) — JOB-034 — 2026-04-15
-- ================================================================

BEGIN;

DO $$
DECLARE
  v_ids          UUID[];
  v_ora_id       UUID;
  v_viva_id      UUID;
  v_count        INT;
BEGIN

  -- ──────────────────────────────────────────────────────────────
  -- 0. Resolve IDs — dupla verificação: slug + supabase_url
  --    Garante que nunca deletamos o cliente errado
  -- ──────────────────────────────────────────────────────────────
  SELECT id INTO v_ora_id
    FROM public.adm_clients
   WHERE slug = 'ora'
     AND supabase_url LIKE '%gkvnotsebzjbwiskwnjr%';

  SELECT id INTO v_viva_id
    FROM public.adm_clients
   WHERE slug = 'vivaamerica'
     AND supabase_url LIKE '%tipahegkywzgrzheckou%';

  IF v_ora_id IS NULL THEN
    RAISE NOTICE '[JOB-034] Cliente "ora" (gkvnotsebzjbwiskwnjr) não encontrado — sem ação.';
  ELSE
    RAISE NOTICE '[JOB-034] Ora localizado: id=%', v_ora_id;
  END IF;

  IF v_viva_id IS NULL THEN
    RAISE NOTICE '[JOB-034] Cliente "vivaamerica" (tipahegkywzgrzheckou) não encontrado — sem ação.';
  ELSE
    RAISE NOTICE '[JOB-034] Viva América localizado: id=%', v_viva_id;
  END IF;

  -- Monta array compacto com apenas os IDs encontrados
  v_ids := ARRAY_REMOVE(ARRAY[v_ora_id, v_viva_id], NULL);

  IF array_length(v_ids, 1) IS NULL THEN
    RAISE NOTICE '[JOB-034] Nenhum cliente encontrado. Migration encerrada sem alterações.';
    RETURN;
  END IF;

  -- ──────────────────────────────────────────────────────────────
  -- 1. adm_migration_runs
  --    Sem FK formal para adm_clients — deleção manual obrigatória
  -- ──────────────────────────────────────────────────────────────
  DELETE FROM public.adm_migration_runs
   WHERE client_id = ANY(v_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '[JOB-034] adm_migration_runs: % linha(s) removida(s).', v_count;

  -- ──────────────────────────────────────────────────────────────
  -- 2. adm_sync_logs
  --    FK: adm_sync_logs.job_id → adm_sync_jobs.id ON DELETE CASCADE
  --    Explicitado aqui para rastreabilidade de auditoria
  -- ──────────────────────────────────────────────────────────────
  DELETE FROM public.adm_sync_logs
   WHERE job_id IN (
     SELECT id FROM public.adm_sync_jobs
      WHERE client_id = ANY(v_ids)
   );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '[JOB-034] adm_sync_logs: % linha(s) removida(s).', v_count;

  -- ──────────────────────────────────────────────────────────────
  -- 3. adm_sync_jobs
  --    FK: adm_sync_jobs.client_id → adm_clients.id ON DELETE CASCADE
  --    Explicitado aqui para rastreabilidade de auditoria
  -- ──────────────────────────────────────────────────────────────
  DELETE FROM public.adm_sync_jobs
   WHERE client_id = ANY(v_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '[JOB-034] adm_sync_jobs: % linha(s) removida(s).', v_count;

  -- ──────────────────────────────────────────────────────────────
  -- 4. adm_clients — registro principal
  --    Usa os IDs resolvidos na etapa 0 para máxima segurança
  -- ──────────────────────────────────────────────────────────────
  DELETE FROM public.adm_clients
   WHERE id = ANY(v_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '[JOB-034] adm_clients: % linha(s) removida(s).', v_count;

  RAISE NOTICE '[JOB-034] Migration concluída com sucesso.';

END;
$$;

COMMIT;
