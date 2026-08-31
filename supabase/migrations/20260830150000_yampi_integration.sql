-- YMP-1.1 — Yampi e-commerce integration (checkout da loja Shopify Minimal Cases).
--
-- Mirrors the Kiwify module (kiwify_connections / kiwify_webhook_events):
--   * yampi_connections     — single-tenant credential row (User-Token/User-Secret-Key
--                             encrypted via app_encrypt_secret, context 'yampi_'||alias),
--                             plus the webhook secret_key Yampi returns on registration.
--   * yampi_webhook_events  — idempotent inbound event log (unique connection/event/dedup).
--
-- Canonical triggers derived from Yampi webhook events (yampi-inbound/logic.ts):
--   carrinho_abandonado (cart.reminder), pix_gerado / boleto_gerado / pedido_criado
--   (order.created, split by payment alias), pedido_pago (order.paid),
--   pedido_cancelado / pedido_status_atualizado (order.status.updated),
--   pagamento_recusado (transaction.payment.refused).
--
-- Unlike Kiwify, the Yampi HMAC mechanism IS officially documented
-- (X-Yampi-Hmac-SHA256 = base64(HMAC-SHA256(raw_body, secret_key))), so
-- enforce_signature defaults to TRUE.

BEGIN;

-- ── Connection ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.yampi_connections (
    id                  uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    alias               text NOT NULL,
    user_token_enc      text NOT NULL,
    user_secret_enc     text NOT NULL,
    webhook_id          text,
    webhook_secret_enc  text,
    enforce_signature   boolean DEFAULT true NOT NULL,
    status              text DEFAULT 'disconnected' NOT NULL,
    last_error          text,
    created_at          timestamptz DEFAULT now() NOT NULL,
    updated_at          timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT yampi_connections_status_check
      CHECK (status = ANY (ARRAY['disconnected', 'connected', 'error']))
);

COMMENT ON TABLE public.yampi_connections IS
  'Yampi store connection (single-tenant). Secrets encrypted via app_encrypt_secret with context ''yampi_''||alias.';
COMMENT ON COLUMN public.yampi_connections.user_token_enc IS 'Encrypted Yampi User-Token. Never store plaintext.';
COMMENT ON COLUMN public.yampi_connections.user_secret_enc IS 'Encrypted Yampi User-Secret-Key. Never store plaintext.';
COMMENT ON COLUMN public.yampi_connections.webhook_secret_enc IS
  'Encrypted secret_key returned by POST /{alias}/webhooks — key for X-Yampi-Hmac-SHA256 validation.';

-- ── Inbound event log ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.yampi_webhook_events (
    id               uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    connection_id    uuid NOT NULL REFERENCES public.yampi_connections(id) ON DELETE CASCADE,
    trigger          text,
    event_type       text NOT NULL,
    order_id         text,
    cart_token       text,
    people_id        uuid,
    dedup_key        text NOT NULL,
    raw_payload      jsonb NOT NULL,
    signature_valid  boolean DEFAULT false NOT NULL,
    status           text DEFAULT 'received' NOT NULL,
    processed_at     timestamptz,
    error            text,
    created_at       timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT yampi_webhook_events_status_check
      CHECK (status = ANY (ARRAY['received', 'processing', 'processed', 'failed', 'ignored']))
);

COMMENT ON TABLE public.yampi_webhook_events IS
  'Raw Yampi webhook deliveries. Idempotent on (connection_id, event_type, dedup_key); trigger is the canonical derived name.';

CREATE UNIQUE INDEX IF NOT EXISTS yampi_webhook_events_dedup_uq
  ON public.yampi_webhook_events (connection_id, event_type, dedup_key);
CREATE INDEX IF NOT EXISTS yampi_webhook_events_trigger_idx
  ON public.yampi_webhook_events (trigger, created_at DESC);
CREATE INDEX IF NOT EXISTS yampi_webhook_events_order_idx
  ON public.yampi_webhook_events (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS yampi_webhook_events_people_idx
  ON public.yampi_webhook_events (people_id) WHERE people_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS yampi_webhook_events_status_idx
  ON public.yampi_webhook_events (status, created_at DESC);

-- ── RLS (mirror kiwify_*: read for active CRM users, full for service_role) ───

ALTER TABLE public.yampi_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yampi_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY yampi_select_active_users ON public.yampi_connections FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.settings_users su
    WHERE su.auth_user_id = auth.uid() AND su.active = true));

CREATE POLICY yampi_select_active_users ON public.yampi_webhook_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.settings_users su
    WHERE su.auth_user_id = auth.uid() AND su.active = true));

CREATE POLICY yampi_service_role ON public.yampi_connections
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY yampi_service_role ON public.yampi_webhook_events
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- updated_at maintenance (reuses the shared trigger fn if present; safe create otherwise)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    EXECUTE 'CREATE TRIGGER yampi_connections_updated_at BEFORE UPDATE ON public.yampi_connections
             FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  END IF;
END $$;

COMMIT;
