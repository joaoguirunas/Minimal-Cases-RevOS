/**
 * Cal.com — OAuth Connect (PKCE)
 *
 * POST /calcom-connect  — requires user JWT
 * Body: { code: string, redirect_uri: string, code_verifier: string }
 *
 * Flow:
 * 1. Verify Supabase JWT → settings_users.id (crmUserId)
 * 2. Exchange authorization_code → tokens (PKCE, no client_secret)
 * 3. GET /v2/me → username
 * 4. GET /v2/event-types → pick first active event type for the default booking url
 * 5. Register a webhook on Cal.com (best-effort — connection survives a failure)
 * 6. UPSERT user_calcom_connections (onConflict: user_id)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveCalcomClientId } from '../_shared/calcom-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CALCOM_TOKEN_URL = 'https://api.cal.com/v2/auth/oauth2/token';
const CALCOM_ME_URL = 'https://api.cal.com/v2/me';
const CALCOM_EVENT_TYPES_URL = 'https://api.cal.com/v2/event-types';
const CALCOM_WEBHOOKS_URL = 'https://api.cal.com/v2/webhooks';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return json(null, 200);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  try {
    // === AUTH ===
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

    // === Parse body ===
    const { code, redirect_uri, code_verifier } = await req.json() as {
      code: string;
      redirect_uri: string;
      code_verifier: string;
    };
    if (!code || !redirect_uri || !code_verifier) {
      return json({ success: false, error: 'Missing code, redirect_uri or code_verifier' }, 400);
    }

    const clientId = await resolveCalcomClientId(supabase);

    // === STEP 1: Exchange code → tokens (PKCE) ===
    const tokenRes = await fetch(CALCOM_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        code,
        redirect_uri,
        code_verifier,
      }),
    });
    const tokenData = await tokenRes.json().catch(() => ({}));

    if (!tokenRes.ok || tokenData.error || !tokenData.access_token) {
      console.error('Cal.com token exchange error:', tokenData);
      let errorMsg: string;
      if (tokenData.error === 'invalid_grant') {
        errorMsg = 'Código de autorização expirado. Tente novamente.';
      } else if (tokenData.error === 'invalid_client') {
        errorMsg = 'Client ID inválido.';
      } else {
        errorMsg = `Cal.com OAuth error: ${tokenData.error_description ?? tokenData.error ?? 'Token exchange failed'}`;
      }
      return json({ success: false, error: errorMsg }, 502);
    }

    const accessToken: string = tokenData.access_token;
    const refreshToken: string | null = tokenData.refresh_token ?? null;
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    // === STEP 2: Fetch username from /me ===
    const meRes = await fetch(CALCOM_ME_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const meJson = await meRes.json().catch(() => ({}));
    if (!meRes.ok) {
      console.error('Cal.com /me error:', meJson);
      return json({ success: false, error: 'Não foi possível obter o perfil Cal.com.' }, 502);
    }
    const username: string = meJson?.data?.username ?? meJson?.username ?? '';
    if (!username) {
      return json({ success: false, error: 'Não foi possível obter o username Cal.com.' }, 502);
    }

    // === STEP 3: Pick the first active event type ===
    let defaultEventTypeId: number | null = null;
    let defaultEventTypeSlug: string | null = null;
    let defaultBookingUrl: string | null = null;
    try {
      const etRes = await fetch(CALCOM_EVENT_TYPES_URL, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'cal-api-version': '2024-06-14',
        },
      });
      const etJson = await etRes.json().catch(() => ({}));
      const list: Array<{ id: number; slug?: string; hidden?: boolean }> =
        etJson?.data?.eventTypes ?? etJson?.data ?? [];
      const et = Array.isArray(list) ? list.find((e) => !e.hidden && e.slug) : undefined;
      if (et) {
        defaultEventTypeId = et.id;
        defaultEventTypeSlug = et.slug ?? null;
        defaultBookingUrl = `https://cal.com/${username}/${et.slug}`;
      }
    } catch (err) {
      console.warn('Cal.com event-types fetch failed (non-fatal):', (err as Error).message);
    }

    // === STEP 4: Register webhook (best-effort) ===
    const webhookSecret = crypto.randomUUID();
    let webhookId: string | null = null;
    try {
      const whRes = await fetch(CALCOM_WEBHOOKS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'cal-api-version': '2024-06-14',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriberUrl: `${supabaseUrl}/functions/v1/calcom-webhook`,
          triggers: ['BOOKING_CREATED', 'BOOKING_RESCHEDULED', 'BOOKING_CANCELLED', 'BOOKING_NO_SHOW_UPDATED'],
          active: true,
          secret: webhookSecret,
        }),
      });
      const whJson = await whRes.json().catch(() => ({}));
      if (whRes.ok) {
        const id = whJson?.data?.id ?? whJson?.id;
        webhookId = id != null ? String(id) : null;
      } else {
        console.warn('Cal.com webhook register failed (non-fatal):', whJson);
      }
    } catch (err) {
      console.warn('Cal.com webhook register threw (non-fatal):', (err as Error).message);
    }

    // === STEP 5: Upsert connection ===
    const { error: upsertError } = await supabase
      .from('user_calcom_connections')
      .upsert({
        user_id: crmUser.id,
        calcom_username: username,
        calcom_access_token: accessToken,
        calcom_refresh_token: refreshToken,
        calcom_token_expires_at: expiresAt,
        default_event_type_id: defaultEventTypeId,
        default_event_type_slug: defaultEventTypeSlug,
        default_booking_url: defaultBookingUrl,
        webhook_id: webhookId,
        webhook_secret: webhookSecret,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (upsertError) {
      console.error('Upsert error:', upsertError);
      return json({ success: false, error: 'Erro ao salvar conexão: ' + upsertError.message }, 500);
    }

    console.log(`✅ calcom-connect: ${username} connected for user ${crmUser.id} (webhook=${webhookId ?? 'none'})`);
    return json({ success: true, username, default_booking_url: defaultBookingUrl });

  } catch (err) {
    console.error('Unexpected error:', err);
    return json({ success: false, error: 'Erro interno ao conectar Cal.com.' }, 500);
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
