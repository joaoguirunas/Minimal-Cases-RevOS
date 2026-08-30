-- =============================================================================
-- CLEAN-OMNI-01: Remove legacy crm_messages table
-- =============================================================================
-- crm_messages was the original messages table, renamed and later superseded
-- by the modern `messages` table. The SPA and all edge functions now use
-- `messages` exclusively. This migration drops the legacy table.
--
-- Safety: DROP TABLE IF EXISTS is a no-op if already removed.
-- Data: all historical data has been migrated to `messages` in prior migrations.
-- =============================================================================

-- Drop dependent objects first (policies, triggers, indexes are cascade-dropped)
DROP TABLE IF EXISTS public.crm_messages CASCADE;
