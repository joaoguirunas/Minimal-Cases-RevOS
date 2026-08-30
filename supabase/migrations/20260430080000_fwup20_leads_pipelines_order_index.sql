-- FWUP-20: add order_index to leads_pipelines (absent from baseline)
-- usePipelinesReal.ts queries .order('order_index') — missing column causes DB error → empty result → invisible pipelines

ALTER TABLE public.leads_pipelines
  ADD COLUMN IF NOT EXISTS order_index integer NOT NULL DEFAULT 0;

-- Backfill existing rows with stable ordering based on creation time
UPDATE public.leads_pipelines p
SET    order_index = sub.rn
FROM (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at ASC) - 1) AS rn
  FROM public.leads_pipelines
) sub
WHERE p.id = sub.id
  AND p.order_index = 0;
