-- Renomear tabelas de updates para ter prefixo clients_
ALTER TABLE IF EXISTS companies_updates RENAME TO clients_companies_updates;
ALTER TABLE IF EXISTS people_updates RENAME TO clients_people_updates;

-- Atualizar comentários se existirem
COMMENT ON TABLE clients_companies_updates IS 'Histórico de alterações em empresas';
COMMENT ON TABLE clients_people_updates IS 'Histórico de alterações em pessoas';