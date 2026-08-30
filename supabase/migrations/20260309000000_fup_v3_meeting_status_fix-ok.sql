-- FUP v3 — Meeting Status Constraint Fix
-- Corrige meetings_followups.meeting_status para usar 'não compareceu'
-- (com espaço e acento), alinhando com o frontend e com meetings.status (P7).

-- ── 1. Drop constraint antiga (usa underscore 'nao_compareceu') ──────────────

ALTER TABLE public.meetings_followups
  DROP CONSTRAINT IF EXISTS meetings_followups_meeting_status_check;

-- ── 2. Normaliza dados existentes ───────────────────────────────────────────

UPDATE public.meetings_followups
  SET meeting_status = 'não compareceu'
  WHERE meeting_status = 'nao_compareceu';

-- ── 3. Recria constraint com o valor correto ─────────────────────────────────

ALTER TABLE public.meetings_followups
  ADD CONSTRAINT meetings_followups_meeting_status_check
  CHECK (meeting_status IN ('agendado', 'compareceu', 'não compareceu', 'cancelado'));

-- ── 4. messages.from_contact — garantir que 'sistema' está no CHECK ──────────
-- (P11 adicionou 'agente_ia', migration 20260308120000 adicionou 'sistema')
-- Esta linha é idempotente: se já existe, não faz nada.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'messages_from_contact_check'
      AND conrelid = 'public.messages'::regclass
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_from_contact_check
      CHECK (from_contact IN ('cliente', 'sistema', 'agente_ia'));
  END IF;
END $$;
