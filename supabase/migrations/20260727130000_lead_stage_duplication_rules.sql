-- Automação: quando um lead entra numa etapa específica de um pipeline
-- (movido pra lá OU já criado direto ali — ex. via webhook do Kiwify), pode
-- ser configurada uma regra que duplica automaticamente esse lead pra outro
-- pipeline (opcionalmente numa etapa específica; sem etapa definida, cai na
-- primeira etapa ativa do pipeline destino). É um trigger — funciona
-- independente de como a etapa mudou (drag&drop no Kanban, tool da IA,
-- webhook, edição manual), sem precisar instrumentar cada write path.
--
-- Reusa a mesma noção de "lead duplicado" da RPC add_lead_to_pipeline (MULTI-
-- PIPELINE-01): pula silenciosamente se o people_id já tem lead ativo no
-- pipeline destino — aqui não há usuário pra mostrar erro, então é idempotente
-- em vez de lançar exceção.

-- ── 1. Tabela de regras ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.leads_stage_duplication_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_stage_id uuid NOT NULL REFERENCES public.leads_stages(id) ON DELETE CASCADE,
  target_pipeline_id uuid NOT NULL REFERENCES public.leads_pipelines(id) ON DELETE CASCADE,
  target_stage_id uuid REFERENCES public.leads_stages(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_stage_id, target_pipeline_id)
);

ALTER TABLE public.leads_stage_duplication_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY authenticated_read_duplication_rules ON public.leads_stage_duplication_rules
  FOR SELECT
  USING (true);

CREATE POLICY managers_write_duplication_rules ON public.leads_stage_duplication_rules
  FOR ALL
  USING (is_admin_or_manager())
  WITH CHECK (is_admin_or_manager());

-- ── 2. Trigger de duplicação ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.duplicate_lead_on_stage_enter() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule record;
  v_target_stage_id uuid;
  v_already_active uuid;
BEGIN
  -- Guarda contra encadeamento indefinido: se uma regra mal configurada criar
  -- um ciclo (etapa A duplica pra pipeline B, cuja primeira etapa duplica de
  -- volta pra A...), essa profundidade limita o dano em vez de estourar a
  -- stack do Postgres.
  IF pg_trigger_depth() > 3 THEN
    RETURN NEW;
  END IF;

  IF NEW.status <> 'in_progress' OR NEW.leads_stages_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.leads_stages_id IS NOT DISTINCT FROM OLD.leads_stages_id THEN
    RETURN NEW;
  END IF;

  FOR v_rule IN
    SELECT * FROM leads_stage_duplication_rules
    WHERE source_stage_id = NEW.leads_stages_id AND active = true
  LOOP
    SELECT id INTO v_already_active
    FROM leads
    WHERE people_id = NEW.people_id
      AND leads_pipelines_id = v_rule.target_pipeline_id
      AND status = 'in_progress';

    IF v_already_active IS NOT NULL THEN
      CONTINUE;
    END IF;

    v_target_stage_id := v_rule.target_stage_id;
    IF v_target_stage_id IS NULL THEN
      SELECT id INTO v_target_stage_id
      FROM leads_stages
      WHERE leads_pipelines_id = v_rule.target_pipeline_id AND active = true
      ORDER BY order_index ASC
      LIMIT 1;
    END IF;

    IF v_target_stage_id IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO leads (people_id, company_id, teams_id, user_id, title, leads_pipelines_id, leads_stages_id, status)
    VALUES (NEW.people_id, NEW.company_id, NEW.teams_id, NEW.user_id, NEW.title, v_rule.target_pipeline_id, v_target_stage_id, 'in_progress');
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_stage_duplication_trigger ON public.leads;
CREATE TRIGGER leads_stage_duplication_trigger
  AFTER INSERT OR UPDATE OF leads_stages_id ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.duplicate_lead_on_stage_enter();
