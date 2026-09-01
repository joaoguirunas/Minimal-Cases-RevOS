/**
 * zoppy-sync (ZPY-1.3) — worker de import paginado. GOD NODE (escreve clients_people).
 *
 * Invocado (service_role bearer, verify_jwt=false) por zoppy-connect(start_sync) e por
 * si mesmo. Body: { resource: 'customers' | 'orders' | 'abandoned-carts' }.
 *
 * Cada invocação processa até MAX_PAGES_PER_RUN páginas (pageSize 100) a partir de
 * zoppy_sync_state.next_page e:
 *   customers        → upsert em zoppy_customers + resolve/cria contato em clients_people
 *                      (email→telefone, normalização BR, cadeia de auto-merge — mesmo
 *                      padrão do kiwify/yampi-process-event) + backfill de identidade.
 *   orders           → upsert em zoppy_orders, people_id via zoppy_customers (ou resolve
 *                      pelo customer embutido).
 *   abandoned-carts  → upsert em zoppy_abandoned_carts, idem.
 *
 * Ao fim do lote: atualiza o cursor; se a última página veio cheia, re-invoca a si
 * mesmo via EdgeRuntime.waitUntil; senão marca status='done'. Erro → status='error'
 * com last_error (a UI mostra e permite retomar).
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';
import {
  createZoppyClientForConnection,
  ZOPPY_RESOURCES,
  type ZoppyAbandonedCart,
  type ZoppyCustomer,
  type ZoppyOrder,
  type ZoppyResource,
} from '../_shared/zoppy-client.ts';

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAGE_SIZE = 100;
const MAX_PAGES_PER_RUN = 15;

/** 12 dígitos BR (55+DDD+8) → 13 (nono dígito). Espelha whatsapp-inbound. */
function normalizeBRPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12) return digits.substring(0, 4) + '9' + digits.substring(4);
  return digits;
}

function fullName(c: ZoppyCustomer): string | null {
  const n = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  return n || null;
}

/** Resolve contato por email→telefone ou cria (cadeia de auto-merge). */
async function resolvePerson(
  supabase: SupabaseClient,
  opts: { email: string | null; phone: string | null; name: string | null },
): Promise<{ id: string; created: boolean } | null> {
  const sel = 'id, merged_into_id, status';
  const canonical = (r: { id: string; merged_into_id: string | null; status: string }): string =>
    r.status === 'merged' && r.merged_into_id ? r.merged_into_id : r.id;

  if (opts.email) {
    const { data } = await supabase
      .from('clients_people').select(sel).eq('email', opts.email)
      .order('created_at', { ascending: true });
    const rows = (data ?? []) as Array<{ id: string; merged_into_id: string | null; status: string }>;
    const hit = rows.find((r) => r.status !== 'merged') ?? rows[0];
    if (hit) return { id: canonical(hit), created: false };
  }
  const phone = opts.phone ? normalizeBRPhone(opts.phone) : null;
  if (phone) {
    for (const col of ['whatsapp', 'telefone']) {
      const { data } = await supabase
        .from('clients_people').select(sel).eq(col, phone)
        .order('created_at', { ascending: true });
      const rows = (data ?? []) as Array<{ id: string; merged_into_id: string | null; status: string }>;
      const hit = rows.find((r) => r.status !== 'merged') ?? rows[0];
      if (hit) return { id: canonical(hit), created: false };
    }
  }
  if (!opts.email && !phone) return null;

  const insert: Record<string, unknown> = {
    name: opts.name ?? opts.email ?? phone ?? 'Contato Zoppy',
    status: 'active',
  };
  if (opts.email) insert.email = opts.email;
  if (phone) insert.whatsapp = phone;
  const { data: created, error } = await supabase
    .from('clients_people').insert(insert).select('id').single();
  if (error || !created) return null;
  const { data: reread } = await supabase
    .from('clients_people').select(sel).eq('id', (created as { id: string }).id).maybeSingle();
  const id = reread ? canonical(reread as { id: string; merged_into_id: string | null; status: string }) : (created as { id: string }).id;
  // Se o trigger auto-merge fundiu no canônico, não contamos como criado.
  return { id, created: id === (created as { id: string }).id };
}

