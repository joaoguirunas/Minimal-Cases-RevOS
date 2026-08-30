-- ============================================
-- SECURITY FIX: Restrict RLS policies for leads and related tables
-- This migration fixes PUBLIC_DATA_EXPOSURE vulnerability by implementing
-- proper owner/team-based access controls
-- ============================================

-- ============================================
-- 1. LEADS TABLE - Core CRM data
-- ============================================
DROP POLICY IF EXISTS "authenticated_read" ON public.leads;
DROP POLICY IF EXISTS "authenticated_write" ON public.leads;

-- Users can read their own leads, leads assigned to their teams, or all if admin
CREATE POLICY "users_read_own_leads" ON public.leads
FOR SELECT TO authenticated
USING (
  is_admin_or_gestor()
  OR users_id = get_current_settings_user_id()
  OR teams_id IN (
    SELECT team_id 
    FROM settings_users_teams 
    WHERE user_id = get_current_settings_user_id()
  )
);

-- Allow inserting leads - assignment validation can be done via triggers
CREATE POLICY "users_insert_leads" ON public.leads
FOR INSERT TO authenticated
WITH CHECK (true);

-- Users can update their own leads or leads in their teams
CREATE POLICY "users_update_own_leads" ON public.leads
FOR UPDATE TO authenticated
USING (
  is_admin_or_gestor()
  OR users_id = get_current_settings_user_id()
  OR teams_id IN (
    SELECT team_id 
    FROM settings_users_teams 
    WHERE user_id = get_current_settings_user_id()
  )
)
WITH CHECK (
  is_admin_or_gestor()
  OR users_id = get_current_settings_user_id()
  OR teams_id IN (
    SELECT team_id 
    FROM settings_users_teams 
    WHERE user_id = get_current_settings_user_id()
  )
);

-- Only admins can delete leads
CREATE POLICY "admins_delete_leads" ON public.leads
FOR DELETE TO authenticated
USING (is_admin_or_gestor());

-- ============================================
-- 2. LEADS_NOTES TABLE - Private notes about leads
-- ============================================
DROP POLICY IF EXISTS "authenticated_read" ON public.leads_notes;
DROP POLICY IF EXISTS "authenticated_write" ON public.leads_notes;

CREATE POLICY "users_read_lead_notes" ON public.leads_notes
FOR SELECT TO authenticated
USING (
  is_admin_or_gestor()
  OR EXISTS (
    SELECT 1 FROM leads l
    WHERE l.id = leads_notes.leads_id
    AND (
      l.users_id = get_current_settings_user_id()
      OR l.teams_id IN (
        SELECT team_id 
        FROM settings_users_teams 
        WHERE user_id = get_current_settings_user_id()
      )
    )
  )
);

CREATE POLICY "users_manage_lead_notes" ON public.leads_notes
FOR ALL TO authenticated
USING (
  is_admin_or_gestor()
  OR EXISTS (
    SELECT 1 FROM leads l
    WHERE l.id = leads_notes.leads_id
    AND (
      l.users_id = get_current_settings_user_id()
      OR l.teams_id IN (
        SELECT team_id 
        FROM settings_users_teams 
        WHERE user_id = get_current_settings_user_id()
      )
    )
  )
)
WITH CHECK (
  is_admin_or_gestor()
  OR EXISTS (
    SELECT 1 FROM leads l
    WHERE l.id = leads_notes.leads_id
    AND (
      l.users_id = get_current_settings_user_id()
      OR l.teams_id IN (
        SELECT team_id 
        FROM settings_users_teams 
        WHERE user_id = get_current_settings_user_id()
      )
    )
  )
);

-- ============================================
-- 3. LEADS_FILES TABLE - Documents attached to leads
-- ============================================
DROP POLICY IF EXISTS "authenticated_read" ON public.leads_files;
DROP POLICY IF EXISTS "authenticated_write" ON public.leads_files;

CREATE POLICY "users_read_lead_files" ON public.leads_files
FOR SELECT TO authenticated
USING (
  is_admin_or_gestor()
  OR EXISTS (
    SELECT 1 FROM leads l
    WHERE l.id = leads_files.leads_id
    AND (
      l.users_id = get_current_settings_user_id()
      OR l.teams_id IN (
        SELECT team_id 
        FROM settings_users_teams 
        WHERE user_id = get_current_settings_user_id()
      )
    )
  )
);

CREATE POLICY "users_manage_lead_files" ON public.leads_files
FOR ALL TO authenticated
USING (
  is_admin_or_gestor()
  OR EXISTS (
    SELECT 1 FROM leads l
    WHERE l.id = leads_files.leads_id
    AND (
      l.users_id = get_current_settings_user_id()
      OR l.teams_id IN (
        SELECT team_id 
        FROM settings_users_teams 
        WHERE user_id = get_current_settings_user_id()
      )
    )
  )
)
WITH CHECK (
  is_admin_or_gestor()
  OR EXISTS (
    SELECT 1 FROM leads l
    WHERE l.id = leads_files.leads_id
    AND (
      l.users_id = get_current_settings_user_id()
      OR l.teams_id IN (
        SELECT team_id 
        FROM settings_users_teams 
        WHERE user_id = get_current_settings_user_id()
      )
    )
  )
);

