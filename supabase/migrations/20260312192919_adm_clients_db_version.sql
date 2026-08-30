-- ================================================================
-- MIGRATION: 20260312180000_adm_clients_db_version.sql
-- Adiciona controle de versão por cliente
-- ================================================================

ALTER TABLE public.adm_clients
  ADD COLUMN IF NOT EXISTS db_version  TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS app_version TEXT DEFAULT NULL;

COMMENT ON COLUMN public.adm_clients.db_version  IS 'Versão do banco após último sync bem-sucedido. Ex: 1.03';
COMMENT ON COLUMN public.adm_clients.app_version IS 'Versão do sistema quando o cliente foi criado. Ex: 1.07';
