-- KFY-2.2 (AC1+AC2): kiwify_lead_products — M-N junction contact↔Kiwify product.
--
-- Populated by kiwify-process-event on ownership events (compra_aprovada,
-- subscription_renewed) — AC3, handled separately. Enables the per-lead course badge.
-- Reference: kiwify-integration-architecture §8.2.
--
-- RLS mirrors the other kiwify_* tables (SELECT for active settings_users; WRITE for
-- super_admin OR user_type='manager'; service_role bypass). 'manager' is the real enum
-- value (admin/manager/user) — 'gestor' does not exist (fixed in 20260702130000).
--
-- Apply: supabase db query --linked --file <this> ; register in schema_migrations.

BEGIN;

CREATE TABLE IF NOT EXISTS public.kiwify_lead_products (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  people_id      uuid NOT NULL REFERENCES public.clients_people(id) ON DELETE CASCADE,
  product_id     text NOT NULL,
  product_name   text NOT NULL,
  connection_id  uuid REFERENCES public.kiwify_connections(id) ON DELETE SET NULL,
  first_seen_at  timestamptz NOT NULL DEFAULT now(),
  last_seen_at   timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kiwify_lead_products_people_product_uq UNIQUE (people_id, product_id)
);

COMMENT ON TABLE  public.kiwify_lead_products IS 'M-N junction: which Kiwify products a contact owns. Populated by kiwify-process-event on ownership events (compra_aprovada/subscription_renewed).';
COMMENT ON COLUMN public.kiwify_lead_products.product_id IS 'Kiwify product id (text).';
COMMENT ON COLUMN public.kiwify_lead_products.product_name IS 'Snapshot of product name at last ownership event.';
COMMENT ON COLUMN public.kiwify_lead_products.first_seen_at IS 'First ownership event — never updated on upsert.';
COMMENT ON COLUMN public.kiwify_lead_products.last_seen_at IS 'Most recent ownership event — refreshed on upsert.';

CREATE INDEX IF NOT EXISTS kiwify_lead_products_people_idx
  ON public.kiwify_lead_products (people_id);

DROP TRIGGER IF EXISTS kiwify_lead_products_set_updated_at ON public.kiwify_lead_products;
CREATE TRIGGER kiwify_lead_products_set_updated_at
  BEFORE UPDATE ON public.kiwify_lead_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS (mirrors other kiwify_* tables)
ALTER TABLE public.kiwify_lead_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kiwify_select_active_users" ON public.kiwify_lead_products;
CREATE POLICY "kiwify_select_active_users" ON public.kiwify_lead_products
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.settings_users su
            WHERE su.auth_user_id = auth.uid() AND su.active = true)
  );

DROP POLICY IF EXISTS "kiwify_write_managers" ON public.kiwify_lead_products;
CREATE POLICY "kiwify_write_managers" ON public.kiwify_lead_products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.settings_users su
            WHERE su.auth_user_id = auth.uid() AND su.active = true
              AND (su.super_admin = true OR su.user_type = 'manager'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.settings_users su
            WHERE su.auth_user_id = auth.uid() AND su.active = true
              AND (su.super_admin = true OR su.user_type = 'manager'))
  );

DROP POLICY IF EXISTS "kiwify_service_role" ON public.kiwify_lead_products;
CREATE POLICY "kiwify_service_role" ON public.kiwify_lead_products
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;
