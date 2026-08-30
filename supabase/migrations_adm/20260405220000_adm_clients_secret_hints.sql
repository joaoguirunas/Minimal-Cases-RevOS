-- ═══════════════════════════════════════════════════════════════════
-- ADM: Secret hint columns for adm_clients
-- Stores the first 12 plaintext chars of each secret so the UI can
-- confirm which value is saved without ever exposing the full secret.
-- ═══════════════════════════════════════════════════════════════════

alter table adm_clients
  add column if not exists service_role_key_hint text,
  add column if not exists db_password_hint       text,
  add column if not exists management_token_hint  text;
