-- Enable pg_trgm for fast ILIKE
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes for pessoa search fields
CREATE INDEX IF NOT EXISTS idx_crm_pessoas_nome_trgm ON public.crm_pessoas USING gin (lower(nome) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_crm_pessoas_email_trgm ON public.crm_pessoas USING gin (lower(email) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_crm_pessoas_whatsapp_trgm ON public.crm_pessoas USING gin (lower(whatsapp) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_crm_pessoas_obs_trgm ON public.crm_pessoas USING gin (lower(observacoes) gin_trgm_ops);

-- Trigram indexes for empresa search fields
CREATE INDEX IF NOT EXISTS idx_crm_empresas_nome_trgm ON public.crm_empresas USING gin (lower(nome_fantasia) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_crm_empresas_razao_trgm ON public.crm_empresas USING gin (lower(razao_social) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_crm_empresas_obs_trgm ON public.crm_empresas USING gin (lower(observacoes) gin_trgm_ops);

-- Trigram index for lead title
CREATE INDEX IF NOT EXISTS idx_crm_leads_titulo_trgm ON public.crm_leads USING gin (lower(titulo) gin_trgm_ops);

-- Helpful btree indexes for joins/filters
CREATE INDEX IF NOT EXISTS idx_crm_leads_tenant ON public.crm_leads (tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_person ON public.crm_leads (person_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_empresa ON public.crm_leads (empresa_id);
