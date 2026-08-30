-- FP-06: Migrate widget.type → widget.destination and remove deprecated type field
--
-- Diagnostic (run before to check affected rows):
-- SELECT id, name,
--        settings->'widget'->>'type'        AS widget_type,
--        settings->'widget'->>'destination'  AS widget_destination
-- FROM form_pro_forms
-- WHERE settings->'widget'->>'type' IS NOT NULL
--   AND settings->'widget'->>'type' != '';

-- Migrate type → destination for forms that don't have destination set yet
UPDATE form_pro_forms
SET settings = jsonb_set(
  settings #- '{widget,type}',
  '{widget,destination}',
  CASE (settings->'widget'->>'type')
    WHEN 'whatsapp' THEN '"whatsapp"'::jsonb
    ELSE '"form"'::jsonb
  END
)
WHERE settings->'widget'->>'type' IS NOT NULL
  AND (settings->'widget'->>'destination' IS NULL
       OR settings->'widget'->>'destination' = '');

-- For forms that already have destination set, just remove the old type field
UPDATE form_pro_forms
SET settings = settings #- '{widget,type}'
WHERE settings->'widget'->>'type' IS NOT NULL
  AND settings->'widget'->>'destination' IS NOT NULL
  AND settings->'widget'->>'destination' != '';

-- Verification (should return 0 rows after applying):
-- SELECT id FROM form_pro_forms WHERE settings->'widget'->>'type' IS NOT NULL;
