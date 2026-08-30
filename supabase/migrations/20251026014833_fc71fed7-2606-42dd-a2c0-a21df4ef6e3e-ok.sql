-- ============================================
-- REFATORAÇÃO: Remoção Completa de Empresas
-- ============================================

-- 1. Remover coluna companies_id da tabela leads
ALTER TABLE leads DROP COLUMN IF EXISTS companies_id;

-- 2. Dropar triggers e functions relacionadas a companies
DROP TRIGGER IF EXISTS track_companies_changes_trigger ON clients_companies;
DROP FUNCTION IF EXISTS track_companies_changes();

-- 3. Remover function de importação de empresas
DROP FUNCTION IF EXISTS import_empresa(jsonb);

-- 4. Dropar tabelas de empresas (em cascata para garantir)
DROP TABLE IF EXISTS clients_companies_updates CASCADE;
DROP TABLE IF EXISTS clients_people_companies CASCADE;
DROP TABLE IF EXISTS clients_companies CASCADE;

-- 5. Backup das tabelas (comentado, descomentar se necessário)
-- CREATE TABLE backup_clients_companies AS SELECT * FROM clients_companies;
-- CREATE TABLE backup_clients_people_companies AS SELECT * FROM clients_people_companies;
-- CREATE TABLE backup_clients_companies_updates AS SELECT * FROM clients_companies_updates;

-- Nota: A tabela clients_people continua intacta com todos os seus campos