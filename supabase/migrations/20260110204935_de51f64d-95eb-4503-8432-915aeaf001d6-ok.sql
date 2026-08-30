-- Adicionar campos de tracking de campanhas na tabela leads
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS utm_source text,
ADD COLUMN IF NOT EXISTS utm_medium text,
ADD COLUMN IF NOT EXISTS utm_campaign text,
ADD COLUMN IF NOT EXISTS utm_term text,
ADD COLUMN IF NOT EXISTS utm_content text,
ADD COLUMN IF NOT EXISTS gclid text,
ADD COLUMN IF NOT EXISTS fbclid text,
ADD COLUMN IF NOT EXISTS fb_lead_id text;

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.leads.utm_source IS 'Campaign Source - identifies search engine, newsletter name, or other source';
COMMENT ON COLUMN public.leads.utm_medium IS 'Campaign Medium - identifies medium such as email or cost-per-click';
COMMENT ON COLUMN public.leads.utm_campaign IS 'Campaign Name - identifies specific product promotion or strategic campaign';
COMMENT ON COLUMN public.leads.utm_term IS 'Campaign Term - used for paid search keywords';
COMMENT ON COLUMN public.leads.utm_content IS 'Campaign Content - used for A/B testing and content-targeted ads';
COMMENT ON COLUMN public.leads.gclid IS 'Google Click Identifier - Google Ads tracking';
COMMENT ON COLUMN public.leads.fbclid IS 'Facebook Click Identifier - Facebook Ads tracking';
COMMENT ON COLUMN public.leads.fb_lead_id IS 'Facebook Lead ID - Lead Ads form submission identifier';