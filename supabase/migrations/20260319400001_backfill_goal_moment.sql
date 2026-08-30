-- Backfill clients_people.goal/moment from score_category_items
-- for existing records that have score_matrix_id but empty goal/moment

DO $backfill$
DECLARE
  v_updated INT := 0;
  v_person RECORD;
  v_objetivo_name TEXT;
  v_momento_name TEXT;
  v_selections JSONB;
  v_item_ids TEXT[];
  v_item RECORD;
BEGIN
  FOR v_person IN
    SELECT cp.id, cp.score_matrix_id
    FROM public.clients_people cp
    WHERE cp.score_matrix_id IS NOT NULL
      AND (cp.goal IS NULL OR cp.goal = '' OR cp.moment IS NULL OR cp.moment = '')
  LOOP
    v_objetivo_name := NULL;
    v_momento_name := NULL;

    SELECT sm.category_selections INTO v_selections
    FROM public.score_matrix sm
    WHERE sm.id = v_person.score_matrix_id;

    IF v_selections IS NOT NULL THEN
      SELECT array_agg(elem::text)
      INTO v_item_ids
      FROM jsonb_each(v_selections) AS cat(key, val),
           jsonb_array_elements_text(cat.val) AS elem;

      IF v_item_ids IS NOT NULL AND array_length(v_item_ids, 1) > 0 THEN
        FOR v_item IN
          SELECT sci.name, sc.slug
          FROM public.score_category_items sci
          JOIN public.score_categories sc ON sc.id = sci.category_id
          WHERE sci.id = ANY(v_item_ids::uuid[])
        LOOP
          IF v_item.slug IN ('objectives', 'objetivo') THEN
            v_objetivo_name := v_item.name;
          ELSIF v_item.slug IN ('framing', 'enquadramento') THEN
            v_momento_name := v_item.name;
          END IF;
        END LOOP;

        IF v_objetivo_name IS NOT NULL OR v_momento_name IS NOT NULL THEN
          UPDATE public.clients_people
          SET
            goal   = CASE WHEN (goal IS NULL OR goal = '') AND v_objetivo_name IS NOT NULL THEN v_objetivo_name ELSE goal END,
            moment = CASE WHEN (moment IS NULL OR moment = '') AND v_momento_name IS NOT NULL THEN v_momento_name ELSE moment END,
            updated_at = NOW()
          WHERE id = v_person.id;

          v_updated := v_updated + 1;
        END IF;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE '[Backfill] Updated goal/moment for % person records.', v_updated;
END;
$backfill$;
