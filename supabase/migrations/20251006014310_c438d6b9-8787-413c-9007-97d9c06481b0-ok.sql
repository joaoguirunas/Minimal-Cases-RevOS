-- ============================================
-- CRIAR ESTRUTURA clients_* (sem migração de dados)
-- ============================================

-- NOTA: As tabelas crm_* já foram removidas na migração anterior
-- Criando apenas a estrutura nova sem migrar dados

-- 1. clients_companies
CREATE TABLE IF NOT EXISTS public.clients_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_name text NOT NULL,
  legal_name text,
  tax_id text,
  phone text,
  email text,
  website text,
  notes text,
  status text DEFAULT 'ativo',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clients_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_companies_access_policy" ON public.clients_companies FOR ALL USING (true);

-- 2. clients_people
CREATE TABLE IF NOT EXISTS public.clients_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  whatsapp text,
  document text,
  source text DEFAULT 'manual',
  status text DEFAULT 'ativo',
  service_status text DEFAULT 'aberto',
  notes text,
  moment text,
  goal text,
  income text,
  type text,
  score integer,
  disc_profile text,
  disc_summary text,
  conversation_summary text,
  summary_message_counter integer DEFAULT 0,
  ai_enabled boolean DEFAULT true,
  accepts_calls boolean DEFAULT true,
  whatsapp_remote_id text,
  external_crm_person_id text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clients_people ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_people_access_policy" ON public.clients_people FOR ALL USING (true);

-- 3. clients_people_companies
CREATE TABLE IF NOT EXISTS public.clients_people_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  people_id uuid NOT NULL REFERENCES public.clients_people(id) ON DELETE CASCADE,
  companies_id uuid NOT NULL REFERENCES public.clients_companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clients_people_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_people_companies_access_policy" ON public.clients_people_companies FOR ALL USING (true);

-- 4. clients_pipelines
CREATE TABLE IF NOT EXISTS public.clients_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clients_pipelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_pipelines_access_policy" ON public.clients_pipelines FOR ALL USING (true);

-- 5. clients_stages
CREATE TABLE IF NOT EXISTS public.clients_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipelines_id uuid NOT NULL REFERENCES public.clients_pipelines(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_index integer NOT NULL,
  color text DEFAULT '#3B82F6',
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clients_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_stages_access_policy" ON public.clients_stages FOR ALL USING (true);

-- 6. clients_loss_reasons
CREATE TABLE IF NOT EXISTS public.clients_loss_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clients_loss_reasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_loss_reasons_access_policy" ON public.clients_loss_reasons FOR ALL USING (true);

-- 7. clients_leads
CREATE TABLE IF NOT EXISTS public.clients_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  people_id uuid NOT NULL REFERENCES public.clients_people(id) ON DELETE CASCADE,
  companies_id uuid REFERENCES public.clients_companies(id) ON DELETE SET NULL,
  pipelines_id uuid NOT NULL REFERENCES public.clients_pipelines(id) ON DELETE CASCADE,
  stages_id uuid NOT NULL REFERENCES public.clients_stages(id) ON DELETE CASCADE,
  users_id uuid,
  teams_id uuid,
  title text,
  value numeric,
  status text DEFAULT 'em-andamento',
  control text,
  loss_reason text,
  loss_reasons_id uuid REFERENCES public.clients_loss_reasons(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  won_at timestamptz,
  last_interaction_at timestamptz,
  followup_attempts integer DEFAULT 0,
  followup_status text,
  ai_blocked boolean DEFAULT false,
  ai_blocked_until timestamptz,
  last_interaction text,
  external_crm_lead_id text,
  metadata jsonb DEFAULT '{}',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  fbclid text,
  gclid text
);

ALTER TABLE public.clients_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_leads_access_policy" ON public.clients_leads FOR ALL USING (true);

-- 8. clients_messages
CREATE TABLE IF NOT EXISTS public.clients_messages (
  id serial PRIMARY KEY,
  leads_id uuid NOT NULL REFERENCES public.clients_leads(id) ON DELETE CASCADE,
  people_id uuid REFERENCES public.clients_people(id) ON DELETE SET NULL,
  users_id uuid,
  followup_id uuid,
  content text NOT NULL,
  from_contact text NOT NULL,
  channel text DEFAULT 'whatsapp',
  message_type text DEFAULT 'texto',
  audio_url text,
  transcription text,
  audio_duration integer,
  llm text,
  tokens_qty integer,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clients_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_messages_access_policy" ON public.clients_messages FOR ALL USING (true);

-- 9. clients_meetings
CREATE TABLE IF NOT EXISTS public.clients_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leads_id uuid NOT NULL REFERENCES public.clients_leads(id) ON DELETE CASCADE,
  users_id uuid,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  notes text,
  status text DEFAULT 'agendado',
  source text DEFAULT 'manual',
  location text,
  quantity bigint,
  attendees text[],
  google_meet_link text,
  calendar_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clients_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_meetings_access_policy" ON public.clients_meetings FOR ALL USING (true);

-- 10. clients_files
CREATE TABLE IF NOT EXISTS public.clients_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leads_id uuid NOT NULL REFERENCES public.clients_leads(id) ON DELETE CASCADE,
  users_id uuid,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clients_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_files_access_policy" ON public.clients_files FOR ALL USING (true);

-- 11. clients_notes
CREATE TABLE IF NOT EXISTS public.clients_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leads_id uuid NOT NULL REFERENCES public.clients_leads(id) ON DELETE CASCADE,
  users_id uuid,
  title text NOT NULL,
  content text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clients_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_notes_access_policy" ON public.clients_notes FOR ALL USING (true);

-- 12. clients_stages_followups
CREATE TABLE IF NOT EXISTS public.clients_stages_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stages_id uuid NOT NULL REFERENCES public.clients_stages(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'texto',
  days integer NOT NULL DEFAULT 0,
  hours integer NOT NULL DEFAULT 0,
  minutes integer NOT NULL DEFAULT 0,
  message text,
  subject text,
  audio_file text,
  template_id text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clients_stages_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_stages_followups_access_policy" ON public.clients_stages_followups FOR ALL USING (true);

-- 13. clients_meetings_followups
CREATE TABLE IF NOT EXISTS public.clients_meetings_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_status text NOT NULL,
  type text NOT NULL DEFAULT 'texto',
  days integer NOT NULL DEFAULT 0,
  hours integer NOT NULL DEFAULT 0,
  minutes integer NOT NULL DEFAULT 0,
  message text,
  subject text,
  audio_file text,
  template_id text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clients_meetings_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_meetings_followups_access_policy" ON public.clients_meetings_followups FOR ALL USING (true);