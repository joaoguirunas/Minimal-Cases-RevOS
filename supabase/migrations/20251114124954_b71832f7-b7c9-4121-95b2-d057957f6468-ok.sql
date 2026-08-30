-- Renomear tabela score_incomes para score_investments
ALTER TABLE score_incomes RENAME TO score_investments;

-- Renomear coluna income_id para investment_id na tabela score_matrix
ALTER TABLE score_matrix RENAME COLUMN income_id TO investment_id;

-- Renomear coluna score_income_id para score_investment_id na tabela clients_people
ALTER TABLE clients_people RENAME COLUMN score_income_id TO score_investment_id;