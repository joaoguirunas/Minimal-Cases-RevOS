/**
 * Instagram Outbound — Send DMs via Meta Graph API
 *
 * ⚠️  DEPLOY: always use --no-verify-jwt
 *     supabase functions deploy instagram-outbound --no-verify-jwt
 *
 * Called by omni-delivery-engine for channel='instagram' messages.
 *
 * Body: { people_id, message_ids, messages: string[] }
 * Returns: { sent, failed, results }
 *
 * Instagram Graph API endpoint (Instagram API with Instagram Login):
 *   POST https://graph.instagram.com/v25.0/{ig-business-id}/messages
 *   Authorization: Bearer {instagram_user_access_token}
 *   Permission required: instagram_business_manage_messages
 *
 * NOTE: This uses graph.instagram.com (NOT graph.facebook.com).
 * The token must be an Instagram User Access Token (IGA, starts with IGAFq...).
 * EAA tokens (Facebook Page Access Tokens) do NOT work here.
 *
 * Instagram 7-day messaging window: only allowed to send if recipient
 * has messaged within the last 7 days (handled at OMNI UI level via useCanSendMessage).
 *
 * Env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';

const META_GRAPH_FB = 'https://graph.facebook.com/v25.0';
// Instagram API with Instagram Login (IGA tokens starting with IGAFq) requires graph.instagram.com
const META_GRAPH_IG = 'https://graph.instagram.com/v25.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InstagramCredentials {
  instagram_business_id?: string;
  access_token?: string;
  page_id?: string;
}

interface OutboundRequest {
  people_id: string;
  message_ids: number[];
  messages: string[];  // plain text content for each message
}

interface SendResult {
  message_id: number;
  success: boolean;
  ig_message_id?: string;
  error?: string;
}

// ── Fetch Instagram config ────────────────────────────────────────────────────

/**
 * Resolves the real Instagram Business Account ID (IGBID) from the Facebook Page ID.
 * The manually configured instagram_business_id may be wrong — this is authoritative.
 * GET /{page-id}?fields=instagram_business_account → { instagram_business_account: { id } }
 */
async function resolveIgbid(pageId: string, accessToken: string): Promise<string | null> {
  try {
    const resp = await fetch(
      `${META_GRAPH_FB}/${pageId}?fields=instagram_business_account&access_token=${accessToken}`,
    );
    if (!resp.ok) return null;
    const data = await resp.json() as { instagram_business_account?: { id: string } };
    return data?.instagram_business_account?.id ?? null;
  } catch {
    return null;
  }
}

/** IGA tokens (Instagram API with Instagram Login) start with IGAFq and require graph.instagram.com */
function isIgaToken(token: string): boolean {
  return token.startsWith('IGAF') || token.startsWith('IGQVJx') || token.startsWith('IGQVJt');
}

async function getInstagramConfig(
  supabase: ReturnType<typeof createClient>,
  log: ReturnType<typeof createLogger>,
  igbid?: string,
): Promise<InstagramCredentials | null> {
  const { data } = await supabase
    .from('omni_channel_configs')
    .select('credentials, is_active')
    .eq('channel', 'instagram')
    .single();

  const dbCreds = (data?.credentials ?? {}) as Record<string, unknown>;
  const pageId = (dbCreds.page_id as string) || Deno.env.get('INSTAGRAM_PAGE_ID') || '';

  // Multi-account: if igbid is provided and exists in accounts map, use that token
  const accounts = (dbCreds.accounts ?? {}) as Record<string, { access_token: string }>;
  if (igbid && accounts[igbid]?.access_token) {
    log.info('ig_using_account_token', { igbid, source: 'accounts_map' });
    return { access_token: accounts[igbid].access_token, instagram_business_id: igbid, page_id: pageId || undefined };
  }

  // Fall back to primary configured account
  const accessToken = (dbCreds.access_token as string) || Deno.env.get('INSTAGRAM_ACCESS_TOKEN') || '';
  const businessId  = (dbCreds.instagram_business_id as string) || Deno.env.get('INSTAGRAM_BUSINESS_ID') || '';

  if (!accessToken || !businessId) return null;

  log.info('ig_using_sender_id', { business_id: businessId, igbid_requested: igbid });
  return { access_token: accessToken, instagram_business_id: businessId, page_id: pageId || undefined };
}

// ── Exchange System User Token for Page Access Token ─────────────────────────

async function getPageAccessToken(
  pageId: string,
  systemToken: string,
  log: ReturnType<typeof createLogger>,
): Promise<string | null> {
  // IGA tokens cannot exchange for page tokens — skip this step for them
  if (isIgaToken(systemToken)) {
    log.info('ig_page_token_skip_iga', { page_id: pageId, reason: 'IGA token does not support page token exchange' });
    return null;
  }
  try {
    const resp = await fetch(
      `${META_GRAPH_FB}/${pageId}?fields=access_token&access_token=${systemToken}`,
    );
    const data = await resp.json() as Record<string, unknown>;
    if (!resp.ok || data.error) {
      log.warn('ig_page_token_failed', { page_id: pageId, error: (data.error as Record<string, unknown>)?.message });
      return null;
    }
    const token = data.access_token as string | undefined;
    log.info('ig_page_token_ok', { page_id: pageId, has_token: !!token });
    return token ?? null;
  } catch (e) {
    log.warn('ig_page_token_exception', { error: String(e) });
    return null;
  }
}

// ── Send single DM ────────────────────────────────────────────────────────────