/** people_id de um customer Zoppy: staging primeiro, senão resolve pelo embutido. */
async function peopleIdForZoppyCustomer(
  supabase: SupabaseClient,
  customerId: string | null,
  embedded: ZoppyCustomer | null | undefined,
): Promise<string | null> {
  if (customerId) {
    const { data } = await supabase
      .from('zoppy_customers').select('people_id').eq('zoppy_id', customerId).maybeSingle();
    const pid = (data as { people_id: string | null } | null)?.people_id;
    if (pid) return pid;
  }
  if (embedded) {
    const resolved = await resolvePerson(supabase, {
      email: embedded.email?.toLowerCase().trim() || null,
      phone: embedded.phone ?? null,
      name: fullName(embedded),
    });
    return resolved?.id ?? null;
  }
  return null;
}

const dateOrNull = (v: unknown): string | null => {
  if (typeof v !== 'string' || !v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const log = createLogger('zoppy-sync');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.includes(serviceRoleKey)) return new Response('Forbidden', { status: 403 });

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const { resource } = (await req.json().catch(() => ({}))) as { resource?: ZoppyResource };
  if (!resource || !ZOPPY_RESOURCES.includes(resource)) {
    return json({ ok: false, error: 'resource inválido' });
  }

  const { data: stateRaw } = await supabase
    .from('zoppy_sync_state').select('*').eq('resource', resource).maybeSingle();
  const state = stateRaw as {
    status: string; next_page: number; after_date: string;
    total_synced: number; contacts_created: number; contacts_matched: number;
  } | null;
  if (!state || state.status !== 'running') {
    return json({ ok: true, skipped: true, reason: `status=${state?.status ?? 'missing'}` });
  }

  const bound = await createZoppyClientForConnection(supabase);
  if (!bound) {
    await supabase.from('zoppy_sync_state').update({
      status: 'error', last_error: 'conexão Zoppy indisponível',
    }).eq('resource', resource);
    return json({ ok: false, error: 'no connection' });
  }

  let page = state.next_page;
  let total = state.total_synced;
  let created = state.contacts_created;
  let matched = state.contacts_matched;
  let finished = false;

  try {
    for (let i = 0; i < MAX_PAGES_PER_RUN; i++) {
      let batchLen = 0;

      if (resource === 'customers') {
        const batch = await bound.client.list<ZoppyCustomer>('customers', { page, pageSize: PAGE_SIZE, after: state.after_date });
        batchLen = batch.length;
        for (const c of batch) {
          if (!c?.id) continue;
          const email = c.email?.toLowerCase().trim() || null;
          const person = await resolvePerson(supabase, {
            email,
            phone: c.phone ?? null,
            name: fullName(c),
          });
          if (person) {
            person.created ? created++ : matched++;
            // Backfill não-destrutivo de identidade no contato.
            const { data: p } = await supabase
              .from('clients_people').select('name, email, whatsapp').eq('id', person.id).maybeSingle();
            if (p) {
              const cur = p as { name: string | null; email: string | null; whatsapp: string | null };
              const patch: Record<string, unknown> = {};
              if (!cur.email && email) patch.email = email;
              if (!cur.whatsapp && c.phone) patch.whatsapp = normalizeBRPhone(c.phone);
              if ((!cur.name || cur.name === 'Contato Zoppy') && fullName(c)) patch.name = fullName(c);
              if (Object.keys(patch).length > 0) {
                await supabase.from('clients_people').update(patch).eq('id', person.id);
              }
            }
          }
          await supabase.from('zoppy_customers').upsert({
            zoppy_id: c.id,
            external_id: c.externalId ?? null,
            email,
            phone: c.phone ?? null,
            first_name: c.firstName ?? null,
            last_name: c.lastName ?? null,
            birth_date: (c.birthDate ?? '').toString().slice(0, 10) || null,
            gender: c.gender ?? null,
            rfm_position: c.position ?? null,
            address: c.address ?? null,
            custom_fields: c.customFields ?? null,
            coupon: c.coupon ?? null,
            people_id: person?.id ?? null,
            raw: c,
            zoppy_created_at: dateOrNull(c.createdAt),
            zoppy_updated_at: dateOrNull(c.updatedAt),
            synced_at: new Date().toISOString(),
          }, { onConflict: 'zoppy_id' });
          total++;
        }
      } else if (resource === 'orders') {
        const batch = await bound.client.list<ZoppyOrder>('orders', { page, pageSize: PAGE_SIZE, after: state.after_date });
        batchLen = batch.length;
        for (const o of batch) {
          if (!o?.id) continue;
          const peopleId = await peopleIdForZoppyCustomer(supabase, o.customerId ?? null, o.customer);
          await supabase.from('zoppy_orders').upsert({
            zoppy_id: o.id,
            external_id: o.externalId ?? null,
            customer_zoppy_id: o.customerId ?? null,
            people_id: peopleId,
            status: o.status ?? null,
            subtotal: o.subtotal ?? null,
            total: o.total ?? null,
            discount: o.discount ?? null,
            shipping: o.shipping ?? null,
            coupon_code: o.couponCode ?? null,
            provider: o.provider ?? null,
            line_items: o.lineItems ?? null,
            raw: o,
            completed_at: dateOrNull(o.completedAt),
            zoppy_created_at: dateOrNull(o.createdAt),
            zoppy_updated_at: dateOrNull(o.updatedAt),
            synced_at: new Date().toISOString(),
          }, { onConflict: 'zoppy_id' });
          total++;
        }
      } else {
        const batch = await bound.client.list<ZoppyAbandonedCart>('abandoned-carts', { page, pageSize: PAGE_SIZE, after: state.after_date });
        batchLen = batch.length;
        for (const cart of batch) {
          if (!cart?.id) continue;
          const peopleId = await peopleIdForZoppyCustomer(supabase, cart.customerId ?? null, cart.customer);
          await supabase.from('zoppy_abandoned_carts').upsert({
            zoppy_id: cart.id,
            external_id: cart.externalId ?? null,
            customer_zoppy_id: cart.customerId ?? null,
            people_id: peopleId,
            url: cart.url ?? null,
            subtotal: cart.subtotal ?? null,
            total: cart.total ?? null,
            discount: cart.discount ?? null,
            shipping: cart.shipping ?? null,
            line_items: cart.lineItems ?? null,
            raw: cart,
            zoppy_created_at: dateOrNull(cart.createdAt),
            zoppy_updated_at: dateOrNull(cart.updatedAt),
            synced_at: new Date().toISOString(),
          }, { onConflict: 'zoppy_id' });
          total++;
        }
      }

      page++;
      // Página incompleta = acabou.
      if (batchLen < PAGE_SIZE) { finished = true; break; }
    }

    await supabase.from('zoppy_sync_state').update({
      next_page: page,
      total_synced: total,
      contacts_created: created,
      contacts_matched: matched,
      status: finished ? 'done' : 'running',
      finished_at: finished ? new Date().toISOString() : null,
      last_error: null,
    }).eq('resource', resource);

    log.info('batch_done', { resource, next_page: page, total, finished });

    if (!finished) {
      EdgeRuntime.waitUntil(
        fetch(`${supabaseUrl}/functions/v1/zoppy-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceRoleKey}` },
          body: JSON.stringify({ resource }),
        }).catch((e) => log.silent('self_reinvoke_failed', { error: (e as Error).message })),
      );
    }

    return json({ ok: true, resource, total_synced: total, finished });
  } catch (err) {
    await supabase.from('zoppy_sync_state').update({
      status: 'error',
      last_error: (err as Error).message.slice(0, 500),
      next_page: page,
      total_synced: total,
      contacts_created: created,
      contacts_matched: matched,
    }).eq('resource', resource);
    log.error('sync_failed', { resource, page, error: (err as Error).message });
    return json({ ok: false, error: (err as Error).message });
  }
});
