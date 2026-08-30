/**
 * TIKTOK MANYCHAT OUTBOUND — Send TikTok DMs via the ManyChat API
 *
 * ⚠️  DEPLOY: always use --no-verify-jwt
 *     supabase functions deploy tiktok-manychat-outbound --no-verify-jwt
 *
 * Called by omni-delivery-engine for channel='tiktok-manychat' messages.
 *
 * Body: { people_id, message_ids, messages: string[] }
 * Returns: { success, sent, failed, results }
 *
 * ManyChat sendContent endpoint:
 *   POST https://api.manychat.com/fb/sending/sendContent
 *   Authorization: Bearer {user_id}:{token}   ← the WHOLE key incl. the ':' goes literal
 *   Content-Type: application/json
 *   {
 *     "subscriber_id": 123456789,
 *     "data": { "version": "v2", "content": { "messages": [{ "type": "text", "text": "..." }] } }
 *   }
 *
 * Env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';

const MANYCHAT_SEND_URL = 'https://api.manychat.com/fb/sending/sendContent';
const CHANNEL = 'tiktok-manychat';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OutboundRequest {
  people_id: string;
  message_ids: number[];
  messages: string[];
}

interface SendResult {
  message_id: number;
  success: boolean;
  external_id?: string;
  error?: string;
}

async function sendManyChatMessage(
  subscriberId: string,
  text: string,
  apiKey: string,
  log: ReturnType<typeof createLogger>,
): Promise<{ success: boolean; external_id?: string; error?: string }> {
  const payload = {
    subscriber_id: Number(subscriberId),
    data: {
      version: 'v2',
      content: {
        messages: [{ type: 'text', text }],
      },
    },
  };

  try {
    const resp = await fetch(MANYCHAT_SEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await resp.json().catch(() => ({})) as Record<string, unknown>;

    if (!resp.ok || result.status !== 'success') {
      const errMsg = (result.message as string)
        ?? (result.error as string)
        ?? JSON.stringify(result);
      log.error('manychat_send_failed', { status: resp.status, error: errMsg, subscriber_id: subscriberId });
      return { success: false, error: `ManyChat ${resp.status}: ${errMsg}` };
    }

    const data = (result.data ?? {}) as Record<string, unknown>;
    const externalId = (data.message_id ?? data.id) as string | undefined;
    log.info('manychat_sent', { subscriber_id: subscriberId, external_id: externalId });
    return { success: true, external_id: externalId };
  } catch (e) {
    const errMsg = String(e);
    log.error('manychat_fetch_exception', { error: errMsg, subscriber_id: subscriberId });
    return { success: false, error: errMsg };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl    = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const log = createLogger('tiktok-manychat-outbound');

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

    // ── Resolve recipient subscriber_id ──────────────────────────────────────
    const { data: person } = await supabase
      .from('clients_people')
      .select('id, manychat_subscriber_id')
      .eq('id', people_id)
      .single() as unknown as { data: { id: string; manychat_subscriber_id: number | string | null } | null };

    const subscriberId = person?.manychat_subscriber_id != null
      ? String(person.manychat_subscriber_id)
      : '';

    if (!subscriberId) {
      log.error('manychat_no_subscriber_id', { people_id });
      return new Response(
        JSON.stringify({ error: 'Person has no manychat_subscriber_id' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Resolve API key ──────────────────────────────────────────────────────
    const { data: cfg } = await supabase
      .from('omni_channel_configs')
      .select('credentials, is_active')
      .eq('channel', CHANNEL)
      .maybeSingle() as unknown as { data: { credentials: Record<string, string>; is_active: boolean } | null };

    const apiKey = cfg?.credentials?.api_key ?? '';
    if (!apiKey) {
      log.error('manychat_config_missing', { people_id });
      return new Response(
        JSON.stringify({ error: 'ManyChat not configured (credentials.api_key missing)' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Send sequentially (ManyChat sendContent ~25 req/s) ───────────────────
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

      const result = await sendManyChatMessage(subscriberId, text, apiKey, log);
      results.push({ message_id: msgId, ...result });

      if (result.success) {
        sentCount++;
        await supabase
          .from('messages')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', msgId);
      } else {
        failedCount++;
        await supabase
          .from('messages')
          .update({ status: 'error', metadata: { error_reason: result.error } })
          .eq('id', msgId);
      }
    }

    const summary = { success: failedCount === 0, sent: sentCount, failed: failedCount, results };
    log.info('done', { people_id, sent: sentCount, failed: failedCount });

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
