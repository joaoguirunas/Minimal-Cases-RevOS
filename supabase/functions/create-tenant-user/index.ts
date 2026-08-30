import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CONTROL_PLANE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const CONTROL_PLANE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

async function deleteAuthUser(supabaseUrl: string, serviceRoleKey: string, userId: string): Promise<void> {
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`create-tenant-user rollback: failed to delete auth user ${userId}: ${res.status} ${body}`);
    }
  } catch (e: any) {
    console.error(`create-tenant-user rollback: exception deleting auth user ${userId}:`, e?.message);
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const controlPlane = createClient(CONTROL_PLANE_URL, CONTROL_PLANE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { supabase_url, caller_token, email, password, name, phone, user_type, super_admin } = await req.json();

    if (!supabase_url || !email || !password || !name) {
      return json(400, { error: 'supabase_url, email, password e name são obrigatórios' });
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(400, { error: 'email inválido' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return json(400, { error: 'password deve ter ao menos 8 caracteres' });
    }

    const callerToken = caller_token ?? '';
    if (!callerToken) return json(401, { error: 'caller_token obrigatório' });

    // Normalize the incoming URL to protocol+host only (strips /rest/v1/ or trailing slashes).
    // new URL() must succeed — failure means the input is not a valid URL (reject with 400).
    // Normalizing before ILIKE prevents wildcard injection via % or _ in the raw input.
    let normalizedUrl: string;
    try {
      const parsed = new URL((supabase_url as string).trim());
      normalizedUrl = `${parsed.protocol}//${parsed.host}`;
    } catch (_) {
      return json(400, { error: `supabase_url inválida: "${supabase_url}"` });
    }
    if (!normalizedUrl.startsWith('https://')) {
      return json(400, { error: `supabase_url deve usar HTTPS: "${normalizedUrl}"` });
    }

    const { data: client, error: clientErr } = await controlPlane
      .from('adm_clients')
      .select('id, name, supabase_url, anon_key')
      .ilike('supabase_url', `${normalizedUrl}%`)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (clientErr || !client) return json(404, { error: 'Tenant não encontrado no control plane' });

    // Normalize the stored URL (may contain /rest/v1/ suffix from dirty data).
    let tenantUrl = (client.supabase_url ?? '').trim();
    try {
      const parsed = new URL(tenantUrl);
      tenantUrl = `${parsed.protocol}//${parsed.host}`;
    } catch (_) { /* keep as-is */ }

    const callerRes = await fetch(`${tenantUrl}/auth/v1/user`, {
      headers: {
        'apikey': client.anon_key,
        'Authorization': `Bearer ${callerToken}`,
      },
    });

    if (!callerRes.ok) return json(401, { error: 'Token inválido para este tenant' });
    const callerUser = await callerRes.json();

    const { data: secrets } = await controlPlane.rpc('adm_client_decrypted_secrets', {
      p_client_id: client.id,
    });

    const serviceRoleKey = secrets?.[0]?.service_role_key;
    if (!serviceRoleKey || !serviceRoleKey.startsWith('eyJ')) {
      return json(400, { error: 'Service Role Key não cadastrada. Configure no ADM.' });
    }

    const profileRes = await fetch(
      `${tenantUrl}/rest/v1/settings_users?auth_user_id=eq.${callerUser.id}&select=user_type,super_admin`,
      {
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
      }
    );

    const profiles = profileRes.ok ? await profileRes.json() : [];
    const callerProfile = profiles?.[0];

    const callerIsAdmin = callerProfile?.super_admin === true || callerProfile?.user_type === 'admin';
    const callerIsManager = callerProfile?.user_type === 'manager';
    if (!callerProfile || (!callerIsAdmin && !callerIsManager)) {
      return json(403, { error: 'Apenas administradores ou gestores podem criar usuários' });
    }

    // ── Step 1: Create auth user (compensable) ─────────────────────
    const createAuthRes = await fetch(`${tenantUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name },
      }),
    });

    if (!createAuthRes.ok) {
      const err = await createAuthRes.json().catch(() => ({}));
      return json(422, { error: err.msg || err.message || 'Erro ao criar usuário no Auth' });
    }

    const authUser = await createAuthRes.json();
    const authUserId: string | undefined = authUser?.id;
    if (!authUserId) return json(500, { error: 'Auth API retornou resposta sem id' });

    // ── Step 2: Insert settings_users (with compensating rollback) ─
    let insertProfileRes: Response;
    try {
      insertProfileRes = await fetch(`${tenantUrl}/rest/v1/settings_users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          auth_user_id: authUserId,
          name,
          email,
          phone: phone || null,
          user_type: user_type || 'user',
          super_admin: super_admin || false,
          active: true,
        }),
      });
    } catch (fetchEx: any) {
      await deleteAuthUser(tenantUrl, serviceRoleKey, authUserId);
      return json(502, { error: `Falha de rede ao criar perfil; auth user revertido: ${fetchEx?.message ?? 'unknown'}` });
    }

    if (!insertProfileRes.ok) {
      const err = await insertProfileRes.text().catch(() => '');
      await deleteAuthUser(tenantUrl, serviceRoleKey, authUserId);
      return json(422, { error: `Erro ao criar perfil; auth user revertido: ${err}` });
    }

    const profile = (await insertProfileRes.json())?.[0];

    return json(200, { success: true, user_id: profile?.id, auth_user_id: authUserId, email });
  } catch (err: any) {
    console.error('create-tenant-user error:', err);
    return json(500, { error: err.message ?? 'Erro interno' });
  }
});
