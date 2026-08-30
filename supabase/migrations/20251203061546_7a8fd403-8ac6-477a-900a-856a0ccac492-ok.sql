-- Add link and transcription columns to project_meetings
ALTER TABLE public.project_meetings
ADD COLUMN link TEXT,
ADD COLUMN transcription TEXT;