-- Fix: enforce bi_settings as a true singleton using a unique boolean column
-- This replaces the fragile SELECT→INSERT-or-UPDATE pattern in useBIProSettings

-- 1. Add singleton column (if missing)
ALTER TABLE public.bi_settings
  ADD COLUMN IF NOT EXISTS singleton boolean NOT NULL DEFAULT true;

-- 2. Unique constraint so only one row can have singleton = true
ALTER TABLE public.bi_settings
  DROP CONSTRAINT IF EXISTS bi_settings_singleton_key;
ALTER TABLE public.bi_settings
  ADD CONSTRAINT bi_settings_singleton_key UNIQUE (singleton);

-- 3. Delete duplicate rows keeping only the most recent
DELETE FROM public.bi_settings
WHERE id NOT IN (
  SELECT id FROM public.bi_settings ORDER BY updated_at DESC LIMIT 1
);

-- 4. Ensure the singleton row exists
INSERT INTO public.bi_settings (singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;
