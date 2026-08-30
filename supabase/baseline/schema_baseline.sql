-- ============================================================
-- RevOS — Schema Baseline
-- Project : Growth Sales | REV OS (ohzwetkaazgxafubzvop)
-- Generated: 2026-04-10 (via Supabase Management API)
-- Purpose  : Baseline para provisionamento de novos clientes
--            Use este arquivo em vez de replay das migrations.
-- ============================================================
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA extensions; -- v1.6
CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA extensions; -- v1.5.11
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA extensions; -- v0.14.0
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA extensions; -- v1.11
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions; -- v1.3
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA extensions; -- v1.0
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA extensions; -- v0.3.1
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions; -- v1.1

-- ============================================================
-- ENUMS / TYPES
-- ============================================================
CREATE TYPE auth.aal_level AS ENUM ('aal1', 'aal2', 'aal3');
CREATE TYPE auth.code_challenge_method AS ENUM ('s256', 'plain');
CREATE TYPE auth.factor_status AS ENUM ('unverified', 'verified');
CREATE TYPE auth.factor_type AS ENUM ('totp', 'webauthn', 'phone');
CREATE TYPE auth.oauth_authorization_status AS ENUM ('pending', 'approved', 'denied', 'expired');
CREATE TYPE auth.oauth_client_type AS ENUM ('public', 'confidential');
CREATE TYPE auth.oauth_registration_type AS ENUM ('dynamic', 'manual');
CREATE TYPE auth.oauth_response_type AS ENUM ('code');
CREATE TYPE auth.one_time_token_type AS ENUM ('confirmation_token', 'reauthentication_token', 'recovery_token', 'email_change_token_new', 'email_change_token_current', 'phone_change_token');
CREATE TYPE storage.buckettype AS ENUM ('STANDARD', 'ANALYTICS', 'VECTOR');

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS auth.audit_log_entries (
  instance_id uuid,
  id uuid NOT NULL,
  payload json,
  created_at timestamp with time zone,
  ip_address character varying(64) NOT NULL DEFAULT ''::character varying
);

CREATE TABLE IF NOT EXISTS auth.custom_oauth_providers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider_type text NOT NULL,
  identifier text NOT NULL,
  name text NOT NULL,
  client_id text NOT NULL,
  client_secret text NOT NULL,
  acceptable_client_ids text[] NOT NULL DEFAULT '{}'::text[],
  scopes text[] NOT NULL DEFAULT '{}'::text[],
  pkce_enabled boolean NOT NULL DEFAULT true,
  attribute_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  authorization_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  email_optional boolean NOT NULL DEFAULT false,
  issuer text,
  discovery_url text,
  skip_nonce_check boolean NOT NULL DEFAULT false,
  cached_discovery jsonb,
  discovery_cached_at timestamp with time zone,
  authorization_url text,
  token_url text,
  userinfo_url text,
  jwks_uri text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth.flow_state (
  id uuid NOT NULL,
  user_id uuid,
  auth_code text,
  code_challenge_method code_challenge_method,
  code_challenge text,
  provider_type text NOT NULL,
  provider_access_token text,
  provider_refresh_token text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  authentication_method text NOT NULL,
  auth_code_issued_at timestamp with time zone,
  invite_token text,
  referrer text,
  oauth_client_state_id uuid,
  linking_target_id uuid,
  email_optional boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS auth.identities (
  provider_id text NOT NULL,
  user_id uuid NOT NULL,
  identity_data jsonb NOT NULL,
  provider text NOT NULL,
  last_sign_in_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  email text,
  id uuid NOT NULL DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS auth.instances (
  id uuid NOT NULL,
  uuid uuid,
  raw_base_config text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS auth.mfa_amr_claims (
  session_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  authentication_method text NOT NULL,
  id uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS auth.mfa_challenges (
  id uuid NOT NULL,
  factor_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL,
  verified_at timestamp with time zone,
  ip_address inet NOT NULL,
  otp_code text,
  web_authn_session_data jsonb
);

CREATE TABLE IF NOT EXISTS auth.mfa_factors (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  friendly_name text,
  factor_type factor_type NOT NULL,
  status factor_status NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  secret text,
  phone text,
  last_challenged_at timestamp with time zone,
  web_authn_credential jsonb,
  web_authn_aaguid uuid,
  last_webauthn_challenge_data jsonb
);

CREATE TABLE IF NOT EXISTS auth.oauth_authorizations (
  id uuid NOT NULL,
  authorization_id text NOT NULL,
  client_id uuid NOT NULL,
  user_id uuid,
  redirect_uri text NOT NULL,
  scope text NOT NULL,
  state text,
  resource text,
  code_challenge text,
  code_challenge_method code_challenge_method,
  response_type oauth_response_type NOT NULL DEFAULT 'code'::auth.oauth_response_type,
  status oauth_authorization_status NOT NULL DEFAULT 'pending'::auth.oauth_authorization_status,
  authorization_code text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + '00:03:00'::interval),
  approved_at timestamp with time zone,
  nonce text
);

CREATE TABLE IF NOT EXISTS auth.oauth_client_states (
  id uuid NOT NULL,
  provider_type text NOT NULL,
  code_verifier text,
  created_at timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS auth.oauth_clients (
  id uuid NOT NULL,
  client_secret_hash text,
  registration_type oauth_registration_type NOT NULL,
  redirect_uris text NOT NULL,
  grant_types text NOT NULL,
  client_name text,
  client_uri text,
  logo_uri text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  client_type oauth_client_type NOT NULL DEFAULT 'confidential'::auth.oauth_client_type,
  token_endpoint_auth_method text NOT NULL
);

CREATE TABLE IF NOT EXISTS auth.oauth_consents (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  client_id uuid NOT NULL,
  scopes text NOT NULL,
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  revoked_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS auth.one_time_tokens (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  token_type one_time_token_type NOT NULL,
  token_hash text NOT NULL,
  relates_to text NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
  instance_id uuid,
  id bigint NOT NULL DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass),
  token character varying(255),
  user_id character varying(255),
  revoked boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  parent character varying(255),
  session_id uuid
);

CREATE TABLE IF NOT EXISTS auth.saml_providers (
  id uuid NOT NULL,
  sso_provider_id uuid NOT NULL,
  entity_id text NOT NULL,
  metadata_xml text NOT NULL,
  metadata_url text,
  attribute_mapping jsonb,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  name_id_format text
);

CREATE TABLE IF NOT EXISTS auth.saml_relay_states (
  id uuid NOT NULL,
  sso_provider_id uuid NOT NULL,
  request_id text NOT NULL,
  for_email text,
  redirect_to text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  flow_state_id uuid
);

CREATE TABLE IF NOT EXISTS auth.schema_migrations (
  version character varying(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS auth.sessions (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  factor_id uuid,
  aal aal_level,
  not_after timestamp with time zone,
  refreshed_at timestamp without time zone,
  user_agent text,
  ip inet,
  tag text,
  oauth_client_id uuid,
  refresh_token_hmac_key text,
  refresh_token_counter bigint,
  scopes text
);

CREATE TABLE IF NOT EXISTS auth.sso_domains (
  id uuid NOT NULL,
  sso_provider_id uuid NOT NULL,
  domain text NOT NULL,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS auth.sso_providers (
  id uuid NOT NULL,
  resource_id text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  disabled boolean
);

CREATE TABLE IF NOT EXISTS auth.users (
  instance_id uuid,
  id uuid NOT NULL,
  aud character varying(255),
  role character varying(255),
  email character varying(255),
  encrypted_password character varying(255),
  email_confirmed_at timestamp with time zone,
  invited_at timestamp with time zone,
  confirmation_token character varying(255),
  confirmation_sent_at timestamp with time zone,
  recovery_token character varying(255),
  recovery_sent_at timestamp with time zone,
  email_change_token_new character varying(255),
  email_change character varying(255),
  email_change_sent_at timestamp with time zone,
  last_sign_in_at timestamp with time zone,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  is_super_admin boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  phone text DEFAULT NULL::character varying,
  phone_confirmed_at timestamp with time zone,
  phone_change text DEFAULT ''::character varying,
  phone_change_token character varying(255) DEFAULT ''::character varying,
  phone_change_sent_at timestamp with time zone,
  confirmed_at timestamp with time zone,
  email_change_token_current character varying(255) DEFAULT ''::character varying,
  email_change_confirm_status smallint DEFAULT 0,
  banned_until timestamp with time zone,
  reauthentication_token character varying(255) DEFAULT ''::character varying,
  reauthentication_sent_at timestamp with time zone,
  is_sso_user boolean NOT NULL DEFAULT false,
  deleted_at timestamp with time zone,
  is_anonymous boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS auth.webauthn_challenges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  challenge_type text NOT NULL,
  session_data jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS auth.webauthn_credentials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credential_id bytea NOT NULL,
  public_key bytea NOT NULL,
  attestation_type text NOT NULL DEFAULT ''::text,
  aaguid uuid,
  sign_count bigint NOT NULL DEFAULT 0,
  transports jsonb NOT NULL DEFAULT '[]'::jsonb,
  backup_eligible boolean NOT NULL DEFAULT false,
  backed_up boolean NOT NULL DEFAULT false,
  friendly_name text NOT NULL DEFAULT ''::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  last_used_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public._app_config (
  key text NOT NULL,
  value text NOT NULL
);

CREATE TABLE IF NOT EXISTS public._meta_debug (
  id bigint NOT NULL DEFAULT nextval('_meta_debug_id_seq'::regclass),
  created_at timestamp with time zone DEFAULT now(),
  raw_body text,
  object text,
  entry_count integer,
  first_entry jsonb
);

CREATE TABLE IF NOT EXISTS public.adm_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  actor_email text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  entity_name text,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.adm_clients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  supabase_url text NOT NULL,
  anon_key text NOT NULL,
  service_role_key text,
  db_password text,
  status text NOT NULL DEFAULT 'active'::text,
  sync_status text NOT NULL DEFAULT 'never'::text,
  last_synced_at timestamp with time zone,
  contact_name text,
  contact_email text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  custom_domain text,
  enabled_modules jsonb,
  db_version text,
  app_version text,
  management_token text,
  service_role_key_hint text,
  db_password_hint text,
  management_token_hint text
);

CREATE TABLE IF NOT EXISTS public.adm_migration_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  migration_id uuid NOT NULL,
  applied_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'success'::text,
  error text
);

CREATE TABLE IF NOT EXISTS public.adm_migrations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sql_content text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.adm_sync_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  triggered_by text NOT NULL DEFAULT 'manual'::text,
  type text NOT NULL DEFAULT 'full'::text,
  status text NOT NULL DEFAULT 'pending'::text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.adm_sync_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  level text NOT NULL DEFAULT 'info'::text,
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_agents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  identity text,
  input_data text,
  general_rules text,
  pipeline_id uuid,
  score_value integer,
  current_version integer DEFAULT 1,
  use_stages boolean DEFAULT false,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  leads_stages_id uuid,
  score_matrix_ids uuid[] DEFAULT '{}'::uuid[],
  is_template boolean DEFAULT false,
  template_type text,
  prompt_blocks jsonb,
  enabled_tools text[],
  llm_provider text NOT NULL DEFAULT 'openai'::text,
  llm_model text NOT NULL DEFAULT 'gpt-4o-mini'::text,
  llm_temperature double precision NOT NULL DEFAULT 0.7,
  llm_max_tokens integer NOT NULL DEFAULT 1024,
  llm_provider_id uuid,
  memory_window integer NOT NULL DEFAULT 20,
  wa_phone_number_id text,
  buffer_ms integer NOT NULL DEFAULT 3000,
  wa_channel_id uuid,
  channel_types text[] NOT NULL DEFAULT '{}'::text[],
  stage_ids text[] NOT NULL DEFAULT '{}'::text[],
  score_allow_empty boolean NOT NULL DEFAULT false,
  pipeline_ids text[],
  humanizacao text NOT NULL DEFAULT 'media'::text,
  elevenlabs_agent_id uuid,
  voice_enabled boolean DEFAULT false,
  voice_id text,
  agent_type text DEFAULT 'text'::text,
  voice_first_message text,
  voice_language text DEFAULT 'pt'::text,
  voice_model_id text,
  voice_stability real DEFAULT 0.5,
  voice_similarity real DEFAULT 0.75,
  voice_speed real DEFAULT 1.0,
  el_sync_status text DEFAULT 'not_applicable'::text,
  el_last_synced_at timestamp with time zone,
  voice_response_mode text NOT NULL DEFAULT 'mirror'::text
);

CREATE TABLE IF NOT EXISTS public.ai_agents_execution_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ai_agent_id uuid NOT NULL,
  people_id uuid NOT NULL,
  prompt_rendered text NOT NULL,
  tools_used text[] DEFAULT '{}'::text[],
  execution_status text NOT NULL,
  execution_duration_ms integer,
  response_data jsonb,
  error_message text,
  created_at timestamp without time zone DEFAULT now(),
  created_by uuid,
  lead_id uuid
);

CREATE TABLE IF NOT EXISTS public.ai_agents_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ai_agent_id uuid,
  created_by uuid,
  version integer NOT NULL,
  data jsonb NOT NULL,
  changelog jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_agents_score_matrix (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ai_agent_id uuid,
  score_matrix_id uuid,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_agents_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ai_agent_id uuid,
  name text NOT NULL,
  prompt text NOT NULL,
  control text,
  order_index integer NOT NULL,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_agents_steps_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  step_id uuid,
  lead_id uuid,
  success boolean,
  result jsonb,
  error_message text,
  executed_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bi_ad_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  account_id text NOT NULL,
  account_name text,
  access_token text,
  refresh_token text,
  token_expires_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  last_sync_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.bi_ad_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  campaign_id text NOT NULL,
  campaign_name text,
  status text,
  objective text,
  spend numeric DEFAULT 0,
  impressions bigint DEFAULT 0,
  clicks bigint DEFAULT 0,
  conversions bigint DEFAULT 0,
  revenue numeric DEFAULT 0,
  date_start date,
  date_end date,
  synced_at timestamp with time zone NOT NULL DEFAULT now(),
  ad_account_id uuid,
  platform text,
  utm_campaign text
);

CREATE TABLE IF NOT EXISTS public.bi_ad_daily_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  stat_date date NOT NULL,
  spend numeric DEFAULT 0,
  impressions bigint DEFAULT 0,
  clicks bigint DEFAULT 0,
  conversions bigint DEFAULT 0,
  revenue numeric DEFAULT 0,
  synced_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bi_ad_spend (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ad_account_id uuid NOT NULL,
  campaign_id uuid,
  platform text NOT NULL,
  date date NOT NULL,
  spend numeric NOT NULL DEFAULT 0,
  impressions integer,
  clicks integer,
  leads integer,
  currency text NOT NULL DEFAULT 'BRL'::text,
  raw_data jsonb,
  source text DEFAULT 'api'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bi_sdr_targets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL,
  daily_target integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bi_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  meta_app_id text,
  meta_app_secret text,
  google_client_id text,
  google_client_secret text,
  google_developer_token text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  ms_client_id text,
  ms_client_secret text,
  singleton boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.booking_rule_sets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  url_id smallint
);

CREATE TABLE IF NOT EXISTS public.booking_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  rule_set_id uuid NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  rule_type text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.call_pro_as_queues (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  priority_label text,
  color text DEFAULT '#6366f1'::text,
  as_queue_id text NOT NULL,
  as_token text NOT NULL,
  as_api_key text NOT NULL,
  as_user_id text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.call_pro_calls (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  as_call_id text,
  person_id uuid,
  user_id uuid,
  lead_id uuid,
  direction text NOT NULL,
  status text NOT NULL DEFAULT 'newcall'::text,
  from_number text,
  to_number text,
  duration integer DEFAULT 0,
  billed_duration integer DEFAULT 0,
  recording_url text,
  outcome text,
  tags text[] DEFAULT '{}'::text[],
  notes text DEFAULT ''::text,
  raw_payload jsonb DEFAULT '{}'::jsonb,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  answered_at timestamp with time zone,
  ended_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  as_request_id text,
  cost numeric,
  business_hours_call boolean
);

CREATE TABLE IF NOT EXISTS public.call_pro_operator_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  extension text NOT NULL DEFAULT ''::text,
  as_email text NOT NULL DEFAULT ''::text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_online boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.call_pro_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  webhook_secret text NOT NULL DEFAULT ''::text,
  outbound_webhook_url text NOT NULL DEFAULT ''::text,
  auto_link_leads boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  allowed_tags text[] NOT NULL DEFAULT '{}'::text[],
  as_dialer_token text
);

CREATE TABLE IF NOT EXISTS public.call_pro_tabulation_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  label text NOT NULL,
  color text NOT NULL DEFAULT '#6B7280'::text,
  icon text NOT NULL DEFAULT 'tag'::text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.canned_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  shortcut text,
  content text NOT NULL,
  channels text[] DEFAULT ARRAY['whatsapp'::text, 'instagram'::text],
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clients_companies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  trade_name text NOT NULL,
  legal_name text,
  tax_id text,
  email text,
  phone text,
  website text,
  address text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clients_people (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  whatsapp text,
  document text,
  type text,
  notes text,
  status text DEFAULT 'active'::text,
  service_status text DEFAULT 'open'::text,
  source text,
  accepts_calls boolean DEFAULT true,
  ai_enabled boolean DEFAULT true,
  archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  score integer,
  score_matrix_id uuid,
  income text,
  moment text,
  goal text,
  disc_profile text,
  disc_summary text,
  conversation_summary text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  q1_main_bottleneck text,
  q2_lead_volume_month text,
  q3_team_size text,
  q4_crm_maturity text,
  q5_crm_name text,
  q6_trigger text,
  q7_problem_impact text,
  q8_engagement_level text,
  q9_decision_authority text,
  q10_stakeholders text,
  q11_budget_approved text,
  q12_timeline text,
  q13_urgency_reason text,
  q14_data_ready text,
  q15_minimum_volume text,
  q16_expected_roi text,
  q17_objections text,
  q18_real_fit text,
  q19_qualification_status text,
  q20_rejection_reason text,
  q21_interest_level text,
  q22_close_probability text,
  q23_behavioral_tags text,
  q24_last_update_by_agent text,
  q25_disc_profile text,
  q26_disc_analysis text,
  instagram_user_id text,
  instagram_id text,
  telefone text,
  ai_last_message_at timestamp with time zone,
  ai_processing_lock boolean NOT NULL DEFAULT false,
  instagram_handle text,
  merged_into_id uuid,
  merge_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  instagram_business_id text,
  profile_picture text,
  instagram_followers integer,
  instagram_verified boolean DEFAULT false,
  prospect_campaign_id uuid,
  google_place_id text,
  google_maps_url text,
  google_rating numeric,
  google_review_count integer,
  website text,
  address text,
  business_category text,
  linkedin_url text,
  facebook_url text,
  youtube_url text,
  company_description text,
  enrichment_layers text[],
  identity_collection_opted_out boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.clients_people_companies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  people_id uuid,
  company_id uuid,
  role text,
  is_primary boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clients_people_updates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  people_id uuid,
  user_id uuid,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversion_event_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  trigger_type text NOT NULL,
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  meta_enabled boolean NOT NULL DEFAULT false,
  meta_pixel_id text,
  meta_event_name text,
  meta_send_value boolean NOT NULL DEFAULT false,
  google_enabled boolean NOT NULL DEFAULT false,
  google_account_id text,
  google_conversion_action_id text,
  google_conversion_action_name text,
  google_send_value boolean NOT NULL DEFAULT false,
  google_currency text NOT NULL DEFAULT 'BRL'::text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversion_events_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  stage_id uuid NOT NULL,
  lead_source text,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  meta_status text NOT NULL DEFAULT 'pending'::text,
  meta_response jsonb,
  meta_sent_at timestamp with time zone,
  google_status text NOT NULL DEFAULT 'pending'::text,
  google_response jsonb,
  google_sent_at timestamp with time zone,
  skip_reason text,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversion_platform_credentials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  platform text NOT NULL,
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversion_stage_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pipeline_id uuid NOT NULL,
  stage_id uuid NOT NULL,
  meta_enabled boolean NOT NULL DEFAULT false,
  meta_event_name text,
  meta_send_value boolean NOT NULL DEFAULT false,
  google_enabled boolean NOT NULL DEFAULT false,
  google_conversion_action text,
  google_send_value boolean NOT NULL DEFAULT false,
  google_currency text NOT NULL DEFAULT 'BRL'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.data_deletion_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending'::text,
  protocol text NOT NULL DEFAULT ((('DEL-'::text || to_char(now(), 'YYYYMMDD'::text)) || '-'::text) || substr((gen_random_uuid())::text, 1, 8)),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.elevenlabs_agents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  elevenlabs_agent_id text NOT NULL,
  name text,
  voice_id text,
  llm_provider text,
  llm_model text,
  phone_number_id text,
  phone_number text,
  first_message text,
  status text DEFAULT 'active'::text,
  ai_agent_id uuid,
  synced_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.elevenlabs_voices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  voice_id text NOT NULL,
  name text NOT NULL,
  category text,
  language text,
  description text,
  stability numeric DEFAULT 0.500,
  similarity_boost numeric DEFAULT 0.750,
  style numeric DEFAULT 0.000,
  speed numeric DEFAULT 1.000,
  preview_url text,
  is_default boolean DEFAULT false,
  synced_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  gender text,
  use_case text,
  labels jsonb DEFAULT '{}'::jsonb,
  source text DEFAULT 'workspace'::text
);

CREATE TABLE IF NOT EXISTS public.followup_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  followup_id uuid,
  meeting_followup_id uuid,
  lead_id uuid NOT NULL,
  person_id uuid,
  canal text NOT NULL,
  template_id text,
  message text,
  assunto text,
  phone_number text,
  source_type text NOT NULL DEFAULT 'stage'::text,
  scheduled_at timestamp with time zone NOT NULL,
  fired_at timestamp with time zone,
  status text NOT NULL DEFAULT 'pending'::text,
  message_id bigint,
  response_data jsonb,
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.form_pro_forms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  pipeline_id uuid,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  webhook_url text,
  webhook_secret text,
  create_contact boolean NOT NULL DEFAULT true,
  create_lead boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.form_pro_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ip text NOT NULL,
  ts timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.form_pro_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  page_id uuid,
  form_id uuid,
  lead_id uuid,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  ip_address inet,
  user_agent text,
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  people_id uuid,
  source text NOT NULL DEFAULT 'site'::text,
  meta_form_id uuid,
  gclid text,
  fbclid text,
  fbc text,
  fbp text,
  meta_leadgen_id text,
  meta_adgroup_id text
);

CREATE TABLE IF NOT EXISTS public.instagram_automation_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  automation_id uuid,
  automation_name text,
  trigger_type text,
  person_id uuid,
  person_name text,
  ig_message_id text,
  message_text text,
  filters_matched jsonb,
  action_executed text,
  status text NOT NULL DEFAULT 'success'::text,
  error_message text,
  executed_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.instagram_automations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  trigger_type text NOT NULL,
  filter_operator text NOT NULL DEFAULT 'any'::text,
  filters jsonb NOT NULL DEFAULT '[]'::jsonb,
  action_type text NOT NULL,
  action_dm_text text,
  action_comment_text text,
  cooldown_hours integer NOT NULL DEFAULT 24,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  action_comment_texts jsonb NOT NULL DEFAULT '[]'::jsonb,
  action_dm_quick_replies jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.lead_field_definitions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  key text NOT NULL,
  type text NOT NULL,
  category text NOT NULL,
  pipeline_id uuid,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  required boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  entity_type text NOT NULL DEFAULT 'negocio'::text,
  agent_managed boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.lead_field_values (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id uuid,
  field_definition_id uuid NOT NULL,
  value_text text,
  value_number numeric,
  value_boolean boolean,
  value_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  entity_type text NOT NULL DEFAULT 'negocio'::text,
  entity_id uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS public.leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text,
  description text,
  control text DEFAULT '1'::text,
  value numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'in_progress'::text,
  people_id uuid,
  company_id uuid,
  leads_pipelines_id uuid,
  leads_stages_id uuid,
  leads_loss_reasons_id uuid,
  loss_reason text,
  teams_id uuid,
  user_id uuid,
  archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  won_at timestamp with time zone,
  lost_at timestamp with time zone,
  last_interaction_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  gclid text,
  fbclid text,
  fb_lead_id text,
  fbc text,
  fbp text,
  lead_source text,
  pre_sale_temperature smallint,
  close_probability smallint,
  lifecycle_stage text DEFAULT 'lead'::text
);

CREATE TABLE IF NOT EXISTS public.leads_files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id uuid,
  user_id uuid,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size bigint,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leads_loss_reasons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leads_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id uuid,
  user_id uuid,
  title text,
  content text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leads_pipelines (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  order_index integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.leads_stages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  leads_pipelines_id uuid,
  name text NOT NULL,
  color text,
  order_index integer NOT NULL DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leads_stages_followups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  stage_id uuid,
  name text NOT NULL,
  message text NOT NULL,
  delay_minutes integer DEFAULT 60,
  whatsapp_template_id text,
  score_matrix_id uuid,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  control integer,
  target_stage_id uuid
);

CREATE TABLE IF NOT EXISTS public.leads_updates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id uuid,
  user_id uuid,
  from_stage_id uuid,
  to_stage_id uuid,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.meeting_followup_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL,
  meeting_id uuid NOT NULL,
  people_id uuid,
  lead_id uuid,
  scheduled_for timestamp with time zone NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  channel text NOT NULL,
  webhook_url text,
  message_snapshot text,
  fired_at timestamp with time zone,
  response_status integer,
  response_body text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  template_id uuid,
  as_queue_id uuid
);

CREATE TABLE IF NOT EXISTS public.meeting_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL,
  record_type text NOT NULL,
  source text,
  url text,
  duration_seconds integer,
  thumbnail_url text,
  title text,
  content text,
  content_format text DEFAULT 'markdown'::text,
  ai_sentiment text,
  ai_score integer,
  ai_key_topics text[],
  ai_next_steps text[],
  ai_objections text[],
  ai_metadata jsonb,
  recorded_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.meetings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  location text,
  meeting_link text,
  notes text,
  status text DEFAULT 'agendada'::text,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  people_id uuid,
  lead_id uuid,
  user_id uuid,
  teams_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  google_event_id text,
  google_last_synced_at timestamp with time zone,
  source text,
  outcome text,
  ms_meeting_id text,
  attendee_emails text[] DEFAULT '{}'::text[],
  gcal_sync_error text
);

CREATE TABLE IF NOT EXISTS public.meetings_followups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  meeting_status text NOT NULL,
  type text NOT NULL DEFAULT 'texto'::text,
  message text,
  subject text,
  template_id text,
  audio_file text,
  days integer NOT NULL DEFAULT 0,
  hours integer NOT NULL DEFAULT 0,
  minutes integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  control integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  name text,
  channel text NOT NULL DEFAULT 'whatsapp'::text,
  webhook_url text,
  as_queue_id uuid,
  whatsapp_template_id uuid
);

CREATE TABLE IF NOT EXISTS public.message_buffer (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  people_id uuid NOT NULL,
  messages jsonb[] NOT NULL DEFAULT '{}'::jsonb[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamp with time zone,
  wa_phone_number_id text,
  channel_type text
);

CREATE TABLE IF NOT EXISTS public.messages (
  id bigint NOT NULL DEFAULT nextval('messages_id_seq'::regclass),
  content text NOT NULL,
  from_contact text DEFAULT 'cliente'::text,
  message_type text DEFAULT 'texto'::text,
  status text DEFAULT 'sent'::text,
  channel text DEFAULT 'whatsapp'::text,
  media_url text,
  whatsapp_template_id text,
  followup_id uuid,
  people_id uuid,
  lead_id uuid,
  user_id uuid,
  sent_at timestamp with time zone,
  delivered_at timestamp with time zone,
  read_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  media_metadata jsonb,
  instagram_interaction_type text,
  post_id text,
  parent_message_id bigint,
  metadata jsonb,
  wa_message_id text,
  execution_id uuid,
  wa_phone_number_id text,
  source_type text,
  module_ref_id uuid,
  ig_message_id text
);

CREATE TABLE IF NOT EXISTS public.meta_lead_form_pages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  page_id text NOT NULL,
  page_name text NOT NULL,
  access_token text NOT NULL,
  subscribed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.meta_lead_forms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  page_id text NOT NULL,
  meta_form_id text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active'::text,
  field_mapping jsonb NOT NULL DEFAULT '[]'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  pipeline_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  synced_at timestamp with time zone,
  raw_questions jsonb DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.omni_channel_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  channel text NOT NULL,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info'::text,
  title text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.omni_channel_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  channel text NOT NULL,
  is_active boolean DEFAULT false,
  display_name text NOT NULL,
  credentials jsonb DEFAULT '{}'::jsonb,
  settings jsonb DEFAULT '{}'::jsonb,
  webhook_fallback jsonb DEFAULT '{}'::jsonb,
  business_hours jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.omni_delivery_dead_letter (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id integer NOT NULL,
  channel text NOT NULL,
  error_code text,
  error_message text,
  attempts integer DEFAULT 0,
  max_attempts integer DEFAULT 5,
  next_retry_at timestamp with time zone,
  status text NOT NULL DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.omni_outbound_webhooks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  channel text NOT NULL,
  url text NOT NULL,
  method text DEFAULT 'POST'::text,
  headers jsonb DEFAULT '{}'::jsonb,
  payload_template text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prospect_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid,
  contact_id uuid,
  action text NOT NULL,
  actor text NOT NULL DEFAULT 'system'::text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  establishment_id uuid
);

CREATE TABLE IF NOT EXISTS public.prospect_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source text NOT NULL DEFAULT 'google_maps'::text,
  actor_id text NOT NULL DEFAULT 'compass/crawler-google-places'::text,
  actor_input jsonb NOT NULL DEFAULT '{}'::jsonb,
  max_leads integer NOT NULL DEFAULT 100,
  target_pipeline_id uuid,
  target_stage_id uuid,
  enrichment_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  scoring_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft'::text,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  apify_run_id text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 3,
  provider text NOT NULL DEFAULT 'explorium'::text,
  provider_config jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.prospect_companies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  linkedin_url text,
  linkedin_id text,
  name text NOT NULL,
  industry text,
  description text,
  website text,
  headquarters text,
  employee_count_range text,
  founded_year integer,
  specialties text[],
  logo_url text,
  enrichment_data jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'raw'::text,
  company_id uuid,
  consent_basis text DEFAULT 'legitimate_interest'::text,
  data_retention_deadline timestamp with time zone DEFAULT (now() + '90 days'::interval),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  explorium_business_id text,
  domain text,
  country_code text,
  revenue_range text
);

