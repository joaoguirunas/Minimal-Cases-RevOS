-- Multi-provider API keys for Prospect PRO
-- Adds Apollo.io and People Data Labs alongside existing Explorium

ALTER TABLE settings ADD COLUMN IF NOT EXISTS apollo_api_key text;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS pdl_api_key text;
