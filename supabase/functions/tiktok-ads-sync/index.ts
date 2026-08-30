/**
 * BI PRO™ — TikTok Ads Sync Edge Function
 *
 * Fetches campaign-level daily spend from TikTok Ads Business API (v1.3)
 * and upserts into bi_tiktok_ad_spend table.
 *
 * POST body (optional):
 *   { date_from?: string, date_to?: string }   // YYYY-MM-DD; defaults to last 30 days
 *
 * Called by:
 *   - TikTokAdsConfig.tsx handleSyncNow() — manual sync
 *   - pg_cron (every 6h) — automatic sync
 *
 * Token storage: bi_settings (singleton row)
 *   - tiktok_access_token, tiktok_refresh_token, tiktok_token_expires_at
 *   - tiktok_app_id, tiktok_app_secret
 *   - tiktok_ad_account_ids (array of advertiser IDs to sync)
 *
 * Business API base: https://business-api.tiktok.com/open_api/v1.3/
 * (different from OMNI which uses open.tiktokapis.com)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TIKTOK_BUSINESS_API = 'https://business-api.tiktok.com/open_api/v1.3';
const TIKTOK_TOKEN_API    = 'https://business-api.tiktok.com/open_api/v1.3/oauth2/refresh_token/';

// Refresh if token expires within 4h
const REFRESH_THRESHOLD_MS = 4 * 3600 * 1000;

interface BiSettings {
  tiktok_access_token:    string | null;
  tiktok_refresh_token:   string | null;
  tiktok_token_expires_at: string | null;
  tiktok_app_id:          string | null;
  tiktok_app_secret:      string | null;
  tiktok_numeric_app_id:  string | null;
  tiktok_ad_account_ids:  string[] | null;
}

interface TikTokRefreshResponse {
  code: number;
  message: string;
  data?: {
    access_token: string;
    access_token_expire_in: number;  // seconds
    refresh_token: string;
    refresh_token_expire_in: number;
  };
}

interface TikTokReportRow {
  advertiser_id: string;
  metrics: {
    spend: string;
    impressions: string;
    clicks: string;
    cpc: string;
    cpm: string;
    ctr: string;
    conversion: string;
  };
  dimensions: {
    stat_time_day: string;  // "YYYY-MM-DD HH:MM:SS"
    campaign_id?: string;
    campaign_name?: string;
    adgroup_id?: string;
    adgroup_name?: string;
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function refreshTikTokAdsToken(
  refreshToken: string,
  appId: string,
  appSecret: string,
): Promise<{ access_token: string; expires_at: string; refresh_token: string } | null> {
  const res = await fetch(TIKTOK_TOKEN_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: appId,
      secret: appSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    console.error('[tiktok-ads-sync] Token refresh HTTP error:', res.status, raw);
    return null;
  }

  const data = JSON.parse(raw) as TikTokRefreshResponse;
  if (data.code !== 0 || !data.data?.access_token) {
    console.error('[tiktok-ads-sync] Token refresh API error:', data.message);
    return null;
  }

  const expiresAt = new Date(Date.now() + data.data.access_token_expire_in * 1000).toISOString();
  return {
    access_token:  data.data.access_token,
    expires_at:    expiresAt,
    refresh_token: data.data.refresh_token,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  const supabaseUrl    = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // Auth — accept either user JWT (manual sync) or service_role bearer (pg_cron)
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return json({ success: false, error: 'Unauthorized' }, 401);
  }

  const bearer = authHeader.slice(7);
  // Accept service role key directly (pg_cron path) or verify user JWT
  if (bearer !== serviceRoleKey) {
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return json({ success: false, error: 'Invalid token' }, 401);
    }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Read optional date range from body
    let dateFrom: string | null = null;
    let dateTo: string | null   = null;
    try {
      const body = await req.json() as { date_from?: string; date_to?: string };
      dateFrom = body.date_from ?? null;
      dateTo   = body.date_to   ?? null;
    } catch { /* no body is fine */ }

    // Default: last 30 days
    const now    = new Date();
    const toDate  = dateTo   ? new Date(dateTo)   : now;
    const fromDate = dateFrom ? new Date(dateFrom) : new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
    const syncFrom = fmtDate(fromDate);
    const syncTo   = fmtDate(toDate);

    // Read bi_settings
    const { data: settings, error: settingsErr } = await supabase
      .from('bi_settings')
      .select('tiktok_access_token, tiktok_refresh_token, tiktok_token_expires_at, tiktok_app_id, tiktok_app_secret, tiktok_numeric_app_id, tiktok_ad_account_ids')
      .eq('singleton', true)
      .maybeSingle();

    if (settingsErr) {
      return json({ success: false, error: `Erro lendo bi_settings: ${settingsErr.message}` });
    }

    const s = settings as BiSettings | null;

    if (!s?.tiktok_access_token) {
      return json({
        success: false,
        error: 'TikTok Ads não conectado. Configure o OAuth em Configurações → Ads → TikTok Ads.',
      });
    }

    const advertiserIds = s.tiktok_ad_account_ids ?? [];
    if (advertiserIds.length === 0) {
      return json({
        success: false,
        error: 'Nenhuma conta de anúncio TikTok configurada. Conecte via OAuth primeiro.',
      });
    }

    // Refresh token if near expiry
    let accessToken = s.tiktok_access_token;
    const expiresAt = s.tiktok_token_expires_at ? new Date(s.tiktok_token_expires_at) : null;
    const needsRefresh = !expiresAt || (expiresAt.getTime() - Date.now()) < REFRESH_THRESHOLD_MS;

    if (needsRefresh && s.tiktok_refresh_token) {
      const appId     = s.tiktok_numeric_app_id ?? s.tiktok_app_id ?? Deno.env.get('TIKTOK_BUSINESS_APP_ID') ?? '';
      const appSecret = s.tiktok_app_secret ?? Deno.env.get('TIKTOK_APP_SECRET') ?? '';

      if (appId && appSecret) {
        console.log('[tiktok-ads-sync] Refreshing TikTok Ads token...');
        const refreshed = await refreshTikTokAdsToken(s.tiktok_refresh_token, appId, appSecret);
        if (refreshed) {
          accessToken = refreshed.access_token;
          await supabase
            .from('bi_settings')
            .update({
              tiktok_access_token:     refreshed.access_token,
              tiktok_refresh_token:    refreshed.refresh_token,
              tiktok_token_expires_at: refreshed.expires_at,
            })
            .eq('singleton', true);
          console.log('[tiktok-ads-sync] Token refreshed, expires:', refreshed.expires_at);
        } else {
          console.warn('[tiktok-ads-sync] Token refresh failed, proceeding with existing token');
        }
      }
    }

    // Fetch report for each advertiser
    let totalSynced = 0;
    const errors: string[] = [];

    for (const advertiserId of advertiserIds) {
      try {
        const reportUrl = new URL(`${TIKTOK_BUSINESS_API}/report/integrated/get/`);

        const reportBody = {
          advertiser_id: advertiserId,
          report_type: 'BASIC',
          data_level: 'AUCTION_ADGROUP',
          dimensions: ['campaign_id', 'adgroup_id', 'stat_time_day'],
          metrics: ['spend', 'impressions', 'clicks', 'cpc', 'cpm', 'ctr', 'conversion'],
          start_date: syncFrom,
          end_date: syncTo,
          page: 1,
          page_size: 1000,
        };

        console.log(`[tiktok-ads-sync] Fetching report for advertiser ${advertiserId}: ${syncFrom} → ${syncTo}`);

        const reportRes = await fetch(reportUrl.toString(), {
          method: 'POST',
          headers: {
            'Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(reportBody),
        });

        const reportRaw = await reportRes.text();
        if (!reportRes.ok) {
          console.error(`[tiktok-ads-sync] HTTP ${reportRes.status} for advertiser ${advertiserId}:`, reportRaw);
          errors.push(`Advertiser ${advertiserId}: HTTP ${reportRes.status}`);
          continue;
        }

        const reportData = JSON.parse(reportRaw) as {
          code: number;
          message: string;
          data?: {
            list: TikTokReportRow[];
            page_info?: { total_number: number };
          };
        };

        if (reportData.code !== 0) {
          // Token expired (code 40001 / 40005)
          if (reportData.code === 40001 || reportData.code === 40005) {
            errors.push(`Token TikTok expirado — reconecte a conta em Configurações → Ads → TikTok Ads.`);
            break;
          }
          console.error(`[tiktok-ads-sync] API error for advertiser ${advertiserId}:`, reportData.message);
          errors.push(`Advertiser ${advertiserId}: ${reportData.message}`);
          continue;
        }

        const rows = reportData.data?.list ?? [];
        console.log(`[tiktok-ads-sync] Received ${rows.length} rows for advertiser ${advertiserId}`);

        if (rows.length === 0) continue;

        // Fetch campaign/adgroup name mapping (best-effort)
        const campaignNames = new Map<string, string>();
        const adgroupNames  = new Map<string, string>();
        try {
          const campaignRes = await fetch(`${TIKTOK_BUSINESS_API}/campaign/get/`, {
            method: 'POST',
            headers: { 'Access-Token': accessToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              advertiser_id: advertiserId,
              fields: ['campaign_id', 'campaign_name'],
              page_size: 1000,
            }),
          });
          const campaignData = await campaignRes.json() as {
            code: number;
            data?: { list: Array<{ campaign_id: string; campaign_name: string }> };
          };
          if (campaignData.code === 0) {
            for (const c of campaignData.data?.list ?? []) {
              campaignNames.set(c.campaign_id, c.campaign_name);
            }
          }
        } catch { /* non-fatal */ }

        // Upsert rows into bi_tiktok_ad_spend
        const upsertRows = rows.map((r) => {
          const dateStr = r.dimensions.stat_time_day?.slice(0, 10) ?? syncFrom;
          return {
            advertiser_id:    advertiserId,
            advertiser_name:  null as string | null,
            campaign_id:      r.dimensions.campaign_id ?? null,
            campaign_name:    r.dimensions.campaign_id
              ? (campaignNames.get(r.dimensions.campaign_id) ?? null)
              : null,
            adgroup_id:       r.dimensions.adgroup_id ?? null,
            adgroup_name:     r.dimensions.adgroup_id
              ? (adgroupNames.get(r.dimensions.adgroup_id) ?? null)
              : null,
            date:             dateStr,
            spend:            parseFloat(r.metrics.spend)       || 0,
            impressions:      parseInt(r.metrics.impressions)   || 0,
            clicks:           parseInt(r.metrics.clicks)        || 0,
            cpc:              parseFloat(r.metrics.cpc)         || 0,
            cpm:              parseFloat(r.metrics.cpm)         || 0,
            ctr:              parseFloat(r.metrics.ctr)         || 0,
            conversions:      parseInt(r.metrics.conversion)    || 0,
          };
        });

        const { error: upsertErr } = await supabase
          .from('bi_tiktok_ad_spend')
          .upsert(upsertRows, {
            onConflict: 'advertiser_id,date,campaign_id,adgroup_id',
            ignoreDuplicates: false,
          });

        if (upsertErr) {
          console.error(`[tiktok-ads-sync] Upsert error for advertiser ${advertiserId}:`, upsertErr);
          errors.push(`Advertiser ${advertiserId} upsert: ${upsertErr.message}`);
          continue;
        }

        totalSynced += upsertRows.length;
        console.log(`[tiktok-ads-sync] Upserted ${upsertRows.length} rows for advertiser ${advertiserId}`);
      } catch (err) {
        errors.push(`Advertiser ${advertiserId}: ${(err as Error).message}`);
      }
    }

    // Update last sync timestamp in bi_settings
    await supabase
      .from('bi_settings')
      .update({ updated_at: new Date().toISOString() } as Parameters<typeof supabase.from<'bi_settings', typeof supabase>['update']>[0])
      .eq('singleton', true)
      .catch(() => {/* non-fatal */});

    if (errors.length > 0 && totalSynced === 0) {
      return json({ success: false, error: errors.join('; '), synced: 0 });
    }

    return json({
      success: true,
      synced: totalSynced,
      advertisers: advertiserIds.length,
      period: { from: syncFrom, to: syncTo },
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (err) {
    console.error('[tiktok-ads-sync] Unexpected error:', err);
    return json({ success: false, error: `Erro inesperado: ${(err as Error).message}` }, 500);
  }
});
