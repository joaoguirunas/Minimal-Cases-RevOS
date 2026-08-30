-- Rollback: CoachPRO™ Schema Playbooks (20260422000000)

ALTER TABLE public.meetings DROP COLUMN IF EXISTS meeting_type;

DROP TABLE IF EXISTS public.meeting_playbook_assignments;
DROP TABLE IF EXISTS public.playbook_criteria;
DROP TABLE IF EXISTS public.playbook_sections;
DROP TABLE IF EXISTS public.playbooks;
DROP TABLE IF EXISTS public.playbook_templates;
