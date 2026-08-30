import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Email regex — RFC 5322 simplified. Excludes %, _ and other LIKE/SQL wildcards by construction.
const EMAIL_RE = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/;

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function clientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',').pop()?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  let body: { email?: unknown; full_name?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  const emailRaw = typeof body.email === 'string' ? body.email : '';
  const fullNameRaw = typeof body.full_name === 'string' ? body.full_name : '';
  const reasonRaw = typeof body.reason === 'string' ? body.reason : '';

  const email = emailRaw.trim().toLowerCase();
  const fullName = fullNameRaw.trim();
  const reason = reasonRaw.trim().slice(0, 1000);

  if (!email || !fullName) {
    return json({ ok: false, error: 'Email e nome completo são obrigatórios' }, 400);
  }
  // Reject email with SQL/LIKE wildcards and length-bomb payloads. EMAIL_RE alone would catch
  // wildcards, but we check explicitly so the response is unambiguous.
  if (email.length > 254 || /[%_\\\x00-\x1f]/.test(email)) {
    return json({ ok: false, error: 'Email inválido' }, 400);
  }
  if (!EMAIL_RE.test(email)) {
    return json({ ok: false, error: 'Email inválido' }, 400);
  }
  if (fullName.length < 2 || fullName.length > 200) {
    return json({ ok: false, error: 'Nome completo inválido' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Rate-limit by email (LGPD endpoint is public — must throttle to prevent abuse).
  // Uses the existing data_deletion_requests table for the lookup; no extra schema.
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count: recentByEmail, error: rateErr } = await supabase
    .from('data_deletion_requests')
    .select('*', { count: 'exact', head: true })
    .eq('email', email)
    .gte('created_at', since);

  if (rateErr) {
    console.error('data-deletion: rate check failed', rateErr.message);
    return json({ ok: false, error: 'Erro interno' }, 500);
  }
  if ((recentByEmail ?? 0) >= RATE_LIMIT_MAX) {
    return json({ ok: false, error: 'Muitas solicitações recentes para este email. Tente novamente em 1 hora.' }, 429);
  }

  const protocol = `DEL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 8)}`;

  // Register as PENDING — never delete automatically from a public endpoint. An admin must
  // review and process the request to confirm identity ownership of the email. This avoids
  // a public DoS-of-data vector while still satisfying LGPD's "submit a request" requirement.
  const { error: insertErr } = await supabase.from('data_deletion_requests').insert({
    email,
    full_name: fullName,
    reason: reason || null,
    status: 'pending',
    protocol,
  });

  if (insertErr) {
    console.error('data-deletion: insert failed', insertErr.message);
    return json({ ok: false, error: 'Erro ao registrar solicitação' }, 500);
  }

  void supabase.from('auth_events_log').insert({
    tenant_id: null,
    user_id: null,
    event_type: 'data_deletion.requested',
    metadata: {
      protocol,
      email,
      ip: clientIp(req),
    },
    occurred_at: new Date().toISOString(),
  });

  return json({ ok: true, protocol, deleted_count: 0, status: 'pending' });
});
