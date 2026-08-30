-- 1. Criar tabela de junção ai_agents_score_matrix
CREATE TABLE IF NOT EXISTS public.ai_agents_score_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  score_matrix_id UUID NOT NULL REFERENCES public.score_matrix(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES public.settings_users(id),
  active BOOLEAN DEFAULT true,
  
  -- Constraint para evitar duplicatas
  CONSTRAINT unique_agent_matrix UNIQUE (ai_agent_id, score_matrix_id)
);

-- 2. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_ai_agents_score_matrix_agent_id 
  ON public.ai_agents_score_matrix(ai_agent_id);
  
CREATE INDEX IF NOT EXISTS idx_ai_agents_score_matrix_score_matrix_id 
  ON public.ai_agents_score_matrix(score_matrix_id);

CREATE INDEX IF NOT EXISTS idx_ai_agents_score_matrix_active 
  ON public.ai_agents_score_matrix(active) WHERE active = true;

-- 3. Habilitar RLS
ALTER TABLE public.ai_agents_score_matrix ENABLE ROW LEVEL SECURITY;

-- 4. Criar RLS Policies (apenas gestor/super_admin)
CREATE POLICY "Gestores podem visualizar associações"
  ON public.ai_agents_score_matrix
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM public.settings_users
      WHERE settings_users.auth_user_id = auth.uid()
        AND settings_users.ativo = true
        AND (settings_users.gestor = true OR settings_users.super_adm = true)
    )
  );

CREATE POLICY "Gestores podem criar associações"
  ON public.ai_agents_score_matrix
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.settings_users
      WHERE settings_users.auth_user_id = auth.uid()
        AND settings_users.ativo = true
        AND (settings_users.gestor = true OR settings_users.super_adm = true)
    )
  );

CREATE POLICY "Gestores podem atualizar associações"
  ON public.ai_agents_score_matrix
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM public.settings_users
      WHERE settings_users.auth_user_id = auth.uid()
        AND settings_users.ativo = true
        AND (settings_users.gestor = true OR settings_users.super_adm = true)
    )
  );

CREATE POLICY "Gestores podem deletar associações"
  ON public.ai_agents_score_matrix
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM public.settings_users
      WHERE settings_users.auth_user_id = auth.uid()
        AND settings_users.ativo = true
        AND (settings_users.gestor = true OR settings_users.super_adm = true)
    )
  );

-- 5. Criar função para auto-preencher created_by
CREATE OR REPLACE FUNCTION public.set_agent_score_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Busca o ID do usuário na tabela settings_users baseado no auth.uid()
  NEW.created_by := (
    SELECT id 
    FROM public.settings_users 
    WHERE auth_user_id = auth.uid() 
    LIMIT 1
  );
  
  RETURN NEW;
END;
$$;

-- 6. Criar trigger
DROP TRIGGER IF EXISTS set_agent_score_matrix_created_by ON public.ai_agents_score_matrix;

CREATE TRIGGER set_agent_score_matrix_created_by
  BEFORE INSERT ON public.ai_agents_score_matrix
  FOR EACH ROW
  EXECUTE FUNCTION public.set_agent_score_created_by();

-- 7. Comentários para documentação
COMMENT ON TABLE public.ai_agents_score_matrix IS 
  'Tabela de junção many-to-many entre ai_agents e score_matrix. Apenas gestor/super_admin podem gerenciar.';

COMMENT ON COLUMN public.ai_agents_score_matrix.created_by IS 
  'ID do usuário que criou a associação (auto-preenchido via trigger)';

COMMENT ON COLUMN public.ai_agents_score_matrix.active IS 
  'Permite soft delete - desativa associação sem excluir o registro';