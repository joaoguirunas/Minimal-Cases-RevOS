-- Corrigir função de backup para incrementar versão corretamente
CREATE OR REPLACE FUNCTION public.criar_backup_agente(agente_id uuid, changelog_text text DEFAULT NULL)
RETURNS void AS $$
DECLARE
  nova_versao integer;
  current_version integer;
BEGIN
  -- Obter versão atual do agente
  SELECT versao_atual INTO current_version
  FROM crm_agentes_ia 
  WHERE id = agente_id;
  
  -- Se não encontrou o agente, retornar erro
  IF current_version IS NULL THEN
    RAISE EXCEPTION 'Agente não encontrado: %', agente_id;
  END IF;
  
  -- Nova versão será a atual + 1
  nova_versao := current_version + 1;
  
  -- Backup do agente atual
  INSERT INTO crm_agentes_ia_historico (
    agente_ia_id, versao, dados_entrada, identidade, regras_gerais, 
    prompt_base, usa_etapas, changelog, created_by
  )
  SELECT 
    id, current_version, dados_entrada, identidade, regras_gerais,
    prompt_base, usa_etapas, changelog_text, updated_by
  FROM crm_agentes_ia 
  WHERE id = agente_id;
  
  -- Backup das etapas atuais
  INSERT INTO crm_agentes_ia_etapas_historico (
    agente_ia_id, versao, nome_etapa, prompt_etapa, ordem, ativa
  )
  SELECT 
    agente_ia_id, current_version, nome_etapa, prompt_etapa, ordem, ativa
  FROM crm_agentes_ia_etapas 
  WHERE agente_ia_id = agente_id;
  
  -- Atualizar versão atual do agente
  UPDATE crm_agentes_ia 
  SET versao_atual = nova_versao, updated_at = now()
  WHERE id = agente_id;
  
  RAISE LOG 'Backup criado para agente % - Versão atual: % -> Nova versão: %', agente_id, current_version, nova_versao;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;