-- Add template_id field to crm_stage_followups table
ALTER TABLE crm_stage_followups 
ADD COLUMN template_id text;