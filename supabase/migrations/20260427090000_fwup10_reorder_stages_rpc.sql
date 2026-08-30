-- FWUP-10 AC7: RPC batch para reordenar stages em uma única transação
-- Substitui N chamadas UPDATE sequenciais no handleDragEnd do StagesConfig.tsx

CREATE OR REPLACE FUNCTION public.reorder_stages(stage_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i integer;
BEGIN
  FOR i IN 1..array_length(stage_ids, 1) LOOP
    UPDATE stages
    SET    ordem = i
    WHERE  id = stage_ids[i];
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reorder_stages(uuid[]) TO authenticated;
