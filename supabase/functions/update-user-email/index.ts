import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface UpdateEmailRequest {
  userId: string;
  newEmail: string;
  targetUserAuthId: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      console.error('❌ Variáveis de ambiente não configuradas');
      return new Response(
        JSON.stringify({ error: 'Configuração do servidor incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente Supabase com service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Criar cliente normal para validações
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ Token de autorização não fornecido');
      return new Response(
        JSON.stringify({ error: 'Token de autorização necessário' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Verificar usuário logado
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('❌ Usuário não autenticado:', userError);
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId, newEmail, targetUserAuthId }: UpdateEmailRequest = await req.json();

    // Validar dados de entrada
    if (!userId || !newEmail || !targetUserAuthId) {
      return new Response(
        JSON.stringify({ error: 'Dados obrigatórios não fornecidos (userId, newEmail, targetUserAuthId)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return new Response(
        JSON.stringify({ error: 'Formato de email inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar dados do usuário logado
    const { data: currentUser, error: currentUserError } = await supabase
      .from('settings_users')
      .select('id, user_type, super_admin')
      .eq('auth_user_id', user.id)
      .single();

    if (currentUserError || !currentUser) {
      console.error('❌ Erro ao buscar usuário atual:', currentUserError);
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado no sistema' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar dados do usuário alvo
    const { data: targetUser, error: targetUserError } = await supabase
      .from('settings_users')
      .select('id, super_admin')
      .eq('id', userId)
      .single();

    if (targetUserError || !targetUser) {
      console.error('❌ Erro ao buscar usuário alvo:', targetUserError);
      return new Response(
        JSON.stringify({ error: 'Usuário alvo não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🎯 Usuário alvo:', targetUser);

    // Permissões: admin (incluindo super_admin) altera qualquer email; manager altera (exceto admins)
    const isCurrentUserAdmin = currentUser.super_admin === true || currentUser.user_type === 'admin';
    const isCurrentUserManager = currentUser.user_type === 'manager';

    console.log('🔍 Verificação de permissões:', {
      isCurrentUserAdmin,
      isCurrentUserManager,
      targetUserIsSuperAdmin: targetUser.super_admin
    });

    const hasPermission = isCurrentUserAdmin ||
      (isCurrentUserManager && !targetUser.super_admin);

    if (!hasPermission) {
      console.error('❌ Permissão negada');
      return new Response(
        JSON.stringify({ error: 'Permissão negada: apenas administradores ou gestores podem alterar emails' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se o novo email já está em uso
    const { data: existingUser } = await supabaseAdmin
      .from('settings_users')
      .select('id')
      .eq('email', newEmail)
      .neq('id', userId)
      .single();

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'Este email já está em uso por outro usuário' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atualizar email no sistema de autenticação usando service role
    console.log('🔄 Alterando email do usuário no auth...');
    const { data: updateAuthData, error: emailError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserAuthId,
      { email: newEmail }
    );

    if (emailError) {
      console.error('❌ Erro ao alterar email no auth:', emailError);
      return new Response(
        JSON.stringify({ error: 'Erro ao alterar email: ' + emailError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atualizar email na tabela settings_users
    console.log('🔄 Alterando email na tabela settings_users...');
    const { error: updateTableError } = await supabaseAdmin
      .from('settings_users')
      .update({ email: newEmail })
      .eq('id', userId);

    if (updateTableError) {
      console.error('❌ Erro ao alterar email na tabela:', updateTableError);
      // Tentar reverter a alteração no auth
      await supabaseAdmin.auth.admin.updateUserById(
        targetUserAuthId,
        { email: updateAuthData.user.email }
      );
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar email na base de dados' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Email alterado com sucesso');

    // Log de auditoria
    console.log('📝 Log de auditoria:', {
      action: 'email_change',
      performed_by: currentUser.id,
      target_user: targetUser.id,
      new_email: newEmail,
      timestamp: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email alterado com sucesso',
        data: updateAuthData 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('💥 Erro interno na função:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor: ' + error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
