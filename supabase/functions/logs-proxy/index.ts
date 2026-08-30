import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MGMT_API_KEY = Deno.env.get('MGMT_API_KEY') ?? '';
const PROJECT_REF = Deno.env.get('MGMT_PROJECT_REF') ?? '';
const MGMT_BASE = `https://api.supabase.com/v1/projects/${PROJECT_REF}/analytics/endpoints/logs.all`;

const LOG_SOURCES = [
  'edge_logs',
  'function_edge_logs',
  'auth_logs',
  'postgres_logs',
  'realtime_logs',
  'storage_logs',
  'pgbouncer_logs',
] as const;

type LogSource = typeof LOG_SOURCES[number];

const TIME_RANGE_MAP: Record<string, string> = {
  '15m': 'TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE)',
  '1h':  'TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)',
  '6h':  'TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 6 HOUR)',
  '24h': 'TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY)',
  '7d':  'TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)',
};

const ALLOWED_TIME_RANGES = Object.keys(TIME_RANGE_MAP);

// Search payload: ASCII printable, no quotes/backslash/percent/underscore. Caps length to 100.
// Rejecting these characters at the boundary eliminates BigQuery SQLi via string interpolation
// and LIKE wildcard abuse — Supabase's analytics endpoint accepts the SQL verbatim.
const SAFE_SEARCH_RE = /^[a-zA-Z0-9 .,:;@/=#-]{0,100}$/;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function buildSql(source: LogSource, timeRange: string, search: string, limit: number): string {
  const since = TIME_RANGE_MAP[timeRange];
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 500);
  const searchClause = search ? ` AND LOWER(event_message) LIKE LOWER('%${search}%')` : '';
  return `SELECT id, timestamp, event_message, metadata FROM ${source} WHERE timestamp > ${since}${searchClause} ORDER BY timestamp DESC LIMIT ${safeLimit}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing authorization' }, 401);

  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) return json({ error: 'Unauthorized' }, 401);

  // Authorization gate: log access is super_admin-only. logs-proxy hits the Supabase
  // Management API (project-wide scope) — there is no tenant filter available at this
  // level, so it must not be exposed to regular users or even tenant admins.
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerProfile, error: profileErr } = await supabaseAdmin
    .from('settings_users')
    .select('id, super_admin, user_type')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (profileErr) {
    console.error('logs-proxy: profile lookup failed', profileErr.message);
    return json({ error: 'Authorization check failed' }, 500);
  }
  if (!callerProfile || callerProfile.super_admin !== true) {
    return json({ error: 'Forbidden — super_admin required' }, 403);
  }

  let body: { source?: unknown; timeRange?: unknown; search?: unknown; limit?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const source = (typeof body.source === 'string' ? body.source : 'edge_logs');
  const timeRange = (typeof body.timeRange === 'string' ? body.timeRange : '1h');
  const search = (typeof body.search === 'string' ? body.search : '');
  const limit = (typeof body.limit === 'number' ? body.limit : 100);

  if (!LOG_SOURCES.includes(source as LogSource)) {
    return json({ error: 'Invalid source' }, 400);
  }
  if (!ALLOWED_TIME_RANGES.includes(timeRange)) {
    return json({ error: 'Invalid timeRange' }, 400);
  }
  if (search && !SAFE_SEARCH_RE.test(search)) {
    return json({ error: 'Invalid search — only alphanumeric and . , : ; @ / = # - allowed (max 100 chars)' }, 400);
  }

  const sql = buildSql(source as LogSource, timeRange, search, limit);
  const url = `${MGMT_BASE}?sql=${encodeURIComponent(sql)}`;

  let mgmtRes: Response;
  try {
    mgmtRes = await fetch(url, {
      headers: { Authorization: `Bearer ${MGMT_API_KEY}` },
    });
  } catch (err) {
    console.error('logs-proxy: fetch failed', err);
    return json({ error: 'Upstream unreachable' }, 502);
  }

  if (!mgmtRes.ok) {
    console.error('logs-proxy: upstream error', mgmtRes.status);
    return json({ error: 'Upstream error', status: mgmtRes.status }, mgmtRes.status);
  }

  void supabaseAdmin.from('auth_events_log').insert({
    tenant_id: null,
    user_id: user.id,
    event_type: 'logs.queried',
    metadata: {
      actor_settings_user_id: callerProfile.id,
      source,
      time_range: timeRange,
      search_len: search.length,
      limit,
    },
    occurred_at: new Date().toISOString(),
  });

  const data = await mgmtRes.json();
  return json(data);
});
