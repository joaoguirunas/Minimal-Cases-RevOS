-- Remove completed_at column from project_tasks
ALTER TABLE project_tasks DROP COLUMN IF EXISTS completed_at;

-- Update move_task function to remove completed_at logic
CREATE OR REPLACE FUNCTION public.move_task(p_task_id uuid, p_new_status text, p_new_sort_order integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.project_tasks
  SET 
    status = p_new_status,
    sort_order = p_new_sort_order,
    updated_at = now()
  WHERE id = p_task_id;
END;
$function$;