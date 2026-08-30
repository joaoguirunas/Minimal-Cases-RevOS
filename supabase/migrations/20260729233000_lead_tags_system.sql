-- Sistema de tags globais pra leads, com permissão de visibilidade por equipe.
-- Mesmo padrão de settings_teams_pipelines / lead_pipeline_accessible_to_current_user
-- (já testado em produção nesta sessão pra restringir a Aurea ao pipeline Recomendação).

BEGIN;

-- ── 1. Tabelas ────────────────────────────────────────────────────────────────

CREATE TABLE lead_tags (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  color      text NOT NULL DEFAULT '#3B82F6',
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE settings_teams_tags (
  team_id    uuid NOT NULL REFERENCES settings_teams(id) ON DELETE CASCADE,
  tag_id     uuid NOT NULL REFERENCES lead_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, tag_id)
);

CREATE TABLE leads_tags (
  lead_id    uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tag_id     uuid NOT NULL REFERENCES lead_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES settings_users(id),
  PRIMARY KEY (lead_id, tag_id)
);

CREATE INDEX idx_leads_tags_tag_id ON leads_tags(tag_id);
CREATE INDEX idx_settings_teams_tags_tag_id ON settings_teams_tags(tag_id);

CREATE TRIGGER update_lead_tags_updated_at
  BEFORE UPDATE ON lead_tags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 2. Função de acesso (cópia estrutural de lead_pipeline_accessible_to_current_user) ──

CREATE OR REPLACE FUNCTION public.tag_accessible_to_current_user(p_tag_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_team_ids uuid[];
  v_restricted_team_ids uuid[];
  v_has_universal_team boolean;
BEGIN
  v_user_id := public.get_current_settings_user_id();
  IF v_user_id IS NULL OR p_tag_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT ARRAY(SELECT team_id FROM public.settings_users_teams WHERE user_id = v_user_id)
    INTO v_team_ids;

  IF v_team_ids IS NULL OR array_length(v_team_ids, 1) IS NULL THEN
    RETURN true; -- sem equipe = sem restrição (mesma regra do pipeline)
  END IF;

  SELECT ARRAY(SELECT DISTINCT team_id FROM public.settings_teams_tags WHERE team_id = ANY(v_team_ids))
    INTO v_restricted_team_ids;

  -- Qualquer equipe do usuário sem NENHUM vínculo em settings_teams_tags
  -- é "universal" (enxerga todas as tags) — basta uma pra liberar tudo.
  v_has_universal_team := EXISTS (
    SELECT 1 FROM unnest(v_team_ids) AS t(id)
    WHERE NOT (id = ANY(COALESCE(v_restricted_team_ids, ARRAY[]::uuid[])))
  );
  IF v_has_universal_team THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.settings_teams_tags stt
    WHERE stt.team_id = ANY(v_team_ids)
      AND stt.tag_id = p_tag_id
  );
END;
$function$;

COMMENT ON FUNCTION public.tag_accessible_to_current_user IS
  'Espelha lead_pipeline_accessible_to_current_user(): time sem vínculo em settings_teams_tags enxerga todas as tags; time com algum vínculo só enxerga as tags explicitamente vinculadas.';

-- ── 3. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE lead_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings_teams_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY tags_read ON lead_tags FOR SELECT
USING (is_admin_or_manager() OR tag_accessible_to_current_user(id));

CREATE POLICY tags_write ON lead_tags FOR ALL
USING (is_admin_or_manager())
WITH CHECK (is_admin_or_manager());

CREATE POLICY team_tags_read ON settings_teams_tags FOR SELECT
USING (true);

CREATE POLICY team_tags_write ON settings_teams_tags FOR ALL
USING (is_admin_or_manager())
WITH CHECK (is_admin_or_manager());

CREATE POLICY leads_tags_read ON leads_tags FOR SELECT
USING (
  tag_accessible_to_current_user(tag_id)
  AND EXISTS (SELECT 1 FROM leads l WHERE l.id = leads_tags.lead_id)
);

CREATE POLICY leads_tags_write ON leads_tags FOR INSERT
WITH CHECK (
  tag_accessible_to_current_user(tag_id)
  AND EXISTS (
    SELECT 1 FROM leads l
    WHERE l.id = leads_tags.lead_id
      AND (
        is_admin_or_manager()
        OR l.user_id = get_current_settings_user_id()
        OR l.teams_id IN (SELECT team_id FROM settings_users_teams WHERE user_id = get_current_settings_user_id())
        OR lead_pipeline_accessible_to_current_user(l.leads_pipelines_id)
      )
  )
);

