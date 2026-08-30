-- ============================================
-- ETAPA 4: ÍNDICES DE PERFORMANCE
-- ============================================

-- Índices para settings_users
CREATE INDEX idx_settings_users_auth_user_id ON public.settings_users(auth_user_id);
CREATE INDEX idx_settings_users_email ON public.settings_users(email);
CREATE INDEX idx_settings_users_active ON public.settings_users(active);

-- Índices para settings_users_teams
CREATE INDEX idx_settings_users_teams_user_id ON public.settings_users_teams(user_id);
CREATE INDEX idx_settings_users_teams_team_id ON public.settings_users_teams(team_id);

-- Índices para settings_schedules
CREATE INDEX idx_settings_schedules_user_id ON public.settings_schedules(user_id);

-- Índices para clients_people
CREATE INDEX idx_clients_people_whatsapp ON public.clients_people(whatsapp);
CREATE INDEX idx_clients_people_email ON public.clients_people(email);
CREATE INDEX idx_clients_people_status ON public.clients_people(status);
CREATE INDEX idx_clients_people_archived ON public.clients_people(archived);
CREATE INDEX idx_clients_people_score_matrix ON public.clients_people(score_matrix_id);

-- Índices para clients_people_updates
CREATE INDEX idx_clients_people_updates_people_id ON public.clients_people_updates(people_id);

-- Índices para leads_stages
CREATE INDEX idx_leads_stages_pipeline_id ON public.leads_stages(leads_pipelines_id);
CREATE INDEX idx_leads_stages_order ON public.leads_stages(order_index);

-- Índices para leads_stages_followups
CREATE INDEX idx_leads_stages_followups_stage_id ON public.leads_stages_followups(stage_id);

-- Índices para leads
CREATE INDEX idx_leads_people_id ON public.leads(people_id);
CREATE INDEX idx_leads_pipeline_id ON public.leads(leads_pipelines_id);
CREATE INDEX idx_leads_stage_id ON public.leads(leads_stages_id);
CREATE INDEX idx_leads_user_id ON public.leads(users_id);
CREATE INDEX idx_leads_team_id ON public.leads(teams_id);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_archived ON public.leads(archived);
CREATE INDEX idx_leads_created_at ON public.leads(created_at DESC);

-- Índices para leads_notes
CREATE INDEX idx_leads_notes_leads_id ON public.leads_notes(leads_id);

-- Índices para leads_files
CREATE INDEX idx_leads_files_leads_id ON public.leads_files(leads_id);

-- Índices para leads_updates
CREATE INDEX idx_leads_updates_leads_id ON public.leads_updates(leads_id);
CREATE INDEX idx_leads_updates_created_at ON public.leads_updates(created_at DESC);

-- Índices para meetings
CREATE INDEX idx_meetings_people_id ON public.meetings(people_id);
CREATE INDEX idx_meetings_leads_id ON public.meetings(leads_id);
CREATE INDEX idx_meetings_users_id ON public.meetings(users_id);
CREATE INDEX idx_meetings_start_time ON public.meetings(start_time);
CREATE INDEX idx_meetings_status ON public.meetings(status);

-- Índices para messages
CREATE INDEX idx_messages_people_id ON public.messages(people_id);
CREATE INDEX idx_messages_leads_id ON public.messages(leads_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX idx_messages_status ON public.messages(status);

-- Índices para sends
CREATE INDEX idx_sends_status ON public.sends(status);
CREATE INDEX idx_sends_created_by ON public.sends(created_by);
CREATE INDEX idx_sends_pipeline_id ON public.sends(pipeline_id);

-- Índices para sends_contacts
CREATE INDEX idx_sends_contacts_send_id ON public.sends_contacts(send_id);
CREATE INDEX idx_sends_contacts_people_id ON public.sends_contacts(people_id);
CREATE INDEX idx_sends_contacts_status ON public.sends_contacts(status);

-- Índices para webhooks
CREATE INDEX idx_webhooks_event_type ON public.webhooks(event_type);
CREATE INDEX idx_webhooks_active ON public.webhooks(active);

-- Índices para webhook_logs
CREATE INDEX idx_webhook_logs_webhook_id ON public.webhook_logs(webhook_id);
CREATE INDEX idx_webhook_logs_created_at ON public.webhook_logs(created_at DESC);

-- Índices para ai_agents
CREATE INDEX idx_ai_agents_pipeline_id ON public.ai_agents(pipeline_id);
CREATE INDEX idx_ai_agents_active ON public.ai_agents(active);

-- Índices para ai_agents_steps
CREATE INDEX idx_ai_agents_steps_agent_id ON public.ai_agents_steps(ai_agent_id);
CREATE INDEX idx_ai_agents_steps_stage_id ON public.ai_agents_steps(stage_id);

-- Índices para ai_agents_steps_history
CREATE INDEX idx_ai_agents_steps_history_step_id ON public.ai_agents_steps_history(step_id);
CREATE INDEX idx_ai_agents_steps_history_leads_id ON public.ai_agents_steps_history(leads_id);