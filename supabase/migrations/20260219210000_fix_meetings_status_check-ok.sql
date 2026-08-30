-- Fix meetings_status_check to include all status values used by the app
-- Previous constraint: agendada, realizada, cancelada, remarcada
-- App also uses: agendado, compareceu, não compareceu, bloqueio manual, cancelado

ALTER TABLE public.meetings DROP CONSTRAINT IF EXISTS meetings_status_check;

ALTER TABLE public.meetings ADD CONSTRAINT meetings_status_check
  CHECK (status = ANY (ARRAY[
    'agendada'::text,
    'agendado'::text,
    'realizada'::text,
    'cancelada'::text,
    'cancelado'::text,
    'remarcada'::text,
    'compareceu'::text,
    'não compareceu'::text,
    'bloqueio manual'::text
  ]));
