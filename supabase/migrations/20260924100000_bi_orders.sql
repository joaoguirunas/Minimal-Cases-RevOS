-- BI · base de pedidos da Yampi (histórico + tempo real).
CREATE TABLE IF NOT EXISTS public.orders (
  id                bigint PRIMARY KEY,           -- resource.id da Yampi
  number            text,
  people_id         uuid REFERENCES public.clients_people(id) ON DELETE SET NULL,
  customer_yampi_id bigint,
  customer_email    text,
  customer_phone    text,
  status            text NOT NULL DEFAULT 'other',
  is_paid           boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL,
  paid_at           timestamptz,
  cancelled_at      timestamptz,
  shipped_at        timestamptz,
  delivered_at      timestamptz,
  value_products    numeric(12,2) NOT NULL DEFAULT 0,
  value_discount    numeric(12,2) NOT NULL DEFAULT 0,
  value_shipment    numeric(12,2) NOT NULL DEFAULT 0,
  value_total       numeric(12,2) NOT NULL DEFAULT 0,
  payment_method    text,
  installments      int,
  coupon_code       text,
  utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  device            text,
  state             text,
  city              text,
  shipment_service  text,
  is_first_order    boolean,
  raw               jsonb,
  synced_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_paid_at      ON public.orders (paid_at) WHERE is_paid;
CREATE INDEX IF NOT EXISTS idx_orders_created_at   ON public.orders (created_at);
CREATE INDEX IF NOT EXISTS idx_orders_people_paid  ON public.orders (people_id, paid_at);
CREATE INDEX IF NOT EXISTS idx_orders_coupon       ON public.orders (upper(coupon_code)) WHERE coupon_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_utm_campaign ON public.orders (utm_campaign);
CREATE INDEX IF NOT EXISTS idx_orders_status       ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_email        ON public.orders (lower(customer_email));

CREATE TABLE IF NOT EXISTS public.order_items (
  id          bigint PRIMARY KEY,                 -- items.data[].id
  order_id    bigint NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sku_id      bigint,
  product_id  bigint,
  sku         text,
  title       text,
  variant     text,
  quantity    int NOT NULL DEFAULT 1,
  price       numeric(12,2) NOT NULL DEFAULT 0,
  total       numeric(12,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_order_items_order   ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items (product_id);

CREATE TABLE IF NOT EXISTS public.sync_state (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_state  ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_select_staff ON public.orders FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.settings_users su WHERE su.auth_user_id = auth.uid() AND su.active)
  AND NOT (SELECT public.is_commercial()));
CREATE POLICY order_items_select_staff ON public.order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.settings_users su WHERE su.auth_user_id = auth.uid() AND su.active)
  AND NOT (SELECT public.is_commercial()));
CREATE POLICY orders_service ON public.orders FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY order_items_service ON public.order_items FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY sync_state_service ON public.sync_state FOR ALL USING (auth.role() = 'service_role');
