-- Corrigir função criar_backup_agente para funcionar corretamente
CREATE OR REPLACE FUNCTION public.criar_backup_agente(agente_id uuid, changelog_text text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  nova_versao integer;
  current_version integer;
  backup_exists boolean;
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
  
  -- Verificar se já existe backup da versão atual (para evitar duplicatas)
  SELECT EXISTS(
    SELECT 1 FROM crm_agentes_ia_historico 
    WHERE agente_ia_id = agente_id AND versao = current_version
  ) INTO backup_exists;
  
  -- Se backup ainda não existe, criar
  IF NOT backup_exists THEN
    -- Backup do agente atual
    INSERT INTO crm_agentes_ia_historico (
      agente_ia_id, versao, dados_entrada, identidade, regras_gerais, 
      prompt_base, usa_etapas, changelog, created_by
    )
    SELECT 
      id, current_version, dados_entrada, identidade, regras_gerais,
      prompt_base, usa_etapas, COALESCE(changelog_text, 'Backup automático'), updated_by
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
    
    RAISE LOG 'Backup criado para agente % - Versão: %', agente_id, current_version;
  END IF;
  
  -- SEMPRE atualizar para nova versão (mesmo se backup já existia)
  UPDATE crm_agentes_ia 
  SET versao_atual = nova_versao, updated_at = now()
  WHERE id = agente_id;
  
  RAISE LOG 'Agente % atualizado para versão %', agente_id, nova_versao;
END;
$function$;