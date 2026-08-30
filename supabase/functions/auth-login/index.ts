/**
 * auth-login — Rate-limited login proxy
 *
 * Receives { email, password, tenant_host? }, checks rate limit in
 * auth_login_attempts (by ip_hash+email_hash), then delegates to
 * Supabase signInWithPassword. Returns tokens on success so the
 * client can call supabase.auth.setSession().
 *
 * DEPLOY: supabase functions deploy auth-login --no-verify-jwt
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DEFAULT_MAX_ATTEMPTS = 10;
const BLOCK_DURATION_MINUTES = 15;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sha256hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function clientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  let body: { email?: string; password?: string; tenant_host?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  const { email, password, tenant_host } = body;
  if (!email || !password) {
    return json({ ok: false, error: 'email and password are required' }, 400);
  }
  // Normalise tenant_host to avoid key collisions
  const tenantKey = typeof tenant_host === 'string' && tenant_host.trim()
    ? tenant_host.trim().toLowerCase().slice(0, 253)
    : 'unknown';

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Derive hashes — rate limit key scoped per tenant to prevent cross-tenant exhaustion
  const ip = clientIp(req);
  const [ipHash, emailHash] = await Promise.all([
    sha256hex(`${tenantKey}:${ip}`),
    sha256hex(email.toLowerCase().trim()),
  ]);

  // Read tenant max_attempts from settings (AC4)
  const { data: settingsRow } = await supabase
    .from('settings')
    .select('id, login_max_attempts')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const maxAttempts: number = settingsRow?.login_max_attempts ?? DEFAULT_MAX_ATTEMPTS;
  const tenantId: string | null = settingsRow?.id ?? null;

  // Check existing rate limit record (AC1)
  const { data: attempt } = await supabase
    .from('auth_login_attempts')
    .select('id, attempts, blocked_until')
    .eq('ip_hash', ipHash)
    .eq('email_hash', emailHash)
    .maybeSingle();

  if (attempt?.blocked_until) {
    const blockedUntil = new Date(attempt.blocked_until);
    if (blockedUntil > new Date()) {
      const retryAfterSeconds = Math.ceil((blockedUntil.getTime() - Date.now()) / 1000);
      return json({ ok: false, error: 'Too many login attempts', retry_after_seconds: retryAfterSeconds }, 429);
    }
    // Block expired — reset
    await supabase
      .from('auth_login_attempts')
      .update({ attempts: 0, blocked_until: null, last_attempt: new Date().toISOString() })
      .eq('id', attempt.id);
  }

  // Delegate to Supabase Auth (AC2)
  const supabaseAuth = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData?.session) {
    // Increment attempts
    const currentAttempts = (attempt?.attempts ?? 0) + 1;
    const isBlocked = currentAttempts >= maxAttempts;
    const blockedUntil = isBlocked
      ? new Date(Date.now() + BLOCK_DURATION_MINUTES * 60 * 1000).toISOString()
      : null;

    if (attempt?.id) {
      await supabase
        .from('auth_login_attempts')
        .update({ attempts: currentAttempts, blocked_until: blockedUntil, last_attempt: new Date().toISOString() })
        .eq('id', attempt.id);
    } else {
      await supabase
        .from('auth_login_attempts')
        .insert({ ip_hash: ipHash, email_hash: emailHash, tenant_id: tenantId, attempts: currentAttempts, blocked_until: blockedUntil });
    }

    if (isBlocked) {
      return json({
        ok: false,
        error: 'Too many login attempts',
        retry_after_seconds: BLOCK_DURATION_MINUTES * 60,
      }, 429);
    }

    return json({
      ok: false,
      error: authError?.message ?? 'Invalid credentials',
      attempts_remaining: maxAttempts - currentAttempts,
    }, 401);
  }

  // Success — reset counter (AC2)
  if (attempt?.id) {
    await supabase
      .from('auth_login_attempts')
      .update({ attempts: 0, blocked_until: null, last_attempt: new Date().toISOString() })
      .eq('id', attempt.id);
  }

  // Return tokens for client to call supabase.auth.setSession() (AC3)
  return json({
    ok: true,
    access_token: authData.session.access_token,
    refresh_token: authData.session.refresh_token,
    expires_at: authData.session.expires_at,
    user: {
      id: authData.user.id,
      email: authData.user.email,
    },
  });
});
