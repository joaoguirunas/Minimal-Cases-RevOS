-- Add url_id (simple sequential identifier) to booking_rule_sets
-- Used for cleaner public booking URLs: ?r=1 instead of ?r=uuid

ALTER TABLE public.booking_rule_sets
  ADD COLUMN IF NOT EXISTS url_id SMALLINT;

-- Populate existing rows with sequential numbers ordered by creation date
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS n
  FROM public.booking_rule_sets
)
UPDATE public.booking_rule_sets
SET url_id = numbered.n
FROM numbered
WHERE booking_rule_sets.id = numbered.id;

-- Unique index (partial: only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_rule_sets_url_id
  ON public.booking_rule_sets (url_id)
  WHERE url_id IS NOT NULL;

-- Auto-assign url_id on insert
CREATE OR REPLACE FUNCTION public.assign_booking_rule_set_url_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.url_id IS NULL THEN
    SELECT COALESCE(MAX(url_id), 0) + 1
    INTO NEW.url_id
    FROM public.booking_rule_sets;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_rule_sets_url_id ON public.booking_rule_sets;
CREATE TRIGGER trg_booking_rule_sets_url_id
  BEFORE INSERT ON public.booking_rule_sets
  FOR EACH ROW EXECUTE FUNCTION public.assign_booking_rule_set_url_id();
