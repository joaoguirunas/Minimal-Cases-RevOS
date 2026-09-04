/**
 * klaviyo-sync-templates (KLV-2)
 *
 * Admin-only: empurra os templates ativos da biblioteca (email_templates) para o
 * Klaviyo via Templates API (POST/PATCH /api/templates), convertendo os tokens do
 * CRM para a sintaxe de evento do Klaviyo:
 *   {{nome}}         → {{ event.nome }}
 *   {{pessoa.nome}}  → {{ event|lookup:'pessoa.nome' }}   (chave com ponto)
 *
 * Assim o Flow disparado pela métrica "CRM Email Followup" pode simplesmente
 * selecionar o template "CRM · <nome>" no editor — as propriedades do evento
 * preenchem as variáveis. (Alternativa ao template de uma linha {{ event.html|safe }}.)
 *
 * Upsert por nome: se "CRM · <nome>" já existe no Klaviyo, faz PATCH; senão POST.
 * A API key vem de omni_channel_configs (channel=email, provider klaviyo).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, err200, ok200 } from '../_shared/response.ts';
import { KlaviyoAuthError, KlaviyoClient } from '../_shared/klaviyo-client.ts';

const TOKEN_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

/** Converte tokens do CRM para a sintaxe de evento do Klaviyo. */
export function toKlaviyoEventSyntax(text: string): string {
  return text.replace(TOKEN_RE, (_full, key: string) =>
    key.includes('.')
      ? `{{ event|lookup:'${key}' }}`
      : `{{ event.${key} }}`);
}

// ── Imagens (EMAIL-3): host público automático ─────────────────────────────────
// Antes de exportar, TODA imagem do template vira URL pública do bucket
// email-assets: data-URIs sobem pro Storage (e o template da biblioteca é
// atualizado com a URL — o base64 sai do banco), caminhos relativos e
// {{asset_base}} são resolvidos pra base configurada.

const DATA_URI_RE = /src="(data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+))"/g;

const EXT_BY_MIME: Record<string, string> = { png: 'png', jpeg: 'jpg', jpg: 'jpg', webp: 'webp', gif: 'gif' };

async function sha1Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', bytes.buffer as ArrayBuffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function resolveAssetBase(creds: Record<string, string | undefined>, supabaseUrl: string): string {
  return (creds.asset_base?.trim().replace(/\/+$/, ''))
    || Deno.env.get('EMAIL_ASSET_BASE')?.replace(/\/+$/, '')
    || `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/email-assets`;
}

/**
 * Sobe data-URIs do HTML pro bucket (nome = hash do conteúdo, idempotente) e
 * troca o src pela URL pública. Retorna o HTML novo e se houve mudança.
 */
async function hostInlineImages(
  storage: ReturnType<typeof createClient>['storage'],
  html: string,
  supabaseUrl: string,
): Promise<{ html: string; changed: boolean }> {
  let changed = false;
  const matches = [...html.matchAll(DATA_URI_RE)];
  let out = html;
  for (const m of matches) {
    const [full, , mime, b64] = m;
    try {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const name = `inline-${(await sha1Hex(bytes)).slice(0, 16)}.${EXT_BY_MIME[mime] ?? 'png'}`;
      const { error } = await storage.from('email-assets')
        .upload(name, bytes.buffer as ArrayBuffer, { contentType: `image/${mime === 'jpg' ? 'jpeg' : mime}`, upsert: true });
      if (error) continue;
      const publicUrl = `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/email-assets/${name}`;
      out = out.replaceAll(full, `src="${publicUrl}"`);
      changed = true;
    } catch (_) { /* imagem fica inline — não trava o sync */ }
  }
  return { html: out, changed };
}

