/**
 * Instagram Business Login — OAuth Callback Handler
 *
 * ⚠️  DEPLOY: always use --no-verify-jwt
 *     supabase functions deploy instagram-oauth --no-verify-jwt
 *
 * This URL must be registered in:
 *   Meta App Dashboard → Instagram → Business Login for Instagram → OAuth Redirect URIs
 *
 * Flow:
 *   1. User clicks "Conectar Instagram" (Business Login OAuth dialog)
 *   2. Meta redirects GET here with ?code=xxx&state=xxx
 *   3. We exchange code → short-lived token
 *   4. Exchange short-lived → long-lived token (~60 days)
 *   5. Fetch Page ID + Instagram Business Account ID from the token
 *   6. Save credentials to omni_channel_configs (channel='instagram')
 *   7. Redirect user to /settings/omni/instagram?connected=1
 *
 * Required env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   INSTAGRAM_APP_ID       — Meta App ID
 *   INSTAGRAM_APP_SECRET   — Meta App Secret
 *   APP_URL                — Your frontend URL (e.g. https://app.growthsales.com.br)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';

const META_GRAPH = 'https://graph.facebook.com/v25.0';

// ── Helpers ───────────────────────────────────────────────────────────────────

function redirectTo(appUrl: string, path: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: `${appUrl}${path}` },
  });
}

async function exchangeCode(
  code: string,
  redirectUri: string,
  appId: string,
  appSecret: string,
): Promise<{ access_token: string; token_type: string } | null> {
  const url = new URL(`${META_GRAPH}/oauth/access_token`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('code', code);

  const resp = await fetch(url.toString());
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    console.error('[exchangeCode] failed', resp.status, body);
    return null;
  }
  return resp.json() as Promise<{ access_token: string; token_type: string }>;
}

async function exchangeLongLived(
  shortToken: string,
  appId: string,
  appSecret: string,
): Promise<{ access_token: string; expires_in: number } | null> {
  const url = new URL(`${META_GRAPH}/oauth/access_token`);
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('fb_exchange_token', shortToken);

  const resp = await fetch(url.toString());
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    console.error('[exchangeLongLived] failed', resp.status, body);
    return null;
  }
  return resp.json() as Promise<{ access_token: string; expires_in: number }>;
}

async function fetchPageAndIgIds(
  longToken: string,
): Promise<{ pageId: string; igBusinessId: string; pageName: string } | null> {
  // 1. Fetch pages the user/token has access to
  const pagesResp = await fetch(
    `${META_GRAPH}/me/accounts?fields=id,name,instagram_business_account&access_token=${longToken}`,
  );
  if (!pagesResp.ok) {
    const body = await pagesResp.text().catch(() => '');
    console.error('[fetchPageAndIgIds] failed', pagesResp.status, body);
    return null;
  }

  const pagesData = await pagesResp.json() as {
    data?: { id: string; name: string; instagram_business_account?: { id: string } }[];
  };

  const page = pagesData.data?.find(p => p.instagram_business_account?.id);
  if (!page) {
    console.error('[fetchPageAndIgIds] no page with instagram_business_account', JSON.stringify(pagesData.data?.map(p => ({ id: p.id, name: p.name, ig: !!p.instagram_business_account }))));
    return null;
  }

  return {
    pageId: page.id,
    igBusinessId: page.instagram_business_account!.id,
    pageName: page.name,
  };
}

// ── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const appId = Deno.env.get('INSTAGRAM_APP_ID') ?? '';
  const appSecret = Deno.env.get('INSTAGRAM_APP_SECRET') ?? '';
  const appUrl = Deno.env.get('APP_URL') ?? '';

  const log = createLogger('instagram-oauth');
  const url = new URL(req.url);

  // The redirect_uri must exactly match what was registered in Meta App Dashboard
  const redirectUri = `${supabaseUrl}/functions/v1/instagram-oauth`;

  // ── Error from Meta (user denied, etc.) ───────────────────────────────────
  const error = url.searchParams.get('error');
  if (error) {
    const desc = url.searchParams.get('error_description') ?? error;
    log.warn('oauth_denied', { error, desc });
    return redirectTo(appUrl, `/settings/omni/instagram?error=${encodeURIComponent(desc)}`);
  }

  const code = url.searchParams.get('code');
  if (!code) {
    log.warn('no_code');
    return redirectTo(appUrl, '/settings/omni/instagram?error=no_code');
  }

  if (!appId || !appSecret) {
    log.error('missing_env', { has_app_id: !!appId, has_app_secret: !!appSecret });
    return redirectTo(appUrl, '/settings/omni/instagram?error=app_not_configured');
  }

  try {
    // Step 1 — Exchange code for short-lived token
    const shortLived = await exchangeCode(code, redirectUri, appId, appSecret);
    if (!shortLived?.access_token) {
      log.error('code_exchange_failed');
      return redirectTo(appUrl, '/settings/omni/instagram?error=code_exchange_failed');
    }

    // Step 2 — Exchange for long-lived token
    const longLived = await exchangeLongLived(shortLived.access_token, appId, appSecret);
    if (!longLived?.access_token) {
      log.error('long_lived_exchange_failed');
      return redirectTo(appUrl, '/settings/omni/instagram?error=token_exchange_failed');
    }

    const longToken = longLived.access_token;
    const expiresIn = longLived.expires_in; // seconds (~5183944 = 60 days)

    // Step 3 — Fetch Page ID + Instagram Business Account ID
    const ids = await fetchPageAndIgIds(longToken);
    if (!ids) {
      log.error('fetch_ids_failed');
      return redirectTo(appUrl, '/settings/omni/instagram?error=no_instagram_business_account');
    }

    log.info('oauth_success', {
      page_id: ids.pageId,
      ig_business_id: ids.igBusinessId,
      expires_in: expiresIn,
    });

    // Step 4 — Save to omni_channel_configs
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const { error: upsertErr } = await supabase
      .from('omni_channel_configs')
      .upsert({
        channel: 'instagram',
        is_active: true,
        credentials: {
          page_id: ids.pageId,
          instagram_business_id: ids.igBusinessId,
          access_token: longToken,
          token_expires_at: tokenExpiresAt,
          page_name: ids.pageName,
          app_id: appId,     // required by instagram-token-refresh for fb_exchange_token
          app_secret: appSecret, // store for webhook HMAC verification
        },
      }, { onConflict: 'channel' });

    if (upsertErr) {
      log.error('upsert_failed', { error: upsertErr.message });
      return redirectTo(appUrl, `/settings/omni/instagram?error=${encodeURIComponent(upsertErr.message)}`);
    }

    log.info('credentials_saved', { page_id: ids.pageId, ig_business_id: ids.igBusinessId });

    // Step 5 — Redirect back to the config page with success flag
    return redirectTo(appUrl, '/settings/omni/instagram?connected=1');
  } catch (err) {
    const errMsg = (err as Error).message;
    log.error('unhandled', { error: errMsg });
    return redirectTo(appUrl, `/settings/omni/instagram?error=${encodeURIComponent(errMsg)}`);
  }
});