async function sendInstagramDM(
  recipientIgsid: string,
  text: string,
  igBusinessId: string,
  accessToken: string,
  log: ReturnType<typeof createLogger>,
  pageId?: string,
): Promise<{ success: boolean; ig_message_id?: string; error?: string }> {
  const payload = {
    recipient: { id: recipientIgsid },
    message: { text },
    messaging_type: 'RESPONSE',
  };

  // IGA tokens (IGAFq...) must use graph.instagram.com directly.
  // EAA/Page tokens use Messenger Platform (graph.facebook.com) and require page token exchange.
  const tokenIsIga = isIgaToken(accessToken);
  const pageToken = (!tokenIsIga && pageId) ? await getPageAccessToken(pageId, accessToken, log) : null;

  // Build attempt list — order matters: first success wins.
  // IGA path: graph.instagram.com/{igBusinessId}/messages (no page token needed)
  // FB path:  graph.facebook.com/{pageId}/messages with page token (primary), then igbid fallback
  const attempts: Array<{ senderId: string; token: string; baseUrl: string }> = [];
  if (tokenIsIga && igBusinessId) {
    attempts.push({ senderId: igBusinessId, token: accessToken, baseUrl: META_GRAPH_IG });
  }
  if (!tokenIsIga && pageId && pageToken) attempts.push({ senderId: pageId, token: pageToken, baseUrl: META_GRAPH_FB });
  if (!tokenIsIga && igBusinessId) attempts.push({ senderId: igBusinessId, token: accessToken, baseUrl: META_GRAPH_FB });
  if (!tokenIsIga && pageId && !pageToken) attempts.push({ senderId: pageId, token: accessToken, baseUrl: META_GRAPH_FB });

  try {
    let lastError = '';
    for (const { senderId, token, baseUrl } of attempts) {
      const url = `${baseUrl}/${senderId}/messages`;
      log.info('ig_dm_attempt', { sender_id: senderId, recipient: recipientIgsid, base_url: baseUrl, using_page_token: token !== accessToken });

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await resp.json() as Record<string, unknown>;

      log.info('ig_dm_response', { status: resp.status, body: JSON.stringify(result), sender_id: senderId });

      if (!resp.ok || result.error) {
        const errMsg = (result.error as Record<string, unknown>)?.message as string
          ?? JSON.stringify(result);
        log.error('ig_send_failed', { status: resp.status, error: errMsg, sender_id: senderId, recipient_id: recipientIgsid });
        lastError = `Meta ${resp.status} (${senderId}): ${errMsg}`;
        continue; // try next endpoint
      }

      const igMessageId = (result.message_id ?? result.id) as string | undefined;
      if (!igMessageId) {
        log.error('ig_no_message_id', { body: JSON.stringify(result), sender_id: senderId });
        lastError = `Meta 200 sem message_id (${senderId}): ${JSON.stringify(result)}`;
        continue;
      }

      log.info('ig_sent', { ig_message_id: igMessageId, recipient_id: recipientIgsid, sender_id: senderId });
      return { success: true, ig_message_id: igMessageId };
    }
    return { success: false, error: lastError };
  } catch (e) {
    const errMsg = String(e);
    log.error('ig_fetch_exception', { error: errMsg, recipient_id: recipientIgsid });
    return { success: false, error: errMsg };
  }
}

// ── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const log = createLogger('instagram-outbound');

  try {
    const body = await req.json() as OutboundRequest;
    const { people_id, message_ids, messages } = body;

    if (!people_id || !message_ids?.length || !messages?.length) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── Get recipient's IGSID + which business account received their messages ─
    const { data: person } = await supabase
      .from('clients_people')
      .select('id, name, instagram_id, instagram_business_id')
      .eq('id', people_id)
      .single();

    // ── Load Instagram config (use account-specific token if available) ────
    const creds = await getInstagramConfig(supabase, log, person?.instagram_business_id ?? undefined);
    if (!creds?.instagram_business_id || !creds?.access_token) {
      log.error('ig_config_missing', { people_id });
      return new Response(
        JSON.stringify({ error: 'Instagram not configured or inactive' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!person?.instagram_id) {
      log.error('ig_no_igsid', { people_id });
      return new Response(
        JSON.stringify({ error: 'Person has no instagram_id (IGSID)' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Send messages sequentially (Instagram rate limits: be conservative) ─
    const results: SendResult[] = [];
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < message_ids.length; i++) {
      const msgId = message_ids[i];
      const text = messages[i] ?? '';

      if (!text.trim()) {
        results.push({ message_id: msgId, success: false, error: 'Empty message content' });
        failedCount++;
        continue;
      }

      const result = await sendInstagramDM(
        person.instagram_id,
        text,
        creds.instagram_business_id,
        creds.access_token,
        log,
        creds.page_id,
      );

      results.push({ message_id: msgId, ...result });

      if (result.success) {
        sentCount++;
        // Update message record with ig_message_id and status
        await supabase
          .from('messages')
          .update({
            status: 'sent',
            ig_message_id: result.ig_message_id ?? null,
            sent_at: new Date().toISOString(),
          })
          .eq('id', msgId);
      } else {
        failedCount++;
        await supabase
          .from('messages')
          .update({ status: 'error', metadata: { error_reason: result.error } })
          .eq('id', msgId);
      }
    }

    const summary = { sent: sentCount, failed: failedCount, results };
    log.info('done', { people_id, ...summary });

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const errMsg = (err as Error).message;
    log.error('unhandled', { error: errMsg });
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
