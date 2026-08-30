-- Add source column to meetings to distinguish platform-created vs Google-synced events
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS source text DEFAULT NULL;

-- Optional: index for filtering by source in list views
CREATE INDEX IF NOT EXISTS meetings_source_idx ON public.meetings(source)
  WHERE source IS NOT NULL;
