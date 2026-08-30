-- ═══════════════════════════════════════════════════════════════════
-- ADM: Truncate plaintext secret hints to 4 chars
--
-- The *_hint columns originally stored 12 plaintext characters. The UI never
-- renders more than 4 (it always slices `.slice(0, 4)` followed by mask).
-- Storing the extra 8 chars unnecessarily widens the blast radius if the
-- control plane is ever exposed. This migration truncates existing hints to
-- match what the UI already shows.
--
-- Going forward, makeHint() in src/hooks/useAdmClients.ts saves 4 chars.
-- ═══════════════════════════════════════════════════════════════════

update adm_clients
set
  service_role_key_hint = case
    when service_role_key_hint is null then null
    when length(regexp_replace(service_role_key_hint, '…$', '')) <= 4 then service_role_key_hint
    else substring(regexp_replace(service_role_key_hint, '…$', '') from 1 for 4) || '…'
  end,
  db_password_hint = case
    when db_password_hint is null then null
    when length(regexp_replace(db_password_hint, '…$', '')) <= 4 then db_password_hint
    else substring(regexp_replace(db_password_hint, '…$', '') from 1 for 4) || '…'
  end,
  management_token_hint = case
    when management_token_hint is null then null
    when length(regexp_replace(management_token_hint, '…$', '')) <= 4 then management_token_hint
    else substring(regexp_replace(management_token_hint, '…$', '') from 1 for 4) || '…'
  end
where
  service_role_key_hint is not null
  or db_password_hint is not null
  or management_token_hint is not null;
