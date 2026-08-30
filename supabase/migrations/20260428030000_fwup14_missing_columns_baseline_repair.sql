-- FWUP-14: Missing columns — baseline repair para ORA e tenants similares
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- PROBLEMA:
--   6 migrations falham no ORA porque colunas não existem no baseline:
--     046 — channel_types, humanizacao, buffer_ms, memory_window, llm_temperature, llm_max_tokens em ai_agents
--     062 — meta_template_name em whatsapp_templates
--     075 — order_index em lead_field_definitions
--     081 — mesmo set de ai_agents acima
--     085 — person_id (era people_id antes do FWUP-11b) em meeting_followup_queue
--     087 — idem
--
-- SOLUÇÃO:
--   Adicionar colunas que faltam. No próximo CI run, as migrations com erro serão
--   re-tentadas e vão encontrar as colunas prontas.
--
-- IDEMPOTENTE: todos os blocos usam ADD COLUMN IF NOT EXISTS.
-- SEM BEGIN/COMMIT: auto-commit por statement (evita problema do baseline aberto).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. ai_agents: channel_types ──────────────────────────────────────────────
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS channel_types text[];

-- ── 2. ai_agents: humanizacao ────────────────────────────────────────────────
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS humanizacao text;

-- ── 3. ai_agents: buffer_ms ──────────────────────────────────────────────────
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS buffer_ms integer;

-- ── 4. ai_agents: memory_window ──────────────────────────────────────────────
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS memory_window integer;

-- ── 5. ai_agents: llm_temperature ────────────────────────────────────────────
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS llm_temperature float8;

-- ── 6. ai_agents: llm_max_tokens ─────────────────────────────────────────────
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS llm_max_tokens integer;

-- ── 7. whatsapp_templates: meta_template_name ────────────────────────────────
-- Migration 062 opera sobre whatsapp_templates (não settings_whatsapp_channels).
ALTER TABLE public.whatsapp_templates
  ADD COLUMN IF NOT EXISTS meta_template_name text;

-- ── 8. lead_field_definitions: order_index ───────────────────────────────────
ALTER TABLE public.lead_field_definitions
  ADD COLUMN IF NOT EXISTS order_index integer;
