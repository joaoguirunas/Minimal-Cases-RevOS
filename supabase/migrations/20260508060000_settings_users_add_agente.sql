-- 20260508060000_settings_users_add_agente.sql
-- Adiciona campo agente (text nullable) em settings_users.
-- Disponível para edição pelo próprio usuário via perfil.

BEGIN;

ALTER TABLE public.settings_users
  ADD COLUMN IF NOT EXISTS agente text;

COMMIT;
