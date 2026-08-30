-- FASE 1: Limpeza de tabelas vazias (sem uso)
-- Remove tabelas antigas e novas que não têm dados nem código dependente

-- Tabelas antigas vazias (CRM)
DROP TABLE IF EXISTS crm_basesconhecimento CASCADE;
DROP TABLE IF EXISTS crm_basesconhecimento_chunks CASCADE;
DROP TABLE IF EXISTS crm_agentes_ia CASCADE;
DROP TABLE IF EXISTS crm_agentes_ia_etapas CASCADE;
DROP TABLE IF EXISTS crm_agentes_ia_historico CASCADE;
DROP TABLE IF EXISTS crm_agentes_ia_etapas_historico CASCADE;
DROP TABLE IF EXISTS crm_campanha_contatos CASCADE;
DROP TABLE IF EXISTS crm_campanhas CASCADE;

-- Tabelas novas vazias (duplicadas sem uso)
DROP TABLE IF EXISTS knowledge_bases CASCADE;
DROP TABLE IF EXISTS knowledge_bases_chunks CASCADE;
DROP TABLE IF EXISTS ai_agents CASCADE;
DROP TABLE IF EXISTS ai_agents_history CASCADE;
DROP TABLE IF EXISTS ai_agents_stages CASCADE;
DROP TABLE IF EXISTS ai_agents_stages_history CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS campaigns_contacts CASCADE;
DROP TABLE IF EXISTS campaigns_updates CASCADE;