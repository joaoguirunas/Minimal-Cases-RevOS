-- Rollback: 20260612000000_revert_field_defs_restore_pessoa_migrate_values-ok.sql
-- Restores entity_type='negocio' (the incorrect state from 20260611230000).
-- Does NOT move values back (one-way data migration).

UPDATE lead_field_definitions
SET    entity_type = 'negocio',
       updated_at  = now()
WHERE  key IN (
  'objetivo', 'interesse_area', 'perfil_tipo',
  'nivel_tecnico', 'momento',
  'conversation_summary', 'curso'
);
