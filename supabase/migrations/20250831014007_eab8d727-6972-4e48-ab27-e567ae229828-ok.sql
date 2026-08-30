-- Corrigir função criar_backup_agente para evitar duplicatas
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
  
  -- Verificar se já existe backup da versão atual
  SELECT EXISTS(
    SELECT 1 FROM crm_agentes_ia_historico 
    WHERE agente_ia_id = agente_id AND versao = current_version
  ) INTO backup_exists;
  
  -- Se backup já existe, não criar novamente
  IF backup_exists THEN
    RAISE LOG 'Backup da versão % já existe para agente %', current_version, agente_id;
    RETURN;
  END IF;
  
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
  
  -- Nova versão será a atual + 1
  nova_versao := current_version + 1;
  
  -- Atualizar versão atual do agente
  UPDATE crm_agentes_ia 
  SET versao_atual = nova_versao, updated_at = now()
  WHERE id = agente_id;
  
  RAISE LOG 'Backup criado para agente % - Versão: % -> Nova versão: %', agente_id, current_version, nova_versao;
END;
$function$;

-- Corrigir função restaurar versão para usar backup antes de restaurar
CREATE OR REPLACE FUNCTION public.restaurar_versao_agente(agente_id uuid, versao_restaurar integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_version integer;
BEGIN
  -- Verificar se o usuário tem permissão (gestor ou super_adm)
  IF NOT EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (gestor = true OR super_adm = true)
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas gestores podem executar esta ação';
  END IF;

  -- Obter versão atual
  SELECT versao_atual INTO current_version
  FROM crm_agentes_ia 
  WHERE id = agente_id;
  
  IF current_version IS NULL THEN
    RAISE EXCEPTION 'Agente não encontrado: %', agente_id;
  END IF;
  
  -- Verificar se a versão a restaurar existe
  IF NOT EXISTS (
    SELECT 1 FROM crm_agentes_ia_historico 
    WHERE agente_ia_id = agente_id AND versao = versao_restaurar
  ) THEN
    RAISE EXCEPTION 'Versão % não encontrada no histórico do agente %', versao_restaurar, agente_id;
  END IF;
  
  -- Criar backup da versão atual antes de restaurar
  PERFORM criar_backup_agente(agente_id, 'Backup antes de restaurar versão ' || versao_restaurar);
  
  -- Restaurar dados do agente
  UPDATE crm_agentes_ia SET
    dados_entrada = h.dados_entrada,
    identidade = h.identidade,
    regras_gerais = h.regras_gerais,
    prompt_base = h.prompt_base,
    usa_etapas = h.usa_etapas,
    updated_at = now()
  FROM crm_agentes_ia_historico h
  WHERE crm_agentes_ia.id = agente_id 
    AND h.agente_ia_id = agente_id 
    AND h.versao = versao_restaurar;
  
  -- Deletar etapas atuais
  DELETE FROM crm_agentes_ia_etapas WHERE agente_ia_id = agente_id;
  
  -- Restaurar etapas da versão
  INSERT INTO crm_agentes_ia_etapas (agente_ia_id, nome_etapa, prompt_etapa, ordem, ativa)
  SELECT agente_ia_id, nome_etapa, prompt_etapa, ordem, ativa
  FROM crm_agentes_ia_etapas_historico
  WHERE agente_ia_id = agente_id AND versao = versao_restaurar;
  
  RAISE LOG 'Versão % restaurada para agente %', versao_restaurar, agente_id;
END;
$function$;