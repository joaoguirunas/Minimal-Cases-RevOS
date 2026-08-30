import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Verify the requesting user is authenticated
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Check if requesting user has admin or manager role using settings_users
    const { data: currentUser, error: currentUserError } = await supabaseAdmin
      .from('settings_users')
      .select('id, super_admin, user_type')
      .eq('auth_user_id', user.id)
      .single()
    
    if (currentUserError || !currentUser) {
      console.error('Error fetching current user:', currentUserError)
      throw new Error('User profile not found')
    }

    const isAdmin = currentUser.super_admin === true || currentUser.user_type === 'admin'
    const isManager = currentUser.user_type === 'manager'

    if (!isAdmin && !isManager) {
      console.error('Unauthorized delete attempt by user:', user.id)
      throw new Error('Only administrators and managers can delete users')
    }

    console.log(`User deletion authorized: ${user.id} (admin: ${isAdmin}, manager: ${isManager})`)

    // Get the user ID to delete from request body
    const { userId } = await req.json()
    
    if (!userId) {
      throw new Error('User ID is required')
    }

    // Get the settings_users record to find auth_user_id
    const { data: settingsUser, error: fetchError } = await supabaseAdmin
      .from('settings_users')
      .select('auth_user_id')
      .eq('id', userId)
      .single()

    if (fetchError) {
      console.error('Error fetching user:', fetchError)
      throw new Error('User not found')
    }

    const targetAuthId = settingsUser?.auth_user_id

    // 1) Soft delete in settings_users and remove the auth_user_id FK reference
    const { error: updateError } = await supabaseAdmin
      .from('settings_users')
      .update({ 
        active: false, 
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
        auth_user_id: null
      })
      .eq('id', userId)

    if (updateError) {
      console.error('Error updating settings_users:', updateError)
      throw new Error('Failed to deactivate user in database')
    }

    // 2) Delete from auth.users only if the user had an auth account
    if (targetAuthId) {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
        targetAuthId
      )

      if (deleteError) {
        console.error('Error deleting auth user:', deleteError)
        throw new Error('Failed to delete user from authentication system')
      }
    } else {
      console.log(`User ${userId} has no auth_user_id, skipping auth deletion`)
    }

    return new Response(
      JSON.stringify({ success: true, message: 'User deleted successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('Error in delete-user function:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'An error occurred while deleting the user' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
