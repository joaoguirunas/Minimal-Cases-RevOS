/**
 * Schedule PRO™ — Microsoft Teams OAuth Connect
 *
 * POST /ms-teams-connect
 * Body: { code: string, redirect_uri: string }
 *
 * Flow:
 * 1. Verify Supabase JWT → get settings_users.id
 * 2. Exchange code → access_token + refresh_token (Microsoft identity platform)
 * 3. Fetch Microsoft email/name from Graph API
 * 4. Insert a new row into user_calendar_connections with provider='microsoft'
 *    (multi-connection: dedup by user_id + ms_email; coexists with google rows).
 *
 * INVARIANT (MULTI-CAL): each connection is an independent row keyed by `id`.
 * Microsoft and Google rows coexist for the same user — do NOT clear google_* columns.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MS_TOKEN_URL   = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const MS_PROFILE_URL = 'https://graph.microsoft.com/v1.0/me';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return json(null, 200);

  const supabaseUrl        = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  try {
    // === AUTH ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ success: false, error: 'Unauthorized' }, 401);

    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return json({ success: false, error: 'Invalid token' }, 401);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // === Azure credentials: DB first, env fallback ===
    const { data: settings } = await supabase
      .from('bi_settings')
      .select('ms_client_id, ms_client_secret')
      .limit(1)
      .maybeSingle();
    const clientId     = settings?.ms_client_id     ?? Deno.env.get('MS_CLIENT_ID') ?? '';
    const clientSecret = settings?.ms_client_secret ?? Deno.env.get('MS_CLIENT_SECRET') ?? '';

    if (!clientId || !clientSecret) {
      return json({
        success: false,
        error: 'Azure Client ID / Secret não configurados. Acesse Configurações → Microsoft Teams.',
      }, 400);
    }

    // === Lookup settings_users.id ===
    const { data: crmUser, error: crmError } = await supabase
      .from('settings_users')
      .select('id')
      .eq('auth_user_id', user.id)
      .eq('active', true)
      .single();
    if (crmError || !crmUser) return json({ success: false, error: 'Usuário não encontrado' }, 403);

    // === Parse body ===
    const { code, redirect_uri, sync_booking } = await req.json() as {
      code: string;
      redirect_uri: string;
      sync_booking?: boolean;
    };
    if (!code || !redirect_uri) return json({ success: false, error: 'Missing code or redirect_uri' }, 400);
    const syncBooking = sync_booking ?? true;

    // === STEP 1: Exchange code → tokens ===
    const tokenRes = await fetch(MS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri,
        grant_type: 'authorization_code',
        scope: 'OnlineMeetings.ReadWrite offline_access User.Read',
      }),
    });
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error) {
      console.error('MS token exchange error:', tokenData);
      return json({
        success: false,
        error: `Microsoft OAuth error: ${tokenData.error_description ?? tokenData.error ?? 'Token exchange failed'}`,
      }, 502);
    }

    const accessToken:  string      = tokenData.access_token;
    const refreshToken: string|null = tokenData.refresh_token ?? null;
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    if (!refreshToken) {
      return json({
        success: false,
        error: 'Nenhum refresh_token retornado. Verifique se offline_access está nos escopos.',
      }, 400);
    }

    // === STEP 2: Fetch Microsoft profile ===
    const profileRes = await fetch(MS_PROFILE_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = await profileRes.json();
    const msEmail:  string = profile.mail ?? profile.userPrincipalName ?? '';
    const msUserId: string = profile.id ?? '';

    if (!msEmail) {
      return json({ success: false, error: 'Não foi possível obter o email da Microsoft.' }, 502);
    }

    // === STEP 3: Dedup by (user_id, provider='microsoft', ms_email) — ADR D3 ===
    // Same account → UPDATE tokens (reconnect). Different account → INSERT new row.
    // google_* columns are never touched: MS and Google rows coexist.
    const { data: existing } = await supabase
      .from('user_calendar_connections')
      .select('id')
      .eq('user_id', crmUser.id)
      .eq('provider', 'microsoft')
      .eq('ms_email', msEmail)
      .maybeSingle();

    if (existing) {
      const { error: updateError } = await supabase
        .from('user_calendar_connections')
        .update({
          ms_access_token:     accessToken,
          ms_refresh_token:    refreshToken,
          ms_token_expires_at: expiresAt,
          ms_user_id:          msUserId,
          ...(sync_booking !== undefined ? { sync_booking } : {}),
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      if (updateError) {
        console.error('Update error:', updateError);
        return json({ success: false, error: 'Erro ao salvar conexão: ' + updateError.message }, 500);
      }
      console.log(`✅ ms-teams-connect: reconnected ${msEmail} for user ${crmUser.id}`);
      return json({ success: true, id: existing.id, ms_email: msEmail, reconnected: true });
    }

    // === STEP 4: Insert a new connection row (provider='microsoft') ===
    const { data: inserted, error: insertError } = await supabase
      .from('user_calendar_connections')
      .insert({
        user_id:             crmUser.id,
        provider:            'microsoft',
        ms_access_token:     accessToken,
        ms_refresh_token:    refreshToken,
        ms_token_expires_at: expiresAt,
        ms_user_id:          msUserId,
        ms_email:            msEmail,
        sync_booking:        syncBooking,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return json({ success: false, error: 'Erro ao salvar conexão: ' + insertError.message }, 500);
    }

    console.log(`✅ ms-teams-connect: ${msEmail} connected for user ${crmUser.id} (sync_booking=${syncBooking})`);
    return json({ success: true, id: inserted?.id, ms_email: msEmail });

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
