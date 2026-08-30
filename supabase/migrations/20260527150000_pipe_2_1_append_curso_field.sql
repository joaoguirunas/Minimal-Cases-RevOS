-- ═══════════════════════════════════════════════════════════════════
-- 20260527150000_pipe_2_1_append_curso_field.sql
-- Brief: RPC append_crm_field_value — concat atômico em lead_field_values.value_text
--        para custom fields onde o histórico precisa ser preservado entre re-submissions
--        (caso de uso primário: campo "curso", Story PIPE-2.1).
--
-- Diferença vs upsert_crm_field_value (existente):
--   - upsert_*  : DO UPDATE SET value_text = EXCLUDED.value_text   → SOBRESCREVE
--   - append_*  : se já existe valor, faz token-aware concat com '; '. Idempotente.
--
-- Concorrência:
--   Webhooks chegam em paralelo. Sem lock, dois INSERTs disputam o UNIQUE
--   (entity_type, entity_id, field_definition_id) — o perdedor cai no ON CONFLICT
--   DO UPDATE, mas a leitura de value_text dentro da função fica stale entre o
--   SELECT e o UPDATE (lost update). Solução: pg_advisory_xact_lock com hash de
--   (entity_id, field_definition_id), released no COMMIT da transação que envolve
--   a chamada. Bloqueio só serializa concorrência sobre a MESMA (pessoa, campo) —
--   nenhuma contenção para escritas em pessoas/campos diferentes.
--
-- Decisão de design:
--   - Hardcoded entity_type='pessoa' (mesma restrição do upsert_crm_field_value
--     atual; webhooks só persistem custom fields em pessoa).
--   - Dedup case-insensitive + trim por token (split ';'). Stored tokens preservam
--     casing original do primeiro insert de cada valor.
--   - Separator: '; ' (espaço após ponto-e-vírgula).
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.append_crm_field_value(
  p_person_id  uuid,
  p_field_key  text,
  p_new_value  text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_definition_id uuid;
  v_current_value text;
  v_trimmed_new   text;
  v_needle        text;
  v_already       boolean;
  v_next_value    text;
  v_lock_key      bigint;
BEGIN
  -- Normalize input early
  v_trimmed_new := btrim(coalesce(p_new_value, ''));
  IF v_trimmed_new = '' THEN
    -- Nothing to append; preserve existing state silently.
    RETURN;
  END IF;

  -- Resolve definition (hardcoded entity_type='pessoa' — mirrors upsert_*)
  SELECT id INTO v_definition_id
  FROM public.lead_field_definitions
  WHERE key = p_field_key
    AND entity_type = 'pessoa'
    AND active = true
  LIMIT 1;

  IF v_definition_id IS NULL THEN
    RAISE WARNING 'append_crm_field_value: field_key "%" not found (entity_type=pessoa, active=true)', p_field_key;
    RETURN;
  END IF;

  -- Serialize writes for the same (person, definition) within this txn.
  -- pg_advisory_xact_lock(bigint) — released on COMMIT/ROLLBACK automatically.
  -- hashtextextended (PG13+) returns deterministic bigint; seed=0 for stability.
  -- Contention is scoped to the SAME (person, field) — no impact across
  -- different persons or different fields.
  v_lock_key := hashtextextended(p_person_id::text || '|' || v_definition_id::text, 0);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Read current value AFTER acquiring the lock.
  SELECT value_text INTO v_current_value
  FROM public.lead_field_values
  WHERE entity_type = 'pessoa'
    AND entity_id = p_person_id
    AND field_definition_id = v_definition_id;

  IF v_current_value IS NULL OR btrim(v_current_value) = '' THEN
    -- No prior value → set as-is (trimmed).
    v_next_value := v_trimmed_new;
  ELSE
    -- Token-aware dedup: split current by ';', trim each, compare case-insensitive.
    -- POSIX class [[:space:]] avoids escape ambiguity vs. \s in standard strings.
    v_needle := lower(v_trimmed_new);
    SELECT EXISTS (
      SELECT 1
      FROM regexp_split_to_table(v_current_value, '[[:space:]]*;[[:space:]]*') AS token
      WHERE lower(btrim(token)) = v_needle
        AND btrim(token) <> ''
    ) INTO v_already;

    IF v_already THEN
      -- Idempotent: value already present, no write needed.
      RETURN;
    END IF;

    v_next_value := btrim(v_current_value) || '; ' || v_trimmed_new;
  END IF;

  -- Persist (INSERT-or-UPDATE). Same unique constraint as upsert_*.
  INSERT INTO public.lead_field_values (
    entity_type, entity_id, field_definition_id, value_text
  )
  VALUES ('pessoa', p_person_id, v_definition_id, v_next_value)
  ON CONFLICT ON CONSTRAINT lead_field_values_entity_def_uniq
  DO UPDATE SET value_text = EXCLUDED.value_text, updated_at = now();
END;
$$;

COMMENT ON FUNCTION public.append_crm_field_value(uuid, text, text) IS
  'PIPE-2.1: token-aware append (separator=''; '') with case-insensitive dedup. '
  'Used by crm-mapper.persistCustomFields for fields that must preserve history '
  '(currently: ''curso''). Atomic via pg_advisory_xact_lock on (person_id, def_id).';

-- Grant matches existing upsert_crm_field_value pattern.
-- (Both functions are SECURITY DEFINER; service_role calls them from edge functions.)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.append_crm_field_value(uuid, text, text) TO service_role';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.append_crm_field_value(uuid, text, text) TO authenticated';
  END IF;
END $$;

-- Smoke check (informational): confirm function is callable post-deploy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'append_crm_field_value'
  ) THEN
    RAISE EXCEPTION 'PIPE-2.1: append_crm_field_value não foi criada — abortando';
  END IF;
  RAISE NOTICE 'PIPE-2.1: append_crm_field_value criada com sucesso';
END $$;

COMMIT;
