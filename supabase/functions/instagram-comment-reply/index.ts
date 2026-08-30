/**
 * Instagram Comment Reply — Reply to Instagram post comments via Meta Graph API
 *
 * ⚠️  DEPLOY: always use --no-verify-jwt
 *     supabase functions deploy instagram-comment-reply --no-verify-jwt
 *
 * Called when a user replies to an Instagram comment from the OMNI inbox.
 *
 * Body: { people_id, message_ids: number[], messages: string[], ig_comment_ids: string[] }
 *   ig_comment_ids[i] is the IG comment ID to reply to for message_ids[i]
 * Returns: { sent, failed, results }
 *
 * Meta Graph API endpoint:
 *   POST /{ig-comment-id}/replies
 *   Authorization: Bearer {access_token}
 *   Body: { message: string }
 *
 * Env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   INSTAGRAM_ACCESS_TOKEN (fallback when omni_channel_configs is not set)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';

const META_GRAPH_API = 'https://graph.facebook.com/v25.0';
const META_GRAPH_FB_API = 'https://graph.facebook.com/v25.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InstagramCredentials {
  access_token?: string;
  instagram_business_id?: string;
  page_id?: string;
}

interface CommentReplyRequest {
  people_id: string;
  message_ids: number[];
  messages: string[];
  ig_comment_ids: string[];
  /** When true, sends a private DM to the commenter via POST /{comment_id}/private_replies
   *  instead of a public comment reply via POST /{comment_id}/replies.
   *  private_replies uses graph.facebook.com and does NOT require the recipient's IGSID. */
  is_private?: boolean;
}

interface ReplyResult {
  message_id: number;
  success: boolean;
  ig_message_id?: string;
  error?: string;
}

// ── Fetch Instagram config ────────────────────────────────────────────────────

interface ResolvedConfig {
  accessToken: string;
  pageId: string;
  businessId: string;
}

async function getInstagramConfig(
  supabase: ReturnType<typeof createClient>,
  log: ReturnType<typeof createLogger>,
): Promise<ResolvedConfig | null> {
  const { data } = await supabase
    .from('omni_channel_configs')
    .select('credentials, is_active')
    .eq('channel', 'instagram')
    .single();

  const dbCreds = (data?.credentials ?? {}) as InstagramCredentials;
  const accessToken = dbCreds.access_token || Deno.env.get('INSTAGRAM_ACCESS_TOKEN') || '';

  if (!accessToken) {
    log.error('ig_comment_reply_no_token', {});
    return null;
  }

  log.info('ig_comment_reply_config_loaded', { source: dbCreds.access_token ? 'db' : 'env' });
  return {
    accessToken,
    pageId: dbCreds.page_id || Deno.env.get('INSTAGRAM_PAGE_ID') || '',
    businessId: dbCreds.instagram_business_id || Deno.env.get('INSTAGRAM_BUSINESS_ID') || '',
  };
}

/**
 * Exchanges a System User / IG access token for a Page Access Token.
 * Required by the Messenger Platform /{page-id}/messages endpoint used for private replies.
 */
async function getPageAccessToken(
  pageId: string,
  systemToken: string,
  log: ReturnType<typeof createLogger>,
): Promise<string | null> {
  try {
    const resp = await fetch(
      `${META_GRAPH_FB_API}/${pageId}?fields=access_token&access_token=${systemToken}`,
    );
    const data = await resp.json() as Record<string, unknown>;
    if (!resp.ok || data.error) {
      log.warn('ig_page_token_failed', { page_id: pageId, error: (data.error as Record<string, unknown>)?.message });
      return null;
    }
    return (data.access_token as string) ?? null;
  } catch (e) {
    log.warn('ig_page_token_exception', { error: String(e) });
    return null;
  }
}

// ── Reply to a single comment ─────────────────────────────────────────────────