CREATE TABLE IF NOT EXISTS public.prospect_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  name text,
  email text,
  phone text,
  company text,
  role text,
  website text,
  address text,
  segment text,
  google_rating numeric,
  google_review_count integer,
  google_place_id text,
  google_maps_url text,
  enrichment_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_score integer,
  ai_reasoning text,
  ai_tags text[],
  status text NOT NULL DEFAULT 'raw'::text,
  person_id uuid,
  lead_id uuid,
  consent_basis text NOT NULL DEFAULT 'legitimate_interest'::text,
  data_source text,
  opt_out_requested boolean NOT NULL DEFAULT false,
  data_retention_deadline timestamp with time zone,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prospect_enrichment_plugins (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  display_name text NOT NULL,
  provider text NOT NULL,
  actor_id text,
  config_schema jsonb,
  enabled boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prospect_enrichment_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL,
  plugin_id uuid NOT NULL,
  result jsonb NOT NULL,
  confidence numeric,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prospect_establishments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  legacy_contact_id uuid,
  company text,
  segment text,
  google_place_id text,
  google_maps_url text,
  google_rating numeric,
  google_review_count integer,
  address text,
  website text,
  enrichment_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_score integer,
  ai_reasoning text,
  ai_tags text[],
  status text NOT NULL DEFAULT 'raw'::text,
  company_id uuid,
  lead_id uuid,
  consent_basis text NOT NULL DEFAULT 'legitimate_interest'::text,
  data_source text,
  opt_out_requested boolean NOT NULL DEFAULT false,
  data_retention_deadline timestamp with time zone,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prospect_opt_out_registry (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email_hash text,
  phone_hash text,
  source text,
  registered_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prospect_people (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL,
  legacy_contact_id uuid,
  name text,
  email text,
  phone text,
  role text,
  linkedin_url text,
  facebook_url text,
  source text,
  enrichment_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  person_id uuid,
  consent_basis text NOT NULL DEFAULT 'legitimate_interest'::text,
  opt_out_requested boolean NOT NULL DEFAULT false,
  data_retention_deadline timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prospect_people_v2 (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid,
  campaign_id uuid NOT NULL,
  linkedin_url text,
  linkedin_id text,
  name text NOT NULL,
  headline text,
  current_role text,
  seniority text,
  department text,
  location text,
  profile_image_url text,
  email text,
  phone text,
  twitter_url text,
  enrichment_data jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'discovered'::text,
  selected boolean DEFAULT false,
  selected_at timestamp with time zone,
  person_id uuid,
  consent_basis text DEFAULT 'legitimate_interest'::text,
  data_retention_deadline timestamp with time zone DEFAULT (now() + '90 days'::interval),
  created_at timestamp with time zone DEFAULT now(),
  explorium_prospect_id text,
  job_level text
);

CREATE TABLE IF NOT EXISTS public.schedule_automations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  trigger_status text NOT NULL,
  pipeline_id uuid NOT NULL,
  target_pipeline_id uuid NOT NULL,
  target_stage_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.score_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text,
  order_index integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.score_category_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.score_matrix (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text,
  score_number integer NOT NULL,
  profile_score text,
  pre_description_score text,
  detail_score text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  category_selections jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.score_settings (
  key text NOT NULL,
  value text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sends (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  template_id text,
  status text DEFAULT 'draft'::text,
  pipeline_id uuid,
  stage_ids uuid[],
  team_id uuid,
  created_by uuid,
  total_contacts integer DEFAULT 0,
  sent_count integer DEFAULT 0,
  delivered_count integer DEFAULT 0,
  read_count integer DEFAULT 0,
  error_count integer DEFAULT 0,
  scheduled_at timestamp with time zone,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  channel text NOT NULL DEFAULT 'whatsapp'::text,
  filter_config jsonb,
  type text NOT NULL DEFAULT 'filtered'::text,
  send_interval_seconds integer NOT NULL DEFAULT 30,
  webhook_id uuid,
  failed_count integer NOT NULL DEFAULT 0,
  message_content text,
  wa_channel_id uuid
);

CREATE TABLE IF NOT EXISTS public.sends_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  send_id uuid,
  people_id uuid,
  whatsapp text NOT NULL,
  status text DEFAULT 'pending'::text,
  error_message text,
  sent_at timestamp with time zone,
  delivered_at timestamp with time zone,
  read_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  retry_count integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  logo_url text,
  primary_color text DEFAULT '#6366f1'::text,
  secondary_color text DEFAULT '#8b5cf6'::text,
  accent_color text DEFAULT '#ec4899'::text,
  email text,
  phone text,
  website text,
  address text,
  tax_id text,
  timezone text DEFAULT 'America/Sao_Paulo'::text,
  language text DEFAULT 'pt-br'::text,
  currency text DEFAULT 'BRL'::text,
  whatsapp_provider text DEFAULT 'whatsapp-oficial'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  apify_token text,
  google_client_id text,
  google_client_secret text,
  explorium_api_key text,
  apollo_api_key text,
  pdl_api_key text
);

CREATE TABLE IF NOT EXISTS public.settings_ai_providers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  label text NOT NULL,
  api_key text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.settings_elevenlabs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  api_key text,
  api_key_encrypted text,
  workspace_id text,
  default_model_id text DEFAULT 'eleven_flash_v2_5'::text,
  default_voice_id text,
  default_output_format text DEFAULT 'mp3_44100_128'::text,
  webhook_secret text,
  monthly_char_limit integer DEFAULT 100000,
  monthly_char_used integer DEFAULT 0,
  monthly_reset_at timestamp with time zone,
  active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.settings_omni_new_contact (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  channel text NOT NULL,
  auto_create_negocio boolean NOT NULL DEFAULT false,
  pipeline_id uuid,
  stage_id uuid,
  title_template text NOT NULL DEFAULT 'Nova conversa - {{nome}}'::text,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.settings_schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  day_of_week integer NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  is_available boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.settings_system_modules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  module_key text NOT NULL,
  module_name text NOT NULL,
  icon text,
  order_index integer NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.settings_teams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  team_type text DEFAULT 'vendas'::text,
  priority integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.settings_users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  auth_user_id uuid,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  avatar_url text,
  user_type text DEFAULT 'user'::text,
  super_admin boolean DEFAULT false,
  active boolean DEFAULT true,
  deleted_at timestamp with time zone,
  deleted_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.settings_users_teams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  team_id uuid,
  is_leader boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.settings_whatsapp_channels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  label text NOT NULL,
  phone_number_id text NOT NULL,
  access_token text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  app_secret text,
  waba_id text
);

CREATE TABLE IF NOT EXISTS public.user_calendar_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  google_email text NOT NULL,
  google_access_token text,
  google_refresh_token text NOT NULL,
  google_token_expires_at timestamp with time zone,
  google_calendar_id text NOT NULL DEFAULT 'primary'::text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  provider text NOT NULL DEFAULT 'google'::text,
  ms_access_token text,
  ms_refresh_token text,
  ms_token_expires_at timestamp with time zone,
  ms_user_id text,
  ms_email text
);

CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  webhook_id uuid,
  request_body jsonb,
  response_body jsonb,
  status_code integer,
  error_message text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.webhooks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  event_type text NOT NULL,
  headers jsonb,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  pipeline_id uuid,
  stage_ids uuid[] NOT NULL DEFAULT '{}'::uuid[]
);

CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  id_template text NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  status text DEFAULT 'active'::text,
  system_enabled boolean DEFAULT true,
  json_data jsonb,
  variables jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  meta_template_name text
);

CREATE TABLE IF NOT EXISTS storage.buckets (
  id text NOT NULL,
  name text NOT NULL,
  owner uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  public boolean DEFAULT false,
  avif_autodetection boolean DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[],
  owner_id text,
  type buckettype NOT NULL DEFAULT 'STANDARD'::storage.buckettype
);

CREATE TABLE IF NOT EXISTS storage.buckets_analytics (
  name text NOT NULL,
  type buckettype NOT NULL DEFAULT 'ANALYTICS'::storage.buckettype,
  format text NOT NULL DEFAULT 'ICEBERG'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS storage.buckets_vectors (
  id text NOT NULL,
  type buckettype NOT NULL DEFAULT 'VECTOR'::storage.buckettype,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage.migrations (
  id integer NOT NULL,
  name character varying(100) NOT NULL,
  hash character varying(40) NOT NULL,
  executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_accessed_at timestamp with time zone DEFAULT now(),
  metadata jsonb,
  path_tokens text[],
  version text,
  owner_id text,
  user_metadata jsonb
);

CREATE TABLE IF NOT EXISTS storage.s3_multipart_uploads (
  id text NOT NULL,
  in_progress_size bigint NOT NULL DEFAULT 0,
  upload_signature text NOT NULL,
  bucket_id text NOT NULL,
  key text NOT NULL,
  version text NOT NULL,
  owner_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_metadata jsonb,
  metadata jsonb
);

CREATE TABLE IF NOT EXISTS storage.s3_multipart_uploads_parts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  upload_id text NOT NULL,
  size bigint NOT NULL DEFAULT 0,
  part_number integer NOT NULL,
  bucket_id text NOT NULL,
  key text NOT NULL,
  etag text NOT NULL,
  owner_id text,
  version text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage.vector_indexes (
  id text NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  bucket_id text NOT NULL,
  data_type text NOT NULL,
  dimension integer NOT NULL,
  distance_metric text NOT NULL,
  metadata_configuration jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============================================================
-- PRIMARY KEYS & UNIQUE CONSTRAINTS
-- ============================================================
ALTER TABLE auth.audit_log_entries ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);
ALTER TABLE auth.custom_oauth_providers ADD CONSTRAINT custom_oauth_providers_pkey PRIMARY KEY (id);
ALTER TABLE auth.custom_oauth_providers ADD CONSTRAINT custom_oauth_providers_identifier_key UNIQUE (identifier);
ALTER TABLE auth.flow_state ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);
ALTER TABLE auth.identities ADD CONSTRAINT identities_pkey PRIMARY KEY (id);
ALTER TABLE auth.identities ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);
ALTER TABLE auth.instances ADD CONSTRAINT instances_pkey PRIMARY KEY (id);
ALTER TABLE auth.mfa_amr_claims ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);
ALTER TABLE auth.mfa_amr_claims ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);
ALTER TABLE auth.mfa_challenges ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);
ALTER TABLE auth.mfa_factors ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);
ALTER TABLE auth.mfa_factors ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);
ALTER TABLE auth.oauth_authorizations ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);
ALTER TABLE auth.oauth_authorizations ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);
ALTER TABLE auth.oauth_authorizations ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);
ALTER TABLE auth.oauth_client_states ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);
ALTER TABLE auth.oauth_clients ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);
ALTER TABLE auth.oauth_consents ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);
ALTER TABLE auth.oauth_consents ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);
ALTER TABLE auth.one_time_tokens ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);
ALTER TABLE auth.refresh_tokens ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);
ALTER TABLE auth.refresh_tokens ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);
ALTER TABLE auth.saml_providers ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);
ALTER TABLE auth.saml_providers ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);
ALTER TABLE auth.saml_relay_states ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);
ALTER TABLE auth.sessions ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);
ALTER TABLE auth.sso_domains ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);
ALTER TABLE auth.sso_providers ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);
ALTER TABLE auth.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE auth.users ADD CONSTRAINT users_phone_key UNIQUE (phone);
ALTER TABLE auth.webauthn_challenges ADD CONSTRAINT webauthn_challenges_pkey PRIMARY KEY (id);
ALTER TABLE auth.webauthn_credentials ADD CONSTRAINT webauthn_credentials_pkey PRIMARY KEY (id);
ALTER TABLE public._app_config ADD CONSTRAINT _app_config_pkey PRIMARY KEY (key);
ALTER TABLE public._meta_debug ADD CONSTRAINT _meta_debug_pkey PRIMARY KEY (id);
ALTER TABLE public.adm_audit_log ADD CONSTRAINT adm_audit_log_pkey PRIMARY KEY (id);
ALTER TABLE public.adm_clients ADD CONSTRAINT adm_clients_pkey PRIMARY KEY (id);
ALTER TABLE public.adm_clients ADD CONSTRAINT adm_clients_custom_domain_key UNIQUE (custom_domain);
ALTER TABLE public.adm_clients ADD CONSTRAINT adm_clients_slug_key UNIQUE (slug);
ALTER TABLE public.adm_migration_runs ADD CONSTRAINT adm_migration_runs_pkey PRIMARY KEY (id);
ALTER TABLE public.adm_migration_runs ADD CONSTRAINT adm_migration_runs_client_id_migration_id_key UNIQUE (client_id, migration_id);
ALTER TABLE public.adm_migrations ADD CONSTRAINT adm_migrations_pkey PRIMARY KEY (id);
ALTER TABLE public.adm_migrations ADD CONSTRAINT adm_migrations_name_key UNIQUE (name);
ALTER TABLE public.adm_sync_jobs ADD CONSTRAINT adm_sync_jobs_pkey PRIMARY KEY (id);
ALTER TABLE public.adm_sync_logs ADD CONSTRAINT adm_sync_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_agents_execution_log ADD CONSTRAINT ai_agents_execution_log_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_agents_history ADD CONSTRAINT ai_agents_history_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_agents_score_matrix ADD CONSTRAINT ai_agents_score_matrix_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_agents_steps ADD CONSTRAINT ai_agents_steps_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_agents_steps_history ADD CONSTRAINT ai_agents_steps_history_pkey PRIMARY KEY (id);
ALTER TABLE public.bi_ad_accounts ADD CONSTRAINT bi_ad_accounts_pkey PRIMARY KEY (id);
ALTER TABLE public.bi_ad_campaigns ADD CONSTRAINT bi_ad_campaigns_pkey PRIMARY KEY (id);
ALTER TABLE public.bi_ad_campaigns ADD CONSTRAINT bi_ad_campaigns_platform_campaign_id_key UNIQUE (platform, campaign_id);
ALTER TABLE public.bi_ad_daily_stats ADD CONSTRAINT bi_ad_daily_stats_pkey PRIMARY KEY (id);
ALTER TABLE public.bi_ad_daily_stats ADD CONSTRAINT bi_ad_daily_stats_campaign_id_stat_date_key UNIQUE (campaign_id, stat_date);
ALTER TABLE public.bi_ad_spend ADD CONSTRAINT bi_ad_spend_pkey PRIMARY KEY (id);
ALTER TABLE public.bi_ad_spend ADD CONSTRAINT bi_ad_spend_campaign_id_date_key UNIQUE (campaign_id, date);
ALTER TABLE public.bi_sdr_targets ADD CONSTRAINT bi_sdr_targets_pkey PRIMARY KEY (id);
ALTER TABLE public.bi_sdr_targets ADD CONSTRAINT bi_sdr_targets_user_id_year_month_key UNIQUE (user_id, year, month);
ALTER TABLE public.bi_settings ADD CONSTRAINT bi_settings_pkey PRIMARY KEY (id);
ALTER TABLE public.bi_settings ADD CONSTRAINT bi_settings_singleton_key UNIQUE (singleton);
ALTER TABLE public.booking_rule_sets ADD CONSTRAINT booking_rule_sets_pkey PRIMARY KEY (id);
ALTER TABLE public.booking_rules ADD CONSTRAINT booking_rules_pkey PRIMARY KEY (id);
ALTER TABLE public.call_pro_as_queues ADD CONSTRAINT call_pro_as_queues_pkey PRIMARY KEY (id);
ALTER TABLE public.call_pro_calls ADD CONSTRAINT call_pro_calls_pkey PRIMARY KEY (id);
ALTER TABLE public.call_pro_calls ADD CONSTRAINT call_pro_calls_as_call_id_key UNIQUE (as_call_id);
ALTER TABLE public.call_pro_operator_mappings ADD CONSTRAINT call_pro_operator_mappings_pkey PRIMARY KEY (id);
ALTER TABLE public.call_pro_operator_mappings ADD CONSTRAINT call_pro_operator_mappings_user_id_key UNIQUE (user_id);
ALTER TABLE public.call_pro_settings ADD CONSTRAINT call_pro_settings_pkey PRIMARY KEY (id);
ALTER TABLE public.call_pro_tabulation_categories ADD CONSTRAINT call_pro_tabulation_categories_pkey PRIMARY KEY (id);
ALTER TABLE public.canned_responses ADD CONSTRAINT canned_responses_pkey PRIMARY KEY (id);
ALTER TABLE public.clients_companies ADD CONSTRAINT clients_companies_pkey PRIMARY KEY (id);
ALTER TABLE public.clients_companies ADD CONSTRAINT clients_companies_tax_id_key UNIQUE (tax_id);
ALTER TABLE public.clients_people ADD CONSTRAINT clients_people_pkey PRIMARY KEY (id);
ALTER TABLE public.clients_people_companies ADD CONSTRAINT clients_people_companies_pkey PRIMARY KEY (id);
ALTER TABLE public.clients_people_companies ADD CONSTRAINT clients_people_companies_people_id_company_id_key UNIQUE (people_id, company_id);
ALTER TABLE public.clients_people_updates ADD CONSTRAINT clients_people_updates_pkey PRIMARY KEY (id);
ALTER TABLE public.conversion_event_rules ADD CONSTRAINT conversion_event_rules_pkey PRIMARY KEY (id);
ALTER TABLE public.conversion_events_queue ADD CONSTRAINT conversion_events_queue_pkey PRIMARY KEY (id);
ALTER TABLE public.conversion_platform_credentials ADD CONSTRAINT conversion_platform_credentials_pkey PRIMARY KEY (id);
ALTER TABLE public.conversion_platform_credentials ADD CONSTRAINT uq_user_platform UNIQUE (user_id, platform);
ALTER TABLE public.conversion_stage_mappings ADD CONSTRAINT conversion_stage_mappings_pkey PRIMARY KEY (id);
ALTER TABLE public.conversion_stage_mappings ADD CONSTRAINT uq_user_stage UNIQUE (user_id, stage_id);
ALTER TABLE public.data_deletion_requests ADD CONSTRAINT data_deletion_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.elevenlabs_agents ADD CONSTRAINT elevenlabs_agents_pkey PRIMARY KEY (id);
ALTER TABLE public.elevenlabs_agents ADD CONSTRAINT elevenlabs_agents_agent_id_unique UNIQUE (elevenlabs_agent_id);
ALTER TABLE public.elevenlabs_voices ADD CONSTRAINT elevenlabs_voices_pkey PRIMARY KEY (id);
ALTER TABLE public.elevenlabs_voices ADD CONSTRAINT elevenlabs_voices_voice_id_unique UNIQUE (voice_id);
ALTER TABLE public.followup_queue ADD CONSTRAINT followup_queue_pkey PRIMARY KEY (id);
ALTER TABLE public.form_pro_forms ADD CONSTRAINT lp_forms_pkey PRIMARY KEY (id);
ALTER TABLE public.form_pro_rate_limits ADD CONSTRAINT form_pro_rate_limits_pkey PRIMARY KEY (id);
ALTER TABLE public.form_pro_submissions ADD CONSTRAINT lp_submissions_pkey PRIMARY KEY (id);
ALTER TABLE public.instagram_automation_log ADD CONSTRAINT instagram_automation_log_pkey PRIMARY KEY (id);
ALTER TABLE public.instagram_automations ADD CONSTRAINT instagram_automations_pkey PRIMARY KEY (id);
ALTER TABLE public.lead_field_definitions ADD CONSTRAINT lead_field_definitions_pkey PRIMARY KEY (id);
ALTER TABLE public.lead_field_values ADD CONSTRAINT lead_field_values_pkey PRIMARY KEY (id);
ALTER TABLE public.lead_field_values ADD CONSTRAINT lead_field_values_entity_def_uniq UNIQUE (entity_type, entity_id, field_definition_id);
ALTER TABLE public.leads ADD CONSTRAINT leads_pkey1 PRIMARY KEY (id);
ALTER TABLE public.leads_files ADD CONSTRAINT leads_files_pkey PRIMARY KEY (id);
ALTER TABLE public.leads_loss_reasons ADD CONSTRAINT leads_loss_reasons_pkey PRIMARY KEY (id);
ALTER TABLE public.leads_notes ADD CONSTRAINT leads_notes_pkey PRIMARY KEY (id);
ALTER TABLE public.leads_pipelines ADD CONSTRAINT leads_pipelines_pkey PRIMARY KEY (id);
ALTER TABLE public.leads_stages ADD CONSTRAINT leads_stages_pkey PRIMARY KEY (id);
ALTER TABLE public.leads_stages_followups ADD CONSTRAINT leads_stages_followups_pkey PRIMARY KEY (id);
ALTER TABLE public.leads_updates ADD CONSTRAINT leads_updates_pkey PRIMARY KEY (id);
ALTER TABLE public.meeting_followup_queue ADD CONSTRAINT meeting_followup_queue_pkey PRIMARY KEY (id);
ALTER TABLE public.meeting_records ADD CONSTRAINT meeting_records_pkey PRIMARY KEY (id);
ALTER TABLE public.meetings ADD CONSTRAINT meetings_pkey PRIMARY KEY (id);
ALTER TABLE public.meetings_followups ADD CONSTRAINT meetings_followups_pkey PRIMARY KEY (id);
ALTER TABLE public.message_buffer ADD CONSTRAINT message_buffer_pkey PRIMARY KEY (id);
ALTER TABLE public.messages ADD CONSTRAINT messages_pkey PRIMARY KEY (id);
ALTER TABLE public.meta_lead_form_pages ADD CONSTRAINT meta_lead_form_pages_pkey PRIMARY KEY (id);
ALTER TABLE public.meta_lead_form_pages ADD CONSTRAINT meta_lead_form_pages_page_id_key UNIQUE (page_id);
ALTER TABLE public.meta_lead_forms ADD CONSTRAINT meta_lead_forms_pkey PRIMARY KEY (id);
ALTER TABLE public.meta_lead_forms ADD CONSTRAINT meta_lead_forms_meta_form_id_key UNIQUE (meta_form_id);
ALTER TABLE public.omni_channel_alerts ADD CONSTRAINT omni_channel_alerts_pkey PRIMARY KEY (id);
ALTER TABLE public.omni_channel_configs ADD CONSTRAINT omni_channel_configs_pkey PRIMARY KEY (id);
ALTER TABLE public.omni_channel_configs ADD CONSTRAINT omni_channel_configs_channel_key UNIQUE (channel);
ALTER TABLE public.omni_delivery_dead_letter ADD CONSTRAINT omni_delivery_dead_letter_pkey PRIMARY KEY (id);
ALTER TABLE public.omni_outbound_webhooks ADD CONSTRAINT omni_outbound_webhooks_pkey PRIMARY KEY (id);
ALTER TABLE public.prospect_audit_log ADD CONSTRAINT prospect_audit_log_pkey PRIMARY KEY (id);
ALTER TABLE public.prospect_campaigns ADD CONSTRAINT prospect_campaigns_pkey PRIMARY KEY (id);
ALTER TABLE public.prospect_companies ADD CONSTRAINT prospect_companies_pkey PRIMARY KEY (id);
ALTER TABLE public.prospect_companies ADD CONSTRAINT prospect_companies_campaign_id_linkedin_id_key UNIQUE (campaign_id, linkedin_id);
ALTER TABLE public.prospect_contacts ADD CONSTRAINT prospect_contacts_pkey PRIMARY KEY (id);
ALTER TABLE public.prospect_enrichment_plugins ADD CONSTRAINT prospect_enrichment_plugins_pkey PRIMARY KEY (id);
ALTER TABLE public.prospect_enrichment_plugins ADD CONSTRAINT prospect_enrichment_plugins_name_key UNIQUE (name);
ALTER TABLE public.prospect_enrichment_results ADD CONSTRAINT prospect_enrichment_results_pkey PRIMARY KEY (id);
ALTER TABLE public.prospect_enrichment_results ADD CONSTRAINT prospect_enrichment_results_person_id_plugin_id_key UNIQUE (person_id, plugin_id);
ALTER TABLE public.prospect_establishments ADD CONSTRAINT prospect_establishments_pkey PRIMARY KEY (id);
ALTER TABLE public.prospect_establishments ADD CONSTRAINT prospect_establishments_legacy_contact_id_key UNIQUE (legacy_contact_id);
ALTER TABLE public.prospect_opt_out_registry ADD CONSTRAINT prospect_opt_out_registry_pkey PRIMARY KEY (id);
ALTER TABLE public.prospect_opt_out_registry ADD CONSTRAINT prospect_opt_out_registry_email_hash_key UNIQUE (email_hash);
ALTER TABLE public.prospect_opt_out_registry ADD CONSTRAINT prospect_opt_out_registry_phone_hash_key UNIQUE (phone_hash);
ALTER TABLE public.prospect_people ADD CONSTRAINT prospect_people_pkey PRIMARY KEY (id);
ALTER TABLE public.prospect_people_v2 ADD CONSTRAINT prospect_people_v2_pkey PRIMARY KEY (id);
ALTER TABLE public.prospect_people_v2 ADD CONSTRAINT prospect_people_v2_campaign_id_linkedin_id_key UNIQUE (campaign_id, linkedin_id);
ALTER TABLE public.schedule_automations ADD CONSTRAINT schedule_automations_pkey PRIMARY KEY (id);
ALTER TABLE public.score_categories ADD CONSTRAINT score_categories_pkey PRIMARY KEY (id);
ALTER TABLE public.score_categories ADD CONSTRAINT score_categories_slug_key UNIQUE (slug);
ALTER TABLE public.score_category_items ADD CONSTRAINT score_category_items_pkey PRIMARY KEY (id);
ALTER TABLE public.score_matrix ADD CONSTRAINT score_matrix_pkey PRIMARY KEY (id);
ALTER TABLE public.score_settings ADD CONSTRAINT score_settings_pkey PRIMARY KEY (key);
ALTER TABLE public.sends ADD CONSTRAINT sends_pkey PRIMARY KEY (id);
ALTER TABLE public.sends_contacts ADD CONSTRAINT sends_contacts_pkey PRIMARY KEY (id);
ALTER TABLE public.settings ADD CONSTRAINT settings_pkey PRIMARY KEY (id);
ALTER TABLE public.settings_ai_providers ADD CONSTRAINT settings_ai_providers_pkey PRIMARY KEY (id);
ALTER TABLE public.settings_elevenlabs ADD CONSTRAINT settings_elevenlabs_pkey PRIMARY KEY (id);
ALTER TABLE public.settings_omni_new_contact ADD CONSTRAINT settings_omni_new_contact_pkey PRIMARY KEY (id);
ALTER TABLE public.settings_omni_new_contact ADD CONSTRAINT settings_omni_new_contact_channel_key UNIQUE (channel);
ALTER TABLE public.settings_schedules ADD CONSTRAINT settings_schedules_pkey PRIMARY KEY (id);
ALTER TABLE public.settings_system_modules ADD CONSTRAINT settings_system_modules_pkey PRIMARY KEY (id);
ALTER TABLE public.settings_system_modules ADD CONSTRAINT settings_system_modules_module_key_key UNIQUE (module_key);
ALTER TABLE public.settings_teams ADD CONSTRAINT settings_teams_pkey PRIMARY KEY (id);
ALTER TABLE public.settings_users ADD CONSTRAINT settings_users_pkey PRIMARY KEY (id);
ALTER TABLE public.settings_users ADD CONSTRAINT settings_users_auth_user_id_key UNIQUE (auth_user_id);
ALTER TABLE public.settings_users ADD CONSTRAINT settings_users_email_key UNIQUE (email);
ALTER TABLE public.settings_users_teams ADD CONSTRAINT settings_users_teams_pkey PRIMARY KEY (id);
ALTER TABLE public.settings_users_teams ADD CONSTRAINT settings_users_teams_user_id_team_id_key UNIQUE (user_id, team_id);
ALTER TABLE public.settings_whatsapp_channels ADD CONSTRAINT settings_whatsapp_channels_pkey PRIMARY KEY (id);
ALTER TABLE public.settings_whatsapp_channels ADD CONSTRAINT settings_whatsapp_channels_phone_number_id_key UNIQUE (phone_number_id);
ALTER TABLE public.user_calendar_connections ADD CONSTRAINT user_calendar_connections_pkey PRIMARY KEY (id);
ALTER TABLE public.user_calendar_connections ADD CONSTRAINT user_calendar_connections_user_id_key UNIQUE (user_id);
ALTER TABLE public.webhook_logs ADD CONSTRAINT webhook_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.webhooks ADD CONSTRAINT webhooks_pkey PRIMARY KEY (id);
ALTER TABLE public.whatsapp_templates ADD CONSTRAINT whatsapp_templates_pkey PRIMARY KEY (id);
ALTER TABLE public.whatsapp_templates ADD CONSTRAINT whatsapp_templates_slug_key UNIQUE (slug);
ALTER TABLE storage.buckets ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);
ALTER TABLE storage.buckets_analytics ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);
ALTER TABLE storage.objects ADD CONSTRAINT objects_pkey PRIMARY KEY (id);
ALTER TABLE storage.s3_multipart_uploads ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);
ALTER TABLE storage.s3_multipart_uploads_parts ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);

