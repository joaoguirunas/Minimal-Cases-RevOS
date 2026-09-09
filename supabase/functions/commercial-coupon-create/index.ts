/**
 * commercial-coupon-create — cupom pessoal (5/10/15/20%) gerado pelo comercial.
 * Auth: JWT do usuário → settings_users ativo com user_type='comercial' (ou admin/gestor).
 * Lê o lead com o client DO USUÁRIO (RLS decide se ele pode ver) e, se o lead não tem dono,
 * assume via claim_lead. Cria na Yampi com service_role. 1 cupom ativo por lead (reaproveita).
 * Sempre HTTP 200 com { ok } exceto 401/403 — o front lê a mensagem.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { COUPON_PERCENTS_COMMERCIAL, createPersonalCoupon } from '../_shared/yampi-coupon.ts';
import { createYampiClientForConnection } from '../_shared/yampi-client.ts';
import { createTrackedLinkDetailed, formatBRL, resolveCartForPerson } from '../_shared/tracked-links.ts';
import {
  buildComercialCupomMessage,
  COMERCIAL_CUPOM_TEMPLATE_NAME,
  priceWithCoupon,
} from '../_shared/comercial-coupon-message.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const Req = z.object({
  lead_id: z.string().uuid(),
  percent: z.number().int().refine((p) => (COUPON_PERCENTS_COMMERCIAL as readonly number[]).includes(p), 'percent deve ser 5, 10, 15 ou 20'),
  validity_days: z.number().int().min(1).max(7).optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) return json({ ok: false, error: 'Unauthorized' }, 401);
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: auth } } });
    const { data: u, error: uErr } = await userClient.auth.getUser(auth.replace('Bearer ', ''));
    if (uErr || !u?.user) return json({ ok: false, error: 'Unauthorized' }, 401);
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { data: me } = await admin.from('settings_users').select('id, name, user_type, super_admin, active, deleted_at')
      .eq('auth_user_id', u.user.id).maybeSingle();
    const meRow = me as { id: string; name: string | null; user_type: string | null; super_admin: boolean | null; active: boolean | null; deleted_at: string | null } | null;
    if (!meRow || !meRow.active || meRow.deleted_at) return json({ ok: false, error: 'Usuário sem perfil ativo' }, 403);
    const isAdmin = meRow.super_admin === true || meRow.user_type === 'admin' || meRow.user_type === 'manager';
    if (!isAdmin && meRow.user_type !== 'comercial') return json({ ok: false, error: 'Apenas comercial ou gestor geram cupom' }, 403);

    let input: z.infer<typeof Req>;
    try { input = Req.parse(await req.json()); }
    catch (e) { return json({ ok: false, code: 'PERCENT_INVALIDO', error: e instanceof z.ZodError ? e.errors[0].message : 'Input inválido' }); }

    // Lead pela RLS do usuário: invisível = não existe pra ele.
    const { data: leadRaw } = await userClient.from('leads').select('id, user_id, people_id, title').eq('id', input.lead_id).maybeSingle();
    let lead = leadRaw as { id: string; user_id: string | null; people_id: string | null; title: string | null } | null;
    if (!lead) return json({ ok: false, code: 'LEAD_INVISIVEL', error: 'Carrinho não está disponível pra você.' });

    if (!lead.user_id && !isAdmin) {
      const { data: claim } = await userClient.rpc('claim_lead', { p_lead_id: lead.id });
      const c = claim as { ok: boolean; reason?: string } | null;
      if (!c?.ok) return json({ ok: false, code: 'JA_ASSUMIDO', error: c?.reason === 'ja_assumido' ? 'Outro comercial acabou de assumir este carrinho.' : 'Carrinho fora do pool.' });
      lead = { ...lead, user_id: meRow.id };
    }
    if (!isAdmin && lead.user_id !== meRow.id) return json({ ok: false, code: 'LEAD_INVISIVEL', error: 'Este carrinho é de outro comercial.' }, 403);

    // 1 cupom ativo por lead → devolve o existente.
    const { data: existing } = await admin.from('crm_coupons').select('code, percent, expires_at')
      .eq('lead_id', lead.id).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const ex = existing as { code: string; percent: number | null; expires_at: string } | null;

    const bound = await createYampiClientForConnection(admin as never);
    if (!bound) return json({ ok: false, code: 'SEM_YAMPI', error: 'Integração Yampi não conectada.' });

    const cart = lead.people_id ? await resolveCartForPerson(admin as never, lead.people_id) : null;
    const { data: person } = await admin.from('clients_people').select('name').eq('id', lead.people_id ?? '').maybeSingle();
    const nome = ((person as { name: string | null } | null)?.name ?? 'cliente').split(/\s+/)[0];

    let code = ex?.code ?? null, percent = ex?.percent ?? input.percent, expiresAt = ex?.expires_at ?? null, reused = !!ex;
    if (!ex) {
      try {
        const r = await createPersonalCoupon(admin as never, bound.client, {
          firstName: nome, percent: input.percent, validityDays: input.validity_days ?? 3,
          peopleId: lead.people_id, leadId: lead.id, source: 'comercial', createdBy: meRow.id,
        });
        code = r.code; percent = r.percent; expiresAt = r.expiresAt; reused = r.reused;
      } catch (e) { return json({ ok: false, code: 'YAMPI_ERRO', error: `Yampi: ${(e as Error).message}` }); }
    }

    const tracked = cart?.url
      ? await createTrackedLinkDetailed(admin as never, {
        destination: cart.url, peopleId: lead.people_id, leadId: lead.id, channel: 'whatsapp',
        source: 'manual', label: 'cupom_comercial', templateName: COMERCIAL_CUPOM_TEMPLATE_NAME,
      })
      : null;
    if (tracked) await admin.from('tracked_links').update({ created_by: meRow.id }).eq('id', tracked.id);

    const validade = expiresAt ? new Date(expiresAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }) : '';
    // `||` e não `??`: título vazio / split sem sufixo devolvem '' (falsy), não null.
    const produto = cart?.produto || (lead.title ?? '').split(' — ')[0] || 'sua case';
    const preview = buildComercialCupomMessage({
      nome,
      remetente: (meRow.name ?? 'Minimal Cases').split(/\s+/)[0],
      produto,
      percentual: percent,
      cupom: code ?? '',
      validade,
    });

    return json({
      ok: true, code, percent, expires_at: expiresAt, reused,
      price: cart?.total ?? null, price_with_coupon: priceWithCoupon(cart?.total ?? null, percent),
      price_label: formatBRL(cart?.total ?? null), price_with_coupon_label: formatBRL(priceWithCoupon(cart?.total ?? null, percent)),
      cart_url: cart?.url ?? null, tracked_url: tracked?.url ?? cart?.url ?? null, message_preview: preview,
    });
  } catch (e) {
    console.error('commercial-coupon-create', e);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
