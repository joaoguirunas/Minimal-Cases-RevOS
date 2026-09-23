-- O cron do backfill segue rodando até o recálculo do histórico terminar.
SELECT cron.unschedule('yampi-orders-backfill');
SELECT cron.schedule('yampi-orders-backfill', '* * * * *', $$
  SELECT net.http_post(
    url := (SELECT value FROM public._app_config WHERE key='supabase_url') || '/functions/v1/yampi-orders-sync',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT value FROM public._app_config WHERE key='service_role_key')),
    body := '{"mode":"backfill","pages":5}'::jsonb)
  WHERE NOT coalesce((SELECT (value->>'done')::boolean FROM public.sync_state WHERE key='yampi_orders_backfill'), false)
     OR NOT coalesce((SELECT (value->>'done')::boolean FROM public.sync_state WHERE key='yampi_orders_recompute'), false);
$$);
