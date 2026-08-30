-- Garante que a linha singleton de bi_settings existe em todos os bancos.
-- A migration 20260303000000_bi_settings_singleton-ok.sql criou a constraint e
-- semeou a linha no control plane, mas alguns clientes podem não ter recebido
-- o seed (applied via adm-sync-client antes do registro no adm_migrations).
--
-- Esta migration é idempotente: ON CONFLICT DO NOTHING garante que bancos que
-- já têm a linha não são afetados.

INSERT INTO public.bi_settings (singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;
