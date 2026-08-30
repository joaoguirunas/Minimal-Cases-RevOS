
-- Renomear tabela campanhas para crm_campanhas
ALTER TABLE public.campanhas RENAME TO crm_campanhas;

-- Renomear tabela campanha_contatos para crm_campanha_contatos
ALTER TABLE public.campanha_contatos RENAME TO crm_campanha_contatos;

-- Renomear tabela motivo_perda para crm_motivo_perda
ALTER TABLE public.motivo_perda RENAME TO crm_motivo_perda;

-- Atualizar as políticas RLS para as novas tabelas
-- Políticas para crm_campanhas
DROP POLICY IF EXISTS "Users can view campanhas from their tenant" ON public.crm_campanhas;
DROP POLICY IF EXISTS "Users can insert campanhas in their tenant" ON public.crm_campanhas;
DROP POLICY IF EXISTS "Users can update campanhas from their tenant" ON public.crm_campanhas;
DROP POLICY IF EXISTS "Users can delete campanhas from their tenant" ON public.crm_campanhas;

CREATE POLICY "Users can view campanhas from their tenant" ON public.crm_campanhas
    FOR SELECT USING (user_has_tenant_access(tenant_id));

CREATE POLICY "Users can insert campanhas in their tenant" ON public.crm_campanhas
    FOR INSERT WITH CHECK (user_has_tenant_access(tenant_id));

CREATE POLICY "Users can update campanhas from their tenant" ON public.crm_campanhas
    FOR UPDATE USING (user_has_tenant_access(tenant_id));

CREATE POLICY "Users can delete campanhas from their tenant" ON public.crm_campanhas
    FOR DELETE USING (user_has_tenant_access(tenant_id));

-- Políticas para crm_campanha_contatos
DROP POLICY IF EXISTS "Users can view campanha_contatos from their tenant" ON public.crm_campanha_contatos;
DROP POLICY IF EXISTS "Users can insert campanha_contatos in their tenant" ON public.crm_campanha_contatos;
DROP POLICY IF EXISTS "Users can update campanha_contatos from their tenant" ON public.crm_campanha_contatos;
DROP POLICY IF EXISTS "Users can delete campanha_contatos from their tenant" ON public.crm_campanha_contatos;

CREATE POLICY "Users can view campanha_contatos from their tenant" ON public.crm_campanha_contatos
    FOR SELECT USING (user_has_tenant_access(tenant_id));

CREATE POLICY "Users can insert campanha_contatos in their tenant" ON public.crm_campanha_contatos
    FOR INSERT WITH CHECK (user_has_tenant_access(tenant_id));

CREATE POLICY "Users can update campanha_contatos from their tenant" ON public.crm_campanha_contatos
    FOR UPDATE USING (user_has_tenant_access(tenant_id));

CREATE POLICY "Users can delete campanha_contatos from their tenant" ON public.crm_campanha_contatos
    FOR DELETE USING (user_has_tenant_access(tenant_id));

-- Políticas para crm_motivo_perda
DROP POLICY IF EXISTS "Users can view motivos from their tenant" ON public.crm_motivo_perda;
DROP POLICY IF EXISTS "Users can insert motivos in their tenant" ON public.crm_motivo_perda;
DROP POLICY IF EXISTS "Users can update motivos from their tenant" ON public.crm_motivo_perda;
DROP POLICY IF EXISTS "Users can delete motivos from their tenant" ON public.crm_motivo_perda;

CREATE POLICY "Users can view motivos from their tenant" ON public.crm_motivo_perda
    FOR SELECT USING (user_has_tenant_access(tenant_id));

CREATE POLICY "Users can insert motivos in their tenant" ON public.crm_motivo_perda
    FOR INSERT WITH CHECK (user_has_tenant_access(tenant_id));

CREATE POLICY "Users can update motivos from their tenant" ON public.crm_motivo_perda
    FOR UPDATE USING (user_has_tenant_access(tenant_id));

CREATE POLICY "Users can delete motivos from their tenant" ON public.crm_motivo_perda
    FOR DELETE USING (user_has_tenant_access(tenant_id));

-- Atualizar triggers
DROP TRIGGER IF EXISTS update_campanhas_updated_at ON public.crm_campanhas;
CREATE TRIGGER update_campanhas_updated_at
    BEFORE UPDATE ON public.crm_campanhas
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS update_campanha_contatos_updated_at ON public.crm_campanha_contatos;
CREATE TRIGGER update_campanha_contatos_updated_at
    BEFORE UPDATE ON public.crm_campanha_contatos
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS trigger_motivo_perda_updated_at ON public.crm_motivo_perda;
CREATE TRIGGER trigger_motivo_perda_updated_at
    BEFORE UPDATE ON public.crm_motivo_perda
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();
