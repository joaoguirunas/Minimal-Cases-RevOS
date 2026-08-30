-- Rollback for: 20260527140000_pipe_3_1_dedup_constraints.sql
-- Tested-against: pg15
-- Reverte: 4 unique indexes + default de inbound_webhooks.create_mode.
-- Não restaura rows duplicadas que tenham sido bloqueadas pela constraint
-- entre a aplicação da migration e o rollback (esses inserts já falharam no client).

BEGIN;

-- 1) DROP unique indexes (não toca dados)
DROP INDEX IF EXISTS public.idx_clients_people_email_unique;
DROP INDEX IF EXISTS public.idx_clients_people_whatsapp_unique;
DROP INDEX IF EXISTS public.idx_leads_people_pipeline_active_unique;
DROP INDEX IF EXISTS public.idx_form_pro_submissions_meta_leadgen_unique;

-- 2) Revert default de inbound_webhooks.create_mode → 'criar' (estado anterior à PIPE-3.1)
ALTER TABLE public.inbound_webhooks
  ALTER COLUMN create_mode SET DEFAULT 'criar';

COMMENT ON COLUMN public.inbound_webhooks.create_mode IS
  'Controla comportamento ao receber payload: criar | criar_se_nao_existir | atualizar_etapa | somente_etapa';

-- 3) Verificação informacional
DO $$
DECLARE
  v_remaining int;
  v_default text;
BEGIN
  SELECT count(*) INTO v_remaining
  FROM pg_indexes
  WHERE indexname IN (
    'idx_clients_people_email_unique',
    'idx_clients_people_whatsapp_unique',
    'idx_leads_people_pipeline_active_unique',
    'idx_form_pro_submissions_meta_leadgen_unique'
  );

  SELECT column_default INTO v_default
  FROM information_schema.columns
  WHERE table_schema='public'
    AND table_name='inbound_webhooks'
    AND column_name='create_mode';

  IF v_remaining <> 0 THEN
    RAISE WARNING 'PIPE-3.1 rollback warning: % index(es) still present', v_remaining;
  END IF;

  RAISE NOTICE 'PIPE-3.1 rollback complete — create_mode default = %', v_default;
END $$;

COMMIT;
