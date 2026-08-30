-- Tabela de Objetivos
CREATE TABLE score_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Rendas
CREATE TABLE score_incomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Enquadramentos
CREATE TABLE score_framings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela Matriz de Score
CREATE TABLE score_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id UUID NOT NULL REFERENCES score_objectives(id) ON DELETE CASCADE,
  income_id UUID NOT NULL REFERENCES score_incomes(id) ON DELETE CASCADE,
  framing_id UUID NOT NULL REFERENCES score_framings(id) ON DELETE CASCADE,
  score_number INTEGER NOT NULL CHECK (score_number >= 1 AND score_number <= 10),
  detail_score TEXT,
  profile_score TEXT,
  pre_description_score TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(objective_id, income_id, framing_id)
);

-- Adicionar coluna em clients_people
ALTER TABLE clients_people 
ADD COLUMN score_matrix_id UUID REFERENCES score_matrix(id) ON DELETE SET NULL;

-- Índices para performance
CREATE INDEX idx_score_matrix_objective ON score_matrix(objective_id);
CREATE INDEX idx_score_matrix_income ON score_matrix(income_id);
CREATE INDEX idx_score_matrix_framing ON score_matrix(framing_id);
CREATE INDEX idx_score_matrix_combination ON score_matrix(objective_id, income_id, framing_id);
CREATE INDEX idx_clients_people_score_matrix ON clients_people(score_matrix_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_score_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_score_objectives_updated_at
  BEFORE UPDATE ON score_objectives
  FOR EACH ROW EXECUTE FUNCTION update_score_updated_at();

CREATE TRIGGER update_score_incomes_updated_at
  BEFORE UPDATE ON score_incomes
  FOR EACH ROW EXECUTE FUNCTION update_score_updated_at();

CREATE TRIGGER update_score_framings_updated_at
  BEFORE UPDATE ON score_framings
  FOR EACH ROW EXECUTE FUNCTION update_score_updated_at();

CREATE TRIGGER update_score_matrix_updated_at
  BEFORE UPDATE ON score_matrix
  FOR EACH ROW EXECUTE FUNCTION update_score_updated_at();

-- RLS Policies
ALTER TABLE score_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_framings ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_matrix ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users full access to score_objectives"
  ON score_objectives FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to score_incomes"
  ON score_incomes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to score_framings"
  ON score_framings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to score_matrix"
  ON score_matrix FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);