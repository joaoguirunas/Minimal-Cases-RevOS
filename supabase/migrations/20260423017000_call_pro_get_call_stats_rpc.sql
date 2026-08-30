-- RPC: get_call_stats
-- Aggregates call_pro_calls KPIs server-side, replacing client-side aggregation in useCallProBIStats.
-- Tenant-scoped via RLS on call_pro_calls and settings_users.
-- Returns JSONB matching the CallBIData interface in the frontend hook.

create or replace function get_call_stats(
  date_from timestamptz,
  date_to   timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total         bigint;
  v_answered      bigint;
  v_missed        bigint;
  v_failed        bigint;
  v_outbound      bigint;
  v_inbound       bigint;
  v_answer_rate   numeric;
  v_avg_duration  bigint;
  v_total_cost    numeric;
  v_avg_cost      numeric;
  v_off_hours_rate numeric;
  v_by_operator   jsonb;
  v_evolution     jsonb;
  v_top_outcomes  jsonb;
begin
  -- KPIs (single aggregate scan)
  select
    count(*),
    count(*) filter (where status = 'answered'),
    count(*) filter (where status in ('missed','abandoned')),
    count(*) filter (where status in ('failed','no-answer')),
    count(*) filter (where direction = 'outbound'),
    count(*) filter (where direction = 'inbound'),
    round(
      case when count(*) > 0
        then count(*) filter (where status = 'answered') * 100.0 / count(*)
        else 0
      end, 2),
    coalesce(round(avg(duration) filter (where status = 'answered' and duration > 0))::bigint, 0),
    coalesce(sum(cost) filter (where cost > 0), 0),
    coalesce(avg(cost) filter (where cost > 0), 0),
    round(
      case when count(*) > 0
        then count(*) filter (where business_hours_call = false) * 100.0 / count(*)
        else 0
      end, 2)
  into
    v_total, v_answered, v_missed, v_failed,
    v_outbound, v_inbound, v_answer_rate, v_avg_duration,
    v_total_cost, v_avg_cost, v_off_hours_rate
  from call_pro_calls
  where started_at >= date_from
    and started_at <= date_to;

  -- By operator
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'userId',      coalesce(c.user_id, '__unknown__'),
        'name',        coalesce(u.name, 'Desconhecido'),
        'total',       count(*),
        'answered',    count(*) filter (where c.status = 'answered'),
        'missed',      count(*) filter (where c.status in ('missed','abandoned')),
        'answerRate',  round(
                         case when count(*) > 0
                           then count(*) filter (where c.status = 'answered') * 100.0 / count(*)
                           else 0
                         end, 2),
        'avgDuration', coalesce(
                         round(avg(c.duration) filter (where c.status = 'answered' and c.duration > 0))::bigint,
                         0)
      )
      order by count(*) desc
    ),
    '[]'::jsonb
  )
  into v_by_operator
  from call_pro_calls c
  left join settings_users u on u.id = c.user_id
  where c.started_at >= date_from
    and c.started_at <= date_to
  group by c.user_id, u.name;

  -- Evolution (daily)
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date',     to_char(day, 'YYYY-MM-DD'),
        'total',    total,
        'answered', answered,
        'missed',   missed
      )
      order by day
    ),
    '[]'::jsonb
  )
  into v_evolution
  from (
    select
      (started_at at time zone 'UTC')::date                       as day,
      count(*)                                                     as total,
      count(*) filter (where status = 'answered')                 as answered,
      count(*) filter (where status in ('missed','abandoned'))    as missed
    from call_pro_calls
    where started_at >= date_from
      and started_at <= date_to
    group by (started_at at time zone 'UTC')::date
  ) daily;

  -- Top outcomes (up to 8)
  select coalesce(
    jsonb_agg(
      jsonb_build_object('outcome', outcome, 'count', cnt)
      order by cnt desc
    ),
    '[]'::jsonb
  )
  into v_top_outcomes
  from (
    select outcome, count(*) as cnt
    from call_pro_calls
    where started_at >= date_from
      and started_at <= date_to
      and outcome is not null
    group by outcome
    order by cnt desc
    limit 8
  ) outcomes;

  return jsonb_build_object(
    'kpis', jsonb_build_object(
      'total',          v_total,
      'answered',       v_answered,
      'missed',         v_missed,
      'failed',         v_failed,
      'outbound',       v_outbound,
      'inbound',        v_inbound,
      'answerRate',     v_answer_rate,
      'avgDuration',    v_avg_duration,
      'totalCost',      v_total_cost,
      'avgCostPerCall', v_avg_cost,
      'offHoursRate',   v_off_hours_rate
    ),
    'byOperator',  v_by_operator,
    'evolution',   v_evolution,
    'topOutcomes', v_top_outcomes
  );
end;
$$;

grant execute on function get_call_stats(timestamptz, timestamptz) to authenticated;
