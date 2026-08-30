-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  Expand elevenlabs_voices for shared library + metadata                   ║
-- ║  Adds: gender, use_case, labels (jsonb), source (workspace|shared)        ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.elevenlabs_voices ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE public.elevenlabs_voices ADD COLUMN IF NOT EXISTS use_case text;
ALTER TABLE public.elevenlabs_voices ADD COLUMN IF NOT EXISTS labels jsonb DEFAULT '{}';
ALTER TABLE public.elevenlabs_voices ADD COLUMN IF NOT EXISTS source text DEFAULT 'workspace';

COMMENT ON COLUMN public.elevenlabs_voices.gender IS 'Voice gender: male, female, neutral';
COMMENT ON COLUMN public.elevenlabs_voices.use_case IS 'Primary use case: narration, conversational, characters, etc.';
COMMENT ON COLUMN public.elevenlabs_voices.labels IS 'Full labels object from ElevenLabs API (language, accent, age, etc.)';
COMMENT ON COLUMN public.elevenlabs_voices.source IS 'workspace = user library, shared = ElevenLabs shared library';
