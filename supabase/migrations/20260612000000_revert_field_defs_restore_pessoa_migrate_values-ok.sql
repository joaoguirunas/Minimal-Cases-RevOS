-- FIX-CAMPOS-EXTRAS-02: revert entity_type change from 20260611230000.
-- Fields objetivo, interesse_area, perfil_tipo, nivel_tecnico, momento,
-- conversation_summary, curso belong to entity_type='pessoa' by design —
-- ExtraFieldsCard renders entity_type='pessoa' fields, CamposExtrasSection
-- renders entity_type='negocio' fields. The prior migration incorrectly
-- flattened both into 'negocio'.
--
-- Step 1: restore entity_type='pessoa' on the field definitions.
-- Step 2: move any values that were incorrectly persisted as entity_type='negocio'
--         for these fields into the correct (entity_type='pessoa', entity_id=pessoa_id) row.
-- Step 3: delete the orphaned entity_type='negocio' rows for those fields.

-- ── Step 1: restore definitions ───────────────────────────────────────────────

UPDATE lead_field_definitions
SET    entity_type = 'pessoa',
       updated_at  = now()
WHERE  key IN (
  'objetivo', 'interesse_area', 'perfil_tipo',
  'nivel_tecnico', 'momento',
  'conversation_summary', 'curso'
);

-- ── Step 2: copy misplaced negocio values → pessoa ───────────────────────────
-- entity_id for negocio rows = leads.id; we resolve leads.people_id to get the
-- correct pessoa entity_id.

INSERT INTO lead_field_values (
  entity_type, entity_id, field_definition_id,
  value_text, value_number, value_boolean, value_date,
  updated_at
)
SELECT
  'pessoa',
  l.people_id,
  lfv.field_definition_id,
  lfv.value_text,
  lfv.value_number,
  lfv.value_boolean,
  lfv.value_date,
  now()
FROM lead_field_values lfv
JOIN leads               l  ON l.id  = lfv.entity_id
JOIN lead_field_definitions lfd ON lfd.id = lfv.field_definition_id
WHERE lfv.entity_type = 'negocio'
  AND lfd.key IN (
    'objetivo', 'interesse_area', 'perfil_tipo',
    'nivel_tecnico', 'momento',
    'conversation_summary', 'curso'
  )
  AND l.people_id IS NOT NULL
ON CONFLICT (entity_type, entity_id, field_definition_id)
DO UPDATE SET
  value_text    = EXCLUDED.value_text,
  value_number  = EXCLUDED.value_number,
  value_boolean = EXCLUDED.value_boolean,
  value_date    = EXCLUDED.value_date,
  updated_at    = now();

-- ── Step 3: delete orphaned negocio rows ─────────────────────────────────────

DELETE FROM lead_field_values
WHERE  entity_type = 'negocio'
  AND  field_definition_id IN (
    SELECT id FROM lead_field_definitions
    WHERE  key IN (
      'objetivo', 'interesse_area', 'perfil_tipo',
      'nivel_tecnico', 'momento',
      'conversation_summary', 'curso'
    )
  );
