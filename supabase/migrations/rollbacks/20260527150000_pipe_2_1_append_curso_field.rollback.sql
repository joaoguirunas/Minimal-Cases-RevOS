-- Rollback for: 20260527150000_pipe_2_1_append_curso_field.sql
-- Tested-against: pg15
-- ⚠️  Reverter remove a RPC append_crm_field_value. Garanta que NENHUM caller
--    (edge function, n8n, RPC client) esteja chamando-a antes de rodar este
--    rollback — chamadas pendentes passarão a falhar com "function does not exist".

BEGIN;

-- Idempotente: DROP IF EXISTS evita falhar se já removida.
DROP FUNCTION IF EXISTS public.append_crm_field_value(uuid, text, text);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'append_crm_field_value'
  ) THEN
    RAISE EXCEPTION 'PIPE-2.1 rollback: append_crm_field_value ainda presente — DROP falhou';
  END IF;
  RAISE NOTICE 'PIPE-2.1 rollback: append_crm_field_value removida';
END $$;

COMMIT;
