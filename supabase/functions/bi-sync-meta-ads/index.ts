/**
 * BI PRO™ — Meta Ads Sync Edge Function
 * BIPRO-2.2
 *
 * Fetches campaign-level daily spend from Meta Marketing API and upserts into:
 *   - bi_ad_campaigns   (campaign metadata)
 *   - bi_ad_spend       (raw daily spend rows)
 *   - bi_ad_daily_stats (aggregated daily stats per campaign)
 *
 * POST body:
 *   { ad_account_id: string, date_from: string, date_to: string }
 *   date_from/date_to format: "YYYY-MM-DD"
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const META_API_VERSION = 'v19.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

interface SyncRequest {
  ad_account_id: string;  // UUID do bi_ad_accounts
  date_from: string;       // YYYY-MM-DD
  date_to: string;         // YYYY-MM-DD
}

interface MetaInsightRow {
  campaign_id: string;
  campaign_name: string;
  date_start: string;
  date_stop: string;
  spend: string;
  impressions: string;
  clicks: string;
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

    // Verify user JWT
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return json({ success: false, error: 'Invalid token' }, 401);
    }

    // Use service role for DB operations (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // === VALIDATE INPUT ===
    const body: SyncRequest = await req.json();
    const { ad_account_id, date_from, date_to } = body;

    if (!ad_account_id || !date_from || !date_to) {
      return json({ success: false, error: 'Missing required fields: ad_account_id, date_from, date_to' }, 400);
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date_from) || !dateRegex.test(date_to)) {
      return json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD' }, 400);
    }

    // === FETCH AD ACCOUNT ===
    const { data: account, error: accountError } = await supabase
      .from('bi_ad_accounts')
      .select('id, account_id, access_token, platform')
      .eq('id', ad_account_id)
      .eq('platform', 'meta')
      .single();

    if (accountError || !account) {
      return json({ success: false, error: 'Ad account not found' }, 404);
    }

    if (!account.access_token) {
      return json({ success: false, error: 'No access token configured for this account' }, 400);
    }

    // Verify user has manager permission
    const { data: userRecord } = await supabase
      .from('settings_users')
      .select('super_admin, user_type')
      .eq('auth_user_id', user.id)
      .eq('active', true)
      .single();

    const isAdmin = userRecord?.super_admin === true || userRecord?.user_type === 'admin';
    const isManager = userRecord?.user_type === 'manager';
    if (!userRecord || (!isAdmin && !isManager)) {
      return json({ success: false, error: 'Requires admin or manager permission' }, 403);
    }

    // === FETCH META ADS INSIGHTS ===
    const metaAccountId = account.account_id.startsWith('act_')
      ? account.account_id
      : `act_${account.account_id}`;

    const insightsUrl = new URL(`${META_API_BASE}/${metaAccountId}/insights`);
    insightsUrl.searchParams.set('fields', 'campaign_id,campaign_name,spend,impressions,clicks,date_start,date_stop');
    insightsUrl.searchParams.set('time_range', JSON.stringify({ since: date_from, until: date_to }));
    insightsUrl.searchParams.set('time_increment', '1');
    insightsUrl.searchParams.set('level', 'campaign');
    insightsUrl.searchParams.set('access_token', account.access_token);
    insightsUrl.searchParams.set('limit', '500');

    console.log(`📊 Fetching Meta Ads insights for account ${metaAccountId}, period ${date_from} → ${date_to}`);

    const metaResponse = await fetch(insightsUrl.toString());
    const metaData = await metaResponse.json();

    if (!metaResponse.ok || metaData.error) {
      console.error('Meta API error:', metaData.error);
      return json({
        success: false,
        error: `Meta API error: ${metaData.error?.message ?? 'Unknown error'}`,
        code: metaData.error?.code,
      }, 502);
    }

    const insights: MetaInsightRow[] = metaData.data ?? [];
    console.log(`✅ Received ${insights.length} Meta insight rows`);

    if (insights.length === 0) {
      await supabase
        .from('bi_ad_accounts')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', ad_account_id);
      return json({ success: true, synced: 0, message: 'No data for this period' });
    }

    // === 1. UPSERT CAMPAIGNS ===
    // campaignMap: Meta campaign_id (string) → bi_ad_campaigns.id (UUID)
    const campaignMap = new Map<string, string>();

    /** Derive utm_campaign slug from campaign name for lead attribution matching */
    const toUtmSlug = (name: string): string =>
      name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    const uniqueCampaigns = [...new Map(insights.map(r => [r.campaign_id, r])).values()];

    for (const row of uniqueCampaigns) {
      // Check if campaign already has a manually-set utm_campaign (don't overwrite)
      const { data: existing } = await supabase
        .from('bi_ad_campaigns')
        .select('utm_campaign')
        .eq('platform', 'meta')
        .eq('campaign_id', row.campaign_id)
        .maybeSingle();

      const utmCampaign = existing?.utm_campaign || toUtmSlug(row.campaign_name);

      const { data: campaign, error: campError } = await supabase
        .from('bi_ad_campaigns')
        .upsert({
          account_id: account.id,       // NOT NULL FK → bi_ad_accounts.id
          ad_account_id: account.id,
          platform: 'meta',
          campaign_id: row.campaign_id,
          campaign_name: row.campaign_name,
          utm_campaign: utmCampaign,
          status: 'active',
          synced_at: new Date().toISOString(),
        }, { onConflict: 'platform,campaign_id' })
        .select('id')
        .single();

      if (campError) {
        console.error(`Campaign upsert failed for ${row.campaign_id}:`, campError.message, campError.details);
      } else if (campaign) {
        campaignMap.set(row.campaign_id, campaign.id);
        console.log(`✅ Campaign upserted: ${row.campaign_name} → ${campaign.id}`);
      }
    }

    console.log(`📋 Campaigns mapped: ${campaignMap.size}/${uniqueCampaigns.length}`);

    // === 2. UPSERT RAW SPEND RECORDS ===
    const spendRows = insights.map(row => ({
      ad_account_id: account.id,
      campaign_id: campaignMap.get(row.campaign_id) ?? null,
      platform: 'meta' as const,
      date: row.date_start,
      spend: parseFloat(row.spend) || 0,
      impressions: parseInt(row.impressions) || 0,
      clicks: parseInt(row.clicks) || 0,
      source: 'api',
      raw_data: row,
    }));

    const { error: spendError } = await supabase
      .from('bi_ad_spend')
      .upsert(spendRows, { onConflict: 'campaign_id,date', ignoreDuplicates: false });

    if (spendError) {
      console.error('Spend upsert error:', spendError);
      return json({ success: false, error: `Failed to save spend data: ${spendError.message}` }, 500);
    }

    // === 3. UPSERT bi_ad_daily_stats (only for mapped campaigns) ===
    const dailyStatsRows = insights
      .filter(row => campaignMap.has(row.campaign_id))
      .map(row => ({
        campaign_id: campaignMap.get(row.campaign_id)!,
        stat_date: row.date_start,
        spend: parseFloat(row.spend) || 0,
        impressions: parseInt(row.impressions) || 0,
        clicks: parseInt(row.clicks) || 0,
        conversions: 0,
        revenue: 0,
        synced_at: new Date().toISOString(),
      }));

    if (dailyStatsRows.length > 0) {
      const { error: statsError } = await supabase
        .from('bi_ad_daily_stats')
        .upsert(dailyStatsRows, { onConflict: 'campaign_id,stat_date', ignoreDuplicates: false });

      if (statsError) {
        console.error('Daily stats upsert error:', statsError);
        // Non-fatal: log but don't fail the whole sync
      } else {
        console.log(`✅ Upserted ${dailyStatsRows.length} daily stats rows`);
      }
    }

    // === 4. UPDATE last_sync_at ===
    await supabase
      .from('bi_ad_accounts')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', ad_account_id);

    const totalSpend = spendRows.reduce((sum, r) => sum + r.spend, 0);
    console.log(`✅ Sync complete: ${spendRows.length} spend rows, R$ ${totalSpend.toFixed(2)}, ${campaignMap.size} campaigns`);

    return json({
      success: true,
      synced: spendRows.length,
      total_spend: totalSpend,
      campaigns: campaignMap.size,
      daily_stats: dailyStatsRows.length,
      period: { from: date_from, to: date_to },
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
