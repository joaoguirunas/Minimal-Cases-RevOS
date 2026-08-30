
-- Drop import/export database functions
DROP FUNCTION IF EXISTS public.import_agendamento(jsonb);
DROP FUNCTION IF EXISTS public.import_conversa(jsonb);
DROP FUNCTION IF EXISTS public.import_pessoa_with_flexible_lead(jsonb);
DROP FUNCTION IF EXISTS public.import_lead_completo(jsonb);
DROP FUNCTION IF EXISTS public.merge_leads(uuid, uuid[]);
