-- ============================================================
-- Booking Distribution — Rule Sets & Rules
-- ============================================================

-- booking_rule_sets — Named rule set configurations
CREATE TABLE IF NOT EXISTS public.booking_rule_sets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  description TEXT,
  is_default  BOOLEAN     NOT NULL DEFAULT false,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- booking_rules — Individual rules within a set (ordered)
CREATE TABLE IF NOT EXISTS public.booking_rules (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_id  UUID        NOT NULL REFERENCES public.booking_rule_sets(id) ON DELETE CASCADE,
  order_index  INTEGER     NOT NULL DEFAULT 0,
  rule_type    TEXT        NOT NULL,
  config       JSONB       NOT NULL DEFAULT '{}',
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT booking_rules_rule_type_check CHECK (
    rule_type IN ('team_priority', 'random', 'least_busy', 'specific_user', 'round_robin')
  )
);

CREATE INDEX IF NOT EXISTS idx_booking_rules_rule_set_id
  ON public.booking_rules(rule_set_id);

CREATE INDEX IF NOT EXISTS idx_booking_rule_sets_is_default
  ON public.booking_rule_sets(is_default) WHERE is_default = true;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.booking_rule_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_rules     ENABLE ROW LEVEL SECURITY;

-- Policies — idempotent via exception handlers
DO $$
BEGIN
  -- booking_rule_sets: authenticated full access
  BEGIN
    CREATE POLICY "booking_rule_sets_auth_all"
      ON public.booking_rule_sets FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.settings_users
          WHERE auth_user_id = auth.uid() AND is_active = true
        )
      );
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- booking_rules: authenticated full access
  BEGIN
    CREATE POLICY "booking_rules_auth_all"
      ON public.booking_rules FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.settings_users
          WHERE auth_user_id = auth.uid() AND is_active = true
        )
      );
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- booking_rule_sets: anon read-only
  BEGIN
    CREATE POLICY "booking_rule_sets_anon_read"
      ON public.booking_rule_sets FOR SELECT
      TO anon
      USING (is_active = true);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- booking_rules: anon read-only
  BEGIN
    CREATE POLICY "booking_rules_anon_read"
      ON public.booking_rules FOR SELECT
      TO anon
      USING (
        EXISTS (
          SELECT 1 FROM public.booking_rule_sets
          WHERE id = booking_rules.rule_set_id AND is_active = true
        )
      );
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ============================================================
-- Seed: default rule set
-- ============================================================
DO $$
DECLARE v_set_id UUID;
BEGIN
  -- Only seed if no default rule set exists yet
  IF NOT EXISTS (SELECT 1 FROM public.booking_rule_sets WHERE is_default = true) THEN
    INSERT INTO public.booking_rule_sets (name, description, is_default, is_active)
    VALUES (
      'Padrão',
      'Equipes por prioridade → menos ocupado em 7 dias → aleatório',
      true, true
    )
    RETURNING id INTO v_set_id;

    INSERT INTO public.booking_rules (rule_set_id, order_index, rule_type, config) VALUES
      (v_set_id, 1, 'team_priority', '{"team_ids": []}'),
      (v_set_id, 2, 'least_busy',    '{"days_lookback": 7}'),
      (v_set_id, 3, 'random',        '{}');
  END IF;
END $$;
