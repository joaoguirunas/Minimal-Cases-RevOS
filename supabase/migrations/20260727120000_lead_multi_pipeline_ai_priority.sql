-- Permite um lead (people_id) estar ativo em dois pipelines simultaneamente
-- (isso já acontecia implicitamente via kiwify-process-event/moveLead, que
-- cria uma leads row nova por pipeline quando não existe uma ativa lá — sem
-- unique constraint bloqueando) e adiciona uma forma explícita de:
--   1) o usuário colocar deliberadamente um lead existente em outro pipeline
--      (RPC add_lead_to_pipeline);
--   2) sinalizar qual etapa deve ser a "prioridade da IA" quando o mesmo
--      people_id tiver leads ativos em pipelines diferentes ao mesmo tempo
--      (leads_stages.ai_priority — consumido por ai-agent-execute/loadContext).

-- ── 1. Flag de prioridade da IA por etapa ───────────────────────────────────

ALTER TABLE public.leads_stages
  ADD COLUMN IF NOT EXISTS ai_priority boolean NOT NULL DEFAULT false;

-- ── 2. RPC: adiciona o people_id de um lead existente a outro pipeline ─────
-- Mesma permissividade da inserção normal de leads (users_insert_leads:
-- with_check true) — não é uma config de admin como as RPCs de vínculo
-- produto↔pipeline, é uma ação de uso diário de quem já pode criar leads.

CREATE OR REPLACE FUNCTION public.add_lead_to_pipeline(
  p_lead_id uuid,
  p_target_pipeline_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_people_id uuid;
  v_company_id uuid;
  v_teams_id uuid;
  v_user_id uuid;
  v_title text;
  v_target_pipeline_name text;
  v_first_stage_id uuid;
  v_existing_lead_id uuid;
  v_new_lead_id uuid;
BEGIN
  SELECT people_id, company_id, teams_id, user_id, title
  INTO v_people_id, v_company_id, v_teams_id, v_user_id, v_title
  FROM leads
  WHERE id = p_lead_id;

  IF v_people_id IS NULL THEN
    RAISE EXCEPTION 'Lead de origem não encontrado';
  END IF;

  SELECT name INTO v_target_pipeline_name
  FROM leads_pipelines
  WHERE id = p_target_pipeline_id AND active = true;

  IF v_target_pipeline_name IS NULL THEN
    RAISE EXCEPTION 'Pipeline de destino não encontrado ou inativo';
  END IF;

  SELECT id INTO v_existing_lead_id
  FROM leads
  WHERE people_id = v_people_id
    AND leads_pipelines_id = p_target_pipeline_id
    AND status = 'in_progress';

  IF v_existing_lead_id IS NOT NULL THEN
    RAISE EXCEPTION 'Este lead já está ativo no pipeline "%"', v_target_pipeline_name;
  END IF;

  SELECT id INTO v_first_stage_id
  FROM leads_stages
  WHERE leads_pipelines_id = p_target_pipeline_id AND active = true
  ORDER BY order_index ASC
  LIMIT 1;

  IF v_first_stage_id IS NULL THEN
    RAISE EXCEPTION 'Pipeline "%" não tem nenhuma etapa ativa', v_target_pipeline_name;
  END IF;

  INSERT INTO leads (people_id, company_id, teams_id, user_id, title, leads_pipelines_id, leads_stages_id, status)
  VALUES (v_people_id, v_company_id, v_teams_id, v_user_id, v_title, p_target_pipeline_id, v_first_stage_id, 'in_progress')
  RETURNING id INTO v_new_lead_id;

  RETURN jsonb_build_object('lead_id', v_new_lead_id, 'leads_stages_id', v_first_stage_id, 'pipeline_name', v_target_pipeline_name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_lead_to_pipeline(uuid, uuid) TO authenticated;
