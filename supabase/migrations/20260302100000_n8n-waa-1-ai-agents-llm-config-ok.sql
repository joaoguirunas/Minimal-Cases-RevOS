-- =============================================================================
-- N8N-WAA-1: Extend ai_agents — LLM + WhatsApp + buffer config
-- Epic: Native AI Agent Runtime (N8N-WAA)
-- Agent: @data-engineer
-- =============================================================================

-- LLM runtime configuration
ALTER TABLE ai_agents
  ADD COLUMN IF NOT EXISTS llm_provider       text    NOT NULL DEFAULT 'openai',
  ADD COLUMN IF NOT EXISTS llm_model          text    NOT NULL DEFAULT 'gpt-4o-mini',
  ADD COLUMN IF NOT EXISTS llm_temperature    float   NOT NULL DEFAULT 0.7,
  ADD COLUMN IF NOT EXISTS llm_max_tokens     int     NOT NULL DEFAULT 1024,
  ADD COLUMN IF NOT EXISTS llm_provider_id    uuid,   -- FK added after settings_ai_providers migration
  -- Conversation memory
  ADD COLUMN IF NOT EXISTS memory_window      int     NOT NULL DEFAULT 20,
  -- WhatsApp routing
  ADD COLUMN IF NOT EXISTS wa_phone_number_id text,
  -- Message debounce
  ADD COLUMN IF NOT EXISTS buffer_ms          int     NOT NULL DEFAULT 3000;

-- CHECK constraints
ALTER TABLE ai_agents
  ADD CONSTRAINT ai_agents_llm_provider_check
    CHECK (llm_provider IN ('openai', 'anthropic', 'groq', 'gemini')),
  ADD CONSTRAINT ai_agents_llm_temperature_check
    CHECK (llm_temperature >= 0.0 AND llm_temperature <= 2.0),
  ADD CONSTRAINT ai_agents_llm_max_tokens_check
    CHECK (llm_max_tokens > 0 AND llm_max_tokens <= 32768),
  ADD CONSTRAINT ai_agents_memory_window_check
    CHECK (memory_window > 0 AND memory_window <= 200),
  ADD CONSTRAINT ai_agents_buffer_ms_check
    CHECK (buffer_ms >= 0 AND buffer_ms <= 30000);

-- Column documentation
COMMENT ON COLUMN ai_agents.llm_provider     IS 'LLM provider: openai | anthropic | groq | gemini';
COMMENT ON COLUMN ai_agents.llm_model        IS 'Model ID (e.g. gpt-4o-mini, claude-3-5-haiku-20241022)';
COMMENT ON COLUMN ai_agents.llm_temperature  IS 'Sampling temperature 0.0–2.0 (default 0.7)';
COMMENT ON COLUMN ai_agents.llm_max_tokens   IS 'Max output tokens per LLM call (default 1024)';
COMMENT ON COLUMN ai_agents.llm_provider_id  IS 'FK to settings_ai_providers — global API key store';
COMMENT ON COLUMN ai_agents.memory_window    IS 'Number of past messages loaded as conversation context';
COMMENT ON COLUMN ai_agents.wa_phone_number_id IS 'Meta WhatsApp Business phone_number_id for this agent';
COMMENT ON COLUMN ai_agents.buffer_ms        IS 'Inbound message debounce window in ms (0 = process immediately)';
