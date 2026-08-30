-- ORA: Mapeia variables_map em todos os templates pendentes
-- Derivado da análise dos body_text de cada template

BEGIN;

-- ── Padrão: só {{1}}=nome ──────────────────────────────────────────────────
UPDATE whatsapp_templates
SET json_data = jsonb_set(json_data, '{variables_map}', '{"1":"nome"}', true)
WHERE meta_template_name IN (
  'ora_agend_lembrete',
  'ora_evt_d2', 'ora_evt_d3', 'ora_evt_d4', 'ora_evt_d5',
  'ora_evt_msg2', 'ora_evt_msg3', 'ora_evt_msg4', 'ora_evt_msg5',
  'ora_net_d2', 'ora_net_d3', 'ora_net_d4', 'ora_net_d5',
  'ora_net_msg2', 'ora_net_msg3', 'ora_net_msg4', 'ora_net_msg5',
  'ora_pes_d2', 'ora_pes_d3', 'ora_pes_d4', 'ora_pes_d5',
  'ora_pes_msg2', 'ora_pes_msg3', 'ora_pes_msg4', 'ora_pes_msg5',
  'ora_abordagem_network',
  'ora_followup_suave',
  'ora_primeiro_contato',
  'ora_reativacao_noshow',
  'ora_reativacao_sem_resposta'
);

-- ── {{1}}=nome, {{2}}=recomendante ─────────────────────────────────────────
UPDATE whatsapp_templates
SET json_data = jsonb_set(json_data, '{variables_map}', '{"1":"nome","2":"recomendante"}', true)
WHERE meta_template_name IN (
  'ora_rec_msg2', 'ora_rec_msg3', 'ora_rec_msg4', 'ora_rec_msg5',
  'ora_rec_d2', 'ora_rec_d3', 'ora_rec_d4', 'ora_rec_d5',
  'ora_abordagem_recomendacao'
);

-- ── {{1}}=nome, {{2}}=recomendante, {{3}}=relacao_recomendante ─────────────
UPDATE whatsapp_templates
SET json_data = jsonb_set(json_data, '{variables_map}', '{"1":"nome","2":"recomendante","3":"relacao_recomendante"}', true)
WHERE meta_template_name IN (
  'ora_rec_msg1',
  'ora_rec_d1_v2'
);

-- ── {{1}}=nome, {{2}}=relacao_corretor ─────────────────────────────────────
UPDATE whatsapp_templates
SET json_data = jsonb_set(json_data, '{variables_map}', '{"1":"nome","2":"relacao_corretor"}', true)
WHERE meta_template_name IN (
  'ora_pes_d1'
);

-- ── {{1}}=nome, {{2}}=nome_evento ───────────────────────────────────────────
UPDATE whatsapp_templates
SET json_data = jsonb_set(json_data, '{variables_map}', '{"1":"nome","2":"nome_evento"}', true)
WHERE meta_template_name IN (
  'ora_evt_msg1',
  'ora_net_msg1', 'ora_net_msg1_v2',
  'ora_net_d1',
  'ora_abordagem_evento'
);

-- ── {{1}}=nome, {{2}}=reuniao_ultima_data ───────────────────────────────────
UPDATE whatsapp_templates
SET json_data = jsonb_set(json_data, '{variables_map}', '{"1":"nome","2":"reuniao_ultima_data"}', true)
WHERE meta_template_name IN (
  'ora_lembrete_d1',
  'ora_lembrete_dia'
);

-- ── {{1}}=nome, {{2}}=link_reuniao ──────────────────────────────────────────
UPDATE whatsapp_templates
SET json_data = jsonb_set(json_data, '{variables_map}', '{"1":"nome","2":"link_reuniao"}', true)
WHERE meta_template_name = 'ora_link_reuniao';

-- ── Verificação final ───────────────────────────────────────────────────────
SELECT
  meta_template_name,
  json_data->'variables_map' AS variables_map,
  CASE WHEN json_data->'variables_map' IS NULL THEN 'PENDENTE' ELSE 'MAPEADO' END AS status
FROM whatsapp_templates
WHERE meta_template_name LIKE 'ora_%'
ORDER BY meta_template_name;

COMMIT;
