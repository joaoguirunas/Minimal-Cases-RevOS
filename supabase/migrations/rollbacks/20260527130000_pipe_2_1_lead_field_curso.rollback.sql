-- Rollback for: 20260527130000_pipe_2_1_lead_field_curso.sql
-- Tested-against: pg15
-- ⚠️  IMPORTANTE: este rollback APAGA também os valores associados em
--    lead_field_values (via FK ON DELETE CASCADE definido em lead_field_definitions(id)).
--    Use apenas se nenhum lead foi qualificado com o campo Curso ainda,
--    ou aceite a perda de dados.

BEGIN;

-- Guarda: só apaga se a row foi criada exatamente pela migration (config canônica)
-- e se não houver valores persistidos (segurança extra contra perda de dados em produção).
DO $$
DECLARE
  v_def_id uuid;
  v_value_count int;
BEGIN
  SELECT id INTO v_def_id
  FROM public.lead_field_definitions
  WHERE key = 'curso'
    AND entity_type = 'pessoa'
    AND pipeline_id IS NULL;

  IF v_def_id IS NULL THEN
    RAISE NOTICE 'PIPE-2.1 rollback: row já ausente, nada a fazer';
    RETURN;
  END IF;

  SELECT count(*) INTO v_value_count
  FROM public.lead_field_values
  WHERE field_definition_id = v_def_id;

  IF v_value_count > 0 THEN
    RAISE EXCEPTION 'PIPE-2.1 rollback abortado: % valores existentes em lead_field_values. Apague manualmente se desejar prosseguir.', v_value_count;
  END IF;

  DELETE FROM public.lead_field_definitions WHERE id = v_def_id;
  RAISE NOTICE 'PIPE-2.1 rollback: row curso/pessoa removida (id=%)', v_def_id;
END $$;

COMMIT;
