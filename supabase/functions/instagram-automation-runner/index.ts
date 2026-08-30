/**
 * instagram-automation-runner
 *
 * ManyChat-style automation engine for Instagram.
 * Called fire-and-forget from meta-inbound after each message/comment.
 *
 * POST body: AutomationTrigger
 * Returns: { ok: boolean, processed: number }
 *
 * DEPLOY: supabase functions deploy instagram-automation-runner --no-verify-jwt
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export interface AutomationTrigger {
  trigger_type: 'incoming_dm' | 'post_comment' | 'story_mention' | 'story_reply';
  person_id: string;
  person_name: string;
  ig_message_id: string;
  message_text: string;
  comment_id?: string;         // for reply_comment action
  post_id?: string;            // Instagram post ID — only for post_comment triggers
  ig_user_id: string;          // IGSID — needed to send DM back
  instagram_business_id: string;
}

interface AutomationFilter {
  type: 'always' | 'is_first_contact' | 'message_contains' | 'message_not_contains';
  value?: string;
}

interface InstagramAutomation {
  id: string;
  name: string;
  is_active: boolean;
  trigger_type: string;
  filter_operator: 'any' | 'all';
  filters: AutomationFilter[];
  action_type: 'send_dm' | 'reply_comment' | 'reply_and_dm';
  action_dm_text: string | null;
  action_dm_quick_replies: { title: string }[] | null;
  action_comment_text: string | null;
  action_comment_texts: string[] | null;
  cooldown_hours: number;
  priority: number;
  target_post_id: string | null;
}

// ── Exchange System User Token for Page Access Token ─────────────────────────

async function getPageAccessToken(pageId: string, systemToken: string): Promise<string | null> {
  try {
    const resp = await fetch(
      `https://graph.facebook.com/v25.0/${pageId}?fields=access_token&access_token=${systemToken}`,
    );
    const data = await resp.json() as Record<string, unknown>;
    if (!resp.ok || data.error) return null;
    return (data.access_token as string) ?? null;
  } catch {
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let ctx: AutomationTrigger;
  try {
    ctx = await req.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  try {
    // Load active automations for this trigger type, priority order
    const { data: automations } = await supabase
      .from('instagram_automations')
      .select('*')
      .eq('is_active', true)
      .eq('trigger_type', ctx.trigger_type)
      .order('priority', { ascending: true });

    if (!automations?.length) {
      return ok(0);
    }

    // Filter by target_post_id: null = all posts, value = specific post only
    const filtered = (automations as InstagramAutomation[]).filter(a =>
      !a.target_post_id || a.target_post_id === (ctx.post_id ?? ''),
    );

    if (!filtered.length) {
      return ok(0);
    }

    // ── Atomic per-comment claim ────────────────────────────────────────────
    // A comment can match several automations and Meta re-delivers the webhook
    // on slow ACK. Both lead to multiple replies for one comment. Claim the
    // comment once (unique partial index on ig_message_id WHERE trigger='post_comment')
    // so exactly one runner invocation — and exactly one automation — acts on it.
    let claimLogId: string | null = null;
    if (ctx.comment_id) {
      // Plain INSERT so PostgreSQL correctly targets the partial unique index
      // (WHERE trigger_type='post_comment'). An upsert with onConflict:'ig_message_id'
      // generates ON CONFLICT (ig_message_id) without the WHERE clause, which
      // PostgreSQL rejects because no non-partial constraint exists on that column.
      const { data: claimed, error: claimErr } = await supabase
        .from('instagram_automation_log')
        .insert({
          trigger_type: ctx.trigger_type,
          person_id: ctx.person_id,
          person_name: ctx.person_name || null,
          ig_message_id: ctx.comment_id,
          message_text: (ctx.message_text ?? '').slice(0, 500),
          status: 'skipped',
          error_message: 'processing',
        })
        .select('id')
        .maybeSingle();

      if (claimErr) {
        // 23505 = unique_violation: another runner already claimed this comment
        if ((claimErr as { code?: string }).code === '23505') {
          console.log(`[automation] comment already claimed, skipping comment_id=${ctx.comment_id}`);
          return ok(0);
        }
        console.error(`[automation] comment claim failed: ${claimErr.message} comment_id=${ctx.comment_id}`);
        return ok(0);
      }
      if (!claimed) {
        console.log(`[automation] comment already claimed, skipping comment_id=${ctx.comment_id}`);
        return ok(0);
      }
      claimLogId = claimed.id as string;
    }

    let processed = 0;

    for (const automation of filtered) {
      // ── 1. Check cooldown ────────────────────────────────────────────────
      if (automation.cooldown_hours > 0) {
        const since = new Date(Date.now() - automation.cooldown_hours * 3_600_000).toISOString();
        const { count } = await supabase
          .from('instagram_automation_log')
          .select('id', { count: 'exact', head: true })
          .eq('automation_id', automation.id)
          .eq('person_id', ctx.person_id)
          .eq('status', 'success')
          .gte('executed_at', since);

        if ((count ?? 0) > 0) {
          await log(supabase, automation, ctx, 'cooldown', null, null);
          continue;
        }
      }

      // ── 2. Evaluate filters ──────────────────────────────────────────────
      const { passed, matched } = await evalFilters(
        automation.filters,
        automation.filter_operator,
        ctx,
        supabase,
      );

      if (!passed) {
        await log(supabase, automation, ctx, 'skipped', matched, null);
        continue;
      }

      // ── 3. Execute action ────────────────────────────────────────────────
      let status: 'success' | 'failed' | 'skipped' = 'success';
      let errMsg: string | null = null;
      let payload: Record<string, unknown> | null = null;

      try {
        payload = await executeAction(automation, ctx, supabase);
      } catch (e) {
        if (e instanceof SkippedError) {
          status = 'skipped';
          errMsg = e.message;
        } else {
          status = 'failed';
          errMsg = e instanceof Error ? e.message : String(e);
        }
      }

      if (claimLogId) {
        // Reuse the claim row as this winner's log entry (avoids a duplicate row).
        await supabase
          .from('instagram_automation_log')
          .update({
            automation_id: automation.id,
            automation_name: automation.name,
            action_executed: automation.action_type,
            filters_matched: matched,
            status,
            error_message: errMsg ?? null,
          })
          .eq('id', claimLogId);
        claimLogId = null; // consumed
      } else {
        await log(supabase, automation, ctx, status, matched, payload, errMsg);
      }
      if (status === 'success') processed++;

      // One automation per comment: this one passed filters and ran its action
      // (the comment is already claimed above), so stop — later automations must
      // not post a second public reply or hit Meta's one-DM-per-comment limit.
      if (ctx.comment_id) break;
    }

    // No automation matched this comment — finalize the claim sentinel so the
    // row no longer reads 'processing'. The comment stays claimed (idempotent).
    if (claimLogId) {
      await supabase
        .from('instagram_automation_log')
        .update({ error_message: 'no_automation_matched' })
        .eq('id', claimLogId);
    }

    return ok(processed);
  } catch (err) {
    console.error('[instagram-automation-runner] error:', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Thrown by executeAction when the operation should be recorded as 'skipped', not 'failed'. */
class SkippedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'SkippedError';
  }
}

function interpolate(text: string, personName: string): string {
  return text.replaceAll('{{nome}}', personName || '');
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function ok(processed: number): Response {
  return new Response(JSON.stringify({ ok: true, processed }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function evalFilters(
  filters: AutomationFilter[],
  operator: 'any' | 'all',
  ctx: AutomationTrigger,
  supabase: ReturnType<typeof createClient>,
): Promise<{ passed: boolean; matched: string[] }> {
  // No filters = always pass
  if (!filters.length) return { passed: true, matched: ['no_filters'] };

  const matched: string[] = [];
  const results: boolean[] = [];

  for (const f of filters) {
    let r = false;

    switch (f.type) {
      case 'always':
        r = true;
        break;

      case 'is_first_contact': {
        // Count previous messages from this person on Instagram (excluding current)
        const { count } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('people_id', ctx.person_id)
          .eq('channel', 'instagram')
          .eq('from_contact', 'cliente')
          .neq('ig_message_id', ctx.ig_message_id);
        r = (count ?? 0) === 0;
        break;
      }

      case 'message_contains': {
        const kws = (f.value ?? '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
        if (!kws.length) { r = true; break; }
        const msg = (ctx.message_text ?? '').toLowerCase();
        r = kws.some(k => msg.includes(k));
        break;
      }

      case 'message_not_contains': {
        const kws = (f.value ?? '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
        if (!kws.length) { r = true; break; }
        const msg = (ctx.message_text ?? '').toLowerCase();
        r = !kws.some(k => msg.includes(k));
        break;
      }
    }

    if (r) matched.push(f.type);
    results.push(r);
  }

  const passed = operator === 'any' ? results.some(Boolean) : results.every(Boolean);
  return { passed, matched };
}

async function executeAction(
  automation: InstagramAutomation,
  ctx: AutomationTrigger,
  supabase: ReturnType<typeof createClient>,
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  const errors: string[] = [];

  const isDM = automation.action_type === 'send_dm' || automation.action_type === 'reply_and_dm';
  const isComment = automation.action_type === 'reply_comment' || automation.action_type === 'reply_and_dm';

  // Fetch credentials once — shared by both DM and comment reply
  const { data: igCfg } = await supabase
    .from('omni_channel_configs')
    .select('credentials')
    .eq('channel', 'instagram')
    .single();
  const creds = ((igCfg?.credentials ?? {}) as Record<string, unknown>);

  // ── Reply to comment FIRST (must happen before DM for reply_and_dm) ────────
  // Comment reply uses the Instagram Comment API — it's visible publicly on the post.
  // We execute it first so the user sees both actions, even if DM fails.
  const commentOptions = (automation.action_comment_texts?.filter(t => t.trim())) ?? [];
  const resolvedCommentText = commentOptions.length
    ? interpolate(pickRandom(commentOptions), ctx.person_name)
    : automation.action_comment_text
      ? interpolate(automation.action_comment_text, ctx.person_name)
      : '';

  if (isComment && resolvedCommentText && ctx.comment_id) {
    try {
      const accessToken =
        (creds.access_token as string) ||
        Deno.env.get('INSTAGRAM_ACCESS_TOKEN') ||
        '';

      if (!accessToken) throw new Error('Instagram not configured — missing access_token');

      const r = await fetch(
        `https://graph.facebook.com/v25.0/${ctx.comment_id}/replies`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ message: resolvedCommentText }),
        },
      );
      result.comment_reply = { ok: r.ok, status: r.status };
      if (!r.ok) {
        const body = await r.text().catch(() => '');
        // Meta error_subcode 2534023: comment already has a reply — treat as skipped, not failed
        let errSubcode: number | undefined;
        try { errSubcode = (JSON.parse(body) as { error?: { error_subcode?: number } })?.error?.error_subcode; } catch { /* ignore */ }
        if (errSubcode === 2534023) {
          console.log(`[automation] comment already replied (2534023), skipping comment_id=${ctx.comment_id}`);
          throw new SkippedError('comment already has a reply (Meta 2534023)');
        }
        errors.push(`Comment reply failed (${r.status}): ${body}`);
        console.error(`[automation] comment reply failed: ${r.status} ${body}`);
      } else {
        // Record comment reply in messages table so it appears in OMNI PRO inbox
        const replyResp = await r.json().catch(() => ({})) as Record<string, unknown>;
        await supabase.from('messages').insert({
          channel: 'instagram',
          from_contact: 'sistema',
          source_type: 'campaign',
          content: resolvedCommentText,
          message_type: 'texto',
          instagram_interaction_type: 'comment',
          status: 'sent',
          people_id: ctx.person_id,
          ig_message_id: (replyResp.id as string) ?? null,
          sent_at: new Date().toISOString(),
          metadata: {
            automation_id: automation.id,
            automation_name: automation.name,
            parent_comment_id: ctx.comment_id,
            variations_count: commentOptions.length,
          },
        });
      }
    } catch (e) {
      if (e instanceof SkippedError) throw e; // preserve class — caught by loop, not treated as failure
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`comment_reply: ${msg}`);
      console.error(`[automation] comment reply exception: ${msg}`);
      result.comment_reply = { ok: false, error: msg };
    }
  }

  // ── Send DM — call Instagram Graph API directly ──────────────────────────────
  //
  // Routing logic:
  //   post_comment + comment_id  → POST /{business_id}/messages  recipient:{comment_id}  (no 24h window)
  //   all other cases            → POST /{business_id}/messages  recipient:{id}          (24h window required)
  //
  if (isDM && !automation.action_dm_text?.trim()) {
    const skipMsg = 'DM não enviado: action_dm_text está vazio. Edite a automação e preencha o texto do DM.';
    errors.push(skipMsg);
    console.error(`[automation] ${skipMsg} automation_id=${automation.id}`);
    result.dm = { ok: false, error: skipMsg };
  } else if (isDM && automation.action_dm_text) {
    try {
      // Multi-account: prefer token for the specific IGBID that received the message
      const accountsDm = (creds.accounts ?? {}) as Record<string, { access_token: string }>;
      const accessTokenDm =
        (ctx.instagram_business_id && accountsDm[ctx.instagram_business_id]?.access_token) ||
        (creds.access_token as string) ||
        Deno.env.get('INSTAGRAM_ACCESS_TOKEN') ||
        '';

      if (!accessTokenDm) throw new Error('Instagram not configured — missing access_token');

      const resolvedDmText = interpolate(automation.action_dm_text, ctx.person_name);

      // Resolve business ID upfront — needed for all DM paths
      const businessIdDm =
        ctx.instagram_business_id ||
        (creds.instagram_business_id as string) ||
        Deno.env.get('INSTAGRAM_BUSINESS_ID') ||
        '';

      if (!businessIdDm) throw new Error('Instagram not configured — missing instagram_business_id');

      // Exchange System User Token for Page Access Token (required by /messages endpoint)
      const pageIdDm = (creds.page_id as string) || Deno.env.get('INSTAGRAM_PAGE_ID') || '';
      const pageTokenDm = pageIdDm ? await getPageAccessToken(pageIdDm, accessTokenDm) : null;
      const dmToken = pageTokenDm ?? accessTokenDm;
      const dmSenderId = pageTokenDm ? pageIdDm : businessIdDm;

      // Determine recipient format: comment_id bypass (no 24h window) vs IGSID (24h window required)
      const useCommentRecipient = ctx.trigger_type === 'post_comment' && !!ctx.comment_id;

      if (useCommentRecipient) {
        // ── Instagram Messages API with comment_id recipient ─────────────────────────
        // Sends DM to commenter without requiring prior DM window (bypasses 24h restriction).
        // Endpoint: POST https://graph.facebook.com/v25.0/{business_id}/messages
        // recipient.comment_id: Instagram-native bypass — uses same token as comment replies.
        //
        // NOTE: The previous implementation used graph.facebook.com/v19.0/{comment_id}/private_replies
        // which requires a Facebook Page access token with pages_messaging permission — a different
        // token than the Instagram access token stored in omni_channel_configs. That endpoint
        // returned HTTP 200 silently (Facebook API pattern) without delivering the DM, causing
        // the automation log to record status='success' and trigger cooldown for all subsequent
        // comments by the same person. (JOB-040 root cause fix — 2026-04-15)
        console.log(`[automation] using messages API (comment_id recipient) for comment_id=${ctx.comment_id} person=${ctx.person_name}`);

        const dmMessageComment: Record<string, unknown> = { text: resolvedDmText };
        const quickRepliesComment = automation.action_dm_quick_replies?.filter(qr => qr.title.trim());
        if (quickRepliesComment?.length) {
          dmMessageComment.quick_replies = quickRepliesComment.map((qr, i) => ({
            content_type: 'text',
            title: qr.title.slice(0, 20),
            payload: `QR_${i + 1}`,
          }));
        }

        const r = await fetch(
          `https://graph.facebook.com/v25.0/${dmSenderId}/messages`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${dmToken}`,
            },
            body: JSON.stringify({
              recipient: { comment_id: ctx.comment_id },
              message: dmMessageComment,
              messaging_type: 'RESPONSE',
            }),
          },
        );
        result.dm = { ok: r.ok, status: r.status, endpoint: 'messages_comment_recipient', comment_id: ctx.comment_id };
        if (!r.ok) {
          const body = await r.text().catch(() => '');
          // Meta error_subcode 2534023: comment already has a reply — treat as skipped, not failed
          let errSubcode: number | undefined;
          try { errSubcode = (JSON.parse(body) as { error?: { error_subcode?: number } })?.error?.error_subcode; } catch { /* ignore */ }
          if (errSubcode === 2534023) {
            console.log(`[automation] DM comment recipient already replied (2534023), skipping comment_id=${ctx.comment_id}`);
            throw new SkippedError('comment already has a reply — DM skipped (Meta 2534023)');
          }
          errors.push(`DM (comment recipient) failed (${r.status}): ${body}`);
          console.error(`[automation] DM (comment recipient) failed: ${r.status} ${body}`);
        } else {
          const dmResp = await r.json().catch(() => ({})) as Record<string, unknown>;
          console.log(`[automation] DM comment_recipient response: ${JSON.stringify(dmResp)}`);
          const igMsgId = (dmResp.message_id as string) ?? null;
          const { error: dmInsertErr } = await supabase.from('messages').insert({
            channel: 'instagram',
            from_contact: 'sistema',
            source_type: 'campaign',
            content: resolvedDmText,
            message_type: 'texto',
            status: 'sent',
            people_id: ctx.person_id,
            ig_message_id: igMsgId,
            sent_at: new Date().toISOString(),
            metadata: {
              automation_id: automation.id,
              automation_name: automation.name,
              endpoint: 'messages_comment_recipient',
              parent_comment_id: ctx.comment_id,
              quick_replies: quickRepliesComment ?? [],
            },
          });
          if (dmInsertErr) {
            console.error(`[automation] DM DB insert failed: ${dmInsertErr.message} ig_message_id=${igMsgId}`);
          }
        }
      } else {
        // ── Messages API — requires user to have initiated DM (24h window) ──────────
        // Endpoint: POST https://graph.facebook.com/v25.0/{business_id}/messages
        console.log(`[automation] using messages API for ig_user_id=${ctx.ig_user_id} business_id=${businessIdDm}`);

        // Build message payload — include quick replies if configured
        const dmMessage: Record<string, unknown> = { text: resolvedDmText };
        const quickReplies = automation.action_dm_quick_replies?.filter(qr => qr.title.trim());
        if (quickReplies?.length) {
          dmMessage.quick_replies = quickReplies.map((qr, i) => ({
            content_type: 'text',
            title: qr.title.slice(0, 20),
            payload: `QR_${i + 1}`,
          }));
        }

        const r = await fetch(
          `https://graph.facebook.com/v25.0/${dmSenderId}/messages`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${dmToken}`,
            },
            body: JSON.stringify({
              recipient: { id: ctx.ig_user_id },
              message: dmMessage,
              messaging_type: 'RESPONSE',
            }),
          },
        );
        result.dm = { ok: r.ok, status: r.status, endpoint: 'messages', ig_user_id: ctx.ig_user_id };
        if (!r.ok) {
          const body = await r.text().catch(() => '');
          errors.push(`DM failed (${r.status}): ${body}`);
          console.error(`[automation] DM failed: ${r.status} ${body}`);
        } else {
          const dmResp = await r.json().catch(() => ({})) as Record<string, unknown>;
          const igMsgIdIgsid = (dmResp.message_id as string) ?? null;
          const { error: dmInsertErrIgsid } = await supabase.from('messages').insert({
            channel: 'instagram',
            from_contact: 'sistema',
            source_type: 'campaign',
            content: resolvedDmText,
            message_type: 'texto',
            status: 'sent',
            people_id: ctx.person_id,
            ig_message_id: igMsgIdIgsid,
            sent_at: new Date().toISOString(),
            metadata: {
              automation_id: automation.id,
              automation_name: automation.name,
              endpoint: 'messages',
              quick_replies: quickReplies ?? [],
            },
          });
          if (dmInsertErrIgsid) {
            console.error(`[automation] DM DB insert failed: ${dmInsertErrIgsid.message} ig_message_id=${igMsgIdIgsid}`);
          }
        }
      }
    } catch (e) {
      if (e instanceof SkippedError) throw e; // preserve class — caught by loop, not treated as failure
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`send_dm: ${msg}`);
      console.error(`[automation] DM exception: ${msg}`);
      result.dm = { ok: false, error: msg };
    }
  }

  // Throw if any DM error occurred (empty text, API failure, config missing)
  // A comment reply succeeding does not mask a DM failure for reply_and_dm automations.
  const dmOk = (result.dm as Record<string, unknown>)?.ok;
  const commentOk = (result.comment_reply as Record<string, unknown>)?.ok;
  const dmFailed = isDM && result.dm !== undefined && !dmOk;
  if (errors.length > 0 && (dmFailed || !commentOk)) {
    throw new Error(errors.join(' | '));
  }

  return result;
}

async function log(
  supabase: ReturnType<typeof createClient>,
  automation: InstagramAutomation,
  ctx: AutomationTrigger,
  status: 'success' | 'failed' | 'skipped' | 'cooldown',
  matched: string[] | null,
  payload: Record<string, unknown> | null,
  errMsg?: string | null,
) {
  await supabase.from('instagram_automation_log').insert({
    automation_id: automation.id,
    automation_name: automation.name,
    trigger_type: ctx.trigger_type,
    person_id: ctx.person_id,
    person_name: ctx.person_name || null,
    ig_message_id: ctx.ig_message_id,
    message_text: (ctx.message_text ?? '').slice(0, 500),
    filters_matched: matched,
    action_executed: automation.action_type,
    status,
    error_message: errMsg ?? null,
  });
}
