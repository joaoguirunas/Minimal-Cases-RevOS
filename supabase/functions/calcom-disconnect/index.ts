/**
 * Cal.com — Disconnect
 *
 * POST /calcom-disconnect  — requires user JWT
 *
 * Flow:
 * 1. Verify JWT → settings_users.id (crmUserId)
 * 2. Load the user's Cal.com connection
 * 3. Best-effort: DELETE the registered webhook on Cal.com
 * 4. DELETE user_calcom_connections WHERE user_id = crmUserId
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CALCOM_WEBHOOKS_URL = 'https://api.cal.com/v2/webhooks';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return json(null, 200);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  try {
    // === AUTH ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ success: false, error: 'Unauthorized' }, 401);
    }

    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return json({ success: false, error: 'Invalid token' }, 401);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // === Lookup settings_users.id ===
    const { data: crmUser, error: crmError } = await supabase
      .from('settings_users')
      .select('id')
      .eq('auth_user_id', user.id)
      .eq('active', true)
      .single();
    if (crmError || !crmUser) {
      return json({ success: false, error: 'Usuário não encontrado' }, 403);
    }

    // === Load connection ===
    const { data: conn } = await supabase
      .from('user_calcom_connections')
      .select('webhook_id, calcom_access_token')
      .eq('user_id', crmUser.id)
      .maybeSingle();

    // === Best-effort webhook delete on Cal.com ===
    if (conn?.webhook_id && conn?.calcom_access_token) {
      try {
        await fetch(`${CALCOM_WEBHOOKS_URL}/${conn.webhook_id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${conn.calcom_access_token}`,
            'cal-api-version': '2024-06-14',
          },
        });
      } catch (err) {
        console.warn('Cal.com webhook delete failed (non-fatal):', (err as Error).message);
      }
    }

    // === Delete connection ===
    const { error: delError } = await supabase
      .from('user_calcom_connections')
      .delete()
      .eq('user_id', crmUser.id);

    if (delError) {
      console.error('Delete error:', delError);
      return json({ success: false, error: 'Erro ao desconectar Cal.com.' }, 500);
    }

    console.log(`✅ calcom-disconnect: user ${crmUser.id} disconnected`);
    return json({ success: true });

  } catch (err) {
    console.error('Unexpected error:', err);
    return json({ success: false, error: 'Erro interno ao desconectar Cal.com.' }, 500);
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
