/**
 * BI PRO™ — Google Ads Sync Edge Function
 * BIPRO-2.3
 *
 * Fetches campaign-level daily spend from Google Ads API (REST v17)
 * and upserts into bi_ad_spend table.
 *
 * POST body:
 *   { ad_account_id: string, date_from: string, date_to: string }
 *   date_from/date_to format: "YYYY-MM-DD"
 *
 * NOTE: All business-logic errors return HTTP 200 with { success: false, error: '...' }
 * so the Supabase Functions client can always read the error body.
 * Only auth failures (no/invalid JWT) return 401.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_ADS_API_VERSION = 'v20';
const GOOGLE_ADS_BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;

interface SyncRequest {
  ad_account_id: string;
  date_from: string;
  date_to: string;
}

/** Extract a readable message from a Google API error response body */
function parseGoogleError(raw: string, httpStatus: number): string {
  try {
    let parsed = JSON.parse(raw);
    // searchStream wraps errors in an array: [{ error: { ... } }]
    if (Array.isArray(parsed)) parsed = parsed[0];
    const errObj = parsed?.error;
    if (!errObj) return `Google Ads API error ${httpStatus}: ${raw.slice(0, 400)}`;

    const topMsg = errObj.message ?? errObj.status ?? '';

    // Extract detailed error code from GoogleAdsFailure
    const adsErrors: Array<{ errorCode?: Record<string, string>; message?: string }> =
      errObj.details?.[0]?.errors ?? [];
    const detailParts = adsErrors.map(e => {
      const code = e.errorCode ? Object.entries(e.errorCode).map(([k, v]) => `${k}: ${v}`).join(', ') : '';
      return [code, e.message].filter(Boolean).join(' — ');
    });

    const detail = detailParts.join(' | ');
    return `Google Ads API ${httpStatus}: ${topMsg}${detail ? ` [${detail}]` : ''}`;
  } catch { /* not JSON */ }
  return `Google Ads API error ${httpStatus}: ${raw.slice(0, 400)}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    // === READ CREDENTIALS FROM DB ===
    const { data: biSettings } = await supabase
      .from('bi_settings')
      .select('google_client_id, google_client_secret, google_developer_token')
      .maybeSingle();

    const GOOGLE_CLIENT_ID     = biSettings?.google_client_id     ?? Deno.env.get('GOOGLE_CLIENT_ID')           ?? '';
    const GOOGLE_CLIENT_SECRET = biSettings?.google_client_secret ?? Deno.env.get('GOOGLE_CLIENT_SECRET')       ?? '';
    const developerToken       = biSettings?.google_developer_token ?? Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN') ?? '';

    if (!developerToken) {
      return json({
        success: false,
        error: 'Developer Token não configurado. Acesse Configurações → Ads → Google Ads e cole o token disponível em https://ads.google.com/aw/apicenter',
      });
    }

    // === VALIDATE INPUT ===
    let body: SyncRequest;
    try {
      body = await req.json();
    } catch {
      return json({ success: false, error: 'Invalid request body' });
    }
    const { ad_account_id, date_from, date_to } = body;

    if (!ad_account_id || !date_from || !date_to) {
      return json({ success: false, error: 'Missing required fields: ad_account_id, date_from, date_to' });
    }

    // === FETCH AD ACCOUNT ===
    const { data: account, error: accountError } = await supabase
      .from('bi_ad_accounts')
      .select('id, account_id, access_token, refresh_token, token_expires_at, platform')
      .eq('id', ad_account_id)
      .eq('platform', 'google')
      .single();

    if (accountError || !account) {
      return json({ success: false, error: 'Conta Google Ads não encontrada.' });
    }

    if (!account.access_token) {
      return json({ success: false, error: 'Token de acesso não configurado. Reconecte a conta via OAuth.' });
    }

    // === PERMISSION CHECK ===
    const { data: userRecord } = await supabase
      .from('settings_users')
      .select('super_admin, user_type')
      .eq('auth_user_id', user.id)
      .eq('active', true)
      .single();

    const isAdmin = userRecord?.super_admin === true || userRecord?.user_type === 'admin';
    const isManager = userRecord?.user_type === 'manager';
    if (!userRecord || (!isAdmin && !isManager)) {
      return json({ success: false, error: 'Permissão insuficiente. Requer perfil admin ou manager.' });
    }

    // === REFRESH TOKEN IF NEEDED ===
    let accessToken = account.access_token;

    const isExpired = account.token_expires_at
      ? new Date(account.token_expires_at) <= new Date()
      : false;

    if (isExpired && account.refresh_token) {
      console.log('🔄 Refreshing expired Google token...');
      const refreshed = await refreshGoogleToken(account.refresh_token, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
      if (refreshed.error) {
        return json({
          success: false,
          error: `Falha ao renovar token: ${refreshed.error_description ?? refreshed.error}. Reconecte a conta.`,
        });
      }
      if (refreshed.access_token) {
        accessToken = refreshed.access_token;
        await supabase
          .from('bi_ad_accounts')
          .update({
            access_token: refreshed.access_token,
            token_expires_at: new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000).toISOString(),
          })
          .eq('id', ad_account_id);
      }
    }

    // === GOOGLE ADS QUERY (GAQL) ===
    // Customer ID: strip dashes → "123-456-7890" → "1234567890"
    const customerId = account.account_id.replace(/-/g, '');

    if (!customerId || !/^\d+$/.test(customerId)) {
      return json({ success: false, error: `Customer ID inválido: "${account.account_id}". Deve conter apenas dígitos.` });
    }

    const gaqlQuery = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        segments.date,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks
      FROM campaign
      WHERE segments.date BETWEEN '${date_from}' AND '${date_to}'
        AND campaign.status != 'REMOVED'
      ORDER BY segments.date DESC
    `;

    console.log(`📊 Google Ads query: customer=${customerId}, ${date_from} → ${date_to}`);

    // Build request headers — login-customer-id is only required when the
    // authenticated user accesses via a Manager Account (MCC). Sending it
    // set to the same customer ID works for direct-access accounts too,
    // but we omit it here to let Google resolve the correct hierarchy.
    const googleHeaders: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': developerToken,
      'Content-Type': 'application/json',
    };

    const googleResponse = await fetch(
      `${GOOGLE_ADS_BASE}/customers/${customerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: googleHeaders,
        body: JSON.stringify({ query: gaqlQuery }),
      }
    );

    if (!googleResponse.ok) {
      const errorText = await googleResponse.text();
      const humanError = parseGoogleError(errorText, googleResponse.status);
      console.error('Google Ads API error:', humanError, '\nRaw:', errorText);
      return json({ success: false, error: humanError });
    }

    // searchStream returns newline-delimited JSON
    const responseText = await googleResponse.text();
    const rows: Array<{
      campaignId: string;
      campaignName: string;
      date: string;
      spend: number;
      impressions: number;
      clicks: number;
    }> = [];

    for (const line of responseText.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === '[' || trimmed === ']') continue;
      try {
        const parsed = JSON.parse(trimmed.replace(/^,/, ''));
        for (const r of (parsed.results ?? [])) {
          rows.push({
            campaignId:   r.campaign?.id   ?? '',
            campaignName: r.campaign?.name ?? '',
            date:         r.segments?.date ?? '',
            spend:        parseInt(r.metrics?.cost_micros  ?? '0') / 1_000_000,
            impressions:  parseInt(r.metrics?.impressions  ?? '0'),
            clicks:       parseInt(r.metrics?.clicks       ?? '0'),
          });
        }
      } catch {
        // skip malformed lines
      }
    }

    console.log(`✅ Received ${rows.length} rows from Google Ads`);

    if (rows.length === 0) {
      await supabase
        .from('bi_ad_accounts')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', ad_account_id);

      return json({ success: true, synced: 0, message: 'Nenhum dado para o período selecionado.' });
    }

    // === UPSERT CAMPAIGNS ===
    const campaignMap = new Map<string, string>();
    const uniqueCampaigns = [...new Map(rows.map(r => [r.campaignId, r])).values()];

    /** Derive utm_campaign slug from campaign name for lead attribution matching */
    const toUtmSlug = (name: string): string =>
      name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    for (const row of uniqueCampaigns) {
      // Check if campaign already has a manually-set utm_campaign (don't overwrite)
      const { data: existing } = await supabase
        .from('bi_ad_campaigns')
        .select('utm_campaign')
        .eq('platform', 'google')
        .eq('campaign_id', row.campaignId)
        .maybeSingle();

      const utmCampaign = existing?.utm_campaign || toUtmSlug(row.campaignName);

      const { data: campaign } = await supabase
        .from('bi_ad_campaigns')
        .upsert({
          ad_account_id: account.id,
          platform: 'google',
          campaign_id: row.campaignId,
          campaign_name: row.campaignName,
          utm_campaign: utmCampaign,
          status: 'active',
        }, { onConflict: 'platform,campaign_id' })
        .select('id')
        .single();

      if (campaign) campaignMap.set(row.campaignId, campaign.id);
    }

    // === UPSERT SPEND ===
    const spendRows = rows.map(row => ({
      ad_account_id: account.id,
      campaign_id:   campaignMap.get(row.campaignId) ?? null,
      platform:      'google' as const,
      date:          row.date,
      spend:         row.spend,
      impressions:   row.impressions,
      clicks:        row.clicks,
      source:        'api',
      raw_data:      row,
    }));

    const { error: spendError } = await supabase
      .from('bi_ad_spend')
      .upsert(spendRows, { onConflict: 'campaign_id,date', ignoreDuplicates: false });

    if (spendError) {
      console.error('Supabase upsert error:', spendError);
      return json({ success: false, error: `Erro ao salvar dados: ${spendError.message}` });
    }

    await supabase
      .from('bi_ad_accounts')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', ad_account_id);

    const totalSpend = spendRows.reduce((sum, r) => sum + r.spend, 0);
    console.log(`✅ Synced ${spendRows.length} Google Ads records. Total: R$ ${totalSpend.toFixed(2)}`);

    return json({
      success: true,
      synced: spendRows.length,
      total_spend: totalSpend,
      campaigns: campaignMap.size,
      period: { from: date_from, to: date_to },
    });

  } catch (err) {
    console.error('Unexpected error:', err);
    return json({ success: false, error: `Erro inesperado: ${String(err)}` });
  }
});

async function refreshGoogleToken(refreshToken: string, clientId: string, clientSecret: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
      client_id:     clientId,
      client_secret: clientSecret,
    }),
  });
  return res.json();
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
