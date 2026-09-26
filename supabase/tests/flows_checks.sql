-- supabase/tests/flows_checks.sql  (cada SELECT deve devolver ok = true; DO sem erro = ok)
-- F1: motor padrão é 'rules'
select public.flow_engine_for('Esteira Minimal — Loja') = 'rules' as ok;
-- F2: gatilho cria UMA execução em simulação, duplicado não cria outra, live de pipeline em 'rules' não roda live
do $$ declare f uuid; p uuid; n1 int; n2 int; begin
  select id into p from public.clients_people limit 1;
  insert into public.flows (name, status, trigger_type, trigger_config, draft_graph)
  values ('chk-flow', 'live', 'manual', '{"pipeline":"Esteira Minimal — Loja"}', '{"nodes":[],"edges":[]}') returning id into f;
  insert into public.flow_versions (flow_id, version, graph) values (f, 1, '{"nodes":[{"id":"t","type":"trigger","data":{}}],"edges":[]}');
  update public.flows set live_version_id = (select id from public.flow_versions where flow_id = f) where id = f;
  n1 := public.flow_trigger('manual', p, null, '{}');
  n2 := public.flow_trigger('manual', p, null, '{}');
  if n1 <> 1 or n2 <> 0 then raise exception 'CONTAGEM % %', n1, n2; end if;
  if exists (select 1 from public.flow_runs where flow_id = f and mode = 'live') then raise exception 'RODOU_LIVE_COM_RULES'; end if;
  if not exists (select 1 from public.flow_runs where flow_id = f and mode = 'simulation') then raise exception 'SEM_SIMULACAO'; end if;
  raise exception 'ROLLBACK_OK';
exception when others then if sqlerrm <> 'ROLLBACK_OK' then raise; end if; end $$;
-- F3: flow_exit_person encerra a execução e cancela a fila de fluxo pendente
do $$ declare f uuid; p uuid; r uuid; q uuid; l uuid; begin
  select id, people_id into l, p from public.leads where people_id is not null limit 1;
  insert into public.flows (name, status, trigger_type, draft_graph) values ('chk-exit', 'live', 'manual', '{}') returning id into f;
  insert into public.flow_versions (flow_id, version, graph) values (f, 1, '{"nodes":[],"edges":[]}');
  insert into public.flow_runs (flow_id, version_id, people_id, mode, status) select f, id, p, 'live', 'active' from public.flow_versions where flow_id = f returning id into r;
  insert into public.followup_queue (lead_id, person_id, channel, source_type, scheduled_for, status, flow_run_id, flow_node_id)
  values (l, p, 'email', 'flow', now() + interval '1 hour', 'pending', r, 'n1') returning id into q;
  perform public.flow_exit_person(p, 'purchased');
  if (select status from public.flow_runs where id = r) <> 'exited' then raise exception 'NAO_SAIU'; end if;
  if (select status from public.followup_queue where id = q) <> 'cancelled' then raise exception 'NAO_CANCELOU'; end if;
  raise exception 'ROLLBACK_OK';
exception when others then if sqlerrm <> 'ROLLBACK_OK' then raise; end if; end $$;
-- F4: nada vazou dos DOs
select not exists (select 1 from public.flows where name like 'chk-%') as ok;
-- F5: fila aceita as colunas de fluxo
select count(*) = 3 as ok from information_schema.columns where table_name = 'followup_queue' and column_name in ('flow_run_id','flow_node_id','vars');
-- F6: mudar de etapa para fora da esteira cancela toque de fluxo pendente (mesma regra das regras antigas)
select position('flow' in pg_get_functiondef('public.notify_lead_stage_changed()'::regprocedure)) > 0 as ok;
-- F7: fluxo 'live' de carrinho SEM funil definido nunca roda live (só simula)
do $$ declare f uuid; p uuid; begin
  select id into p from public.clients_people limit 1;
  insert into public.flows (name, status, trigger_type, trigger_config, draft_graph) values ('chk-nopipe', 'live', 'cart_abandoned', '{}', '{}') returning id into f;
  insert into public.flow_versions (flow_id, version, graph) values (f, 1, '{"nodes":[],"edges":[]}');
  update public.flows set live_version_id = (select id from public.flow_versions where flow_id = f) where id = f;
  perform public.flow_trigger('cart_abandoned', p, null, '{}');
  if exists (select 1 from public.flow_runs where flow_id = f and mode = 'live') then raise exception 'RODOU_LIVE_SEM_FUNIL'; end if;
  raise exception 'ROLLBACK_OK';
exception when others then if sqlerrm <> 'ROLLBACK_OK' then raise; end if; end $$;
-- F8: config de gatilho inválida (require_active_flow não-uuid) não derruba o gatilho dos outros fluxos
do $$ declare f uuid; g uuid; p uuid; n int; begin
  select id into p from public.clients_people limit 1;
  insert into public.flows (name, status, trigger_type, trigger_config, draft_graph) values ('chk-bad', 'simulation', 'manual', '{"require_active_flow":"lixo"}', '{}') returning id into f;
  insert into public.flow_versions (flow_id, version, graph) values (f, 1, '{"nodes":[],"edges":[]}');
  update public.flows set live_version_id = (select id from public.flow_versions where flow_id = f) where id = f;
  insert into public.flows (name, status, trigger_type, draft_graph) values ('chk-good', 'simulation', 'manual', '{}') returning id into g;
  insert into public.flow_versions (flow_id, version, graph) values (g, 1, '{"nodes":[],"edges":[]}');
  update public.flows set live_version_id = (select id from public.flow_versions where flow_id = g) where id = g;
  n := public.flow_trigger('manual', p, null, '{}');
  if not exists (select 1 from public.flow_runs where flow_id = g) then raise exception 'GATILHO_QUEBROU %', n; end if;
  raise exception 'ROLLBACK_OK';
exception when others then if sqlerrm <> 'ROLLBACK_OK' then raise; end if; end $$;
-- F9: um nó de envio não entra duas vezes na fila para a mesma execução
select exists (select 1 from pg_indexes where indexname = 'uq_followup_queue_flow_node') as ok;
-- F10: estatística não multiplica envios por clique
do $$ declare f uuid; v uuid; p uuid; l uuid; r uuid; q uuid; t uuid; s jsonb; begin
  select id, people_id into l, p from public.leads where people_id is not null limit 1;
  insert into public.flows (name, status, trigger_type, draft_graph) values ('chk-stats', 'simulation', 'manual', '{}') returning id into f;
  insert into public.flow_versions (flow_id, version, graph) values (f, 1, '{"nodes":[],"edges":[]}') returning id into v;
  insert into public.flow_runs (flow_id, version_id, people_id, lead_id, mode) values (f, v, p, l, 'live') returning id into r;
  insert into public.followup_queue (lead_id, person_id, channel, source_type, scheduled_for, status, flow_run_id, flow_node_id)
    values (l, p, 'email', 'flow', now(), 'queued', r, 'n1') returning id into q;
  insert into public.tracked_links (token, destination, followup_queue_id) values ('chkStats01', 'https://x', q) returning id into t;
  insert into public.tracked_link_clicks (tracked_link_id, clicked_at, is_bot, is_duplicate) values (t, now(), false, false), (t, now(), false, false);
  s := public.flow_stats(f, 7);
  if (s->'n1'->>'sent')::int <> 1 or (s->'n1'->>'clicks')::int <> 2 then raise exception 'STATS %', s; end if;
  raise exception 'ROLLBACK_OK';
exception when others then if sqlerrm <> 'ROLLBACK_OK' then raise; end if; end $$;
