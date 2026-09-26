// supabase/functions/flow-admin/index.ts
/** API do editor de fluxos (admin/manager). Validação e publicação no servidor. */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateGraph, validateTriggerConfig, type FlowGraph } from '../_shared/flows/graph.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const STATUSES = ['draft', 'simulation', 'live', 'paused', 'archived'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const url = Deno.env.get('SUPABASE_URL')!;
  const auth = req.headers.get('Authorization') ?? '';
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: u } = await userClient.auth.getUser(auth.replace('Bearer ', ''));
  if (!u?.user) return json({ ok: false, error: 'Unauthorized' }, 401);
  const sb = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: me } = await sb.from('settings_users').select('id, user_type, super_admin, active, deleted_at').eq('auth_user_id', u.user.id).maybeSingle();
  const m = me as { id: string; user_type: string | null; super_admin: boolean | null; active: boolean | null; deleted_at: string | null } | null;
  if (!m?.active || m.deleted_at || !(m.super_admin || m.user_type === 'admin' || m.user_type === 'manager')) return json({ ok: false, error: 'Sem permissão' }, 403);
  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  const id = String(b.id ?? '');

  const catalogSets = async () => {
    const [{ data: wa }, { data: em }] = await Promise.all([
      sb.from('whatsapp_templates').select('id_template, name, status, json_data'),
      sb.from('email_templates').select('id, name, subject, active'),
    ]);
    return {
      wa: (wa ?? []) as { id_template: string; name: string; status: string; json_data: { components?: { type: string; text?: string }[] } }[],
      em: (em ?? []) as { id: string; name: string; subject: string; active: boolean }[],
    };
  };

  switch (b.action) {
    case 'list': {
      const { data: flows } = await sb.from('flows').select('id, name, status, trigger_type, trigger_config, updated_at').neq('status', 'archived').order('updated_at', { ascending: false });
      const out = [];
      for (const f of (flows ?? []) as { id: string }[]) {
        const [{ count: active }, stats] = await Promise.all([
          sb.from('flow_runs').select('id', { count: 'exact', head: true }).eq('flow_id', f.id).eq('status', 'active'),
          sb.rpc('flow_stats', { p_flow_id: f.id, p_days: 7 }),
        ]);
        const s = Object.values((stats.data ?? {}) as Record<string, { sent: number; sales: number }>);
        out.push({ ...f, active_runs: active ?? 0, sent_7d: s.reduce((a, x) => a + (x.sent ?? 0), 0), sales_7d: s.reduce((a, x) => a + (x.sales ?? 0), 0) });
      }
      return json({ ok: true, flows: out });
    }
    case 'get': {
      const [{ data: flow }, { data: versions }, { data: stats }] = await Promise.all([
        sb.from('flows').select('*').eq('id', id).maybeSingle(),
        sb.from('flow_versions').select('id, version, published_at').eq('flow_id', id).order('version', { ascending: false }),
        sb.rpc('flow_stats', { p_flow_id: id, p_days: 30 }),
      ]);
      if (!flow) return json({ ok: false, error: 'não encontrado' }, 404);
      return json({ ok: true, flow, versions: versions ?? [], stats: stats ?? {} });
    }
    case 'create': {
      const cfgErr = validateTriggerConfig(String(b.trigger_type ?? 'manual'), (b.trigger_config ?? {}) as Record<string, unknown>);
      if (cfgErr) return json({ ok: false, error: cfgErr }, 400);
      const { data, error } = await sb.from('flows').insert({
        name: String(b.name ?? 'Novo fluxo').slice(0, 120), trigger_type: String(b.trigger_type ?? 'manual'), trigger_config: b.trigger_config ?? {},
        created_by: m.id, draft_graph: { nodes: [{ id: 'trigger', type: 'trigger', position: { x: 0, y: 0 }, data: {} }], edges: [] },
      }).select('id').single();
      if (error) return json({ ok: false, error: error.message }, 400);
      return json({ ok: true, id: (data as { id: string }).id });
    }
    case 'save_draft': {
      if ('trigger_type' in b || 'trigger_config' in b) {
        const { data: cur } = await sb.from('flows').select('trigger_type, trigger_config').eq('id', id).maybeSingle();
        const c = cur as { trigger_type: string; trigger_config: Record<string, unknown> } | null;
        const cfgErr = validateTriggerConfig(String(b.trigger_type ?? c?.trigger_type), (b.trigger_config ?? c?.trigger_config ?? {}) as Record<string, unknown>);
        if (cfgErr) return json({ ok: false, error: cfgErr }, 400);
      }
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const k of ['name', 'draft_graph', 'trigger_config', 'exit_on_purchase', 'reentry', 'description', 'trigger_type']) if (k in b) patch[k] = b[k];
      const { error } = await sb.from('flows').update(patch).eq('id', id);
      return error ? json({ ok: false, error: error.message }, 400) : json({ ok: true });
    }
    case 'validate':
    case 'publish': {
      const { data: flow } = await sb.from('flows').select('draft_graph').eq('id', id).maybeSingle();
      if (!flow) return json({ ok: false, error: 'não encontrado' }, 404);
      const { wa, em } = await catalogSets();
      const res = validateGraph((flow as { draft_graph: FlowGraph }).draft_graph, {
        approvedWaTemplates: new Set(wa.filter((t) => String(t.status).toLowerCase() === 'approved').map((t) => String(t.id_template))),
        activeEmailTemplates: new Set(em.filter((t) => t.active !== false).map((t) => t.id)),
      });
      if (b.action === 'validate' || !res.ok) return json({ ok: res.ok, errors: res.errors });
      const { data: last } = await sb.from('flow_versions').select('version').eq('flow_id', id).order('version', { ascending: false }).limit(1).maybeSingle();
      const version = ((last as { version?: number } | null)?.version ?? 0) + 1;
      const { data: v, error } = await sb.from('flow_versions').insert({ flow_id: id, version, graph: (flow as { draft_graph: FlowGraph }).draft_graph, published_by: m.id }).select('id').single();
      if (error) return json({ ok: false, error: error.message }, 400);
      await sb.from('flows').update({ live_version_id: (v as { id: string }).id, updated_at: new Date().toISOString() }).eq('id', id);
      return json({ ok: true, version });
    }
    case 'set_status': {
      const status = String(b.status);
      if (!STATUSES.includes(status)) return json({ ok: false, error: 'status inválido' }, 400);
      const { data: f } = await sb.from('flows').select('live_version_id, trigger_type, trigger_config').eq('id', id).maybeSingle();
      const fr = f as { live_version_id?: string; trigger_type?: string; trigger_config?: Record<string, unknown> } | null;
      if (['simulation', 'live'].includes(status) && !fr?.live_version_id) return json({ ok: false, error: 'publique uma versão antes' }, 400);
      // fluxos de esteira precisam de funil: é o funil em 'flows' que libera o envio real
      if (status === 'live' && !['manual', 'purchased'].includes(String(fr?.trigger_type)) && !fr?.trigger_config?.pipeline)
        return json({ ok: false, error: 'defina o funil do gatilho antes de ativar' }, 400);
      await sb.from('flows').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
      if (status === 'archived') await sb.from('flow_runs').update({ status: 'exited', exit_reason: 'archived', ended_at: new Date().toISOString() }).eq('flow_id', id).eq('status', 'active');
      return json({ ok: true });
    }
    case 'add_person': {
      const { data: f } = await sb.from('flows').select('trigger_type').eq('id', id).maybeSingle();
      if ((f as { trigger_type?: string } | null)?.trigger_type !== 'manual') return json({ ok: false, error: 'só fluxos com gatilho manual aceitam pessoa adicionada à mão' }, 400);
      const { data: n } = await sb.rpc('flow_trigger', { p_event: 'manual', p_people_id: String(b.people_id), p_lead_id: null, p_payload: {} });
      return json({ ok: true, created: n ?? 0 });
    }
    case 'sim_compare': {
      const days = Math.max(1, Math.min(14, Number(b.days ?? 3)));
      const { data, error } = await sb.rpc('flow_sim_compare', { p_flow_id: id, p_from: new Date(Date.now() - days * 86_400_000).toISOString(), p_to: new Date().toISOString() });
      return error ? json({ ok: false, error: error.message }, 400) : json({ ok: true, ...(data as Record<string, unknown>) });
    }
    case 'engine': {
      if (!(m.super_admin || m.user_type === 'admin')) return json({ ok: false, error: 'só admin troca o motor' }, 403);
      const pipeline = String(b.pipeline ?? ''); const engine = String(b.engine ?? '');
      if (!['rules', 'flows'].includes(engine) || !pipeline) return json({ ok: false, error: 'parâmetros inválidos' }, 400);
      const { data: cfg } = await sb.from('omni_channel_configs').select('settings').eq('channel', 'whatsapp').maybeSingle();
      const s = ((cfg as { settings?: Record<string, unknown> } | null)?.settings ?? {}) as Record<string, unknown>;
      const cur = (s.esteira_engine ?? {}) as Record<string, string>;
      await sb.from('omni_channel_configs').update({ settings: { ...s, esteira_engine: { ...cur, [pipeline]: engine } } }).eq('channel', 'whatsapp');
      return json({ ok: true, esteira_engine: { ...cur, [pipeline]: engine } });
    }
    case 'catalog': {
      const { wa, em } = await catalogSets();
      const { data: st } = await sb.from('leads_stages').select('id, name, leads_pipelines(name)');
      return json({
        ok: true,
        wa_templates: wa.map((t) => ({ id_template: t.id_template, name: t.name, status: t.status, body: t.json_data?.components?.find((c) => c.type === 'BODY')?.text ?? '' })),
        email_templates: em.filter((t) => t.active !== false).map((t) => ({ id: t.id, name: t.name, subject: t.subject })),
        stages: ((st ?? []) as unknown as { id: string; name: string; leads_pipelines: { name: string } | null }[]).map((s) => ({ id: s.id, name: s.name, pipeline: s.leads_pipelines?.name ?? '' })),
      });
    }
  }
  return json({ ok: false, error: 'ação desconhecida' }, 400);
});
