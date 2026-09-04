-- ESTEIRA-AB — Teste A/B de esteira completa.
-- experimento por pipeline · variantes com peso · regra comum (ab_variant_id NULL) ou por variante
-- · atribuição determinística por pessoa (assign_esteira_variant) · fila/links/reconversões carregam a variante.
BEGIN;

CREATE TABLE IF NOT EXISTS public.esteira_ab_experiments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id       uuid NOT NULL REFERENCES public.leads_pipelines(id) ON DELETE CASCADE,
  name              text NOT NULL,
  hypothesis        text,
  status            text NOT NULL DEFAULT 'draft',
  started_at        timestamptz,
  paused_at         timestamptz,
  finished_at       timestamptz,
  winner_variant_id uuid,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'esteira_ab_experiments_status_check') THEN
    ALTER TABLE public.esteira_ab_experiments ADD CONSTRAINT esteira_ab_experiments_status_check
      CHECK (status IN ('draft','running','paused','finished'));
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS esteira_ab_one_live_per_pipeline
  ON public.esteira_ab_experiments (pipeline_id) WHERE status IN ('running','paused');
COMMENT ON TABLE public.esteira_ab_experiments IS 'Teste A/B da esteira: um experimento running|paused por pipeline. Regras com ab_variant_id NULL são comuns a todas as variantes.';

