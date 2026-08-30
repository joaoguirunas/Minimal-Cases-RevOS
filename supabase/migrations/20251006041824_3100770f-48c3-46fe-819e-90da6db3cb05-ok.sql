-- Remover tabelas relacionadas a LLM
DROP TABLE IF EXISTS settings_llm_usage_logs CASCADE;
DROP TABLE IF EXISTS settings_llm_connections CASCADE;

-- Remover tabelas relacionadas a campanhas/disparos (se existirem)
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS campaigns_contacts CASCADE;
DROP TABLE IF EXISTS campaigns_updates CASCADE;