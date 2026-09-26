// supabase/functions/flow-runner/index.ts
/** Cron (1/min): avança execuções de fluxo que acordaram. Envio real = linha na followup_queue (o worker envia). */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { advanceRun, type RunnerDeps, type RunState } from '../_shared/flows/runner.ts';
import type { FlowGraph } from '../_shared/flows/graph.ts';

const BATCH = 100;
const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

// settings_business_hours: enabled, start_hour, end_hour, days_of_week, timezone (mesma tabela do worker)
type BhSettings = { enabled?: boolean; timezone?: string; start_hour?: string | number; end_hour?: string | number; days_of_week?: number[] };
const hm = (v: string | number | undefined, dflt: string) => { const t = String(v ?? dflt); const [h, m] = t.includes(':') ? t.split(':').map(Number) : [Number(t), 0]; return [h || 0, m || 0]; };
function nextOpen(from: Date, bh: BhSettings | null): Date {
  if (!bh?.enabled) return from;
  const tz = bh.timezone || 'America/Sao_Paulo';
  const [sh, sm] = hm(bh.start_hour, '09:00');
  const [eh, em] = hm(bh.end_hour, '18:00');
  const days = bh.days_of_week ?? [1, 2, 3, 4, 5];
  for (let i = 0; i < 8 * 24 * 4; i++) { // passo de 15 min, até 8 dias
    const t = new Date(from.getTime() + i * 15 * 60_000);
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, weekday: 'short', hour: '2-digit', minute: '2-digit' })
      .formatToParts(t).map((p) => [p.type, p.value]));
    const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
    const mins = (Number(parts.hour) % 24) * 60 + Number(parts.minute);
    if (days.includes(dow) && mins >= sh * 60 + sm && mins < eh * 60 + em) return i === 0 ? from : t;
  }
  return from;
}

