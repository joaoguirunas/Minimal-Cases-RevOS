/**
 * meta-save-credentials
 *
 * Validates a Meta System User Token against Graph API v25.0, checks required
 * permissions and assets (Page, Instagram Business, ad accounts), then persists
 * atomically to bi_settings, omni_channel_configs, meta_lead_form_pages, and
 * best-effort to bi_ad_accounts.
 *
 * POST body: { app_id, app_secret, system_token, instagram_business_id, page_id }
 * Returns:   { ok, token, page, instagram, ad_accounts, permissions }  (success)
 *            { ok: false, step, error }                                 (validation failure)
 *
 * DEPLOY: supabase functions deploy meta-save-credentials --no-verify-jwt
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';

const GRAPH_BASE = 'https://graph.facebook.com/v25.0';

const REQUIRED_PERMISSIONS = [
  'instagram_basic',
  'instagram_manage_messages',
  'instagram_manage_comments',
  'pages_messaging',
  'pages_show_list',
  'pages_read_engagement',
  'leads_retrieval',
  'ads_read',
  'business_management',
  'pages_manage_metadata',
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function graphGet(path: string, token: string): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const url = `${GRAPH_BASE}/${path}${path.includes('?') ? '&' : '?'}access_token=${token}`;
  const res = await fetch(url);
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok || data.error) {
    return { ok: false, data };
  }
  return { ok: true, data };
}

// ── Main ──────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
  }

  const log = createLogger('meta-save-credentials');
  const t0 = Date.now();

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ── Parse & validate body ─────────────────────────────────────────────────

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, step: 'parse', error: 'Invalid JSON body' });
  }

  const raw = body as {
    app_id?: string;
    app_secret?: string;
    system_token?: string;
    instagram_business_id?: string;
    page_id?: string;
  };

  const app_id              = raw.app_id?.trim();
  const app_secret          = raw.app_secret?.trim();
  const system_token        = raw.system_token?.trim();
  const instagram_business_id = raw.instagram_business_id?.trim();
  const page_id             = raw.page_id?.trim();

  if (!app_id || !instagram_business_id || !page_id) {
    return json({
      ok: false,
      step: 'validation',
      error: 'Missing required fields: app_id, instagram_business_id, page_id',
    });
  }

  // app_secret and system_token are optional — read existing from bi_settings if not sent
  const { data: existing } = await supabase
    .from('bi_settings')
    .select('meta_app_secret, meta_system_token')
    .eq('singleton', true)
    .maybeSingle();

  let resolvedAppSecret = app_secret;
  if (!resolvedAppSecret) {
    resolvedAppSecret = existing?.meta_app_secret ?? undefined;
    if (!resolvedAppSecret) {
      return json({ ok: false, step: 'validation', error: 'App Secret é obrigatório na primeira configuração.' });
    }
  }

  let resolvedSystemToken = system_token;
  if (!resolvedSystemToken) {
    resolvedSystemToken = existing?.meta_system_token ?? undefined;
    if (!resolvedSystemToken) {
      return json({ ok: false, step: 'validation', error: 'System User Token é obrigatório na primeira configuração.' });
    }
  }

  log.info('started', { page_id, instagram_business_id });

  // ── (a) Validate token ────────────────────────────────────────────────────

  const tokenResult = await graphGet('me?fields=id,name', resolvedSystemToken);
  if (!tokenResult.ok) {
    const errMsg = (tokenResult.data.error as Record<string, unknown>)?.message as string
      ?? 'Token validation failed';
    log.error('token invalid', { error: errMsg });
    return json({ ok: false, step: 'token', error: errMsg });
  }
  const systemUserName = (tokenResult.data.name as string) ?? 'System User';
  log.info('token valid', { system_user_name: systemUserName });

  // ── (b) Check permissions (non-blocking) ─────────────────────────────────

  const permResult = await graphGet('me/permissions', resolvedSystemToken);
  const grantedPerms: string[] = [];

  if (permResult.ok) {
    const permData = permResult.data.data as Array<{ permission: string; status: string }> | undefined;
    if (Array.isArray(permData)) {
      for (const p of permData) {
        if (p.status === 'granted') grantedPerms.push(p.permission);
      }
    }
  }

  const missingPerms = REQUIRED_PERMISSIONS.filter(p => !grantedPerms.includes(p));
  if (missingPerms.length > 0) {
    log.warn('missing permissions', { missing: missingPerms });
  }

  // ── (c) Validate Page ─────────────────────────────────────────────────────

  // Also request `access_token`: Graph API returns the Page's own Page Access
  // Token here (derived from the System User token, since the system user has
  // this Page as a granted asset). Lead Ads endpoints (/leadgen_forms,
  // /{form}/leads) reject System User tokens outright with "(#190) This
  // method must be called with a Page Access Token" — only this derived
  // token works there. The System User token itself is still used as-is for
  // Instagram messaging (omni_channel_configs) below, which doesn't have
  // this restriction.
  const pageResult = await graphGet(`${page_id}?fields=id,name,access_token`, resolvedSystemToken);
  if (!pageResult.ok) {
    const errMsg = (pageResult.data.error as Record<string, unknown>)?.message as string
      ?? 'Page access validation failed';
    log.error('page invalid', { page_id, error: errMsg });
    return json({ ok: false, step: 'page', error: errMsg });
  }
  const pageName = (pageResult.data.name as string) ?? '';
  const pageAccessToken = (pageResult.data.access_token as string | undefined) ?? resolvedSystemToken;
  if (!pageResult.data.access_token) {
    log.warn('page_access_token_not_returned', { page_id, fallback: 'system_user_token' });
  }
  log.info('page valid', { page_id, page_name: pageName, derived_page_token: !!pageResult.data.access_token });

  // ── (d) Validate Instagram Business ──────────────────────────────────────

  const igResult = await graphGet(`${instagram_business_id}?fields=id,name,username`, resolvedSystemToken);
  if (!igResult.ok) {
    const errMsg = (igResult.data.error as Record<string, unknown>)?.message as string
      ?? 'Instagram Business validation failed';
    log.error('instagram invalid', { instagram_business_id, error: errMsg });
    return json({ ok: false, step: 'instagram', error: errMsg });
  }
  const igName = (igResult.data.name as string) ?? '';
  const igUsername = (igResult.data.username as string) ?? '';
  log.info('instagram valid', { instagram_business_id, username: igUsername });

  // ── (e) Fetch ad accounts (best-effort) ───────────────────────────────────

  let adAccountsSaved = false;
  let adAccountsCount = 0;

  const adResult = await graphGet('me/adaccounts?fields=id,name', resolvedSystemToken);
  if (adResult.ok) {
    const adData = adResult.data.data as Array<{ id: string; name: string }> | undefined;
    if (Array.isArray(adData) && adData.length > 0) {
      adAccountsCount = adData.length;
      try {
        const upsertRows = adData.map(acc => ({
          account_id: acc.id.replace('act_', ''),
          account_name: acc.name,
          platform: 'meta',
          access_token: resolvedSystemToken,
          is_active: true,
        }));
        const { error: adErr } = await supabase
          .from('bi_ad_accounts')
          .upsert(upsertRows, { onConflict: 'account_id' });
        if (adErr) {
          log.silent('bi_ad_accounts upsert failed', { error: adErr.message });
        } else {
          adAccountsSaved = true;
          log.info('ad accounts saved', { count: adAccountsCount });
        }
      } catch (e) {
        log.silent('bi_ad_accounts exception', { error: e instanceof Error ? e.message : String(e) });
      }
    }
  } else {
    log.silent('ad accounts fetch failed', {
      error: (adResult.data.error as Record<string, unknown>)?.message,
    });
  }

  // ── Persist to DB ─────────────────────────────────────────────────────────

  // bi_settings — singleton UPDATE
  const { error: biErr } = await supabase
    .from('bi_settings')
    .update({
      meta_app_id: app_id,
      meta_app_secret: resolvedAppSecret,
      meta_system_token: resolvedSystemToken,
      meta_system_token_saved_at: new Date().toISOString(),
    })
    .eq('singleton', true);

  if (biErr) {
    log.error('bi_settings update failed', { error: biErr.message });
    return json({ ok: false, step: 'db_bi_settings', error: 'Failed to save settings' });
  }

  // omni_channel_configs — UPSERT by channel=instagram
  const credentials = {
    access_token: resolvedSystemToken,
    instagram_business_id,
    page_id,
    app_id,
    app_secret: resolvedAppSecret,
  };

  const { error: omniErr } = await supabase
    .from('omni_channel_configs')
    .upsert(
      {
        channel: 'instagram',
        display_name: 'Instagram',
        credentials,
        is_active: true,
      },
      { onConflict: 'channel' },
    );

  if (omniErr) {
    log.error('omni_channel_configs upsert failed', { error: omniErr.message });
    return json({ ok: false, step: 'db_omni_channel_configs', error: 'Failed to save channel config' });
  }

  // meta_lead_form_pages — UPSERT by page_id
  // Uses pageAccessToken (derived above), NOT resolvedSystemToken — Lead Ads
  // endpoints require a genuine Page Access Token.
  const { error: pagesErr } = await supabase
    .from('meta_lead_form_pages')
    .upsert(
      {
        page_id,
        page_name: pageName,
        access_token: pageAccessToken,
        subscribed: true,
      },
      { onConflict: 'page_id' },
    );

  if (pagesErr) {
    log.error('meta_lead_form_pages upsert failed', { error: pagesErr.message });
    return json({ ok: false, step: 'db_meta_lead_form_pages', error: 'Failed to save page record' });
  }

  // ── Subscribe Page to webhook fields (messages + comments + leadgen) ──────
  let webhookSubscribed = false;
  try {
    const subRes = await fetch(
      `${GRAPH_BASE}/${page_id}/subscribed_apps`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscribed_fields: 'messages,comments,leadgen,messaging_postbacks,feed',
          access_token: resolvedSystemToken,
        }),
      },
    );
    const subData = await subRes.json() as Record<string, unknown>;
    if (subRes.ok && !subData.error) {
      webhookSubscribed = true;
      log.info('page webhook subscribed', { page_id, fields: 'messages,comments,leadgen' });
    } else {
      log.warn('page webhook subscribe failed', { error: (subData.error as Record<string, unknown>)?.message });
    }
  } catch (e) {
    log.warn('page webhook subscribe exception', { error: e instanceof Error ? e.message : String(e) });
  }

  log.info('completed', { elapsed_ms: log.elapsed(t0) });

  return json({
    ok: true,
    system_user_name: systemUserName,
    page_name: pageName,
    instagram_username: igUsername,
    ad_accounts_count: adAccountsCount,
    permissions_granted: grantedPerms.length,
    permissions_total: REQUIRED_PERMISSIONS.length,
    missing_permissions: missingPerms,
    webhook_subscribed: webhookSubscribed,
  });
});
