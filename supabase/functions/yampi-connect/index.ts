/**
 * yampi-connect (YMP-1.2)
 *
 * Admin-only Edge Function the panel invokes to manage the Yampi store connection.
 * Requires a user JWT; only super_admin or gestor/manager/admin may act.
 *
 * Actions (POST body { action, alias?, user_token?, user_secret?, event_id? }):
 *   - test        Validate alias + credentials via POST /auth/me and a store-scoped
 *                 GET /{alias}/webhooks. Persists nothing.
 *   - connect     Encrypt+persist credentials, register ONE webhook
 *                 (YAMPI_WEBHOOK_EVENTS, url=<supabaseUrl>/functions/v1/yampi-inbound?cid=<id>),
 *                 store webhook_id + secret_key (encrypted), status='connected'.
 *                 Idempotent: an existing webhook is removed before creating the new one.
 *   - status      Return connection state, webhook flag, inbound URL, last error.
 *   - disconnect  Delete the Yampi webhook, clear secrets/webhook_id, status='disconnected'.
 *   - reprocess   Reset a yampi_webhook_events row to status='received' and re-invoke
 *                 yampi-process-event (best-effort).
 *
 * Secrets are never returned or logged.
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, err200, ok200 } from '../_shared/response.ts';
import {
  createYampiClientForConnection,
  loadYampiConnection,
  YAMPI_WEBHOOK_EVENTS,
  YampiApiClient,
  YampiAuthError,
} from '../_shared/yampi-client.ts';

type Action = 'test' | 'connect' | 'status' | 'disconnect' | 'reprocess' | 'backfill_carts' | 'set_lead_intake' | 'ensure_coupons' | 'enqueue_stage';

interface RequestBody {
  action?: Action;
  alias?: string;
  user_token?: string;
  user_secret?: string;
  event_id?: string;
  days?: number;
  date_start?: string;
  date_end?: string;
  enabled?: boolean;
  stage_id?: string;
  dry_run?: boolean;
}

function inboundWebhookUrl(supabaseUrl: string, connectionId?: string): string {
  const base = `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/yampi-inbound`;
  return connectionId ? `${base}?cid=${connectionId}` : base;
}

async function encrypt(supabase: SupabaseClient, value: string, context: string): Promise<string> {
  const { data, error } = await supabase.rpc('app_encrypt_secret', {
    p_value: value,
    p_context: context,
  });
  if (error || !data) throw new Error(`encrypt failed: ${error?.message ?? 'no data'}`);
  return data as string;
}

const sanitizeAlias = (raw: string): string => raw.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  try {
    // ── Auth: verify JWT, resolve CRM user, enforce gestor/super_admin ──────
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

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const action = body.action;
    if (!action || !['test', 'connect', 'status', 'disconnect', 'reprocess', 'backfill_carts', 'set_lead_intake', 'ensure_coupons', 'enqueue_stage'].includes(action)) {
      return err200('Ação inválida', 'BAD_REQUEST');
    }

    // ── STATUS ──────────────────────────────────────────────────────────────
    if (action === 'status') {
      const row = await loadYampiConnection(supabase);
      if (!row) {
        return ok200({ ok: true, status: 'disconnected', connected: false, webhook_registered: false });
      }
      return ok200({
        ok: true,
        status: row.status,
        connected: row.status === 'connected',
        alias: row.alias,
        connection_id: row.id,
        webhook_registered: !!row.webhook_id,
        inbound_url: inboundWebhookUrl(supabaseUrl, row.id),
        last_error: row.last_error,
        lead_intake_enabled: row.lead_intake_enabled ?? true,
      });
    }

    // ── SET_LEAD_INTAKE ─────────────────────────────────────────────────────
    // Liga/desliga a entrada de novos leads: com false, reconcile não sintetiza
    // checkout_iniciado e process-event não cria contato/lead novos (leads que
    // já estão na esteira continuam se movendo normalmente).
    if (action === 'set_lead_intake') {
      if (typeof body.enabled !== 'boolean') return err200('enabled (boolean) é obrigatório', 'BAD_REQUEST');
      const row = await loadYampiConnection(supabase);
      if (!row) return err200('Nenhuma conexão Yampi configurada', 'NOT_CONNECTED');
      const { error } = await supabase.from('yampi_connections').update({
        lead_intake_enabled: body.enabled,
        updated_at: new Date().toISOString(),
      }).eq('id', row.id);
      if (error) return err200(`Falha ao salvar: ${error.message}`, 'DB_ERROR');
      return ok200({ ok: true, lead_intake_enabled: body.enabled });
    }

    // ── TEST (persists nothing) ─────────────────────────────────────────────
    if (action === 'test') {
      const alias = sanitizeAlias(body.alias ?? '');
      const token = (body.user_token ?? '').trim();
      const secret = (body.user_secret ?? '').trim();
      if (!alias || !token || !secret) return err200('Informe alias, User-Token e User-Secret-Key', 'BAD_REQUEST');

      const client = new YampiApiClient({ alias, userToken: token, userSecret: secret });
      try {
        await client.authMe();
        // Store-scoped probe: confirms the alias belongs to this credential.
        await client.listWebhooks();
        return ok200({ ok: true, valid: true, alias });
      } catch (e) {
        if (e instanceof YampiAuthError) return err200('Credenciais inválidas', 'AUTH_ERROR');
        return err200(`Falha ao validar na Yampi: ${(e as Error).message}`, 'API_ERROR');
      }
    }

    // ── CONNECT ─────────────────────────────────────────────────────────────
    if (action === 'connect') {
      const alias = sanitizeAlias(body.alias ?? '');
      const token = (body.user_token ?? '').trim();
      const secret = (body.user_secret ?? '').trim();
      if (!alias || !token || !secret) return err200('Informe alias, User-Token e User-Secret-Key', 'BAD_REQUEST');

      const client = new YampiApiClient({ alias, userToken: token, userSecret: secret });
      try {
        await client.authMe();
      } catch (e) {
        if (e instanceof YampiAuthError) return err200('Credenciais inválidas', 'AUTH_ERROR');
        return err200(`Falha ao validar na Yampi: ${(e as Error).message}`, 'API_ERROR');
      }

      const ctx = `yampi_${alias}`;
      const existing = await loadYampiConnection(supabase);

      // Persist credentials first so the connection row exists for ?cid=.
      const baseRow = {
        alias,
        user_token_enc: await encrypt(supabase, token, ctx),
        user_secret_enc: await encrypt(supabase, secret, ctx),
        status: 'error' as const, // provisional until the webhook is registered
        last_error: null,
        updated_at: new Date().toISOString(),
      };

      let connectionId: string;
      if (existing) {
        const { error } = await supabase.from('yampi_connections').update(baseRow).eq('id', existing.id);
        if (error) return err200(`Falha ao salvar conexão: ${error.message}`, 'DB_ERROR');
        connectionId = existing.id;
      } else {
        const { data, error } = await supabase.from('yampi_connections').insert(baseRow).select('id').single();
        if (error || !data) return err200(`Falha ao salvar conexão: ${error?.message}`, 'DB_ERROR');
        connectionId = (data as { id: string }).id;
      }

      // Idempotency: drop the previously registered webhook (ours) before recreating.
      if (existing?.webhook_id) {
        try {
          await client.deleteWebhook(existing.webhook_id);
        } catch (_) { /* stale id — ignore */ }
      }

      try {
        const webhook = await client.createWebhook(
          inboundWebhookUrl(supabaseUrl, connectionId),
          YAMPI_WEBHOOK_EVENTS,
          'RevOS CRM',
        );
        const update: Record<string, unknown> = {
          webhook_id: String(webhook.id),
          status: 'connected',
          last_error: null,
          updated_at: new Date().toISOString(),
        };
        if (webhook.secret_key) {
          update.webhook_secret_enc = await encrypt(supabase, webhook.secret_key, ctx);
          update.enforce_signature = true;
        } else {
          // No secret returned — cannot validate HMAC; keep events flowing but flag it.
          update.enforce_signature = false;
        }
        const { error } = await supabase.from('yampi_connections').update(update).eq('id', connectionId);
        if (error) return err200(`Webhook criado mas falhou ao salvar: ${error.message}`, 'DB_ERROR');

        return ok200({
          ok: true,
          status: 'connected',
          connection_id: connectionId,
          webhook_id: String(webhook.id),
          events: YAMPI_WEBHOOK_EVENTS,
          inbound_url: inboundWebhookUrl(supabaseUrl, connectionId),
          signature_enforced: !!webhook.secret_key,
        });
      } catch (e) {
        await supabase.from('yampi_connections').update({
          status: 'error',
          last_error: `webhook: ${(e as Error).message}`.slice(0, 500),
          updated_at: new Date().toISOString(),
        }).eq('id', connectionId);
        return err200(`Credenciais salvas, mas o registro do webhook falhou: ${(e as Error).message}`, 'WEBHOOK_ERROR');
      }
    }

    // ── DISCONNECT ──────────────────────────────────────────────────────────
    if (action === 'disconnect') {
      const bound = await createYampiClientForConnection(supabase);
      if (!bound) return ok200({ ok: true, status: 'disconnected' });

      if (bound.row.webhook_id) {
        try {
          await bound.client.deleteWebhook(bound.row.webhook_id);
        } catch (_) { /* already gone on Yampi's side — ignore */ }
      }
      const { error } = await supabase.from('yampi_connections').update({
        webhook_id: null,
        webhook_secret_enc: null,
        status: 'disconnected',
        last_error: null,
        updated_at: new Date().toISOString(),
      }).eq('id', bound.row.id);
      if (error) return err200(`Falha ao desconectar: ${error.message}`, 'DB_ERROR');
      return ok200({ ok: true, status: 'disconnected' });
    }

    // ── BACKFILL_CARTS (YMP-5): carrinhos abandonados retroativos ───────────
    // Pagina GET /checkout/carts do período e sintetiza eventos carrinho_abandonado
    // (dedup backfill:<cart_id>); yampi-process-event cria contato + lead no stage
    // "Carrinho abandonado" da esteira, e o trigger de stage dispara os follow-ups.
    if (action === 'backfill_carts') {
      const bound = await createYampiClientForConnection(supabase);
      if (!bound || bound.row.status !== 'connected') {
        return err200('Conecte a Yampi antes do backfill', 'NOT_CONNECTED');
      }
      if (bound.row.lead_intake_enabled === false) {
        // Com a entrada desligada o process-event ignoraria os eventos do backfill
        // (contato novo não é criado) — melhor falhar claro do que rodar em vão.
        return err200('A entrada de novos leads está desligada — ligue o toggle antes de rodar o backfill', 'INTAKE_DISABLED');
      }
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      const now = new Date();
      const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
      let start: string;
      let end: string;
      if (body.date_start && body.date_end && DATE_RE.test(body.date_start) && DATE_RE.test(body.date_end)) {
        // Intervalo explícito (ex.: semana retrasada) — não pega carrinhos fora dele.
        start = body.date_start;
        end = body.date_end;
        if (start > end) return err200('date_start não pode ser depois de date_end', 'BAD_REQUEST');
      } else {
        const days = Math.min(Math.max(Number(body.days ?? 7) || 7, 1), 60);
        start = fmt(new Date(now.getTime() - days * 86400_000));
        end = fmt(now);
      }
      const dateFilter = `created_at:${start}|${end}`;

      const results = { scanned: 0, synthesized: 0, skipped_existing: 0, no_identity: 0, errors: 0 };
      const MAX_PAGES = 30;
      for (let page = 1; page <= MAX_PAGES; page++) {
        let batch: Awaited<ReturnType<typeof bound.client.listRecentCarts>> = [];
        try {
          batch = await bound.client.request<{ data: typeof batch }>('GET', '/checkout/carts', {
            query: {
              date: dateFilter,
              customersData: 'true',
              page: String(page),
              limit: '50',
              include: 'items,customer',
              sort: '-created_at',
            },
          }).then((r) => (r as { data?: typeof batch }).data ?? []);
        } catch (e) {
          return err200(`Falha ao listar carrinhos: ${(e as Error).message}`, 'API_ERROR', { ...results });
        }
        if (batch.length === 0) break;

        for (const cart of batch) {
          results.scanned++;
          if (!cart.id) continue;
          const email = cart.customer?.data?.email ?? cart.tracking_data?.email;
          const phone = cart.customer?.data?.phone?.full_number;
          if (!email && !phone) { results.no_identity++; continue; }

          const { data: inserted, error: insertErr } = await supabase
            .from('yampi_webhook_events')
            .upsert({
              connection_id: bound.row.id,
              trigger: 'carrinho_abandonado',
              event_type: 'cart.backfill',
              cart_token: cart.token ?? null,
              dedup_key: `backfill:${cart.id}`,
              raw_payload: {
                event: 'cart.backfill',
                origin: 'backfill',
                time: new Date().toISOString(),
                resource: cart,
              },
              signature_valid: true,
              status: 'received',
            }, { onConflict: 'connection_id,event_type,dedup_key', ignoreDuplicates: true })
            .select('id')
            .maybeSingle() as unknown as { data: { id: string } | null; error: { message: string } | null };

          if (insertErr) { results.errors++; continue; }
          if (!inserted) { results.skipped_existing++; continue; }
          results.synthesized++;
          // O processamento (contato + lead + fups) fica com o yampi-reconcile,
          // que drena eventos 'received' em lotes — processar aqui em série
          // estoura o limite de recursos da função com períodos grandes.
        }
        if (batch.length < 50) break;
      }
      return ok200({ ok: true, period: { start, end }, ...results });
    }

    // ── ENSURE_COUPONS (EST-READY): garante os cupons da esteira na Yampi ──
    // VOLTA10 (10%) e ULTIMA15 (15%) — os e-mails E4/E5 e os SMS prometem esses
    // códigos; sem eles na loja o cliente chega no checkout e o cupom falha.
    if (action === 'ensure_coupons') {
      const bound = await createYampiClientForConnection(supabase);
      if (!bound || bound.row.status !== 'connected') return err200('Conecte a Yampi antes', 'NOT_CONNECTED');
      const wanted = [
        { code: 'VOLTA10', value: 10 },
        { code: 'ULTIMA15', value: 15 },
      ];
      const out: Array<{ code: string; status: string; detail?: string }> = [];
      for (const w of wanted) {
        try {
          const existing = await bound.client.findPromocode(w.code);
          if (existing) { out.push({ code: w.code, status: 'já existia' }); continue; }
          await bound.client.createPromocode({
            code: w.code, value: w.value, discount_type: 'p', active: true,
            once_per_customer: true, accumulate: false, abandoned_cart: true,
          });
          out.push({ code: w.code, status: 'criado' });
        } catch (e) {
          out.push({ code: w.code, status: 'falhou', detail: (e as Error).message.slice(0, 200) });
        }
        await supabase.from('crm_coupons').upsert({ code: w.code, source: 'esteira' }, { onConflict: 'code', ignoreDuplicates: true });
      }
      return ok200({ ok: true, coupons: out });
    }

    // ── ENQUEUE_STAGE (EST-READY): dispara a esteira pros leads JÁ parados ──
    // A fila só é alimentada na troca de stage — quem já estava lá (backfill)
    // precisa deste disparo. dry_run=true só conta. Guardas: nenhum canal
    // necessário pode estar inativo/travado, senão os toques nasceriam falhando.
    if (action === 'enqueue_stage') {
      const stageId = body.stage_id;
      if (!stageId) return err200('stage_id é obrigatório', 'BAD_REQUEST');
      const dryRun = body.dry_run !== false;

      if (!dryRun) {
        const { data: rules } = await supabase
          .from('leads_stages_followups').select('type').eq('leads_stages_id', stageId).eq('active', true);
        const types = new Set(((rules ?? []) as Array<{ type: string }>).map((r) => r.type));
        const { data: cfgs } = await supabase
          .from('omni_channel_configs').select('channel, is_active, credentials').in('channel', ['email', 'sms']);
        const byChannel = new Map(((cfgs ?? []) as Array<{ channel: string; is_active: boolean; credentials: Record<string, string> | null }>)
          .map((c) => [c.channel, c]));
        const problems: string[] = [];
        for (const ch of ['email', 'sms'] as const) {
          if (!types.has(ch)) continue;
          const cfg = byChannel.get(ch);
          const creds = cfg?.credentials ?? {};
          if (!cfg?.is_active || !creds.provider || creds.provider === 'webhook') problems.push(`canal ${ch} inativo ou sem provider`);
          else if (creds.provider === 'klaviyo' && creds.sends_locked !== 'false') problems.push(`envios de ${ch} pelo Klaviyo travados`);
        }
        if (types.has('whatsapp_template')) {
          const { count } = await supabase.from('settings_whatsapp_channels').select('id', { count: 'exact', head: true }).eq('active', true);
          if ((count ?? 0) === 0) problems.push('regras de WhatsApp ativas sem canal WhatsApp ativo');
        }
        if (problems.length > 0) {
          return err200(`Não disparei: ${problems.join(' · ')}. Resolva e tente de novo (ou rode a simulação).`, 'NOT_READY');
        }
      }

      const { data, error } = await supabase.rpc('enqueue_stage_followups', { p_stage_id: stageId, p_dry_run: dryRun });
      if (error) return err200(`Falha ao enfileirar: ${error.message}`, 'DB_ERROR');
      return ok200({ ok: true, ...(data as Record<string, unknown>) });
    }

    // ── REPROCESS ───────────────────────────────────────────────────────────
    if (action === 'reprocess') {
      const eventId = body.event_id;
      if (!eventId) return err200('event_id é obrigatório', 'BAD_REQUEST');
      const { error } = await supabase.from('yampi_webhook_events').update({
        status: 'received',
        error: null,
        processed_at: null,
      }).eq('id', eventId);
      if (error) return err200(`Falha ao resetar evento: ${error.message}`, 'DB_ERROR');

      // Best-effort re-invoke.
      fetch(`${supabaseUrl}/functions/v1/yampi-process-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
        body: JSON.stringify({ event_id: eventId }),
      }).catch(() => { /* worker will pick it up on next reprocess */ });

      return ok200({ ok: true });
    }

    return err200('Ação inválida', 'BAD_REQUEST');
  } catch (err) {
    return err200(`Erro interno: ${(err as Error).message}`, 'INTERNAL');
  }
});