Deno.serve(async (req) => {
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  let role = '';
  try { role = JSON.parse(atob(bearer.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role ?? ''; } catch { /* */ }
  if (role !== 'service_role' && bearer !== Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) return new Response('Forbidden', { status: 403 });

  const { data: runs, error } = await sb.rpc('flow_claim_runs', { p_limit: BATCH });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  const list = (runs ?? []) as Array<{ id: string; flow_id: string; version_id: string; people_id: string; lead_id: string | null; mode: 'live' | 'simulation'; current_node_id: string | null; context: Record<string, unknown>; started_at: string; attempts: number }>;
  if (!list.length) return Response.json({ ok: true, processed: 0 });

  const versionIds = [...new Set(list.map((r) => r.version_id))];
  const flowIds = [...new Set(list.map((r) => r.flow_id))];
  const [{ data: versions }, { data: flows }, { data: bhRow }] = await Promise.all([
    sb.from('flow_versions').select('id, graph').in('id', versionIds),
    sb.from('flows').select('id, exit_on_purchase, trigger_config, name').in('id', flowIds),
    sb.from('settings_business_hours').select('*').limit(1).maybeSingle(),
  ]);
  const graphOf = new Map((versions ?? []).map((v: { id: string; graph: FlowGraph }) => [v.id, v.graph]));
  const flowOf = new Map((flows ?? []).map((f: { id: string; exit_on_purchase: boolean; trigger_config: Record<string, unknown>; name: string }) => [f.id, f]));
  const bh = bhRow as BhSettings | null;

  const deps: RunnerDeps = {
    now: () => new Date(),
    purchasedSince: async (pid, since) => {
      const { count } = await sb.from('orders').select('id', { count: 'exact', head: true }).eq('people_id', pid).eq('is_paid', true).gte('paid_at', since);
      return (count ?? 0) > 0;
    },
    leadActive: async (leadId) => {
      const { data } = await sb.from('leads').select('status, leads_stages(name)').eq('id', leadId).maybeSingle();
      const l = data as { status: string; leads_stages: { name: string } | null } | null;
      return !!l && l.status === 'in_progress' && ['Carrinho abandonado', 'Em recuperação', 'Engajou'].includes(l.leads_stages?.name ?? '');
    },
    clickedSince: async (pid, since, channel) => {
      let q = sb.from('tracked_link_clicks').select('id, tracked_links!inner(channel)', { count: 'exact', head: true })
        .eq('people_id', pid).eq('is_bot', false).eq('is_duplicate', false).gte('clicked_at', since);
      if (channel) q = q.eq('tracked_links.channel', channel);
      const { count } = await q;
      return (count ?? 0) > 0;
    },
    contact: async (pid) => {
      const { data } = await sb.from('clients_people').select('whatsapp, telefone, email').eq('id', pid).maybeSingle();
      const p = data as { whatsapp: string | null; telefone: string | null; email: string | null } | null;
      const { data: st } = p?.email ? await sb.rpc('email_contact_status', { p_email: p.email }) : { data: null };
      return { whatsapp: !!(p?.whatsapp || p?.telefone), email: !!p?.email && st === 'subscribed', tags: [] };
    },
    nextBusinessOpen: async (from) => nextOpen(from, bh),
    enqueueSend: async ({ run, node, channel, vars }) => {
      // a fila exige lead: usa o da execução ou o mais recente da pessoa
      let leadId = run.leadId;
      if (!leadId) {
        const { data: l } = await sb.from('leads').select('id').eq('people_id', run.peopleId).order('created_at', { ascending: false }).limit(1).maybeSingle();
        leadId = (l as { id?: string } | null)?.id ?? null;
      }
      if (!leadId) throw new Error('pessoa sem lead: não dá para enfileirar o envio');
      const tplId = channel === 'whatsapp_template' ? String(node.data.template_id) : null;
      let subject: string | null = null;
      if (channel === 'email') {
        const { data: t } = await sb.from('email_templates').select('subject').eq('id', node.data.email_template_id).maybeSingle();
        subject = (t as { subject?: string } | null)?.subject ?? null;
      }
      const { data, error } = await sb.from('followup_queue').insert({
        followup_id: null, lead_id: leadId, person_id: run.peopleId, channel, template_id: tplId, subject, message: '',
        source_type: 'flow', scheduled_for: new Date().toISOString(), status: 'pending',
        flow_run_id: run.id, flow_node_id: node.id, vars,
      }).select('id').single();
      if (error) throw new Error(`enfileirar: ${error.message}`);
      return (data as { id: string }).id;
    },
    moveStage: async (leadId, stageId) => { const { error } = await sb.from('leads').update({ leads_stages_id: stageId }).eq('id', leadId); if (error) throw new Error(error.message); },
    addTag: async (pid, leadId, tag) => {
      const { data: t } = await sb.from('lead_tags').select('id').eq('name', tag).maybeSingle();
      const tagId = (t as { id?: string } | null)?.id ?? ((await sb.from('lead_tags').insert({ name: tag }).select('id').single()).data as { id: string }).id;
      if (leadId) await sb.from('leads_tags').upsert({ lead_id: leadId, tag_id: tagId }, { onConflict: 'lead_id,tag_id', ignoreDuplicates: true });
    },
  };

  let done = 0;
  for (const r of list) {
    const graph = graphOf.get(r.version_id); const flow = flowOf.get(r.flow_id);
    if (!graph || !flow) continue;
    const state: RunState = { id: r.id, flowId: r.flow_id, peopleId: r.people_id, leadId: r.lead_id, mode: r.mode, currentNodeId: r.current_node_id, context: r.context ?? {}, startedAt: r.started_at };
    try {
      const res = await advanceRun(state, graph, { exitOnPurchase: flow.exit_on_purchase }, deps);
      if (res.logs.length) await sb.from('flow_run_steps').insert(res.logs.map((l) => ({ run_id: r.id, flow_id: r.flow_id, node_id: l.nodeId, node_type: l.nodeType, action: l.action, detail: l.detail ?? {} })));
      await sb.from('flow_runs').update({
        status: res.status, current_node_id: res.currentNodeId, wake_at: res.wakeAt, context: res.context, attempts: 0,
        exit_reason: res.exitReason ?? null, ended_at: res.status === 'active' ? null : new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', r.id);
      done++;
    } catch (e) {
      const attempts = (r.attempts ?? 0) + 1;
      await sb.from('flow_run_steps').insert({ run_id: r.id, flow_id: r.flow_id, node_id: r.current_node_id ?? '-', node_type: 'error', action: 'error', detail: { message: String(e).slice(0, 300), attempt: attempts } });
      await sb.from('flow_runs').update(attempts >= 3
        ? { status: 'failed', attempts, exit_reason: String(e).slice(0, 200), ended_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        : { attempts, wake_at: new Date(Date.now() + 5 * 60_000).toISOString(), updated_at: new Date().toISOString() }).eq('id', r.id);
    }
  }
  return Response.json({ ok: true, processed: done, claimed: list.length });
});
