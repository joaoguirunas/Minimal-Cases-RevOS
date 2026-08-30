-- Adicionar tipo às equipes (gestao ou delivery)
ALTER TABLE project_teams 
ADD COLUMN IF NOT EXISTS team_type text DEFAULT 'delivery' 
CHECK (team_type IN ('gestao', 'delivery'));

-- Adicionar tipo aos cargos/funções (gestao ou delivery)
ALTER TABLE project_job_functions 
ADD COLUMN IF NOT EXISTS function_type text DEFAULT 'delivery' 
CHECK (function_type IN ('gestao', 'delivery'));

-- Criar tabela de vinculação entre equipes de gestão e delivery
CREATE TABLE IF NOT EXISTS project_team_management_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_team_id uuid NOT NULL REFERENCES project_teams(id) ON DELETE CASCADE,
  management_team_id uuid NOT NULL REFERENCES project_teams(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(delivery_team_id, management_team_id)
);

-- Habilitar RLS na tabela de vínculos
ALTER TABLE project_team_management_links ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para vínculos
CREATE POLICY "team_links_select" ON project_team_management_links
FOR SELECT USING (
  is_team_member(delivery_team_id) OR is_team_member(management_team_id)
);

CREATE POLICY "team_links_insert" ON project_team_management_links
FOR INSERT WITH CHECK (
  is_team_admin(delivery_team_id)
);

CREATE POLICY "team_links_delete" ON project_team_management_links
FOR DELETE USING (
  is_team_admin(delivery_team_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_project_teams_team_type ON project_teams(team_type);
CREATE INDEX IF NOT EXISTS idx_project_job_functions_function_type ON project_job_functions(function_type);
CREATE INDEX IF NOT EXISTS idx_team_management_links_delivery ON project_team_management_links(delivery_team_id);
CREATE INDEX IF NOT EXISTS idx_team_management_links_management ON project_team_management_links(management_team_id);