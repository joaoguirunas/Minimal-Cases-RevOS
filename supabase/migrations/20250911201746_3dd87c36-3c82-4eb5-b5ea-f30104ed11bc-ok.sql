-- PHASE 2 SECURITY FIX: Complete the remaining table security implementation
-- Fix error: Skip crm_pessoas policies that already exist, focus on remaining critical tables

-- First check if remaining critical tables need fixing and add proper search paths to functions

-- 1. SECURE crm_campanha_contatos table (if not already secured)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.crm_campanha_contatos;
DROP POLICY IF EXISTS "Public read access" ON public.crm_campanha_contatos;

-- Check if secure policies already exist, if not create them
DO $$
BEGIN
    -- Only create if policy doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'crm_campanha_contatos' 
        AND policyname = 'Secure: Users can view campanha_contatos from their tenant'
    ) THEN
        CREATE POLICY "Secure: Users can view campanha_contatos from their tenant"
        ON public.crm_campanha_contatos
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.crm_usuarios u
            WHERE u.auth_user_id = auth.uid()
            AND (u.tenant_id = crm_campanha_contatos.tenant_id OR u.super_adm = true)
            AND u.ativo = true
          )
        );
    END IF;
END $$;

-- 2. SECURE crm_leads table (if not already secured)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.crm_leads;
DROP POLICY IF EXISTS "Public read access" ON public.crm_leads;

-- 3. SECURE crm_empresas table (if not already secured)  
DROP POLICY IF EXISTS "Enable read access for all users" ON public.crm_empresas;
DROP POLICY IF EXISTS "Public read access" ON public.crm_empresas;

-- 4. SECURE crm_messages table (if not already secured)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.crm_messages;
DROP POLICY IF EXISTS "Public read access" ON public.crm_messages;

-- 5. SECURE crm_llm_connections table (if not already secured)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.crm_llm_connections;
DROP POLICY IF EXISTS "Public read access" ON public.crm_llm_connections;

-- 6. SECURE crm_database_connections table (if not already secured)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.crm_database_connections;
DROP POLICY IF EXISTS "Public read access" ON public.crm_database_connections;

-- 7. SECURE DATABASE FUNCTIONS - Add proper search path to remaining functions
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

CREATE OR REPLACE FUNCTION public.excluir_agente_completo(agente_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.delete_pessoa_and_related_data(pessoa_id_param uuid, tenant_id_param uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Verificar se o usuário atual é gestor, admin ou super_adm
  IF NOT EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (
      (tenant_id = tenant_id_param AND (gestor = true OR super_adm = true))
      OR super_adm = true
    )
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas gestores e administradores podem executar esta ação';
  END IF;

  -- Deletar agendamentos relacionados aos negócios da pessoa
  DELETE FROM crm_agendamentos
  WHERE negocio_id IN (
    SELECT id FROM crm_leads 
    WHERE person_id = pessoa_id_param AND tenant_id = tenant_id_param
  );

  -- Deletar arquivos dos negócios
  DELETE FROM crm_negocio_arquivos
  WHERE negocio_id IN (
    SELECT id FROM crm_leads 
    WHERE person_id = pessoa_id_param AND tenant_id = tenant_id_param
  );

  -- Deletar notas dos negócios
  DELETE FROM crm_negocio_notas
  WHERE negocio_id IN (
    SELECT id FROM crm_leads 
    WHERE person_id = pessoa_id_param AND tenant_id = tenant_id_param
  );

  -- Deletar mensagens da pessoa
  DELETE FROM crm_messages
  WHERE pessoa_id = pessoa_id_param AND tenant_id = tenant_id_param;

  -- Deletar negócios da pessoa
  DELETE FROM crm_leads
  WHERE person_id = pessoa_id_param AND tenant_id = tenant_id_param;

  -- Deletar relacionamentos pessoa-empresa
  DELETE FROM crm_pessoa_empresas
  WHERE pessoa_id = pessoa_id_param AND tenant_id = tenant_id_param;

  -- Deletar a pessoa
  DELETE FROM crm_pessoas
  WHERE id = pessoa_id_param AND tenant_id = tenant_id_param;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao deletar pessoa e dados relacionados: %', SQLERRM;
END;
$function$;