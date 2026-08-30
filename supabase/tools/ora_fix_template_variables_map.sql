-- ORA: Restaura variables_map nos 3 templates que vieram do Meta sem esse campo
-- ora_pes_msg1_v2    : {{1}}=nome, {{2}}=relacao_corretor
-- ora_agend_confirmacao: {{1}}=nome, {{2}}=reuniao_ultima_data
-- ora_agend_link     : {{1}}=nome, {{2}}=link_reuniao

BEGIN;

UPDATE whatsapp_templates
SET json_data = jsonb_set(json_data, '{variables_map}', '{"1":"nome","2":"relacao_corretor"}', true)
WHERE meta_template_name = 'ora_pes_msg1_v2';

UPDATE whatsapp_templates
SET json_data = jsonb_set(json_data, '{variables_map}', '{"1":"nome","2":"reuniao_ultima_data"}', true)
WHERE meta_template_name = 'ora_agend_confirmacao';

UPDATE whatsapp_templates
SET json_data = jsonb_set(json_data, '{variables_map}', '{"1":"nome","2":"link_reuniao"}', true)
WHERE meta_template_name = 'ora_agend_link';

-- Verificação
SELECT meta_template_name, json_data->'variables_map' AS variables_map
FROM whatsapp_templates
WHERE meta_template_name IN ('ora_pes_msg1_v2', 'ora_agend_confirmacao', 'ora_agend_link')
ORDER BY meta_template_name;

COMMIT;