-- ============================================================
-- FOREIGN KEYS
-- ============================================================
ALTER TABLE public.adm_migration_runs ADD CONSTRAINT adm_migration_runs_migration_id_fkey FOREIGN KEY (migration_id) REFERENCES public.adm_migrations (id) ON DELETE CASCADE;
ALTER TABLE public.adm_sync_jobs ADD CONSTRAINT adm_sync_jobs_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.adm_clients (id) ON DELETE CASCADE;
ALTER TABLE public.adm_sync_logs ADD CONSTRAINT adm_sync_logs_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.adm_sync_jobs (id) ON DELETE CASCADE;
ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_elevenlabs_agent_id_fkey FOREIGN KEY (elevenlabs_agent_id) REFERENCES public.elevenlabs_agents (id) ON DELETE SET NULL;
ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_leads_stages_id_fkey FOREIGN KEY (leads_stages_id) REFERENCES public.leads_stages (id);
ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_llm_provider_id_fkey FOREIGN KEY (llm_provider_id) REFERENCES public.settings_ai_providers (id) ON DELETE SET NULL;
ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.leads_pipelines (id) ON DELETE SET NULL;
ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_wa_channel_id_fkey FOREIGN KEY (wa_channel_id) REFERENCES public.settings_whatsapp_channels (id) ON DELETE SET NULL;
ALTER TABLE public.ai_agents_execution_log ADD CONSTRAINT ai_agents_execution_log_ai_agent_id_fkey FOREIGN KEY (ai_agent_id) REFERENCES public.ai_agents (id) ON DELETE CASCADE;
ALTER TABLE public.ai_agents_execution_log ADD CONSTRAINT ai_agents_execution_log_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads (id) ON DELETE SET NULL;
ALTER TABLE public.ai_agents_execution_log ADD CONSTRAINT ai_agents_execution_log_people_id_fkey FOREIGN KEY (people_id) REFERENCES public.clients_people (id) ON DELETE CASCADE;
ALTER TABLE public.ai_agents_history ADD CONSTRAINT ai_agents_history_ai_agent_id_fkey FOREIGN KEY (ai_agent_id) REFERENCES public.ai_agents (id) ON DELETE CASCADE;
ALTER TABLE public.ai_agents_history ADD CONSTRAINT ai_agents_history_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.settings_users (id) ON DELETE SET NULL;
ALTER TABLE public.ai_agents_score_matrix ADD CONSTRAINT ai_agents_score_matrix_ai_agent_id_fkey FOREIGN KEY (ai_agent_id) REFERENCES public.ai_agents (id) ON DELETE CASCADE;
ALTER TABLE public.ai_agents_score_matrix ADD CONSTRAINT ai_agents_score_matrix_score_matrix_id_fkey FOREIGN KEY (score_matrix_id) REFERENCES public.score_matrix (id) ON DELETE CASCADE;
ALTER TABLE public.ai_agents_steps ADD CONSTRAINT ai_agents_steps_ai_agent_id_fkey FOREIGN KEY (ai_agent_id) REFERENCES public.ai_agents (id) ON DELETE CASCADE;
ALTER TABLE public.ai_agents_steps_history ADD CONSTRAINT ai_agents_steps_history_leads_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads (id) ON DELETE CASCADE;
ALTER TABLE public.ai_agents_steps_history ADD CONSTRAINT ai_agents_steps_history_step_id_fkey FOREIGN KEY (step_id) REFERENCES public.ai_agents_steps (id) ON DELETE CASCADE;
ALTER TABLE public.bi_ad_campaigns ADD CONSTRAINT bi_ad_campaigns_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.bi_ad_accounts (id) ON DELETE CASCADE;
ALTER TABLE public.bi_ad_campaigns ADD CONSTRAINT bi_ad_campaigns_ad_account_id_fkey FOREIGN KEY (ad_account_id) REFERENCES public.bi_ad_accounts (id) ON DELETE CASCADE;
ALTER TABLE public.bi_ad_daily_stats ADD CONSTRAINT bi_ad_daily_stats_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.bi_ad_campaigns (id) ON DELETE CASCADE;
ALTER TABLE public.bi_ad_spend ADD CONSTRAINT bi_ad_spend_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.bi_ad_campaigns (id) ON DELETE SET NULL;
ALTER TABLE public.bi_sdr_targets ADD CONSTRAINT bi_sdr_targets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.settings_users (id) ON DELETE CASCADE;
ALTER TABLE public.booking_rules ADD CONSTRAINT booking_rules_rule_set_id_fkey FOREIGN KEY (rule_set_id) REFERENCES public.booking_rule_sets (id) ON DELETE CASCADE;
ALTER TABLE public.call_pro_calls ADD CONSTRAINT call_pro_calls_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads (id) ON DELETE SET NULL;
ALTER TABLE public.call_pro_calls ADD CONSTRAINT call_pro_calls_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.clients_people (id) ON DELETE SET NULL;
ALTER TABLE public.call_pro_calls ADD CONSTRAINT call_pro_calls_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.settings_users (id) ON DELETE SET NULL;
ALTER TABLE public.call_pro_operator_mappings ADD CONSTRAINT call_pro_operator_mappings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.settings_users (id) ON DELETE CASCADE;
ALTER TABLE public.clients_people ADD CONSTRAINT clients_people_merged_into_id_fkey FOREIGN KEY (merged_into_id) REFERENCES public.clients_people (id) ON DELETE SET NULL;
ALTER TABLE public.clients_people ADD CONSTRAINT clients_people_prospect_campaign_id_fkey FOREIGN KEY (prospect_campaign_id) REFERENCES public.prospect_campaigns (id) ON DELETE SET NULL;
ALTER TABLE public.clients_people ADD CONSTRAINT fk_score_matrix FOREIGN KEY (score_matrix_id) REFERENCES public.score_matrix (id) ON DELETE SET NULL;
ALTER TABLE public.clients_people_companies ADD CONSTRAINT clients_people_companies_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.clients_companies (id) ON DELETE CASCADE;
ALTER TABLE public.clients_people_companies ADD CONSTRAINT clients_people_companies_people_id_fkey FOREIGN KEY (people_id) REFERENCES public.clients_people (id) ON DELETE CASCADE;
ALTER TABLE public.clients_people_updates ADD CONSTRAINT clients_people_updates_people_id_fkey FOREIGN KEY (people_id) REFERENCES public.clients_people (id) ON DELETE CASCADE;
ALTER TABLE public.clients_people_updates ADD CONSTRAINT clients_people_updates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.settings_users (id) ON DELETE SET NULL;
ALTER TABLE public.conversion_events_queue ADD CONSTRAINT conversion_events_queue_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads (id) ON DELETE CASCADE;
ALTER TABLE public.conversion_events_queue ADD CONSTRAINT conversion_events_queue_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.leads_stages (id) ON DELETE CASCADE;
ALTER TABLE public.conversion_stage_mappings ADD CONSTRAINT conversion_stage_mappings_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.leads_pipelines (id) ON DELETE CASCADE;
ALTER TABLE public.conversion_stage_mappings ADD CONSTRAINT conversion_stage_mappings_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.leads_stages (id) ON DELETE CASCADE;
ALTER TABLE public.elevenlabs_agents ADD CONSTRAINT elevenlabs_agents_ai_agent_id_fkey FOREIGN KEY (ai_agent_id) REFERENCES public.ai_agents (id) ON DELETE SET NULL;
ALTER TABLE public.followup_queue ADD CONSTRAINT followup_queue_followup_id_fkey FOREIGN KEY (followup_id) REFERENCES public.leads_stages_followups (id) ON DELETE CASCADE;
ALTER TABLE public.followup_queue ADD CONSTRAINT followup_queue_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads (id) ON DELETE CASCADE;
ALTER TABLE public.followup_queue ADD CONSTRAINT followup_queue_meeting_followup_id_fkey FOREIGN KEY (meeting_followup_id) REFERENCES public.meetings_followups (id) ON DELETE CASCADE;
ALTER TABLE public.followup_queue ADD CONSTRAINT followup_queue_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages (id) ON DELETE SET NULL;
ALTER TABLE public.followup_queue ADD CONSTRAINT followup_queue_pessoa_id_fkey FOREIGN KEY (person_id) REFERENCES public.clients_people (id) ON DELETE SET NULL;
ALTER TABLE public.form_pro_forms ADD CONSTRAINT lp_forms_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.leads_pipelines (id) ON DELETE SET NULL;
ALTER TABLE public.form_pro_submissions ADD CONSTRAINT form_pro_submissions_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.form_pro_forms (id) ON DELETE SET NULL;
ALTER TABLE public.form_pro_submissions ADD CONSTRAINT form_pro_submissions_meta_form_id_fkey FOREIGN KEY (meta_form_id) REFERENCES public.meta_lead_forms (id) ON DELETE SET NULL;
ALTER TABLE public.form_pro_submissions ADD CONSTRAINT lp_submissions_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads (id) ON DELETE SET NULL;
ALTER TABLE public.form_pro_submissions ADD CONSTRAINT lp_submissions_people_id_fkey FOREIGN KEY (people_id) REFERENCES public.clients_people (id) ON DELETE SET NULL;
ALTER TABLE public.instagram_automation_log ADD CONSTRAINT instagram_automation_log_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES public.instagram_automations (id) ON DELETE SET NULL;
ALTER TABLE public.instagram_automation_log ADD CONSTRAINT instagram_automation_log_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.clients_people (id) ON DELETE SET NULL;
ALTER TABLE public.lead_field_definitions ADD CONSTRAINT lead_field_definitions_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.leads_pipelines (id) ON DELETE CASCADE;
ALTER TABLE public.lead_field_values ADD CONSTRAINT lead_field_values_field_definition_id_fkey FOREIGN KEY (field_definition_id) REFERENCES public.lead_field_definitions (id) ON DELETE CASCADE;
ALTER TABLE public.lead_field_values ADD CONSTRAINT lead_field_values_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads (id) ON DELETE CASCADE;
ALTER TABLE public.leads ADD CONSTRAINT leads_companies_id_fkey FOREIGN KEY (company_id) REFERENCES public.clients_companies (id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD CONSTRAINT leads_leads_loss_reasons_id_fkey FOREIGN KEY (leads_loss_reasons_id) REFERENCES public.leads_loss_reasons (id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD CONSTRAINT leads_leads_pipelines_id_fkey FOREIGN KEY (leads_pipelines_id) REFERENCES public.leads_pipelines (id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD CONSTRAINT leads_leads_stages_id_fkey FOREIGN KEY (leads_stages_id) REFERENCES public.leads_stages (id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD CONSTRAINT leads_people_id_fkey FOREIGN KEY (people_id) REFERENCES public.clients_people (id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD CONSTRAINT leads_teams_id_fkey FOREIGN KEY (teams_id) REFERENCES public.settings_teams (id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD CONSTRAINT leads_users_id_fkey FOREIGN KEY (user_id) REFERENCES public.settings_users (id) ON DELETE SET NULL;
ALTER TABLE public.leads_files ADD CONSTRAINT leads_files_leads_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads (id) ON DELETE CASCADE;
ALTER TABLE public.leads_files ADD CONSTRAINT leads_files_users_id_fkey FOREIGN KEY (user_id) REFERENCES public.settings_users (id) ON DELETE SET NULL;
ALTER TABLE public.leads_notes ADD CONSTRAINT leads_notes_leads_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads (id) ON DELETE CASCADE;
ALTER TABLE public.leads_notes ADD CONSTRAINT leads_notes_users_id_fkey FOREIGN KEY (user_id) REFERENCES public.settings_users (id) ON DELETE SET NULL;
ALTER TABLE public.leads_stages ADD CONSTRAINT leads_stages_leads_pipelines_id_fkey FOREIGN KEY (leads_pipelines_id) REFERENCES public.leads_pipelines (id) ON DELETE CASCADE;
ALTER TABLE public.leads_stages_followups ADD CONSTRAINT leads_stages_followups_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.leads_stages (id) ON DELETE CASCADE;
ALTER TABLE public.leads_stages_followups ADD CONSTRAINT leads_stages_followups_target_stage_id_fkey FOREIGN KEY (target_stage_id) REFERENCES public.leads_stages (id) ON DELETE SET NULL;
ALTER TABLE public.leads_updates ADD CONSTRAINT leads_updates_from_stage_id_fkey FOREIGN KEY (from_stage_id) REFERENCES public.leads_stages (id) ON DELETE SET NULL;
ALTER TABLE public.leads_updates ADD CONSTRAINT leads_updates_leads_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads (id) ON DELETE CASCADE;
ALTER TABLE public.leads_updates ADD CONSTRAINT leads_updates_to_stage_id_fkey FOREIGN KEY (to_stage_id) REFERENCES public.leads_stages (id) ON DELETE SET NULL;
ALTER TABLE public.leads_updates ADD CONSTRAINT leads_updates_users_id_fkey FOREIGN KEY (user_id) REFERENCES public.settings_users (id) ON DELETE SET NULL;
ALTER TABLE public.meeting_followup_queue ADD CONSTRAINT meeting_followup_queue_leads_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads (id) ON DELETE SET NULL;
ALTER TABLE public.meeting_followup_queue ADD CONSTRAINT meeting_followup_queue_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.meetings (id) ON DELETE CASCADE;
ALTER TABLE public.meeting_followup_queue ADD CONSTRAINT meeting_followup_queue_people_id_fkey FOREIGN KEY (people_id) REFERENCES public.clients_people (id) ON DELETE SET NULL;
ALTER TABLE public.meeting_followup_queue ADD CONSTRAINT meeting_followup_queue_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.meetings_followups (id) ON DELETE CASCADE;
ALTER TABLE public.meeting_followup_queue ADD CONSTRAINT meeting_followup_queue_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.whatsapp_templates (id) ON DELETE SET NULL;
ALTER TABLE public.meeting_records ADD CONSTRAINT meeting_records_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.settings_users (id) ON DELETE SET NULL;
ALTER TABLE public.meeting_records ADD CONSTRAINT meeting_records_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.meetings (id) ON DELETE CASCADE;
ALTER TABLE public.meetings ADD CONSTRAINT meetings_leads_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads (id) ON DELETE SET NULL;
ALTER TABLE public.meetings ADD CONSTRAINT meetings_people_id_fkey FOREIGN KEY (people_id) REFERENCES public.clients_people (id) ON DELETE SET NULL;
ALTER TABLE public.meetings ADD CONSTRAINT meetings_teams_id_fkey FOREIGN KEY (teams_id) REFERENCES public.settings_teams (id) ON DELETE SET NULL;
ALTER TABLE public.meetings ADD CONSTRAINT meetings_users_id_fkey FOREIGN KEY (user_id) REFERENCES public.settings_users (id) ON DELETE SET NULL;
ALTER TABLE public.meetings_followups ADD CONSTRAINT meetings_followups_as_queue_id_fkey FOREIGN KEY (as_queue_id) REFERENCES public.call_pro_as_queues (id) ON DELETE SET NULL;
ALTER TABLE public.meetings_followups ADD CONSTRAINT meetings_followups_whatsapp_template_id_fkey FOREIGN KEY (whatsapp_template_id) REFERENCES public.whatsapp_templates (id) ON DELETE SET NULL;
ALTER TABLE public.message_buffer ADD CONSTRAINT message_buffer_people_id_fkey FOREIGN KEY (people_id) REFERENCES public.clients_people (id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD CONSTRAINT messages_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.ai_agents_execution_log (id) ON DELETE SET NULL;
ALTER TABLE public.messages ADD CONSTRAINT messages_followup_id_fkey FOREIGN KEY (followup_id) REFERENCES public.leads_stages_followups (id) ON DELETE SET NULL;
ALTER TABLE public.messages ADD CONSTRAINT messages_leads_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads (id) ON DELETE SET NULL;
ALTER TABLE public.messages ADD CONSTRAINT messages_parent_message_id_fkey FOREIGN KEY (parent_message_id) REFERENCES public.messages (id) ON DELETE SET NULL;
ALTER TABLE public.messages ADD CONSTRAINT messages_people_id_fkey FOREIGN KEY (people_id) REFERENCES public.clients_people (id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD CONSTRAINT messages_users_id_fkey FOREIGN KEY (user_id) REFERENCES public.settings_users (id) ON DELETE SET NULL;
ALTER TABLE public.meta_lead_forms ADD CONSTRAINT meta_lead_forms_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.meta_lead_form_pages (page_id) ON DELETE CASCADE;
ALTER TABLE public.meta_lead_forms ADD CONSTRAINT meta_lead_forms_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.leads_pipelines (id) ON DELETE SET NULL;
ALTER TABLE public.omni_delivery_dead_letter ADD CONSTRAINT omni_delivery_dead_letter_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages (id);
ALTER TABLE public.prospect_audit_log ADD CONSTRAINT prospect_audit_log_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.prospect_campaigns (id) ON DELETE SET NULL;
ALTER TABLE public.prospect_audit_log ADD CONSTRAINT prospect_audit_log_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.prospect_establishments (id) ON DELETE SET NULL;
ALTER TABLE public.prospect_campaigns ADD CONSTRAINT prospect_campaigns_target_pipeline_id_fkey FOREIGN KEY (target_pipeline_id) REFERENCES public.leads_pipelines (id) ON DELETE SET NULL;
ALTER TABLE public.prospect_campaigns ADD CONSTRAINT prospect_campaigns_target_stage_id_fkey FOREIGN KEY (target_stage_id) REFERENCES public.leads_stages (id) ON DELETE SET NULL;
ALTER TABLE public.prospect_companies ADD CONSTRAINT prospect_companies_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.prospect_campaigns (id) ON DELETE CASCADE;
ALTER TABLE public.prospect_contacts ADD CONSTRAINT prospect_contacts_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.prospect_campaigns (id) ON DELETE CASCADE;
ALTER TABLE public.prospect_contacts ADD CONSTRAINT prospect_contacts_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads (id) ON DELETE SET NULL;
ALTER TABLE public.prospect_contacts ADD CONSTRAINT prospect_contacts_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.clients_people (id) ON DELETE SET NULL;
ALTER TABLE public.prospect_enrichment_results ADD CONSTRAINT prospect_enrichment_results_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.prospect_people_v2 (id) ON DELETE CASCADE;
ALTER TABLE public.prospect_enrichment_results ADD CONSTRAINT prospect_enrichment_results_plugin_id_fkey FOREIGN KEY (plugin_id) REFERENCES public.prospect_enrichment_plugins (id);
ALTER TABLE public.prospect_establishments ADD CONSTRAINT prospect_establishments_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.prospect_campaigns (id) ON DELETE CASCADE;
ALTER TABLE public.prospect_establishments ADD CONSTRAINT prospect_establishments_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.clients_companies (id) ON DELETE SET NULL;
ALTER TABLE public.prospect_establishments ADD CONSTRAINT prospect_establishments_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads (id) ON DELETE SET NULL;
ALTER TABLE public.prospect_people ADD CONSTRAINT prospect_people_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.prospect_establishments (id) ON DELETE CASCADE;
ALTER TABLE public.prospect_people ADD CONSTRAINT prospect_people_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.clients_people (id) ON DELETE SET NULL;
ALTER TABLE public.prospect_people_v2 ADD CONSTRAINT prospect_people_v2_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.prospect_campaigns (id) ON DELETE CASCADE;
ALTER TABLE public.prospect_people_v2 ADD CONSTRAINT prospect_people_v2_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.prospect_companies (id) ON DELETE CASCADE;
ALTER TABLE public.schedule_automations ADD CONSTRAINT schedule_automations_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.leads_pipelines (id) ON DELETE CASCADE;
ALTER TABLE public.schedule_automations ADD CONSTRAINT schedule_automations_target_pipeline_id_fkey FOREIGN KEY (target_pipeline_id) REFERENCES public.leads_pipelines (id) ON DELETE CASCADE;
ALTER TABLE public.schedule_automations ADD CONSTRAINT schedule_automations_target_stage_id_fkey FOREIGN KEY (target_stage_id) REFERENCES public.leads_stages (id) ON DELETE CASCADE;
ALTER TABLE public.score_category_items ADD CONSTRAINT score_category_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.score_categories (id) ON DELETE CASCADE;
ALTER TABLE public.sends ADD CONSTRAINT sends_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.settings_users (id) ON DELETE SET NULL;
ALTER TABLE public.sends ADD CONSTRAINT sends_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.leads_pipelines (id) ON DELETE SET NULL;
ALTER TABLE public.sends ADD CONSTRAINT sends_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.settings_teams (id) ON DELETE SET NULL;
ALTER TABLE public.sends ADD CONSTRAINT sends_wa_channel_id_fkey FOREIGN KEY (wa_channel_id) REFERENCES public.settings_whatsapp_channels (id) ON DELETE SET NULL;
ALTER TABLE public.sends_contacts ADD CONSTRAINT sends_contacts_people_id_fkey FOREIGN KEY (people_id) REFERENCES public.clients_people (id) ON DELETE SET NULL;
ALTER TABLE public.sends_contacts ADD CONSTRAINT sends_contacts_send_id_fkey FOREIGN KEY (send_id) REFERENCES public.sends (id) ON DELETE CASCADE;
ALTER TABLE public.settings_omni_new_contact ADD CONSTRAINT settings_omni_new_contact_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.leads_pipelines (id) ON DELETE SET NULL;
ALTER TABLE public.settings_omni_new_contact ADD CONSTRAINT settings_omni_new_contact_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.leads_stages (id) ON DELETE SET NULL;
ALTER TABLE public.settings_schedules ADD CONSTRAINT settings_schedules_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.settings_users (id) ON DELETE CASCADE;
ALTER TABLE public.settings_users_teams ADD CONSTRAINT settings_users_teams_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.settings_teams (id) ON DELETE CASCADE;
ALTER TABLE public.settings_users_teams ADD CONSTRAINT settings_users_teams_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.settings_users (id) ON DELETE CASCADE;
ALTER TABLE public.user_calendar_connections ADD CONSTRAINT user_calendar_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.settings_users (id) ON DELETE CASCADE;
ALTER TABLE public.webhook_logs ADD CONSTRAINT webhook_logs_webhook_id_fkey FOREIGN KEY (webhook_id) REFERENCES public.webhooks (id) ON DELETE CASCADE;
ALTER TABLE public.webhooks ADD CONSTRAINT webhooks_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.leads_pipelines (id) ON DELETE SET NULL;

-- ============================================================
-- CHECK CONSTRAINTS
-- ============================================================
ALTER TABLE auth.custom_oauth_providers ADD CONSTRAINT custom_oauth_providers_authorization_url_https CHECK (((authorization_url IS NULL) OR (authorization_url ~~ 'https://%'::text)));
ALTER TABLE auth.custom_oauth_providers ADD CONSTRAINT custom_oauth_providers_authorization_url_length CHECK (((authorization_url IS NULL) OR (char_length(authorization_url) <= 2048)));
ALTER TABLE auth.custom_oauth_providers ADD CONSTRAINT custom_oauth_providers_client_id_length CHECK (((char_length(client_id) >= 1) AND (char_length(client_id) <= 512)));
ALTER TABLE auth.custom_oauth_providers ADD CONSTRAINT custom_oauth_providers_discovery_url_length CHECK (((discovery_url IS NULL) OR (char_length(discovery_url) <= 2048)));
ALTER TABLE auth.custom_oauth_providers ADD CONSTRAINT custom_oauth_providers_identifier_format CHECK ((identifier ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::text));
ALTER TABLE auth.custom_oauth_providers ADD CONSTRAINT custom_oauth_providers_issuer_length CHECK (((issuer IS NULL) OR ((char_length(issuer) >= 1) AND (char_length(issuer) <= 2048))));
ALTER TABLE auth.custom_oauth_providers ADD CONSTRAINT custom_oauth_providers_jwks_uri_https CHECK (((jwks_uri IS NULL) OR (jwks_uri ~~ 'https://%'::text)));
ALTER TABLE auth.custom_oauth_providers ADD CONSTRAINT custom_oauth_providers_jwks_uri_length CHECK (((jwks_uri IS NULL) OR (char_length(jwks_uri) <= 2048)));
ALTER TABLE auth.custom_oauth_providers ADD CONSTRAINT custom_oauth_providers_name_length CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100)));
ALTER TABLE auth.custom_oauth_providers ADD CONSTRAINT custom_oauth_providers_oauth2_requires_endpoints CHECK (((provider_type <> 'oauth2'::text) OR ((authorization_url IS NOT NULL) AND (token_url IS NOT NULL) AND (userinfo_url IS NOT NULL))));
ALTER TABLE auth.custom_oauth_providers ADD CONSTRAINT custom_oauth_providers_oidc_discovery_url_https CHECK (((provider_type <> 'oidc'::text) OR (discovery_url IS NULL) OR (discovery_url ~~ 'https://%'::text)));
ALTER TABLE auth.custom_oauth_providers ADD CONSTRAINT custom_oauth_providers_oidc_issuer_https CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NULL) OR (issuer ~~ 'https://%'::text)));
ALTER TABLE auth.custom_oauth_providers ADD CONSTRAINT custom_oauth_providers_oidc_requires_issuer CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NOT NULL)));
ALTER TABLE auth.custom_oauth_providers ADD CONSTRAINT custom_oauth_providers_provider_type_check CHECK ((provider_type = ANY (ARRAY['oauth2'::text, 'oidc'::text])));
ALTER TABLE auth.custom_oauth_providers ADD CONSTRAINT custom_oauth_providers_token_url_https CHECK (((token_url IS NULL) OR (token_url ~~ 'https://%'::text)));
ALTER TABLE auth.custom_oauth_providers ADD CONSTRAINT custom_oauth_providers_token_url_length CHECK (((token_url IS NULL) OR (char_length(token_url) <= 2048)));
ALTER TABLE auth.custom_oauth_providers ADD CONSTRAINT custom_oauth_providers_userinfo_url_https CHECK (((userinfo_url IS NULL) OR (userinfo_url ~~ 'https://%'::text)));
ALTER TABLE auth.custom_oauth_providers ADD CONSTRAINT custom_oauth_providers_userinfo_url_length CHECK (((userinfo_url IS NULL) OR (char_length(userinfo_url) <= 2048)));
ALTER TABLE auth.oauth_authorizations ADD CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255));
ALTER TABLE auth.oauth_authorizations ADD CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128));
ALTER TABLE auth.oauth_authorizations ADD CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at));
ALTER TABLE auth.oauth_authorizations ADD CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255));
ALTER TABLE auth.oauth_authorizations ADD CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048));
ALTER TABLE auth.oauth_authorizations ADD CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048));
ALTER TABLE auth.oauth_authorizations ADD CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096));
ALTER TABLE auth.oauth_authorizations ADD CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096));
ALTER TABLE auth.oauth_clients ADD CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024));
ALTER TABLE auth.oauth_clients ADD CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048));
ALTER TABLE auth.oauth_clients ADD CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048));
ALTER TABLE auth.oauth_clients ADD CONSTRAINT oauth_clients_token_endpoint_auth_method_check CHECK ((token_endpoint_auth_method = ANY (ARRAY['client_secret_basic'::text, 'client_secret_post'::text, 'none'::text])));
ALTER TABLE auth.oauth_consents ADD CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at)));
ALTER TABLE auth.oauth_consents ADD CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048));
ALTER TABLE auth.oauth_consents ADD CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0));
ALTER TABLE auth.one_time_tokens ADD CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0));
ALTER TABLE auth.saml_providers ADD CONSTRAINT entity_id not empty CHECK ((char_length(entity_id) > 0));
ALTER TABLE auth.saml_providers ADD CONSTRAINT metadata_url not empty CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0)));
ALTER TABLE auth.saml_providers ADD CONSTRAINT metadata_xml not empty CHECK ((char_length(metadata_xml) > 0));
ALTER TABLE auth.saml_relay_states ADD CONSTRAINT request_id not empty CHECK ((char_length(request_id) > 0));
ALTER TABLE auth.sessions ADD CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096));
ALTER TABLE auth.sso_domains ADD CONSTRAINT domain not empty CHECK ((char_length(domain) > 0));
ALTER TABLE auth.sso_providers ADD CONSTRAINT resource_id not empty CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)));
ALTER TABLE auth.users ADD CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)));
ALTER TABLE auth.webauthn_challenges ADD CONSTRAINT webauthn_challenges_challenge_type_check CHECK ((challenge_type = ANY (ARRAY['signup'::text, 'registration'::text, 'authentication'::text])));
ALTER TABLE public.adm_clients ADD CONSTRAINT adm_clients_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'suspended'::text])));
ALTER TABLE public.adm_clients ADD CONSTRAINT adm_clients_sync_status_check CHECK ((sync_status = ANY (ARRAY['never'::text, 'pending'::text, 'syncing'::text, 'synced'::text, 'error'::text])));
ALTER TABLE public.adm_migration_runs ADD CONSTRAINT adm_migration_runs_status_check CHECK ((status = ANY (ARRAY['success'::text, 'error'::text])));
ALTER TABLE public.adm_sync_jobs ADD CONSTRAINT adm_sync_jobs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'success'::text, 'failed'::text, 'cancelled'::text])));
ALTER TABLE public.adm_sync_jobs ADD CONSTRAINT adm_sync_jobs_triggered_by_check CHECK ((triggered_by = ANY (ARRAY['manual'::text, 'auto'::text, 'github_actions'::text, 'webhook'::text])));
ALTER TABLE public.adm_sync_jobs ADD CONSTRAINT adm_sync_jobs_type_check CHECK ((type = ANY (ARRAY['full'::text, 'migrations'::text, 'functions'::text])));
ALTER TABLE public.adm_sync_logs ADD CONSTRAINT adm_sync_logs_level_check CHECK ((level = ANY (ARRAY['info'::text, 'warning'::text, 'error'::text, 'success'::text])));
ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_agent_type_check CHECK ((agent_type = ANY (ARRAY['text'::text, 'voice'::text])));
ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_buffer_ms_check CHECK (((buffer_ms >= 0) AND (buffer_ms <= 30000)));
ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_channel_types_check CHECK ((channel_types <@ ARRAY['whatsapp'::text, 'instagram_dm'::text, 'instagram_post'::text, 'email'::text, 'sms'::text]));
ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_el_sync_status_check CHECK ((el_sync_status = ANY (ARRAY['pending'::text, 'synced'::text, 'error'::text, 'not_applicable'::text])));
ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_humanizacao_check CHECK ((humanizacao = ANY (ARRAY['alta'::text, 'media'::text, 'nenhuma'::text])));
ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_llm_max_tokens_check CHECK (((llm_max_tokens > 0) AND (llm_max_tokens <= 32768)));
ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_llm_provider_check CHECK ((llm_provider = ANY (ARRAY['openai'::text, 'anthropic'::text, 'groq'::text, 'gemini'::text])));
ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_llm_temperature_check CHECK (((llm_temperature >= (0.0)::double precision) AND (llm_temperature <= (2.0)::double precision)));
ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_memory_window_check CHECK (((memory_window > 0) AND (memory_window <= 200)));
ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_voice_response_mode_check CHECK ((voice_response_mode = ANY (ARRAY['mirror'::text, 'always'::text])));
ALTER TABLE public.bi_ad_accounts ADD CONSTRAINT bi_ad_accounts_platform_check CHECK ((platform = ANY (ARRAY['meta'::text, 'google'::text])));
ALTER TABLE public.bi_ad_spend ADD CONSTRAINT bi_ad_spend_platform_check CHECK ((platform = ANY (ARRAY['meta'::text, 'google'::text])));
ALTER TABLE public.bi_ad_spend ADD CONSTRAINT bi_ad_spend_source_check CHECK ((source = ANY (ARRAY['api'::text, 'csv'::text])));
ALTER TABLE public.bi_sdr_targets ADD CONSTRAINT bi_sdr_targets_daily_target_check CHECK ((daily_target >= 0));
ALTER TABLE public.bi_sdr_targets ADD CONSTRAINT bi_sdr_targets_month_check CHECK (((month >= 1) AND (month <= 12)));
ALTER TABLE public.booking_rules ADD CONSTRAINT booking_rules_rule_type_check CHECK ((rule_type = ANY (ARRAY['team_priority'::text, 'random'::text, 'least_busy'::text, 'specific_user'::text, 'round_robin'::text])));
ALTER TABLE public.call_pro_calls ADD CONSTRAINT call_pro_calls_direction_check CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text])));
ALTER TABLE public.call_pro_calls ADD CONSTRAINT call_pro_calls_status_check CHECK ((status = ANY (ARRAY['newcall'::text, 'ringing'::text, 'in_progress'::text, 'abandoned'::text, 'answered'::text, 'blocked'::text, 'handled'::text, 'missed'::text, 'failed'::text])));
ALTER TABLE public.clients_people ADD CONSTRAINT clients_people_service_status_check CHECK (((service_status = ANY (ARRAY['open'::text, 'closed'::text, 'in_service'::text])) OR (service_status IS NULL)));
ALTER TABLE public.clients_people ADD CONSTRAINT clients_people_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'archived'::text, 'merged'::text])));
ALTER TABLE public.conversion_event_rules ADD CONSTRAINT conversion_event_rules_trigger_type_check CHECK ((trigger_type = ANY (ARRAY['stage_enter'::text, 'lead_won'::text, 'lead_lost'::text, 'lead_created'::text, 'booking_status'::text])));
ALTER TABLE public.conversion_events_queue ADD CONSTRAINT conversion_events_queue_google_status_check CHECK ((google_status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'skipped'::text])));
ALTER TABLE public.conversion_events_queue ADD CONSTRAINT conversion_events_queue_meta_status_check CHECK ((meta_status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'skipped'::text])));
ALTER TABLE public.conversion_platform_credentials ADD CONSTRAINT conversion_platform_credentials_platform_check CHECK ((platform = ANY (ARRAY['meta'::text, 'google'::text])));
ALTER TABLE public.data_deletion_requests ADD CONSTRAINT data_deletion_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'rejected'::text])));
ALTER TABLE public.followup_queue ADD CONSTRAINT followup_queue_source_type_check CHECK ((source_type = ANY (ARRAY['stage'::text, 'meeting'::text])));
ALTER TABLE public.followup_queue ADD CONSTRAINT followup_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'queued'::text, 'sent'::text, 'failed'::text, 'cancelled'::text])));
ALTER TABLE public.form_pro_submissions ADD CONSTRAINT form_pro_submissions_source_check CHECK ((source = ANY (ARRAY['site'::text, 'meta'::text])));
ALTER TABLE public.instagram_automation_log ADD CONSTRAINT instagram_automation_log_status_check CHECK ((status = ANY (ARRAY['success'::text, 'failed'::text, 'skipped'::text, 'cooldown'::text])));
ALTER TABLE public.instagram_automations ADD CONSTRAINT instagram_automations_action_type_check CHECK ((action_type = ANY (ARRAY['send_dm'::text, 'reply_comment'::text, 'reply_and_dm'::text])));
ALTER TABLE public.instagram_automations ADD CONSTRAINT instagram_automations_filter_operator_check CHECK ((filter_operator = ANY (ARRAY['any'::text, 'all'::text])));
ALTER TABLE public.instagram_automations ADD CONSTRAINT instagram_automations_trigger_type_check CHECK ((trigger_type = ANY (ARRAY['incoming_dm'::text, 'post_comment'::text, 'story_mention'::text, 'story_reply'::text])));
ALTER TABLE public.lead_field_definitions ADD CONSTRAINT lead_field_definitions_category_check CHECK ((category = ANY (ARRAY['qualificacao'::text, 'contato'::text, 'comercial'::text, 'custom'::text, 'outros'::text])));
ALTER TABLE public.lead_field_definitions ADD CONSTRAINT lead_field_definitions_entity_type_check CHECK ((entity_type = ANY (ARRAY['negocio'::text, 'pessoa'::text, 'empresa'::text])));
ALTER TABLE public.lead_field_definitions ADD CONSTRAINT lead_field_definitions_type_check CHECK ((type = ANY (ARRAY['text'::text, 'number'::text, 'single_select'::text, 'select'::text, 'boolean'::text, 'date'::text, 'textarea'::text])));
ALTER TABLE public.lead_field_values ADD CONSTRAINT lead_field_values_entity_type_check CHECK ((entity_type = ANY (ARRAY['negocio'::text, 'pessoa'::text, 'empresa'::text])));
ALTER TABLE public.leads ADD CONSTRAINT leads_close_probability_check CHECK (((close_probability IS NULL) OR ((close_probability >= 1) AND (close_probability <= 5))));
ALTER TABLE public.leads ADD CONSTRAINT leads_lifecycle_stage_check CHECK ((lifecycle_stage = ANY (ARRAY['lead'::text, 'mql'::text, 'sql'::text, 'opportunity'::text, 'customer'::text, 'churned'::text])));
ALTER TABLE public.leads ADD CONSTRAINT leads_pre_sale_temperature_check CHECK (((pre_sale_temperature IS NULL) OR ((pre_sale_temperature >= 1) AND (pre_sale_temperature <= 5))));
ALTER TABLE public.leads ADD CONSTRAINT leads_status_check CHECK ((status = ANY (ARRAY['in_progress'::text, 'won'::text, 'lost'::text, 'archived'::text])));
ALTER TABLE public.meeting_followup_queue ADD CONSTRAINT meeting_followup_queue_channel_check CHECK ((channel = ANY (ARRAY['whatsapp'::text, 'email'::text, 'webhook'::text, 'ligacao'::text])));
ALTER TABLE public.meeting_followup_queue ADD CONSTRAINT meeting_followup_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'cancelled'::text])));
ALTER TABLE public.meeting_records ADD CONSTRAINT meeting_records_ai_score_check CHECK (((ai_score >= 0) AND (ai_score <= 100)));
ALTER TABLE public.meeting_records ADD CONSTRAINT meeting_records_ai_sentiment_check CHECK ((ai_sentiment = ANY (ARRAY['positivo'::text, 'neutro'::text, 'negativo'::text, 'misto'::text])));
ALTER TABLE public.meeting_records ADD CONSTRAINT meeting_records_content_format_check CHECK ((content_format = ANY (ARRAY['text'::text, 'markdown'::text, 'html'::text, 'json'::text])));
ALTER TABLE public.meeting_records ADD CONSTRAINT meeting_records_record_type_check CHECK ((record_type = ANY (ARRAY['recording'::text, 'transcript'::text, 'summary'::text, 'ai_summary'::text, 'ai_analysis'::text, 'note'::text])));
ALTER TABLE public.meetings ADD CONSTRAINT meetings_outcome_check CHECK ((outcome = ANY (ARRAY['venda'::text, 'follow_up'::text, 'sem_interesse'::text, 'reagendada'::text, 'nao_compareceu'::text])));
ALTER TABLE public.meetings ADD CONSTRAINT meetings_status_check CHECK ((status = ANY (ARRAY['agendado'::text, 'agendada'::text, 'compareceu'::text, 'nao_compareceu'::text, 'não compareceu'::text, 'cancelado'::text, 'cancelada'::text, 'realizado'::text, 'bloqueio manual'::text])));
ALTER TABLE public.meetings_followups ADD CONSTRAINT meetings_followups_channel_check CHECK ((channel = ANY (ARRAY['whatsapp'::text, 'email'::text, 'webhook'::text, 'ligacao'::text])));
ALTER TABLE public.meetings_followups ADD CONSTRAINT meetings_followups_meeting_status_check CHECK ((meeting_status = ANY (ARRAY['agendado'::text, 'compareceu'::text, 'nao_compareceu'::text, 'cancelado'::text, 'realizado'::text])));
ALTER TABLE public.messages ADD CONSTRAINT messages_channel_check CHECK ((channel = ANY (ARRAY['whatsapp'::text, 'instagram'::text, 'email'::text, 'sms'::text, 'telefone'::text])));
ALTER TABLE public.messages ADD CONSTRAINT messages_from_contact_check CHECK ((from_contact = ANY (ARRAY['cliente'::text, 'humano'::text, 'ia'::text, 'agente_ia'::text, 'sistema'::text])));
ALTER TABLE public.messages ADD CONSTRAINT messages_message_type_check CHECK ((message_type = ANY (ARRAY['texto'::text, 'audio'::text, 'imagem'::text, 'video'::text, 'documento'::text, 'chamada'::text, 'comentario'::text, 'story_reply'::text, 'story_mention'::text, 'reply_comentario'::text, 'arquivo'::text])));
ALTER TABLE public.messages ADD CONSTRAINT messages_source_type_check CHECK ((source_type = ANY (ARRAY['inbound'::text, 'manual'::text, 'ai_agent'::text, 'campaign'::text, 'form'::text, 'followup'::text, 'appointment_reminder'::text])));
ALTER TABLE public.messages ADD CONSTRAINT messages_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sending'::text, 'sent'::text, 'delivered'::text, 'read'::text, 'error'::text])));
ALTER TABLE public.meta_lead_forms ADD CONSTRAINT meta_lead_forms_status_check CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text, 'unmapped'::text])));
ALTER TABLE public.omni_channel_alerts ADD CONSTRAINT omni_channel_alerts_channel_check CHECK ((channel = ANY (ARRAY['whatsapp'::text, 'instagram'::text, 'email'::text, 'sms'::text, 'telefone'::text, 'system'::text])));
ALTER TABLE public.omni_channel_alerts ADD CONSTRAINT omni_channel_alerts_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'error'::text])));
ALTER TABLE public.omni_channel_configs ADD CONSTRAINT omni_channel_configs_channel_check CHECK ((channel = ANY (ARRAY['whatsapp'::text, 'instagram'::text, 'email'::text, 'sms'::text, 'telefone'::text, 'identity_collection'::text])));
ALTER TABLE public.omni_delivery_dead_letter ADD CONSTRAINT omni_delivery_dead_letter_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'retrying'::text, 'exhausted'::text, 'resolved'::text])));
ALTER TABLE public.omni_outbound_webhooks ADD CONSTRAINT omni_outbound_webhooks_channel_check CHECK ((channel = ANY (ARRAY['email'::text, 'sms'::text])));
ALTER TABLE public.omni_outbound_webhooks ADD CONSTRAINT omni_outbound_webhooks_method_check CHECK ((method = ANY (ARRAY['POST'::text, 'PUT'::text])));
ALTER TABLE public.prospect_audit_log ADD CONSTRAINT prospect_audit_log_action_check CHECK ((action = ANY (ARRAY['scraped'::text, 'filtered_out'::text, 'enriched'::text, 'scored'::text, 'approved'::text, 'rejected'::text, 'committed'::text, 'deleted_lgpd'::text, 'opt_out_registered'::text, 'searched'::text, 'people_discovered'::text, 'contacts_enriched'::text, 'plugin_executed'::text])));
ALTER TABLE public.prospect_campaigns ADD CONSTRAINT prospect_campaigns_max_leads_check CHECK (((max_leads > 0) AND (max_leads <= 5000)));
ALTER TABLE public.prospect_campaigns ADD CONSTRAINT prospect_campaigns_source_check CHECK ((source = ANY (ARRAY['google_maps'::text, 'manual'::text, 'linkedin'::text, 'vibe'::text, 'explorium'::text, 'apollo'::text, 'pdl'::text, 'api'::text])));
ALTER TABLE public.prospect_campaigns ADD CONSTRAINT prospect_campaigns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'running'::text, 'completed'::text, 'error'::text, 'paused'::text])));
ALTER TABLE public.prospect_companies ADD CONSTRAINT prospect_companies_consent_basis_check CHECK ((consent_basis = ANY (ARRAY['legitimate_interest'::text, 'consent'::text, 'public_data'::text])));
ALTER TABLE public.prospect_companies ADD CONSTRAINT prospect_companies_status_check CHECK ((status = ANY (ARRAY['raw'::text, 'selected'::text, 'people_fetched'::text, 'reviewed'::text, 'committed'::text, 'rejected'::text])));
ALTER TABLE public.prospect_contacts ADD CONSTRAINT prospect_contacts_ai_score_check CHECK (((ai_score IS NULL) OR ((ai_score >= 0) AND (ai_score <= 100))));
ALTER TABLE public.prospect_contacts ADD CONSTRAINT prospect_contacts_consent_basis_check CHECK ((consent_basis = ANY (ARRAY['legitimate_interest'::text, 'consent'::text, 'public_data'::text])));
ALTER TABLE public.prospect_contacts ADD CONSTRAINT prospect_contacts_status_check CHECK ((status = ANY (ARRAY['raw'::text, 'filtered'::text, 'enriched'::text, 'scored'::text, 'pending_review'::text, 'approved'::text, 'rejected'::text])));
ALTER TABLE public.prospect_establishments ADD CONSTRAINT prospect_establishments_ai_score_check CHECK (((ai_score IS NULL) OR ((ai_score >= 0) AND (ai_score <= 100))));
ALTER TABLE public.prospect_establishments ADD CONSTRAINT prospect_establishments_consent_basis_check CHECK ((consent_basis = ANY (ARRAY['legitimate_interest'::text, 'consent'::text, 'public_data'::text])));
ALTER TABLE public.prospect_establishments ADD CONSTRAINT prospect_establishments_status_check CHECK ((status = ANY (ARRAY['raw'::text, 'enriched'::text, 'scored'::text, 'pending_review'::text, 'approved'::text, 'rejected'::text, 'committed'::text, 'partial_error'::text])));
ALTER TABLE public.prospect_opt_out_registry ADD CONSTRAINT at_least_one_hash CHECK (((email_hash IS NOT NULL) OR (phone_hash IS NOT NULL)));
ALTER TABLE public.prospect_people ADD CONSTRAINT prospect_people_consent_basis_check CHECK ((consent_basis = ANY (ARRAY['legitimate_interest'::text, 'consent'::text, 'public_data'::text])));
ALTER TABLE public.prospect_people ADD CONSTRAINT prospect_people_has_some_identity CHECK (((name IS NOT NULL) OR (email IS NOT NULL) OR (phone IS NOT NULL)));
ALTER TABLE public.prospect_people_v2 ADD CONSTRAINT prospect_people_v2_consent_basis_check CHECK ((consent_basis = ANY (ARRAY['legitimate_interest'::text, 'consent'::text, 'public_data'::text])));
ALTER TABLE public.prospect_people_v2 ADD CONSTRAINT prospect_people_v2_status_check CHECK ((status = ANY (ARRAY['discovered'::text, 'selected'::text, 'enriched'::text, 'approved'::text, 'rejected'::text, 'committed'::text])));
ALTER TABLE public.schedule_automations ADD CONSTRAINT schedule_automations_trigger_status_check CHECK ((trigger_status = ANY (ARRAY['criado'::text, 'confirmado'::text, 'cancelado'::text, 'reagendado'::text, 'realizado'::text, 'no_show'::text])));
ALTER TABLE public.sends ADD CONSTRAINT sends_channel_check CHECK ((channel = ANY (ARRAY['whatsapp'::text, 'email'::text, 'sms'::text, 'phone'::text])));
ALTER TABLE public.sends ADD CONSTRAINT sends_interval_check CHECK ((send_interval_seconds = ANY (ARRAY[5, 10, 30, 60, 300, 600, 1800, 3600])));
ALTER TABLE public.sends ADD CONSTRAINT sends_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'running'::text, 'paused'::text, 'completed'::text, 'failed'::text])));
ALTER TABLE public.sends ADD CONSTRAINT sends_type_check CHECK ((type = ANY (ARRAY['imported'::text, 'filtered'::text])));
ALTER TABLE public.sends_contacts ADD CONSTRAINT sends_contacts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'delivered'::text, 'read'::text, 'error'::text])));
ALTER TABLE public.settings_ai_providers ADD CONSTRAINT settings_ai_providers_provider_check CHECK ((provider = ANY (ARRAY['openai'::text, 'anthropic'::text, 'groq'::text, 'gemini'::text])));
ALTER TABLE public.settings_omni_new_contact ADD CONSTRAINT settings_omni_new_contact_channel_check CHECK ((channel = ANY (ARRAY['whatsapp'::text, 'email'::text, 'instagram_dm'::text, 'instagram_comment'::text])));
ALTER TABLE public.settings_schedules ADD CONSTRAINT settings_schedules_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)));
ALTER TABLE public.settings_teams ADD CONSTRAINT settings_teams_team_type_check CHECK ((team_type = ANY (ARRAY['vendas'::text, 'atendimento'::text, 'suporte'::text, 'outro'::text])));
ALTER TABLE public.settings_users ADD CONSTRAINT settings_users_user_type_check CHECK ((user_type = ANY (ARRAY['admin'::text, 'manager'::text, 'user'::text])));
ALTER TABLE public.user_calendar_connections ADD CONSTRAINT user_calendar_connections_provider_check CHECK ((provider = ANY (ARRAY['google'::text, 'microsoft'::text])));
ALTER TABLE public.webhooks ADD CONSTRAINT webhooks_event_type_check CHECK ((event_type = ANY (ARRAY['conversa'::text, 'disparo'::text, 'lead_etapa'::text, 'followup'::text])));
ALTER TABLE public.whatsapp_templates ADD CONSTRAINT whatsapp_templates_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'approved'::text, 'rejected'::text, 'pending'::text, 'submitted'::text, 'paused'::text, 'disabled'::text, 'deleted'::text, 'in_appeal'::text, 'flagged'::text])));

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);
CREATE INDEX custom_oauth_providers_created_at_idx ON auth.custom_oauth_providers USING btree (created_at);
CREATE INDEX custom_oauth_providers_enabled_idx ON auth.custom_oauth_providers USING btree (enabled);
CREATE INDEX custom_oauth_providers_identifier_idx ON auth.custom_oauth_providers USING btree (identifier);
CREATE INDEX custom_oauth_providers_provider_type_idx ON auth.custom_oauth_providers USING btree (provider_type);
CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);
CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);
CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);
CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);
CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);
CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);
CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);
CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);
CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);
CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);
CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);
CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);
CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);
CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);
CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);
CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);
CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);
CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);
CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);
CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);
CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);
CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);
CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);
CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);
CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);
CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);
CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);
CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);
CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);
CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);
CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);
CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);
CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));
CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);
CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));
CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);
CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);
CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);
CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);
CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);
CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);
CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);
CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));
CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);
CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);
CREATE INDEX webauthn_challenges_expires_at_idx ON auth.webauthn_challenges USING btree (expires_at);
CREATE INDEX webauthn_challenges_user_id_idx ON auth.webauthn_challenges USING btree (user_id);
CREATE UNIQUE INDEX webauthn_credentials_credential_id_key ON auth.webauthn_credentials USING btree (credential_id);
CREATE INDEX webauthn_credentials_user_id_idx ON auth.webauthn_credentials USING btree (user_id);
CREATE INDEX idx_adm_audit_log_action ON public.adm_audit_log USING btree (action);
CREATE INDEX idx_adm_audit_log_created_at ON public.adm_audit_log USING btree (created_at DESC);
CREATE INDEX idx_adm_audit_log_entity ON public.adm_audit_log USING btree (entity_type, entity_id);
CREATE INDEX adm_migration_runs_client_idx ON public.adm_migration_runs USING btree (client_id);
CREATE INDEX idx_adm_sync_jobs_client_id ON public.adm_sync_jobs USING btree (client_id);
CREATE INDEX idx_adm_sync_jobs_status ON public.adm_sync_jobs USING btree (status);
CREATE INDEX idx_adm_sync_logs_job_id ON public.adm_sync_logs USING btree (job_id);
CREATE INDEX ai_agents_channel_types_gin ON public.ai_agents USING gin (channel_types);
CREATE INDEX ai_agents_stage_ids_gin ON public.ai_agents USING gin (stage_ids);
CREATE INDEX idx_ai_agents_active ON public.ai_agents USING btree (active);
CREATE INDEX idx_ai_agents_leads_stages_id ON public.ai_agents USING btree (leads_stages_id);
CREATE INDEX idx_ai_agents_llm_provider_id ON public.ai_agents USING btree (llm_provider_id) WHERE (llm_provider_id IS NOT NULL);
CREATE INDEX idx_ai_agents_pipeline_id ON public.ai_agents USING btree (pipeline_id);
CREATE INDEX idx_ai_agents_wa_channel_id ON public.ai_agents USING btree (wa_channel_id) WHERE (wa_channel_id IS NOT NULL);
CREATE INDEX idx_ai_agents_exec_agent_time ON public.ai_agents_execution_log USING btree (ai_agent_id, created_at DESC);
CREATE INDEX idx_ai_agents_exec_people_time ON public.ai_agents_execution_log USING btree (people_id, created_at DESC);
CREATE INDEX idx_ai_agents_exec_status ON public.ai_agents_execution_log USING btree (execution_status, created_at DESC);
CREATE INDEX idx_ai_exec_log_ai_agent_id ON public.ai_agents_execution_log USING btree (ai_agent_id);
CREATE INDEX idx_ai_exec_log_created_by ON public.ai_agents_execution_log USING btree (created_by);
CREATE INDEX idx_ai_exec_log_lead_id ON public.ai_agents_execution_log USING btree (lead_id);
CREATE INDEX idx_ai_agents_history_ai_agent_id ON public.ai_agents_history USING btree (ai_agent_id);
CREATE INDEX idx_ai_agents_history_created_by ON public.ai_agents_history USING btree (created_by);
CREATE INDEX idx_ai_agents_score_matrix_ai_agent_id ON public.ai_agents_score_matrix USING btree (ai_agent_id);
CREATE INDEX idx_ai_agents_score_matrix_score_matrix_id ON public.ai_agents_score_matrix USING btree (score_matrix_id);
CREATE INDEX idx_ai_agents_steps_agent_id ON public.ai_agents_steps USING btree (ai_agent_id);
CREATE INDEX idx_ai_agents_steps_history_leads_id ON public.ai_agents_steps_history USING btree (lead_id);
CREATE INDEX idx_ai_agents_steps_history_step_id ON public.ai_agents_steps_history USING btree (step_id);
CREATE INDEX idx_bi_ad_campaigns_account ON public.bi_ad_campaigns USING btree (account_id);
CREATE INDEX idx_bi_ad_campaigns_ad_account ON public.bi_ad_campaigns USING btree (ad_account_id) WHERE (ad_account_id IS NOT NULL);
CREATE INDEX idx_bi_ad_campaigns_platform ON public.bi_ad_campaigns USING btree (platform);
CREATE INDEX idx_bi_ad_campaigns_utm_campaign ON public.bi_ad_campaigns USING btree (utm_campaign) WHERE (utm_campaign IS NOT NULL);
CREATE INDEX idx_bi_ad_daily_campaign_date ON public.bi_ad_daily_stats USING btree (campaign_id, stat_date DESC);
CREATE INDEX idx_bi_ad_spend_account_date ON public.bi_ad_spend USING btree (ad_account_id, date DESC);
CREATE INDEX idx_bi_ad_spend_campaign_date ON public.bi_ad_spend USING btree (campaign_id, date DESC) WHERE (campaign_id IS NOT NULL);
CREATE INDEX bi_sdr_targets_year_month_idx ON public.bi_sdr_targets USING btree (year, month);
CREATE INDEX idx_booking_rule_sets_is_default ON public.booking_rule_sets USING btree (is_default) WHERE (is_default = true);
CREATE UNIQUE INDEX idx_booking_rule_sets_url_id ON public.booking_rule_sets USING btree (url_id) WHERE (url_id IS NOT NULL);
CREATE INDEX idx_booking_rules_rule_set_id ON public.booking_rules USING btree (rule_set_id);
CREATE INDEX idx_call_pro_as_queues_active ON public.call_pro_as_queues USING btree (active);
CREATE INDEX idx_call_pro_calls_lead_id ON public.call_pro_calls USING btree (lead_id);
CREATE INDEX idx_call_pro_calls_person ON public.call_pro_calls USING btree (person_id);
CREATE UNIQUE INDEX idx_call_pro_calls_request_id ON public.call_pro_calls USING btree (as_request_id) WHERE (as_request_id IS NOT NULL);
CREATE INDEX idx_call_pro_calls_started ON public.call_pro_calls USING btree (started_at DESC);
CREATE INDEX idx_call_pro_calls_status ON public.call_pro_calls USING btree (status);
CREATE INDEX idx_call_pro_calls_user ON public.call_pro_calls USING btree (user_id);
CREATE UNIQUE INDEX clients_people_instagram_id_key ON public.clients_people USING btree (instagram_id) WHERE (instagram_id IS NOT NULL);
CREATE INDEX clients_people_prospect_campaign_id_idx ON public.clients_people USING btree (prospect_campaign_id) WHERE (prospect_campaign_id IS NOT NULL);
CREATE INDEX idx_clients_people_archived ON public.clients_people USING btree (archived);
CREATE INDEX idx_clients_people_email ON public.clients_people USING btree (email);
CREATE INDEX idx_clients_people_email_not_null ON public.clients_people USING btree (email) WHERE (email IS NOT NULL);
CREATE INDEX idx_clients_people_score_matrix ON public.clients_people USING btree (score_matrix_id);
CREATE INDEX idx_clients_people_status ON public.clients_people USING btree (status);
CREATE INDEX idx_clients_people_telefone_not_null ON public.clients_people USING btree (telefone) WHERE (telefone IS NOT NULL);
CREATE INDEX idx_clients_people_whatsapp ON public.clients_people USING btree (whatsapp);
CREATE INDEX idx_clients_people_whatsapp_not_null ON public.clients_people USING btree (whatsapp) WHERE (whatsapp IS NOT NULL);
CREATE INDEX idx_people_document ON public.clients_people USING btree (document) WHERE (document IS NOT NULL);
CREATE INDEX idx_people_email ON public.clients_people USING btree (lower(email)) WHERE (email IS NOT NULL);
CREATE INDEX idx_people_instagram_handle ON public.clients_people USING btree (lower(instagram_handle)) WHERE (instagram_handle IS NOT NULL);
CREATE INDEX idx_people_instagram_user_id ON public.clients_people USING btree (instagram_user_id) WHERE (instagram_user_id IS NOT NULL);
CREATE INDEX idx_people_merged_into_id ON public.clients_people USING btree (merged_into_id) WHERE (merged_into_id IS NOT NULL);
CREATE INDEX idx_people_whatsapp ON public.clients_people USING btree (whatsapp) WHERE (whatsapp IS NOT NULL);
CREATE INDEX idx_people_companies_company ON public.clients_people_companies USING btree (company_id);
CREATE INDEX idx_people_companies_people ON public.clients_people_companies USING btree (people_id);
CREATE INDEX idx_clients_people_updates_people_id ON public.clients_people_updates USING btree (people_id);
CREATE INDEX idx_clients_people_updates_user_id ON public.clients_people_updates USING btree (user_id);
CREATE INDEX idx_conv_queue_lead ON public.conversion_events_queue USING btree (lead_id, created_at DESC);
CREATE INDEX idx_conv_queue_pending ON public.conversion_events_queue USING btree (created_at) WHERE ((meta_status = 'pending'::text) OR (google_status = 'pending'::text));
CREATE INDEX idx_followup_queue_followup_id ON public.followup_queue USING btree (followup_id);
CREATE INDEX idx_followup_queue_meeting_followup_id ON public.followup_queue USING btree (meeting_followup_id);
CREATE INDEX idx_followup_queue_message_id ON public.followup_queue USING btree (message_id);
CREATE INDEX idx_followup_queue_pessoa_id ON public.followup_queue USING btree (person_id);
CREATE INDEX idx_fup_queue_created ON public.followup_queue USING btree (created_at DESC);
CREATE INDEX idx_fup_queue_lead ON public.followup_queue USING btree (lead_id);
CREATE INDEX idx_fup_queue_pending ON public.followup_queue USING btree (scheduled_at) WHERE (status = 'pending'::text);
CREATE INDEX idx_fup_queue_status ON public.followup_queue USING btree (status);
CREATE INDEX idx_lp_forms_pipeline ON public.form_pro_forms USING btree (pipeline_id) WHERE (pipeline_id IS NOT NULL);
CREATE INDEX idx_form_pro_rate_limits_ip_ts ON public.form_pro_rate_limits USING btree (ip, ts DESC);
CREATE INDEX idx_form_pro_submissions_meta_form ON public.form_pro_submissions USING btree (meta_form_id) WHERE (meta_form_id IS NOT NULL);
CREATE INDEX idx_form_pro_submissions_source ON public.form_pro_submissions USING btree (source);
CREATE INDEX idx_lp_submissions_form_id ON public.form_pro_submissions USING btree (form_id);
CREATE INDEX idx_lp_submissions_lead ON public.form_pro_submissions USING btree (lead_id) WHERE (lead_id IS NOT NULL);
CREATE INDEX idx_lp_submissions_page_submitted ON public.form_pro_submissions USING btree (page_id, submitted_at DESC);
CREATE INDEX idx_lp_submissions_people ON public.form_pro_submissions USING btree (people_id) WHERE (people_id IS NOT NULL);
CREATE INDEX idx_lp_submissions_utm_source ON public.form_pro_submissions USING btree (utm_source) WHERE (utm_source IS NOT NULL);
CREATE INDEX instagram_automation_log_automation_idx ON public.instagram_automation_log USING btree (automation_id, executed_at DESC);
CREATE INDEX instagram_automation_log_person_idx ON public.instagram_automation_log USING btree (person_id, automation_id, executed_at DESC);
CREATE INDEX instagram_automations_trigger_idx ON public.instagram_automations USING btree (trigger_type, is_active, priority);
CREATE INDEX idx_lead_field_definitions_active ON public.lead_field_definitions USING btree (active, category, order_index);
CREATE UNIQUE INDEX idx_lead_field_definitions_key_entity_pipeline ON public.lead_field_definitions USING btree (key, entity_type, pipeline_id) NULLS NOT DISTINCT;
CREATE INDEX idx_lead_field_definitions_pipeline ON public.lead_field_definitions USING btree (pipeline_id) WHERE (pipeline_id IS NOT NULL);
CREATE INDEX idx_lead_field_values_definition ON public.lead_field_values USING btree (field_definition_id);
CREATE INDEX idx_lead_field_values_entity ON public.lead_field_values USING btree (entity_type, entity_id);
CREATE INDEX idx_lead_field_values_lead ON public.lead_field_values USING btree (lead_id);
CREATE INDEX idx_leads_archived ON public.leads USING btree (archived);
CREATE INDEX idx_leads_companies_id ON public.leads USING btree (company_id);
CREATE INDEX idx_leads_created_at ON public.leads USING btree (created_at DESC);
CREATE INDEX idx_leads_lifecycle_stage ON public.leads USING btree (lifecycle_stage) WHERE (lifecycle_stage IS NOT NULL);
CREATE INDEX idx_leads_loss_reason_id ON public.leads USING btree (leads_loss_reasons_id);
CREATE INDEX idx_leads_people_id ON public.leads USING btree (people_id);
CREATE INDEX idx_leads_pipeline_id ON public.leads USING btree (leads_pipelines_id);
CREATE INDEX idx_leads_stage_id ON public.leads USING btree (leads_stages_id);
CREATE INDEX idx_leads_status ON public.leads USING btree (status);
CREATE INDEX idx_leads_team_id ON public.leads USING btree (teams_id);
CREATE INDEX idx_leads_user_id ON public.leads USING btree (user_id);
CREATE INDEX idx_leads_files_leads_id ON public.leads_files USING btree (lead_id);
CREATE INDEX idx_leads_files_user_id ON public.leads_files USING btree (user_id);
CREATE INDEX idx_leads_notes_leads_id ON public.leads_notes USING btree (lead_id);
CREATE INDEX idx_leads_notes_user_id ON public.leads_notes USING btree (user_id);
CREATE INDEX idx_leads_stages_order ON public.leads_stages USING btree (order_index);
CREATE INDEX idx_leads_stages_pipeline_id ON public.leads_stages USING btree (leads_pipelines_id);
CREATE INDEX idx_leads_stages_followups_stage_id ON public.leads_stages_followups USING btree (stage_id);
CREATE INDEX idx_leads_stages_followups_target_stage_id ON public.leads_stages_followups USING btree (target_stage_id);
CREATE INDEX idx_leads_updates_created_at ON public.leads_updates USING btree (created_at DESC);
CREATE INDEX idx_leads_updates_from_stage_id ON public.leads_updates USING btree (from_stage_id);
CREATE INDEX idx_leads_updates_leads_id ON public.leads_updates USING btree (lead_id);
CREATE INDEX idx_leads_updates_to_stage_id ON public.leads_updates USING btree (to_stage_id);
CREATE INDEX idx_leads_updates_user_id ON public.leads_updates USING btree (user_id);
CREATE INDEX idx_meeting_followup_queue_leads_id ON public.meeting_followup_queue USING btree (lead_id);
CREATE INDEX idx_mfq_meeting ON public.meeting_followup_queue USING btree (meeting_id);
CREATE INDEX idx_mfq_people ON public.meeting_followup_queue USING btree (people_id);
CREATE INDEX idx_mfq_rule ON public.meeting_followup_queue USING btree (rule_id);
CREATE INDEX idx_mfq_status_scheduled ON public.meeting_followup_queue USING btree (status, scheduled_for) WHERE (status = 'pending'::text);
CREATE INDEX idx_meeting_records_created_by ON public.meeting_records USING btree (created_by);
CREATE INDEX meeting_records_meeting_id_idx ON public.meeting_records USING btree (meeting_id);
CREATE INDEX meeting_records_source_idx ON public.meeting_records USING btree (source);
CREATE INDEX meeting_records_type_idx ON public.meeting_records USING btree (meeting_id, record_type);
CREATE INDEX idx_meetings_leads_id ON public.meetings USING btree (lead_id);
CREATE INDEX idx_meetings_people_id ON public.meetings USING btree (people_id);
CREATE INDEX idx_meetings_start_time ON public.meetings USING btree (start_time);
CREATE INDEX idx_meetings_status ON public.meetings USING btree (status);
CREATE INDEX idx_meetings_teams_id ON public.meetings USING btree (teams_id);
CREATE INDEX idx_meetings_users_id ON public.meetings USING btree (user_id);
CREATE UNIQUE INDEX meetings_google_event_id_idx ON public.meetings USING btree (google_event_id) WHERE (google_event_id IS NOT NULL);
CREATE UNIQUE INDEX meetings_ms_meeting_id_idx ON public.meetings USING btree (ms_meeting_id) WHERE (ms_meeting_id IS NOT NULL);
CREATE INDEX meetings_source_idx ON public.meetings USING btree (source) WHERE (source IS NOT NULL);
CREATE INDEX idx_message_buffer_wa_phone_number_id ON public.message_buffer USING btree (wa_phone_number_id) WHERE (wa_phone_number_id IS NOT NULL);
CREATE INDEX message_buffer_ready_to_process ON public.message_buffer USING btree (people_id, expires_at) WHERE (processed = false);
CREATE INDEX idx_messages_created_at ON public.messages USING btree (created_at DESC);
CREATE INDEX idx_messages_followup_id ON public.messages USING btree (followup_id);
CREATE INDEX idx_messages_leads_id ON public.messages USING btree (lead_id);
CREATE INDEX idx_messages_module_ref_id ON public.messages USING btree (module_ref_id) WHERE (module_ref_id IS NOT NULL);
CREATE INDEX idx_messages_parent ON public.messages USING btree (parent_message_id);
CREATE INDEX idx_messages_pending_delivery ON public.messages USING btree (channel, created_at) WHERE ((status = 'pending'::text) AND (from_contact <> 'cliente'::text));
CREATE INDEX idx_messages_people_id ON public.messages USING btree (people_id);
CREATE INDEX idx_messages_source_type ON public.messages USING btree (source_type) WHERE (source_type IS NOT NULL);
CREATE INDEX idx_messages_status ON public.messages USING btree (status);
CREATE INDEX idx_messages_users_id ON public.messages USING btree (user_id);
CREATE INDEX idx_messages_wa_phone_number_id ON public.messages USING btree (wa_phone_number_id) WHERE (wa_phone_number_id IS NOT NULL);
CREATE INDEX messages_execution_id_idx ON public.messages USING btree (execution_id) WHERE (execution_id IS NOT NULL);
CREATE UNIQUE INDEX messages_ig_message_id_key ON public.messages USING btree (ig_message_id) WHERE (ig_message_id IS NOT NULL);
CREATE UNIQUE INDEX messages_wa_message_id_unique ON public.messages USING btree (wa_message_id) WHERE (wa_message_id IS NOT NULL);
CREATE INDEX idx_meta_lead_forms_page_id ON public.meta_lead_forms USING btree (page_id);
CREATE INDEX idx_omni_channel_alerts_channel_type ON public.omni_channel_alerts USING btree (channel, alert_type, created_at DESC);
CREATE INDEX idx_omni_channel_alerts_severity ON public.omni_channel_alerts USING btree (severity, created_at DESC) WHERE (resolved_at IS NULL);
CREATE INDEX idx_dead_letter_message ON public.omni_delivery_dead_letter USING btree (message_id);
CREATE INDEX idx_dead_letter_retry ON public.omni_delivery_dead_letter USING btree (status, next_retry_at) WHERE (status = 'pending'::text);
CREATE INDEX prospect_audit_action_idx ON public.prospect_audit_log USING btree (action, created_at DESC);
CREATE INDEX prospect_audit_campaign_id_idx ON public.prospect_audit_log USING btree (campaign_id);
CREATE INDEX prospect_audit_contact_id_idx ON public.prospect_audit_log USING btree (contact_id);
CREATE INDEX prospect_audit_establishment_id_idx ON public.prospect_audit_log USING btree (establishment_id);
CREATE INDEX prospect_campaigns_created_by_idx ON public.prospect_campaigns USING btree (created_by);
CREATE INDEX prospect_campaigns_status_idx ON public.prospect_campaigns USING btree (status);
CREATE INDEX idx_pc_campaign_status ON public.prospect_companies USING btree (campaign_id, status);
CREATE INDEX idx_pc_company_id ON public.prospect_companies USING btree (company_id) WHERE (company_id IS NOT NULL);
CREATE INDEX idx_pc_explorium_biz ON public.prospect_companies USING btree (explorium_business_id) WHERE (explorium_business_id IS NOT NULL);
CREATE INDEX idx_pc_linkedin_id ON public.prospect_companies USING btree (linkedin_id) WHERE (linkedin_id IS NOT NULL);
CREATE INDEX prospect_contacts_ai_score_idx ON public.prospect_contacts USING btree (campaign_id, ai_score DESC) WHERE (ai_score IS NOT NULL);
CREATE INDEX prospect_contacts_campaign_id_idx ON public.prospect_contacts USING btree (campaign_id);
CREATE INDEX prospect_contacts_opt_out_idx ON public.prospect_contacts USING btree (opt_out_requested) WHERE (opt_out_requested = true);
CREATE INDEX prospect_contacts_person_id_idx ON public.prospect_contacts USING btree (person_id) WHERE (person_id IS NOT NULL);
CREATE INDEX prospect_contacts_retention_idx ON public.prospect_contacts USING btree (data_retention_deadline) WHERE (data_retention_deadline IS NOT NULL);
CREATE INDEX prospect_contacts_status_idx ON public.prospect_contacts USING btree (campaign_id, status);
CREATE INDEX idx_per_person ON public.prospect_enrichment_results USING btree (person_id);
CREATE INDEX idx_prospect_establishments_campaign_status ON public.prospect_establishments USING btree (campaign_id, status);
CREATE INDEX idx_prospect_establishments_company_id ON public.prospect_establishments USING btree (company_id) WHERE (company_id IS NOT NULL);
CREATE INDEX idx_prospect_establishments_legacy_contact_id ON public.prospect_establishments USING btree (legacy_contact_id) WHERE (legacy_contact_id IS NOT NULL);
CREATE INDEX idx_prospect_establishments_place_id ON public.prospect_establishments USING btree (google_place_id);
CREATE INDEX prospect_opt_out_email_hash_idx ON public.prospect_opt_out_registry USING btree (email_hash) WHERE (email_hash IS NOT NULL);
CREATE INDEX prospect_opt_out_phone_hash_idx ON public.prospect_opt_out_registry USING btree (phone_hash) WHERE (phone_hash IS NOT NULL);
CREATE INDEX idx_prospect_people_email ON public.prospect_people USING btree (email) WHERE (email IS NOT NULL);
CREATE INDEX idx_prospect_people_establishment ON public.prospect_people USING btree (establishment_id);
CREATE INDEX idx_prospect_people_legacy_contact_id ON public.prospect_people USING btree (legacy_contact_id) WHERE (legacy_contact_id IS NOT NULL);
CREATE INDEX idx_prospect_people_person_id ON public.prospect_people USING btree (person_id) WHERE (person_id IS NOT NULL);
CREATE INDEX idx_ppv2_campaign_status ON public.prospect_people_v2 USING btree (campaign_id, status);
CREATE INDEX idx_ppv2_company ON public.prospect_people_v2 USING btree (company_id);
CREATE INDEX idx_ppv2_email ON public.prospect_people_v2 USING btree (email) WHERE (email IS NOT NULL);
CREATE INDEX idx_ppv2_explorium_pid ON public.prospect_people_v2 USING btree (explorium_prospect_id) WHERE (explorium_prospect_id IS NOT NULL);
CREATE INDEX idx_ppv2_person_id ON public.prospect_people_v2 USING btree (person_id) WHERE (person_id IS NOT NULL);
CREATE INDEX idx_ppv2_role ON public.prospect_people_v2 USING btree ("current_role") WHERE ("current_role" IS NOT NULL);
CREATE INDEX idx_ppv2_selected ON public.prospect_people_v2 USING btree (campaign_id, selected) WHERE (selected = true);
CREATE INDEX idx_ppv2_seniority ON public.prospect_people_v2 USING btree (seniority) WHERE (seniority IS NOT NULL);
CREATE INDEX schedule_automations_pipeline_idx ON public.schedule_automations USING btree (pipeline_id, is_active);
CREATE UNIQUE INDEX schedule_automations_unique_rule ON public.schedule_automations USING btree (pipeline_id, trigger_status) WHERE (is_active = true);
CREATE INDEX score_category_items_category_id_idx ON public.score_category_items USING btree (category_id);
CREATE INDEX score_category_items_order_idx ON public.score_category_items USING btree (category_id, order_index);
CREATE INDEX score_matrix_category_selections_gin_idx ON public.score_matrix USING gin (category_selections);
CREATE INDEX idx_sends_channel ON public.sends USING btree (channel);
CREATE INDEX idx_sends_created_by ON public.sends USING btree (created_by);
CREATE INDEX idx_sends_pipeline_id ON public.sends USING btree (pipeline_id);
CREATE INDEX idx_sends_status ON public.sends USING btree (status);
CREATE INDEX idx_sends_team_id ON public.sends USING btree (team_id);
CREATE INDEX idx_sends_wa_channel_id ON public.sends USING btree (wa_channel_id) WHERE (wa_channel_id IS NOT NULL);
CREATE INDEX idx_sends_contacts_people_id ON public.sends_contacts USING btree (people_id);
CREATE INDEX idx_sends_contacts_send_id ON public.sends_contacts USING btree (send_id);
CREATE INDEX idx_sends_contacts_status ON public.sends_contacts USING btree (status);
CREATE UNIQUE INDEX settings_ai_providers_one_default_per_provider ON public.settings_ai_providers USING btree (provider) WHERE ((is_default = true) AND (active = true));
CREATE UNIQUE INDEX settings_elevenlabs_singleton ON public.settings_elevenlabs USING btree ((true));
CREATE INDEX idx_settings_omni_new_contact_pipeline_id ON public.settings_omni_new_contact USING btree (pipeline_id);
CREATE INDEX idx_settings_omni_new_contact_stage_id ON public.settings_omni_new_contact USING btree (stage_id);
CREATE INDEX idx_settings_schedules_user_id ON public.settings_schedules USING btree (user_id);
CREATE INDEX idx_settings_users_active ON public.settings_users USING btree (active);
CREATE INDEX idx_settings_users_auth_user_id ON public.settings_users USING btree (auth_user_id);
CREATE INDEX idx_settings_users_email ON public.settings_users USING btree (email);
CREATE INDEX idx_settings_users_teams_team_id ON public.settings_users_teams USING btree (team_id);
CREATE INDEX idx_settings_users_teams_user_id ON public.settings_users_teams USING btree (user_id);
CREATE UNIQUE INDEX whatsapp_channels_one_default ON public.settings_whatsapp_channels USING btree (is_default) WHERE ((is_default = true) AND (active = true));
CREATE INDEX idx_webhook_logs_created_at ON public.webhook_logs USING btree (created_at DESC);
CREATE INDEX idx_webhook_logs_webhook_id ON public.webhook_logs USING btree (webhook_id);
CREATE INDEX idx_webhooks_active ON public.webhooks USING btree (active);
CREATE INDEX idx_webhooks_event_type ON public.webhooks USING btree (event_type);
CREATE INDEX idx_webhooks_pipeline_id ON public.webhooks USING btree (pipeline_id);
CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);
CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX buckets_vectors_pkey ON storage.buckets_vectors USING btree (id);
CREATE UNIQUE INDEX migrations_name_key ON storage.migrations USING btree (name);
CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);
CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");
CREATE INDEX idx_objects_bucket_id_name_lower ON storage.objects USING btree (bucket_id, lower(name) COLLATE "C");
CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);
CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);
CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);
CREATE UNIQUE INDEX vector_indexes_pkey ON storage.vector_indexes USING btree (id);

