-- Rollback: 20260611230000_fix_custom_field_defs_entity_type-ok.sql
-- Reverts entity_type back to 'pessoa' for the five qualification field keys.

UPDATE lead_field_definitions
SET    entity_type = 'pessoa',
       updated_at  = now()
WHERE  entity_type = 'negocio'
  AND  key IN (
    'objetivo',
    'interesse_area',
    'perfil_tipo',
    'nivel_tecnico',
    'momento',
    'conversation_summary',
    'curso'
  );
