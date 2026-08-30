-- Fase 1: Limpeza de Tabelas Não Utilizadas
-- Remove 4 tabelas que não são utilizadas pelo sistema

DROP TABLE IF EXISTS n8n_chat_histories CASCADE;
DROP TABLE IF EXISTS msg_buffer CASCADE;
DROP TABLE IF EXISTS sistema_buffer_agente CASCADE;
DROP TABLE IF EXISTS sistema_controle_agendamentos CASCADE;