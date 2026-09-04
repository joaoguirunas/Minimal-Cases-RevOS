-- supabase/migrations/20260904110000_esteira_agent_click_rule.sql
-- LINKS-V2: o contexto passa a trazer "Cliques em links nossos: …". Regra curta pro agente usar isso.
UPDATE public.ai_agents
   SET general_rules = COALESCE(general_rules, '') || E'\n- CLIQUES: se o CONTEXTO diz que ele já abriu o link e não comprou, não reenvie o link de cara — pergunte em 1 frase o que travou (modelo, cor, frete, pagamento) e só então ofereça o link.'
 WHERE name = 'Minimal · Recuperação WhatsApp'
   AND COALESCE(general_rules, '') NOT LIKE '%CLIQUES:%';
