-- Fix track_leads_changes function to use settings_users instead of users
CREATE OR REPLACE FUNCTION public.track_leads_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  field_name text;
  old_val jsonb;
  new_val jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    FOR field_name IN 
      SELECT key 
      FROM jsonb_each(to_jsonb(NEW.*))
      WHERE key NOT IN ('updated_at', 'created_at', 'id')
    LOOP
      old_val := to_jsonb(OLD.*) -> field_name;
      new_val := to_jsonb(NEW.*) -> field_name;
      
      IF old_val IS DISTINCT FROM new_val THEN
        INSERT INTO leads_updates (
          leads_id,
          changed_by,
          changed_at,
          field_name,
          old_value,
          new_value,
          change_type
        ) VALUES (
          NEW.id,
          (SELECT id FROM settings_users WHERE auth_user_id = auth.uid() LIMIT 1),
          NOW(),
          field_name,
          old_val,
          new_val,
          CASE 
            WHEN field_name = 'leads_stages_id' THEN 'stage_change'
            WHEN field_name = 'status' THEN 'status_change'
            ELSE 'update'
          END
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix track_people_changes function to use settings_users instead of users
CREATE OR REPLACE FUNCTION public.track_people_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  field_name text;
  old_val jsonb;
  new_val jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    FOR field_name IN 
      SELECT key 
      FROM jsonb_each(to_jsonb(NEW.*))
      WHERE key NOT IN ('updated_at', 'created_at', 'id')
    LOOP
      old_val := to_jsonb(OLD.*) -> field_name;
      new_val := to_jsonb(NEW.*) -> field_name;
      
      IF old_val IS DISTINCT FROM new_val THEN
        INSERT INTO people_updates (
          people_id,
          changed_by,
          changed_at,
          field_name,
          old_value,
          new_value,
          change_type
        ) VALUES (
          NEW.id,
          (SELECT id FROM settings_users WHERE auth_user_id = auth.uid() LIMIT 1),
          NOW(),
          field_name,
          old_val,
          new_val,
          'update'
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix track_companies_changes function to use settings_users instead of users
CREATE OR REPLACE FUNCTION public.track_companies_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  field_name text;
  old_val jsonb;
  new_val jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    FOR field_name IN 
      SELECT key 
      FROM jsonb_each(to_jsonb(NEW.*))
      WHERE key NOT IN ('updated_at', 'created_at', 'id')
    LOOP
      old_val := to_jsonb(OLD.*) -> field_name;
      new_val := to_jsonb(NEW.*) -> field_name;
      
      IF old_val IS DISTINCT FROM new_val THEN
        INSERT INTO companies_updates (
          companies_id,
          changed_by,
          changed_at,
          field_name,
          old_value,
          new_value,
          change_type
        ) VALUES (
          NEW.id,
          (SELECT id FROM settings_users WHERE auth_user_id = auth.uid() LIMIT 1),
          NOW(),
          field_name,
          old_val,
          new_val,
          'update'
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix track_meetings_changes function to use settings_users instead of users
CREATE OR REPLACE FUNCTION public.track_meetings_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  field_name text;
  old_val jsonb;
  new_val jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    FOR field_name IN 
      SELECT key 
      FROM jsonb_each(to_jsonb(NEW.*))
      WHERE key NOT IN ('created_at', 'id')
    LOOP
      old_val := to_jsonb(OLD.*) -> field_name;
      new_val := to_jsonb(NEW.*) -> field_name;
      
      IF old_val IS DISTINCT FROM new_val THEN
        INSERT INTO meetings_updates (
          meetings_id,
          changed_by,
          changed_at,
          field_name,
          old_value,
          new_value,
          change_type
        ) VALUES (
          NEW.id,
          (SELECT id FROM settings_users WHERE auth_user_id = auth.uid() LIMIT 1),
          NOW(),
          field_name,
          old_val,
          new_val,
          CASE 
            WHEN field_name = 'status' THEN 'status_change'
            ELSE 'update'
          END
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix track_campaigns_changes function to use settings_users instead of users
CREATE OR REPLACE FUNCTION public.track_campaigns_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  field_name text;
  old_val jsonb;
  new_val jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    FOR field_name IN 
      SELECT key 
      FROM jsonb_each(to_jsonb(NEW.*))
      WHERE key NOT IN ('updated_at', 'created_at', 'id')
    LOOP
      old_val := to_jsonb(OLD.*) -> field_name;
      new_val := to_jsonb(NEW.*) -> field_name;
      
      IF old_val IS DISTINCT FROM new_val THEN
        INSERT INTO campaigns_updates (
          campaigns_id,
          changed_by,
          changed_at,
          field_name,
          old_value,
          new_value,
          change_type
        ) VALUES (
          NEW.id,
          (SELECT id FROM settings_users WHERE auth_user_id = auth.uid() LIMIT 1),
          NOW(),
          field_name,
          old_val,
          new_val,
          CASE 
            WHEN field_name = 'status' THEN 'status_change'
            ELSE 'update'
          END
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;