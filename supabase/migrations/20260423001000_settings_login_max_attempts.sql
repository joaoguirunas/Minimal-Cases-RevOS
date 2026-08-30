-- Add login_max_attempts to settings table for tenant-level rate limit configuration
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS login_max_attempts integer DEFAULT 5;
