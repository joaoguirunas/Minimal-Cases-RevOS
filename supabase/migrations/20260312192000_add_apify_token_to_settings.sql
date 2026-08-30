-- Add apify_token column to settings table for Prospect PRO™ integration
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS apify_token text;
