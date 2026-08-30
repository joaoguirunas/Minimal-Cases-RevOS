/**
 * kiwify-connect (KFY-1.3)
 *
 * Admin-only Edge Function the panel invokes to manage a Kiwify account connection.
 * Requires a user JWT; only super_admin or manager (gestor) may act.
 *
 * Actions (POST body { action, account_id?, client_id?, client_secret? }):
 *   - test        Validate client_secret + account_id via OAuth; report granted scope
 *                 and warn if sales/products/webhooks are missing. Persists nothing.
 *   - connect     Encrypt+persist secrets, register ONE webhook (10 triggers,
 *                 products:"all", url=<supabaseUrl>/functions/v1/kiwify-inbound),
 *                 store webhook_id, status='connected'. Idempotent: an existing
 *                 webhook is removed before creating the new one.
 *   - status      Return connection state (connected/disconnected/error), webhook flag,
 *                 last error.
 *   - disconnect  Delete the Kiwify webhook, clear tokens/webhook_id, status='disconnected'.
 *   - list_products  List the account's Kiwify products ({id,name}) for the mapping UI
 *                    (KFY-1.7). Requires an existing connection; paginates the shared client.
 *   - reprocess   Reset a `kiwify_webhook_events` row to status='received' so it is picked up
 *                 again, and best-effort re-invoke kiwify-process-event (KFY-1.7 event log).
 *   - save_credentials  (manual flow, KFY-4.1) Encrypt+persist account_id + client_secret
 *                 WITHOUT creating a webhook; validate OAuth, status='pending_webhook', return
 *                 the inbound URL (with ?cid=<id>) for the manager to paste on Kiwify.
 *   - register_manual_webhook_token  (manual flow, KFY-4.1) Store the token Kiwify generated
 *                 for a hand-made webhook (encrypted) and mark status='connected'.
 *
 * Consumes the shared KiwifyApiClient (KFY-1.2). Secrets are never returned or logged.
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, err200, ok200 } from '../_shared/response.ts';
import {
  createKiwifyClientForConnection,
  KIWIFY_TRIGGERS,
  KiwifyApiClient,
  KiwifyAuthError,
  type KiwifyConnectionRow,
  type KiwifyTokenStore,
} from '../_shared/kiwify-client.ts';

const REQUIRED_SCOPES = ['sales', 'products', 'webhooks'] as const;

type Action =
  | 'test' | 'connect' | 'status' | 'disconnect' | 'list_products' | 'reprocess'
  | 'save_credentials' | 'register_manual_webhook_token';

interface RequestBody {
  action?: Action;
  account_id?: string;
  client_id?: string;
  client_secret?: string;
  event_id?: string;
  connection_id?: string;
  webhook_token?: string;
}

function inboundWebhookUrl(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/kiwify-inbound`;
}

/** 64-char hex shared secret used to sign inbound webhook deliveries. */
function generateWebhookToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Non-persisting token store, for `test` (validates credentials without saving). */
const ephemeralStore: KiwifyTokenStore = {
  load: () => Promise.resolve({ accessToken: null, expiresAt: null, scope: null }),
  save: () => Promise.resolve(),
};

function missingScopes(granted: string | null): string[] {
  const set = new Set((granted ?? '').split(/[\s,]+/).filter(Boolean));
  return REQUIRED_SCOPES.filter((s) => !set.has(s));
}

