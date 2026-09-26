-- supabase/tests/correio_checks.sql  (cada SELECT deve devolver ok = true)
-- M1: normalização
select public.email_norm('  Joao@Gmail.COM ') = 'joao@gmail.com' as ok;
-- M2: rank monotônico
select (public.email_status_rank('clicked') > public.email_status_rank('delivered')
    and public.email_status_rank('bounced') > public.email_status_rank('clicked')
    and public.email_status_rank('complained') > public.email_status_rank('bounced')) as ok;
-- M3: mapeamento de eventos
select (public.email_event_status('email.delivered','{}') = 'delivered'
    and public.email_event_status('email.opened','{}') = 'opened'
    and public.email_event_status('email.clicked','{}') = 'clicked'
    and public.email_event_status('email.complained','{}') = 'complained'
    and public.email_event_status('email.bounced','{"data":{"bounce":{"type":"Permanent"}}}') = 'bounced'
    and public.email_event_status('email.bounced','{"data":{"bounce":{"type":"Transient"}}}') is null
    and public.email_event_status('email.delivery_delayed','{}') is null
    and public.email_event_status('email.failed','{}') = 'failed') as ok;
-- M4: e-mail sem linha = subscribed
select public.email_contact_status('ninguem-' || gen_random_uuid() || '@exemplo.com') = 'subscribed' as ok;
-- M5: freio
select (public.email_guard_eval(49, 49, 49) is null
    and public.email_guard_eval(100, 3, 0) is null
    and public.email_guard_eval(100, 4, 0) like 'bounce%'
    and public.email_guard_eval(1000, 0, 1) like 'spam%'
    and public.email_guard_eval(1000, 0, 0) is null) as ok;
-- M6: evento duplicado é ignorado (roda num bloco que desfaz tudo)
do $$ declare r1 jsonb; r2 jsonb; begin
  r1 := public.email_apply_event('chk-dup-1', 'email.delivered', 'nao-existe', '{}'::jsonb, now());
  r2 := public.email_apply_event('chk-dup-1', 'email.delivered', 'nao-existe', '{}'::jsonb, now());
  if coalesce((r2->>'duplicate')::boolean, false) is not true then raise exception 'NAO_DUPLICADO'; end if;
  raise exception 'ROLLBACK_OK';
exception when others then
  if sqlerrm <> 'ROLLBACK_OK' then raise; end if;
end $$;
select not exists (select 1 from public.email_events where id = 'chk-dup-1') as ok;
-- M7: descadastro não rebaixa bounced e normaliza
do $$ declare s text; begin
  insert into public.email_contacts (email, status) values ('chk-b@exemplo.com', 'bounced');
  s := public.email_unsubscribe(' CHK-B@exemplo.com ', 'link');
  if s <> 'bounced' then raise exception 'REBAIXOU %', s; end if;
  s := public.email_unsubscribe('chk-u@exemplo.com', 'link');
  if s <> 'unsubscribed' then raise exception 'NAO_DESCADASTROU %', s; end if;
  raise exception 'ROLLBACK_OK';
exception when others then
  if sqlerrm <> 'ROLLBACK_OK' then raise; end if;
end $$;
select not exists (select 1 from public.email_contacts where email like 'chk-%@exemplo.com') as ok;
