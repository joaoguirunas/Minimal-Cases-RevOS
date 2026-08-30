/**
 * admin-unenroll-mfa — Admin MFA removal for a target user
 *
 * Requires caller to be gestor OR admin/manager.
 * Removes all TOTP factors + mfa_recovery_codes for the target user.
 * Writes audit log to auth_events_log.
 *
 * DEPLOY: supabase functions deploy admin-unenroll-mfa
 *
 * Body: { targetAuthUserId: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return json({ error: 'Unauthorized' }, 401);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !caller) return json({ error: 'Unauthorized' }, 401);

  const { data: callerProfile } = await supabase
    .from('settings_users')
    .select('id, user_type')
    .eq('auth_user_id', caller.id)
    .maybeSingle();

  const isAuthorized =
    callerProfile?.user_type === 'admin' ||
    callerProfile?.user_type === 'manager';
  if (!isAuthorized) return json({ error: 'Forbidden — admin or manager required' }, 403);

  let body: { targetAuthUserId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { targetAuthUserId } = body;
  if (!targetAuthUserId) return json({ error: 'targetAuthUserId is required' }, 400);

  const { data: { user: targetUser }, error: targetErr } = await supabase.auth.admin.getUserById(targetAuthUserId);
  if (targetErr || !targetUser) return json({ error: 'Target user not found' }, 404);

  const { data: factorsData, error: listErr } = await supabase.auth.admin.listFactors({
    userId: targetAuthUserId,
  } as Parameters<typeof supabase.auth.admin.listFactors>[0]);

  if (listErr) return json({ error: 'Failed to list MFA factors' }, 500);

  const factors = (factorsData as unknown as { totp?: { id: string }[] })?.totp ?? [];
  const deleteResults: { id: string; ok: boolean }[] = [];

  for (const factor of factors) {
    const { error: delErr } = await supabase.auth.admin.deleteFactor({
      userId: targetAuthUserId,
      id: factor.id,
    } as Parameters<typeof supabase.auth.admin.deleteFactor>[0]);
    deleteResults.push({ id: factor.id, ok: !delErr });
  }

  const { error: rcDelErr } = await supabase
    .from('mfa_recovery_codes')
    .delete()
    .eq('user_id', targetAuthUserId);

  void supabase.from('auth_events_log').insert({
    tenant_id: null,
    user_id: caller.id,
    event_type: 'mfa.admin_unenrolled',
    metadata: {
      actor_id: caller.id,
      target_user_id: targetAuthUserId,
      factors_removed: deleteResults.length,
      recovery_codes_deleted: !rcDelErr,
    },
    occurred_at: new Date().toISOString(),
  });

  return json({ ok: true, factors_removed: deleteResults.length });
});
