-- =============================================================================
-- Voice Agents MVP — Story VA-01: agent_type + voice config fields
-- Epic: VOICE-AGENTS-MVP
-- PRD: docs/prd/VOICE-AGENTS-MVP.md (Section 5)
--
-- Adds agent_type ('text'|'voice') pivot column to ai_agents,
-- plus voice configuration fields for ElevenLabs Conversational AI sync.
--
-- Zero breaking changes: default 'text' preserves all existing agents.
-- Builds on top of EL-01 (20260319100000_elevenlabs_infrastructure.sql)
-- which already added: voice_enabled, voice_id, elevenlabs_agent_id
-- =============================================================================

-- ─── 1. Pivot column: agent_type ────────────────────────────────────────────

ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS agent_type text DEFAULT 'text';

-- Add CHECK constraint separately (IF NOT EXISTS not supported for constraints)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_agents_agent_type_check'
      AND conrelid = 'public.ai_agents'::regclass
  ) THEN
    ALTER TABLE public.ai_agents
      ADD CONSTRAINT ai_agents_agent_type_check
      CHECK (agent_type IN ('text', 'voice'));
  END IF;
END $$;

COMMENT ON COLUMN public.ai_agents.agent_type IS 'Agent type: text (default, current behavior) or voice (ElevenLabs Conversational AI)';

-- ─── 2. Voice configuration fields ─────────────────────────────────────────

ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS voice_first_message text;

ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS voice_language text DEFAULT 'pt';

ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS voice_model_id text;

ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS voice_stability real DEFAULT 0.5;

ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS voice_similarity real DEFAULT 0.75;

ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS voice_speed real DEFAULT 1.0;

COMMENT ON COLUMN public.ai_agents.voice_first_message IS 'Initial greeting for voice agent (what it says when answering)';
COMMENT ON COLUMN public.ai_agents.voice_language IS 'Language code for voice conversations (pt, en, es, etc.)';
COMMENT ON COLUMN public.ai_agents.voice_model_id IS 'ElevenLabs TTS model override (null = use default from settings_elevenlabs)';
COMMENT ON COLUMN public.ai_agents.voice_stability IS 'Voice stability 0.0-1.0 (higher = more consistent)';
COMMENT ON COLUMN public.ai_agents.voice_similarity IS 'Voice similarity boost 0.0-1.0 (higher = more faithful to original)';
COMMENT ON COLUMN public.ai_agents.voice_speed IS 'Voice speed 0.5-2.0 (1.0 = normal)';

-- ─── 3. ElevenLabs sync tracking ───────────────────────────────────────────

ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS el_sync_status text DEFAULT 'not_applicable';

-- Add CHECK constraint separately
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_agents_el_sync_status_check'
      AND conrelid = 'public.ai_agents'::regclass
  ) THEN
    ALTER TABLE public.ai_agents
      ADD CONSTRAINT ai_agents_el_sync_status_check
      CHECK (el_sync_status IN ('pending', 'synced', 'error', 'not_applicable'));
  END IF;
END $$;

ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS el_last_synced_at timestamptz;

COMMENT ON COLUMN public.ai_agents.el_sync_status IS 'ElevenLabs sync status: not_applicable (text agents), pending, synced, error';
COMMENT ON COLUMN public.ai_agents.el_last_synced_at IS 'Timestamp of last successful sync with ElevenLabs API';
