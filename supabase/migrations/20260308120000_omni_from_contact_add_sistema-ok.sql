-- =============================================================================
-- Fix: messages.from_contact — adiciona 'sistema' ao constraint
-- =============================================================================
-- Sprint 1 (20260308000000) migrou from_contact='false' → 'sistema' nos dados,
-- mas a migration fix_messages_from_contact_constraint (20260308010000) que veio
-- depois redefiniu o constraint SEM incluir 'sistema'.
-- Resultado: send-dispatch-worker, useConversas e outros módulos que inserem
-- from_contact='sistema' recebem violação de constraint e o INSERT falha.
-- =============================================================================

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_from_contact_check;

ALTER TABLE messages
  ADD CONSTRAINT messages_from_contact_check
  CHECK (from_contact = ANY (ARRAY[
    'cliente'::text,    -- Inbound: mensagem recebida do cliente
    'humano'::text,     -- Outbound: enviada manualmente pelo atendente (OMNI PRO)
    'ia'::text,         -- Legado: AI response (antigo — preferir agente_ia)
    'agente_ia'::text,  -- Outbound: ai-agent-execute
    'sistema'::text     -- Outbound: sistema (campaigns, followups, LP automations)
  ]));

COMMENT ON COLUMN messages.from_contact IS
  'cliente=inbound do cliente | humano=agente manual OMNI | sistema=outbound sistema/campanha | agente_ia=AI agent | ia=legado';
