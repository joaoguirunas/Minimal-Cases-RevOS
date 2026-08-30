-- FIX-CAMPOS-EXTRAS-01: pipeline-scoped qualification fields were created with
-- entity_type='pessoa', but CamposExtrasSection + useLeadFieldDefinitions filter
-- exclusively on entity_type='negocio'. These fields (objetivo, interesse_area,
-- perfil_tipo, nivel_tecnico, momento) qualify the lead/deal — not a generic person
-- record — so 'negocio' is the semantically correct entity type.
-- Existing lead_field_values were already saved as entity_type='negocio' (old code
-- hardcoded it), so no values migration is needed.

UPDATE lead_field_definitions
SET    entity_type = 'negocio',
       updated_at  = now()
WHERE  entity_type = 'pessoa'
  AND  key IN (
    'objetivo',
    'interesse_area',
    'perfil_tipo',
    'nivel_tecnico',
    'momento',
    'conversation_summary',
    'curso'
  );
