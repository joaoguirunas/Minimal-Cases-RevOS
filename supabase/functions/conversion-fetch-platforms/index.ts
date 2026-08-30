/**
 * CONVERSION FETCH PLATFORMS
 *
 * Fetches available Meta Pixels and Google Conversion Actions
 * from existing connected ad accounts (bi_ad_accounts).
 *
 * GET /conversion-fetch-platforms?platform=meta
 * GET /conversion-fetch-platforms?platform=google
 * GET /conversion-fetch-platforms (both)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const META_GRAPH_URL = 'https://graph.facebook.com/v25.0';
const GOOGLE_ADS_URL = 'https://googleads.googleapis.com/v23';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Meta: Fetch pixels from connected ad accounts ─────────────────────────

interface MetaPixel {
  id: string;
  name: string;
  account_id: string;
  account_name: string;
}

async function fetchMetaPixels(
  accounts: Record<string, unknown>[],
): Promise<{ pixels: MetaPixel[]; errors: string[] }> {
  const pixels: MetaPixel[] = [];
  const errors: string[] = [];

  for (const account of accounts) {
    const accessToken = account.access_token as string;
    const accountId = account.account_id as string;
    const accountName = account.account_name as string;

    if (!accessToken) continue;

    try {
      // Fetch pixels associated with this ad account
      const actId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
      const resp = await fetch(
        `${META_GRAPH_URL}/${actId}/adspixels?fields=id,name&access_token=${accessToken}`,
      );

      if (!resp.ok) {
        const err = await resp.json();
        errors.push(`Meta ${accountName}: ${err.error?.message || resp.statusText}`);
        continue;
      }

      const data = await resp.json();
      for (const pixel of (data.data || [])) {
        pixels.push({
          id: pixel.id,
          name: pixel.name || `Pixel ${pixel.id}`,
          account_id: accountId,
          account_name: accountName,
        });
      }
    } catch (e) {
      errors.push(`Meta ${accountName}: ${String(e)}`);
    }
  }

  return { pixels, errors };
}

// ─── Google: Fetch conversion actions from connected accounts ───────────────

interface GoogleConversionAction {
  id: string;
  name: string;
  type: string;
  status: string;
  account_id: string;
  account_name: string;
  resource_name: string;
}

async function fetchGoogleConversionActions(
  accounts: Record<string, unknown>[],
  biSettings: Record<string, unknown> | null,
): Promise<{ actions: GoogleConversionAction[]; errors: string[] }> {
  const actions: GoogleConversionAction[] = [];
  const errors: string[] = [];

  const clientId = (biSettings?.google_client_id as string) || Deno.env.get('GOOGLE_ADS_CLIENT_ID');
  const clientSecret = (biSettings?.google_client_secret as string) || Deno.env.get('GOOGLE_ADS_CLIENT_SECRET');
  const developerToken = (biSettings?.google_developer_token as string) || Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN');

  if (!clientId || !clientSecret || !developerToken) {
    errors.push('Google OAuth credentials not configured in bi_settings');
    return { actions, errors };
  }

  for (const account of accounts) {
    const refreshToken = account.refresh_token as string;
    const accountId = (account.account_id as string).replace(/-/g, '');
    const accountName = account.account_name as string;

    if (!refreshToken) {
      errors.push(`Google ${accountName}: no refresh token`);
      continue;
    }

    try {
      // Refresh access token
      const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      if (!tokenResp.ok) {
        errors.push(`Google ${accountName}: token refresh failed`);
        continue;
      }

      const tokenData = await tokenResp.json();
      const accessToken = tokenData.access_token;

      // Fetch conversion actions via Google Ads API
      const query = `SELECT conversion_action.id, conversion_action.name, conversion_action.type, conversion_action.status, conversion_action.resource_name FROM conversion_action WHERE conversion_action.status = 'ENABLED' ORDER BY conversion_action.name`;

      const resp = await fetch(
        `${GOOGLE_ADS_URL}/customers/${accountId}/googleAds:searchStream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            'developer-token': developerToken,
          },
          body: JSON.stringify({ query }),
        },
      );

      if (!resp.ok) {
        const err = await resp.json();
        const errMsg = err.error?.message || err[0]?.error?.message || resp.statusText;
        errors.push(`Google ${accountName}: ${errMsg}`);
        continue;
      }

      const data = await resp.json();
      // searchStream returns an array of result batches
      for (const batch of (Array.isArray(data) ? data : [data])) {
        for (const result of (batch.results || [])) {
          const ca = result.conversionAction;
          if (!ca) continue;

          // Extract numeric ID from resource_name: "customers/123/conversionActions/456"
          const idMatch = ca.resourceName?.match(/conversionActions\/(\d+)/);
          actions.push({
            id: idMatch ? idMatch[1] : ca.id?.toString() || '',
            name: ca.name || `Action ${ca.id}`,
            type: ca.type || 'UNKNOWN',
            status: ca.status || 'ENABLED',
            account_id: accountId,
            account_name: accountName,
            resource_name: ca.resourceName || '',
          });
        }
      }
    } catch (e) {
      errors.push(`Google ${accountName}: ${String(e)}`);
    }
  }

  return { actions, errors };
}

// ─── Main Handler ───────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Validate user auth
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Use service role for reading tokens
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const url = new URL(req.url);
  const platform = url.searchParams.get('platform'); // 'meta', 'google', or null (both)

  try {
    const result: Record<string, unknown> = {};

    if (!platform || platform === 'meta') {
      // Fetch Meta ad accounts with tokens (service role bypasses RLS column restrictions)
      const { data: metaAccounts } = await supabase
        .from('bi_ad_accounts')
        .select('account_id, account_name, access_token')
        .eq('platform', 'meta')
        .eq('is_active', true);

      const metaResult = await fetchMetaPixels(metaAccounts || []);
      result.meta = metaResult;
    }

    if (!platform || platform === 'google') {
      // Fetch Google ad accounts with tokens
      const { data: googleAccounts } = await supabase
        .from('bi_ad_accounts')
        .select('account_id, account_name, access_token, refresh_token')
        .eq('platform', 'google')
        .eq('is_active', true);

      // Fetch bi_settings for developer token
      const { data: biSettings } = await supabase
        .from('bi_settings')
        .select('google_client_id, google_client_secret, google_developer_token')
        .eq('singleton', true)
        .single();

      const googleResult = await fetchGoogleConversionActions(googleAccounts || [], biSettings);
      result.google = googleResult;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
