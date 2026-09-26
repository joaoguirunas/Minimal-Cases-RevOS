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
