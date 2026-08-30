-- ══════════════════════════════════════════════════════════════════════════════
-- Meeting Follow-up Templates v2
--
-- Seeds 8 WhatsApp templates (confirmação + 4 lembretes pré-reunião + 3 ausência)
-- and 8 corresponding meetings_followups rules.
--
-- Idempotency notes:
--   • whatsapp_templates has UNIQUE(slug) and UNIQUE-ish meta_template_name usage,
--     plus id_template NOT NULL. A plain ON CONFLICT (id) is insufficient because a
--     row with the same slug/meta_template_name may already exist from auto-setup.
--     We insert each row only WHEN NOT EXISTS by id OR slug OR meta_template_name.
--   • meetings_followups rules: ON CONFLICT (id) DO NOTHING on fixed UUIDs.
--   • type='whatsapp_template' is descriptive only (no CHECK on type). The trigger
--     keys off whatsapp_template_id IS NOT NULL; channel MUST be 'whatsapp'
--     (CHECK channel IN ('email','sms','whatsapp','phone')).
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Seed whatsapp_templates ───────────────────────────────────────────────

INSERT INTO public.whatsapp_templates (id, id_template, name, slug, status, system_enabled, meta_template_name, json_data)
SELECT v.id::uuid, 'pending', v.name, v.slug, 'pending', false, v.meta_template_name, v.json_data::jsonb
FROM (VALUES
  (
    'a1000001-0000-0000-0000-000000000001', 'confirmacao_reuniao', 'confirmacao_reuniao|pt_BR', 'confirmacao_reuniao',
    '{"category":"UTILITY","language":"pt_BR","parameter_format":"POSITIONAL","components":[{"type":"BODY","text":"{{1}}, está confirmado.\n\nSua sessão com {{5}} acontece em {{2}} às {{3}}.\n\nAcesso: {{4}}\n\nVocê também vai receber uma confirmação por e-mail. Até lá.","example":{"body_text":[["João Silva","20/06/2026","14:00","https://meet.google.com/abc","Bruno"]]}}]}'
  ),
  (
    'a1000001-0000-0000-0000-000000000002', 'lembrete_1d', 'lembrete_1d|pt_BR', 'lembrete_1d',
    '{"category":"UTILITY","language":"pt_BR","parameter_format":"POSITIONAL","components":[{"type":"BODY","text":"{{1}}, amanhã é com você.\n\nÀs {{3}} de {{2}} a sua sessão começa. Se tiver qualquer dúvida antes, é só responder aqui.\n\nAcesso: {{4}}","example":{"body_text":[["João Silva","20/06/2026","14:00","https://meet.google.com/abc"]]}}]}'
  ),
  (
    'a1000001-0000-0000-0000-000000000003', 'lembrete_2h_v2', 'lembrete_2h_v2|pt_BR', 'lembrete_2h_v2',
    '{"category":"UTILITY","language":"pt_BR","parameter_format":"POSITIONAL","components":[{"type":"BODY","text":"{{1}}, em 2 horas é com você.\n\nÀs {{2}} começa a sua sessão. Entra no link no horário.\n\n{{3}}","example":{"body_text":[["João Silva","14:00","https://meet.google.com/abc"]]}}]}'
  ),
  (
    'a1000001-0000-0000-0000-000000000004', 'lembrete_30min', 'lembrete_30min|pt_BR', 'lembrete_30min',
    '{"category":"UTILITY","language":"pt_BR","parameter_format":"POSITIONAL","components":[{"type":"BODY","text":"{{1}}, faltam 30 minutos.\n\nAcessa o link quando estiver pronto.\n\n{{2}}","example":{"body_text":[["João Silva","https://meet.google.com/abc"]]}}]}'
  ),
  (
    'a1000001-0000-0000-0000-000000000005', 'lembrete_5min', 'lembrete_5min|pt_BR', 'lembrete_5min',
    '{"category":"UTILITY","language":"pt_BR","parameter_format":"POSITIONAL","components":[{"type":"BODY","text":"{{1}}, é agora.\n\nÀs {{2}} começa. Acessa o link abaixo.\n\n{{3}}","example":{"body_text":[["João Silva","14:00","https://meet.google.com/abc"]]}}]}'
  ),
  (
    'a1000001-0000-0000-0000-000000000006', 'ausencia_imediato', 'ausencia_imediato|pt_BR', 'ausencia_imediato',
    '{"category":"UTILITY","language":"pt_BR","parameter_format":"POSITIONAL","components":[{"type":"BODY","text":"{{1}}, vimos que você não conseguiu estar presente hoje.\n\nSem problema, a agenda ainda pode ser sua. Escolhe um novo horário pelo link abaixo.\n\n{{2}}","example":{"body_text":[["João Silva","https://app.example.com/agendar/uuid"]]}}]}'
  ),
  (
    'a1000001-0000-0000-0000-000000000007', 'ausencia_6h', 'ausencia_6h|pt_BR', 'ausencia_6h',
    '{"category":"UTILITY","language":"pt_BR","parameter_format":"POSITIONAL","components":[{"type":"BODY","text":"{{1}}, sentimos a sua falta hoje.\n\nO que planejamos para essa sessão ainda faz muito sentido para o seu momento. Quando quiser remarcar, é só clicar abaixo.\n\n{{2}}","example":{"body_text":[["João Silva","https://app.example.com/agendar/uuid"]]}}]}'
  ),
  (
    'a1000001-0000-0000-0000-000000000008', 'ausencia_24h', 'ausencia_24h|pt_BR', 'ausencia_24h',
    '{"category":"UTILITY","language":"pt_BR","parameter_format":"POSITIONAL","components":[{"type":"BODY","text":"{{1}}, essa é nossa última mensagem.\n\nSe ainda fizer sentido para você, o link para remarcar fica disponível por mais 1 dia.\n\n{{2}}","example":{"body_text":[["João Silva","https://app.example.com/agendar/uuid"]]}}]}'
  )
) AS v(id, name, slug, meta_template_name, json_data)
WHERE NOT EXISTS (
  SELECT 1 FROM public.whatsapp_templates t
   WHERE t.id = v.id::uuid
      OR t.slug = v.slug
      OR t.meta_template_name = v.meta_template_name
);

