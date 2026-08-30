/**
 * gemini-ws-proxy — WebSocket proxy for Gemini Live API
 *
 * Routes browser WebSocket connections through Supabase (same origin)
 * to bypass CSP restrictions on iOS Safari / WKWebView.
 *
 * Auth: JWT via query param ?token=<supabase-jwt>
 *
 * DEPLOY: supabase functions deploy gemini-ws-proxy --no-verify-jwt
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getProviderKey } from '../_shared/ai_providers.ts';

const GEMINI_MODEL_ID = 'models/gemini-2.5-flash-native-audio-preview-12-2025';
const GEMINI_WS_BASE  = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const MAX_TOKENS_PER_HOUR = 20;

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // ── Auth via query param (WebSocket handshake can't set custom headers) ───
  const token = url.searchParams.get('token') ?? '';
  if (!token) return new Response('Unauthorized', { status: 401 });

  const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase       = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user) return new Response('Unauthorized', { status: 401 });

  // ── Resolve tenant ────────────────────────────────────────────────────────
  let tenantId = user.app_metadata?.tenant_id as string | undefined;
  if (!tenantId) {
    const { data: s } = await supabase.from('settings').select('id').limit(1).maybeSingle();
    tenantId = (s as { id: string } | null)?.id;
  }
  if (!tenantId) return new Response('No tenant', { status: 403 });

  // ── Rate limit ────────────────────────────────────────────────────────────
  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await supabase
    .from('bi_voice_token_log')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('issued_at', oneHourAgo);
  if ((count ?? 0) >= MAX_TOKENS_PER_HOUR) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 });
  }

  // ── Gemini API key ────────────────────────────────────────────────────────
  const geminiKey = await getProviderKey('gemini', supabase);
  if (!geminiKey) {
    return new Response(JSON.stringify({ error: 'gemini_not_configured' }), { status: 412 });
  }

  // ── Must be a WebSocket upgrade ───────────────────────────────────────────
  if ((req.headers.get('upgrade') ?? '').toLowerCase() !== 'websocket') {
    return new Response('Expected WebSocket upgrade', { status: 426 });
  }

  // ── Log token usage (fire-and-forget) ────────────────────────────────────
  void supabase.from('bi_voice_token_log').insert({
    tenant_id: tenantId,
    user_id: user.id,
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
    model_id: GEMINI_MODEL_ID,
  });

  // ── Upgrade client connection ─────────────────────────────────────────────
  const { socket: clientWs, response } = Deno.upgradeWebSocket(req);

  // ── Connect to Gemini immediately ─────────────────────────────────────────
  // Do NOT wait for clientWs.onopen — connect to Gemini in parallel so it's
  // ready (or nearly ready) by the time the client sends its first message.
  const geminiUrl = `${GEMINI_WS_BASE}?key=${encodeURIComponent(geminiKey)}`;
  const geminiWs  = new WebSocket(geminiUrl);
  geminiWs.binaryType = 'arraybuffer';

  // Buffer messages received from client before Gemini is open
  const pendingToGemini: (string | ArrayBuffer)[] = [];
  let geminiOpen = false;

  geminiWs.onopen = () => {
    geminiOpen = true;
    // Flush buffered messages
    for (const msg of pendingToGemini) {
      geminiWs.send(msg);
    }
    pendingToGemini.length = 0;
    console.log('[gemini-ws-proxy] Gemini connected, flushed', pendingToGemini.length, 'buffered msgs');
  };

  // Proxy: Gemini → client
  geminiWs.onmessage = (ev) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(ev.data);
    }
  };

  geminiWs.onerror = () => {
    console.error('[gemini-ws-proxy] Gemini error');
    if (clientWs.readyState === WebSocket.OPEN) clientWs.close(1011, 'Gemini error');
  };

  geminiWs.onclose = (ev) => {
    console.log(`[gemini-ws-proxy] Gemini closed: ${ev.code}`);
    if (clientWs.readyState === WebSocket.OPEN) clientWs.close(ev.code || 1000, ev.reason);
  };

  // Proxy: client → Gemini (with buffering)
  clientWs.onmessage = (ev) => {
    if (geminiOpen && geminiWs.readyState === WebSocket.OPEN) {
      geminiWs.send(ev.data);
    } else {
      // Gemini not yet open — buffer the message
      pendingToGemini.push(ev.data);
    }
  };

  clientWs.onerror = () => {
    if (geminiWs.readyState === WebSocket.OPEN) geminiWs.close();
  };

  clientWs.onclose = (ev) => {
    console.log(`[gemini-ws-proxy] Client closed: ${ev.code}`);
    if (geminiWs.readyState === WebSocket.OPEN) geminiWs.close();
  };

  return response;
});
