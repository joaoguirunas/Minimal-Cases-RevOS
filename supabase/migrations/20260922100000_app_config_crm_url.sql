-- URL pública do CRM. O agente monta links que um humano abre fora do app — o
-- principal é o link da conversa no aviso de handoff mandado ao grupo do
-- atendimento. Fica em _app_config, junto de supabase_url, para trocar de
-- domínio sem publicar função.
INSERT INTO public._app_config (key, value)
VALUES ('crm_url', 'https://crm.minimalcases.com.br')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