-- ─── 2. Seed meetings_followups rules ─────────────────────────────────────────
-- whatsapp_template_id resolves to the seeded fixed UUID when present, otherwise
-- to an existing template matching the same meta_template_name (auto-setup row).

INSERT INTO public.meetings_followups
  (id, meeting_status, type, name, channel, days, hours, minutes, active, template_id, whatsapp_template_id)
SELECT
  r.id::uuid, r.meeting_status, 'whatsapp_template', r.name, 'whatsapp',
  r.days, r.hours, r.minutes, true, r.meta_template_name,
  COALESCE(
    (SELECT t.id FROM public.whatsapp_templates t WHERE t.id = r.wa_template_id::uuid),
    (SELECT t.id FROM public.whatsapp_templates t WHERE t.meta_template_name = r.meta_template_name ORDER BY t.created_at LIMIT 1)
  )
FROM (VALUES
  ('b2000001-0000-0000-0000-000000000001', 'agendado',       'Confirmação de agendamento', 0, 0, 0,  'a1000001-0000-0000-0000-000000000001', 'confirmacao_reuniao'),
  ('b2000001-0000-0000-0000-000000000002', 'agendado',       'Lembrete 1 dia antes',       1, 0, 0,  'a1000001-0000-0000-0000-000000000002', 'lembrete_1d'),
  ('b2000001-0000-0000-0000-000000000003', 'agendado',       'Lembrete 2 horas antes',     0, 2, 0,  'a1000001-0000-0000-0000-000000000003', 'lembrete_2h_v2'),
  ('b2000001-0000-0000-0000-000000000004', 'agendado',       'Lembrete 30 min antes',      0, 0, 30, 'a1000001-0000-0000-0000-000000000004', 'lembrete_30min'),
  ('b2000001-0000-0000-0000-000000000005', 'agendado',       'Lembrete 5 min antes',       0, 0, 5,  'a1000001-0000-0000-0000-000000000005', 'lembrete_5min'),
  ('b2000001-0000-0000-0000-000000000006', 'nao_compareceu', 'Ausência — imediato',        0, 0, 0,  'a1000001-0000-0000-0000-000000000006', 'ausencia_imediato'),
  ('b2000001-0000-0000-0000-000000000007', 'nao_compareceu', 'Ausência — 6h após',         0, 6, 0,  'a1000001-0000-0000-0000-000000000007', 'ausencia_6h'),
  ('b2000001-0000-0000-0000-000000000008', 'nao_compareceu', 'Ausência — 24h após',        1, 0, 0,  'a1000001-0000-0000-0000-000000000008', 'ausencia_24h')
) AS r(id, meeting_status, name, days, hours, minutes, wa_template_id, meta_template_name)
ON CONFLICT (id) DO NOTHING;

COMMIT;
