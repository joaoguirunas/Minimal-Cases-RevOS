-- Remove old questionnaire fields (13 campos antigos de imigração)
ALTER TABLE clients_people 
  DROP COLUMN IF EXISTS q1_age,
  DROP COLUMN IF EXISTS q2_has_children,
  DROP COLUMN IF EXISTS q3_number_of_children,
  DROP COLUMN IF EXISTS q4_qualification_1,
  DROP COLUMN IF EXISTS q5_qualification_area,
  DROP COLUMN IF EXISTS q6_profession_current,
  DROP COLUMN IF EXISTS q7_profession_years,
  DROP COLUMN IF EXISTS q8_professional_recognition,
  DROP COLUMN IF EXISTS q9_foreign_citizenship,
  DROP COLUMN IF EXISTS q10_migration_process,
  DROP COLUMN IF EXISTS q11_decision_move_usa,
  DROP COLUMN IF EXISTS q12_start_process_time,
  DROP COLUMN IF EXISTS q13_household_income;

-- DIAGNÓSTICO (8 campos)
ALTER TABLE clients_people ADD COLUMN q1_main_bottleneck TEXT;
ALTER TABLE clients_people ADD COLUMN q2_lead_volume_month INTEGER;
ALTER TABLE clients_people ADD COLUMN q3_team_size INTEGER;
ALTER TABLE clients_people ADD COLUMN q4_crm_maturity TEXT;
ALTER TABLE clients_people ADD COLUMN q5_crm_name TEXT;
ALTER TABLE clients_people ADD COLUMN q6_trigger TEXT;
ALTER TABLE clients_people ADD COLUMN q7_problem_impact TEXT;
ALTER TABLE clients_people ADD COLUMN q8_engagement_level TEXT;

-- QUALIFICAÇÃO (12 campos)
ALTER TABLE clients_people ADD COLUMN q9_decision_authority TEXT;
ALTER TABLE clients_people ADD COLUMN q10_stakeholders TEXT;
ALTER TABLE clients_people ADD COLUMN q11_budget_approved TEXT;
ALTER TABLE clients_people ADD COLUMN q12_timeline TEXT;
ALTER TABLE clients_people ADD COLUMN q13_urgency_reason TEXT;
ALTER TABLE clients_people ADD COLUMN q14_data_ready TEXT;
ALTER TABLE clients_people ADD COLUMN q15_minimum_volume TEXT;
ALTER TABLE clients_people ADD COLUMN q16_expected_roi TEXT;
ALTER TABLE clients_people ADD COLUMN q17_objections TEXT;
ALTER TABLE clients_people ADD COLUMN q18_real_fit TEXT;
ALTER TABLE clients_people ADD COLUMN q19_qualification_status TEXT;
ALTER TABLE clients_people ADD COLUMN q20_rejection_reason TEXT;

-- CONTEXTO GLOBAL (4 campos)
ALTER TABLE clients_people ADD COLUMN q21_interest_level INTEGER;
ALTER TABLE clients_people ADD COLUMN q22_close_probability INTEGER;
ALTER TABLE clients_people ADD COLUMN q23_behavioral_tags TEXT;
ALTER TABLE clients_people ADD COLUMN q24_last_update_by_agent TEXT;

-- DISC (2 campos)
ALTER TABLE clients_people ADD COLUMN q25_disc_profile TEXT;
ALTER TABLE clients_people ADD COLUMN q26_disc_analysis TEXT;

-- COMMENTS em cada coluna
COMMENT ON COLUMN clients_people.q1_main_bottleneck IS 'Q1: Gargalo principal identificado';
COMMENT ON COLUMN clients_people.q2_lead_volume_month IS 'Q2: Volume de leads por mês';
COMMENT ON COLUMN clients_people.q3_team_size IS 'Q3: Tamanho da equipe comercial';
COMMENT ON COLUMN clients_people.q4_crm_maturity IS 'Q4: Maturidade do CRM/Dados';
COMMENT ON COLUMN clients_people.q5_crm_name IS 'Q5: Nome do CRM utilizado';
COMMENT ON COLUMN clients_people.q6_trigger IS 'Q6: Gatilho que motivou a busca';
COMMENT ON COLUMN clients_people.q7_problem_impact IS 'Q7: Impacto do problema atual';
COMMENT ON COLUMN clients_people.q8_engagement_level IS 'Q8: Nível de engajamento';
COMMENT ON COLUMN clients_people.q9_decision_authority IS 'Q9: Autoridade de decisão';
COMMENT ON COLUMN clients_people.q10_stakeholders IS 'Q10: Outros stakeholders envolvidos';
COMMENT ON COLUMN clients_people.q11_budget_approved IS 'Q11: Budget está aprovado?';
COMMENT ON COLUMN clients_people.q12_timeline IS 'Q12: Timeline de implementação';
COMMENT ON COLUMN clients_people.q13_urgency_reason IS 'Q13: Razão da urgência real';
COMMENT ON COLUMN clients_people.q14_data_ready IS 'Q14: CRM e dados organizados?';
COMMENT ON COLUMN clients_people.q15_minimum_volume IS 'Q15: Volume mínimo de leads';
COMMENT ON COLUMN clients_people.q16_expected_roi IS 'Q16: ROI ou resultado esperado';
COMMENT ON COLUMN clients_people.q17_objections IS 'Q17: Principais objeções';
COMMENT ON COLUMN clients_people.q18_real_fit IS 'Q18: Fit real - avaliação do agente';
COMMENT ON COLUMN clients_people.q19_qualification_status IS 'Q19: Status da qualificação';
COMMENT ON COLUMN clients_people.q20_rejection_reason IS 'Q20: Motivo se não aprovado';
COMMENT ON COLUMN clients_people.q21_interest_level IS 'Q21: Nível de interesse (0-10)';
COMMENT ON COLUMN clients_people.q22_close_probability IS 'Q22: Probabilidade de fechar (0-100%)';
COMMENT ON COLUMN clients_people.q23_behavioral_tags IS 'Q23: Tags comportamentais';
COMMENT ON COLUMN clients_people.q24_last_update_by_agent IS 'Q24: Última atualização por agente';
COMMENT ON COLUMN clients_people.q25_disc_profile IS 'Q25: Perfil DISC identificado';
COMMENT ON COLUMN clients_people.q26_disc_analysis IS 'Q26: Análise DISC e recomendações';

-- Índices para campos de busca/filtro
CREATE INDEX idx_q8_engagement_level ON clients_people(q8_engagement_level);
CREATE INDEX idx_q19_qualification_status ON clients_people(q19_qualification_status);
CREATE INDEX idx_q21_interest_level ON clients_people(q21_interest_level);
CREATE INDEX idx_q22_close_probability ON clients_people(q22_close_probability);