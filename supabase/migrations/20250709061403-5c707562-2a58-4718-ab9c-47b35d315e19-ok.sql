
-- Renomear a coluna perfil para disc
ALTER TABLE crm_pessoas RENAME COLUMN perfil TO disc;

-- Renomear a coluna descricao_disc para disc_resumo  
ALTER TABLE crm_pessoas RENAME COLUMN descricao_disc TO disc_resumo;

-- Atualizar comentário da coluna
COMMENT ON COLUMN crm_pessoas.disc_resumo IS 'Resumo detalhado da análise DISC feita pela IA';