-- ============================================================
-- VIEWS
-- ============================================================
CREATE OR REPLACE VIEW extensions.pg_stat_statements AS
 SELECT userid,
    dbid,
    toplevel,
    queryid,
    query,
    plans,
    total_plan_time,
    min_plan_time,
    max_plan_time,
    mean_plan_time,
    stddev_plan_time,
    calls,
    total_exec_time,
    min_exec_time,
    max_exec_time,
    mean_exec_time,
    stddev_exec_time,
    rows,
    shared_blks_hit,
    shared_blks_read,
    shared_blks_dirtied,
    shared_blks_written,
    local_blks_hit,
    local_blks_read,
    local_blks_dirtied,
    local_blks_written,
    temp_blks_read,
    temp_blks_written,
    shared_blk_read_time,
    shared_blk_write_time,
    local_blk_read_time,
    local_blk_write_time,
    temp_blk_read_time,
    temp_blk_write_time,
    wal_records,
    wal_fpi,
    wal_bytes,
    jit_functions,
    jit_generation_time,
    jit_inlining_count,
    jit_inlining_time,
    jit_optimization_count,
    jit_optimization_time,
    jit_emission_count,
    jit_emission_time,
    jit_deform_count,
    jit_deform_time,
    stats_since,
    minmax_stats_since
   FROM pg_stat_statements(true) pg_stat_statements(userid, dbid, toplevel, queryid, query, plans, total_plan_time, min_plan_time, max_plan_time, mean_plan_time, stddev_plan_time, calls, total_exec_time, min_exec_time, max_exec_time, mean_exec_time, stddev_exec_time, rows, shared_blks_hit, shared_blks_read, shared_blks_dirtied, shared_blks_written, local_blks_hit, local_blks_read, local_blks_dirtied, local_blks_written, temp_blks_read, temp_blks_written, shared_blk_read_time, shared_blk_write_time, local_blk_read_time, local_blk_write_time, temp_blk_read_time, temp_blk_write_time, wal_records, wal_fpi, wal_bytes, jit_functions, jit_generation_time, jit_inlining_count, jit_inlining_time, jit_optimization_count, jit_optimization_time, jit_emission_count, jit_emission_time, jit_deform_count, jit_deform_time, stats_since, minmax_stats_since);
CREATE OR REPLACE VIEW extensions.pg_stat_statements_info AS
 SELECT dealloc,
    stats_reset
   FROM pg_stat_statements_info() pg_stat_statements_info(dealloc, stats_reset);
CREATE OR REPLACE VIEW public.meta_lead_form_pages_safe AS
 SELECT id,
    page_id,
    page_name,
    subscribed,
    created_at,
    updated_at
   FROM meta_lead_form_pages;
CREATE OR REPLACE VIEW public.prospect_contacts_v AS
 SELECT pe.legacy_contact_id AS id,
    pe.campaign_id,
    pp.name,
    pp.email,
    pp.phone,
    pe.company,
    pp.role,
    pe.website,
    pe.address,
    pe.segment,
    pe.google_rating,
    pe.google_review_count,
    pe.google_place_id,
    pe.google_maps_url,
    pe.enrichment_data,
    pe.ai_score,
    pe.ai_reasoning,
    pe.ai_tags,
    pe.status,
    pp.person_id,
    pe.lead_id,
    pe.consent_basis,
    pe.data_source,
    COALESCE(pp.opt_out_requested, pe.opt_out_requested) AS opt_out_requested,
    COALESCE(pp.data_retention_deadline, pe.data_retention_deadline) AS data_retention_deadline,
    pe.reviewed_by,
    pe.reviewed_at,
    pe.created_at
   FROM prospect_establishments pe
     LEFT JOIN prospect_people pp ON pp.establishment_id = pe.id;

-- ============================================================
-- FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION auth.email()
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$function$


CREATE OR REPLACE FUNCTION auth.jwt()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$function$


CREATE OR REPLACE FUNCTION auth.role()
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$function$


CREATE OR REPLACE FUNCTION auth.uid()
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$function$


CREATE OR REPLACE FUNCTION extensions.armor(bytea, text[], text[])
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_armor$function$


-- (overload) extensions.armor
CREATE OR REPLACE FUNCTION extensions.armor(bytea)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_armor$function$


CREATE OR REPLACE FUNCTION extensions.crypt(text, text)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_crypt$function$


