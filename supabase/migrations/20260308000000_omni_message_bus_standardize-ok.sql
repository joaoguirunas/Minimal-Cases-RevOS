-- OMNI PRO™ Message Bus Standardization
-- Sprint 1 / Phase 1 — Padronização source_type + module_ref_id + from_contact
-- Migration: 20260308000000

-- ── 1. Expand source_type constraint ──────────────────────────────────────────
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_source_type_check;

ALTER TABLE messages ADD CONSTRAINT messages_source_type_check
  CHECK (source_type IN (
    'inbound',              -- Recebida do cliente (whatsapp-inbound, instagram, etc.)
    'manual',               -- Enviada manualmente pelo usuário no OMNI PRO
    'ai_agent',             -- Enviada pelo ai-agent-execute
    'campaign',             -- SENDS PRO™ (send-dispatch-worker)
    'form',                 -- LP PRO™ (lp-submit automação pós-formulário)
    'followup',             -- Followup de etapa de pipeline
    'appointment_reminder'  -- Lembrete de reunião (process-meeting-followups)
  ));

COMMENT ON COLUMN messages.source_type IS
  'Módulo de origem da mensagem. NULL = legado. '
  'inbound=cliente enviou | manual=usuário OMNI | ai_agent=agente IA | '
  'campaign=SENDS PRO | form=LP Submit | followup=Followup Etapa | appointment_reminder=Lembrete Reunião';

-- ── 2. Adicionar module_ref_id ─────────────────────────────────────────────────
-- Referência genérica ao registro que originou (sem FK — polimórfico)
-- source_type=campaign → sends.id | form → lp_forms.id | appointment_reminder → meetings.id

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS module_ref_id uuid;

COMMENT ON COLUMN messages.module_ref_id IS
  'ID do registro de origem no módulo gerador (polimórfico, sem FK). '
  'campaign → sends.id | form → lp_forms.id | appointment_reminder → meetings.id';

CREATE INDEX IF NOT EXISTS idx_messages_module_ref_id
  ON messages(module_ref_id)
  WHERE module_ref_id IS NOT NULL;

-- ── 3. Padronizar from_contact: 'false' → 'sistema' ──────────────────────────
-- 'false' era valor legado para mensagens outbound do sistema
-- Canônico: 'cliente' | 'sistema' | 'agente_ia'

UPDATE messages
  SET from_contact = 'sistema'
  WHERE from_contact = 'false';

COMMENT ON COLUMN messages.from_contact IS
  'cliente=inbound do cliente | sistema=outbound pelo sistema/usuário | agente_ia=AI agent';

-- ── 4. Index para Delivery Engine (Sprint 2) ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_messages_pending_delivery
  ON messages(channel, created_at)
  WHERE status = 'pending' AND from_contact != 'cliente';
