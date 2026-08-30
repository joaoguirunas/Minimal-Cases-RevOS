-- ================================================================
-- MIGRATION: 20260312170000_adm_clients_enabled_modules.sql
-- Adiciona coluna enabled_modules em adm_clients
-- Permite controle granular de quais módulos cada cliente tem acesso
-- ================================================================

ALTER TABLE public.adm_clients
  ADD COLUMN IF NOT EXISTS enabled_modules jsonb DEFAULT NULL;

COMMENT ON COLUMN public.adm_clients.enabled_modules IS
  'Array de module_keys habilitados para este cliente. NULL = todos habilitados. Ex: ["dashboard","negocios","conversas"]';