CREATE OR REPLACE FUNCTION extensions.dearmor(text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_dearmor$function$


CREATE OR REPLACE FUNCTION extensions.decrypt(bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_decrypt$function$


CREATE OR REPLACE FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_decrypt_iv$function$


CREATE OR REPLACE FUNCTION extensions.digest(text, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_digest$function$


-- (overload) extensions.digest
CREATE OR REPLACE FUNCTION extensions.digest(bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_digest$function$


CREATE OR REPLACE FUNCTION extensions.encrypt(bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_encrypt$function$


CREATE OR REPLACE FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_encrypt_iv$function$


CREATE OR REPLACE FUNCTION extensions.gen_random_bytes(integer)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_random_bytes$function$


CREATE OR REPLACE FUNCTION extensions.gen_random_uuid()
 RETURNS uuid
 LANGUAGE c
 PARALLEL SAFE
AS '$libdir/pgcrypto', $function$pg_random_uuid$function$


CREATE OR REPLACE FUNCTION extensions.gen_salt(text)
 RETURNS text
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_gen_salt$function$


-- (overload) extensions.gen_salt
CREATE OR REPLACE FUNCTION extensions.gen_salt(text, integer)
 RETURNS text
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_gen_salt_rounds$function$


CREATE OR REPLACE FUNCTION extensions.grant_pg_cron_access()
 RETURNS event_trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$function$


CREATE OR REPLACE FUNCTION extensions.grant_pg_graphql_access()
 RETURNS event_trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    func_is_graphql_resolve bool;
BEGIN
    func_is_graphql_resolve = (
        SELECT n.proname = 'resolve'
        FROM pg_event_trigger_ddl_commands() AS ev
        LEFT JOIN pg_catalog.pg_proc AS n
        ON ev.objid = n.oid
    );

    IF func_is_graphql_resolve
    THEN
        -- Update public wrapper to pass all arguments through to the pg_graphql resolve func
        DROP FUNCTION IF EXISTS graphql_public.graphql;
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language sql
        as $$
            select graphql.resolve(
                query := query,
                variables := coalesce(variables, '{}'),
                "operationName" := "operationName",
                extensions := extensions
            );
        $$;

        -- This hook executes when `graphql.resolve` is created. That is not necessarily the last
        -- function in the extension so we need to grant permissions on existing entities AND
        -- update default permissions to any others that are created after `graphql.resolve`
        grant usage on schema graphql to postgres, anon, authenticated, service_role;
        grant select on all tables in schema graphql to postgres, anon, authenticated, service_role;
        grant execute on all functions in schema graphql to postgres, anon, authenticated, service_role;
        grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on tables to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on functions to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on sequences to postgres, anon, authenticated, service_role;

        -- Allow postgres role to allow granting usage on graphql and graphql_public schemas to custom roles
        grant usage on schema graphql_public to postgres with grant option;
        grant usage on schema graphql to postgres with grant option;
    END IF;

END;
$function$


CREATE OR REPLACE FUNCTION extensions.grant_pg_net_access()
 RETURNS event_trigger
 LANGUAGE plpgsql
AS $function$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM pg_event_trigger_ddl_commands() AS ev
      JOIN pg_extension AS ext
      ON ev.objid = ext.oid
      WHERE ext.extname = 'pg_net'
    )
    THEN
      GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

      IF EXISTS (
        SELECT FROM pg_extension
        WHERE extname = 'pg_net'
        -- all versions in use on existing projects as of 2025-02-20
        -- version 0.12.0 onwards don't need these applied
        AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8', '0.10.0', '0.11.0')
      ) THEN
        ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
        ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

        ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
        ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

        REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
        REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

        GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
        GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      END IF;
    END IF;
  END;
  $function$


CREATE OR REPLACE FUNCTION extensions.hmac(bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_hmac$function$


-- (overload) extensions.hmac
CREATE OR REPLACE FUNCTION extensions.hmac(text, text, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_hmac$function$


CREATE OR REPLACE FUNCTION extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone)
 RETURNS SETOF record
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pg_stat_statements', $function$pg_stat_statements_1_11$function$


CREATE OR REPLACE FUNCTION extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone)
 RETURNS record
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pg_stat_statements', $function$pg_stat_statements_info$function$


CREATE OR REPLACE FUNCTION extensions.pg_stat_statements_reset(userid oid DEFAULT 0, dbid oid DEFAULT 0, queryid bigint DEFAULT 0, minmax_only boolean DEFAULT false)
 RETURNS timestamp with time zone
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pg_stat_statements', $function$pg_stat_statements_reset_1_11$function$


CREATE OR REPLACE FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text)
 RETURNS SETOF record
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_armor_headers$function$


CREATE OR REPLACE FUNCTION extensions.pgp_key_id(bytea)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_key_id_w$function$


CREATE OR REPLACE FUNCTION extensions.pgp_pub_decrypt(bytea, bytea)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_text$function$


-- (overload) extensions.pgp_pub_decrypt
CREATE OR REPLACE FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_text$function$


-- (overload) extensions.pgp_pub_decrypt
CREATE OR REPLACE FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_text$function$


CREATE OR REPLACE FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_bytea$function$


-- (overload) extensions.pgp_pub_decrypt_bytea
CREATE OR REPLACE FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_bytea$function$


-- (overload) extensions.pgp_pub_decrypt_bytea
CREATE OR REPLACE FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_bytea$function$


CREATE OR REPLACE FUNCTION extensions.pgp_pub_encrypt(text, bytea)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_encrypt_text$function$


-- (overload) extensions.pgp_pub_encrypt
CREATE OR REPLACE FUNCTION extensions.pgp_pub_encrypt(text, bytea, text)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_encrypt_text$function$


CREATE OR REPLACE FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_encrypt_bytea$function$


-- (overload) extensions.pgp_pub_encrypt_bytea
CREATE OR REPLACE FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_encrypt_bytea$function$


CREATE OR REPLACE FUNCTION extensions.pgp_sym_decrypt(bytea, text, text)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_decrypt_text$function$


-- (overload) extensions.pgp_sym_decrypt
CREATE OR REPLACE FUNCTION extensions.pgp_sym_decrypt(bytea, text)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_decrypt_text$function$


CREATE OR REPLACE FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_decrypt_bytea$function$


-- (overload) extensions.pgp_sym_decrypt_bytea
CREATE OR REPLACE FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_decrypt_bytea$function$


CREATE OR REPLACE FUNCTION extensions.pgp_sym_encrypt(text, text)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_encrypt_text$function$


-- (overload) extensions.pgp_sym_encrypt
CREATE OR REPLACE FUNCTION extensions.pgp_sym_encrypt(text, text, text)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_encrypt_text$function$


CREATE OR REPLACE FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_encrypt_bytea$function$


-- (overload) extensions.pgp_sym_encrypt_bytea
CREATE OR REPLACE FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_encrypt_bytea$function$


CREATE OR REPLACE FUNCTION extensions.pgrst_ddl_watch()
 RETURNS event_trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $function$


CREATE OR REPLACE FUNCTION extensions.pgrst_drop_watch()
 RETURNS event_trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $function$


CREATE OR REPLACE FUNCTION extensions.set_graphql_placeholder()
 RETURNS event_trigger
 LANGUAGE plpgsql
AS $function$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$function$


CREATE OR REPLACE FUNCTION extensions.uuid_generate_v1()
 RETURNS uuid
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_generate_v1$function$


CREATE OR REPLACE FUNCTION extensions.uuid_generate_v1mc()
 RETURNS uuid
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_generate_v1mc$function$


CREATE OR REPLACE FUNCTION extensions.uuid_generate_v3(namespace uuid, name text)
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_generate_v3$function$


CREATE OR REPLACE FUNCTION extensions.uuid_generate_v4()
 RETURNS uuid
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_generate_v4$function$


CREATE OR REPLACE FUNCTION extensions.uuid_generate_v5(namespace uuid, name text)
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_generate_v5$function$


CREATE OR REPLACE FUNCTION extensions.uuid_nil()
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_nil$function$


CREATE OR REPLACE FUNCTION extensions.uuid_ns_dns()
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_ns_dns$function$


CREATE OR REPLACE FUNCTION extensions.uuid_ns_oid()
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_ns_oid$function$


CREATE OR REPLACE FUNCTION extensions.uuid_ns_url()
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_ns_url$function$


CREATE OR REPLACE FUNCTION extensions.uuid_ns_x500()
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_ns_x500$function$


CREATE OR REPLACE FUNCTION public.adm_client_decrypted_secrets(p_client_id uuid)
 RETURNS TABLE(service_role_key text, db_password text, management_token text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_context TEXT;
BEGIN
  v_context := p_client_id::TEXT;
  RETURN QUERY
    SELECT
      app_decrypt_secret(c.service_role_key, v_context) AS service_role_key,
      app_decrypt_secret(c.db_password, v_context) AS db_password,
      app_decrypt_secret(c.management_token, v_context) AS management_token
    FROM adm_clients c
    WHERE c.id = p_client_id;
END;
$function$


CREATE OR REPLACE FUNCTION public.adm_clients_secrets_status()
 RETURNS TABLE(id uuid, has_service_role_key boolean, has_db_password boolean, has_management_token boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    id,
    (service_role_key IS NOT NULL AND service_role_key <> '') AS has_service_role_key,
    (db_password IS NOT NULL AND db_password <> '')           AS has_db_password,
    (management_token IS NOT NULL AND management_token <> '')  AS has_management_token
  FROM adm_clients;
$function$


CREATE OR REPLACE FUNCTION public.adm_clients_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.adm_timeout_stuck_jobs()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  timed_out_count INTEGER;
BEGIN
  WITH timed_out AS (
    UPDATE adm_sync_jobs
    SET status = 'failed',
        completed_at = now(),
        error_message = 'Timeout: job excedeu 10 minutos'
    WHERE status = 'running'
      AND started_at < now() - interval '10 minutes'
    RETURNING id, client_id
  ),
  client_updates AS (
    UPDATE adm_clients
    SET sync_status = 'error'
    WHERE id IN (SELECT client_id FROM timed_out)
  )
  SELECT count(*) INTO timed_out_count FROM timed_out;

  -- Insert log for each timed out job
  INSERT INTO adm_sync_logs (job_id, level, message)
  SELECT id, 'error', '[' || now()::text || '] Timeout: job excedeu 10 minutos e foi marcado como failed automaticamente'
  FROM adm_sync_jobs
  WHERE status = 'failed'
    AND error_message = 'Timeout: job excedeu 10 minutos'
    AND completed_at >= now() - interval '1 minute';

  RETURN timed_out_count;
END;
$function$


CREATE OR REPLACE FUNCTION public.app_decrypt_secret(p_encrypted text, p_context text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF p_encrypted IS NULL OR p_encrypted = '' THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_decrypt(decode(p_encrypted, 'base64'), concat('app_secret_', p_context));
EXCEPTION WHEN OTHERS THEN
  -- If decryption fails (e.g., value was never encrypted / key mismatch),
  -- return the raw value as-is for backwards compatibility during migration
  RETURN p_encrypted;
END;
$function$


CREATE OR REPLACE FUNCTION public.app_encrypt_secret(p_value text, p_context text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF p_value IS NULL OR p_value = '' THEN
    RETURN NULL;
  END IF;
  RETURN encode(pgp_sym_encrypt(p_value, concat('app_secret_', p_context)), 'base64');
END;
$function$


CREATE OR REPLACE FUNCTION public.assign_booking_rule_set_url_id()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.url_id IS NULL THEN
    SELECT COALESCE(MAX(url_id), 0) + 1
    INTO NEW.url_id
    FROM public.booking_rule_sets;
  END IF;
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.book_meeting(p_lead_id uuid, p_user_id uuid, p_title text, p_start_ts timestamp with time zone, p_duration_minutes integer DEFAULT 30, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_meeting_id UUID;
  v_people_id  UUID;
  v_end_ts     TIMESTAMPTZ;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.leads WHERE id = p_lead_id) THEN
    RAISE EXCEPTION 'book_meeting: lead % not found', p_lead_id;
  END IF;

  SELECT people_id INTO v_people_id FROM public.leads WHERE id = p_lead_id;
  v_end_ts := p_start_ts + (p_duration_minutes || ' minutes')::INTERVAL;

  INSERT INTO public.meetings (
    lead_id, people_id, user_id, title, start_time, end_time, notes, status, source
  )
  VALUES (
    p_lead_id, v_people_id, p_user_id, p_title,
    p_start_ts, v_end_ts,
    p_notes,
    'agendado',
    'ai_agent'
  )
  RETURNING id INTO v_meeting_id;

  RETURN v_meeting_id;
END;
$function$


-- (overload) public.book_meeting
CREATE OR REPLACE FUNCTION public.book_meeting(p_lead_id uuid, p_start_time timestamp with time zone, p_end_time timestamp with time zone, p_rule_set_id uuid DEFAULT NULL::uuid, p_duration integer DEFAULT 30, p_notes text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id       uuid;
  v_user_name     text;
  v_meeting_id    uuid;
  v_title         text;
  v_people_id     uuid;
  v_eligible_ids  uuid[];
BEGIN
  v_eligible_ids := public.get_booking_eligible_user_ids(p_rule_set_id);

  IF v_eligible_ids IS NULL OR array_length(v_eligible_ids, 1) IS NULL THEN
    RETURN json_build_object('error', 'Nenhum consultor disponível');
  END IF;

  -- Resolve people_id from lead
  SELECT people_id INTO v_people_id FROM public.leads WHERE id = p_lead_id;

  IF p_rule_set_id IS NOT NULL THEN
    SELECT su.id, su.name
    INTO v_user_id, v_user_name
    FROM public.booking_rules br
    INNER JOIN public.settings_users su
      ON su.id = (br.config->>'user_id')::uuid
      AND su.active = true
      AND su.id = ANY(v_eligible_ids)
    WHERE br.rule_set_id = p_rule_set_id
      AND br.rule_type   = 'specific_user'
      AND br.is_active   = true
      AND NOT EXISTS (
        SELECT 1 FROM public.meetings m
        WHERE m.user_id    = su.id
          AND m.start_time < p_end_time
          AND m.end_time   > p_start_time
          AND m.status NOT IN ('cancelado', 'cancelada')
      )
    ORDER BY br.order_index ASC
    LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    SELECT su.id, su.name
    INTO v_user_id, v_user_name
    FROM public.settings_users su
    WHERE su.id = ANY(v_eligible_ids)
      AND su.active = true
      AND NOT EXISTS (
        SELECT 1 FROM public.meetings m
        WHERE m.user_id    = su.id
          AND m.start_time < p_end_time
          AND m.end_time   > p_start_time
          AND m.status NOT IN ('cancelado', 'cancelada')
      )
    ORDER BY
      (SELECT COUNT(*) FROM public.meetings m2
       WHERE m2.user_id    = su.id
         AND m2.start_time >= NOW()
         AND m2.status NOT IN ('cancelado', 'cancelada')
      ) ASC,
      COALESCE((
        SELECT MAX(m3.created_at) FROM public.meetings m3
        WHERE m3.user_id = su.id
      ), '1970-01-01'::timestamptz) ASC
    LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Horário não disponível — escolha outro horário');
  END IF;

  v_title := 'Reunião agendada — ' ||
    TO_CHAR(p_start_time AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');

  INSERT INTO public.meetings (
    lead_id, people_id, user_id, title, start_time, end_time, status, notes, source
  )
  VALUES (
    p_lead_id, v_people_id, v_user_id, v_title,
    p_start_time, p_end_time,
    'agendado', p_notes, 'public_booking'
  )
  RETURNING id INTO v_meeting_id;

  RETURN json_build_object(
    'meeting_id', v_meeting_id::text,
    'consultor', json_build_object(
      'id',   v_user_id::text,
      'name', v_user_name
    )
  );
END;
$function$


CREATE OR REPLACE FUNCTION public.claim_pending_messages(p_batch_size integer DEFAULT 20, p_max_age_hours integer DEFAULT 24, p_people_id uuid DEFAULT NULL::uuid, p_channel text DEFAULT NULL::text)
 RETURNS TABLE(id bigint, channel text, content text, message_type text, media_url text, media_metadata jsonb, people_id uuid, lead_id uuid, user_id uuid, source_type text, module_ref_id uuid, whatsapp_template_id text, wa_phone_number_id text, execution_id uuid, metadata jsonb, sent_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    UPDATE messages m_upd
    SET status = 'sending'
    WHERE m_upd.id IN (
      SELECT m.id
      FROM messages m
      WHERE m.status = 'pending'
        AND m.from_contact != 'cliente'
        AND m.created_at > now() - (p_max_age_hours || ' hours')::interval
        AND (p_people_id IS NULL OR m.people_id = p_people_id)
        AND (p_channel IS NULL OR m.channel = p_channel)
        AND (
          (m.metadata->>'delay_minutes') IS NULL
          OR (m.metadata->>'delay_minutes')::int = 0
          OR (
            COALESCE(m.sent_at, m.created_at)
            + ((m.metadata->>'delay_minutes')::int * interval '1 minute')
            <= now()
          )
        )
      ORDER BY m.id ASC
      LIMIT p_batch_size
      FOR UPDATE SKIP LOCKED
    )
    RETURNING
      m_upd.id,
      m_upd.channel,
      m_upd.content,
      m_upd.message_type,
      m_upd.media_url,
      m_upd.media_metadata,
      m_upd.people_id,
      m_upd.lead_id,
      m_upd.user_id,
      m_upd.source_type,
      m_upd.module_ref_id,
      m_upd.whatsapp_template_id,
      m_upd.wa_phone_number_id,
      m_upd.execution_id,
      m_upd.metadata,
      m_upd.sent_at
  )
  SELECT * FROM claimed ORDER BY claimed.id ASC;
END;
$function$


CREATE OR REPLACE FUNCTION public.cleanup_agent_history(p_agent_id uuid, p_keep_versions integer DEFAULT 50)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  DELETE FROM ai_agents_history
  WHERE ai_agent_id = p_agent_id
    AND id NOT IN (
      SELECT id
      FROM ai_agents_history
      WHERE ai_agent_id = p_agent_id
      ORDER BY created_at DESC
      LIMIT p_keep_versions
    );
END;
$function$


CREATE OR REPLACE FUNCTION public.create_tenant_user(p_email text, p_password text, p_name text, p_phone text DEFAULT NULL::text, p_user_type text DEFAULT 'user'::text, p_super_admin boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_service_role_key text;
  v_supabase_url text;
  v_auth_user_id uuid;
  v_user_record jsonb;
  v_request_id bigint;
  v_status int;
  v_body text;
  v_attempts int := 0;
BEGIN
  -- Disable statement timeout for this call — HTTP + polling can exceed 8s default
  SET LOCAL statement_timeout = '30s';

  -- 1. Get credentials from _app_config
  SELECT value INTO v_service_role_key FROM _app_config WHERE key = 'service_role_key';
  SELECT value INTO v_supabase_url FROM _app_config WHERE key = 'supabase_url';

  IF v_service_role_key IS NULL OR v_supabase_url IS NULL THEN
    RETURN jsonb_build_object('error', 'Configuração do tenant incompleta. Contacte o administrador.');
  END IF;

  IF NOT v_service_role_key LIKE 'eyJ%' THEN
    RETURN jsonb_build_object('error', 'Service Role Key inválida (não parece um JWT). Re-salve no ADM.');
  END IF;

  -- 2. Fire async HTTP request to Auth Admin API
  SELECT net.http_post(
    url     := v_supabase_url || '/auth/v1/admin/users',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'apikey',        v_service_role_key,
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := jsonb_build_object(
      'email',        p_email,
      'password',     p_password,
      'email_confirm', true,
      'user_metadata', jsonb_build_object('full_name', p_name)
    )
  ) INTO v_request_id;

  -- 3. Poll for response (flat columns: status_code + body)
  LOOP
    PERFORM pg_sleep(0.5);
    v_attempts := v_attempts + 1;

    BEGIN
      SELECT status_code, body
        INTO v_status, v_body
        FROM net._http_response
       WHERE id = v_request_id;
    EXCEPTION WHEN undefined_column THEN
      -- Older pg_net uses 'content' instead of 'body'
      SELECT status_code, content
        INTO v_status, v_body
        FROM net._http_response
       WHERE id = v_request_id;
    END;

    EXIT WHEN v_status IS NOT NULL;
    EXIT WHEN v_attempts >= 20; -- max 10s
  END LOOP;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('error', 'Timeout aguardando resposta do Auth. Tente novamente.');
  END IF;

  IF v_status >= 400 THEN
    RETURN jsonb_build_object('error', COALESCE(
      (v_body::jsonb ->> 'msg'),
      (v_body::jsonb ->> 'message'),
      v_body,
      'Erro ao criar usuário no Auth'
    ));
  END IF;

  v_auth_user_id := (v_body::jsonb ->> 'id')::uuid;

  IF v_auth_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Auth retornou sem ID de usuário');
  END IF;

  -- 4. Insert into settings_users
  INSERT INTO settings_users (auth_user_id, name, email, phone, user_type, super_admin, active)
  VALUES (v_auth_user_id, p_name, p_email, p_phone, p_user_type, p_super_admin, true)
  ON CONFLICT (auth_user_id) DO NOTHING;

  -- 5. Return result
  SELECT jsonb_build_object(
    'success',      true,
    'user_id',      su.id,
    'auth_user_id', v_auth_user_id,
    'email',        p_email,
    'name',         p_name
  ) INTO v_user_record
  FROM settings_users su
  WHERE su.auth_user_id = v_auth_user_id;

  RETURN COALESCE(v_user_record,
    jsonb_build_object('error', 'Usuário criado no Auth mas não encontrado em settings_users'));

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$function$


CREATE OR REPLACE FUNCTION public.decrypt_elevenlabs_key(encrypted_key text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF encrypted_key IS NULL THEN RETURN NULL; END IF;
  RETURN pgp_sym_decrypt(decode(encrypted_key, 'base64'), 'elevenlabs_gs_2026');
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$function$


CREATE OR REPLACE FUNCTION public.dispatch_new_lead_webhooks()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'net'
AS $function$
DECLARE
  webhook_record RECORD;
  payload        JSONB;
  client_data    JSONB;
  request_id     BIGINT;
BEGIN
  -- Fetch client data if people_id exists
  IF NEW.people_id IS NOT NULL THEN
    SELECT to_jsonb(cp.*) INTO client_data
    FROM public.clients_people cp
    WHERE cp.id = NEW.people_id;
  END IF;

  -- Build payload
  payload := jsonb_build_object(
    'tipo',      'novo_lead',
    'timestamp', now(),
    'lead',      to_jsonb(NEW),
    'cliente',   COALESCE(client_data, '{}'::jsonb)
  );

  -- Iterate over active webhooks of type 'novo_lead'
  FOR webhook_record IN
    SELECT id, url, name
    FROM public.webhooks
    WHERE event_type = 'novo_lead' AND active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url                  := webhook_record.url,
        body                 := payload,
        params               := '{}'::jsonb,
        headers              := '{"Content-Type": "application/json"}'::jsonb,
        timeout_milliseconds := 10000
      ) INTO request_id;

      INSERT INTO public.webhook_logs (
        webhook_id, status_code, response_body, request_body, created_at
      ) VALUES (
        webhook_record.id,
        202,
        jsonb_build_object('queued', true, 'request_id', request_id),
        payload,
        now()
      );

    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.webhook_logs (
        webhook_id, status_code, response_body, request_body, created_at
      ) VALUES (
        webhook_record.id,
        500,
        jsonb_build_object('error', SQLERRM, 'queued', false),
        payload,
        now()
      );
    END;
  END LOOP;

  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.encrypt_elevenlabs_key(key_value text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF key_value IS NULL OR key_value = '' THEN RETURN NULL; END IF;
  RETURN encode(pgp_sym_encrypt(key_value, 'elevenlabs_gs_2026'), 'base64');
END;
$function$


CREATE OR REPLACE FUNCTION public.find_duplicate_person(p_exclude_id uuid, p_whatsapp text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_document text DEFAULT NULL::text, p_instagram_user_id text DEFAULT NULL::text, p_instagram_handle text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id
  FROM public.clients_people
  WHERE id <> p_exclude_id
    AND status <> 'merged'
    AND (
      (p_whatsapp          IS NOT NULL AND whatsapp          = p_whatsapp) OR
      (p_email             IS NOT NULL AND LOWER(email)      = LOWER(p_email)) OR
      (p_document          IS NOT NULL AND document          = p_document) OR
      (p_instagram_user_id IS NOT NULL AND instagram_user_id = p_instagram_user_id) OR
      (p_instagram_handle  IS NOT NULL AND LOWER(instagram_handle) = LOWER(p_instagram_handle))
    )
  ORDER BY created_at ASC
  LIMIT 1;

  RETURN v_id;
END;
$function$


CREATE OR REPLACE FUNCTION public.fn_queue_conversion_booking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_lead record;
  v_person record;
  v_email_hash text;
  v_phone_hash text;
  v_lead_user_id uuid;
  v_rule record;
  v_normalized_status text;
BEGIN
  -- Normalize status
  v_normalized_status := CASE NEW.status
    WHEN 'agendada'   THEN 'agendado'
    WHEN 'cancelada'  THEN 'cancelado'
    WHEN 'realizada'  THEN 'compareceu'
    ELSE NEW.status
  END;

  -- Get the lead associated with this meeting
  -- FIX: was NEW.leads_id, column renamed to lead_id by P6
  SELECT l.*, su.auth_user_id AS owner_user_id INTO v_lead
  FROM public.leads l
  LEFT JOIN public.settings_users su ON su.id = l.user_id
  WHERE l.id = NEW.lead_id;

  IF v_lead IS NULL OR v_lead.owner_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_lead_user_id := v_lead.owner_user_id;

  -- Hash person data
  IF v_lead.people_id IS NOT NULL THEN
    SELECT email, whatsapp INTO v_person
    FROM public.clients_people WHERE id = v_lead.people_id;

    IF v_person.email IS NOT NULL AND v_person.email <> '' THEN
      v_email_hash := encode(digest(lower(trim(v_person.email)), 'sha256'), 'hex');
    END IF;
    IF v_person.whatsapp IS NOT NULL AND v_person.whatsapp <> '' THEN
      v_phone_hash := encode(digest(regexp_replace(v_person.whatsapp, '[^0-9+]', '', 'g'), 'sha256'), 'hex');
    END IF;
  END IF;

  -- Find matching booking_status rules
  FOR v_rule IN
    SELECT *
    FROM public.conversion_event_rules
    WHERE user_id = v_lead_user_id
      AND active = true
      AND trigger_type = 'booking_status'
      AND (meta_enabled = true OR google_enabled = true)
      AND (trigger_config->>'status') = v_normalized_status
  LOOP
    INSERT INTO public.conversion_events_queue (
      user_id, lead_id, stage_id, lead_source, event_data,
      meta_status, google_status
    ) VALUES (
      v_lead_user_id,
      v_lead.id,
      v_lead.leads_stages_id,
      COALESCE(v_lead.lead_source, 'unknown'),
      jsonb_build_object(
        'rule_id',        v_rule.id::text,
        'rule_name',      v_rule.name,
        'trigger_type',   'booking_status',
        'booking_status', v_normalized_status,
        'meeting_id',     NEW.id::text,
        'gclid',          v_lead.gclid,
        'fbclid',         v_lead.fbclid,
        'fbc',            v_lead.fbc,
        'fbp',            v_lead.fbp,
        'fb_lead_id',     v_lead.fb_lead_id,
        'email_hash',     v_email_hash,
        'phone_hash',     v_phone_hash,
        'value',          v_lead.value,
        'timestamp',      extract(epoch from now())::bigint,
        'meta_pixel_id',               v_rule.meta_pixel_id,
        'meta_event_name',             v_rule.meta_event_name,
        'meta_send_value',             v_rule.meta_send_value,
        'google_account_id',           v_rule.google_account_id,
        'google_conversion_action_id', v_rule.google_conversion_action_id,
        'google_send_value',           v_rule.google_send_value,
        'google_currency',             v_rule.google_currency
      ),
      CASE WHEN v_rule.meta_enabled THEN 'pending' ELSE 'skipped' END,
      CASE WHEN v_rule.google_enabled THEN 'pending' ELSE 'skipped' END
    );
  END LOOP;

  -- Fire conversion-send
  BEGIN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/conversion-send',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Outer safety net: NEVER block meeting updates due to conversion tracking
  RAISE WARNING 'fn_queue_conversion_booking failed: %', SQLERRM;
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.fn_queue_conversion_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_person record;
  v_email_hash text;
  v_phone_hash text;
  v_lead_user_id uuid;
  v_rule record;
  v_event_type text;
BEGIN
  -- Resolve the owner (user_id) of this lead via settings_users
  -- FIX: was NEW.users_id, column renamed to user_id by P6
  SELECT su.auth_user_id INTO v_lead_user_id
  FROM public.settings_users su
  WHERE su.id = NEW.user_id;

  IF v_lead_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Determine event type
  IF TG_ARGV[0] = 'stage_change' THEN
    v_event_type := 'stage_enter';
  ELSIF TG_ARGV[0] = 'lead_won' THEN
    v_event_type := 'lead_won';
  ELSIF TG_ARGV[0] = 'lead_lost' THEN
    v_event_type := 'lead_lost';
  ELSE
    v_event_type := 'stage_enter';
  END IF;

  -- Fetch person data for hashing
  IF NEW.people_id IS NOT NULL THEN
    SELECT email, whatsapp INTO v_person
    FROM public.clients_people
    WHERE id = NEW.people_id;

    IF v_person.email IS NOT NULL AND v_person.email <> '' THEN
      v_email_hash := encode(digest(lower(trim(v_person.email)), 'sha256'), 'hex');
    END IF;
    IF v_person.whatsapp IS NOT NULL AND v_person.whatsapp <> '' THEN
      v_phone_hash := encode(digest(regexp_replace(v_person.whatsapp, '[^0-9+]', '', 'g'), 'sha256'), 'hex');
    END IF;
  END IF;

  -- Find matching rules
  FOR v_rule IN
    SELECT id, name, trigger_type, trigger_config, meta_enabled, meta_event_name, meta_send_value,
           google_enabled, google_conversion_action_id, google_send_value, google_currency,
           meta_pixel_id, google_account_id
    FROM public.conversion_event_rules
    WHERE user_id = v_lead_user_id
      AND active = true
      AND (meta_enabled = true OR google_enabled = true)
      AND trigger_type = v_event_type
  LOOP
    -- Check trigger_config match
    IF v_event_type = 'stage_enter' AND (v_rule.trigger_config->>'stage_id') IS NOT NULL THEN
      IF (v_rule.trigger_config->>'stage_id') <> NEW.leads_stages_id::text THEN
        CONTINUE;
      END IF;
    END IF;

    -- Insert queue entry for this matched rule
    INSERT INTO public.conversion_events_queue (
      user_id, lead_id, stage_id, lead_source, event_data,
      meta_status, google_status
    ) VALUES (
      v_lead_user_id,
      NEW.id,
      NEW.leads_stages_id,
      COALESCE(NEW.lead_source, 'unknown'),
      jsonb_build_object(
        'rule_id',      v_rule.id::text,
        'rule_name',    v_rule.name,
        'trigger_type', v_rule.trigger_type,
        'gclid',        NEW.gclid,
        'fbclid',       NEW.fbclid,
        'fbc',          NEW.fbc,
        'fbp',          NEW.fbp,
        'fb_lead_id',   NEW.fb_lead_id,
        'email_hash',   v_email_hash,
        'phone_hash',   v_phone_hash,
        'value',        NEW.value,
        'timestamp',    extract(epoch from now())::bigint,
        -- Meta-specific
        'meta_pixel_id',     v_rule.meta_pixel_id,
        'meta_event_name',   v_rule.meta_event_name,
        'meta_send_value',   v_rule.meta_send_value,
        -- Google-specific
        'google_account_id',           v_rule.google_account_id,
        'google_conversion_action_id', v_rule.google_conversion_action_id,
        'google_send_value',           v_rule.google_send_value,
        'google_currency',             v_rule.google_currency
      ),
      CASE WHEN v_rule.meta_enabled THEN 'pending' ELSE 'skipped' END,
      CASE WHEN v_rule.google_enabled THEN 'pending' ELSE 'skipped' END
    );
  END LOOP;

  -- Fire-and-forget: invoke conversion-send edge function
  BEGIN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/conversion-send',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Never block lead updates
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Outer safety net: NEVER block lead updates due to conversion tracking
  RAISE WARNING 'fn_queue_conversion_event failed: %', SQLERRM;
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.fn_schedule_automation_on_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_trigger_status TEXT;
  v_lead_id        UUID;
  v_lead           RECORD;
  v_rule           RECORD;
BEGIN
  -- Only fire on status change (UPDATE) or new meeting (INSERT)
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Skip bloqueio manual — internal status
  IF NEW.status = 'bloqueio manual' THEN
    RETURN NEW;
  END IF;

  -- Map meetings.status → schedule_automations.trigger_status
  v_trigger_status := CASE NEW.status
    WHEN 'agendado'         THEN 'criado'
    WHEN 'compareceu'       THEN 'realizado'
    WHEN 'cancelado'        THEN 'cancelado'
    WHEN 'não compareceu'   THEN 'no_show'
    WHEN 'confirmado'       THEN 'confirmado'
    WHEN 'reagendado'       THEN 'reagendado'
    ELSE NULL
  END;

  IF v_trigger_status IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find the lead:
  -- 1. Direct FK: meetings.leads_id
  -- 2. Fallback: find lead by meetings.people_id
  v_lead_id := NEW.leads_id;

  IF v_lead_id IS NULL AND NEW.people_id IS NOT NULL THEN
    -- Find the most recent active lead for this person
    SELECT id, leads_pipelines_id, leads_stages_id
      INTO v_lead
      FROM public.leads
     WHERE people_id = NEW.people_id
       AND status = 'em-andamento'
       AND archived = false
     ORDER BY updated_at DESC
     LIMIT 1;

    v_lead_id := v_lead.id;
  ELSE
    SELECT id, leads_pipelines_id, leads_stages_id
      INTO v_lead
      FROM public.leads
     WHERE id = v_lead_id;
  END IF;

  -- No lead found → nothing to do
  IF v_lead_id IS NULL OR v_lead.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Look up matching automation rule
  SELECT sa.target_pipeline_id, sa.target_stage_id
    INTO v_rule
    FROM public.schedule_automations sa
   WHERE sa.pipeline_id = v_lead.leads_pipelines_id
     AND sa.trigger_status = v_trigger_status
     AND sa.is_active = true
   LIMIT 1;

  -- No matching rule → nothing to do
  IF v_rule IS NULL THEN
    RETURN NEW;
  END IF;

  -- Move the lead: update pipeline + stage
  UPDATE public.leads
     SET leads_pipelines_id = v_rule.target_pipeline_id,
         leads_stages_id    = v_rule.target_stage_id,
         updated_at         = NOW()
   WHERE id = v_lead_id;

  -- Log the move in leads_updates for audit trail
  INSERT INTO public.leads_updates (leads_id, from_stage_id, to_stage_id, notes)
  VALUES (
    v_lead_id,
    v_lead.leads_stages_id,
    v_rule.target_stage_id,
    'Automação Schedule: meeting status → ' || NEW.status
  );

  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.get_available_slots(p_user_id uuid, p_date date, p_period text DEFAULT NULL::text, p_slot_minutes integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dow          INT;
  v_user_name    TEXT;
  v_result       JSONB := '[]'::JSONB;
  v_period_start TIME;
  v_period_end   TIME;
  rec            RECORD;
  v_cursor       TIME;
  v_slot_end     TIME;
  v_is_free      BOOLEAN;
BEGIN
  IF p_slot_minutes < 15 OR p_slot_minutes > 480 THEN
    RAISE EXCEPTION 'p_slot_minutes must be between 15 and 480';
  END IF;

  SELECT name INTO v_user_name
  FROM settings_users
  WHERE id = p_user_id AND active = TRUE AND deleted_at IS NULL;

  IF v_user_name IS NULL THEN
    RETURN '[]'::JSONB;
  END IF;

  v_dow := EXTRACT(DOW FROM p_date)::INT;

  IF p_period = 'morning' THEN
    v_period_start := '08:00'::TIME;
    v_period_end   := '12:00'::TIME;
  ELSIF p_period = 'afternoon' THEN
    v_period_start := '12:00'::TIME;
    v_period_end   := '18:00'::TIME;
  ELSIF p_period = 'evening' THEN
    v_period_start := '18:00'::TIME;
    v_period_end   := '22:00'::TIME;
  ELSE
    v_period_start := '00:00'::TIME;
    v_period_end   := '23:59'::TIME;
  END IF;

  FOR rec IN
    SELECT
      GREATEST(ss.start_time, v_period_start) AS win_start,
      LEAST(ss.end_time, v_period_end)        AS win_end
    FROM settings_schedules ss
    WHERE ss.user_id      = p_user_id
      AND ss.day_of_week  = v_dow
      AND ss.is_available = TRUE
      AND ss.start_time   < v_period_end
      AND ss.end_time     > v_period_start
    ORDER BY ss.start_time
  LOOP
    v_cursor := rec.win_start;

    WHILE v_cursor + (p_slot_minutes || ' minutes')::INTERVAL <= rec.win_end LOOP
      v_slot_end := (v_cursor + (p_slot_minutes || ' minutes')::INTERVAL)::TIME;

      SELECT NOT EXISTS (
        SELECT 1
        FROM meetings m
        WHERE m.user_id    = p_user_id
          AND m.status NOT IN ('cancelado')
          AND m.start_time < (p_date + v_slot_end)::TIMESTAMPTZ
          AND m.end_time   > (p_date + v_cursor)::TIMESTAMPTZ
      ) INTO v_is_free;

      IF v_is_free THEN
        v_result := v_result || jsonb_build_object(
          'slot_start', TO_CHAR(v_cursor, 'HH24:MI'),
          'slot_end',   TO_CHAR(v_slot_end, 'HH24:MI'),
          'user_id',    p_user_id,
          'user_name',  v_user_name
        );
      END IF;

      v_cursor := v_slot_end;
    END LOOP;
  END LOOP;

  RETURN v_result;
END;
$function$


CREATE OR REPLACE FUNCTION public.get_booking_eligible_user_ids(p_rule_set_id uuid DEFAULT NULL::uuid)
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rs_id           uuid;
  v_rule_team_ids   text[];
  v_found_team_rule boolean := false;
  v_team_user_ids   uuid[];
  v_result          uuid[];
BEGIN
  -- Resolve rule set
  IF p_rule_set_id IS NOT NULL THEN
    v_rs_id := p_rule_set_id;
  ELSE
    SELECT id INTO v_rs_id
    FROM public.booking_rule_sets
    WHERE is_default = true AND is_active = true
    LIMIT 1;
  END IF;

  -- Verifica se existe regra team_priority
  IF v_rs_id IS NOT NULL THEN
    SELECT ARRAY(
      SELECT jsonb_array_elements_text(COALESCE(br.config->'team_ids', '[]'::jsonb))
    )
    INTO v_rule_team_ids
    FROM public.booking_rules br
    WHERE br.rule_set_id = v_rs_id
      AND br.rule_type   = 'team_priority'
      AND br.is_active   = true
    ORDER BY br.order_index ASC
    LIMIT 1;

    v_found_team_rule := FOUND;

    IF v_found_team_rule THEN
      IF v_rule_team_ids IS NOT NULL AND array_length(v_rule_team_ids, 1) > 0 THEN
        -- Times específicos
        SELECT ARRAY(
          SELECT DISTINCT sut.user_id
          FROM public.settings_users_teams sut
          WHERE sut.team_id = ANY(v_rule_team_ids::uuid[])
        ) INTO v_team_user_ids;
      ELSE
        -- Qualquer membro de time ativo
        SELECT ARRAY(
          SELECT DISTINCT sut.user_id
          FROM public.settings_users_teams sut
          INNER JOIN public.settings_teams st ON st.id = sut.team_id
          WHERE st.active = true
        ) INTO v_team_user_ids;
      END IF;

      -- Se não encontrou nenhum membro, ignora filtro (evita quebrar tudo)
      IF v_team_user_ids IS NOT NULL AND array_length(v_team_user_ids, 1) > 0 THEN
        -- Filtra para usuários ativos que estão na lista do time
        SELECT ARRAY(
          SELECT su.id
          FROM public.settings_users su
          WHERE su.active = true
            AND (su.deleted_at IS NULL)
            AND su.id = ANY(v_team_user_ids)
        ) INTO v_result;
        RETURN v_result;
      END IF;
    END IF;
  END IF;

  -- Sem filtro de time: todos os usuários ativos
  SELECT ARRAY(
    SELECT su.id
    FROM public.settings_users su
    WHERE su.active = true
      AND (su.deleted_at IS NULL)
  ) INTO v_result;

  RETURN v_result;
END;
$function$


CREATE OR REPLACE FUNCTION public.get_booking_session(p_lead_id uuid, p_rule_set_id uuid DEFAULT NULL::uuid, p_duration integer DEFAULT 30, p_days_ahead integer DEFAULT 14)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_person_id    uuid;
  v_person_name  text;
  v_person_email text;
  v_user_ids     uuid[];
  v_slots        json;
BEGIN
  SELECT
    COALESCE(cp.id, p_lead_id),
    COALESCE(cp.name, 'Cliente'),
    cp.email
  INTO v_person_id, v_person_name, v_person_email
  FROM public.leads l
  LEFT JOIN public.clients_people cp ON cp.id = l.people_id
  WHERE l.id = p_lead_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Lead not found');
  END IF;

  v_user_ids := public.get_booking_eligible_user_ids(p_rule_set_id);

  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) IS NULL THEN
    RETURN json_build_object('error', 'Nenhum consultor disponível no momento');
  END IF;

  SELECT json_agg(
    json_build_object(
      'date',       slot_date,
      'start_time', start_time,
      'end_time',   end_time
    )
    ORDER BY slot_date, start_time
  )
  INTO v_slots
  FROM (
    SELECT DISTINCT
      TO_CHAR(dr.d, 'YYYY-MM-DD') AS slot_date,
      TO_CHAR(ss.start_time::time + (n.n * INTERVAL '30 minutes'), 'HH24:MI') AS start_time,
      TO_CHAR(ss.start_time::time + (n.n * INTERVAL '30 minutes') + (p_duration * INTERVAL '1 minute'), 'HH24:MI') AS end_time,
      su.id AS user_id,
      dr.d + (ss.start_time::time + (n.n * INTERVAL '30 minutes')) AS ts_start,
      dr.d + (ss.start_time::time + (n.n * INTERVAL '30 minutes') + (p_duration * INTERVAL '1 minute')) AS ts_end
    FROM
      (SELECT (CURRENT_DATE + s.n)::date AS d
       FROM generate_series(0, p_days_ahead - 1) AS s(n)) AS dr
      CROSS JOIN (SELECT unnest(v_user_ids) AS id) AS cand
      INNER JOIN public.settings_users su ON su.id = cand.id AND su.active = true
      INNER JOIN public.settings_schedules ss
        ON ss.user_id = su.id
        AND ss.day_of_week = EXTRACT(DOW FROM dr.d)::int
        AND ss.is_available = true
      CROSS JOIN LATERAL (
        SELECT s2.n
        FROM generate_series(0,
          GREATEST(0,
            FLOOR(
              EXTRACT(EPOCH FROM (ss.end_time::time - ss.start_time::time)) / 1800
            )::int - 1
          )
        ) AS s2(n)
        WHERE ss.start_time::time + (s2.n * INTERVAL '30 minutes') + (p_duration * INTERVAL '1 minute')
              <= ss.end_time::time
      ) AS n
  ) AS all_slots
  WHERE NOT EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.user_id    = all_slots.user_id
      AND m.start_time < all_slots.ts_end::timestamptz
      AND m.end_time   > all_slots.ts_start::timestamptz
      AND m.status NOT IN ('cancelado', 'cancelada')
  );

  RETURN json_build_object(
    'person', json_build_object(
      'id',    v_person_id::text,
      'name',  v_person_name,
      'email', v_person_email
    ),
    'slots', COALESCE(v_slots, '[]'::json)
  );
END;
$function$


CREATE OR REPLACE FUNCTION public.get_current_settings_user_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id
  FROM public.settings_users
  WHERE auth_user_id = auth.uid()
  LIMIT 1
$function$


CREATE OR REPLACE FUNCTION public.get_insights_context(p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_pipeline_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  result jsonb := '{}'::jsonb;
  v_funnel jsonb;
  v_people jsonb;
  v_messages jsonb;
  v_meetings jsonb;
  v_calls jsonb;
  v_marketing jsonb;
  v_prospect jsonb;
BEGIN

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 1: FUNNEL (leads by stage, conversion, loss reasons, velocity)
  -- ═══════════════════════════════════════════════════════════════════════
  WITH lead_base AS (
    SELECT l.id, l.status, l.value, l.leads_stages_id, l.leads_pipelines_id,
           l.leads_loss_reasons_id, l.created_at, l.won_at
    FROM leads l
    WHERE (p_date_from IS NULL OR l.created_at >= p_date_from)
      AND (p_date_to   IS NULL OR l.created_at <= p_date_to)
      AND (p_pipeline_id IS NULL OR l.leads_pipelines_id = p_pipeline_id)
  ),
  stages_agg AS (
    SELECT
      ls.name AS stage_name,
      ls.order_index,
      COUNT(lb.id) AS lead_count,
      COALESCE(SUM(lb.value), 0) AS total_value,
      ROUND(AVG(EXTRACT(EPOCH FROM (now() - lb.created_at)) / 86400)::numeric, 1) AS avg_days
    FROM lead_base lb
    JOIN leads_stages ls ON ls.id = lb.leads_stages_id
    WHERE lb.status = 'em-andamento'
    GROUP BY ls.name, ls.order_index
    ORDER BY ls.order_index
  ),
  loss_reasons AS (
    SELECT
      COALESCE(lr.name, 'Sem motivo') AS reason,
      COUNT(*) AS cnt
    FROM lead_base lb
    LEFT JOIN leads_loss_reasons lr ON lr.id = lb.leads_loss_reasons_id
    WHERE lb.status = 'perdido'
    GROUP BY lr.name
    ORDER BY cnt DESC
    LIMIT 5
  ),
  funnel_totals AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'ganho') AS won,
      COUNT(*) FILTER (WHERE status = 'perdido') AS lost,
      COUNT(*) FILTER (WHERE status = 'em-andamento') AS active,
      COALESCE(SUM(value) FILTER (WHERE status = 'ganho'), 0) AS revenue,
      ROUND((AVG(EXTRACT(EPOCH FROM (won_at - created_at)) / 86400) FILTER (WHERE status = 'ganho' AND won_at IS NOT NULL))::numeric, 1) AS avg_cycle_days
    FROM lead_base
  )
  SELECT jsonb_build_object(
    'total', ft.total,
    'won', ft.won,
    'lost', ft.lost,
    'active', ft.active,
    'revenue', ft.revenue,
    'avg_deal', CASE WHEN ft.won > 0 THEN ROUND((ft.revenue / ft.won)::numeric, 2) ELSE 0 END,
    'conversion_pct', CASE WHEN ft.total > 0 THEN ROUND((ft.won::numeric / ft.total * 100), 1) ELSE 0 END,
    'avg_cycle_days', COALESCE(ft.avg_cycle_days, 0),
    'stages', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'name', s.stage_name, 'leads', s.lead_count, 'value', s.total_value, 'avg_days', s.avg_days
    ) ORDER BY s.order_index) FROM stages_agg s), '[]'::jsonb),
    'loss_reasons', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'reason', r.reason, 'count', r.cnt
    )) FROM loss_reasons r), '[]'::jsonb)
  ) INTO v_funnel
  FROM funnel_totals ft;

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 2: PEOPLE & COMPANIES
  -- ═══════════════════════════════════════════════════════════════════════
  WITH people_stats AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'ativo') AS active,
      COUNT(*) FILTER (WHERE status != 'ativo') AS inactive,
      COUNT(*) FILTER (WHERE score BETWEEN 0 AND 25) AS score_0_25,
      COUNT(*) FILTER (WHERE score BETWEEN 26 AND 50) AS score_26_50,
      COUNT(*) FILTER (WHERE score BETWEEN 51 AND 75) AS score_51_75,
      COUNT(*) FILTER (WHERE score BETWEEN 76 AND 100) AS score_76_100
    FROM clients_people
    WHERE (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
  ),
  top_sources AS (
    SELECT source, COUNT(*) AS cnt
    FROM clients_people
    WHERE source IS NOT NULL
      AND (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
    GROUP BY source
    ORDER BY cnt DESC
    LIMIT 5
  ),
  company_stats AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) AS active
    FROM clients_companies
  )
  SELECT jsonb_build_object(
    'people_total', ps.total,
    'people_active', ps.active,
    'people_inactive', ps.inactive,
    'score_distribution', jsonb_build_object(
      '0_25', ps.score_0_25, '26_50', ps.score_26_50,
      '51_75', ps.score_51_75, '76_100', ps.score_76_100
    ),
    'top_sources', COALESCE((SELECT jsonb_agg(jsonb_build_object('source', ts.source, 'count', ts.cnt)) FROM top_sources ts), '[]'::jsonb),
    'companies_total', cs.total,
    'companies_active', cs.active
  ) INTO v_people
  FROM people_stats ps, company_stats cs;

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 3: MESSAGES (volume by channel, IA vs human, trend, abandoned)
  -- ═══════════════════════════════════════════════════════════════════════
  WITH msg_base AS (
    SELECT id, channel, from_contact, created_at, lead_id
    FROM messages
    WHERE (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
  ),
  by_channel AS (
    SELECT channel, COUNT(*) AS cnt
    FROM msg_base GROUP BY channel ORDER BY cnt DESC
  ),
  by_sender AS (
    SELECT from_contact, COUNT(*) AS cnt
    FROM msg_base GROUP BY from_contact
  ),
  daily_trend AS (
    SELECT created_at::date AS day, COUNT(*) AS cnt
    FROM msg_base
    WHERE created_at >= (COALESCE(p_date_to, now()) - interval '7 days')
    GROUP BY day ORDER BY day
  ),
  abandoned AS (
    SELECT COUNT(DISTINCT lead_id) AS cnt
    FROM (
      SELECT lead_id,
             from_contact,
             created_at,
             LEAD(from_contact) OVER (PARTITION BY lead_id ORDER BY created_at) AS next_sender,
             LEAD(created_at) OVER (PARTITION BY lead_id ORDER BY created_at) AS next_at
      FROM msg_base
    ) sub
    WHERE from_contact = 'cliente'
      AND (next_sender IS NULL OR (next_sender != 'cliente' AND next_at - created_at > interval '24 hours'))
  )
  SELECT jsonb_build_object(
    'total', (SELECT COUNT(*) FROM msg_base),
    'by_channel', COALESCE((SELECT jsonb_agg(jsonb_build_object('channel', c.channel, 'count', c.cnt)) FROM by_channel c), '[]'::jsonb),
    'by_sender', COALESCE((SELECT jsonb_agg(jsonb_build_object('sender', s.from_contact, 'count', s.cnt)) FROM by_sender s), '[]'::jsonb),
    'daily_trend', COALESCE((SELECT jsonb_agg(jsonb_build_object('day', d.day, 'count', d.cnt)) FROM daily_trend d), '[]'::jsonb),
    'abandoned_conversations', ab.cnt
  ) INTO v_messages
  FROM abandoned ab;

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 4: MEETINGS (status, show rate by closer, time metrics)
  -- FILTER: Only system-booked meetings (exclude Google Calendar imports)
  -- ═══════════════════════════════════════════════════════════════════════
  WITH mtg_base AS (
    SELECT m.id, m.status, m.start_time, m.user_id, m.lead_id,
           l.created_at AS lead_created, l.won_at,
           l.utm_campaign, l.utm_source
    FROM meetings m
    LEFT JOIN leads l ON l.id = m.lead_id
    WHERE (p_date_from IS NULL OR m.created_at >= p_date_from)
      AND (p_date_to   IS NULL OR m.created_at <= p_date_to)
      AND (m.source IS NULL OR m.source != 'google')
  ),
  by_status AS (
    SELECT status, COUNT(*) AS cnt FROM mtg_base GROUP BY status
  ),
  show_rate_by_user AS (
    SELECT
      COALESCE(su.name, 'Sem responsável') AS closer_name,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE mb.status = 'realizada') AS attended,
      CASE WHEN COUNT(*) > 0
        THEN ROUND((COUNT(*) FILTER (WHERE mb.status = 'realizada'))::numeric / COUNT(*) * 100, 1)
        ELSE 0 END AS show_rate
    FROM mtg_base mb
    LEFT JOIN settings_users su ON su.id = mb.user_id
    GROUP BY su.name
    ORDER BY total DESC
    LIMIT 5
  ),
  time_metrics AS (
    SELECT
      ROUND(AVG(EXTRACT(EPOCH FROM (start_time - lead_created)) / 86400)::numeric, 1) AS avg_lead_to_meeting,
      ROUND((AVG(EXTRACT(EPOCH FROM (won_at - start_time)) / 86400) FILTER (WHERE won_at IS NOT NULL))::numeric, 1) AS avg_meeting_to_close
    FROM mtg_base
    WHERE lead_created IS NOT NULL
  ),
  meetings_by_campaign AS (
    -- Reverse lookup: start from leads with UTM → check if they have meetings
    SELECT
      COALESCE(l.utm_campaign, l.utm_source, 'Sem campanha') AS campaign,
      COUNT(DISTINCT l.id) AS leads,
      COUNT(DISTINCT m2.id) AS meetings,
      COUNT(DISTINCT m2.id) FILTER (WHERE m2.status IN ('realizada', 'compareceu')) AS attended,
      COUNT(DISTINCT m2.id) FILTER (WHERE m2.status IN ('não compareceu', 'cancelado')) AS no_show,
      COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'ganho') AS won
    FROM leads l
    LEFT JOIN meetings m2 ON m2.lead_id = l.id AND (m2.source IS NULL OR m2.source != 'google')
    WHERE (l.utm_source IS NOT NULL OR l.utm_campaign IS NOT NULL)
      AND (p_date_from IS NULL OR l.created_at >= p_date_from)
      AND (p_date_to   IS NULL OR l.created_at <= p_date_to)
      AND (p_pipeline_id IS NULL OR l.leads_pipelines_id = p_pipeline_id)
    GROUP BY COALESCE(l.utm_campaign, l.utm_source, 'Sem campanha')
    ORDER BY leads DESC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'total', (SELECT COUNT(*) FROM mtg_base),
    'by_status', COALESCE((SELECT jsonb_agg(jsonb_build_object('status', bs.status, 'count', bs.cnt)) FROM by_status bs), '[]'::jsonb),
    'show_rate_by_closer', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'name', sr.closer_name, 'total', sr.total, 'attended', sr.attended, 'show_rate', sr.show_rate
    )) FROM show_rate_by_user sr), '[]'::jsonb),
    'avg_lead_to_meeting_days', COALESCE(tm.avg_lead_to_meeting, 0),
    'avg_meeting_to_close_days', COALESCE(tm.avg_meeting_to_close, 0),
    'by_campaign', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'campaign', mc.campaign, 'leads', mc.leads, 'meetings', mc.meetings,
      'attended', mc.attended, 'no_show', mc.no_show, 'won', mc.won
    )) FROM meetings_by_campaign mc), '[]'::jsonb)
  ) INTO v_meetings
  FROM time_metrics tm;

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 5: CALLS (inbound/outbound, answer rate, duration, operators)
  -- ═══════════════════════════════════════════════════════════════════════
  WITH call_base AS (
    SELECT id, direction, status, duration, user_id, outcome, tags
    FROM call_pro_calls
    WHERE (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
  ),
  call_summary AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE direction = 'inbound') AS inbound,
      COUNT(*) FILTER (WHERE direction = 'outbound') AS outbound,
      COUNT(*) FILTER (WHERE status IN ('answered', 'handled')) AS answered,
      ROUND((AVG(duration) FILTER (WHERE duration > 0))::numeric, 0) AS avg_duration_sec
    FROM call_base
  ),
  top_operators AS (
    SELECT
      COALESCE(su.name, 'Desconhecido') AS operator_name,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE cb.status IN ('answered', 'handled')) AS answered
    FROM call_base cb
    LEFT JOIN settings_users su ON su.id = cb.user_id
    WHERE cb.user_id IS NOT NULL
    GROUP BY su.name
    ORDER BY total DESC
    LIMIT 3
  ),
  top_outcomes AS (
    SELECT outcome, COUNT(*) AS cnt
    FROM call_base
    WHERE outcome IS NOT NULL AND outcome != ''
    GROUP BY outcome
    ORDER BY cnt DESC
    LIMIT 5
  )
  SELECT jsonb_build_object(
    'total', cs.total,
    'inbound', cs.inbound,
    'outbound', cs.outbound,
    'answered', cs.answered,
    'answer_rate', CASE WHEN cs.total > 0 THEN ROUND((cs.answered::numeric / cs.total * 100), 1) ELSE 0 END,
    'avg_duration_sec', COALESCE(cs.avg_duration_sec, 0),
    'top_operators', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'name', op.operator_name, 'total', op.total, 'answered', op.answered
    )) FROM top_operators op), '[]'::jsonb),
    'top_outcomes', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'outcome', o.outcome, 'count', o.cnt
    )) FROM top_outcomes o), '[]'::jsonb)
  ) INTO v_calls
  FROM call_summary cs;

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 6: MARKETING (sends, LPs, UTM, Meta forms)
  -- ═══════════════════════════════════════════════════════════════════════
  WITH sends_summary AS (
    SELECT
      COUNT(*) AS total_sends,
      SUM(total_contacts) AS total_contacts,
      SUM(sent_count) AS total_sent,
      SUM(delivered_count) AS total_delivered,
      SUM(read_count) AS total_read
    FROM sends
    WHERE status IN ('completed', 'running')
      AND (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
  ),
  sends_by_channel AS (
    SELECT channel, COUNT(*) AS cnt, SUM(sent_count) AS sent, SUM(delivered_count) AS delivered, SUM(read_count) AS read_cnt
    FROM sends
    WHERE status IN ('completed', 'running')
      AND (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
    GROUP BY channel
  ),
  lp_stats AS (
    SELECT
      f.name AS page_name,
      COUNT(s.id) AS submissions
    FROM form_pro_forms f
    LEFT JOIN form_pro_submissions s ON s.form_id = f.id
      AND (p_date_from IS NULL OR s.submitted_at >= p_date_from)
      AND (p_date_to   IS NULL OR s.submitted_at <= p_date_to)
    GROUP BY f.name
    ORDER BY submissions DESC
    LIMIT 5
  ),
  utm_stats AS (
    SELECT
      COALESCE(utm_source, 'direto') AS source,
      COALESCE(utm_medium, 'none') AS medium,
      COUNT(*) AS leads,
      COUNT(*) FILTER (WHERE status = 'ganho') AS won
    FROM leads
    WHERE utm_source IS NOT NULL
      AND (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
      AND (p_pipeline_id IS NULL OR leads_pipelines_id = p_pipeline_id)
    GROUP BY utm_source, utm_medium
    ORDER BY leads DESC
    LIMIT 5
  ),
  meta_forms_stats AS (
    SELECT
      mf.name AS form_name,
      COUNT(DISTINCT l.id) AS leads_count
    FROM meta_lead_forms mf
    LEFT JOIN form_pro_submissions fps ON fps.meta_form_id = mf.id
      AND (p_date_from IS NULL OR fps.submitted_at >= p_date_from)
      AND (p_date_to   IS NULL OR fps.submitted_at <= p_date_to)
    LEFT JOIN leads l ON l.id = fps.lead_id
    WHERE mf.status = 'active'
    GROUP BY mf.name
    ORDER BY leads_count DESC
    LIMIT 5
  )
  SELECT jsonb_build_object(
    'sends', jsonb_build_object(
      'total_campaigns', ss.total_sends,
      'total_sent', COALESCE(ss.total_sent, 0),
      'total_delivered', COALESCE(ss.total_delivered, 0),
      'total_read', COALESCE(ss.total_read, 0),
      'delivery_rate', CASE WHEN COALESCE(ss.total_sent, 0) > 0
        THEN ROUND((COALESCE(ss.total_delivered, 0)::numeric / ss.total_sent * 100), 1) ELSE 0 END,
      'read_rate', CASE WHEN COALESCE(ss.total_delivered, 0) > 0
        THEN ROUND((COALESCE(ss.total_read, 0)::numeric / ss.total_delivered * 100), 1) ELSE 0 END,
      'by_channel', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'channel', sc.channel, 'campaigns', sc.cnt, 'sent', sc.sent, 'delivered', sc.delivered, 'read', sc.read_cnt
      )) FROM sends_by_channel sc), '[]'::jsonb)
    ),
    'landing_pages', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'form', lps.page_name, 'submissions', lps.submissions
    )) FROM lp_stats lps WHERE lps.submissions > 0), '[]'::jsonb),
    'utm_attribution', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'source', u.source, 'medium', u.medium, 'leads', u.leads, 'won', u.won
    )) FROM utm_stats u), '[]'::jsonb),
    'meta_forms', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'form', mfs.form_name, 'leads', mfs.leads_count
    )) FROM meta_forms_stats mfs), '[]'::jsonb)
  ) INTO v_marketing
  FROM sends_summary ss;

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 7: PROSPECT PRO (campaigns, contacts breakdown, AI score)
  -- ═══════════════════════════════════════════════════════════════════════
  WITH prospect_campaigns_agg AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'running') AS running,
      COUNT(*) FILTER (WHERE status = 'completed') AS completed
    FROM prospect_campaigns
    WHERE (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
  ),
  prospect_contacts_agg AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE pc.status = 'raw') AS raw_cnt,
      COUNT(*) FILTER (WHERE pc.status = 'filtered') AS filtered_cnt,
      COUNT(*) FILTER (WHERE pc.status = 'enriched') AS enriched_cnt,
      COUNT(*) FILTER (WHERE pc.status = 'approved') AS approved_cnt,
      COUNT(*) FILTER (WHERE pc.status = 'rejected') AS rejected_cnt,
      ROUND((AVG(ai_score) FILTER (WHERE ai_score IS NOT NULL))::numeric, 0) AS avg_ai_score
    FROM prospect_contacts pc
    JOIN prospect_campaigns camp ON camp.id = pc.campaign_id
    WHERE (p_date_from IS NULL OR pc.created_at >= p_date_from)
      AND (p_date_to   IS NULL OR pc.created_at <= p_date_to)
  )
  SELECT jsonb_build_object(
    'campaigns_total', pca.total,
    'campaigns_running', pca.running,
    'campaigns_completed', pca.completed,
    'contacts_total', pcta.total,
    'contacts_by_status', jsonb_build_object(
      'raw', pcta.raw_cnt, 'filtered', pcta.filtered_cnt,
      'enriched', pcta.enriched_cnt, 'approved', pcta.approved_cnt, 'rejected', pcta.rejected_cnt
    ),
    'avg_ai_score', COALESCE(pcta.avg_ai_score, 0),
    'approval_rate', CASE WHEN pcta.total > 0
      THEN ROUND((pcta.approved_cnt::numeric / pcta.total * 100), 1) ELSE 0 END
  ) INTO v_prospect
  FROM prospect_campaigns_agg pca, prospect_contacts_agg pcta;

  -- ═══════════════════════════════════════════════════════════════════════
  -- ASSEMBLE FINAL RESULT
  -- ═══════════════════════════════════════════════════════════════════════
  result := jsonb_build_object(
    'funnel', COALESCE(v_funnel, '{}'::jsonb),
    'people', COALESCE(v_people, '{}'::jsonb),
    'messages', COALESCE(v_messages, '{}'::jsonb),
    'meetings', COALESCE(v_meetings, '{}'::jsonb),
    'calls', COALESCE(v_calls, '{}'::jsonb),
    'marketing', COALESCE(v_marketing, '{}'::jsonb),
    'prospect', COALESCE(v_prospect, '{}'::jsonb)
  );

  RETURN result;
