-- FORM PRO™ — Migrar whatsapp_auto legado → post_submit_actions
-- Story: FP-03 — EPIC-FORMPRO-QA
-- Date: 2026-03-14
--
-- Problema: Formulários criados antes do lançamento de post_submit_actions
-- podem ter settings.whatsapp_auto.enabled = true no banco. A migração
-- runtime do LpFormBuilder só ocorre ao abrir o form no editor — forms
-- nunca reabertos ficaram com o campo legado ativo.
--
-- Risco: lp-submit processa whatsapp_auto (legado) quando post_submit_actions
-- está vazio E whatsapp_auto.enabled = true. Forms com ambos disparam dois
-- envios WA para o mesmo lead.
--
-- Esta migration é IDEMPOTENTE: se não houver forms afetados, os UPDATEs
-- não tocam nenhuma linha.
-- ============================================================

-- ── Diagnóstico (informativo — não altera dados) ────────────────────────────
-- Para ver quantos forms são afetados antes de aplicar:
-- SELECT id, name,
--        settings->'whatsapp_auto' AS wa_auto,
--        settings->'post_submit_actions' AS psa
-- FROM form_pro_forms
-- WHERE (settings->'whatsapp_auto'->>'enabled')::boolean = true;

-- ── UPDATE 1: Forms com whatsapp_auto ativo e SEM post_submit_actions ────────
-- Ação: migrar whatsapp_auto → post_submit_actions + desabilitar whatsapp_auto
UPDATE form_pro_forms
SET settings = jsonb_set(
  jsonb_set(
    settings,
    '{post_submit_actions}',
    jsonb_build_array(
      jsonb_build_object(
        'id',             gen_random_uuid()::text,
        'enabled',        true,
        'channel',        'whatsapp',
        'delay_minutes',  0,
        'wa_channel_id',  settings->'whatsapp_auto'->>'channel_id',
        'wa_template_id', settings->'whatsapp_auto'->>'template_id',
        'wa_variable_map',settings->'whatsapp_auto'->'variable_map'
      )
    )
  ),
  '{whatsapp_auto,enabled}',
  'false'
)
WHERE
  -- Apenas forms com whatsapp_auto habilitado
  (settings->'whatsapp_auto'->>'enabled')::boolean = true
  -- E que não têm post_submit_actions ainda
  AND (
    settings->'post_submit_actions' IS NULL
    OR jsonb_array_length(settings->'post_submit_actions') = 0
  );

-- ── UPDATE 2: Forms com whatsapp_auto ativo E COM post_submit_actions ────────
-- Ação: apenas desabilitar whatsapp_auto (migração já foi feita pelo builder)
UPDATE form_pro_forms
SET settings = jsonb_set(
  settings,
  '{whatsapp_auto,enabled}',
  'false'
)
WHERE
  -- Apenas forms com whatsapp_auto ainda habilitado
  (settings->'whatsapp_auto'->>'enabled')::boolean = true
  -- E que já têm post_submit_actions (migração parcial pelo builder)
  AND settings->'post_submit_actions' IS NOT NULL
  AND jsonb_array_length(settings->'post_submit_actions') > 0;

-- ── Verificação pós-migração ────────────────────────────────────────────────
-- Resultado esperado: 0 linhas
-- SELECT id, name FROM form_pro_forms
-- WHERE (settings->'whatsapp_auto'->>'enabled')::boolean = true;

COMMENT ON TABLE form_pro_forms IS
  'FORM PRO™: Smart form definitions. Post-submit actions via settings.post_submit_actions (whatsapp_auto deprecated/disabled as of 2026-03-14).';
