-- ADM-V3-06: Indexes for adm_audit_log pagination and filtering

-- Primary sort index — used by ORDER BY created_at DESC LIMIT 30
CREATE INDEX IF NOT EXISTS adm_audit_log_created_at_idx
  ON adm_audit_log (created_at DESC);

-- Filter by actor (user) — used in AdmAuditLogPanel actor filter
CREATE INDEX IF NOT EXISTS adm_audit_log_actor_id_idx
  ON adm_audit_log (actor_id);

-- Composite filter index — action + entity_type filter combinations
-- Also covers single-column action filter via index prefix
CREATE INDEX IF NOT EXISTS adm_audit_log_action_entity_idx
  ON adm_audit_log (action, entity_type);
