-- Fix: adicionar clients_people à publicação supabase_realtime
-- Sem isso, a subscription postgres_changes em Conversas.tsx (ai_processing_lock)
-- nunca recebe eventos UPDATE → indicador "pensando/digitando" da IA nunca aparece.
--
-- REPLICA IDENTITY FULL garante que o payload.new completo chegue ao frontend
-- nos eventos UPDATE — necessário para payload.new.ai_processing_lock ser lido.

ALTER TABLE public.clients_people REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.clients_people;
