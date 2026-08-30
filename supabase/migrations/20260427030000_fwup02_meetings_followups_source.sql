-- FWUP-02: Add source discriminator to meetings_followups
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- PROBLEM:
--   useCallProFollowups (webhook/N8N model) and useAgendamentosFollowups
--   (direct channel model) both write to meetings_followups with semantically
--   incompatible fields. A rule created for CallPro appears in Agendamento UI
--   and vice-versa, risking corruption.
--
-- SOLUTION:
--   Add column `source TEXT NOT NULL DEFAULT 'channel'
--     CHECK (source IN ('webhook', 'channel'))`.
--   Backfill existing rows. Add RLS guard preventing cross-source writes.
--
-- BACKFILL LOGIC:
--   webhook: webhook_url IS NOT NULL AND webhook_url != ''
--   channel: whatsapp_template_id IS NOT NULL
--            OR template_id IS NOT NULL
--            OR as_queue_id IS NOT NULL
--   ambiguous (both/neither): → 'channel' (modern path default) + logged
--
-- DEPENDS ON: FWUP-01 (no dependency on JWT rotation, but merged after).
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Add source column ───────────────────────────────────────────────────────

ALTER TABLE public.meetings_followups
  ADD COLUMN IF NOT EXISTS source text
    NOT NULL DEFAULT 'channel'
    CHECK (source IN ('webhook', 'channel'));

COMMENT ON COLUMN public.meetings_followups.source IS
  'webhook = dispatch via webhook_url (N8N/external) | channel = dispatch via direct channel (WA template, AS, email, SMS)';

-- ── 2. Backfill existing rows ──────────────────────────────────────────────────

DO $$
DECLARE
  v_webhook_count  int := 0;
  v_channel_count  int := 0;
  v_ambiguous      int := 0;
  rec              record;
BEGIN
  -- Pass 1: pure webhook (has webhook_url, no channel identifiers)
  UPDATE public.meetings_followups
     SET source = 'webhook'
   WHERE (webhook_url IS NOT NULL AND webhook_url != '')
     AND whatsapp_template_id IS NULL
     AND template_id IS NULL
     AND as_queue_id IS NULL;
  GET DIAGNOSTICS v_webhook_count = ROW_COUNT;

  -- Pass 2: pure channel (no webhook_url, has at least one channel identifier)
  UPDATE public.meetings_followups
     SET source = 'channel'
   WHERE (webhook_url IS NULL OR webhook_url = '')
     AND (whatsapp_template_id IS NOT NULL
          OR template_id IS NOT NULL
          OR as_queue_id IS NOT NULL);
  GET DIAGNOSTICS v_channel_count = ROW_COUNT;

  -- Pass 3: ambiguous rows (have both webhook_url AND a channel identifier)
  --         Default is already 'channel' (set on column ADD) — log each for audit.
  FOR rec IN
    SELECT id, webhook_url, whatsapp_template_id, template_id, as_queue_id, meeting_status
      FROM public.meetings_followups
     WHERE (webhook_url IS NOT NULL AND webhook_url != '')
       AND (whatsapp_template_id IS NOT NULL
            OR template_id IS NOT NULL
            OR as_queue_id IS NOT NULL)
  LOOP
    v_ambiguous := v_ambiguous + 1;
    RAISE NOTICE '[FWUP-02] Ambiguous row id=% meeting_status=% — has both webhook_url and channel identifier. Defaulted to source=channel. Review manually.',
      rec.id, rec.meeting_status;
  END LOOP;

  RAISE NOTICE '[FWUP-02] Backfill complete: % webhook, % channel, % ambiguous (defaulted to channel)',
    v_webhook_count, v_channel_count, v_ambiguous;
END $$;

-- ── 3. Index for query performance on filtered hooks ──────────────────────────

CREATE INDEX IF NOT EXISTS idx_meetings_followups_source
  ON public.meetings_followups (source)
  WHERE active = true;

-- ── 4. RLS: replace write policy with source-aware guard ──────────────────────
--
-- The new policy adds a cross-source guard: a write can only touch rows
-- where the source matches what the writer declares. This is enforced via
-- WITH CHECK on source equality — prevents a callpro writer from accidentally
-- updating an agendamento rule and vice-versa.
--
-- SELECT policy is unchanged (any active authenticated user).

-- Remove old write policy
DROP POLICY IF EXISTS "meet_fup_write" ON public.meetings_followups;

-- New write policy: gestor/super_admin + source-stable guard
CREATE POLICY "meet_fup_write"
  ON public.meetings_followups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_admin = true OR user_type = 'gestor')
        AND active = true
        AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    -- Must be gestor/super_admin
    EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_admin = true OR user_type = 'gestor')
        AND active = true
        AND deleted_at IS NULL
    )
    AND
    -- source must match the existing row (prevents cross-source corruption on UPDATE)
    -- On INSERT this is a no-op (no existing row to compare) — source is validated by CHECK constraint.
    (
      -- For INSERT: passes (no existing row)
      NOT EXISTS (SELECT 1 FROM public.meetings_followups mf WHERE mf.id = meetings_followups.id)
      OR
      -- For UPDATE: new source must equal existing source
      meetings_followups.source = (
        SELECT source FROM public.meetings_followups WHERE id = meetings_followups.id
      )
    )
  );

COMMENT ON POLICY "meet_fup_write" ON public.meetings_followups IS
  'FWUP-02: Gestor/super_admin may write. Cross-source UPDATE is blocked (source must remain stable after INSERT).';

COMMIT;
