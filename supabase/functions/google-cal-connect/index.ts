/**
 * Schedule PRO™ — Google Calendar OAuth Connect
 *
 * POST /google-cal-connect
 * Body: { code: string, redirect_uri: string }
 *
 * Flow:
 * 1. Verify Supabase JWT → get settings_users.id
 * 2. Exchange code → access_token + refresh_token
 * 3. Fetch Google email from userinfo endpoint
 * 4. Insert a new row into user_calendar_connections (multi-connection: one row
 *    per connected account; dedup by user_id + google_email).
 *
 * INVARIANT (MULTI-CAL): each connection is an independent row keyed by `id`.
 * Never upsert/update by `user_id` alone — that would clobber sibling connections.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

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

    // === OAuth credentials: settings (CFG-05) → bi_settings fallback → env ===
    const { data: settingsRow } = await supabase
      .from('settings')
      .select('google_client_id, google_client_secret')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    let clientId = settingsRow?.google_client_id ?? '';
    let clientSecret = settingsRow?.google_client_secret ?? '';
    if (!clientId || !clientSecret) {
      const { data: biRow } = await supabase
        .from('bi_settings')
        .select('google_client_id, google_client_secret')
        .limit(1)
        .maybeSingle();
      clientId = clientId || (biRow?.google_client_id ?? Deno.env.get('GOOGLE_CLIENT_ID') ?? '');
      clientSecret = clientSecret || (biRow?.google_client_secret ?? Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '');
    }

    if (!clientId || !clientSecret) {
      return json({ success: false, error: 'Google Client ID / Secret não configurados. Acesse Configurações → Google.' }, 400);
    }

    // === Lookup settings_users.id ===
    const { data: crmUser, error: crmError } = await supabase
      .from('settings_users')
      .select('id')
      .eq('auth_user_id', user.id)
      .eq('active', true)
      .single();

    if (crmError || !crmUser) {
      return json({ success: false, error: 'Usuário não encontrado' }, 403);
    }

    // === PARSE BODY ===
    const body = await req.json();
    const { code, redirect_uri, sync_booking } = body as {
      code: string;
      redirect_uri: string;
      sync_booking?: boolean;
    };

    if (!code || !redirect_uri) {
      return json({ success: false, error: 'Missing code or redirect_uri' }, 400);
    }

    const syncBooking = sync_booking ?? true;

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
      let errorMsg: string;
      if (tokenData.error === 'invalid_client') {
        errorMsg = 'Client ID ou Client Secret inválidos. Baixe o JSON de credenciais no Google Cloud Console e reconfigure em Configurações → Google.';
      } else if (tokenData.error === 'redirect_uri_mismatch') {
        errorMsg = `URI de redirecionamento não autorizada. Adicione "${redirect_uri}" no Google Cloud Console → Credenciais → URIs de redirecionamento autorizados.`;
      } else if (tokenData.error === 'invalid_grant') {
        errorMsg = 'Código de autorização expirado ou já utilizado. Clique em "Conectar Google Agenda" novamente.';
      } else {
        errorMsg = `Google OAuth error: ${tokenData.error_description ?? tokenData.error ?? 'Token exchange failed'}`;
      }
      return json({ success: false, error: errorMsg }, 502);
    }

    const accessToken: string = tokenData.access_token;
    const refreshToken: string | null = tokenData.refresh_token ?? null;
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    if (!refreshToken) {
      return json({
        success: false,
        error: 'Nenhum refresh_token retornado. Use prompt=consent para forçar nova autorização.',
      }, 400);
    }

    // === STEP 2: Fetch Google email ===
    const userInfoRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userInfo = await userInfoRes.json();
    const googleEmail: string = userInfo.email ?? '';

    if (!googleEmail) {
      return json({ success: false, error: 'Não foi possível obter o email do Google.' }, 502);
    }

    // === STEP 3: Dedup by (user_id, provider='google', google_email) — ADR D3 ===
    // Same account → UPDATE tokens (reconnect refreshes). Different account → INSERT new row.
    const { data: existing } = await supabase
      .from('user_calendar_connections')
      .select('id')
      .eq('user_id', crmUser.id)
      .eq('provider', 'google')
      .eq('google_email', googleEmail)
      .maybeSingle();

    if (existing) {
      // Reconnect: refresh tokens on the existing row by id. Only override sync_booking
      // if the caller passed it explicitly; otherwise preserve the stored value.
      const { error: updateError } = await supabase
        .from('user_calendar_connections')
        .update({
          google_access_token: accessToken,
          google_refresh_token: refreshToken,
          google_token_expires_at: expiresAt,
          google_calendar_id: 'primary',
          ...(sync_booking !== undefined ? { sync_booking } : {}),
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      if (updateError) {
        console.error('Update error:', updateError);
        return json({ success: false, error: 'Erro ao salvar conexão: ' + updateError.message }, 500);
      }
      console.log(`✅ google-cal-connect: reconnected ${googleEmail} for user ${crmUser.id}`);
      return json({ success: true, id: existing.id, google_email: googleEmail, reconnected: true });
    }

    // === STEP 4: Insert a new connection row ===
    const { data: inserted, error: insertError } = await supabase
      .from('user_calendar_connections')
      .insert({
        user_id: crmUser.id,
        provider: 'google',
        google_email: googleEmail,
        google_access_token: accessToken,
        google_refresh_token: refreshToken,
        google_token_expires_at: expiresAt,
        google_calendar_id: 'primary',
        sync_booking: syncBooking,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return json({ success: false, error: 'Erro ao salvar conexão: ' + insertError.message }, 500);
    }

    console.log(`✅ google-cal-connect: ${googleEmail} connected for user ${crmUser.id} (sync_booking=${syncBooking})`);
    return json({ success: true, id: inserted?.id, google_email: googleEmail });

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
