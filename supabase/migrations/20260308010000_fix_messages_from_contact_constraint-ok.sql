-- =============================================================================
-- Fix: messages.from_contact CHECK constraint — adiciona 'agente_ia'
-- =============================================================================
-- PROBLEMA: constraint só permitia ('cliente', 'humano', 'ia')
-- ai-agent-execute insere from_contact='agente_ia' → constraint violation
-- → INSERT falha silenciosamente → nenhuma mensagem da IA gravada no DB
-- → whatsapp-outbound nunca chamado → usuário não recebe resposta
-- =============================================================================

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_from_contact_check;

ALTER TABLE messages
  ADD CONSTRAINT messages_from_contact_check
  CHECK (from_contact = ANY (ARRAY[
    'cliente'::text,
    'humano'::text,
    'ia'::text,
    'agente_ia'::text
  ]));