END;
$function$


CREATE OR REPLACE FUNCTION public.get_public_settings()
 RETURNS TABLE(company_name text, logo_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT company_name, logo_url
  FROM   public.settings
  LIMIT  1;
$function$


CREATE OR REPLACE FUNCTION public.handle_meeting_followup_queue()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status    text;
  rule_rec    record;
  delay_secs  bigint;
BEGIN
  -- Skip if status didn't change on UPDATE
  IF (TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;

  -- Normalize meetings.status → meetings_followups.meeting_status
  v_status := CASE NEW.status
    WHEN 'agendada'       THEN 'agendado'
    WHEN 'compareceu'     THEN 'compareceu'
    WHEN 'nao_compareceu' THEN 'nao_compareceu'
    WHEN 'cancelado'      THEN 'cancelado'
    WHEN 'realizado'      THEN 'realizado'
    ELSE NEW.status
  END;

  -- Cancel existing pending queue entries for this meeting (status changed)
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.meeting_followup_queue
       SET status = 'cancelled'
     WHERE meeting_id = NEW.id
       AND status = 'pending';
  END IF;

  -- Create queue entry for each active rule matching the new status
  FOR rule_rec IN
    SELECT id, channel, webhook_url, message, days, hours, minutes
      FROM public.meetings_followups
     WHERE active = true
       AND meeting_status = v_status
       AND webhook_url IS NOT NULL
       AND webhook_url <> ''
  LOOP
    delay_secs := (
      COALESCE(rule_rec.days, 0)    * 86400 +
      COALESCE(rule_rec.hours, 0)   * 3600  +
      COALESCE(rule_rec.minutes, 0) * 60
    )::bigint;

    INSERT INTO public.meeting_followup_queue (
      rule_id, meeting_id, people_id, lead_id,
      scheduled_for, channel, webhook_url, message_snapshot
    ) VALUES (
      rule_rec.id,
      NEW.id,
      NEW.people_id,
      NEW.lead_id,
      now() + (delay_secs * interval '1 second'),
      rule_rec.channel,
      rule_rec.webhook_url,
      rule_rec.message
    );
  END LOOP;

  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.increment_field(table_name text, field_name text, row_id uuid, increment_by integer DEFAULT 1)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  EXECUTE format(
    'UPDATE %I SET %I = COALESCE(%I, 0) + $1 WHERE id = $2',
    table_name, field_name, field_name
  )
  USING increment_by, row_id;
END;
$function$


CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.settings_users
    WHERE auth_user_id = auth.uid()
      AND (super_admin = true OR user_type IN ('admin', 'manager'))
      AND active = true
      AND deleted_at IS NULL
  )
$function$


CREATE OR REPLACE FUNCTION public.merge_persons(p_canonical_id uuid, p_duplicate_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_canonical  public.clients_people%ROWTYPE;
  v_duplicate  public.clients_people%ROWTYPE;
  v_msg_count      INT := 0;
  v_lead_count     INT := 0;
  v_meeting_count  INT := 0;
  v_call_count     INT := 0;
  v_merge_event    JSONB;
BEGIN
  SELECT * INTO v_canonical FROM public.clients_people WHERE id = p_canonical_id FOR UPDATE;
  SELECT * INTO v_duplicate FROM public.clients_people WHERE id = p_duplicate_id FOR UPDATE;

  IF v_canonical.id IS NULL THEN
    RAISE EXCEPTION 'merge_persons: canonical_id % not found', p_canonical_id;
  END IF;
  IF v_duplicate.id IS NULL THEN
    RAISE EXCEPTION 'merge_persons: duplicate_id % not found', p_duplicate_id;
  END IF;
  IF v_duplicate.status = 'merged' THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'already merged');
  END IF;

  -- 1. Messages
  UPDATE public.messages
  SET people_id = p_canonical_id
  WHERE people_id = p_duplicate_id;
  GET DIAGNOSTICS v_msg_count = ROW_COUNT;

  -- 2. Leads (negócios)
  UPDATE public.leads
  SET people_id = p_canonical_id
  WHERE people_id = p_duplicate_id;
  GET DIAGNOSTICS v_lead_count = ROW_COUNT;

  -- 3. Meetings (agendamentos)
  UPDATE public.meetings
  SET people_id = p_canonical_id
  WHERE people_id = p_duplicate_id;
  GET DIAGNOSTICS v_meeting_count = ROW_COUNT;

  -- 4. Calls (column name: person_id)
  UPDATE public.call_pro_calls
  SET person_id = p_canonical_id
  WHERE person_id = p_duplicate_id;
  GET DIAGNOSTICS v_call_count = ROW_COUNT;

  -- 5. Company associations — avoid (people_id, company_id) duplicates
  INSERT INTO public.clients_people_companies (people_id, company_id, role, is_primary, created_at, updated_at)
  SELECT p_canonical_id, company_id, role, is_primary, created_at, updated_at
  FROM   public.clients_people_companies
  WHERE  people_id = p_duplicate_id
    AND  company_id NOT IN (
           SELECT company_id FROM public.clients_people_companies
           WHERE  people_id = p_canonical_id
             AND  company_id IS NOT NULL
         );

  DELETE FROM public.clients_people_companies
  WHERE people_id = p_duplicate_id;

  -- 6. Form PRO Submissions (was: lp_submissions + lp_form_submissions)
  UPDATE public.form_pro_submissions
  SET people_id = p_canonical_id
  WHERE people_id = p_duplicate_id;

  -- 7. Sends contacts
  UPDATE public.sends_contacts
  SET people_id = p_canonical_id
  WHERE people_id = p_duplicate_id;

  -- 8. Followup queue (column name: person_id)
  UPDATE public.followup_queue
  SET person_id = p_canonical_id
  WHERE person_id = p_duplicate_id;

  -- 9. Meeting followup queue
  UPDATE public.meeting_followup_queue
  SET people_id = p_canonical_id
  WHERE people_id = p_duplicate_id;

  -- 10. Message buffer
  UPDATE public.message_buffer
  SET people_id = p_canonical_id
  WHERE people_id = p_duplicate_id;

  -- 11. AI agent execution log
  UPDATE public.ai_agents_execution_log
  SET people_id = p_canonical_id
  WHERE people_id = p_duplicate_id;

  -- 12. Merge identity fields to canonical (keep existing, fill from duplicate)
  UPDATE public.clients_people SET
    email              = COALESCE(email,              v_duplicate.email),
    document           = COALESCE(document,           v_duplicate.document),
    whatsapp           = COALESCE(whatsapp,           v_duplicate.whatsapp),
    telefone           = COALESCE(telefone,           v_duplicate.telefone),
    instagram_user_id  = COALESCE(instagram_user_id,  v_duplicate.instagram_user_id),
    instagram_id       = COALESCE(instagram_id,       v_duplicate.instagram_id),
    instagram_handle   = COALESCE(instagram_handle,   v_duplicate.instagram_handle),
    name = CASE
      WHEN name IN ('WhatsApp User', 'Instagram User', '') THEN COALESCE(NULLIF(v_duplicate.name, ''), name)
      ELSE name
    END,
    merge_history = merge_history || jsonb_build_array(
      jsonb_build_object(
        'merged_at',       NOW(),
        'duplicate_id',    p_duplicate_id,
        'duplicate_name',  v_duplicate.name,
        'messages_moved',  v_msg_count,
        'leads_moved',     v_lead_count,
        'meetings_moved',  v_meeting_count,
        'calls_moved',     v_call_count
      )
    ),
    updated_at = NOW()
  WHERE id = p_canonical_id;

  -- 13. Mark duplicate as merged
  UPDATE public.clients_people SET
    status         = 'merged',
    merged_into_id = p_canonical_id,
    updated_at     = NOW()
  WHERE id = p_duplicate_id;

  v_merge_event := jsonb_build_object(
    'canonical_id',   p_canonical_id,
    'duplicate_id',   p_duplicate_id,
    'messages_moved', v_msg_count,
    'leads_moved',    v_lead_count,
    'meetings_moved', v_meeting_count,
    'calls_moved',    v_call_count
  );

  RETURN v_merge_event;
END;
$function$


CREATE OR REPLACE FUNCTION public.move_lead_to_stage(p_lead_id uuid, p_stage_name text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE public.leads
  SET leads_stages_id = (
    SELECT id FROM public.leads_stages
    WHERE LOWER(name) = LOWER(p_stage_name)
    LIMIT 1
  )
  WHERE id = p_lead_id;
$function$


CREATE OR REPLACE FUNCTION public.notify_lead_stage_changed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_supabase_url TEXT;
  v_service_key  TEXT;
BEGIN
  -- Only fire when stage actually changes (skip if unchanged on UPDATE)
  IF TG_OP = 'UPDATE' AND OLD.leads_stages_id IS NOT DISTINCT FROM NEW.leads_stages_id THEN
    RETURN NEW;
  END IF;

  -- Skip if no stage assigned
  IF NEW.leads_stages_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_supabase_url := current_setting('app.supabase_url', true);
  v_service_key  := current_setting('app.service_role_key', true);

  -- Silently skip if settings not configured
  IF v_supabase_url IS NULL OR v_supabase_url = ''
     OR v_service_key IS NULL OR v_service_key = '' THEN
    RETURN NEW;
  END IF;

  -- Fire edge function asynchronously (non-blocking via pg_net)
  PERFORM extensions.http_post(
    url     := v_supabase_url || '/functions/v1/dispara-webhook',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body    := jsonb_build_object(
      'tipo',    'lead_etapa',
      'lead_id', NEW.id::text
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block lead updates due to webhook failures
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.process_message_buffer()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec           record;
  supabase_url  text;
  svc_key       text;
BEGIN
  SELECT value INTO supabase_url FROM _app_config WHERE key = 'supabase_url';
  SELECT value INTO svc_key      FROM _app_config WHERE key = 'service_role_key';

  IF supabase_url IS NULL OR supabase_url = '' OR svc_key IS NULL OR svc_key = '' THEN
    RAISE NOTICE 'process_message_buffer: _app_config incompleta.';
    RETURN;
  END IF;

  FOR rec IN
    SELECT DISTINCT ON (mb.people_id) mb.people_id
    FROM   message_buffer mb
    JOIN   clients_people cp ON cp.id = mb.people_id
    WHERE  mb.processed          = false
      AND  mb.expires_at         < now()
      AND  cp.ai_processing_lock = false
      AND  cp.ai_enabled         = true
    ORDER BY mb.people_id, mb.created_at DESC
  LOOP
    UPDATE clients_people
      SET ai_processing_lock = true
      WHERE id = rec.people_id
        AND ai_processing_lock = false;

    IF FOUND THEN
      PERFORM net.http_post(
        url                  := supabase_url || '/functions/v1/ai-agent-execute',
        headers              := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || svc_key
        ),
        body                 := jsonb_build_object('people_id', rec.people_id),
        timeout_milliseconds := 30000
      );
    END IF;
  END LOOP;
END;
$function$


CREATE OR REPLACE FUNCTION public.release_stale_ai_locks()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE clients_people
    SET ai_processing_lock = false
    WHERE ai_processing_lock = true
      AND ai_last_message_at < now() - interval '2 minutes';
END;
$function$


CREATE OR REPLACE FUNCTION public.reorder_leads_stage(p_stage_id uuid, p_pipeline_id uuid, p_new_position integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_pos integer;
  v_max_pos integer;
  v_target_pos integer;
BEGIN
  WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY order_index) AS pos
    FROM public.leads_stages
    WHERE leads_pipelines_id = p_pipeline_id AND active = true
  )
  SELECT pos, (SELECT MAX(pos) FROM ordered)
  INTO v_current_pos, v_max_pos
  FROM ordered
  WHERE id = p_stage_id;

  IF v_current_pos IS NULL OR v_max_pos IS NULL THEN
    RETURN;
  END IF;

  v_target_pos := GREATEST(1, LEAST(p_new_position, v_max_pos));

  IF v_target_pos = v_current_pos THEN
    RETURN;
  END IF;

  WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY order_index) AS pos
    FROM public.leads_stages
    WHERE leads_pipelines_id = p_pipeline_id AND active = true
  ),
  moved AS (
    SELECT
      id,
      CASE
        WHEN pos = v_current_pos THEN v_target_pos
        WHEN v_target_pos < v_current_pos
             AND pos >= v_target_pos
             AND pos < v_current_pos
          THEN pos + 1
        WHEN v_target_pos > v_current_pos
             AND pos <= v_target_pos
             AND pos > v_current_pos
          THEN pos - 1
        ELSE pos
      END AS new_pos
    FROM ordered
  )
  UPDATE public.leads_stages ls
  SET order_index = m.new_pos
  FROM moved m
  WHERE ls.id = m.id;
