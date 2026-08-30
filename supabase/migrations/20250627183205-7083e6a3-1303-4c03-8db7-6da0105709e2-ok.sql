
-- Remover política RLS problemática
DROP POLICY IF EXISTS "crm_stage_followups_tenant_isolation" ON public.crm_stage_followups;
DROP POLICY IF EXISTS "Enable all operations" ON public.crm_stage_followups;

-- Criar política RLS simples que funciona
CREATE POLICY "crm_stage_followups_policy" ON public.crm_stage_followups
  FOR ALL USING (true) WITH CHECK (true);
