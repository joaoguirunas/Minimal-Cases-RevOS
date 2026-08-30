-- OMNI PRO™ Dead-Letter Queue — Retry failed deliveries
-- Epic: EPIC-OMNI-PRO-V2 | Story: OP-04
-- Captures messages that fail delivery and retries with exponential backoff

-- ── 1. Criar tabela omni_delivery_dead_letter ────────────────────────────────
CREATE TABLE IF NOT EXISTS omni_delivery_dead_letter (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id      integer NOT NULL REFERENCES messages(id),
  channel         text NOT NULL,
  error_code      text,
  error_message   text,
  attempts        integer DEFAULT 0,
  max_attempts    integer DEFAULT 5,
  next_retry_at   timestamptz,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'retrying', 'exhausted', 'resolved')),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

COMMENT ON TABLE omni_delivery_dead_letter IS
  'OMNI PRO™ dead-letter queue para mensagens que falharam no delivery engine. '
  'Retry exponencial: 1min, 5min, 30min, 2h, 12h (max 5 tentativas).';

-- ── 2. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX idx_dead_letter_retry
  ON omni_delivery_dead_letter (status, next_retry_at)
  WHERE status = 'pending';

CREATE INDEX idx_dead_letter_message
  ON omni_delivery_dead_letter (message_id);

-- ── 3. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE omni_delivery_dead_letter ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado ativo
DROP POLICY IF EXISTS "omni_dead_letter_read" ON omni_delivery_dead_letter;
CREATE POLICY "omni_dead_letter_read"
  ON omni_delivery_dead_letter FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM settings_users
      WHERE auth_user_id = auth.uid()
        AND active = true
        AND deleted_at IS NULL
    )
  );

-- Update: gestor ou super_admin (para "Retry Now" manual)
DROP POLICY IF EXISTS "omni_dead_letter_update" ON omni_delivery_dead_letter;
CREATE POLICY "omni_dead_letter_update"
  ON omni_delivery_dead_letter FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_admin = true OR user_type = 'gestor')
        AND active = true
        AND deleted_at IS NULL
    )
  );

-- ── 4. Trigger updated_at ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_dead_letter_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_dead_letter_updated_at
  BEFORE UPDATE ON omni_delivery_dead_letter
  FOR EACH ROW EXECUTE FUNCTION set_dead_letter_updated_at();
