-- ============================================
-- ETAPA 10: CONSTRAINTS (Versão Corrigida)
-- ============================================

-- ============================================
-- UNIQUE CONSTRAINTS (com verificação)
-- ============================================

-- clients_companies.tax_id
ALTER TABLE public.clients_companies 
  DROP CONSTRAINT IF EXISTS clients_companies_tax_id_key;
ALTER TABLE public.clients_companies 
  ADD CONSTRAINT clients_companies_tax_id_key UNIQUE (tax_id);

-- score_framings.name
ALTER TABLE public.score_framings 
  DROP CONSTRAINT IF EXISTS score_framings_name_key;
ALTER TABLE public.score_framings 
  ADD CONSTRAINT score_framings_name_key UNIQUE (name);

-- score_investments.name
ALTER TABLE public.score_investments 
  DROP CONSTRAINT IF EXISTS score_investments_name_key;
ALTER TABLE public.score_investments 
  ADD CONSTRAINT score_investments_name_key UNIQUE (name);

-- score_objectives.name
ALTER TABLE public.score_objectives 
  DROP CONSTRAINT IF EXISTS score_objectives_name_key;
ALTER TABLE public.score_objectives 
  ADD CONSTRAINT score_objectives_name_key UNIQUE (name);

-- settings_users.email
ALTER TABLE public.settings_users 
  DROP CONSTRAINT IF EXISTS settings_users_email_key;
ALTER TABLE public.settings_users 
  ADD CONSTRAINT settings_users_email_key UNIQUE (email);

-- settings_users.auth_user_id
ALTER TABLE public.settings_users 
  DROP CONSTRAINT IF EXISTS settings_users_auth_user_id_key;
ALTER TABLE public.settings_users 
  ADD CONSTRAINT settings_users_auth_user_id_key UNIQUE (auth_user_id);

-- whatsapp_templates.slug
ALTER TABLE public.whatsapp_templates 
  DROP CONSTRAINT IF EXISTS whatsapp_templates_slug_key;
ALTER TABLE public.whatsapp_templates 
  ADD CONSTRAINT whatsapp_templates_slug_key UNIQUE (slug);

-- user_roles unique combo
ALTER TABLE public.user_roles 
  DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
ALTER TABLE public.user_roles 
  ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);

-- ============================================
-- CHECK CONSTRAINTS (com verificação)
-- ============================================

-- leads.status
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_status_check 
  CHECK (status = ANY (ARRAY['em-andamento'::text, 'ganho'::text, 'perdido'::text, 'arquivado'::text]));

-- meetings.status
ALTER TABLE public.meetings DROP CONSTRAINT IF EXISTS meetings_status_check;
ALTER TABLE public.meetings ADD CONSTRAINT meetings_status_check 
  CHECK (status = ANY (ARRAY['agendada'::text, 'realizada'::text, 'cancelada'::text, 'remarcada'::text]));

-- messages constraints
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_from_contact_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_from_contact_check 
  CHECK (from_contact = ANY (ARRAY['cliente'::text, 'humano'::text, 'ia'::text]));

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_message_type_check 
  CHECK (message_type = ANY (ARRAY['texto'::text, 'audio'::text, 'imagem'::text, 'video'::text, 'documento'::text]));

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_status_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_status_check 
  CHECK (status = ANY (ARRAY['pendente'::text, 'enviada'::text, 'entregue'::text, 'lida'::text, 'erro'::text]));

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_channel_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_channel_check 
  CHECK (channel = ANY (ARRAY['whatsapp'::text, 'email'::text, 'sms'::text]));

-- sends.status
ALTER TABLE public.sends DROP CONSTRAINT IF EXISTS sends_status_check;
ALTER TABLE public.sends ADD CONSTRAINT sends_status_check 
  CHECK (status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'running'::text, 'paused'::text, 'completed'::text, 'failed'::text]));

-- sends_contacts.status
ALTER TABLE public.sends_contacts DROP CONSTRAINT IF EXISTS sends_contacts_status_check;
ALTER TABLE public.sends_contacts ADD CONSTRAINT sends_contacts_status_check 
  CHECK (status = ANY (ARRAY['pending'::text, 'sent'::text, 'delivered'::text, 'read'::text, 'error'::text]));

-- settings_schedules.day_of_week
ALTER TABLE public.settings_schedules DROP CONSTRAINT IF EXISTS settings_schedules_day_of_week_check;
ALTER TABLE public.settings_schedules ADD CONSTRAINT settings_schedules_day_of_week_check 
  CHECK (day_of_week >= 0 AND day_of_week <= 6);

-- settings_teams.team_type
ALTER TABLE public.settings_teams DROP CONSTRAINT IF EXISTS settings_teams_team_type_check;
ALTER TABLE public.settings_teams ADD CONSTRAINT settings_teams_team_type_check 
  CHECK (team_type = ANY (ARRAY['vendas'::text, 'atendimento'::text, 'suporte'::text, 'outro'::text]));

-- settings_users.user_type
ALTER TABLE public.settings_users DROP CONSTRAINT IF EXISTS settings_users_user_type_check;
ALTER TABLE public.settings_users ADD CONSTRAINT settings_users_user_type_check 
  CHECK (user_type = ANY (ARRAY['gestor'::text, 'atendente'::text]));