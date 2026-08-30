-- Corrigir a função criar_backup_agente para usar MAX(versao) + 1
CREATE OR REPLACE FUNCTION public.criar_backup_agente(agente_id uuid, changelog_text text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  nova_versao integer;
BEGIN
  -- Obter próxima versão baseada no MAX do histórico
  SELECT COALESCE(MAX(versao), 0) + 1 INTO nova_versao
  FROM crm_agentes_ia_historico 
  WHERE agente_ia_id = agente_id;
  
  -- Verificar se o agente existe
  IF NOT EXISTS (SELECT 1 FROM crm_agentes_ia WHERE id = agente_id) THEN
    RAISE EXCEPTION 'Agente não encontrado: %', agente_id;
  END IF;
  
  -- Backup do agente atual
  INSERT INTO crm_agentes_ia_historico (
    agente_ia_id, versao, dados_entrada, identidade, regras_gerais, 
    prompt_base, usa_etapas, changelog, created_by
  )
  SELECT 
    id, nova_versao, dados_entrada, identidade, regras_gerais,
    prompt_base, usa_etapas, COALESCE(changelog_text, 'Backup automático'), updated_by
  FROM crm_agentes_ia 
  WHERE id = agente_id;
  
  -- Backup das etapas atuais
  INSERT INTO crm_agentes_ia_etapas_historico (
    agente_ia_id, versao, nome_etapa, prompt_etapa, ordem, ativa
  )
  SELECT 
    agente_ia_id, nova_versao, nome_etapa, prompt_etapa, ordem, ativa
  FROM crm_agentes_ia_etapas 
  WHERE agente_ia_id = agente_id;
  
  -- Atualizar versão atual do agente
  UPDATE crm_agentes_ia 
  SET versao_atual = nova_versao, updated_at = now()
  WHERE id = agente_id;
  
  RAISE LOG 'Backup criado para agente % - Nova versão: %', agente_id, nova_versao;
END;
$function$;