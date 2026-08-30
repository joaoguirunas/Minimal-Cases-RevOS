-- Pipeline "0 | Aquecimento" (3b5ece8e-fcb3-4dec-a4a0-b9ad8d9cadb6):
--   1) cria stage "Mensagem Whatsapp" (order_index=3, slot vago por causa da
--      remoção de "Triagem" abaixo) e um settings_omni_new_contact
--      (channel='whatsapp') pra auto-criar negócio nela em todo inbound de
--      WhatsApp — hoje só existe canal ativo Evolution (não-oficial), mas
--      essa config não é provider-specific: se o Meta for reativado depois,
--      também cai aqui, a menos que vire provider-aware no futuro.
--   2) move os leads de "Triagem" pra "Mensagem DM" e deleta "Triagem".
--   3) deleta "Interesse via Instagram" (0 leads referenciando, confirmado
--      também em leads_stages_followups, schedule_automations,
--      leads_stage_duplication_rules, kiwify_event_mappings,
--      conversion_stage_mappings, inbound_webhooks, conversion_events_queue).
--   4) ai_agents.leads_stages_id -> Triagem tem FK sem ON DELETE (restrict);
--      só o agente inativo "Social Selling — Instagram" referencia — repontado
--      pra "Mensagem DM" junto com os leads, já que ele está desativado desde
--      a transição pro Evolution mais cedo nesta sessão.

BEGIN;

WITH new_stage AS (
  INSERT INTO leads_stages (leads_pipelines_id, name, color, order_index, active)
  VALUES ('3b5ece8e-fcb3-4dec-a4a0-b9ad8d9cadb6', 'Mensagem Whatsapp', '#3B82F6', 3, true)
  RETURNING id
)
INSERT INTO settings_omni_new_contact (channel, auto_create_negocio, pipeline_id, stage_id)
SELECT 'whatsapp', true, '3b5ece8e-fcb3-4dec-a4a0-b9ad8d9cadb6', id FROM new_stage;

UPDATE leads
SET leads_stages_id = 'b0146071-7d42-4214-b8e7-5b5f474df2a7'
WHERE leads_stages_id = '6559f629-41a2-4cee-b4c7-b761bddfcf7c';

UPDATE ai_agents
SET leads_stages_id = 'b0146071-7d42-4214-b8e7-5b5f474df2a7'
WHERE leads_stages_id = '6559f629-41a2-4cee-b4c7-b761bddfcf7c';

DELETE FROM leads_stages WHERE id = '6559f629-41a2-4cee-b4c7-b761bddfcf7c';
DELETE FROM leads_stages WHERE id = '28a004e4-c4f1-422a-99ad-7501890048e1';

-- smoke test
SELECT
  (SELECT count(*) FROM leads_stages WHERE leads_pipelines_id = '3b5ece8e-fcb3-4dec-a4a0-b9ad8d9cadb6' AND name = 'Mensagem Whatsapp') AS new_stage_ok,
  (SELECT count(*) FROM settings_omni_new_contact WHERE channel = 'whatsapp') AS omni_config_ok,
  (SELECT count(*) FROM leads WHERE leads_stages_id = '6559f629-41a2-4cee-b4c7-b761bddfcf7c') AS triagem_leads_remaining,
  (SELECT count(*) FROM leads_stages WHERE id IN ('6559f629-41a2-4cee-b4c7-b761bddfcf7c', '28a004e4-c4f1-422a-99ad-7501890048e1')) AS old_stages_remaining,
  (SELECT count(*) FROM leads WHERE leads_stages_id = 'b0146071-7d42-4214-b8e7-5b5f474df2a7') AS mensagem_dm_leads_total;

COMMIT;
