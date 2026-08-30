
-- Add time_responsavel column to crm_leads table
ALTER TABLE crm_leads ADD COLUMN time_responsavel uuid;

-- Add comment to clarify the purpose
COMMENT ON COLUMN crm_leads.time_responsavel IS 'References the team responsible for this lead';
