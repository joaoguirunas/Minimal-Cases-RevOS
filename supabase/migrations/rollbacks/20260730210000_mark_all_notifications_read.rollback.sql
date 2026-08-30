-- Rollback de 20260730210000_mark_all_notifications_read.sql
--
-- ⚠️ Só aplicar junto com o revert do FE. Se a RPC sumir e o useNotifications.ts já
-- estiver chamando ela, o "marcar todas" quebra. E restaurar a policy de UPDATE devolve
-- ao client a capacidade de reescrever title/body/unread_messages de qualquer
-- notificação que ele enxergue.

BEGIN;

DROP FUNCTION IF EXISTS public.mark_all_notifications_read();

CREATE POLICY notifications_mark_read ON public.notifications FOR UPDATE
USING      (people_id IS NOT NULL AND public.person_conversation_accessible_to_current_user(people_id))
WITH CHECK (people_id IS NOT NULL AND public.person_conversation_accessible_to_current_user(people_id));

COMMIT;
