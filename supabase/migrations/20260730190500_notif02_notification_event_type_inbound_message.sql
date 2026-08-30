-- NOTIF-02 (parte 1/2): novo valor do enum notification_event_type.
--
-- SEM BEGIN/COMMIT de propósito: um valor adicionado por ALTER TYPE não pode ser
-- REFERENCIADO na mesma transação em que foi criado. A tabela notifications e o
-- trigger que usam 'inbound_message' vêm no arquivo seguinte.

ALTER TYPE public.notification_event_type ADD VALUE IF NOT EXISTS 'inbound_message';
