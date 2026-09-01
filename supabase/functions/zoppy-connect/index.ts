/**
 * zoppy-connect (ZPY-1.2)
 *
 * Admin-only Edge Function que gerencia a conexão Zoppy e dispara imports.
 * Requer JWT de usuário; apenas super_admin/gestor/manager/admin.
 *
 * Actions (POST body { action, api_token?, zoppy_access?, resource? }):
 *   - test         Valida Bearer + zoppy-access com GET /customers (pageSize=1). Não persiste.
 *   - connect      Criptografa+persiste credenciais, status='connected'.
 *   - status       Estado da conexão + progresso de sync por recurso.
 *   - disconnect   Limpa credenciais, status='disconnected'.
 *   - start_sync   Marca zoppy_sync_state[resource]='running' (reset de cursor) e
 *                  invoca zoppy-sync (que se re-invoca até terminar).
 *
 * Secrets nunca são retornados ou logados.
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, err200, ok200 } from '../_shared/response.ts';
import {
  createZoppyClientForConnection,
  loadZoppyConnection,
  ZOPPY_ENC_CONTEXT,
  ZOPPY_RESOURCES,
  ZoppyApiClient,
  ZoppyAuthError,
  type ZoppyResource,
} from '../_shared/zoppy-client.ts';

type Action = 'test' | 'connect' | 'status' | 'disconnect' | 'start_sync';

interface RequestBody {
  action?: Action;
  api_token?: string;
  zoppy_access?: string;
  resource?: string;
}

async function encrypt(supabase: SupabaseClient, value: string): Promise<string> {
  const { data, error } = await supabase.rpc('app_encrypt_secret', {
    p_value: value,
    p_context: ZOPPY_ENC_CONTEXT,
  });
  if (error || !data) throw new Error(`encrypt failed: ${error?.message ?? 'no data'}`);
  return data as string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  try {
    // ── Auth: JWT + gate gestor/super_admin (mesmo padrão kiwify/yampi-connect) ──
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
    if (!action || !['test', 'connect', 'status', 'disconnect', 'start_sync'].includes(action)) {
      return err200('Ação inválida', 'BAD_REQUEST');
    }

    // ── STATUS ──────────────────────────────────────────────────────────────
    if (action === 'status') {
      const row = await loadZoppyConnection(supabase);
      const { data: syncRows } = await supabase
        .from('zoppy_sync_state')
        .select('resource, status, next_page, total_synced, contacts_created, contacts_matched, last_error, started_at, finished_at, updated_at');
      return ok200({
        ok: true,
        status: row?.status ?? 'disconnected',
        connected: row?.status === 'connected',
        connection_id: row?.id,
        last_error: row?.last_error ?? null,
        sync: syncRows ?? [],
      });
    }

    // ── TEST ────────────────────────────────────────────────────────────────
    if (action === 'test') {
      const token = (body.api_token ?? '').trim();
      const access = (body.zoppy_access ?? '').trim();
      if (!token || !access) return err200('Informe o token (Chave de API) e a chave zoppy-access', 'BAD_REQUEST');
      const client = new ZoppyApiClient({ apiToken: token, zoppyAccess: access });
      try {
        await client.testAuth();
        return ok200({ ok: true, valid: true });
      } catch (e) {
        if (e instanceof ZoppyAuthError) return err200('Credenciais inválidas', 'AUTH_ERROR');
        return err200(`Falha ao validar na Zoppy: ${(e as Error).message}`, 'API_ERROR');
      }
    }

    // ── CONNECT ─────────────────────────────────────────────────────────────
    if (action === 'connect') {
      const token = (body.api_token ?? '').trim();
      const access = (body.zoppy_access ?? '').trim();
      if (!token || !access) return err200('Informe o token (Chave de API) e a chave zoppy-access', 'BAD_REQUEST');

      const client = new ZoppyApiClient({ apiToken: token, zoppyAccess: access });
      try {
        await client.testAuth();
      } catch (e) {
        if (e instanceof ZoppyAuthError) return err200('Credenciais inválidas', 'AUTH_ERROR');
        return err200(`Falha ao validar na Zoppy: ${(e as Error).message}`, 'API_ERROR');
      }

      const existing = await loadZoppyConnection(supabase);
      const rowData = {
        api_token_enc: await encrypt(supabase, token),
        zoppy_access_enc: await encrypt(supabase, access),
        status: 'connected',
        last_error: null,
        updated_at: new Date().toISOString(),
      };
      const res = existing
        ? await supabase.from('zoppy_connections').update(rowData).eq('id', existing.id).select('id').single()
        : await supabase.from('zoppy_connections').insert(rowData).select('id').single();
      if (res.error) return err200(`Falha ao salvar conexão: ${res.error.message}`, 'DB_ERROR');

      return ok200({ ok: true, status: 'connected', connection_id: (res.data as { id: string }).id });
    }

    // ── DISCONNECT ──────────────────────────────────────────────────────────
    if (action === 'disconnect') {
      const existing = await loadZoppyConnection(supabase);
      if (existing) {
        const { error } = await supabase.from('zoppy_connections').update({
          status: 'disconnected',
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id);
        if (error) return err200(`Falha ao desconectar: ${error.message}`, 'DB_ERROR');
      }
      return ok200({ ok: true, status: 'disconnected' });
    }

    // ── START_SYNC ──────────────────────────────────────────────────────────
    if (action === 'start_sync') {
      const resource = (body.resource ?? '') as ZoppyResource;
      if (!ZOPPY_RESOURCES.includes(resource)) {
        return err200('resource deve ser customers, orders ou abandoned-carts', 'BAD_REQUEST');
      }
      const bound = await createZoppyClientForConnection(supabase);
      if (!bound || bound.row.status !== 'connected') {
        return err200('Conecte a Zoppy antes de importar', 'NOT_CONNECTED');
      }

      // Import de clientes primeiro: pedidos/carrinhos vinculam via zoppy_customers.
      if (resource !== 'customers') {
        const { count } = await supabase
          .from('zoppy_customers')
          .select('id', { count: 'exact', head: true });
        if (!count || count === 0) {
          return err200('Importe os clientes primeiro — pedidos e carrinhos vinculam contatos pela base de clientes.', 'CUSTOMERS_FIRST');
        }
      }

      const { data: state } = await supabase
        .from('zoppy_sync_state').select('status').eq('resource', resource).maybeSingle();
      const prevStatus = (state as { status?: string } | null)?.status;
      if (prevStatus === 'running') {
        return ok200({ ok: true, already_running: true });
      }

      // Erro → retoma do cursor onde parou; idle/done → recomeça do zero.
      const upsertRow: Record<string, unknown> = prevStatus === 'error'
        ? { resource, status: 'running', last_error: null, finished_at: null }
        : {
          resource,
          status: 'running',
          next_page: 1,
          total_synced: 0,
          contacts_created: 0,
          contacts_matched: 0,
          last_error: null,
          started_at: new Date().toISOString(),
          finished_at: null,
        };
      const { error } = await supabase.from('zoppy_sync_state').upsert(upsertRow, { onConflict: 'resource' });
      if (error) return err200(`Falha ao iniciar sync: ${error.message}`, 'DB_ERROR');

      // Dispara o worker (que se re-invoca até terminar). Best-effort.
      fetch(`${supabaseUrl}/functions/v1/zoppy-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
        body: JSON.stringify({ resource }),
      }).catch(() => { /* o botão de retomar na UI reinicia */ });

      return ok200({ ok: true, started: true, resource });
    }

    return err200('Ação inválida', 'BAD_REQUEST');
  } catch (err) {
    return err200(`Erro interno: ${(err as Error).message}`, 'INTERNAL');
  }
});