END;
$function$


CREATE OR REPLACE FUNCTION public.reset_stale_sending_messages()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE messages
  SET status = 'pending'
  WHERE status = 'sending'
    AND created_at < now() - interval '5 minutes';
END;
$function$


CREATE OR REPLACE FUNCTION public.restore_agent_version(p_agent_id uuid, p_history_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_history    record;
  v_parsed     jsonb;
  v_step       jsonb;
BEGIN
  -- Fetch history record
  SELECT * INTO v_history
  FROM ai_agents_history
  WHERE id = p_history_id AND ai_agent_id = p_agent_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'History record % not found for agent %', p_history_id, p_agent_id;
  END IF;

  v_parsed := v_history.data;

  -- Restore agent fields
  UPDATE ai_agents SET
    name             = v_parsed->>'name',
    description      = v_parsed->>'description',
    identity         = v_parsed->>'identity',
    general_rules    = v_parsed->>'general_rules',
    input_data       = v_parsed->>'input_data',
    use_stages       = (v_parsed->>'use_stages')::boolean,
    active           = (v_parsed->>'active')::boolean,
    pipeline_id      = (v_parsed->>'pipeline_id')::uuid,
    leads_stages_id  = (v_parsed->>'leads_stages_id')::uuid,
    score_matrix_ids = COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(v_parsed->'score_matrix_ids'))::uuid[],
      '{}'::uuid[]
    ),
    score_value      = (v_parsed->>'score_value')::integer,
    updated_at       = now()
  WHERE id = p_agent_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agent % not found', p_agent_id;
  END IF;

  -- Restore steps atomically
  DELETE FROM ai_agents_steps WHERE ai_agent_id = p_agent_id;

  IF v_parsed->'steps' IS NOT NULL AND jsonb_array_length(v_parsed->'steps') > 0 THEN
    FOR v_step IN SELECT * FROM jsonb_array_elements(v_parsed->'steps')
    LOOP
      INSERT INTO ai_agents_steps (ai_agent_id, name, prompt, control, order_index, active)
      VALUES (
        p_agent_id,
        COALESCE(v_step->>'name', v_step->>'nome'),
        v_step->>'prompt',
        COALESCE(v_step->>'control', v_step->>'controle'),
        COALESCE((v_step->>'order_index')::integer, (v_step->>'ordem')::integer, 0),
        COALESCE((v_step->>'active')::boolean, (v_step->>'ativo')::boolean, true)
      );
    END LOOP;
  END IF;
END;
$function$


CREATE OR REPLACE FUNCTION public.score_settings_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$


CREATE OR REPLACE FUNCTION public.set_adm_clients_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.set_call_pro_as_queues_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.set_dead_letter_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.set_elevenlabs_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.set_instagram_automation_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$function$


CREATE OR REPLACE FUNCTION public.set_omni_channel_configs_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.set_omni_outbound_webhooks_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.set_schedule_automation_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$function$


CREATE OR REPLACE FUNCTION public.settings_ai_providers_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.settings_whatsapp_channels_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$


CREATE OR REPLACE FUNCTION public.track_leads_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Track stage changes with from/to stage IDs
    IF OLD.leads_stages_id IS DISTINCT FROM NEW.leads_stages_id THEN
      INSERT INTO leads_updates (
        lead_id,
        user_id,
        from_stage_id,
        to_stage_id,
        notes,
        created_at
      ) VALUES (
        NEW.id,
        (SELECT id FROM settings_users WHERE auth_user_id = auth.uid() LIMIT 1),
        OLD.leads_stages_id,
        NEW.leads_stages_id,
        'stage_change',
        NOW()
      );
    END IF;

    -- Track status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO leads_updates (
        lead_id,
        user_id,
        notes,
        created_at
      ) VALUES (
        NEW.id,
        (SELECT id FROM settings_users WHERE auth_user_id = auth.uid() LIMIT 1),
        'status_change: ' || COALESCE(OLD.status, 'null') || ' → ' || COALESCE(NEW.status, 'null'),
        NOW()
      );
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- NEVER block lead updates due to audit trail failures
  RAISE WARNING 'track_leads_changes failed: %', SQLERRM;
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.trg_auto_merge_on_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_dup_id         UUID;
  v_canonical      UUID;
  v_duplicate      UUID;
  v_dup_created_at TIMESTAMPTZ;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'merged' THEN
    RETURN NEW;
  END IF;

  IF NEW.whatsapp IS NULL
    AND NEW.email IS NULL
    AND NEW.document IS NULL
    AND NEW.instagram_user_id IS NULL
    AND NEW.instagram_handle IS NULL
  THEN
    RETURN NEW;
  END IF;

  v_dup_id := public.find_duplicate_person(
    NEW.id,
    NEW.whatsapp,
    NEW.email,
    NEW.document,
    NEW.instagram_user_id,
    NEW.instagram_handle
  );

  IF v_dup_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT created_at INTO v_dup_created_at
  FROM public.clients_people WHERE id = v_dup_id;

  IF v_dup_created_at <= NEW.created_at THEN
    v_canonical := v_dup_id;
    v_duplicate := NEW.id;
  ELSE
    v_canonical := NEW.id;
    v_duplicate := v_dup_id;
  END IF;

  PERFORM public.merge_persons(v_canonical, v_duplicate);

  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.trg_cleanup_agent_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  PERFORM cleanup_agent_history(NEW.ai_agent_id, 50);
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.trigger_instagram_token_refresh()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  supabase_url  text;
  svc_key       text;
BEGIN
  SELECT value INTO supabase_url FROM _app_config WHERE key = 'supabase_url';
  SELECT value INTO svc_key      FROM _app_config WHERE key = 'service_role_key';

  IF supabase_url IS NULL OR svc_key IS NULL THEN
    RAISE WARNING 'trigger_instagram_token_refresh: _app_config missing supabase_url or service_role_key';
    RETURN;
  END IF;

  -- Only trigger if instagram channel is active
  IF NOT EXISTS (
    SELECT 1 FROM omni_channel_configs
    WHERE channel = 'instagram' AND is_active = true
    LIMIT 1
  ) THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := supabase_url || '/functions/v1/instagram-token-refresh',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || svc_key
    ),
    body    := '{"trigger":"cron"}'::jsonb
  );
END;
$function$


CREATE OR REPLACE FUNCTION public.trigger_omni_delivery_engine()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  supabase_url  text;
  svc_key       text;
BEGIN
  SELECT value INTO supabase_url FROM _app_config WHERE key = 'supabase_url';
  SELECT value INTO svc_key      FROM _app_config WHERE key = 'service_role_key';

  IF supabase_url IS NULL OR svc_key IS NULL THEN
    RAISE WARNING 'trigger_omni_delivery_engine: _app_config missing supabase_url or service_role_key';
    RETURN;
  END IF;

  -- Só dispara se houver mensagens pending (evita chamadas desnecessárias)
  IF NOT EXISTS (
    SELECT 1 FROM messages
    WHERE status = 'pending'
      AND from_contact != 'cliente'
      AND created_at > now() - interval '24 hours'
    LIMIT 1
  ) THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := supabase_url || '/functions/v1/omni-delivery-engine',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || svc_key
    ),
    body    := '{"trigger":"cron"}'::jsonb
  );
END;
$function$


CREATE OR REPLACE FUNCTION public.trigger_omni_retry_dead_letter()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  supabase_url  text;
  svc_key       text;
BEGIN
  SELECT value INTO supabase_url FROM _app_config WHERE key = 'supabase_url';
  SELECT value INTO svc_key      FROM _app_config WHERE key = 'service_role_key';

  IF supabase_url IS NULL OR svc_key IS NULL THEN
    RAISE WARNING 'trigger_omni_retry_dead_letter: _app_config missing';
    RETURN;
  END IF;

  -- Only trigger if there are entries ready for retry
  IF NOT EXISTS (
    SELECT 1 FROM omni_delivery_dead_letter
    WHERE status = 'pending'
      AND next_retry_at <= now()
    LIMIT 1
  ) THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := supabase_url || '/functions/v1/omni-retry-dead-letter',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || svc_key
    ),
    body    := '{"trigger":"cron"}'::jsonb
  );
END;
$function$


CREATE OR REPLACE FUNCTION public.update_bi_ad_tables_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
  BEGIN
    NEW.updated_at = now();
    RETURN NEW;
  END;
  $function$


CREATE OR REPLACE FUNCTION public.update_bi_sdr_targets_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.update_lp_tables_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$


CREATE OR REPLACE FUNCTION public.update_meeting(p_meeting_id uuid, p_status text, p_start_ts timestamp with time zone DEFAULT NULL::timestamp with time zone, p_duration_minutes integer DEFAULT NULL::integer, p_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_date       DATE;
  v_start_time TIME;
  v_end_time   TIME;
BEGIN
  -- Validate meeting exists
  IF NOT EXISTS (SELECT 1 FROM public.meetings WHERE id = p_meeting_id) THEN
    RAISE EXCEPTION 'update_meeting: meeting % not found', p_meeting_id;
  END IF;

  IF p_start_ts IS NOT NULL THEN
    v_date       := p_start_ts::DATE;
    v_start_time := p_start_ts::TIME;
    v_end_time   := (p_start_ts + (COALESCE(p_duration_minutes, 30) || ' minutes')::INTERVAL)::TIME;

    UPDATE public.meetings
    SET
      status     = p_status,
      date       = v_date,
      start_time = v_start_time,
      end_time   = v_end_time,
      notes      = CASE WHEN p_notes IS NOT NULL THEN COALESCE(notes || E'\n', '') || p_notes ELSE notes END
    WHERE id = p_meeting_id;
  ELSE
    UPDATE public.meetings
    SET
      status = p_status,
      notes  = CASE WHEN p_notes IS NOT NULL THEN COALESCE(notes || E'\n', '') || p_notes ELSE notes END
    WHERE id = p_meeting_id;
  END IF;
END;
$function$


CREATE OR REPLACE FUNCTION public.update_qualification_field(p_person_id uuid, p_field_key text, p_value text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_definition_id UUID;
BEGIN
  SELECT id INTO v_definition_id
  FROM public.lead_field_definitions
  WHERE key = p_field_key
    AND entity_type = 'pessoa'
    AND active = true
  LIMIT 1;

  IF v_definition_id IS NULL THEN
    RAISE WARNING 'update_qualification_field: field_key "%" not found in lead_field_definitions (entity_type=pessoa)', p_field_key;
    RETURN;
  END IF;

  INSERT INTO public.lead_field_values (
    entity_type, entity_id, field_definition_id, value_text
  )
  VALUES ('pessoa', p_person_id, v_definition_id, p_value)
  ON CONFLICT ON CONSTRAINT lead_field_values_entity_def_uniq
  DO UPDATE SET value_text = EXCLUDED.value_text, updated_at = now();
END;
$function$


CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.upsert_crm_field_value(p_person_id uuid, p_field_key text, p_value text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.upsert_field_value(p_person_id, p_field_key, p_value);
END;
$function$


CREATE OR REPLACE FUNCTION public.upsert_field_value(p_person_id uuid, p_field_key text, p_value text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_definition_id UUID;
BEGIN
  SELECT id INTO v_definition_id
  FROM public.lead_field_definitions
  WHERE key = p_field_key
    AND entity_type = 'pessoa'
    AND active = true
  LIMIT 1;

  IF v_definition_id IS NULL THEN
    RAISE WARNING 'upsert_field_value: field_key "%" not found in lead_field_definitions (entity_type=pessoa)', p_field_key;
    RETURN;
  END IF;

  INSERT INTO public.lead_field_values (
    entity_type, entity_id, field_definition_id, value_text
  )
  VALUES ('pessoa', p_person_id, v_definition_id, p_value)
  ON CONFLICT ON CONSTRAINT lead_field_values_entity_def_uniq
  DO UPDATE SET value_text = EXCLUDED.value_text, updated_at = now();
END;
$function$


CREATE OR REPLACE FUNCTION storage.allow_any_operation(expected_operations text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT CASE
      WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
      ELSE raw_operation
    END AS current_operation
    FROM current_operation
  )
  SELECT EXISTS (
    SELECT 1
    FROM normalized n
    CROSS JOIN LATERAL unnest(expected_operations) AS expected_operation
    WHERE expected_operation IS NOT NULL
      AND expected_operation <> ''
      AND n.current_operation = CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END
  );
$function$


CREATE OR REPLACE FUNCTION storage.allow_only_operation(expected_operation text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT
      CASE
        WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
        ELSE raw_operation
      END AS current_operation,
      CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END AS requested_operation
    FROM current_operation
  )
  SELECT CASE
    WHEN requested_operation IS NULL OR requested_operation = '' THEN FALSE
    ELSE COALESCE(current_operation = requested_operation, FALSE)
  END
  FROM normalized;
$function$


CREATE OR REPLACE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$function$


CREATE OR REPLACE FUNCTION storage.delete_leaf_prefixes(bucket_ids text[], names text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_rows_deleted integer;
BEGIN
    LOOP
        WITH candidates AS (
            SELECT DISTINCT
                t.bucket_id,
                unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        ),
        uniq AS (
             SELECT
                 bucket_id,
                 name,
                 storage.get_level(name) AS level
             FROM candidates
             WHERE name <> ''
             GROUP BY bucket_id, name
        ),
        leaf AS (
             SELECT
                 p.bucket_id,
                 p.name,
                 p.level
             FROM storage.prefixes AS p
                  JOIN uniq AS u
                       ON u.bucket_id = p.bucket_id
                           AND u.name = p.name
                           AND u.level = p.level
             WHERE NOT EXISTS (
                 SELECT 1
                 FROM storage.objects AS o
                 WHERE o.bucket_id = p.bucket_id
                   AND o.level = p.level + 1
                   AND o.name COLLATE "C" LIKE p.name || '/%'
             )
             AND NOT EXISTS (
                 SELECT 1
                 FROM storage.prefixes AS c
                 WHERE c.bucket_id = p.bucket_id
                   AND c.level = p.level + 1
                   AND c.name COLLATE "C" LIKE p.name || '/%'
             )
        )
        DELETE
        FROM storage.prefixes AS p
            USING leaf AS l
        WHERE p.bucket_id = l.bucket_id
          AND p.name = l.name
          AND p.level = l.level;

        GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
        EXIT WHEN v_rows_deleted = 0;
    END LOOP;
END;
$function$


CREATE OR REPLACE FUNCTION storage.enforce_bucket_name_length()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$function$


CREATE OR REPLACE FUNCTION storage.extension(name text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    SELECT _parts[array_length(_parts,1)] INTO _filename;
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$function$


CREATE OR REPLACE FUNCTION storage.filename(name text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$function$


CREATE OR REPLACE FUNCTION storage.foldername(name text)
 RETURNS text[]
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$function$


CREATE OR REPLACE FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
SELECT CASE
    WHEN position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(p_key, length(p_prefix) + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)))
    ELSE NULL
END;
$function$


CREATE OR REPLACE FUNCTION storage.get_level(name text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE STRICT
AS $function$
SELECT array_length(string_to_array("name", '/'), 1);
$function$


CREATE OR REPLACE FUNCTION storage.get_prefix(name text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE STRICT
AS $function$
SELECT
    CASE WHEN strpos("name", '/') > 0 THEN
             regexp_replace("name", '[\/]{1}[^\/]+\/?$', '')
         ELSE
             ''
        END;
$function$


CREATE OR REPLACE FUNCTION storage.get_prefixes(name text)
 RETURNS text[]
 LANGUAGE plpgsql
 IMMUTABLE STRICT
AS $function$
DECLARE
    parts text[];
    prefixes text[];
    prefix text;
BEGIN
    -- Split the name into parts by '/'
    parts := string_to_array("name", '/');
    prefixes := '{}';

    -- Construct the prefixes, stopping one level below the last part
    FOR i IN 1..array_length(parts, 1) - 1 LOOP
            prefix := array_to_string(parts[1:i], '/');
            prefixes := array_append(prefixes, prefix);
    END LOOP;

    RETURN prefixes;
END;
$function$


CREATE OR REPLACE FUNCTION storage.get_size_by_bucket()
 RETURNS TABLE(size bigint, bucket_id text)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
    return query
        select sum((metadata->>'size')::bigint) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$function$


CREATE OR REPLACE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text)
 RETURNS TABLE(key text, id text, created_at timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$function$


CREATE OR REPLACE FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text)
 RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix, 1) = delimiter_param THEN
        v_upper_bound := left(v_prefix, -1) || chr(ascii(delimiter_param) + 1);
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'AND o.name COLLATE "C" < $3 ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'AND o.name COLLATE "C" >= $3 ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor: find the last item in range
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Cursor provided: determine if it refers to a folder or leaf
        IF EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = _bucket_id
              AND o.name COLLATE "C" LIKE v_start || delimiter_param || '%'
            LIMIT 1
        ) THEN
            -- Cursor refers to a folder
            IF v_is_asc THEN
                v_next_seek := v_start || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_start || delimiter_param;
            END IF;
        ELSE
            -- Cursor refers to a leaf object
            IF v_is_asc THEN
                v_next_seek := v_start || delimiter_param;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := rtrim(v_common_prefix, delimiter_param);
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1) || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := v_current.name;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                RETURN NEXT;
                v_count := v_count + 1;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := v_current.name || delimiter_param;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;
    END LOOP;
END;
$function$


CREATE OR REPLACE FUNCTION storage.operation()
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$function$


CREATE OR REPLACE FUNCTION storage.protect_delete()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$function$


CREATE OR REPLACE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text)
 RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;
    v_skipped INT := 0;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach (unchanged)
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT path_tokens[$1] AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $2 || '%%'
                  AND bucket_id = $3
                  AND array_length(objects.path_tokens, 1) <> $1
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata FROM folders)
            UNION ALL
            (SELECT path_tokens[$1] AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata
             FROM storage.objects
             WHERE objects.name ILIKE $2 || '%%'
               AND bucket_id = $3
               AND array_length(objects.path_tokens, 1) = $1
             ORDER BY %I %s)
            LIMIT $4 OFFSET $5
            $sql$, v_sort_order, v_order_by, v_sort_order
        ) USING levels, v_prefix, bucketname, v_limit, offsets;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'AND lower(o.name) COLLATE "C" < $3 ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'AND lower(o.name) COLLATE "C" >= $3 ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC: find the last item in range first (static SQL)
        IF v_upper_bound IS NOT NULL THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower AND lower(o.name) COLLATE "C" < v_upper_bound
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSIF v_prefix_lower <> '' THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSE
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        END IF;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix_lower <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := split_part(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter), v_delimiter, levels);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := lower(v_current.name);
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := split_part(v_current.name, v_delimiter, levels);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := lower(v_current.name) || v_delimiter;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;
    END LOOP;
END;
$function$


CREATE OR REPLACE FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text)
 RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
BEGIN
    v_prefix := coalesce(p_prefix, '');

    IF p_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $1 || '%%'
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                rtrim(common_prefix, '/') AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    date_trunc('milliseconds', %I),
                    name COLLATE "C"
                ) %s ROW(
                    COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz),
                    $5
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s
        LIMIT $4
    $sql$,
        p_sort_column,
        v_cursor_op,
        p_sort_column,
        p_sort_order,
        p_sort_order
    );

    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after;
END;
$function$


CREATE OR REPLACE FUNCTION storage.search_legacy_v1(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text)
 RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select path_tokens[$1] as folder
           from storage.objects
             where objects.name ilike $2 || $3 || ''%''
               and bucket_id = $4
               and array_length(objects.path_tokens, 1) <> $1
           group by folder
           order by folder ' || v_sort_order || '
     )
     (select folder as "name",
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[$1] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where objects.name ilike $2 || $3 || ''%''
       and bucket_id = $4
       and array_length(objects.path_tokens, 1) = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$function$


CREATE OR REPLACE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text)
 RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            start_after,
            '',
            v_sort_ord
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after
        );
    END IF;
END;
$function$


CREATE OR REPLACE FUNCTION storage.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$function$



-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE TRIGGER trg_adm_clients_updated_at BEFORE UPDATE ON public.adm_clients FOR EACH ROW EXECUTE FUNCTION set_adm_clients_updated_at();
CREATE TRIGGER update_ai_agents_updated_at BEFORE UPDATE ON public.ai_agents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER cleanup_history_after_insert AFTER INSERT ON public.ai_agents_history FOR EACH ROW EXECUTE FUNCTION trg_cleanup_agent_history();
CREATE TRIGGER update_ai_agents_steps_updated_at BEFORE UPDATE ON public.ai_agents_steps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER bi_sdr_targets_updated_at BEFORE UPDATE ON public.bi_sdr_targets FOR EACH ROW EXECUTE FUNCTION update_bi_sdr_targets_updated_at();
CREATE TRIGGER trg_booking_rule_sets_url_id BEFORE INSERT ON public.booking_rule_sets FOR EACH ROW EXECUTE FUNCTION assign_booking_rule_set_url_id();
CREATE TRIGGER trg_call_pro_as_queues_updated_at BEFORE UPDATE ON public.call_pro_as_queues FOR EACH ROW EXECUTE FUNCTION set_call_pro_as_queues_updated_at();
CREATE TRIGGER update_clients_companies_updated_at BEFORE UPDATE ON public.clients_companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_identity_auto_merge AFTER INSERT OR UPDATE OF email, document, whatsapp, instagram_user_id, instagram_handle ON public.clients_people FOR EACH ROW EXECUTE FUNCTION trg_auto_merge_on_identity();
CREATE TRIGGER update_clients_people_updated_at BEFORE UPDATE ON public.clients_people FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clients_people_companies_updated_at BEFORE UPDATE ON public.clients_people_companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_elevenlabs_agents_updated_at BEFORE UPDATE ON public.elevenlabs_agents FOR EACH ROW EXECUTE FUNCTION set_elevenlabs_updated_at();
CREATE TRIGGER set_elevenlabs_voices_updated_at BEFORE UPDATE ON public.elevenlabs_voices FOR EACH ROW EXECUTE FUNCTION set_elevenlabs_updated_at();
CREATE TRIGGER update_followup_queue_updated_at BEFORE UPDATE ON public.followup_queue FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_lp_forms_updated_at BEFORE UPDATE ON public.form_pro_forms FOR EACH ROW EXECUTE FUNCTION update_lp_tables_updated_at();
CREATE TRIGGER instagram_automations_updated_at BEFORE UPDATE ON public.instagram_automations FOR EACH ROW EXECUTE FUNCTION set_instagram_automation_updated_at();
CREATE TRIGGER on_lead_stage_changed AFTER INSERT OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION notify_lead_stage_changed();
CREATE TRIGGER trg_conversion_lead_lost AFTER UPDATE ON public.leads FOR EACH ROW WHEN (((old.lost_at IS NULL) AND (new.lost_at IS NOT NULL))) EXECUTE FUNCTION fn_queue_conversion_event('lead_lost');
CREATE TRIGGER trg_conversion_lead_won AFTER UPDATE ON public.leads FOR EACH ROW WHEN (((old.won_at IS NULL) AND (new.won_at IS NOT NULL))) EXECUTE FUNCTION fn_queue_conversion_event('lead_won');
CREATE TRIGGER trg_conversion_stage_enter AFTER UPDATE ON public.leads FOR EACH ROW WHEN ((old.leads_stages_id IS DISTINCT FROM new.leads_stages_id)) EXECUTE FUNCTION fn_queue_conversion_event('stage_change');
CREATE TRIGGER trigger_dispatch_new_lead_webhooks AFTER INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION dispatch_new_lead_webhooks();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_loss_reasons_updated_at BEFORE UPDATE ON public.leads_loss_reasons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_notes_updated_at BEFORE UPDATE ON public.leads_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_pipelines_updated_at BEFORE UPDATE ON public.leads_pipelines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_stages_updated_at BEFORE UPDATE ON public.leads_stages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_stages_followups_updated_at BEFORE UPDATE ON public.leads_stages_followups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_update_meeting_records_updated_at BEFORE UPDATE ON public.meeting_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_conversion_booking_status AFTER UPDATE OF status ON public.meetings FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION fn_queue_conversion_booking();
CREATE TRIGGER trg_meeting_followup_queue AFTER INSERT OR UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION handle_meeting_followup_queue();
CREATE TRIGGER trg_schedule_automation AFTER INSERT OR UPDATE OF status ON public.meetings FOR EACH ROW EXECUTE FUNCTION fn_schedule_automation_on_status_change();
CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_meetings_followups_updated_at BEFORE UPDATE ON public.meetings_followups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_omni_channel_configs_updated_at BEFORE UPDATE ON public.omni_channel_configs FOR EACH ROW EXECUTE FUNCTION set_omni_channel_configs_updated_at();
CREATE TRIGGER trg_dead_letter_updated_at BEFORE UPDATE ON public.omni_delivery_dead_letter FOR EACH ROW EXECUTE FUNCTION set_dead_letter_updated_at();
CREATE TRIGGER trg_omni_outbound_webhooks_updated_at BEFORE UPDATE ON public.omni_outbound_webhooks FOR EACH ROW EXECUTE FUNCTION set_omni_outbound_webhooks_updated_at();
CREATE TRIGGER prospect_campaigns_updated_at BEFORE UPDATE ON public.prospect_campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER prospect_establishments_updated_at BEFORE UPDATE ON public.prospect_establishments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER schedule_automations_updated_at BEFORE UPDATE ON public.schedule_automations FOR EACH ROW EXECUTE FUNCTION set_schedule_automation_updated_at();
CREATE TRIGGER score_categories_updated_at BEFORE UPDATE ON public.score_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER score_category_items_updated_at BEFORE UPDATE ON public.score_category_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_score_matrix_updated_at BEFORE UPDATE ON public.score_matrix FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_score_settings_updated_at BEFORE UPDATE ON public.score_settings FOR EACH ROW EXECUTE FUNCTION score_settings_set_updated_at();
CREATE TRIGGER update_sends_updated_at BEFORE UPDATE ON public.sends FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER settings_ai_providers_updated_at BEFORE UPDATE ON public.settings_ai_providers FOR EACH ROW EXECUTE FUNCTION settings_ai_providers_set_updated_at();
CREATE TRIGGER set_settings_elevenlabs_updated_at BEFORE UPDATE ON public.settings_elevenlabs FOR EACH ROW EXECUTE FUNCTION set_elevenlabs_updated_at();
CREATE TRIGGER update_settings_schedules_updated_at BEFORE UPDATE ON public.settings_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_system_modules_updated_at BEFORE UPDATE ON public.settings_system_modules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_teams_updated_at BEFORE UPDATE ON public.settings_teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_users_updated_at BEFORE UPDATE ON public.settings_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER whatsapp_channels_updated_at BEFORE UPDATE ON public.settings_whatsapp_channels FOR EACH ROW EXECUTE FUNCTION settings_whatsapp_channels_set_updated_at();
CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON public.webhooks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_whatsapp_templates_updated_at BEFORE UPDATE ON public.whatsapp_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();
CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();
CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();
CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._meta_debug ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adm_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adm_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adm_migration_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adm_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adm_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adm_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agents_execution_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agents_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agents_score_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agents_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agents_steps_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bi_ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bi_ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bi_ad_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bi_ad_spend ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bi_sdr_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bi_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_rule_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_pro_as_queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_pro_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_pro_operator_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_pro_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_pro_tabulation_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canned_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients_people_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients_people_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversion_event_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversion_events_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversion_platform_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversion_stage_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elevenlabs_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elevenlabs_voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followup_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_pro_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_pro_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_pro_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_automation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_loss_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_stages_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_followup_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_buffer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_lead_form_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_lead_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omni_channel_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omni_channel_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omni_delivery_dead_letter ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omni_outbound_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_enrichment_plugins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_enrichment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_establishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_opt_out_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_people_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_category_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sends_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_elevenlabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_omni_new_contact ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_system_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_users_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_whatsapp_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can read audit log" ON public.adm_audit_log
  AS PERMISSIVE FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND settings_users.super_admin = true AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "System can insert audit log" ON public.adm_audit_log
  AS PERMISSIVE FOR INSERT
  WITH CHECK (true);
CREATE POLICY "adm_clients_super_admin" ON public.adm_clients
  AS PERMISSIVE FOR ALL
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND settings_users.super_admin = true AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "adm_migration_runs_super_admin" ON public.adm_migration_runs
  AS PERMISSIVE FOR ALL
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND settings_users.super_admin = true AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "adm_migrations_super_admin" ON public.adm_migrations
  AS PERMISSIVE FOR ALL
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND settings_users.super_admin = true AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "adm_sync_jobs_super_admin" ON public.adm_sync_jobs
  AS PERMISSIVE FOR ALL
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND settings_users.super_admin = true AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "adm_sync_logs_super_admin" ON public.adm_sync_logs
  AS PERMISSIVE FOR ALL
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND settings_users.super_admin = true AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "admins_manage_ai_agents" ON public.ai_agents
  AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin_or_manager())
  WITH CHECK (is_admin_or_manager());
CREATE POLICY "users_read_active_agents" ON public.ai_agents
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (active = true OR is_admin_or_manager());
CREATE POLICY "agents_exec_log_select" ON public.ai_agents_execution_log
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_admin_or_manager());
CREATE POLICY "exec_log_admin_all" ON public.ai_agents_execution_log
  AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin_or_manager())
  WITH CHECK (is_admin_or_manager());
CREATE POLICY "exec_log_service_role_all" ON public.ai_agents_execution_log
  AS PERMISSIVE FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
