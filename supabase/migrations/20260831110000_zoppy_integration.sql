-- ZPY-1 — Integração Zoppy (base antiga de clientes da Minimal Cases).
--
-- Objetivo inicial: IMPORTAR a base da Zoppy para o CRM (clients_people) para já
-- trabalhar e-mail/esteira antes do histórico Yampi. Além de clientes, puxamos o
-- máximo útil: pedidos (com itens) e carrinhos abandonados (com itens + URL).
--
-- Modelo (partners.zoppy.com.br): API https://api-partners.zoppy.com.br, auth
-- Authorization: Bearer <token> + header zoppy-access: <chave>; listas paginadas
-- por after (ISO), page, pageSize.
--
-- Tabelas:
--   zoppy_connections      — credenciais criptografadas (app_encrypt_secret, ctx 'zoppy_main')
--   zoppy_customers        — staging por cliente Zoppy (RFM, endereço, custom fields) + people_id
--   zoppy_orders           — staging de pedidos (line_items jsonb) + people_id
--   zoppy_abandoned_carts  — staging de carrinhos (line_items jsonb, url) + people_id
--   zoppy_sync_state       — progresso por recurso (a UI acompanha; zoppy-sync re-invoca até acabar)

BEGIN;

CREATE TABLE IF NOT EXISTS public.zoppy_connections (
    id              uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    api_token_enc   text NOT NULL,
    zoppy_access_enc text NOT NULL,
    status          text DEFAULT 'disconnected' NOT NULL,
    last_error      text,
    created_at      timestamptz DEFAULT now() NOT NULL,
    updated_at      timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT zoppy_connections_status_check
      CHECK (status = ANY (ARRAY['disconnected', 'connected', 'error']))
);
COMMENT ON TABLE public.zoppy_connections IS
  'Conexão Zoppy (single-tenant). Bearer token + chave zoppy-access criptografados via app_encrypt_secret (ctx ''zoppy_main'').';

CREATE TABLE IF NOT EXISTS public.zoppy_customers (
    id               uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    zoppy_id         text NOT NULL UNIQUE,
    external_id      text,
    email            text,
    phone            text,
    first_name       text,
    last_name        text,
    birth_date       date,
    gender           text,
    rfm_position     text,
    address          jsonb,
    custom_fields    jsonb,
    coupon           jsonb,
    people_id        uuid,
    raw              jsonb NOT NULL,
    zoppy_created_at timestamptz,
    zoppy_updated_at timestamptz,
    synced_at        timestamptz DEFAULT now() NOT NULL
);
COMMENT ON COLUMN public.zoppy_customers.rfm_position IS
  'Segmentação RFM da Zoppy (somente leitura): promising, loyal, sleeping, possible-loyal, at-risk.';
CREATE INDEX IF NOT EXISTS zoppy_customers_people_idx ON public.zoppy_customers (people_id) WHERE people_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS zoppy_customers_email_idx ON public.zoppy_customers (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS zoppy_customers_rfm_idx ON public.zoppy_customers (rfm_position) WHERE rfm_position IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.zoppy_orders (
    id                uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    zoppy_id          text NOT NULL UNIQUE,
    external_id       text,
    customer_zoppy_id text,
    people_id         uuid,
    status            text,
    subtotal          numeric,
    total             numeric,
    discount          numeric,
    shipping          numeric,
    coupon_code       text,
    provider          text,
    line_items        jsonb,
    raw               jsonb NOT NULL,
    completed_at      timestamptz,
    zoppy_created_at  timestamptz,
    zoppy_updated_at  timestamptz,
    synced_at         timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS zoppy_orders_people_idx ON public.zoppy_orders (people_id) WHERE people_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS zoppy_orders_customer_idx ON public.zoppy_orders (customer_zoppy_id);
CREATE INDEX IF NOT EXISTS zoppy_orders_created_idx ON public.zoppy_orders (zoppy_created_at DESC);

CREATE TABLE IF NOT EXISTS public.zoppy_abandoned_carts (
    id                uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    zoppy_id          text NOT NULL UNIQUE,
    external_id       text,
    customer_zoppy_id text,
    people_id         uuid,
    url               text,
    subtotal          numeric,
    total             numeric,
    discount          numeric,
    shipping          numeric,
    line_items        jsonb,
    raw               jsonb NOT NULL,
    zoppy_created_at  timestamptz,
    zoppy_updated_at  timestamptz,
    synced_at         timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS zoppy_carts_people_idx ON public.zoppy_abandoned_carts (people_id) WHERE people_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS zoppy_carts_created_idx ON public.zoppy_abandoned_carts (zoppy_created_at DESC);

CREATE TABLE IF NOT EXISTS public.zoppy_sync_state (
    resource      text NOT NULL PRIMARY KEY,
    status        text DEFAULT 'idle' NOT NULL,
    next_page     integer DEFAULT 1 NOT NULL,
    after_date    text DEFAULT '2000-01-01' NOT NULL,
    total_synced  integer DEFAULT 0 NOT NULL,
    contacts_created integer DEFAULT 0 NOT NULL,
    contacts_matched integer DEFAULT 0 NOT NULL,
    last_error    text,
    started_at    timestamptz,
    finished_at   timestamptz,
    updated_at    timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT zoppy_sync_state_status_check
      CHECK (status = ANY (ARRAY['idle', 'running', 'done', 'error'])),
    CONSTRAINT zoppy_sync_state_resource_check
      CHECK (resource = ANY (ARRAY['customers', 'orders', 'abandoned-carts']))
);
COMMENT ON TABLE public.zoppy_sync_state IS
  'Progresso do import por recurso. zoppy-sync processa lotes de páginas e se re-invoca até status=done.';

-- ── RLS (mesmo padrão kiwify/yampi) ───────────────────────────────────────────
ALTER TABLE public.zoppy_connections     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoppy_customers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoppy_orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoppy_abandoned_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoppy_sync_state      ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['zoppy_connections','zoppy_customers','zoppy_orders','zoppy_abandoned_carts','zoppy_sync_state'] LOOP
    EXECUTE format('CREATE POLICY zoppy_select_active_users ON public.%I FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.settings_users su
        WHERE su.auth_user_id = auth.uid() AND su.active = true))', t);
    EXECUTE format('CREATE POLICY zoppy_service_role ON public.%I
      USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')', t);
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    EXECUTE 'CREATE TRIGGER zoppy_connections_updated_at BEFORE UPDATE ON public.zoppy_connections
             FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
    EXECUTE 'CREATE TRIGGER zoppy_sync_state_updated_at BEFORE UPDATE ON public.zoppy_sync_state
             FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  END IF;
END $$;

COMMIT;
