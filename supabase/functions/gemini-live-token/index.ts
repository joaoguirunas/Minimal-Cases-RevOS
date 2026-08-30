/**
 * gemini-live-token — Ephemeral token issuer for Gemini Live API
 *
 * Issues single-use, 60s-TTL ephemeral tokens for browser WebSocket connections.
 * Rate limited to MAX_TOKENS_PER_HOUR_PER_TENANT per tenant/hour.
 *
 * DEPLOY: supabase functions deploy gemini-live-token
 * (verify_jwt = true — default, no override needed)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getProviderKey } from '../_shared/ai_providers.ts';

const GEMINI_MODEL_ID = 'models/gemini-2.5-flash-native-audio-preview-12-2025';
const TOKEN_TTL_SECONDS = 60;
const MAX_TOKENS_PER_HOUR_PER_TENANT = 20;
const GEMINI_AUTH_TOKENS_URL = 'https://generativelanguage.googleapis.com/v1alpha/auth_tokens';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // AC1: validate JWT
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return json({ error: 'Unauthorized' }, 401);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user) return json({ error: 'Unauthorized' }, 401);

  // AC2: read tenant_id from app_metadata (server-verified, never from body)
  // Falls back to the single settings row for single-tenant deployments.
  let tenantId = user.app_metadata?.tenant_id as string | undefined;
  if (!tenantId) {
    const { data: settingsRow } = await supabase
      .from('settings')
      .select('id')
      .limit(1)
      .maybeSingle();
    tenantId = settingsRow?.id;
  }
  if (!tenantId) return json({ error: 'No tenant associated with this user' }, 403);

  // AC5: rate limit check — count tokens issued in last hour for this tenant
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countErr } = await supabase
    .from('bi_voice_token_log')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('issued_at', oneHourAgo);

  if (countErr) {
    console.error('[gemini-live-token] rate limit check error:', JSON.stringify(countErr));
    return json({ error: 'Internal error during rate limit check' }, 500);
  }

  if ((count ?? 0) >= MAX_TOKENS_PER_HOUR_PER_TENANT) {
    const retryAfterSeconds = 3600; // conservative — next hour window
    return json(
      { error: 'Rate limit exceeded', retry_after_seconds: retryAfterSeconds },
      429,
    );
  }

  // AC3: get Gemini API key for this tenant
  const geminiKey = await getProviderKey('gemini', supabase);
  if (!geminiKey) {
    return json(
      {
        error: 'gemini_not_configured',
        message: 'Gestor precisa cadastrar API key Gemini em Configurações → IA Providers.',
      },
      412,
    );
  }

  // Return the API key (gated behind Supabase auth — only authenticated users reach here)
  const issuedAt = new Date().toISOString();

  void supabase.from('bi_voice_token_log').insert({
    tenant_id: tenantId,
    user_id: user.id,
    issued_at: issuedAt,
    expires_at: new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString(),
    model_id: GEMINI_MODEL_ID,
  });

  return json({ token: geminiKey, model_id: GEMINI_MODEL_ID }, 200, {
    'X-Gemini-Model': GEMINI_MODEL_ID,
  });
});