CREATE POLICY leads_tags_delete ON leads_tags FOR DELETE
USING (
  tag_accessible_to_current_user(tag_id)
  AND EXISTS (
    SELECT 1 FROM leads l
    WHERE l.id = leads_tags.lead_id
      AND (
        is_admin_or_manager()
        OR l.user_id = get_current_settings_user_id()
        OR l.teams_id IN (SELECT team_id FROM settings_users_teams WHERE user_id = get_current_settings_user_id())
        OR lead_pipeline_accessible_to_current_user(l.leads_pipelines_id)
      )
  )
);

-- ── 4. get_omni_contacts ganha filtro por tag ──────────────────────────────────

DROP FUNCTION IF EXISTS public.get_omni_contacts(text, text, text, text, text, text, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_omni_contacts(
  p_search_term text DEFAULT NULL::text,
  p_status_atend text DEFAULT NULL::text,
  p_atend_ia text DEFAULT NULL::text,
  p_filtro_data text DEFAULT NULL::text,
  p_responsavel text DEFAULT NULL::text,
  p_pipeline text DEFAULT NULL::text,
  p_etapa text DEFAULT NULL::text,
  p_time text DEFAULT NULL::text,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_tag text DEFAULT NULL::text
)
RETURNS TABLE(contact jsonb, total_count bigint)
LANGUAGE sql
STABLE
AS $function$
  SELECT
    to_jsonb(p.*)    AS contact,
    COUNT(*) OVER()  AS total_count
  FROM public.clients_people p
  WHERE
    (
      p.whatsapp               IS NOT NULL
      OR p.instagram_id          IS NOT NULL
      OR p.tiktok_open_id        IS NOT NULL
      OR p.manychat_subscriber_id IS NOT NULL
      OR p.email                 IS NOT NULL
    )
    AND p.status <> 'merged'
    AND (
      p_search_term IS NULL OR p_search_term = '' OR
      p.name              ILIKE '%' || p_search_term || '%' OR
      p.whatsapp          ILIKE '%' || p_search_term || '%' OR
      p.email             ILIKE '%' || p_search_term || '%' OR
      p.instagram_user_id ILIKE '%' || p_search_term || '%'
    )
    AND (
      p_status_atend IS NULL
      OR (p_status_atend = 'open'   AND (p.service_status = 'open'   OR p.service_status IS NULL))
      OR (p_status_atend <> 'open'  AND p.service_status = p_status_atend)
    )
    AND (
      p_atend_ia IS NULL OR
      (p_atend_ia = 'ia_ativa' AND p.ai_enabled = true) OR
      (p_atend_ia = 'humano'   AND p.ai_enabled = false)
    )
    AND (
      p_filtro_data IS NULL OR
      p.updated_at BETWEEN
        (split_part(p_filtro_data, '_', 1) || 'T00:00:00')::timestamptz
        AND (split_part(p_filtro_data, '_', 2) || 'T23:59:59')::timestamptz
    )
    AND (
      p_responsavel IS NULL
      OR NOT EXISTS (
           SELECT 1 FROM public.leads l
           WHERE l.people_id = p.id
             AND l.status NOT IN ('lost', 'archived')
         )
      OR EXISTS (
           SELECT 1 FROM public.leads l
           WHERE l.people_id = p.id
             AND (l.user_id = p_responsavel::uuid OR l.user_id IS NULL)
         )
    )
    AND (
      p_pipeline IS NULL OR
      EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.people_id = p.id
          AND l.leads_pipelines_id = p_pipeline::uuid
      )
    )
    AND (
      p_etapa IS NULL OR
      EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.people_id = p.id
          AND l.leads_stages_id = p_etapa::uuid
      )
    )
    AND (
      p_time IS NULL OR
      EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.people_id = p.id
          AND l.teams_id = p_time::uuid
      )
    )
    AND (
      p_tag IS NULL OR
      EXISTS (
        SELECT 1 FROM public.leads l
        JOIN public.leads_tags lt ON lt.lead_id = l.id
        WHERE l.people_id = p.id
          AND lt.tag_id = p_tag::uuid
      )
    )
  ORDER BY p.updated_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
$function$;

COMMIT;