/** Resolve {{asset_base}} e caminhos relativos /email-assets/ pra base pública. */
export function resolveImageUrls(html: string, assetBase: string): string {
  return html
    .replaceAll('{{asset_base}}', assetBase)
    .replaceAll('src="/email-assets/', `src="${assetBase}/`);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  try {
    // ── Auth: JWT + gate gestor (mesmo padrão dos *-connect) ────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return err200('Unauthorized', 'UNAUTHORIZED');
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return err200('Invalid token', 'UNAUTHORIZED');

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: crmUser } = await supabase
      .from('settings_users')
      .select('id, user_type, super_admin')
      .eq('auth_user_id', user.id)
      .eq('active', true)
      .maybeSingle();
    const isManager = crmUser &&
      (crmUser.super_admin === true || crmUser.user_type === 'gestor' ||
        crmUser.user_type === 'manager' || crmUser.user_type === 'admin');
    if (!crmUser || !isManager) return err200('Acesso restrito a gestores', 'FORBIDDEN');

    // ── API key do canal e-mail (provider klaviyo) ──────────────────────────
    const { data: cfg } = await supabase
      .from('omni_channel_configs')
      .select('credentials')
      .eq('channel', 'email')
      .maybeSingle();
    const creds = ((cfg as { credentials?: Record<string, string> } | null)?.credentials ?? {});
    const apiKey = creds.api_key;
    if (creds.provider !== 'klaviyo' || !apiKey) {
      return err200('Configure o canal E-mail com provider Klaviyo (e salve) antes de sincronizar.', 'NOT_CONFIGURED');
    }
    const client = new KlaviyoClient(apiKey);

    const body = (await req.json().catch(() => ({}))) as { action?: string; flow_id?: string };

    // ── AUDIT (KLV-5): leitura pura da conta antes de qualquer escrita ───────
    // Só GETs. Nenhum evento, nenhum perfil, nenhum template, nenhum flow.
    // Serve para ver o que já roda em produção e detectar colisão de nome
    // antes de o CRM criar qualquer coisa.
    // ── FLOW_DEF: definição completa de um flow (leitura pura, diagnóstico) ──
    if (body.action === 'flow_def') {
      const id = String((body as { flow_id?: string }).flow_id ?? '');
      if (!id) return err200('flow_id é obrigatório', 'BAD_REQUEST');
      try {
        return ok200({ ok: true, def: await client.getFlowDefinition(id) });
      } catch (e) {
        return err200(`Falha: ${(e as Error).message}`, 'API_ERROR');
      }
    }

    // ── EVENTS: últimos eventos da métrica do CRM (leitura pura) ────────────
    if (body.action === 'events') {
      try {
        const metricName = creds.metric_email?.trim() || 'CRM Email Followup';
        const m = await client.findMetricByName(metricName);
        if (!m) return ok200({ ok: true, metrica: metricName, existe: false, eventos: [] });
        return ok200({ ok: true, metrica: metricName, metric_id: m.id, eventos: await client.listRecentEvents(m.id, 10) });
      } catch (e) {
        return err200(`Falha: ${(e as Error).message}`, 'API_ERROR');
      }
    }

    if (body.action === 'audit') {
      const nomesCrm = ['CRM · Corpo dinâmico (event.html)', 'CRM · Email Followup (auto)', 'CRM · SMS Followup (auto)'];
      try {
        const [flows, templates, metrics, account] = await Promise.all([
          client.listFlows(),
          client.listTemplateNames(),
          client.listMetrics(),
          client.getAccount().catch(() => null),
        ]);
        const { data: tplRows } = await supabase.from('email_templates').select('name').eq('active', true);
        const nomesDestino = ((tplRows ?? []) as Array<{ name: string }>).map((t) => `CRM · ${t.name}`.slice(0, 255));
        const colisoes = templates.filter((t) => nomesDestino.includes(t.name) || nomesCrm.includes(t.name));
        // Remetente: o que a conta traz como padrão + o que os flows Live já usam
        // (esses endereços estão provadamente aprovados para envio).
        const acc = (account ?? {}) as Record<string, unknown>;
        const contact = (acc.contact_information ?? {}) as Record<string, unknown>;
        return ok200({
          ok: true,
          remetente: {
            organizacao: acc.organization_name ?? contact.organization_name ?? null,
            default_sender_name: contact.default_sender_name ?? null,
            default_sender_email: contact.default_sender_email ?? null,
            endereco_publico: contact.street_address ?? null,
            dica: 'default_sender_email é o remetente padrão verificado da conta. Se estiver vazio, use um endereço do domínio verificado em Klaviyo → Settings → Domains.',
          },
          flows: {
            total: flows.length,
            live: await Promise.all(flows.filter((f) => /live/i.test(f.status)).map(async (f) => {
              // Gatilho real (nome da métrica) — é o que diz se um flow do cliente
              // concorre com a esteira do CRM.
              let gatilhos: unknown = null;
              try {
                const def = await client.getFlowDefinition(f.id);
                const d = (def?.definition ?? {}) as Record<string, unknown>;
                const trigs = (d.triggers ?? []) as Array<Record<string, unknown>>;
                gatilhos = trigs.map((t) => {
                  const tid = (t.id ?? (t.metric_id as unknown)) as string | undefined;
                  const met = tid ? metrics.find((m) => m.id === tid) : undefined;
                  return { tipo: t.type ?? null, metrica: met?.name ?? tid ?? null, integracao: met?.integration ?? null };
                });
              } catch (_) { gatilhos = 'não foi possível ler a definição'; }
              return { id: f.id, name: f.name, status: f.status, trigger_type: f.trigger_type, gatilhos };
            })),
            draft: flows.filter((f) => !/live/i.test(f.status)).map((f) => ({ id: f.id, name: f.name, status: f.status })),
            colisao_nome_crm: flows.filter((f) => nomesCrm.includes(f.name)).map((f) => ({ name: f.name, status: f.status })),
          },
          templates: { total: templates.length, colisao_nome_crm: colisoes },
          metricas: {
            total: metrics.length,
            ja_existe_crm_email: metrics.some((m) => m.name === (creds.metric_email?.trim() || 'CRM Email Followup')),
            amostra: metrics.slice(0, 25).map((m) => ({ name: m.name, integration: m.integration })),
          },
          o_que_o_crm_criaria: { templates: nomesDestino, flows: nomesCrm },
        });
      } catch (e) {
        if (e instanceof KlaviyoAuthError) return err200('Klaviyo rejeitou a API key', 'AUTH_ERROR');
        return err200(`Falha na auditoria: ${(e as Error).message}`, 'API_ERROR');
      }
    }

    // ── BOOTSTRAP DE FLOWS (KLV-3): cria métrica, template dinâmico e flows ──
    if (body.action === 'bootstrap_flows') {
      const callerEmail = (user.email ?? '').toLowerCase();
      if (!callerEmail) return err200('Usuário sem e-mail — necessário para semear a métrica.', 'NO_EMAIL');

      const steps: Array<{ step: string; status: string; detail?: string }> = [];
      const metricEmailName = creds.metric_email?.trim() || 'CRM Email Followup';

      // 1. Métrica só existe após o primeiro evento — semeia com um evento pro próprio gestor.
      const ensureMetric = async (name: string, canal: string): Promise<string | null> => {
        let m = await client.findMetricByName(name);
        if (!m) {
          await client.createEvent({
            metricName: name,
            profile: { email: callerEmail },
            properties: { subject: 'Bootstrap CRM', message: 'Bootstrap CRM', html: '<p>Bootstrap</p>', canal, origem: 'revos-crm-bootstrap' },
          });
          // Ingestão do evento é assíncrona; tenta por ~20s.
          for (let i = 0; i < 10 && !m; i++) {
            await new Promise((r) => setTimeout(r, 2000));
            m = await client.findMetricByName(name);
          }
        }
        return m?.id ?? null;
      };

      // 2. Template dinâmico de 1 linha (corpo vem pronto no evento).
      const dynName = 'CRM · Corpo dinâmico (event.html)';
      let dynTplId: string | null = null;
      try {
        const existing = await client.findTemplateByName(dynName);
        if (existing) { dynTplId = existing.id; steps.push({ step: 'template dinâmico', status: 'já existia' }); }
        else {
          const created = await client.createTemplate(dynName, '{{ event.html|safe }}');
          dynTplId = created?.data?.id ?? null;
          steps.push({ step: 'template dinâmico', status: 'criado' });
        }
      } catch (e) {
        steps.push({ step: 'template dinâmico', status: 'falhou', detail: (e as Error).message.slice(0, 200) });
      }

      // 3. Flow de e-mail.
      const fromEmail = creds.from_email?.trim();
      const fromLabel = creds.from_name?.trim() || 'Minimal Cases';
      if (!fromEmail) {
        steps.push({ step: 'flow e-mail', status: 'pulado', detail: 'Preencha o From Email na aba Klaviyo (remetente verificado no Klaviyo).' });
      } else if (!dynTplId) {
        steps.push({ step: 'flow e-mail', status: 'pulado', detail: 'sem template dinâmico' });
      } else {
        const flowName = 'CRM · Email Followup (auto)';
        try {
          const existing = await client.findFlowByName(flowName);
          if (existing) steps.push({ step: 'flow e-mail', status: 'já existia' });
          else {
            const metricId = await ensureMetric(metricEmailName, 'email');
            if (!metricId) throw new Error(`métrica "${metricEmailName}" não apareceu após o evento de bootstrap`);
            await client.createFlow(flowName, {
              triggers: [{ type: 'metric', id: metricId }],
              profile_filter: null,
              actions: [{
                temporary_id: 'email-1',
                type: 'send-email',
                links: { next: null },
                data: {
                  message: {
                    from_email: fromEmail,
                    from_label: fromLabel,
                    subject_line: '{{ event.subject }}',
                    preview_text: '',
                    template_id: dynTplId,
                    smart_sending_enabled: false,
                    transactional: false,
                    name: 'E-mail do CRM',
                  },
                  status: 'draft',
                },
              }],
              entry_action_id: 'email-1',
            });
            steps.push({ step: 'flow e-mail', status: 'criado (em rascunho — revise e ative o Live no Klaviyo)' });
          }
        } catch (e) {
          steps.push({ step: 'flow e-mail', status: 'falhou', detail: (e as Error).message.slice(0, 300) });
        }
      }

      // 4. Flow de SMS (se o canal SMS estiver com provider klaviyo).
      const { data: smsCfg } = await supabase
        .from('omni_channel_configs')
        .select('credentials')
        .eq('channel', 'sms')
        .maybeSingle();
      const smsCreds = ((smsCfg as { credentials?: Record<string, string> } | null)?.credentials ?? {});
      if (smsCreds.provider === 'klaviyo' && smsCreds.api_key) {
        const smsClient = new KlaviyoClient(smsCreds.api_key);
        const metricSmsName = smsCreds.metric_sms?.trim() || 'CRM SMS Followup';
        const flowName = 'CRM · SMS Followup (auto)';
        try {
          const existing = await smsClient.findFlowByName(flowName);
          if (existing) steps.push({ step: 'flow sms', status: 'já existia' });
          else {
            let m = await smsClient.findMetricByName(metricSmsName);
            if (!m) {
              await smsClient.createEvent({
                metricName: metricSmsName,
                profile: { email: callerEmail },
                properties: { message: 'Bootstrap CRM', canal: 'sms', origem: 'revos-crm-bootstrap' },
              });
              for (let i = 0; i < 10 && !m; i++) {
                await new Promise((r) => setTimeout(r, 2000));
                m = await smsClient.findMetricByName(metricSmsName);
              }
            }
            if (!m) throw new Error(`métrica "${metricSmsName}" não apareceu após o evento de bootstrap`);
            await smsClient.createFlow(flowName, {
              triggers: [{ type: 'metric', id: m.id }],
              profile_filter: null,
              actions: [{
                temporary_id: 'sms-1',
                type: 'send-sms',
                links: { next: null },
                data: {
                  message: { body: '{{ event.message }}', name: 'SMS do CRM', smart_sending_enabled: false },
                  status: 'draft',
                },
              }],
              entry_action_id: 'sms-1',
            });
            steps.push({ step: 'flow sms', status: 'criado (em rascunho — revise e ative o Live no Klaviyo)' });
          }
        } catch (e) {
          steps.push({ step: 'flow sms', status: 'falhou', detail: (e as Error).message.slice(0, 300) });
        }
      } else {
        steps.push({ step: 'flow sms', status: 'pulado', detail: 'canal SMS não está com provider Klaviyo' });
      }

      return ok200({ ok: true, bootstrap: steps });
    }

    // ── Templates ativos da biblioteca ──────────────────────────────────────
    const { data: templates } = await supabase
      .from('email_templates')
      .select('id, name, subject, html_body')
      .eq('active', true)
      .order('name');
    const rows = (templates ?? []) as Array<{ id: string; name: string; subject: string; html_body: string }>;
    if (rows.length === 0) return ok200({ ok: true, synced: [], message: 'Nenhum template ativo na biblioteca.' });

    const assetBase = resolveAssetBase(creds, supabaseUrl);
    const results: Array<{ name: string; klaviyo_name: string; action: string; error?: string }> = [];
    for (const t of rows) {
      const klaviyoName = `CRM · ${t.name}`.slice(0, 255);
      // 1. Imagens inline (data:) sobem pro bucket e a biblioteca é atualizada
      //    com a URL pública (o base64 sai do banco de vez).
      const hosted = await hostInlineImages(supabase.storage, t.html_body, supabaseUrl);
      if (hosted.changed) {
        await supabase.from('email_templates').update({ html_body: hosted.html }).eq('id', t.id);
      }
      // 2. {{asset_base}} e caminhos relativos viram a base pública configurada
      //    (o template no Klaviyo precisa de URLs absolutas prontas).
      const html = toKlaviyoEventSyntax(resolveImageUrls(hosted.html, assetBase));
      try {
        const existing = await client.findTemplateByName(klaviyoName);
        if (existing) {
          await client.updateTemplate(existing.id, klaviyoName, html);
          results.push({ name: t.name, klaviyo_name: klaviyoName, action: 'updated' });
        } else {
          await client.createTemplate(klaviyoName, html);
          results.push({ name: t.name, klaviyo_name: klaviyoName, action: 'created' });
        }
      } catch (e) {
        if (e instanceof KlaviyoAuthError) return err200('Klaviyo rejeitou a API key', 'AUTH_ERROR');
        results.push({ name: t.name, klaviyo_name: klaviyoName, action: 'failed', error: (e as Error).message.slice(0, 200) });
      }
    }

    const failed = results.filter((r) => r.action === 'failed').length;
    const sendsLocked = !(creds.sends_locked === 'false');
    return ok200({
      ok: true,
      synced: results,
      created: results.filter((r) => r.action === 'created').length,
      updated: results.filter((r) => r.action === 'updated').length,
      failed,
      asset_base: assetBase,
      sends_locked: sendsLocked,
      hint: (sendsLocked ? '🔒 Envios pelo Klaviyo estão TRAVADOS — sincronizar templates não envia nada. ' : '') +
        'No Flow (métrica CRM Email Followup), selecione o template "CRM · <nome>" e use {{ event.subject }} no assunto. Lembre: o assunto não faz parte do template no Klaviyo.',
    });
  } catch (err) {
    return err200(`Erro interno: ${(err as Error).message}`, 'INTERNAL');
  }
});