-- ============================================
-- 4. MESSAGES TABLE - Customer communications
-- ============================================
DROP POLICY IF EXISTS "authenticated_read" ON public.messages;
DROP POLICY IF EXISTS "authenticated_write" ON public.messages;

CREATE POLICY "users_read_lead_messages" ON public.messages
FOR SELECT TO authenticated
USING (
  is_admin_or_gestor()
  OR EXISTS (
    SELECT 1 FROM leads l
    WHERE l.id = messages.leads_id
    AND (
      l.users_id = get_current_settings_user_id()
      OR l.teams_id IN (
        SELECT team_id 
        FROM settings_users_teams 
        WHERE user_id = get_current_settings_user_id()
      )
    )
  )
  -- Also allow access if user is the message sender
  OR users_id = get_current_settings_user_id()
);

CREATE POLICY "users_manage_lead_messages" ON public.messages
FOR ALL TO authenticated
USING (
  is_admin_or_gestor()
  OR EXISTS (
    SELECT 1 FROM leads l
    WHERE l.id = messages.leads_id
    AND (
      l.users_id = get_current_settings_user_id()
      OR l.teams_id IN (
        SELECT team_id 
        FROM settings_users_teams 
        WHERE user_id = get_current_settings_user_id()
      )
    )
  )
  OR users_id = get_current_settings_user_id()
)
WITH CHECK (
  is_admin_or_gestor()
  OR EXISTS (
    SELECT 1 FROM leads l
    WHERE l.id = messages.leads_id
    AND (
      l.users_id = get_current_settings_user_id()
      OR l.teams_id IN (
        SELECT team_id 
        FROM settings_users_teams 
        WHERE user_id = get_current_settings_user_id()
      )
    )
  )
  OR users_id = get_current_settings_user_id()
);

-- ============================================
-- 5. AI_AGENTS TABLE - Admin-only management
-- ============================================
DROP POLICY IF EXISTS "authenticated_read" ON public.ai_agents;
DROP POLICY IF EXISTS "authenticated_write" ON public.ai_agents;

-- Admins can manage all agents, users can only read active ones
CREATE POLICY "admins_manage_ai_agents" ON public.ai_agents
FOR ALL TO authenticated
USING (is_admin_or_gestor())
WITH CHECK (is_admin_or_gestor());

CREATE POLICY "users_read_active_agents" ON public.ai_agents
FOR SELECT TO authenticated
USING (active = true OR is_admin_or_gestor());

-- ============================================
-- 6. AI_AGENTS_STEPS TABLE - Admin-only management
-- ============================================
DROP POLICY IF EXISTS "authenticated_read" ON public.ai_agents_steps;
DROP POLICY IF EXISTS "authenticated_write" ON public.ai_agents_steps;

CREATE POLICY "admins_manage_ai_agents_steps" ON public.ai_agents_steps
FOR ALL TO authenticated
USING (is_admin_or_gestor())
WITH CHECK (is_admin_or_gestor());

CREATE POLICY "users_read_active_agent_steps" ON public.ai_agents_steps
FOR SELECT TO authenticated
USING (
  active = true 
  OR is_admin_or_gestor()
  OR EXISTS (
    SELECT 1 FROM ai_agents a 
    WHERE a.id = ai_agents_steps.ai_agent_id 
    AND a.active = true
  )
);

-- ============================================
-- 7. AI_AGENTS_HISTORY TABLE - Admin-only access
-- ============================================
DROP POLICY IF EXISTS "authenticated_read" ON public.ai_agents_history;
DROP POLICY IF EXISTS "authenticated_write" ON public.ai_agents_history;

CREATE POLICY "admins_manage_ai_agents_history" ON public.ai_agents_history
FOR ALL TO authenticated
USING (is_admin_or_gestor())
WITH CHECK (is_admin_or_gestor());

-- ============================================
-- 8. MEETINGS TABLE - Restrict to assigned user/team
-- ============================================
DROP POLICY IF EXISTS "authenticated_read" ON public.meetings;
DROP POLICY IF EXISTS "authenticated_write" ON public.meetings;

CREATE POLICY "users_read_own_meetings" ON public.meetings
FOR SELECT TO authenticated
USING (
  is_admin_or_gestor()
  OR users_id = get_current_settings_user_id()
  OR teams_id IN (
    SELECT team_id 
    FROM settings_users_teams 
    WHERE user_id = get_current_settings_user_id()
  )
  -- Also allow if meeting is linked to a lead the user owns
  OR EXISTS (
    SELECT 1 FROM leads l
    WHERE l.id = meetings.leads_id
    AND (
      l.users_id = get_current_settings_user_id()
      OR l.teams_id IN (
        SELECT team_id 
        FROM settings_users_teams 
        WHERE user_id = get_current_settings_user_id()
      )
    )
  )
);

CREATE POLICY "users_manage_own_meetings" ON public.meetings
FOR ALL TO authenticated
USING (
  is_admin_or_gestor()
  OR users_id = get_current_settings_user_id()
  OR teams_id IN (
    SELECT team_id 
    FROM settings_users_teams 
    WHERE user_id = get_current_settings_user_id()
  )
)
WITH CHECK (
  is_admin_or_gestor()
  OR users_id = get_current_settings_user_id()
  OR teams_id IN (
    SELECT team_id 
    FROM settings_users_teams 
    WHERE user_id = get_current_settings_user_id()
  )
);