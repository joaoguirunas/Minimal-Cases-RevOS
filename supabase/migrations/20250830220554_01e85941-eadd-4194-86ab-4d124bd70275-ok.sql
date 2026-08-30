-- Função para excluir agente e todos os dados relacionados
CREATE OR REPLACE FUNCTION public.excluir_agente_completo(agente_id uuid)
RETURNS void AS $$
BEGIN
  -- Verificar se o usuário tem permissão (gestor ou super_adm)
  IF NOT EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (gestor = true OR super_adm = true)
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas gestores podem executar esta ação';
  END IF;

  -- Deletar histórico de etapas
  DELETE FROM crm_agentes_ia_etapas_historico
  WHERE agente_ia_id = agente_id;
  
  -- Deletar histórico do agente
  DELETE FROM crm_agentes_ia_historico
  WHERE agente_ia_id = agente_id;
  
  -- Deletar etapas atuais
  DELETE FROM crm_agentes_ia_etapas
  WHERE agente_ia_id = agente_id;
  
  -- Deletar o agente
  DELETE FROM crm_agentes_ia
  WHERE id = agente_id;
  
  RAISE LOG 'Agente % excluído completamente', agente_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;