-- ── CF-5.1: v_coaching_insights — view agregada para BI PRO Insights ──────────
--
-- Usada pelo bi-insights-chat para injectar contexto de coaching quando
-- o utilizador faz perguntas sobre performance de consultores, scorecards, etc.
-- A edge function usa service_role, pelo que o acesso é sempre concedido.

CREATE OR REPLACE VIEW public.v_coaching_insights AS
SELECT
  me.id                    AS evaluation_id,
  me.meeting_id,
  me.overall_score,
  me.overall_verdict,
  me.deal_risk,
  me.talk_ratio_consultant,
  me.gaps,
  me.strengths,
  me.evaluated_at,
  m.user_id                AS consultant_user_id,
  m.title                  AS meeting_title,
  m.start_time,
  m.lead_id,
  p.name                   AS playbook_name,
  p.type                   AS playbook_type,
  su.name                  AS consultant_name
FROM public.meeting_evaluations me
JOIN public.meetings m   ON me.meeting_id  = m.id
JOIN public.playbooks p  ON me.playbook_id = p.id
LEFT JOIN public.settings_users su ON m.user_id = su.id
WHERE me.status         = 'done'
  AND me.superseded_at IS NULL;

-- Grant access to authenticated users and service_role
GRANT SELECT ON public.v_coaching_insights TO authenticated;
GRANT SELECT ON public.v_coaching_insights TO service_role;