CREATE TABLE IF NOT EXISTS public.esteira_ab_variants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES public.esteira_ab_experiments(id) ON DELETE CASCADE,
  key           text NOT NULL,
  name          text NOT NULL,
  weight        integer NOT NULL DEFAULT 50,
  is_control    boolean NOT NULL DEFAULT false,
  position      integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (experiment_id, key)
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'esteira_ab_variants_key_check') THEN
    ALTER TABLE public.esteira_ab_variants ADD CONSTRAINT esteira_ab_variants_key_check CHECK (key ~ '^[A-Z]$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'esteira_ab_variants_weight_check') THEN
    ALTER TABLE public.esteira_ab_variants ADD CONSTRAINT esteira_ab_variants_weight_check CHECK (weight BETWEEN 0 AND 100);
  END IF;
END $$;

ALTER TABLE public.leads_stages_followups
  ADD COLUMN IF NOT EXISTS ab_variant_id uuid REFERENCES public.esteira_ab_variants(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.leads_stages_followups.ab_variant_id IS 'NULL = regra comum (dispara pra todo mundo). Preenchido = só dispara pra leads atribuídos a esta variante.';
CREATE INDEX IF NOT EXISTS leads_stages_followups_ab_idx ON public.leads_stages_followups (ab_variant_id) WHERE ab_variant_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.esteira_ab_assignments (
  lead_id       uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  experiment_id uuid NOT NULL REFERENCES public.esteira_ab_experiments(id) ON DELETE CASCADE,
  variant_id    uuid NOT NULL REFERENCES public.esteira_ab_variants(id) ON DELETE CASCADE,
  people_id     uuid,
  bucket        integer NOT NULL,
  assigned_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lead_id, experiment_id)
);
CREATE INDEX IF NOT EXISTS esteira_ab_assignments_exp_var_idx ON public.esteira_ab_assignments (experiment_id, variant_id);
CREATE INDEX IF NOT EXISTS esteira_ab_assignments_people_idx  ON public.esteira_ab_assignments (people_id) WHERE people_id IS NOT NULL;

ALTER TABLE public.followup_queue        ADD COLUMN IF NOT EXISTS ab_variant_id uuid;
ALTER TABLE public.tracked_links         ADD COLUMN IF NOT EXISTS ab_variant_id uuid;
ALTER TABLE public.esteira_reconversions ADD COLUMN IF NOT EXISTS ab_experiment_id uuid, ADD COLUMN IF NOT EXISTS ab_variant_id uuid;
CREATE INDEX IF NOT EXISTS followup_queue_ab_idx        ON public.followup_queue (ab_variant_id) WHERE ab_variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tracked_links_ab_idx         ON public.tracked_links (ab_variant_id) WHERE ab_variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS esteira_reconversions_ab_idx ON public.esteira_reconversions (ab_experiment_id) WHERE ab_experiment_id IS NOT NULL;

-- ── Atribuição determinística (única fonte da verdade; chamada pelos dois enfileiradores) ──
CREATE OR REPLACE FUNCTION public.assign_esteira_variant(p_lead_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_pipeline uuid; v_people uuid; v_exp uuid; v_existing uuid; v_bucket int; v_acc int := 0; v_variant uuid; r record;
BEGIN
  SELECT leads_pipelines_id, people_id INTO v_pipeline, v_people FROM public.leads WHERE id = p_lead_id;
  IF v_pipeline IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO v_exp FROM public.esteira_ab_experiments WHERE pipeline_id = v_pipeline AND status = 'running' LIMIT 1;
  IF v_exp IS NULL THEN RETURN NULL; END IF;

  SELECT variant_id INTO v_existing FROM public.esteira_ab_assignments WHERE lead_id = p_lead_id AND experiment_id = v_exp;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  -- mesma pessoa no mesmo experimento → mesma variante
  IF v_people IS NOT NULL THEN
    SELECT variant_id INTO v_existing FROM public.esteira_ab_assignments
     WHERE people_id = v_people AND experiment_id = v_exp ORDER BY assigned_at LIMIT 1;
  END IF;

  v_bucket := (('x' || substr(md5(v_exp::text || ':' || coalesce(v_people::text, p_lead_id::text)), 1, 6))::bit(24)::int) % 10000;

  IF v_existing IS NOT NULL THEN
    v_variant := v_existing;
  ELSE
    FOR r IN SELECT id, weight FROM public.esteira_ab_variants WHERE experiment_id = v_exp ORDER BY position, key LOOP
      v_acc := v_acc + r.weight * 100;
      IF v_bucket < v_acc THEN v_variant := r.id; EXIT; END IF;
    END LOOP;
    IF v_variant IS NULL THEN
      SELECT id INTO v_variant FROM public.esteira_ab_variants WHERE experiment_id = v_exp ORDER BY position, key LIMIT 1;
    END IF;
  END IF;
  IF v_variant IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.esteira_ab_assignments (lead_id, experiment_id, variant_id, people_id, bucket)
  VALUES (p_lead_id, v_exp, v_variant, v_people, v_bucket)
  ON CONFLICT (lead_id, experiment_id) DO NOTHING;
  RETURN v_variant;
END $fn$;
REVOKE ALL ON FUNCTION public.assign_esteira_variant(uuid) FROM PUBLIC, anon, authenticated;

-- ── Encerramento ──
CREATE OR REPLACE FUNCTION public.promote_ab_winner(p_experiment_id uuid, p_winner uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF auth.role() <> 'service_role' AND NOT EXISTS (
       SELECT 1 FROM public.settings_users su
        WHERE su.auth_user_id = auth.uid() AND su.active = true AND su.deleted_at IS NULL
          AND (su.super_admin = true OR su.user_type = 'manager'))
  THEN RAISE EXCEPTION 'sem permissão para encerrar experimentos'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.esteira_ab_experiments WHERE id = p_experiment_id AND status IN ('running','paused')) THEN
    RAISE EXCEPTION 'experimento % não existe ou não está em andamento', p_experiment_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.esteira_ab_variants WHERE id = p_winner AND experiment_id = p_experiment_id) THEN
    RAISE EXCEPTION 'variante % não pertence ao experimento %', p_winner, p_experiment_id;
  END IF;
  UPDATE public.leads_stages_followups SET ab_variant_id = NULL, updated_at = now() WHERE ab_variant_id = p_winner;
  UPDATE public.leads_stages_followups SET active = false, updated_at = now()
   WHERE ab_variant_id IN (SELECT id FROM public.esteira_ab_variants WHERE experiment_id = p_experiment_id AND id <> p_winner);
  UPDATE public.esteira_ab_experiments SET status = 'finished', winner_variant_id = p_winner, finished_at = now(), updated_at = now()
   WHERE id = p_experiment_id;
END $fn$;

CREATE OR REPLACE FUNCTION public.finish_ab_experiment(p_experiment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF auth.role() <> 'service_role' AND NOT EXISTS (
       SELECT 1 FROM public.settings_users su
        WHERE su.auth_user_id = auth.uid() AND su.active = true AND su.deleted_at IS NULL
          AND (su.super_admin = true OR su.user_type = 'manager'))
  THEN RAISE EXCEPTION 'sem permissão para encerrar experimentos'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.esteira_ab_experiments WHERE id = p_experiment_id AND status IN ('running','paused')) THEN
    RAISE EXCEPTION 'experimento % não existe ou não está em andamento', p_experiment_id;
  END IF;
  UPDATE public.leads_stages_followups SET active = false, updated_at = now()
   WHERE ab_variant_id IN (SELECT id FROM public.esteira_ab_variants WHERE experiment_id = p_experiment_id);
  UPDATE public.esteira_ab_experiments SET status = 'finished', finished_at = now(), updated_at = now() WHERE id = p_experiment_id;
END $fn$;
-- managers podem chamar as duas (RLS das tabelas não se aplica dentro de SECURITY DEFINER; a checagem de papel está dentro de cada função)
REVOKE ALL ON FUNCTION public.promote_ab_winner(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finish_ab_experiment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promote_ab_winner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_ab_experiment(uuid) TO authenticated;

-- ── Backfill em massa honra a variante ──
CREATE OR REPLACE FUNCTION public.enqueue_stage_followups(p_stage_id uuid, p_dry_run boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_leads int := 0; v_pairs int := 0; v_inserted int := 0;
BEGIN
  -- dry run nunca grava atribuição (evita inflar denominador do BI e congelar leads nos pesos antigos);
  -- pra contagem seca ainda aproximar a realidade, cai pra atribuição já existente (se houver) quando não vai gravar.
  CREATE TEMP TABLE _esteira_cand ON COMMIT DROP AS
  WITH lv AS (
    SELECT l.id AS lead_id, l.people_id, l.control,
           CASE WHEN p_dry_run THEN NULL ELSE public.assign_esteira_variant(l.id) END AS variant_id
    FROM public.leads l
    WHERE l.leads_stages_id = p_stage_id AND l.status = 'in_progress' AND coalesce(l.control, '') <> 'sem_fup'
  )
  SELECT lv.lead_id, lv.people_id, f.id AS followup_id, f.type AS channel, f.template_id, f.message, f.subject, lv.variant_id,
         now() + make_interval(days => coalesce(f.days,0), hours => coalesce(f.hours,0), mins => coalesce(f.minutes,0)) AS scheduled_for
  FROM lv
  JOIN public.leads_stages_followups f ON f.leads_stages_id = p_stage_id AND f.active = true
  LEFT JOIN public.clients_people p ON p.id = lv.people_id
  WHERE (f.control IS NULL OR f.control = lv.control)
    AND (f.score_matrix_id IS NULL OR f.score_matrix_id = p.score_matrix_id)
    AND (f.ab_variant_id IS NULL OR f.ab_variant_id = COALESCE(lv.variant_id, (SELECT a.variant_id FROM public.esteira_ab_assignments a JOIN public.esteira_ab_experiments e ON e.id = a.experiment_id WHERE a.lead_id = lv.lead_id AND e.status = 'running' LIMIT 1)))
    AND NOT EXISTS (SELECT 1 FROM public.followup_queue q WHERE q.lead_id = lv.lead_id AND q.followup_id = f.id AND q.status <> 'cancelled');

  SELECT count(DISTINCT lead_id), count(*) INTO v_leads, v_pairs FROM _esteira_cand;
  IF NOT p_dry_run THEN
    INSERT INTO public.followup_queue (followup_id, lead_id, person_id, channel, template_id, message, subject, source_type, scheduled_for, status, ab_variant_id)
    SELECT followup_id, lead_id, people_id, channel, template_id, message, subject, 'stage', scheduled_for, 'pending', variant_id FROM _esteira_cand;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
  END IF;
  RETURN jsonb_build_object('leads', v_leads, 'entries', v_pairs, 'inserted', v_inserted, 'dry_run', p_dry_run);
END $fn$;
REVOKE ALL ON FUNCTION public.enqueue_stage_followups(uuid, boolean) FROM PUBLIC, anon, authenticated;

-- ── RLS ──
ALTER TABLE public.esteira_ab_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esteira_ab_variants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esteira_ab_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ab_exp_select ON public.esteira_ab_experiments;
CREATE POLICY ab_exp_select ON public.esteira_ab_experiments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.settings_users su WHERE su.auth_user_id = auth.uid() AND su.active = true AND su.deleted_at IS NULL));
DROP POLICY IF EXISTS ab_exp_write ON public.esteira_ab_experiments;
CREATE POLICY ab_exp_write ON public.esteira_ab_experiments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.settings_users su WHERE su.auth_user_id = auth.uid() AND su.active = true AND su.deleted_at IS NULL
          AND (su.super_admin = true OR su.user_type = 'manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.settings_users su WHERE su.auth_user_id = auth.uid() AND su.active = true AND su.deleted_at IS NULL
          AND (su.super_admin = true OR su.user_type = 'manager')));
