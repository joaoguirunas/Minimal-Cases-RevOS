-- ================================================================
-- MIGRATION: 20260312160000_adm_clients_custom_domain.sql
-- Adiciona suporte a domínio customizado por cliente
-- Permite que clientes usem seu próprio domínio além do subdomínio padrão
-- ================================================================

ALTER TABLE public.adm_clients
  ADD COLUMN IF NOT EXISTS custom_domain TEXT UNIQUE;

COMMENT ON COLUMN public.adm_clients.custom_domain IS
  'Domínio customizado do cliente (ex: crm.empresa.com.br). Opcional — além do subdomínio padrão *.revos.growthsales.ai';
