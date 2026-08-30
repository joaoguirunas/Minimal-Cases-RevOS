
-- Remover todas as políticas RLS existentes que podem estar causando problemas
DROP POLICY IF EXISTS "tenant_access_empresas" ON crm_empresas;
DROP POLICY IF EXISTS "Gestores podem gerenciar empresas do tenant" ON crm_empresas;
DROP POLICY IF EXISTS "Permitir acesso público aos clientes" ON crm_empresas;
DROP POLICY IF EXISTS "Allow all for development" ON crm_empresas;

DROP POLICY IF EXISTS "tenant_access_pessoas" ON crm_pessoas;
DROP POLICY IF EXISTS "Gestores podem gerenciar pessoas do tenant" ON crm_pessoas;
DROP POLICY IF EXISTS "Permitir acesso público aos usuários" ON crm_pessoas;

DROP POLICY IF EXISTS "tenant_access_leads" ON crm_leads;
DROP POLICY IF EXISTS "Gestores podem gerenciar leads do tenant" ON crm_leads;

DROP POLICY IF EXISTS "tenant_access_messages" ON crm_messages;
DROP POLICY IF EXISTS "Gestores podem gerenciar mensagens do tenant" ON crm_messages;

DROP POLICY IF EXISTS "tenant_access_pipelines" ON crm_pipelines;
DROP POLICY IF EXISTS "Gestores podem gerenciar pipelines do tenant" ON crm_pipelines;

DROP POLICY IF EXISTS "tenant_access_stages" ON crm_stages;
DROP POLICY IF EXISTS "Gestores podem gerenciar stages do tenant" ON crm_stages;

-- Garantir que as tabelas tenham RLS habilitado
ALTER TABLE crm_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_pessoas ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_stages ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS simples que permitem acesso total (sem app.current_tenant_id)
CREATE POLICY "allow_all_empresas" ON crm_empresas FOR ALL USING (true);
CREATE POLICY "allow_all_pessoas" ON crm_pessoas FOR ALL USING (true);
CREATE POLICY "allow_all_leads" ON crm_leads FOR ALL USING (true);
CREATE POLICY "allow_all_messages" ON crm_messages FOR ALL USING (true);
CREATE POLICY "allow_all_pipelines" ON crm_pipelines FOR ALL USING (true);
CREATE POLICY "allow_all_stages" ON crm_stages FOR ALL USING (true);

-- Limpar configurações de sessão
RESET ALL;
