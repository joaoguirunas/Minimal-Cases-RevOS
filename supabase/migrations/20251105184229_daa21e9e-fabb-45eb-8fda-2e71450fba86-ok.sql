-- Adicionar colunas de questionário à tabela clients_people
ALTER TABLE clients_people
ADD COLUMN Q1_age integer,
ADD COLUMN Q2_has_children boolean,
ADD COLUMN Q3_number_of_children integer,
ADD COLUMN Q4_qualification_1 text,
ADD COLUMN Q5_qualification_area text,
ADD COLUMN Q6_profession_current text,
ADD COLUMN Q7_profession_years text,
ADD COLUMN Q8_professional_recognition text,
ADD COLUMN Q9_foreign_citizenship boolean,
ADD COLUMN Q10_migration_process text,
ADD COLUMN Q11_decision_move_usa text,
ADD COLUMN Q12_start_process_time text,
ADD COLUMN Q13_household_income text;

-- Adicionar comentários descritivos para cada coluna
COMMENT ON COLUMN clients_people.Q1_age IS 'Qual a sua idade?';
COMMENT ON COLUMN clients_people.Q2_has_children IS 'Você possui filhos?';
COMMENT ON COLUMN clients_people.Q3_number_of_children IS 'Quantos filhos possui?';
COMMENT ON COLUMN clients_people.Q4_qualification_1 IS 'Qual a sua formação acadêmica? (faculdade, pós, mestrado…)';
COMMENT ON COLUMN clients_people.Q5_qualification_area IS 'Em qual área é sua formação?';
COMMENT ON COLUMN clients_people.Q6_profession_current IS 'Em que profissão atua atualmente?';
COMMENT ON COLUMN clients_people.Q7_profession_years IS 'Há quanto tempo atua nessa profissão?';
COMMENT ON COLUMN clients_people.Q8_professional_recognition IS 'Possui reconhecimento na área? (prêmios, palestras, artigos…)';
COMMENT ON COLUMN clients_people.Q9_foreign_citizenship IS 'Possui cidadania europeia ou canadense?';
COMMENT ON COLUMN clients_people.Q10_migration_process IS 'Já possui algum processo migratório em andamento? Onde?';
COMMENT ON COLUMN clients_people.Q11_decision_move_usa IS 'Já decidiu mesmo pela ida para os EUA?';
COMMENT ON COLUMN clients_people.Q12_start_process_time IS 'Em quanto tempo pensa em começar o processo?';
COMMENT ON COLUMN clients_people.Q13_household_income IS 'Qual é a renda familiar mensal aproximada?';