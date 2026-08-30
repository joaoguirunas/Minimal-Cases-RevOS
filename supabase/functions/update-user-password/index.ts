import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-session-management',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface UpdatePasswordRequest {
  userId: string;
  newPassword: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      console.error('update-user-password: missing env vars');
      return new Response(
        JSON.stringify({ error: 'Configuração do servidor incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Token de autorização necessário' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId, newPassword }: UpdatePasswordRequest = await req.json();

    if (!userId || !newPassword) {
      return new Response(
        JSON.stringify({ error: 'Dados obrigatórios não fornecidos (userId, newPassword)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (typeof userId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return new Response(
        JSON.stringify({ error: 'userId inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (typeof newPassword !== 'string') {
      return new Response(
        JSON.stringify({ error: 'newPassword inválida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (newPassword.length < 8) {
      return new Response(
        JSON.stringify({ error: 'A senha deve ter no mínimo 8 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!/[a-zA-Z]/.test(newPassword)) {
      return new Response(
        JSON.stringify({ error: 'A senha deve conter pelo menos uma letra' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!/[0-9]/.test(newPassword)) {
      return new Response(
        JSON.stringify({ error: 'A senha deve conter pelo menos um número' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: currentUser, error: currentUserError } = await supabaseAdmin
      .from('settings_users')
      .select('id, user_type, super_admin, auth_user_id')
      .eq('auth_user_id', user.id)
      .single();

    if (currentUserError || !currentUser) {
      console.error('update-user-password: caller profile lookup failed', currentUserError);
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado no sistema' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: targetUser, error: targetUserError } = await supabaseAdmin
      .from('settings_users')
      .select('id, super_admin, auth_user_id, user_type')
      .eq('id', userId)
      .single();

    if (targetUserError || !targetUser) {
      return new Response(
        JSON.stringify({ error: 'Usuário alvo não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!targetUser.auth_user_id) {
      return new Response(
        JSON.stringify({ error: 'Usuário alvo sem auth_user_id vinculado' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isSelf = currentUser.id === targetUser.id;
    const isCurrentUserAdmin = currentUser.super_admin === true || currentUser.user_type === 'admin';
    const isCurrentUserManager = currentUser.user_type === 'manager';

    const hasPermission =
      isSelf ||
      isCurrentUserAdmin ||
      (isCurrentUserManager && targetUser.super_admin !== true && targetUser.user_type !== 'admin');

    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: 'Permissão negada: apenas administradores ou gestores podem alterar senhas' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CRITICAL: derive targetAuthId from DB lookup, never from client body — prevents
    // privilege escalation via mismatched userId/targetUserAuthId pair.
    const targetAuthId = targetUser.auth_user_id;

    const { data: updateData, error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
      targetAuthId,
      { password: newPassword }
    );

    if (passwordError) {
      console.error('update-user-password: updateUserById failed', passwordError.message);
      return new Response(
        JSON.stringify({ error: 'Erro ao alterar senha' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    void supabaseAdmin.from('auth_events_log').insert({
      tenant_id: null,
      user_id: user.id,
      event_type: 'user.password_changed',
      metadata: {
        actor_settings_user_id: currentUser.id,
        target_settings_user_id: targetUser.id,
        target_auth_user_id: targetAuthId,
        is_self: isSelf,
      },
      occurred_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Senha alterada com sucesso', data: updateData }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('update-user-password: internal error', error?.message ?? error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
