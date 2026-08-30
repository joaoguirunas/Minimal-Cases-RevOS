/**
 * BI PRO™ — Google Ads OAuth Token Exchange
 *
 * POST /bi-google-oauth
 * Body: { code: string, redirect_uri: string }
 *
 * Flow:
 * 1. Exchange code → access_token + refresh_token
 * 2. Fetch accessible Google Ads customer accounts
 * 3. Upsert into bi_ad_accounts
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_ADS_BASE = 'https://googleads.googleapis.com/v20';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return json(null, 200);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  try {
    // === AUTH — verify user JWT ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ success: false, error: 'Unauthorized' }, 401);
    }

    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return json({ success: false, error: 'Invalid token' }, 401);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // === READ CREDENTIALS FROM DB ===
    // google_client_id/secret live in settings (Schedule PRO owns them).
    // google_developer_token is BI-only and remains in bi_settings.
    const { data: settingsRow } = await supabase
      .from('settings')
      .select('google_client_id, google_client_secret')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: biSettings } = await supabase
      .from('bi_settings')
      .select('google_developer_token')
      .eq('singleton', true)
      .maybeSingle();
    const clientId = settingsRow?.google_client_id ?? '';
    const clientSecret = settingsRow?.google_client_secret ?? '';
    const developerToken = biSettings?.google_developer_token ?? '';

    if (!clientId || !clientSecret) {
      return json({ success: false, error: 'Google Client ID e Client Secret não configurados. Configure em Configurações → Ads.' }, 400);
    }

    // === PARSE BODY ===
    const body = await req.json();
    const { code, redirect_uri } = body as { code: string; redirect_uri: string };

    if (!code || !redirect_uri) {
      return json({ success: false, error: 'Missing code or redirect_uri' }, 400);
    }

    // === STEP 1: Exchange code → tokens ===
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error) {
      console.error('Google token exchange error:', tokenData);
      return json({
        success: false,
        error: `Google OAuth error: ${tokenData.error_description ?? tokenData.error ?? 'Token exchange failed'}`,
      }, 502);
    }

    const accessToken: string = tokenData.access_token;
    const refreshToken: string | null = tokenData.refresh_token ?? null;
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    if (!refreshToken) {
      console.warn('No refresh_token returned — user may have already authorized. Re-auth with prompt=consent to force a new refresh_token.');
    }

    // === STEP 2: Fetch accessible customer accounts ===
    // List customers accessible to this token
    let accounts: Array<{ id: string; name: string }> = [];
    let enableApiUrl: string | undefined;

    if (developerToken) {
      try {
        const customersRes = await fetch(
          `${GOOGLE_ADS_BASE}/customers:listAccessibleCustomers`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'developer-token': developerToken,
            },
          }
        );
        const customersData = await customersRes.json();

        if (customersRes.ok && customersData.resourceNames) {
          // resourceNames: ["customers/1234567890", ...]
          accounts = customersData.resourceNames.map((rn: string) => ({
            id: rn.replace('customers/', ''),
            name: `Google Ads ${rn.replace('customers/', '')}`,
          }));
        } else if (!customersRes.ok) {
          // Capture the enable URL when the Google Ads API is disabled in the Cloud project
          const errMsg: string = customersData?.error?.message ?? '';
          const urlMatch = errMsg.match(/https:\/\/console\.developers\.google\.com\/[^\s]+/);
          enableApiUrl = urlMatch?.[0]
            ?? `https://console.developers.google.com/apis/api/googleads.googleapis.com/overview`;
          console.warn(`listAccessibleCustomers failed (${customersRes.status}):`, errMsg);
        }
      } catch (e) {
        console.warn('Could not fetch customer list, will store single account:', e);
      }
    }

    // === STEP 3: Return accounts + tokens for user selection ===
    console.log(`✅ Google OAuth: ${accounts.length} account(s) found`);

    return json({
      success: true,
      accounts: accounts.map(a => ({ id: a.id, name: a.name })),
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expires_at: expiresAt,
      has_developer_token: !!developerToken,
      enable_api_url: enableApiUrl,
    });

  } catch (err) {
    console.error('Unexpected error:', err);
    return json({ success: false, error: String(err) }, 500);
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
