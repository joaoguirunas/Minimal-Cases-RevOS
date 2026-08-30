/**
 * BI PRO™ — Meta Ads OAuth Token Exchange
 *
 * POST /bi-meta-oauth
 * Body: { code: string, redirect_uri: string }
 *
 * Flow:
 * 1. Exchange short-lived code → short-lived token (via /oauth/access_token)
 * 2. Exchange short-lived token → long-lived token (~60 days)
 * 3. Fetch ad accounts linked to this token (best-effort)
 * 4. Return access_token + accounts for client to store
 *
 * IMPORTANT: All responses are HTTP 200 with { success: true/false }
 * because supabase.functions.invoke returns data=null for non-2xx.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return json({ ok: true });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  try {
    // === AUTH — verify user JWT ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ success: false, error: 'Unauthorized — no Bearer token' });
    }

    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return json({ success: false, error: 'Sessão inválida ou expirada. Faça login novamente.' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // === READ CREDENTIALS FROM DB ===
    const { data: biSettings } = await supabase.from('bi_settings').select('meta_app_id, meta_app_secret').single();
    const metaAppId = biSettings?.meta_app_id ?? '';
    const metaAppSecret = biSettings?.meta_app_secret ?? '';

    if (!metaAppId || !metaAppSecret) {
      return json({ success: false, error: 'Meta App ID e App Secret não configurados. Vá em Integrações → Meta Ads.' });
    }

    // === PARSE BODY ===
    const body = await req.json();
    const { code, redirect_uri } = body as { code: string; redirect_uri: string };

    if (!code || !redirect_uri) {
      return json({ success: false, error: 'Parâmetros code ou redirect_uri ausentes.' });
    }

    // === STEP 1: Exchange code → short-lived token ===
    console.log('[bi-meta-oauth] Step 1: exchanging code for short-lived token...');
    const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', metaAppId);
    tokenUrl.searchParams.set('client_secret', metaAppSecret);
    tokenUrl.searchParams.set('redirect_uri', redirect_uri);
    tokenUrl.searchParams.set('code', code);

    const shortTokenRes = await fetch(tokenUrl.toString());
    const shortTokenData = await shortTokenRes.json();

    if (!shortTokenRes.ok || shortTokenData.error) {
      const errMsg = shortTokenData.error?.message ?? 'Token exchange failed';
      console.error('[bi-meta-oauth] Step 1 FAILED:', shortTokenData.error);
      return json({ success: false, error: `Erro Meta OAuth (step 1): ${errMsg}` });
    }

    const shortLivedToken: string = shortTokenData.access_token;
    console.log('[bi-meta-oauth] Step 1 OK — short-lived token acquired');

    // === STEP 2: Exchange short-lived → long-lived token (~60 days) ===
    console.log('[bi-meta-oauth] Step 2: exchanging for long-lived token...');
    const longTokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
    longTokenUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longTokenUrl.searchParams.set('client_id', metaAppId);
    longTokenUrl.searchParams.set('client_secret', metaAppSecret);
    longTokenUrl.searchParams.set('fb_exchange_token', shortLivedToken);

    const longTokenRes = await fetch(longTokenUrl.toString());
    const longTokenData = await longTokenRes.json();

    if (!longTokenRes.ok || longTokenData.error) {
      const errMsg = longTokenData.error?.message ?? 'Unknown error';
      console.error('[bi-meta-oauth] Step 2 FAILED:', longTokenData.error);
      return json({ success: false, error: `Erro ao gerar token longo (step 2): ${errMsg}` });
    }

    const accessToken: string = longTokenData.access_token;
    const expiresAt = longTokenData.expires_in
      ? new Date(Date.now() + longTokenData.expires_in * 1000).toISOString()
      : null;
    console.log('[bi-meta-oauth] Step 2 OK — long-lived token acquired');

    // === STEP 3: Fetch ad accounts (best-effort, non-blocking) ===
    let accountList: Array<{ id: string; name: string }> = [];
    try {
      const adAccountsUrl = new URL('https://graph.facebook.com/v19.0/me/adaccounts');
      adAccountsUrl.searchParams.set('fields', 'id,name,account_status,currency');
      adAccountsUrl.searchParams.set('access_token', accessToken);

      const adAccountsRes = await fetch(adAccountsUrl.toString());
      const adAccountsData = await adAccountsRes.json();

      const adAccounts: Array<{ id: string; name: string }> =
        adAccountsData.data?.filter((a: { account_status: number }) => a.account_status === 1) ?? [];

      accountList = adAccounts.map((a: { id: string; name: string }) => ({
        id: a.id.replace(/^act_/, ''),
        name: a.name,
      }));
      console.log(`[bi-meta-oauth] Step 3 OK — ${accountList.length} ad account(s)`);
    } catch (adErr) {
      console.warn('[bi-meta-oauth] Step 3 SKIPPED (non-blocking):', adErr);
    }

    console.log(`✅ [bi-meta-oauth] Complete — token OK, ${accountList.length} account(s)`);

    return json({
      success: true,
      accounts: accountList,
      access_token: accessToken,
      token_expires_at: expiresAt,
    });

  } catch (err) {
    console.error('[bi-meta-oauth] Unexpected error:', err);
    return json({ success: false, error: `Erro inesperado: ${String(err)}` });
  }
});
