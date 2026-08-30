-- DIAGNÓSTICO E CORREÇÃO FINAL DA RECURSÃO INFINITA
-- ========================================================================

-- 1. DESABILITAR RLS TEMPORARIAMENTE PARA DIAGNÓSTICO
ALTER TABLE crm_usuarios DISABLE ROW LEVEL SECURITY;

-- 2. REMOVER ABSOLUTAMENTE TODAS AS POLÍTICAS (incluindo qualquer uma que possa ter sobrado)
SELECT 'Removendo política: ' || schemaname || '.' || tablename || '.' || policyname 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'crm_usuarios';

-- Dropar todas as políticas de forma segura
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'crm_usuarios'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON crm_usuarios';
        RAISE LOG 'Dropped policy: %', policy_record.policyname;
    END LOOP;
END $$;

-- 3. REATIVAR RLS
ALTER TABLE crm_usuarios ENABLE ROW LEVEL SECURITY;

-- 4. CRIAR POLÍTICAS ULTRA-SIMPLES SEM NENHUMA FUNÇÃO PERSONALIZADA
-- Baseadas APENAS em auth.uid() direto

-- SELECT: Apenas próprio registro OU super admins específicos por email
CREATE POLICY "ultra_simple_select" ON crm_usuarios
FOR SELECT
USING (
  auth_user_id = auth.uid() 
  OR 
  auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

-- UPDATE: Apenas próprio registro OU super admins específicos  
CREATE POLICY "ultra_simple_update" ON crm_usuarios
FOR UPDATE
USING (
  auth_user_id = auth.uid()
  OR 
  auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

-- INSERT: Apenas próprio registro OU super admins específicos
CREATE POLICY "ultra_simple_insert" ON crm_usuarios
FOR INSERT
WITH CHECK (
  auth_user_id = auth.uid()
  OR 
  auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

-- DELETE: Apenas super admins específicos
CREATE POLICY "ultra_simple_delete" ON crm_usuarios
FOR DELETE
USING (
  auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

-- 5. VERIFICAR SE rafaela@iatize.com EXISTE NA TABELA
INSERT INTO crm_usuarios (auth_user_id, nome, email, super_adm, gestor, ativo, tenant_id)
SELECT 
  '77234261-18b8-497b-adee-172124ebc4f9'::uuid,
  'Rafa',
  'rafaela@iatize.com',
  true,
  true,
  true,
  (SELECT id FROM crm_tenants WHERE value = 'iatize' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM crm_usuarios 
  WHERE auth_user_id = '77234261-18b8-497b-adee-172124ebc4f9'::uuid
);

-- 6. LOG DE CONFIRMAÇÃO
DO $$
BEGIN
  RAISE LOG 'Políticas RLS ultra-simples criadas - recursão eliminada definitivamente';
  RAISE LOG 'Políticas ativas: %', (
    SELECT string_agg(policyname, ', ') 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'crm_usuarios'
  );
END;
$$;