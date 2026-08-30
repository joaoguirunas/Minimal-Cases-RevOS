/**
 * Schedule PRO™ — Zoom OAuth User-Level Connect
 *
 * Handles both the authorization redirect and the OAuth callback.
 *
 * GET  (no code/error)  → redirect to Zoom authorization page
 *   Query: state=<tenant_id>:<settings_user_id>
 *
 * GET  ?code=<auth_code>&state=<...>
 *   → exchange code, UPSERT user_calendar_connections (provider='zoom'),
 *     redirect to /settings/general/integracoes?tab=zoom&connected=true
 *
 * GET  ?error=<reason>
 *   → redirect to /settings/general/integracoes?tab=zoom&error=<reason>
 *
 * AC4: OAuth User-Level flow (BCH-ZOOM-1)
 * AC5: state validated against authenticated JWT — mismatch → 403
 * AC6: zoom_client_secret read from bi_settings, NOT from Deno.env
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ZOOM_AUTH_URL    = 'https://zoom.us/oauth/authorize';
const ZOOM_TOKEN_URL   = 'https://zoom.us/oauth/token';
const ZOOM_PROFILE_URL = 'https://api.zoom.us/v2/users/me';

const SETTINGS_BASE = '/settings/general/integracoes';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function redirectTo(url: string): Response {
  return new Response(null, { status: 302, headers: { Location: url } });
}

function settingsRedirect(params: Record<string, string>): Response {
  const qs = new URLSearchParams({ tab: 'zoom', ...params }).toString();
  return redirectTo(`${SETTINGS_BASE}?${qs}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const supabaseUrl        = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey    = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  try {
    // === AUTH — JWT required for all flows ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ success: false, error: 'Unauthorized' }, 401);

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return json({ success: false, error: 'Invalid token' }, 401);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // === Lookup settings_users record ===
    const { data: crmUser, error: crmErr } = await supabase
      .from('settings_users')
      .select('id')
      .eq('auth_user_id', user.id)
      .eq('active', true)
      .single();
    if (crmErr || !crmUser) return json({ success: false, error: 'Usuário não encontrado' }, 403);

    // === Zoom credentials from bi_settings (AC6 — no Deno.env fallback) ===
    const { data: biSettings } = await supabase
      .from('bi_settings')
      .select('zoom_client_id, zoom_client_secret, zoom_account_id')
      .limit(1)
      .maybeSingle();

    const clientId     = biSettings?.zoom_client_id     ?? '';
    const clientSecret = biSettings?.zoom_client_secret ?? '';

    if (!clientId || !clientSecret) {
      return json({
        success: false,
        error:   'Zoom Client ID / Secret não configurados. Acesse Configurações → Integrações → Zoom.',
      }, 400);
    }

    // Redirect URI = this function's own URL
    const redirectUri = `${supabaseUrl.replace(/\/rest\/v1\/?$/, '')}/functions/v1/zoom-connect`;

    const url   = new URL(req.url);
    const code  = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const oauthError = url.searchParams.get('error');

    // ── FLOW A: Zoom returned an error ────────────────────────────────────────
    if (oauthError) {
      console.error('[zoom-connect] OAuth error from Zoom:', oauthError);
      return settingsRedirect({ error: oauthError });
    }

    // ── FLOW B: No code → initiate OAuth (redirect to Zoom) ──────────────────
    if (!code) {
      const stateParam = `single:${crmUser.id}`;
      const authUrl    = new URL(ZOOM_AUTH_URL);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('state', stateParam);
      return redirectTo(authUrl.toString());
    }

    // ── FLOW C: Callback — validate state + exchange code ────────────────────

    // AC5: Validate state against authenticated user — prevents CSRF
    if (!state) return json({ success: false, error: 'Missing state parameter' }, 403);
    const [, stateUserId] = state.split(':');
    if (stateUserId !== crmUser.id) {
      console.error('[zoom-connect] state user mismatch', { expected: crmUser.id, got: stateUserId });
      return json({ success: false, error: 'State mismatch — possível CSRF' }, 403);
    }

    // Exchange code → tokens (Basic auth with client_id:client_secret per Zoom spec)
    const basicCreds = btoa(`${clientId}:${clientSecret}`);
    const tokenRes   = await fetch(ZOOM_TOKEN_URL, {
      method:  'POST',
      headers: {
        Authorization:  `Basic ${basicCreds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type:   'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = await tokenRes.json() as Record<string, unknown>;

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[zoom-connect] token exchange failed:', tokenData);
      const errCode = String(tokenData.reason ?? tokenData.error ?? 'token_exchange_failed');
      return settingsRedirect({ error: errCode });
    }

    const accessToken:  string = tokenData.access_token as string;
    const refreshToken: string = tokenData.refresh_token as string;
    const expiresIn             = (tokenData.expires_in as number) || 3600;
    const expiresAt             = new Date(Date.now() + expiresIn * 1000).toISOString();

    if (!refreshToken) {
      return settingsRedirect({ error: 'no_refresh_token' });
    }

    // Fetch Zoom user profile
    const profileRes = await fetch(ZOOM_PROFILE_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = await profileRes.json() as Record<string, unknown>;

    if (!profileRes.ok || !profile.email) {
      console.error('[zoom-connect] profile fetch failed:', profile);
      return settingsRedirect({ error: 'profile_fetch_failed' });
    }

    const zoomEmail:  string = profile.email  as string;
    const zoomUserId: string = (profile.id ?? '') as string;

    // UPSERT user_calendar_connections — provider='zoom', clear other provider tokens
    const { error: upsertErr } = await supabase
      .from('user_calendar_connections')
      .upsert({
        user_id:               crmUser.id,
        provider:              'zoom',
        is_active:             true,
        zoom_access_token:     accessToken,
        zoom_refresh_token:    refreshToken,
        zoom_token_expires_at: expiresAt,
        zoom_user_id:          zoomUserId,
        zoom_email:            zoomEmail,
        zoom_account_id:       biSettings?.zoom_account_id ?? null,
        // Clear other provider columns
        google_email:              null,
        google_access_token:       null,
        google_refresh_token:      null,
        google_token_expires_at:   null,
        ms_access_token:           null,
        ms_refresh_token:          null,
        ms_token_expires_at:       null,
        ms_user_id:                null,
        ms_email:                  null,
        updated_at:                new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (upsertErr) {
      console.error('[zoom-connect] upsert error:', upsertErr);
      return settingsRedirect({ error: 'db_error' });
    }

    console.log(`✅ zoom-connect: ${zoomEmail} connected for user ${crmUser.id}`);
    return settingsRedirect({ connected: 'true' });

  } catch (err) {
    console.error('[zoom-connect] unexpected error:', err);
    return json({ success: false, error: (err as Error)?.message ?? 'Internal server error' }, 500);
  }
});
