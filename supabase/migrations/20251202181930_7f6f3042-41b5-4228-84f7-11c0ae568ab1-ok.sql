-- ============================================
-- ETAPA 5: POLÍTICAS RLS
-- ============================================

-- ----------------------------------------
-- POLÍTICAS PARA SETTINGS
-- ----------------------------------------
CREATE POLICY "authenticated_read" ON public.settings
  FOR SELECT USING (true);

CREATE POLICY "authenticated_write" ON public.settings
  FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------
-- POLÍTICAS PARA SETTINGS_USERS
-- ----------------------------------------
CREATE POLICY "users_select_policy" ON public.settings_users
  FOR SELECT USING (
    auth.uid() = auth_user_id 
    OR public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "users_insert_policy" ON public.settings_users
  FOR INSERT WITH CHECK (
    auth.uid() = auth_user_id 
    OR public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "users_update_policy" ON public.settings_users
  FOR UPDATE USING (
    auth.uid() = auth_user_id 
    OR public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'manager')
  ) WITH CHECK (
    auth.uid() = auth_user_id 
    OR public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "users_delete_policy" ON public.settings_users
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- ----------------------------------------
-- POLÍTICAS PADRÃO PARA OUTRAS TABELAS
-- (authenticated_read e authenticated_write)
-- ----------------------------------------

-- settings_teams
CREATE POLICY "authenticated_read" ON public.settings_teams FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.settings_teams FOR ALL USING (true) WITH CHECK (true);

-- settings_users_teams
CREATE POLICY "authenticated_read" ON public.settings_users_teams FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.settings_users_teams FOR ALL USING (true) WITH CHECK (true);

-- settings_schedules
CREATE POLICY "authenticated_read" ON public.settings_schedules FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.settings_schedules FOR ALL USING (true) WITH CHECK (true);

-- settings_system_modules
CREATE POLICY "authenticated_read" ON public.settings_system_modules FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.settings_system_modules FOR ALL USING (true) WITH CHECK (true);

-- clients_people
CREATE POLICY "authenticated_read" ON public.clients_people FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.clients_people FOR ALL USING (true) WITH CHECK (true);

-- clients_people_updates
CREATE POLICY "authenticated_read" ON public.clients_people_updates FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.clients_people_updates FOR ALL USING (true) WITH CHECK (true);

-- clients_companies
CREATE POLICY "authenticated_read" ON public.clients_companies FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.clients_companies FOR ALL USING (true) WITH CHECK (true);

-- leads_pipelines
CREATE POLICY "authenticated_read" ON public.leads_pipelines FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.leads_pipelines FOR ALL USING (true) WITH CHECK (true);

-- leads_stages
CREATE POLICY "authenticated_read" ON public.leads_stages FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.leads_stages FOR ALL USING (true) WITH CHECK (true);

-- leads_stages_followups
CREATE POLICY "authenticated_read" ON public.leads_stages_followups FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.leads_stages_followups FOR ALL USING (true) WITH CHECK (true);

-- leads_loss_reasons
CREATE POLICY "authenticated_read" ON public.leads_loss_reasons FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.leads_loss_reasons FOR ALL USING (true) WITH CHECK (true);

-- leads
CREATE POLICY "authenticated_read" ON public.leads FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.leads FOR ALL USING (true) WITH CHECK (true);

-- leads_notes
CREATE POLICY "authenticated_read" ON public.leads_notes FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.leads_notes FOR ALL USING (true) WITH CHECK (true);

-- leads_files
CREATE POLICY "authenticated_read" ON public.leads_files FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.leads_files FOR ALL USING (true) WITH CHECK (true);

-- leads_updates
CREATE POLICY "authenticated_read" ON public.leads_updates FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.leads_updates FOR ALL USING (true) WITH CHECK (true);

-- meetings
CREATE POLICY "authenticated_read" ON public.meetings FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.meetings FOR ALL USING (true) WITH CHECK (true);

-- messages
CREATE POLICY "authenticated_read" ON public.messages FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.messages FOR ALL USING (true) WITH CHECK (true);

-- score_objectives
CREATE POLICY "authenticated_read" ON public.score_objectives FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.score_objectives FOR ALL USING (true) WITH CHECK (true);

-- score_investments
CREATE POLICY "authenticated_read" ON public.score_investments FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.score_investments FOR ALL USING (true) WITH CHECK (true);

-- score_framings
CREATE POLICY "authenticated_read" ON public.score_framings FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.score_framings FOR ALL USING (true) WITH CHECK (true);

-- score_matrix
CREATE POLICY "authenticated_read" ON public.score_matrix FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.score_matrix FOR ALL USING (true) WITH CHECK (true);

-- sends
CREATE POLICY "authenticated_read" ON public.sends FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.sends FOR ALL USING (true) WITH CHECK (true);

-- sends_contacts
CREATE POLICY "authenticated_read" ON public.sends_contacts FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.sends_contacts FOR ALL USING (true) WITH CHECK (true);

-- webhooks
CREATE POLICY "authenticated_read" ON public.webhooks FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.webhooks FOR ALL USING (true) WITH CHECK (true);

-- webhook_logs
CREATE POLICY "authenticated_read" ON public.webhook_logs FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.webhook_logs FOR ALL USING (true) WITH CHECK (true);

-- whatsapp_templates
CREATE POLICY "authenticated_read" ON public.whatsapp_templates FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.whatsapp_templates FOR ALL USING (true) WITH CHECK (true);

-- ai_agents
CREATE POLICY "authenticated_read" ON public.ai_agents FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.ai_agents FOR ALL USING (true) WITH CHECK (true);

-- ai_agents_history
CREATE POLICY "authenticated_read" ON public.ai_agents_history FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.ai_agents_history FOR ALL USING (true) WITH CHECK (true);

-- ai_agents_steps
CREATE POLICY "authenticated_read" ON public.ai_agents_steps FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.ai_agents_steps FOR ALL USING (true) WITH CHECK (true);

-- ai_agents_steps_history
CREATE POLICY "authenticated_read" ON public.ai_agents_steps_history FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.ai_agents_steps_history FOR ALL USING (true) WITH CHECK (true);

-- ai_agents_score_matrix
CREATE POLICY "authenticated_read" ON public.ai_agents_score_matrix FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.ai_agents_score_matrix FOR ALL USING (true) WITH CHECK (true);