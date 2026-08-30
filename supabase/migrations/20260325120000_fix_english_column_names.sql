-- ══════════════════════════════════════════════════════════════════════════════
-- Fix: Rename Portuguese column names to English
-- Convention: all DB columns must be in English
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Rename leads columns ────────────────────────────────────────────────

ALTER TABLE public.leads
  RENAME COLUMN temperatura_pre_venda TO pre_sale_temperature;

ALTER TABLE public.leads
  RENAME COLUMN probabilidade_fechamento TO close_probability;

COMMENT ON COLUMN public.leads.pre_sale_temperature IS 'Pre-sale temperature (1-5 🔥). How warm the lead is before commercial contact.';
COMMENT ON COLUMN public.leads.close_probability    IS 'Close probability (1-5 ⭐ → 20/40/60/80/100%). Likelihood of closing the deal.';

-- ─── 2. Rename CHECK constraints (recreate with new column names) ───────────

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_temperatura_pre_venda_check,
  DROP CONSTRAINT IF EXISTS leads_probabilidade_fechamento_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_pre_sale_temperature_check
    CHECK (pre_sale_temperature IS NULL OR (pre_sale_temperature >= 1 AND pre_sale_temperature <= 5)),
  ADD CONSTRAINT leads_close_probability_check
    CHECK (close_probability IS NULL OR (close_probability >= 1 AND close_probability <= 5));

-- ─── 3. Update field definition keys to English ─────────────────────────────

UPDATE public.lead_field_definitions SET key = 'main_bottleneck'       WHERE key = 'gargalo_principal'      AND entity_type = 'pessoa';
UPDATE public.lead_field_definitions SET key = 'team_size'             WHERE key = 'tamanho_equipe'         AND entity_type = 'pessoa';
UPDATE public.lead_field_definitions SET key = 'monthly_lead_volume'   WHERE key = 'volume_leads_mes'       AND entity_type = 'pessoa';
UPDATE public.lead_field_definitions SET key = 'current_tools'         WHERE key = 'ferramentas_atuais'     AND entity_type = 'pessoa';
UPDATE public.lead_field_definitions SET key = 'decision_authority'    WHERE key = 'autoridade_decisao'     AND entity_type = 'pessoa';
UPDATE public.lead_field_definitions SET key = 'available_budget'      WHERE key = 'budget_disponivel'      AND entity_type = 'pessoa';
UPDATE public.lead_field_definitions SET key = 'implementation_timeline' WHERE key = 'timeline_implementacao' AND entity_type = 'pessoa';
UPDATE public.lead_field_definitions SET key = 'expected_objections'   WHERE key = 'objecoes_previstas'     AND entity_type = 'pessoa';
