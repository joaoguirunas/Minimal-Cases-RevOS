-- FWUP-11b: Rename meeting_followup_queue.people_id → person_id
-- Alinha nomenclatura com followup_queue.person_id (AC9 de FWUP-11 — omitido na migration original)

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'meeting_followup_queue'
      AND column_name  = 'people_id'
  ) THEN
    ALTER TABLE public.meeting_followup_queue RENAME COLUMN people_id TO person_id;
  END IF;
END $$;