DROP POLICY IF EXISTS ab_exp_service ON public.esteira_ab_experiments;
CREATE POLICY ab_exp_service ON public.esteira_ab_experiments FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS ab_var_select ON public.esteira_ab_variants;
CREATE POLICY ab_var_select ON public.esteira_ab_variants FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.settings_users su WHERE su.auth_user_id = auth.uid() AND su.active = true AND su.deleted_at IS NULL));
DROP POLICY IF EXISTS ab_var_write ON public.esteira_ab_variants;
CREATE POLICY ab_var_write ON public.esteira_ab_variants FOR ALL USING (
  EXISTS (SELECT 1 FROM public.settings_users su WHERE su.auth_user_id = auth.uid() AND su.active = true AND su.deleted_at IS NULL
          AND (su.super_admin = true OR su.user_type = 'manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.settings_users su WHERE su.auth_user_id = auth.uid() AND su.active = true AND su.deleted_at IS NULL
          AND (su.super_admin = true OR su.user_type = 'manager')));
DROP POLICY IF EXISTS ab_var_service ON public.esteira_ab_variants;
CREATE POLICY ab_var_service ON public.esteira_ab_variants FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS ab_asg_select ON public.esteira_ab_assignments;
CREATE POLICY ab_asg_select ON public.esteira_ab_assignments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.settings_users su WHERE su.auth_user_id = auth.uid() AND su.active = true AND su.deleted_at IS NULL));
DROP POLICY IF EXISTS ab_asg_service ON public.esteira_ab_assignments;
CREATE POLICY ab_asg_service ON public.esteira_ab_assignments FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMIT;
