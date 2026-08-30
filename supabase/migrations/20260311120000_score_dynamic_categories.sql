-- Score PRO: Dynamic Categories
-- Adds score_categories + score_category_items tables.
-- Migrates data from the 3 legacy tables (preserving UUIDs).
-- Adds category_selections jsonb to score_matrix.

BEGIN;

-- 1. score_categories
CREATE TABLE IF NOT EXISTS score_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE,          -- 'objectives'|'investments'|'framings' for the 3 base seeds
  order_index integer NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. score_category_items
CREATE TABLE IF NOT EXISTS score_category_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES score_categories(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  active      boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS score_category_items_category_id_idx
  ON score_category_items(category_id);
CREATE INDEX IF NOT EXISTS score_category_items_order_idx
  ON score_category_items(category_id, order_index);

-- 3. Seed 3 base categories and migrate items (preserve original UUIDs)
DO $$
DECLARE
  v_obj_id  uuid;
  v_inv_id  uuid;
  v_frm_id  uuid;
BEGIN
  -- Insert 3 base categories
  INSERT INTO score_categories (name, slug, order_index) VALUES
    ('Objetivos',              'objectives',  0),
    ('Faixas de Investimento', 'investments', 1),
    ('Segmentos',              'framings',    2)
  ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO v_obj_id FROM score_categories WHERE slug = 'objectives';
  SELECT id INTO v_inv_id FROM score_categories WHERE slug = 'investments';
  SELECT id INTO v_frm_id FROM score_categories WHERE slug = 'framings';

  -- Migrate from score_objectives (preserve UUIDs)
  INSERT INTO score_category_items (id, category_id, name, description, active, order_index, created_at, updated_at)
  SELECT
    so.id,
    v_obj_id,
    so.name,
    so.description,
    COALESCE(so.active, true),
    COALESCE(so.order_index, 0),
    so.created_at,
    so.updated_at
  FROM score_objectives so
  ON CONFLICT (id) DO NOTHING;

  -- Migrate from score_investments (preserve UUIDs)
  INSERT INTO score_category_items (id, category_id, name, description, active, order_index, created_at, updated_at)
  SELECT
    si.id,
    v_inv_id,
    si.name,
    si.description,
    COALESCE(si.active, true),
    COALESCE(si.order_index, 0),
    si.created_at,
    si.updated_at
  FROM score_investments si
  ON CONFLICT (id) DO NOTHING;

  -- Migrate from score_framings (preserve UUIDs)
  INSERT INTO score_category_items (id, category_id, name, description, active, order_index, created_at, updated_at)
  SELECT
    sf.id,
    v_frm_id,
    sf.name,
    sf.description,
    COALESCE(sf.active, true),
    COALESCE(sf.order_index, 0),
    sf.created_at,
    sf.updated_at
  FROM score_framings sf
  ON CONFLICT (id) DO NOTHING;

  -- 4. Add category_selections to score_matrix
  ALTER TABLE score_matrix ADD COLUMN IF NOT EXISTS
    category_selections jsonb NOT NULL DEFAULT '{}';

  -- 5. Populate category_selections from legacy arrays
  UPDATE score_matrix sm
  SET category_selections = jsonb_build_object(
    v_obj_id::text, COALESCE(sm.objective_id, '{}'),
    v_inv_id::text, COALESCE(sm.investment_id, '{}'),
    v_frm_id::text, COALESCE(sm.framing_id, '{}')
  )
  WHERE sm.category_selections = '{}';

END $$;

-- 6. GIN index for JSONB containment queries
CREATE INDEX IF NOT EXISTS score_matrix_category_selections_gin_idx
  ON score_matrix USING gin(category_selections);

-- 7. RLS (same pattern as existing score tables: all authenticated)
ALTER TABLE score_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_category_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "score_categories_read"
  ON score_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "score_categories_write"
  ON score_categories FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "score_category_items_read"
  ON score_category_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "score_category_items_write"
  ON score_category_items FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 8. updated_at triggers (using update_updated_at_column — available in this project)
CREATE OR REPLACE TRIGGER score_categories_updated_at
  BEFORE UPDATE ON score_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER score_category_items_updated_at
  BEFORE UPDATE ON score_category_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
