-- ══════════════════════════════════════════════════════════════════════════════
-- Add lifecycle_stage to leads table — Customer Journey tracking
--
-- Values: lead, mql, sql, opportunity, customer, churned
-- Used by BI PRO for funnel analytics and conversion tracking.
-- Manually set by users in the CRM sidebar (NegocioSingle).
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lifecycle_stage text
    DEFAULT 'lead'
    CHECK (lifecycle_stage IN ('lead', 'mql', 'sql', 'opportunity', 'customer', 'churned'));

COMMENT ON COLUMN public.leads.lifecycle_stage IS 'Customer journey stage: lead → mql → sql → opportunity → customer | churned. Set manually, used by BI for funnel analytics.';

-- Index for BI queries (filter/group by lifecycle_stage)
CREATE INDEX IF NOT EXISTS idx_leads_lifecycle_stage
  ON public.leads (lifecycle_stage)
  WHERE lifecycle_stage IS NOT NULL;
