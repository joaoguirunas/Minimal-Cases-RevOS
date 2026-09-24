/**
 * sac-redirect — quem chega no número oficial pedindo atendimento pós-venda
 * (rastreio, pedido, troca, cancelamento, reclamação) recebe UMA mensagem fixa
 * apontando o número do atendimento. A IA só classifica; o texto é fixo.
 *
 * Chamado pelo whatsapp-inbound ~20 s depois de cada mensagem (agrupa rajadas).
 * Body: { people_id, dry_run? }. Ligado por omni_channel_configs(whatsapp).settings.sac_redirect_enabled.
 * Travas: 1 execução por pessoa por minuto (unique), 1 direcionamento por pessoa a
 * cada 24 h, ignora testadores do agente SAC, só responde pelo canal oficial (Meta).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { classifyIntent, shouldRedirect, redirectText } from '../_shared/sac-redirect.ts';

const MODEL = 'gpt-5.6-luna';

Deno.serve(async (req) => {
  const srk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  let role = '';
  try { role = JSON.parse(atob(bearer.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role ?? ''; } catch (_) { /* não é JWT */ }
  if (role !== 'service_role' && bearer !== srk) return new Response('Forbidden', { status: 403 });

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, srk);
  const { people_id, dry_run } = await req.json().catch(() => ({})) as { people_id?: string; dry_run?: boolean };
  if (!people_id) return Response.json({ ok: false, error: 'people_id obrigatório' });
  const skip = (reason: string) => Response.json({ ok: true, redirected: false, reason });

  const { data: cfg } = await sb.from('omni_channel_configs').select('settings').eq('channel', 'whatsapp').maybeSingle();
  const enabled = ((cfg as { settings?: Record<string, unknown> } | null)?.settings ?? {}).sac_redirect_enabled === true;
  if (!enabled && !dry_run) return skip('desligado');

  // Testadores do agente SAC continuam falando com o agente de teste.
  const { data: tester } = await sb.from('leads').select('id, leads_pipelines!inner(name)')
    .eq('people_id', people_id).eq('status', 'in_progress').eq('leads_pipelines.name', 'Teste Agente (SAC)').limit(1);
  if ((tester ?? []).length) return skip('testador do agente SAC');

  // 1 direcionamento por pessoa a cada 24 h.
  const { data: recent } = await sb.from('sac_redirects').select('id').eq('people_id', people_id).eq('redirected', true)
    .eq('dry_run', false).gte('created_at', new Date(Date.now() - 24 * 3600_000).toISOString()).limit(1);
  if ((recent ?? []).length && !dry_run) return skip('já direcionado nas últimas 24 h');

  // Mensagens de texto do cliente nos últimos 15 min (a rajada inteira).
  const { data: msgs } = await sb.from('messages').select('content, channel, wa_phone_number_id')
    .eq('people_id', people_id).eq('from_contact', 'cliente').gte('created_at', new Date(Date.now() - 15 * 60_000).toISOString())
    .order('created_at', { ascending: true }).limit(10);
  const rows = ((msgs ?? []) as { content: string | null; channel: string | null; wa_phone_number_id: string | null }[]).filter((m) => m.channel === 'whatsapp');
  const texts = rows.map((m) => (m.content ?? '').trim()).filter(Boolean);
  if (!texts.length) return skip('sem texto recente');

  // Só pelo número oficial (Meta): o número dos grupos (Evolution) não atende cliente.
  const { data: meta } = await sb.from('settings_whatsapp_channels').select('id, phone_number_id').eq('provider', 'meta').eq('active', true).limit(1).maybeSingle();
  const metaPhoneId = (meta as { phone_number_id?: string } | null)?.phone_number_id;
  if (!rows.some((m) => m.wa_phone_number_id === metaPhoneId)) return skip('mensagem não veio pelo número oficial');

  // Trava de rajada: uma execução por pessoa por minuto.
  const bucket = Math.floor(Date.now() / 60_000);
  const { data: run, error: lockErr } = await sb.from('sac_redirects')
    .insert({ people_id, run_bucket: bucket, messages: texts.slice(-5), dry_run: !!dry_run }).select('id').single();
  if (lockErr) return skip('execução concorrente (mesmo minuto)');
  const runId = (run as { id: number }).id;

  const { data: prov } = await sb.from('settings_ai_providers').select('api_key').eq('provider', 'openai').eq('is_default', true).eq('active', true).single();
  let c;
  try { c = await classifyIntent((prov as { api_key: string }).api_key, MODEL, texts); }
  catch (e) {
    await sb.from('sac_redirects').update({ reason: `erro na classificação: ${String(e).slice(0, 150)}` }).eq('id', runId);
    return skip('erro na classificação');
  }
  const go = shouldRedirect(c);
  if (!go) {
    await sb.from('sac_redirects').update({ intent: c.intent, confidence: c.confidence, reason: 'intenção fora do pós-venda ou confiança baixa' }).eq('id', runId);
    return Response.json({ ok: true, redirected: false, intent: c.intent, confidence: c.confidence });
  }

  const { data: person } = await sb.from('clients_people').select('name, whatsapp').eq('id', people_id).maybeSingle();
  const text = redirectText(((person as { name?: string } | null)?.name ?? '').split(/\s+/)[0] || null);
  if (dry_run) {
    await sb.from('sac_redirects').update({ intent: c.intent, confidence: c.confidence, redirected: true, reason: 'dry-run (não enviado)' }).eq('id', runId);
    return Response.json({ ok: true, redirected: true, dry_run: true, intent: c.intent, confidence: c.confidence, text });
  }

  const { data: msgRow } = await sb.from('messages').insert({
    people_id, content: text, channel: 'whatsapp', from_contact: 'agente_ia', message_type: 'texto',
    status: 'pending', source_type: 'ai_agent', metadata: { sac_redirect: true, intent: c.intent },
  }).select('id').single();
  const out = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-outbound`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${srk}` },
    body: JSON.stringify({
      to: (person as { whatsapp?: string } | null)?.whatsapp, people_id,
      channel_id: (meta as { id?: string } | null)?.id,
      message_ids: msgRow ? [(msgRow as { id: number }).id] : [],
      messages: [{ type: 'text', text }],
    }),
  });
  const body = await out.json().catch(() => ({})) as { failed?: number; error?: string };
  const sent = out.ok && !body.failed && !body.error;
  await sb.from('sac_redirects').update({
    intent: c.intent, confidence: c.confidence, redirected: sent,
    message_id: (msgRow as { id: number } | null)?.id ?? null,
    reason: sent ? 'direcionado' : `falha no envio: ${body.error ?? out.status}`,
  }).eq('id', runId);
  return Response.json({ ok: true, redirected: sent, intent: c.intent, confidence: c.confidence });
});