async function loadConnectionRow(
  supabase: SupabaseClient,
  accountId?: string,
): Promise<KiwifyConnectionRow | null> {
  let query = supabase
    .from('kiwify_connections')
    .select('id, account_id, client_id, client_secret_enc, access_token_enc, token_expires_at, webhook_id, status, last_error');
  query = accountId
    ? query.eq('account_id', accountId)
    : query.order('created_at', { ascending: false }).limit(1);
  const { data } = await query.maybeSingle();
  return (data as KiwifyConnectionRow & { webhook_id: string | null; status: string; last_error: string | null }) ?? null;
}

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
    if (!authHeader?.startsWith('Bearer ')) {
      return err200('Unauthorized', 'UNAUTHORIZED');
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return err200('Invalid token', 'UNAUTHORIZED');
    }

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
    if (!crmUser || !isManager) {
      return err200('Acesso restrito a gestores', 'FORBIDDEN');
    }

    // ── Parse body ──────────────────────────────────────────────────────────
    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const action = body.action;
    const VALID_ACTIONS = [
      'test', 'connect', 'status', 'disconnect', 'list_products', 'reprocess',
      'save_credentials', 'register_manual_webhook_token',
    ];
    if (!action || !VALID_ACTIONS.includes(action)) {
      return err200('Ação inválida', 'BAD_REQUEST');
    }

    // ── STATUS ──────────────────────────────────────────────────────────────
    if (action === 'status') {
      const row = await loadConnectionRow(supabase, body.account_id);
      if (!row) {
        return ok200({ ok: true, status: 'disconnected', connected: false, webhook_registered: false });
      }
      const r = row as KiwifyConnectionRow & { webhook_id: string | null; status: string; last_error: string | null };
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      return ok200({
        ok: true,
        status: r.status,
        connected: r.status === 'connected',
        account_id: r.account_id,
        client_id: r.client_id,
        connection_id: r.id,
        inbound_url: `${supabaseUrl}/functions/v1/kiwify-inbound?cid=${r.id}`,
        webhook_registered: !!r.webhook_id,
        last_error: r.last_error ?? null,
      });
    }

    // ── TEST ────────────────────────────────────────────────────────────────
    if (action === 'test') {
      if (!body.account_id || !body.client_id || !body.client_secret) {
        return err200('account_id, client_id e client_secret são obrigatórios', 'BAD_REQUEST');
      }
      const client = new KiwifyApiClient({
        accountId: body.account_id,
        clientId: body.client_id, // Kiwify OAuth client_id is a distinct UUID (KFY-4.1)
        clientSecret: body.client_secret,
        store: ephemeralStore,
        baseUrl: Deno.env.get('KIWIFY_BASE_URL'),
      });
      try {
        await client.getToken();
      } catch (e) {
        if (e instanceof KiwifyAuthError) {
          return err200('Credenciais inválidas', 'AUTH_ERROR');
        }
        throw e;
      }
      const scope = client.grantedScope;
      const missing = missingScopes(scope);
      return ok200({
        ok: true,
        valid: true,
        scope,
        missing_scopes: missing,
        scopes_ok: missing.length === 0,
      });
    }

    // ── CONNECT ─────────────────────────────────────────────────────────────
    if (action === 'connect') {
      if (!body.account_id || !body.client_id || !body.client_secret) {
        return err200('account_id, client_id e client_secret são obrigatórios', 'BAD_REQUEST');
      }
      const accountId = body.account_id;
      const clientId = body.client_id;
      const context = `kiwify_${accountId}`;

      // Encrypt the client_secret and upsert the connection row first, so the
      // client's token store has a persistent row id to write the OAuth cache to.
      const { data: secretEnc, error: encErr } = await supabase.rpc('app_encrypt_secret', {
        p_value: body.client_secret,
        p_context: context,
      });
      if (encErr || !secretEnc) {
        return err200('Falha ao proteger credenciais', 'ENCRYPT_ERROR');
      }

      const { data: upserted, error: upsertErr } = await supabase
        .from('kiwify_connections')
        .upsert(
          { account_id: accountId, client_id: clientId, client_secret_enc: secretEnc, status: 'disconnected', last_error: null },
          { onConflict: 'account_id' },
        )
        .select('id, account_id, client_id, client_secret_enc, access_token_enc, token_expires_at, webhook_id')
        .single();
      if (upsertErr || !upserted) {
        return err200('Falha ao salvar conexão', 'DB_ERROR');
      }

      const row = upserted as KiwifyConnectionRow & { webhook_id: string | null };
      const client = await createKiwifyClientForConnection(supabase, row, {
        baseUrl: Deno.env.get('KIWIFY_BASE_URL'),
      });

      // Validate credentials + capture scope before mutating anything remote.
      try {
        await client.getToken();
      } catch (e) {
        const msg = e instanceof KiwifyAuthError ? 'Credenciais inválidas' : 'Falha ao autenticar na Kiwify';
        await supabase.from('kiwify_connections')
          .update({ status: 'error', last_error: msg }).eq('id', row.id);
        return err200(msg, e instanceof KiwifyAuthError ? 'AUTH_ERROR' : 'KIWIFY_ERROR');
      }

      const scope = client.grantedScope;
      const missing = missingScopes(scope);

      // Idempotency: remove any previously registered webhook before creating a new one.
      if (row.webhook_id) {
        try {
          await client.deleteWebhook(row.webhook_id);
        } catch (_e) {
          // Best-effort: the old webhook may already be gone. Proceed to recreate.
        }
      }

      const webhookToken = generateWebhookToken();
      let webhookId: string;
      try {
        const wh = await client.createWebhook({
          name: 'CRM Growthsales',
          url: inboundWebhookUrl(supabaseUrl),
          products: 'all',
          triggers: [...KIWIFY_TRIGGERS],
          token: webhookToken,
        });
        webhookId = wh.id;
      } catch (e) {
        const isAuth = e instanceof KiwifyAuthError;
        const msg = isAuth ? 'Credenciais inválidas' : 'Falha ao registrar webhook na Kiwify';
        await supabase.from('kiwify_connections')
          .update({ status: 'error', last_error: msg }).eq('id', row.id);
        return err200(msg, isAuth ? 'AUTH_ERROR' : 'WEBHOOK_ERROR');
      }

      const { data: tokenEnc } = await supabase.rpc('app_encrypt_secret', {
        p_value: webhookToken,
        p_context: context,
      });

      await supabase
        .from('kiwify_connections')
        .update({
          webhook_id: webhookId,
          webhook_token_enc: tokenEnc,
          status: 'connected',
          last_error: null,
        })
        .eq('id', row.id);

      return ok200({
        ok: true,
        status: 'connected',
        account_id: accountId,
        webhook_id: webhookId,
        webhook_registered: true,
        scope,
        missing_scopes: missing,
        scopes_ok: missing.length === 0,
      });
    }

    // ── SAVE_CREDENTIALS (manual webhook flow, step 1) ────────────────────────
    // Persist account_id + client_secret WITHOUT auto-creating a webhook, so the
    // manager can create it by hand on Kiwify and paste back the token (step 2).
    if (action === 'save_credentials') {
      if (!body.account_id || !body.client_id || !body.client_secret) {
        return err200('account_id, client_id e client_secret são obrigatórios', 'BAD_REQUEST');
      }
      const accountId = body.account_id;
      const clientId = body.client_id;
      const context = `kiwify_${accountId}`;

      const { data: secretEnc, error: encErr } = await supabase.rpc('app_encrypt_secret', {
        p_value: body.client_secret,
        p_context: context,
      });
      if (encErr || !secretEnc) {
        return err200('Falha ao proteger credenciais', 'ENCRYPT_ERROR');
      }

      const { data: upserted, error: upsertErr } = await supabase
        .from('kiwify_connections')
        .upsert(
          { account_id: accountId, client_id: clientId, client_secret_enc: secretEnc, status: 'pending_webhook', last_error: null },
          { onConflict: 'account_id' },
        )
        .select('id, account_id, client_id, client_secret_enc, access_token_enc, token_expires_at, webhook_id')
        .single();
      if (upsertErr || !upserted) {
        return err200('Falha ao salvar conexão', 'DB_ERROR');
      }

      const row = upserted as KiwifyConnectionRow & { webhook_id: string | null };

      // Validate the credentials (OAuth token) without requiring the `webhooks`
      // scope — the manual flow exists precisely to skip our own webhook creation.
      const client = await createKiwifyClientForConnection(supabase, row, {
        baseUrl: Deno.env.get('KIWIFY_BASE_URL'),
      });
      try {
        await client.getToken();
      } catch (e) {
        const isAuth = e instanceof KiwifyAuthError;
        const msg = isAuth ? 'Credenciais inválidas' : 'Falha ao autenticar na Kiwify';
        await supabase.from('kiwify_connections')
          .update({ status: 'error', last_error: msg }).eq('id', row.id);
        return err200(msg, isAuth ? 'AUTH_ERROR' : 'KIWIFY_ERROR');
      }

      const inboundUrl = `${inboundWebhookUrl(supabaseUrl)}?cid=${row.id}`;
      return ok200({
        ok: true,
        id: row.id,
        account_id: accountId,
        status: 'pending_webhook',
        inbound_url: inboundUrl,
      });
    }

    // ── REGISTER_MANUAL_WEBHOOK_TOKEN (manual webhook flow, step 2) ────────────
    // The manager created the webhook by hand on Kiwify and pasted back the token
    // Kiwify generated; encrypt+store it and mark the connection connected.
    if (action === 'register_manual_webhook_token') {
      if (!body.webhook_token?.trim()) {
        return err200('webhook_token é obrigatório', 'BAD_REQUEST');
      }
      if (!body.connection_id && !body.account_id) {
        return err200('connection_id ou account_id é obrigatório', 'BAD_REQUEST');
      }

      let query = supabase
        .from('kiwify_connections')
        .select('id, account_id');
      query = body.connection_id
        ? query.eq('id', body.connection_id)
        : query.eq('account_id', body.account_id!);
      const { data: conn } = await query.maybeSingle();
      if (!conn) {
        return err200('Conexão não encontrada — salve as credenciais primeiro', 'NOT_FOUND');
      }
      const c = conn as { id: string; account_id: string };

      const { data: tokenEnc, error: encErr } = await supabase.rpc('app_encrypt_secret', {
        p_value: body.webhook_token.trim(),
        p_context: `kiwify_${c.account_id}`,
      });
      if (encErr || !tokenEnc) {
        return err200('Falha ao proteger o token', 'ENCRYPT_ERROR');
      }

      const { error: updErr } = await supabase
        .from('kiwify_connections')
        .update({ webhook_token_enc: tokenEnc, status: 'connected', last_error: null })
        .eq('id', c.id);
      if (updErr) {
        return err200('Falha ao registrar o token', 'DB_ERROR');
      }

      return ok200({ ok: true, status: 'connected', account_id: c.account_id });
    }

    // ── DISCONNECT ──────────────────────────────────────────────────────────
    if (action === 'disconnect') {
      const row = await loadConnectionRow(supabase, body.account_id);
      if (!row) {
        return ok200({ ok: true, status: 'disconnected', connected: false });
      }
      const r = row as KiwifyConnectionRow & { webhook_id: string | null };

      if (r.webhook_id) {
        try {
          const client = await createKiwifyClientForConnection(supabase, r, {
            baseUrl: Deno.env.get('KIWIFY_BASE_URL'),
          });
          await client.deleteWebhook(r.webhook_id);
        } catch (_e) {
          // Best-effort remote cleanup: still clear local state so the account
          // can be reconnected cleanly.
        }
      }

      await supabase
        .from('kiwify_connections')
        .update({
          status: 'disconnected',
          access_token_enc: null,
          token_expires_at: null,
          webhook_id: null,
          webhook_token_enc: null,
          last_error: null,
        })
        .eq('id', r.id);

      return ok200({ ok: true, status: 'disconnected', connected: false });
    }

    // ── LIST_PRODUCTS ─────────────────────────────────────────────────────────
    if (action === 'list_products') {
      const row = await loadConnectionRow(supabase, body.account_id);
      if (!row) {
        return err200('Conecte uma conta Kiwify primeiro', 'NOT_CONNECTED');
      }
      const client = await createKiwifyClientForConnection(supabase, row, {
        baseUrl: Deno.env.get('KIWIFY_BASE_URL'),
      });

      const products: { id: string; name: string }[] = [];
      const pageSize = 100;
      const maxPages = 10; // safety cap (1000 products)
      try {
        for (let page = 1; page <= maxPages; page++) {
          const res = await client.listProducts({ page_size: pageSize, page_number: page });
          for (const p of res.data ?? []) products.push({ id: p.id, name: p.name });
          if (!res.data || res.data.length < pageSize) break;
        }
      } catch (e) {
        const isAuth = e instanceof KiwifyAuthError;
        return err200(
          isAuth ? 'Credenciais inválidas' : 'Falha ao listar produtos na Kiwify',
          isAuth ? 'AUTH_ERROR' : 'KIWIFY_ERROR',
        );
      }

      return ok200({ ok: true, products });
    }

    // ── REPROCESS ─────────────────────────────────────────────────────────────
    if (action === 'reprocess') {
      if (!body.event_id) {
        return err200('event_id é obrigatório', 'BAD_REQUEST');
      }
      const { data: event } = await supabase
        .from('kiwify_webhook_events')
        .select('id')
        .eq('id', body.event_id)
        .maybeSingle();
      if (!event) {
        return err200('Evento não encontrado', 'NOT_FOUND');
      }

      await supabase
        .from('kiwify_webhook_events')
        .update({ status: 'received', processed_at: null, error: null })
        .eq('id', body.event_id);

      // Best-effort: re-invoke the processor. If it is not yet deployed the reset
      // still stands, so a later processing pass picks the event up.
      try {
        await supabase.functions.invoke('kiwify-process-event', {
          body: { event_id: body.event_id },
        });
      } catch (_e) {
        // Swallow: processor may not be deployed yet (reserved). Event stays 'received'.
      }

      return ok200({ ok: true, status: 'received', event_id: body.event_id });
    }

    return err200('Ação inválida', 'BAD_REQUEST');
  } catch (e) {
    // Never leak internals to the client; log a sanitized line server-side.
    console.error(JSON.stringify({ fn: 'kiwify-connect', msg: 'unhandled', error: (e as Error).message }));
    return err200('Erro interno', 'INTERNAL_ERROR');
  }
});