async function replyToComment(
  igCommentId: string,
  text: string,
  config: ResolvedConfig,
  privateSender: { senderId: string; token: string } | null,
  log: ReturnType<typeof createLogger>,
  isPrivate = false,
): Promise<{ success: boolean; ig_message_id?: string; error?: string }> {
  const logKey = isPrivate ? 'ig_private_reply' : 'ig_comment_reply';

  try {
    // Public reply: POST graph.facebook.com/{comment_id}/replies (raw access token)
    //   → visible publicly on the post.
    // Private reply: POST graph.facebook.com/{page_id}/messages with recipient:{comment_id}
    //   → sends a DM to the commenter WITHOUT requiring their IGSID or a prior messaging
    //     window. Requires a Page Access Token. This mirrors the proven automation path.
    //     The legacy /{comment_id}/private_replies endpoint returns code 100/subcode 33
    //     ("object does not exist / missing permissions") for this app, so it is NOT used.
    const url = isPrivate
      ? `${META_GRAPH_FB_API}/${privateSender!.senderId}/messages`
      : `${META_GRAPH_API}/${igCommentId}/replies`;
    const token = isPrivate ? privateSender!.token : config.accessToken;
    const payload = isPrivate
      ? { recipient: { comment_id: igCommentId }, message: { text }, messaging_type: 'RESPONSE' }
      : { message: text };

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await resp.json() as Record<string, unknown>;

    if (!resp.ok) {
      const errObj = result.error as Record<string, unknown> | undefined;
      const errSubcode = errObj?.error_subcode as number | undefined;
      // 2534023: this comment already received a (private) reply — one DM per comment via comment_id.
      if (errSubcode === 2534023) {
        log.warn(`${logKey}_already_replied`, { ig_comment_id: igCommentId });
        return { success: false, error: 'Este comentário já recebeu uma resposta privada. Só é possível enviar uma DM por comentário; aguarde o cliente responder na DM para abrir a janela de mensagens.' };
      }
      const errMsg = (errObj?.message as string) ?? JSON.stringify(result);
      log.error(`${logKey}_failed`, {
        status: resp.status,
        error: errMsg,
        ig_comment_id: igCommentId,
        is_private: isPrivate,
      });
      return { success: false, error: `Meta ${resp.status}: ${errMsg}` };
    }

    // /replies returns { id }; /messages returns { recipient_id, message_id }
    const igMessageId = (result.message_id ?? result.id) as string | undefined;
    log.info(`${logKey}_sent`, { ig_message_id: igMessageId, ig_comment_id: igCommentId, is_private: isPrivate });
    return { success: true, ig_message_id: igMessageId };
  } catch (e) {
    const errMsg = String(e);
    log.error(`${logKey}_exception`, { error: errMsg, ig_comment_id: igCommentId, is_private: isPrivate });
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
  const log = createLogger('instagram-comment-reply');
  const t0 = Date.now();

  try {
    const body = await req.json() as CommentReplyRequest;
    const { people_id, message_ids, messages, ig_comment_ids, is_private = false } = body;

    if (
      !people_id ||
      !message_ids?.length ||
      !messages?.length ||
      !ig_comment_ids?.length
    ) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: people_id, message_ids, messages, ig_comment_ids' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (message_ids.length !== messages.length || message_ids.length !== ig_comment_ids.length) {
      return new Response(
        JSON.stringify({ error: 'message_ids, messages, and ig_comment_ids must have the same length' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── Load Instagram config ──────────────────────────────────────────────
    const config = await getInstagramConfig(supabase, log);
    if (!config) {
      return new Response(
        JSON.stringify({ error: 'Instagram not configured — missing access_token' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Private replies go through the Messenger Platform /{page-id}/messages endpoint,
    // which requires a Page Access Token. Exchange it once for the whole batch.
    let privateSender: { senderId: string; token: string } | null = null;
    if (is_private) {
      const pageToken = config.pageId ? await getPageAccessToken(config.pageId, config.accessToken, log) : null;
      // Prefer page_id + page token; fall back to business_id + raw token if exchange fails.
      privateSender = pageToken && config.pageId
        ? { senderId: config.pageId, token: pageToken }
        : { senderId: config.businessId || config.pageId, token: config.accessToken };
      log.info('ig_private_reply_sender', { sender_id: privateSender.senderId, using_page_token: !!pageToken });
    }

    log.info('ig_comment_reply_start', { people_id, count: message_ids.length, is_private });

    // ── Reply to each comment sequentially ────────────────────────────────
    const results: ReplyResult[] = [];
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < message_ids.length; i++) {
      const msgId = message_ids[i];
      const text = messages[i] ?? '';
      const igCommentId = ig_comment_ids[i] ?? '';

      if (!text.trim()) {
        results.push({ message_id: msgId, success: false, error: 'Empty message content' });
        failedCount++;
        await supabase
          .from('messages')
          .update({ status: 'error', metadata: { error_reason: 'Empty message content' } })
          .eq('id', msgId);
        continue;
      }

      if (!igCommentId) {
        results.push({ message_id: msgId, success: false, error: 'Missing ig_comment_id' });
        failedCount++;
        await supabase
          .from('messages')
          .update({ status: 'error', metadata: { error_reason: 'Missing ig_comment_id' } })
          .eq('id', msgId);
        continue;
      }

      const result = await replyToComment(igCommentId, text, config, privateSender, log, is_private);

      results.push({ message_id: msgId, ...result });

      if (result.success) {
        sentCount++;
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
    log.info('ig_comment_reply_done', { people_id, is_private, ...summary, elapsed_ms: log.elapsed(t0) });

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const errMsg = (err as Error).message;
    log.error('unhandled', { error: errMsg, elapsed_ms: log.elapsed(t0) });
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
