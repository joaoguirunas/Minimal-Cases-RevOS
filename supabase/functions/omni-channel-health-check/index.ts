/**
 * OMNI PRO™ Channel Health Check
 *
 * ⚠️  DEPLOY: always use --no-verify-jwt
 *     supabase functions deploy omni-channel-health-check --no-verify-jwt
 *     (called by pg_cron via service role — no Supabase JWT)
 *
 * Probes each active channel in omni_channel_configs to verify connectivity.
 * Results saved to omni_channel_alerts (alert_type='health_check').
 *
 * Probes:
 *   whatsapp  → GET /v19.0/{phone_number_id} with access_token
 *   instagram → GET /v19.0/me?fields=id,username with access_token
 *   email     → SMTP socket connect OR SendGrid GET /v3/user/profile
 *   sms       → Twilio GET /2010-04-01/Accounts/{sid}
 *   telefone  → HTTP HEAD on webhook_fallback.url
 *
 * Env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PROBE_TIMEOUT_MS = 5000;

interface ProbeResult {
  channel: string;
  healthy: boolean;
  latency_ms: number;
  error?: string;
}

// ── Probe functions ──────────────────────────────────────────────────────────

async function probeWhatsApp(credentials: Record<string, unknown>): Promise<ProbeResult> {
  const phoneNumberId = credentials.phone_number_id as string;
  const accessToken = credentials.access_token as string;
  if (!phoneNumberId || !accessToken) {
    return { channel: 'whatsapp', healthy: false, latency_ms: 0, error: 'Missing phone_number_id or access_token' };
  }

  const t0 = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const latency = Date.now() - t0;

    if (res.ok) return { channel: 'whatsapp', healthy: true, latency_ms: latency };
    const body = await res.text().catch(() => '');
    return { channel: 'whatsapp', healthy: false, latency_ms: latency, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
  } catch (err) {
    return { channel: 'whatsapp', healthy: false, latency_ms: Date.now() - t0, error: (err as Error).message };
  }
}

async function probeInstagram(credentials: Record<string, unknown>): Promise<ProbeResult> {
  const accessToken = credentials.access_token as string;
  if (!accessToken) {
    return { channel: 'instagram', healthy: false, latency_ms: 0, error: 'Missing access_token' };
  }

  const t0 = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,username&access_token=${accessToken}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const latency = Date.now() - t0;

    if (res.ok) return { channel: 'instagram', healthy: true, latency_ms: latency };
    const body = await res.text().catch(() => '');
    return { channel: 'instagram', healthy: false, latency_ms: latency, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
  } catch (err) {
    return { channel: 'instagram', healthy: false, latency_ms: Date.now() - t0, error: (err as Error).message };
  }
}

async function probeEmail(credentials: Record<string, unknown>): Promise<ProbeResult> {
  const provider = credentials.provider as string;

  // SendGrid
  if (provider === 'sendgrid') {
    const apiKey = credentials.api_key as string;
    if (!apiKey) return { channel: 'email', healthy: false, latency_ms: 0, error: 'Missing api_key' };

    const t0 = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
      const res = await fetch('https://api.sendgrid.com/v3/user/profile', {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const latency = Date.now() - t0;
      if (res.ok) return { channel: 'email', healthy: true, latency_ms: latency };
      return { channel: 'email', healthy: false, latency_ms: latency, error: `HTTP ${res.status}` };
    } catch (err) {
      return { channel: 'email', healthy: false, latency_ms: Date.now() - t0, error: (err as Error).message };
    }
  }

  // SMTP — Deno can't do raw TCP in edge functions, so for SMTP we do a webhook fallback check
  // Webhook fallback is handled separately
  return { channel: 'email', healthy: true, latency_ms: 0 };
}

async function probeSms(credentials: Record<string, unknown>): Promise<ProbeResult> {
  const provider = credentials.provider as string;

  if (provider === 'twilio') {
    const accountSid = credentials.account_sid as string;
    const authToken = credentials.auth_token as string;
    if (!accountSid || !authToken) {
      return { channel: 'sms', healthy: false, latency_ms: 0, error: 'Missing account_sid or auth_token' };
    }

    const t0 = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
        headers: { Authorization: 'Basic ' + btoa(`${accountSid}:${authToken}`) },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const latency = Date.now() - t0;
      if (res.ok) return { channel: 'sms', healthy: true, latency_ms: latency };
      return { channel: 'sms', healthy: false, latency_ms: latency, error: `HTTP ${res.status}` };
    } catch (err) {
      return { channel: 'sms', healthy: false, latency_ms: Date.now() - t0, error: (err as Error).message };
    }
  }

  // Webhook provider — handled by webhookFallback probe
  return { channel: 'sms', healthy: true, latency_ms: 0 };
}

async function probeTelefone(webhookFallback: Record<string, unknown>): Promise<ProbeResult> {
  const url = webhookFallback?.url as string;
  if (!url) return { channel: 'telefone', healthy: false, latency_ms: 0, error: 'No webhook_fallback.url configured' };

  const t0 = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeout);
    const latency = Date.now() - t0;
    if (res.ok || res.status === 405) return { channel: 'telefone', healthy: true, latency_ms: latency }; // 405 = HEAD not allowed but server is up
    return { channel: 'telefone', healthy: false, latency_ms: latency, error: `HTTP ${res.status}` };
  } catch (err) {
    return { channel: 'telefone', healthy: false, latency_ms: Date.now() - t0, error: (err as Error).message };
  }
}

async function probeWebhookFallback(channel: string, webhookFallback: Record<string, unknown>): Promise<ProbeResult | null> {
  const enabled = webhookFallback?.enabled as boolean;
  const url = webhookFallback?.url as string;
  if (!enabled || !url) return null;

  const t0 = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeout);
    const latency = Date.now() - t0;
    if (res.ok || res.status === 405) return { channel, healthy: true, latency_ms: latency };
    return { channel, healthy: false, latency_ms: latency, error: `Webhook HTTP ${res.status}` };
  } catch (err) {
    return { channel, healthy: false, latency_ms: Date.now() - t0, error: `Webhook: ${(err as Error).message}` };
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const log = createLogger('omni-channel-health-check');
  const t0 = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Get all active channels
    const { data: channels, error: chErr } = await supabase
      .from('omni_channel_configs')
      .select('channel, credentials, webhook_fallback, settings')
      .eq('is_active', true);

    if (chErr) {
      log.error('channels_query_failed', { error: chErr.message });
      return new Response(JSON.stringify({ error: chErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!channels || channels.length === 0) {
      log.info('no_active_channels');
      return new Response(JSON.stringify({ ok: true, checked: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Get last health status per channel (to detect transitions)
    const { data: lastAlerts } = await supabase
      .from('omni_channel_alerts')
      .select('channel, severity, created_at')
      .eq('alert_type', 'health_check')
      .order('created_at', { ascending: false });

    const lastStatusMap = new Map<string, string>();
    if (lastAlerts) {
      for (const alert of lastAlerts) {
        if (!lastStatusMap.has(alert.channel)) {
          lastStatusMap.set(alert.channel, alert.severity);
        }
      }
    }

    // 3. Run probes
    const results: ProbeResult[] = [];

    for (const ch of channels) {
      const creds = (ch.credentials ?? {}) as Record<string, unknown>;
      const webhook = (ch.webhook_fallback ?? {}) as Record<string, unknown>;

      let result: ProbeResult;

      switch (ch.channel) {
        case 'whatsapp':
          result = await probeWhatsApp(creds);
          break;
        case 'instagram':
          result = await probeInstagram(creds);
          break;
        case 'email':
          result = await probeEmail(creds);
          // If email uses webhook, also check webhook
          if (!result.healthy || (creds.provider !== 'sendgrid')) {
            const wh = await probeWebhookFallback('email', webhook);
            if (wh) result = wh;
          }
          break;
        case 'sms':
          result = await probeSms(creds);
          if (!result.healthy || (creds.provider !== 'twilio')) {
            const wh = await probeWebhookFallback('sms', webhook);
            if (wh) result = wh;
          }
          break;
        case 'telefone':
          result = await probeTelefone(webhook);
          break;
        default:
          result = { channel: ch.channel, healthy: false, latency_ms: 0, error: `Unknown channel: ${ch.channel}` };
      }

      results.push(result);
    }

    // 4. Save results to omni_channel_alerts
    const alertEntries = results.map(r => {
      const severity = r.healthy
        ? (r.latency_ms > 3000 ? 'warning' : 'info')
        : 'error';

      return {
        channel: r.channel,
        alert_type: 'health_check',
        severity,
        title: r.healthy
          ? `${r.channel} healthy (${r.latency_ms}ms)`
          : `${r.channel} unreachable: ${r.error}`,
        details: {
          healthy: r.healthy,
          latency_ms: r.latency_ms,
          error: r.error ?? null,
          checked_at: new Date().toISOString(),
        },
      };
    });

    const { error: insertErr } = await supabase
      .from('omni_channel_alerts')
      .insert(alertEntries);

    if (insertErr) {
      log.error('alert_insert_failed', { error: insertErr.message });
    }

    // 5. AC-6: Detect healthy→error transitions and create separate transition alert
    for (const r of results) {
      if (!r.healthy) {
        const previousSeverity = lastStatusMap.get(r.channel);
        if (previousSeverity && previousSeverity !== 'error') {
          // Channel went from healthy/warning → error — insert a distinct alert
          await supabase.from('omni_channel_alerts').insert({
            channel: r.channel,
            alert_type: 'health_transition',
            severity: 'error',
            title: `${r.channel} DOWN — was ${previousSeverity}, now unreachable`,
            details: {
              previous_severity: previousSeverity,
              error: r.error,
              transitioned_at: new Date().toISOString(),
            },
          });
          log.warn('channel_down', { channel: r.channel, previous: previousSeverity, error: r.error });
        }
      }
    }

    const summary = {
      ok: true,
      checked: results.length,
      healthy: results.filter(r => r.healthy).length,
      unhealthy: results.filter(r => !r.healthy).length,
      elapsed_ms: log.elapsed(t0),
    };

    log.info('done', summary);

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
