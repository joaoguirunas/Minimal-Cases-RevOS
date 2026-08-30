-- Migration: Create increment_field RPC
-- Used by send-status-callback and send-dispatch-worker for atomic counter updates
-- Signature matches exactly what the Edge Functions expect

CREATE OR REPLACE FUNCTION increment_field(
  table_name text,
  field_name text,
  row_id     uuid,
  increment_by integer DEFAULT 1
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE format(
    'UPDATE %I SET %I = COALESCE(%I, 0) + $1 WHERE id = $2',
    table_name, field_name, field_name
  )
  USING increment_by, row_id;
END;
$$;

-- Grant execute to service_role (used by Edge Functions)
GRANT EXECUTE ON FUNCTION increment_field(text, text, uuid, integer) TO service_role;
