-- =============================================================================
-- FWUP-32: Re-parent orphan messages from merged persons to canonical
-- =============================================================================
-- Context:
--   merge_persons RPC (20260310110000) already re-parents messages.people_id
--   when a merge happens going forward. But pre-existing merged persons whose
--   merge predates that migration may still have messages anchored to the
--   merged record. The UI (useMensagensPorPessoa) filters on people_id, so
--   the canonical record's history appears empty even though messages exist.
--
-- Action:
--   For any clients_people row with status='merged' and merged_into_id set,
--   move its messages over to the canonical id.
--
-- Safety:
--   - Idempotent: rows already on canonical are not affected.
--   - Skips merged chains with NULL merged_into_id (nothing to move to).
--   - DO block reports counts for audit visibility.
-- =============================================================================

DO $$
DECLARE
  v_moved INT := 0;
BEGIN
  UPDATE public.messages m
  SET people_id = p.merged_into_id
  FROM public.clients_people p
  WHERE m.people_id = p.id
    AND p.status = 'merged'
    AND p.merged_into_id IS NOT NULL
    AND p.merged_into_id <> p.id;

  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RAISE NOTICE 'FWUP-32: re-parented % message rows from merged persons to canonical', v_moved;
END $$;
