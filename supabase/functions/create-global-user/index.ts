import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-session-management, x-supabase-api-version, x-requested-with, prefer",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

// Input validation schema
const CreateUserSchema = z.object({
  nome: z.string()
    .min(1, "Nome é obrigatório")
    .max(100, "Nome deve ter no máximo 100 caracteres")
    .trim(),
  email: z.string()
    .email("Email inválido")
    .max(255, "Email deve ter no máximo 255 caracteres")
    .toLowerCase()
    .trim(),
  password: z.string()
    .min(8, "Senha deve ter no mínimo 8 caracteres")
    .max(72, "Senha deve ter no máximo 72 caracteres"),
  phone: z.string()
    .max(20, "Telefone deve ter no máximo 20 caracteres")
    .optional()
    .nullable(),
  super_admin: z.boolean().optional().default(false),
  user_type: z.enum(['admin', 'manager', 'user']).optional(),
  project_ids: z.array(z.string().uuid()).optional().default([]),
});

type CreateGlobalUserRequest = z.infer<typeof CreateUserSchema>;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Admin client (service role)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ========== AUTHORIZATION CHECK ==========
    // Verify the calling user has permission to create users
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: callingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !callingUser) {
      console.error('Failed to verify calling user:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if calling user has admin/manager permissions
    const { data: callingUserProfile, error: profileError } = await supabaseAdmin
      .from('settings_users')
      .select('super_admin, user_type')
      .eq('auth_user_id', callingUser.id)
      .single();

    if (profileError || !callingUserProfile) {
      console.error('Failed to fetch calling user profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isAdmin = callingUserProfile.super_admin === true || callingUserProfile.user_type === 'admin';
    const isManager = callingUserProfile.user_type === 'manager';

    if (!isAdmin && !isManager) {
      console.error('Unauthorized: User does not have permission to create users', {
        userId: callingUser.id,
        super_admin: callingUserProfile.super_admin,
        user_type: callingUserProfile.user_type
      });
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Only admins or managers can create users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // ========== END AUTHORIZATION CHECK ==========

    // ========== INPUT VALIDATION ==========
    let validatedInput: CreateGlobalUserRequest;
    try {
      const rawBody = await req.json();
      validatedInput = CreateUserSchema.parse(rawBody);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        const errorMessages = validationError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        console.error('Input validation failed:', errorMessages);
        return new Response(
          JSON.stringify({ error: `Validação falhou: ${errorMessages}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw validationError;
    }

    const { nome, email, password, phone, super_admin, user_type, project_ids } = validatedInput;

    const finalUserType = user_type ?? 'user';
    // ========== END INPUT VALIDATION ==========

    // Prevent non-super_admin from creating super_admin users
    if (super_admin && !isAdmin) {
      console.error('Unauthorized: Only super admins can create other super admin users');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Only super admins can create admin users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating user with auth:', email, 'by:', callingUser.email);

    let userId: string | null = null;

    const { data: authUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: nome, email }
    });

    if (createAuthError) {
      const isEmailExists = (createAuthError as any)?.code === 'email_exists' || (createAuthError as any)?.status === 422;
      if (!isEmailExists) {
        console.error('Auth user creation error:', createAuthError);
        return new Response(
          JSON.stringify({ error: `Erro ao criar usuário: ${createAuthError.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Email já cadastrado. Tentando localizar usuário existente por email...');
      const perPage = 100;
      for (let page = 1; page <= 10; page++) {
        const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
        if (listError) {
          console.error('Erro ao listar usuários:', listError);
          break;
        }
        const found = listData?.users?.find((u: any) => (u.email || '').toLowerCase() === email.toLowerCase());
        if (found) {
          userId = found.id;
          console.log('Usuário existente localizado:', userId);
          break;
        }
        if (!listData || listData.users.length < perPage) break;
      }

      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'E-mail já cadastrado e não foi possível localizar o usuário.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      if (!authUser?.user) {
        return new Response(
          JSON.stringify({ error: 'Falha ao criar usuário no auth' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userId = authUser.user.id;
      console.log('User created successfully:', userId);
    }

    // Check if profile already exists in settings_users by email first
    const { data: existingProfileByEmail } = await supabaseAdmin
      .from('settings_users')
      .select('*')
      .eq('email', email)
      .maybeSingle();
    
    // Also check by auth_user_id
    const { data: existingProfileByAuth } = await supabaseAdmin
      .from('settings_users')
      .select('*')
      .eq('auth_user_id', userId)
      .maybeSingle();
    
    const existingProfile = existingProfileByEmail || existingProfileByAuth;

    let settingsUser = existingProfile;

    if (existingProfile) {
      // Update existing profile with auth_user_id if needed
      console.log('Profile already exists, updating:', existingProfile.id);
      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from('settings_users')
        .update({
          auth_user_id: userId,
          name: nome,
          phone: phone || null,
          user_type: finalUserType,
          active: true
        })
        .eq('id', existingProfile.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating user profile:', updateError);
      } else {
        settingsUser = updatedUser;
      }
    } else {
      // Create new profile in settings_users
      const { data: newUser, error: profileCreateError } = await supabaseAdmin
        .from('settings_users')
        .insert({
          auth_user_id: userId,
          name: nome,
          email: email,
          phone: phone || null,
          active: true,
          super_admin: super_admin || false,
          user_type: finalUserType
        })
        .select()
        .single();

      if (profileCreateError) {
        console.error('Error creating user profile:', profileCreateError);
        return new Response(
          JSON.stringify({ error: `Erro ao criar perfil: ${profileCreateError.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      settingsUser = newUser;
    }

    // ========== CREATE CLIENT PROJECT LINKS ==========
    // If user_type is 'user' and project_ids are provided, link them to projects
    if (finalUserType === 'user' && project_ids && project_ids.length > 0 && settingsUser) {
      console.log('Creating client project links for:', settingsUser.id, 'projects:', project_ids);
      
      // Get caller's settings_users id for created_by
      const { data: callerProfile } = await supabaseAdmin
        .from('settings_users')
        .select('id')
        .eq('auth_user_id', callingUser.id)
        .single();

      // Insert project links with all permissions enabled for clients
      for (const projectId of project_ids) {
        const { error: linkError } = await supabaseAdmin
          .from('client_user_projects')
          .insert({
            user_id: settingsUser.id,
            project_id: projectId,
            can_view: true,
            can_edit_tasks: true,
            can_create_tasks: true,
            can_comment: true,
            created_by: callerProfile?.id || null
          });

        if (linkError) {
          console.error('Error creating client project link:', linkError);
          // Don't fail the whole request, just log the error
        }
      }
    }
    // ========== END CLIENT PROJECT LINKS ==========

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: { id: userId, email },
        settingsUser: settingsUser
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Erro na create-global-user:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