CREATE POLICY "admins_manage_ai_agents_history" ON public.ai_agents_history
  AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin_or_manager())
  WITH CHECK (is_admin_or_manager());
CREATE POLICY "authenticated_read" ON public.ai_agents_score_matrix
  AS PERMISSIVE FOR SELECT
  USING (true);
CREATE POLICY "authenticated_write" ON public.ai_agents_score_matrix
  AS PERMISSIVE FOR ALL
  USING (true)
  WITH CHECK (true);
CREATE POLICY "admins_manage_ai_agents_steps" ON public.ai_agents_steps
  AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin_or_manager())
  WITH CHECK (is_admin_or_manager());
CREATE POLICY "users_read_active_agent_steps" ON public.ai_agents_steps
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (active = true OR is_admin_or_manager() OR (EXISTS ( SELECT 1
   FROM ai_agents a
  WHERE a.id = ai_agents_steps.ai_agent_id AND a.active = true)));
CREATE POLICY "authenticated_read" ON public.ai_agents_steps_history
  AS PERMISSIVE FOR SELECT
  USING (true);
CREATE POLICY "authenticated_write" ON public.ai_agents_steps_history
  AS PERMISSIVE FOR ALL
  USING (true)
  WITH CHECK (true);
CREATE POLICY "bi_ad_accounts_delete" ON public.bi_ad_accounts
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin_or_manager());
CREATE POLICY "bi_ad_accounts_insert" ON public.bi_ad_accounts
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_manager());
CREATE POLICY "bi_ad_accounts_select" ON public.bi_ad_accounts
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "bi_ad_accounts_update" ON public.bi_ad_accounts
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_admin_or_manager());
CREATE POLICY "bi_ad_campaigns_insert" ON public.bi_ad_campaigns
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_manager());
CREATE POLICY "bi_ad_campaigns_select" ON public.bi_ad_campaigns
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "bi_ad_daily_stats_insert" ON public.bi_ad_daily_stats
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_manager());
CREATE POLICY "bi_ad_daily_stats_select" ON public.bi_ad_daily_stats
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "bi_ad_spend_all" ON public.bi_ad_spend
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "bi_sdr_targets_delete" ON public.bi_sdr_targets
  AS PERMISSIVE FOR DELETE
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "bi_sdr_targets_insert" ON public.bi_sdr_targets
  AS PERMISSIVE FOR INSERT
  WITH CHECK ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "bi_sdr_targets_select" ON public.bi_sdr_targets
  AS PERMISSIVE FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "bi_sdr_targets_update" ON public.bi_sdr_targets
  AS PERMISSIVE FOR UPDATE
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "bi_settings_admin_only" ON public.bi_settings
  AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin_or_manager())
  WITH CHECK (is_admin_or_manager());
CREATE POLICY "bi_settings_all" ON public.bi_settings
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "booking_rule_sets_anon_read" ON public.booking_rule_sets
  AS PERMISSIVE FOR SELECT TO anon
  USING (is_active = true);
CREATE POLICY "booking_rule_sets_auth_all" ON public.booking_rule_sets
  AS PERMISSIVE FOR ALL
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND booking_rule_sets.is_active = true)));
CREATE POLICY "booking_rules_anon_read" ON public.booking_rules
  AS PERMISSIVE FOR SELECT TO anon
  USING ((EXISTS ( SELECT 1
   FROM booking_rule_sets
  WHERE booking_rule_sets.id = booking_rules.rule_set_id AND booking_rule_sets.is_active = true)));
CREATE POLICY "booking_rules_auth_all" ON public.booking_rules
  AS PERMISSIVE FOR ALL
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND booking_rules.is_active = true)));
CREATE POLICY "call_pro_as_queues_select" ON public.call_pro_as_queues
  AS PERMISSIVE FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "call_pro_as_queues_write" ON public.call_pro_as_queues
  AS PERMISSIVE FOR ALL
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "authenticated_all" ON public.call_pro_calls
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "call_pro_calls_insert" ON public.call_pro_calls
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((user_id IN ( SELECT settings_users.id
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND settings_users.active = true AND settings_users.deleted_at IS NULL)) OR (EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "call_pro_calls_select" ON public.call_pro_calls
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id IN ( SELECT settings_users.id
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid())) OR (EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "call_pro_calls_update" ON public.call_pro_calls
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((user_id IN ( SELECT settings_users.id
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid())) OR (EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)))
  WITH CHECK ((user_id IN ( SELECT settings_users.id
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid())) OR (EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "service_role_all" ON public.call_pro_calls
  AS PERMISSIVE FOR ALL
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);
CREATE POLICY "authenticated_all" ON public.call_pro_operator_mappings
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "call_pro_operators_delete" ON public.call_pro_operator_mappings
  AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "call_pro_operators_insert" ON public.call_pro_operator_mappings
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "call_pro_operators_select" ON public.call_pro_operator_mappings
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "call_pro_operators_update" ON public.call_pro_operator_mappings
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((user_id IN ( SELECT settings_users.id
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid())) OR (EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)))
  WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.call_pro_operator_mappings
  AS PERMISSIVE FOR ALL
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);
CREATE POLICY "authenticated_all" ON public.call_pro_settings
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "call_pro_settings_insert" ON public.call_pro_settings
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "call_pro_settings_select" ON public.call_pro_settings
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "call_pro_settings_update" ON public.call_pro_settings
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)))
  WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.call_pro_settings
  AS PERMISSIVE FOR ALL
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);
CREATE POLICY "authenticated_all" ON public.call_pro_tabulation_categories
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "call_pro_categories_delete" ON public.call_pro_tabulation_categories
  AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "call_pro_categories_insert" ON public.call_pro_tabulation_categories
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "call_pro_categories_select" ON public.call_pro_tabulation_categories
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "call_pro_categories_update" ON public.call_pro_tabulation_categories
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)))
  WITH CHECK (true);
CREATE POLICY "canned_responses_all" ON public.canned_responses
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "authenticated_read" ON public.clients_companies
  AS PERMISSIVE FOR SELECT
  USING (true);
CREATE POLICY "authenticated_write" ON public.clients_companies
  AS PERMISSIVE FOR ALL
  USING (true)
  WITH CHECK (true);
CREATE POLICY "admins_delete_clients" ON public.clients_people
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin_or_manager());
CREATE POLICY "users_insert_clients" ON public.clients_people
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "users_read_own_clients" ON public.clients_people
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_admin_or_manager() OR (EXISTS ( SELECT 1
   FROM leads l
  WHERE l.people_id = clients_people.id AND l.user_id = get_current_settings_user_id())) OR (EXISTS ( SELECT 1
   FROM leads l
     JOIN settings_users_teams sut ON sut.team_id = l.teams_id
  WHERE l.people_id = clients_people.id AND sut.user_id = get_current_settings_user_id())));
CREATE POLICY "users_update_own_clients" ON public.clients_people
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_admin_or_manager() OR (EXISTS ( SELECT 1
   FROM leads l
  WHERE l.people_id = clients_people.id AND l.user_id = get_current_settings_user_id())) OR (EXISTS ( SELECT 1
   FROM leads l
     JOIN settings_users_teams sut ON sut.team_id = l.teams_id
  WHERE l.people_id = clients_people.id AND sut.user_id = get_current_settings_user_id())))
  WITH CHECK (is_admin_or_manager() OR (EXISTS ( SELECT 1
   FROM leads l
  WHERE l.people_id = clients_people.id AND l.user_id = get_current_settings_user_id())) OR (EXISTS ( SELECT 1
   FROM leads l
     JOIN settings_users_teams sut ON sut.team_id = l.teams_id
  WHERE l.people_id = clients_people.id AND sut.user_id = get_current_settings_user_id())));
CREATE POLICY "authenticated_read" ON public.clients_people_companies
  AS PERMISSIVE FOR SELECT
  USING (true);
CREATE POLICY "authenticated_write" ON public.clients_people_companies
  AS PERMISSIVE FOR ALL
  USING (true)
  WITH CHECK (true);
CREATE POLICY "authenticated_read" ON public.clients_people_updates
  AS PERMISSIVE FOR SELECT
  USING (true);
CREATE POLICY "authenticated_write" ON public.clients_people_updates
  AS PERMISSIVE FOR ALL
  USING (true)
  WITH CHECK (true);
CREATE POLICY "Users can manage own conversion rules" ON public.conversion_event_rules
  AS PERMISSIVE FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role full access on conversion_events_queue" ON public.conversion_events_queue
  AS PERMISSIVE FOR ALL
  USING (auth.role() = 'service_role'::text);
CREATE POLICY "Users can view own conversion events" ON public.conversion_events_queue
  AS PERMISSIVE FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own credentials" ON public.conversion_platform_credentials
  AS PERMISSIVE FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own stage mappings" ON public.conversion_stage_mappings
  AS PERMISSIVE FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "anon_insert_deletion_requests" ON public.data_deletion_requests
  AS PERMISSIVE FOR INSERT TO anon
  WITH CHECK (true);
CREATE POLICY "authenticated_full_access_deletion_requests" ON public.data_deletion_requests
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "elevenlabs_agents_delete" ON public.elevenlabs_agents
  AS PERMISSIVE FOR DELETE
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "elevenlabs_agents_insert" ON public.elevenlabs_agents
  AS PERMISSIVE FOR INSERT
  WITH CHECK ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "elevenlabs_agents_select" ON public.elevenlabs_agents
  AS PERMISSIVE FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "elevenlabs_agents_update" ON public.elevenlabs_agents
  AS PERMISSIVE FOR UPDATE
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "elevenlabs_voices_all" ON public.elevenlabs_voices
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "fup_queue_select" ON public.followup_queue
  AS PERMISSIVE FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "fup_queue_write" ON public.followup_queue
  AS PERMISSIVE FOR ALL
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "allow_anon_read_form_pro_forms" ON public.form_pro_forms
  AS PERMISSIVE FOR SELECT TO anon
  USING (true);
CREATE POLICY "lp_forms_delete" ON public.form_pro_forms
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin_or_manager());
CREATE POLICY "lp_forms_insert" ON public.form_pro_forms
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_manager());
CREATE POLICY "lp_forms_select" ON public.form_pro_forms
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "lp_forms_update" ON public.form_pro_forms
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_admin_or_manager());
CREATE POLICY "service_role_only" ON public.form_pro_rate_limits
  AS PERMISSIVE FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
CREATE POLICY "lp_submissions_delete" ON public.form_pro_submissions
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin_or_manager());
CREATE POLICY "lp_submissions_insert" ON public.form_pro_submissions
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "lp_submissions_select" ON public.form_pro_submissions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "authenticated_all" ON public.instagram_automation_log
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "authenticated_all" ON public.instagram_automations
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "lead_field_definitions_delete" ON public.lead_field_definitions
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin_or_manager());
CREATE POLICY "lead_field_definitions_insert" ON public.lead_field_definitions
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_manager());
CREATE POLICY "lead_field_definitions_select" ON public.lead_field_definitions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "lead_field_definitions_update" ON public.lead_field_definitions
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_admin_or_manager())
  WITH CHECK (is_admin_or_manager());
CREATE POLICY "lead_field_values_delete" ON public.lead_field_values
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin_or_manager());
CREATE POLICY "lead_field_values_insert" ON public.lead_field_values
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "lead_field_values_select" ON public.lead_field_values
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "lead_field_values_update" ON public.lead_field_values
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "admins_delete_leads" ON public.leads
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin_or_manager());
CREATE POLICY "users_insert_leads" ON public.leads
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "users_read_own_leads" ON public.leads
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_admin_or_manager() OR user_id = get_current_settings_user_id() OR (teams_id IN ( SELECT settings_users_teams.team_id
   FROM settings_users_teams
  WHERE settings_users_teams.user_id = get_current_settings_user_id())));
CREATE POLICY "users_update_own_leads" ON public.leads
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_admin_or_manager() OR user_id = get_current_settings_user_id() OR (teams_id IN ( SELECT settings_users_teams.team_id
   FROM settings_users_teams
  WHERE settings_users_teams.user_id = get_current_settings_user_id())))
  WITH CHECK (is_admin_or_manager() OR user_id = get_current_settings_user_id() OR (teams_id IN ( SELECT settings_users_teams.team_id
   FROM settings_users_teams
  WHERE settings_users_teams.user_id = get_current_settings_user_id())));
CREATE POLICY "users_manage_lead_files" ON public.leads_files
  AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin_or_manager() OR (EXISTS ( SELECT 1
   FROM leads l
  WHERE l.id = leads_files.lead_id AND (l.user_id = get_current_settings_user_id() OR (l.teams_id IN ( SELECT settings_users_teams.team_id
           FROM settings_users_teams
          WHERE settings_users_teams.user_id = get_current_settings_user_id()))))))
  WITH CHECK (is_admin_or_manager() OR (EXISTS ( SELECT 1
   FROM leads l
  WHERE l.id = leads_files.lead_id AND (l.user_id = get_current_settings_user_id() OR (l.teams_id IN ( SELECT settings_users_teams.team_id
           FROM settings_users_teams
          WHERE settings_users_teams.user_id = get_current_settings_user_id()))))));
CREATE POLICY "users_read_lead_files" ON public.leads_files
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_admin_or_manager() OR (EXISTS ( SELECT 1
   FROM leads l
  WHERE l.id = leads_files.lead_id AND (l.user_id = get_current_settings_user_id() OR (l.teams_id IN ( SELECT settings_users_teams.team_id
           FROM settings_users_teams
          WHERE settings_users_teams.user_id = get_current_settings_user_id()))))));
CREATE POLICY "authenticated_read" ON public.leads_loss_reasons
  AS PERMISSIVE FOR SELECT
  USING (true);
CREATE POLICY "authenticated_write" ON public.leads_loss_reasons
  AS PERMISSIVE FOR ALL
  USING (true)
  WITH CHECK (true);
CREATE POLICY "users_manage_lead_notes" ON public.leads_notes
  AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin_or_manager() OR (EXISTS ( SELECT 1
   FROM leads l
  WHERE l.id = leads_notes.lead_id AND (l.user_id = get_current_settings_user_id() OR (l.teams_id IN ( SELECT settings_users_teams.team_id
           FROM settings_users_teams
          WHERE settings_users_teams.user_id = get_current_settings_user_id()))))))
  WITH CHECK (is_admin_or_manager() OR (EXISTS ( SELECT 1
   FROM leads l
  WHERE l.id = leads_notes.lead_id AND (l.user_id = get_current_settings_user_id() OR (l.teams_id IN ( SELECT settings_users_teams.team_id
           FROM settings_users_teams
          WHERE settings_users_teams.user_id = get_current_settings_user_id()))))));
CREATE POLICY "users_read_lead_notes" ON public.leads_notes
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_admin_or_manager() OR (EXISTS ( SELECT 1
   FROM leads l
  WHERE l.id = leads_notes.lead_id AND (l.user_id = get_current_settings_user_id() OR (l.teams_id IN ( SELECT settings_users_teams.team_id
           FROM settings_users_teams
          WHERE settings_users_teams.user_id = get_current_settings_user_id()))))));
CREATE POLICY "authenticated_read" ON public.leads_pipelines
  AS PERMISSIVE FOR SELECT
  USING (true);
CREATE POLICY "authenticated_write" ON public.leads_pipelines
  AS PERMISSIVE FOR ALL
  USING (true)
  WITH CHECK (true);
CREATE POLICY "authenticated_read" ON public.leads_stages
  AS PERMISSIVE FOR SELECT
  USING (true);
CREATE POLICY "authenticated_write" ON public.leads_stages
  AS PERMISSIVE FOR ALL
  USING (true)
  WITH CHECK (true);
CREATE POLICY "fup_rules_select" ON public.leads_stages_followups
  AS PERMISSIVE FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "fup_rules_write" ON public.leads_stages_followups
  AS PERMISSIVE FOR ALL
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "authenticated_read" ON public.leads_updates
  AS PERMISSIVE FOR SELECT
  USING (true);
CREATE POLICY "authenticated_write" ON public.leads_updates
  AS PERMISSIVE FOR ALL
  USING (true)
  WITH CHECK (true);
CREATE POLICY "mfq_select" ON public.meeting_followup_queue
  AS PERMISSIVE FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "mfq_write" ON public.meeting_followup_queue
  AS PERMISSIVE FOR UPDATE
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "meeting_records_all" ON public.meeting_records
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "users_manage_own_meetings" ON public.meetings
  AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin_or_manager() OR user_id = get_current_settings_user_id() OR (teams_id IN ( SELECT settings_users_teams.team_id
   FROM settings_users_teams
  WHERE settings_users_teams.user_id = get_current_settings_user_id())))
  WITH CHECK (is_admin_or_manager() OR user_id = get_current_settings_user_id() OR (teams_id IN ( SELECT settings_users_teams.team_id
   FROM settings_users_teams
  WHERE settings_users_teams.user_id = get_current_settings_user_id())));
CREATE POLICY "users_read_own_meetings" ON public.meetings
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_admin_or_manager() OR user_id = get_current_settings_user_id() OR (teams_id IN ( SELECT settings_users_teams.team_id
   FROM settings_users_teams
  WHERE settings_users_teams.user_id = get_current_settings_user_id())) OR (EXISTS ( SELECT 1
   FROM leads l
  WHERE l.id = meetings.lead_id AND (l.user_id = get_current_settings_user_id() OR (l.teams_id IN ( SELECT settings_users_teams.team_id
           FROM settings_users_teams
          WHERE settings_users_teams.user_id = get_current_settings_user_id()))))));
CREATE POLICY "meet_fup_select" ON public.meetings_followups
  AS PERMISSIVE FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "meet_fup_write" ON public.meetings_followups
  AS PERMISSIVE FOR ALL
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "message_buffer_service_role_only" ON public.message_buffer
  AS PERMISSIVE FOR ALL
  USING (auth.role() = 'service_role'::text);
CREATE POLICY "users_manage_lead_messages" ON public.messages
  AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin_or_manager() OR (EXISTS ( SELECT 1
   FROM leads l
  WHERE l.id = messages.lead_id AND (l.user_id = get_current_settings_user_id() OR (l.teams_id IN ( SELECT settings_users_teams.team_id
           FROM settings_users_teams
          WHERE settings_users_teams.user_id = get_current_settings_user_id()))))) OR user_id = get_current_settings_user_id())
  WITH CHECK (is_admin_or_manager() OR (EXISTS ( SELECT 1
   FROM leads l
  WHERE l.id = messages.lead_id AND (l.user_id = get_current_settings_user_id() OR (l.teams_id IN ( SELECT settings_users_teams.team_id
           FROM settings_users_teams
          WHERE settings_users_teams.user_id = get_current_settings_user_id()))))) OR user_id = get_current_settings_user_id());
CREATE POLICY "users_read_lead_messages" ON public.messages
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_admin_or_manager() OR (EXISTS ( SELECT 1
   FROM leads l
  WHERE l.id = messages.lead_id AND (l.user_id = get_current_settings_user_id() OR (l.teams_id IN ( SELECT settings_users_teams.team_id
           FROM settings_users_teams
          WHERE settings_users_teams.user_id = get_current_settings_user_id()))))) OR user_id = get_current_settings_user_id());
CREATE POLICY "meta_lead_form_pages_select" ON public.meta_lead_form_pages
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "meta_lead_form_pages_service_delete" ON public.meta_lead_form_pages
  AS PERMISSIVE FOR DELETE TO service_role
  USING (true);
CREATE POLICY "meta_lead_form_pages_service_insert" ON public.meta_lead_form_pages
  AS PERMISSIVE FOR INSERT TO service_role
  WITH CHECK (true);
CREATE POLICY "meta_lead_form_pages_service_update" ON public.meta_lead_form_pages
  AS PERMISSIVE FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);
CREATE POLICY "meta_lead_forms_delete" ON public.meta_lead_forms
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (true);
CREATE POLICY "meta_lead_forms_insert" ON public.meta_lead_forms
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "meta_lead_forms_select" ON public.meta_lead_forms
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "meta_lead_forms_service_all" ON public.meta_lead_forms
  AS PERMISSIVE FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
CREATE POLICY "meta_lead_forms_update" ON public.meta_lead_forms
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "omni_channel_alerts_read" ON public.omni_channel_alerts
  AS PERMISSIVE FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "omni_channel_configs_read" ON public.omni_channel_configs
  AS PERMISSIVE FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "omni_channel_configs_write" ON public.omni_channel_configs
  AS PERMISSIVE FOR ALL
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "omni_dead_letter_read" ON public.omni_delivery_dead_letter
  AS PERMISSIVE FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "omni_dead_letter_update" ON public.omni_delivery_dead_letter
  AS PERMISSIVE FOR UPDATE
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "omni_outbound_webhooks_auth_users" ON public.omni_outbound_webhooks
  AS PERMISSIVE FOR ALL
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "prospect_audit_insert" ON public.prospect_audit_log
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "prospect_audit_select" ON public.prospect_audit_log
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "prospect_campaigns_delete" ON public.prospect_campaigns
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (true);
CREATE POLICY "prospect_campaigns_insert" ON public.prospect_campaigns
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "prospect_campaigns_select" ON public.prospect_campaigns
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "prospect_campaigns_update" ON public.prospect_campaigns
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "prospect_companies_delete" ON public.prospect_companies
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (true);
CREATE POLICY "prospect_companies_insert" ON public.prospect_companies
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "prospect_companies_select" ON public.prospect_companies
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "prospect_companies_update" ON public.prospect_companies
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (true);
CREATE POLICY "prospect_contacts_delete" ON public.prospect_contacts
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (true);
CREATE POLICY "prospect_contacts_insert" ON public.prospect_contacts
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "prospect_contacts_select" ON public.prospect_contacts
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "prospect_contacts_update" ON public.prospect_contacts
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "prospect_enrichment_plugins_insert" ON public.prospect_enrichment_plugins
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "prospect_enrichment_plugins_select" ON public.prospect_enrichment_plugins
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "prospect_enrichment_plugins_update" ON public.prospect_enrichment_plugins
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (true);
CREATE POLICY "prospect_enrichment_results_delete" ON public.prospect_enrichment_results
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (true);
CREATE POLICY "prospect_enrichment_results_insert" ON public.prospect_enrichment_results
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "prospect_enrichment_results_select" ON public.prospect_enrichment_results
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "prospect_enrichment_results_update" ON public.prospect_enrichment_results
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (true);
CREATE POLICY "prospect_establishments_delete" ON public.prospect_establishments
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (true);
CREATE POLICY "prospect_establishments_insert" ON public.prospect_establishments
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "prospect_establishments_select" ON public.prospect_establishments
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "prospect_establishments_update" ON public.prospect_establishments
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "prospect_opt_out_insert" ON public.prospect_opt_out_registry
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "prospect_opt_out_select" ON public.prospect_opt_out_registry
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "prospect_people_delete" ON public.prospect_people
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (true);
CREATE POLICY "prospect_people_insert" ON public.prospect_people
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "prospect_people_select" ON public.prospect_people
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "prospect_people_update" ON public.prospect_people
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "prospect_people_v2_delete" ON public.prospect_people_v2
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (true);
CREATE POLICY "prospect_people_v2_insert" ON public.prospect_people_v2
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "prospect_people_v2_select" ON public.prospect_people_v2
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "prospect_people_v2_update" ON public.prospect_people_v2
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (true);
CREATE POLICY "authenticated_all" ON public.schedule_automations
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "score_categories_read" ON public.score_categories
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "score_categories_write" ON public.score_categories
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "score_category_items_read" ON public.score_category_items
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "score_category_items_write" ON public.score_category_items
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "authenticated_read" ON public.score_matrix
  AS PERMISSIVE FOR SELECT
  USING (true);
CREATE POLICY "authenticated_write" ON public.score_matrix
  AS PERMISSIVE FOR ALL
  USING (true)
  WITH CHECK (true);
CREATE POLICY "score_settings_all" ON public.score_settings
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "authenticated_read" ON public.sends
  AS PERMISSIVE FOR SELECT
  USING (true);
CREATE POLICY "authenticated_write" ON public.sends
  AS PERMISSIVE FOR ALL
  USING (true)
  WITH CHECK (true);
CREATE POLICY "authenticated_read" ON public.sends_contacts
  AS PERMISSIVE FOR SELECT
  USING (true);
CREATE POLICY "authenticated_write" ON public.sends_contacts
  AS PERMISSIVE FOR ALL
  USING (true)
  WITH CHECK (true);
CREATE POLICY "allow_anon_read_settings" ON public.settings
  AS PERMISSIVE FOR SELECT TO anon
  USING (true);
CREATE POLICY "authenticated_read" ON public.settings
  AS PERMISSIVE FOR SELECT
  USING (true);
CREATE POLICY "authenticated_write" ON public.settings
  AS PERMISSIVE FOR ALL
  USING (true)
  WITH CHECK (true);
CREATE POLICY "ai_providers_delete_admin" ON public.settings_ai_providers
  AS PERMISSIVE FOR DELETE
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "ai_providers_insert_admin" ON public.settings_ai_providers
  AS PERMISSIVE FOR INSERT
  WITH CHECK ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "ai_providers_select_admin" ON public.settings_ai_providers
  AS PERMISSIVE FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "ai_providers_update_admin" ON public.settings_ai_providers
  AS PERMISSIVE FOR UPDATE
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "settings_elevenlabs_delete" ON public.settings_elevenlabs
  AS PERMISSIVE FOR DELETE
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "settings_elevenlabs_insert" ON public.settings_elevenlabs
  AS PERMISSIVE FOR INSERT
  WITH CHECK ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "settings_elevenlabs_select" ON public.settings_elevenlabs
  AS PERMISSIVE FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "settings_elevenlabs_update" ON public.settings_elevenlabs
  AS PERMISSIVE FOR UPDATE
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "settings_omni_new_contact_select" ON public.settings_omni_new_contact
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "settings_omni_new_contact_write" ON public.settings_omni_new_contact
  AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM settings_users
  WHERE settings_users.auth_user_id = auth.uid() AND (settings_users.super_admin = true OR settings_users.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND settings_users.active = true AND settings_users.deleted_at IS NULL)));
CREATE POLICY "users_delete_own_schedules" ON public.settings_schedules
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (user_id = get_current_settings_user_id() OR is_admin_or_manager());
CREATE POLICY "users_insert_schedules" ON public.settings_schedules
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (user_id = get_current_settings_user_id() OR is_admin_or_manager());
CREATE POLICY "users_read_own_schedules" ON public.settings_schedules
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (user_id = get_current_settings_user_id() OR is_admin_or_manager());
CREATE POLICY "users_update_own_schedules" ON public.settings_schedules
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (user_id = get_current_settings_user_id() OR is_admin_or_manager())
  WITH CHECK (user_id = get_current_settings_user_id() OR is_admin_or_manager());
CREATE POLICY "authenticated_read" ON public.settings_system_modules
  AS PERMISSIVE FOR SELECT
  USING (true);
CREATE POLICY "authenticated_write" ON public.settings_system_modules
  AS PERMISSIVE FOR ALL
  USING (true)
  WITH CHECK (true);
CREATE POLICY "authenticated_read" ON public.settings_teams
  AS PERMISSIVE FOR SELECT
  USING (true);
CREATE POLICY "authenticated_write" ON public.settings_teams
  AS PERMISSIVE FOR ALL
  USING (true)
  WITH CHECK (true);
CREATE POLICY "users_delete_policy" ON public.settings_users
  AS PERMISSIVE FOR DELETE
  USING (is_admin_or_manager());
CREATE POLICY "users_insert_policy" ON public.settings_users
  AS PERMISSIVE FOR INSERT
  WITH CHECK (auth.uid() = auth_user_id OR is_admin_or_manager());
CREATE POLICY "users_select_all_authenticated" ON public.settings_users
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "users_update_policy" ON public.settings_users
  AS PERMISSIVE FOR UPDATE
  USING (auth.uid() = auth_user_id OR is_admin_or_manager())
  WITH CHECK (auth.uid() = auth_user_id OR is_admin_or_manager());
CREATE POLICY "authenticated_read" ON public.settings_users_teams
  AS PERMISSIVE FOR SELECT
  USING (true);
CREATE POLICY "authenticated_write" ON public.settings_users_teams
  AS PERMISSIVE FOR ALL
  USING (true)
  WITH CHECK (true);
CREATE POLICY "wa_channels_admin_all" ON public.settings_whatsapp_channels
  AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin_or_manager())
  WITH CHECK (is_admin_or_manager());
CREATE POLICY "calendar_connection_self" ON public.user_calendar_connections
  AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM settings_users su
  WHERE su.auth_user_id = auth.uid() AND (su.id = user_calendar_connections.user_id OR su.super_admin = true OR su.user_type = ANY (ARRAY['admin'::text, 'manager'::text])) AND su.active = true)));
CREATE POLICY "admins_read_webhook_logs" ON public.webhook_logs
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_admin_or_manager());
CREATE POLICY "admins_write_webhook_logs" ON public.webhook_logs
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_manager());
CREATE POLICY "authenticated_read" ON public.webhooks
  AS PERMISSIVE FOR SELECT
  USING (true);
CREATE POLICY "authenticated_write" ON public.webhooks
  AS PERMISSIVE FOR ALL
  USING (true)
  WITH CHECK (true);
CREATE POLICY "authenticated_read" ON public.whatsapp_templates
  AS PERMISSIVE FOR SELECT
  USING (true);
CREATE POLICY "authenticated_write" ON public.whatsapp_templates
  AS PERMISSIVE FOR ALL
  USING (true)
  WITH CHECK (true);
CREATE POLICY "Admins can delete logos" ON storage.objects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (bucket_id = 'logos'::text AND (is_admin_or_manager() OR (storage.foldername(name))[1] = 'leads'::text AND (EXISTS ( SELECT 1
   FROM leads l
  WHERE l.id::text = (storage.foldername(objects.name))[2] AND (l.user_id = get_current_settings_user_id() OR (l.teams_id IN ( SELECT settings_users_teams.team_id
           FROM settings_users_teams
          WHERE settings_users_teams.user_id = get_current_settings_user_id())) OR is_admin_or_manager())))));
CREATE POLICY "Admins can update logos" ON storage.objects
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (bucket_id = 'logos'::text AND is_admin_or_manager())
  WITH CHECK (bucket_id = 'logos'::text AND is_admin_or_manager());
CREATE POLICY "Admins can upload logos" ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos'::text AND (is_admin_or_manager() OR (storage.foldername(name))[1] = 'leads'::text AND (EXISTS ( SELECT 1
   FROM leads l
  WHERE l.id::text = (storage.foldername(objects.name))[2] AND (l.user_id = get_current_settings_user_id() OR (l.teams_id IN ( SELECT settings_users_teams.team_id
           FROM settings_users_teams
          WHERE settings_users_teams.user_id = get_current_settings_user_id())) OR is_admin_or_manager())))));
CREATE POLICY "Authenticated users can delete team images" ON storage.objects
  AS PERMISSIVE FOR DELETE
  USING (bucket_id = 'team-images'::text AND auth.role() = 'authenticated'::text);
CREATE POLICY "Authenticated users can update team images" ON storage.objects
  AS PERMISSIVE FOR UPDATE
  USING (bucket_id = 'team-images'::text AND auth.role() = 'authenticated'::text);
CREATE POLICY "Authenticated users can upload task attachments" ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-attachments'::text);
CREATE POLICY "Authenticated users can upload team images" ON storage.objects
  AS PERMISSIVE FOR INSERT
  WITH CHECK (bucket_id = 'team-images'::text AND auth.role() = 'authenticated'::text);
CREATE POLICY "Permitir atualização de imagens dos cases para usuários aute" ON storage.objects
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (bucket_id = 'cases-images'::text);
CREATE POLICY "Permitir atualização de imagens para usuários autenticados" ON storage.objects
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (bucket_id = 'noticias-images'::text);
CREATE POLICY "Permitir exclusão de imagens dos cases para usuários autentic" ON storage.objects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (bucket_id = 'cases-images'::text);
CREATE POLICY "Permitir exclusão de imagens para usuários autenticados" ON storage.objects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (bucket_id = 'noticias-images'::text);
CREATE POLICY "Permitir upload de imagens dos cases para usuários autenticado" ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cases-images'::text);
CREATE POLICY "Permitir upload de imagens para usuários autenticados" ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'noticias-images'::text);
CREATE POLICY "Permitir visualização pública das imagens" ON storage.objects
  AS PERMISSIVE FOR SELECT
  USING (bucket_id = 'noticias-images'::text);
CREATE POLICY "Permitir visualização pública das imagens dos cases" ON storage.objects
  AS PERMISSIVE FOR SELECT
  USING (bucket_id = 'cases-images'::text);
CREATE POLICY "Public can view task attachments" ON storage.objects
  AS PERMISSIVE FOR SELECT
  USING (bucket_id = 'task-attachments'::text);
CREATE POLICY "Public read access for logos" ON storage.objects
  AS PERMISSIVE FOR SELECT
  USING (bucket_id = 'logos'::text);
CREATE POLICY "Team images are publicly accessible" ON storage.objects
  AS PERMISSIVE FOR SELECT
  USING (bucket_id = 'team-images'::text);
CREATE POLICY "User avatars are publicly accessible" ON storage.objects
  AS PERMISSIVE FOR SELECT
  USING (bucket_id = 'user-avatars'::text);
CREATE POLICY "Users can delete their own avatar" ON storage.objects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (bucket_id = 'user-avatars'::text AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete their own task attachments" ON storage.objects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (bucket_id = 'task-attachments'::text AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update their own avatar" ON storage.objects
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (bucket_id = 'user-avatars'::text AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can upload their own avatar" ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'user-avatars'::text AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "logos_public_read" ON storage.objects
  AS PERMISSIVE FOR SELECT
  USING (bucket_id = 'logos'::text);
CREATE POLICY "logos_update_authenticated" ON storage.objects
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (bucket_id = 'logos'::text);
CREATE POLICY "logos_upload_authenticated" ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos'::text);
CREATE POLICY "lp_assets_auth_delete" ON storage.objects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (bucket_id = 'lp-assets'::text);
CREATE POLICY "lp_assets_auth_upload" ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lp-assets'::text);
CREATE POLICY "lp_assets_delete" ON storage.objects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (bucket_id = 'lp-assets'::text);
CREATE POLICY "lp_assets_public_read" ON storage.objects
  AS PERMISSIVE FOR SELECT
  USING (bucket_id = 'lp-assets'::text);
CREATE POLICY "lp_assets_select_public" ON storage.objects
  AS PERMISSIVE FOR SELECT
  USING (bucket_id = 'lp-assets'::text);
CREATE POLICY "lp_assets_update" ON storage.objects
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (bucket_id = 'lp-assets'::text);
CREATE POLICY "lp_assets_upload" ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lp-assets'::text);
CREATE POLICY "omni_media_authenticated_upload" ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'omni-media'::text);
CREATE POLICY "omni_media_owner_delete" ON storage.objects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (bucket_id = 'omni-media'::text);
CREATE POLICY "omni_media_public_read" ON storage.objects
  AS PERMISSIVE FOR SELECT
  USING (bucket_id = 'omni-media'::text);

-- ============================================================
-- GRANTS
-- ============================================================
GRANT SELECT ON extensions.pg_stat_statements TO PUBLIC;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON extensions.pg_stat_statements TO dashboard_user;
GRANT SELECT ON extensions.pg_stat_statements_info TO PUBLIC;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON extensions.pg_stat_statements_info TO dashboard_user;