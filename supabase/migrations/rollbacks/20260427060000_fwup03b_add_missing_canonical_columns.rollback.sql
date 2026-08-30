-- ROLLBACK: FWUP-03b — remove colunas adicionadas
-- ATENÇÃO: dados em type/subject/template_id/audio_file/days/hours/minutes serão perdidos.

BEGIN;

ALTER TABLE public.leads_stages_followups
  DROP COLUMN IF EXISTS type,
  DROP COLUMN IF EXISTS subject,
  DROP COLUMN IF EXISTS template_id,
  DROP COLUMN IF EXISTS audio_file,
  DROP COLUMN IF EXISTS days,
  DROP COLUMN IF EXISTS hours,
  DROP COLUMN IF EXISTS minutes;

RAISE NOTICE 'FWUP-03b ROLLBACK — colunas canônicas removidas. useFollowups.ts estará quebrado até re-apply.';

COMMIT;
