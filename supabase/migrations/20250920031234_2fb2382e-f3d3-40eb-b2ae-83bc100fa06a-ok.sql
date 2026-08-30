-- =============================================================================
-- MIGRAÇÃO COMPLETA CRM SYSTEM - TODAS AS TABELAS
-- =============================================================================

-- Instalar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- =============================================================================
-- CRIAÇÃO DE ENUMS PERSONALIZADOS
-- =============================================================================

CREATE TYPE entidade_campo AS ENUM ('pessoa', 'empresa', 'negocio');
CREATE TYPE tipo_campo AS ENUM ('texto', 'numero', 'data', 'select');
CREATE TYPE tipo_time AS ENUM ('vendas', 'suporte', 'marketing', 'financeiro');

-- =============================================================================
-- SEQUENCES PARA IDs SERIAIS
-- =============================================================================

CREATE SEQUENCE IF NOT EXISTS messages_id_seq;
CREATE SEQUENCE IF NOT EXISTS n8n_chat_histories_id_seq;

-- =============================================================================
-- TABELA BASE - TENANTS (MULTI-TENANCY)
-- =============================================================================

CREATE TABLE public.crm_tenants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  value text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  modulos_ativos jsonb DEFAULT '{"visitas": false, "reservas": false, "reunioes": false, "campanhas": false}'::jsonb,
  webhook_conversas text CHECK (webhook_conversas IS NULL OR webhook_conversas ~ '^https?://[^\s/$.?#].[^\s]*$'::text),
  disc_config jsonb DEFAULT '{"model": "gpt-4o-mini", "api_key": null, "enabled": false, "temperature": 0.7}'::jsonb,
  resumo_config jsonb DEFAULT '{"model": "gpt-4o-mini", "api_key": null, "enabled": false, "temperature": 0.7}'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  logo_url text,
  CONSTRAINT crm_tenants_pkey PRIMARY KEY (id)
);

-- =============================================================================
-- TABELAS DE AGÊNCIAS E USUÁRIOS
-- =============================================================================

CREATE TABLE public.crm_agencias (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT crm_agencias_pkey PRIMARY KEY (id),
  CONSTRAINT crm_agencias_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT crm_agencias_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);

CREATE TABLE public.crm_usuarios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  tenant_id uuid,
  super_adm boolean DEFAULT false,
  deleted_at timestamp with time zone,
  deleted_by uuid,
  whatsapp text,
  gestor boolean NOT NULL DEFAULT false,
  auth_user_id uuid,
  agencia_id uuid,
  CONSTRAINT crm_usuarios_pkey PRIMARY KEY (id),
  CONSTRAINT crm_usuarios_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id),
  CONSTRAINT crm_usuarios_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id),
  CONSTRAINT crm_usuarios_agencia_id_fkey FOREIGN KEY (agencia_id) REFERENCES public.crm_agencias(id)
);

-- Relacionamentos agência-tenant e agência-usuário
CREATE TABLE public.crm_agencia_tenants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agencia_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT crm_agencia_tenants_pkey PRIMARY KEY (id),
  CONSTRAINT fk_agencia_tenants_agencia FOREIGN KEY (agencia_id) REFERENCES public.crm_agencias(id),
  CONSTRAINT fk_agencia_tenants_tenant FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id)
);

CREATE TABLE public.crm_agencia_usuarios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agencia_id uuid NOT NULL,
  usuario_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT crm_agencia_usuarios_pkey PRIMARY KEY (id),
  CONSTRAINT fk_agencia_usuarios_agencia FOREIGN KEY (agencia_id) REFERENCES public.crm_agencias(id),
  CONSTRAINT fk_agencia_usuarios_usuario FOREIGN KEY (usuario_id) REFERENCES public.crm_usuarios(id)
);

-- =============================================================================
-- PIPELINES E STAGES
-- =============================================================================

CREATE TABLE public.crm_pipelines (
  nome text NOT NULL,
  descricao text,
  ativo boolean DEFAULT true,
  tenant_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  CONSTRAINT crm_pipelines_pkey PRIMARY KEY (id),
  CONSTRAINT crm_pipelines_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id)
);

CREATE TABLE public.crm_stages (
  nome text NOT NULL,
  ordem integer NOT NULL,
  cor text DEFAULT '#3B82F6'::text,
  ativo boolean DEFAULT true,
  tenant_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL,
  CONSTRAINT crm_stages_pkey PRIMARY KEY (id),
  CONSTRAINT crm_stages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id),
  CONSTRAINT crm_stages_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.crm_pipelines(id)
);

-- =============================================================================
-- PESSOAS E EMPRESAS
-- =============================================================================

CREATE TABLE public.crm_pessoas (
  nome text NOT NULL,
  email text,
  documento text,
  origem text DEFAULT 'manual'::text,
  status text DEFAULT 'ativo'::text,
  observacoes text,
  tenant_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  whatsapp text,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  aceita_ligacao boolean DEFAULT true,
  score integer,
  renda text,
  momento text,
  objetivo text,
  whatsapp_remote_id text,
  disc text,
  status_atendimento text DEFAULT 'aberto'::text CHECK ((status_atendimento = ANY (ARRAY['aberto'::text, 'encerrado'::text])) OR status_atendimento IS NULL),
  atendimento_ia boolean DEFAULT true,
  resumo_conversa text,
  contador_mensagens_resumo integer DEFAULT 0,
  disc_resumo text,
  tipo text,
  pessoas_info_json jsonb,
  external_crm_person_id text,
  CONSTRAINT crm_pessoas_pkey PRIMARY KEY (id),
  CONSTRAINT crm_pessoas_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id)
);

CREATE TABLE public.crm_empresas (
  nome_fantasia text NOT NULL,
  razao_social text,
  cnpj text,
  telefone text,
  email text,
  site text,
  observacoes text,
  tenant_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  status text DEFAULT 'ativo'::text CHECK (status = ANY (ARRAY['ativo'::text, 'arquivado'::text])),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  empresas_info_json jsonb,
  CONSTRAINT crm_empresas_pkey PRIMARY KEY (id),
  CONSTRAINT crm_empresas_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id)
);

-- Relacionamento pessoa-empresa
CREATE TABLE public.crm_pessoa_empresas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pessoa_id uuid NOT NULL,
  empresa_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT crm_pessoa_empresas_pkey PRIMARY KEY (id),
  CONSTRAINT crm_pessoa_empresas_pessoa_id_fkey FOREIGN KEY (pessoa_id) REFERENCES public.crm_pessoas(id),
  CONSTRAINT crm_pessoa_empresas_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.crm_empresas(id),
  CONSTRAINT crm_pessoa_empresas_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id)
);

-- =============================================================================
-- MOTIVOS DE PERDA
-- =============================================================================

CREATE TABLE public.crm_motivo_perda (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tenant_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT crm_motivo_perda_pkey PRIMARY KEY (id),
  CONSTRAINT fk_motivo_perda_tenant FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id)
);

-- =============================================================================
-- LEADS (NEGÓCIOS)
-- =============================================================================

CREATE TABLE public.crm_leads (
  valor numeric,
  status text DEFAULT 'em-andamento'::text,
  responsavel uuid,
  data_criacao timestamp with time zone DEFAULT now(),
  data_ultima_interacao timestamp with time zone,
  ultima_interacao text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  gclid text,
  fbclid text,
  status_followup text,
  tentativas_followup integer DEFAULT 0,
  bloqueia_ia boolean DEFAULT false,
  tenant_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL,
  empresa_id uuid,
  pipeline_id uuid NOT NULL,
  stage_id uuid NOT NULL,
  datetime_bloqueia_ia timestamp with time zone,
  time_responsavel uuid,
  motivo_perda text,
  motivo_perda_id uuid,
  controle text,
  titulo text,
  data_ganho timestamp with time zone,
  leads_info_json jsonb,
  external_crm_lead_id text,
  CONSTRAINT crm_leads_pkey PRIMARY KEY (id),
  CONSTRAINT crm_leads_responsavel_fkey FOREIGN KEY (responsavel) REFERENCES public.crm_usuarios(id),
  CONSTRAINT crm_leads_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id),
  CONSTRAINT crm_leads_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.crm_pessoas(id),
  CONSTRAINT crm_leads_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.crm_empresas(id),
  CONSTRAINT crm_leads_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.crm_pipelines(id),
  CONSTRAINT crm_leads_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.crm_stages(id),
  CONSTRAINT fk_leads_motivo_perda FOREIGN KEY (motivo_perda_id) REFERENCES public.crm_motivo_perda(id)
);

-- =============================================================================
-- MENSAGENS E CONVERSAS
-- =============================================================================

CREATE TABLE public.crm_messages (
  id integer NOT NULL DEFAULT nextval('messages_id_seq'::regclass),
  from_message text NOT NULL CHECK (from_message = ANY (ARRAY['agente_ia'::text, 'follow_up'::text, 'humano'::text, 'cliente'::text])),
  message text NOT NULL,
  llm text,
  tokens_qty integer,
  usuario_id uuid,
  tenant_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  tipo_mensagem text DEFAULT 'texto'::text CHECK (tipo_mensagem = ANY (ARRAY['texto'::text, 'audio'::text, 'chamada'::text])),
  audio_url text,
  transcricao text,
  duracao_audio integer,
  lead_id uuid NOT NULL,
  pessoa_id uuid,
  followup_id uuid,
  canal text DEFAULT 'whatsapp'::text,
  conversas_info_json jsonb,
  CONSTRAINT crm_messages_pkey PRIMARY KEY (id),
  CONSTRAINT crm_messages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id),
  CONSTRAINT crm_messages_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.crm_usuarios(id),
  CONSTRAINT crm_messages_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.crm_leads(id),
  CONSTRAINT fk_crm_messages_pessoa_id FOREIGN KEY (pessoa_id) REFERENCES public.crm_pessoas(id)
);

-- =============================================================================
-- AGENDAMENTOS
-- =============================================================================

CREATE TABLE public.crm_agendamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  data date NOT NULL,
  hora_inicio time without time zone NOT NULL,
  hora_fim time without time zone NOT NULL,
  origem text DEFAULT 'manual'::text,
  status text DEFAULT 'agendado'::text,
  observacoes text,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  usuario_id uuid,
  id_calendar text,
  negocio_id uuid NOT NULL,
  google_meet_link text,
  convidados text[],
  quantidade bigint,
  local text,
  CONSTRAINT crm_agendamentos_pkey PRIMARY KEY (id),
  CONSTRAINT fk_agendamentos_tenant FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id),
  CONSTRAINT fk_agendamentos_usuario FOREIGN KEY (usuario_id) REFERENCES public.crm_usuarios(id),
  CONSTRAINT fk_agendamentos_negocio FOREIGN KEY (negocio_id) REFERENCES public.crm_leads(id)
);

-- =============================================================================
-- SISTEMA DE CAMPANHAS
-- =============================================================================

CREATE TABLE public.crm_campanhas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  nome text NOT NULL,
  canal text NOT NULL CHECK (canal = ANY (ARRAY['WhatsApp'::text, 'E-mail'::text])),
  mensagem text NOT NULL,
  tempo_espera_envios text NOT NULL DEFAULT '5_min'::text CHECK (tempo_espera_envios = ANY (ARRAY['1_min'::text, '5_min'::text, '10_min'::text, '30_min'::text, '1_hora'::text])),
  intervalo_inicio time without time zone NOT NULL DEFAULT '09:00:00'::time without time zone,
  intervalo_fim time without time zone NOT NULL DEFAULT '18:00:00'::time without time zone,
  pipeline_id uuid,
  etapa_id uuid,
  status text NOT NULL DEFAULT 'rascunho'::text CHECK (status = ANY (ARRAY['rascunho'::text, 'ativa'::text, 'pausada'::text, 'concluida'::text])),
  criada_em timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT crm_campanhas_pkey PRIMARY KEY (id),
  CONSTRAINT campanhas_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id),
  CONSTRAINT campanhas_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.crm_pipelines(id),
  CONSTRAINT campanhas_etapa_id_fkey FOREIGN KEY (etapa_id) REFERENCES public.crm_stages(id)
);

CREATE TABLE public.crm_campanha_contatos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campanha_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  nome text NOT NULL,
  telefone text,
  email text,
  status_envio text NOT NULL DEFAULT 'pendente'::text CHECK (status_envio = ANY (ARRAY['pendente'::text, 'enviado'::text, 'erro'::text])),
  resposta text,
  enviado_em timestamp with time zone,
  lead_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT crm_campanha_contatos_pkey PRIMARY KEY (id),
  CONSTRAINT campanha_contatos_campanha_id_fkey FOREIGN KEY (campanha_id) REFERENCES public.crm_campanhas(id),
  CONSTRAINT campanha_contatos_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id),
  CONSTRAINT campanha_contatos_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.crm_leads(id)
);

-- =============================================================================
-- BASE DE CONHECIMENTO
-- =============================================================================

CREATE TABLE public.crm_basesconhecimento (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  titulo text NOT NULL,
  descricao text,
  conteudo_original text NOT NULL,
  origem text DEFAULT 'upload_manual'::text CHECK (origem = ANY (ARRAY['upload_manual'::text, 'editado_manual'::text])),
  arquivo_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT crm_basesconhecimento_pkey PRIMARY KEY (id),
  CONSTRAINT crm_basesconhecimento_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id)
);

CREATE TABLE public.crm_basesconhecimento_chunks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  base_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  content text NOT NULL,
  ordem_chunk integer NOT NULL,
  embedding vector,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT crm_basesconhecimento_chunks_pkey PRIMARY KEY (id),
  CONSTRAINT crm_basesconhecimento_chunks_base_id_fkey FOREIGN KEY (base_id) REFERENCES public.crm_basesconhecimento(id),
  CONSTRAINT crm_basesconhecimento_chunks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id)
);

-- =============================================================================
-- SISTEMA DE IA
-- =============================================================================

CREATE TABLE public.crm_agentes_ia (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  dados_entrada text,
  identidade text,
  regras_gerais text,
  prompt_base text,
  usa_etapas boolean NOT NULL DEFAULT false,
  versao_atual integer NOT NULL DEFAULT 1,
  tenant_id uuid NOT NULL,
  created_by uuid,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  pipeline_id uuid,
  CONSTRAINT crm_agentes_ia_pkey PRIMARY KEY (id)
);

CREATE TABLE public.crm_agentes_ia_etapas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agente_ia_id uuid NOT NULL,
  nome_etapa text NOT NULL,
  prompt_etapa text NOT NULL,
  ordem integer NOT NULL,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  pipeline_id uuid,
  stage_id uuid,
  controle text,
  CONSTRAINT crm_agentes_ia_etapas_pkey PRIMARY KEY (id),
  CONSTRAINT crm_agentes_ia_etapas_agente_ia_id_fkey FOREIGN KEY (agente_ia_id) REFERENCES public.crm_agentes_ia(id)
);

CREATE TABLE public.crm_agentes_ia_historico (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agente_ia_id uuid NOT NULL,
  versao integer NOT NULL,
  dados_entrada text,
  identidade text,
  regras_gerais text,
  prompt_base text,
  usa_etapas boolean NOT NULL DEFAULT false,
  changelog text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT crm_agentes_ia_historico_pkey PRIMARY KEY (id),
  CONSTRAINT crm_agentes_ia_historico_agente_ia_id_fkey FOREIGN KEY (agente_ia_id) REFERENCES public.crm_agentes_ia(id)
);

CREATE TABLE public.crm_agentes_ia_etapas_historico (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agente_ia_id uuid NOT NULL,
  versao integer NOT NULL,
  nome_etapa text NOT NULL,
  prompt_etapa text NOT NULL,
  ordem integer NOT NULL,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT crm_agentes_ia_etapas_historico_pkey PRIMARY KEY (id),
  CONSTRAINT crm_agentes_ia_etapas_historico_agente_ia_id_fkey FOREIGN KEY (agente_ia_id) REFERENCES public.crm_agentes_ia(id)
);

-- =============================================================================
-- SISTEMA DE LLM
-- =============================================================================

CREATE TABLE public.crm_llm_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider = ANY (ARRAY['openai'::text, 'anthropic'::text])),
  api_key text NOT NULL,
  model_default text NOT NULL,
  temperature numeric DEFAULT 0.7 CHECK (temperature >= 0::numeric AND temperature <= 2::numeric),
  max_tokens integer,
  ativo boolean NOT NULL DEFAULT true,
  config_adicional jsonb DEFAULT '{}'::jsonb,
  status_conexao text DEFAULT 'não_testado'::text CHECK (status_conexao = ANY (ARRAY['ativo'::text, 'erro'::text, 'não_testado'::text])),
  ultimo_teste timestamp with time zone,
  mensagem_erro text,
  tenant_id uuid NOT NULL,
  created_by uuid,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT crm_llm_connections_pkey PRIMARY KEY (id),
  CONSTRAINT crm_llm_connections_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id),
  CONSTRAINT crm_llm_connections_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.crm_usuarios(id),
  CONSTRAINT crm_llm_connections_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.crm_usuarios(id)
);

CREATE TABLE public.crm_llm_usage_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  connection_id uuid,
  provider text NOT NULL,
  model text NOT NULL,
  tokens_input integer,
  tokens_output integer,
  tokens_total integer DEFAULT (COALESCE(tokens_input, 0) + COALESCE(tokens_output, 0)),
  custo_estimado numeric,
  funcionalidade text NOT NULL,
  prompt_preview text,
  tempo_resposta integer,
  sucesso boolean NOT NULL,
  erro text,
  tenant_id uuid NOT NULL,
  usuario_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT crm_llm_usage_logs_pkey PRIMARY KEY (id),
  CONSTRAINT crm_llm_usage_logs_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.crm_llm_connections(id),
  CONSTRAINT crm_llm_usage_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id),
  CONSTRAINT crm_llm_usage_logs_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.crm_usuarios(id)
);

-- =============================================================================
-- CAMPOS PERSONALIZADOS
-- =============================================================================

CREATE TABLE public.crm_campos_personalizados (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  entidade entidade_campo NOT NULL,
  nome_exibicao text NOT NULL,
  tipo_campo tipo_campo NOT NULL,
  opcoes jsonb DEFAULT '[]'::jsonb,
  obrigatorio boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT crm_campos_personalizados_pkey PRIMARY KEY (id),
  CONSTRAINT crm_campos_personalizados_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id)
);

-- =============================================================================
-- SISTEMA DE TIMES E HORÁRIOS
-- =============================================================================

CREATE TABLE public.crm_times (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  prioridade integer NOT NULL DEFAULT 1,
  tipo tipo_time NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  tenant_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  descricao text,
  CONSTRAINT crm_times_pkey PRIMARY KEY (id)
);

CREATE TABLE public.crm_usuario_times (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  time_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT crm_usuario_times_pkey PRIMARY KEY (id)
);

CREATE TABLE public.crm_horarios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  usuario_id uuid NOT NULL,
  dia_semana integer NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
  hora_inicio time without time zone NOT NULL,
  hora_fim time without time zone NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT crm_horarios_pkey PRIMARY KEY (id),
  CONSTRAINT fk_horarios_tenant FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id),
  CONSTRAINT fk_horarios_usuario FOREIGN KEY (usuario_id) REFERENCES public.crm_usuarios(id)
);

-- =============================================================================
-- SISTEMA DE FOLLOWUPS
-- =============================================================================

CREATE TABLE public.crm_stage_followups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  stage_id uuid NOT NULL,
  dias integer NOT NULL DEFAULT 0,
  horas integer NOT NULL DEFAULT 0,
  mensagem text,
  tipo text NOT NULL DEFAULT 'texto'::text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  assunto text,
  arquivo_audio text,
  minutos integer NOT NULL DEFAULT 0,
  template_id text,
  CONSTRAINT crm_stage_followups_pkey PRIMARY KEY (id),
  CONSTRAINT crm_stage_followups_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id),
  CONSTRAINT crm_stage_followups_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.crm_stages(id)
);

CREATE TABLE public.crm_agendamentos_followups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  status_agendamento text NOT NULL,
  dias integer NOT NULL DEFAULT 0,
  horas integer NOT NULL DEFAULT 0,
  minutos integer NOT NULL DEFAULT 0,
  mensagem text,
  tipo text NOT NULL DEFAULT 'texto'::text,
  ativo boolean NOT NULL DEFAULT true,
  assunto text,
  arquivo_audio text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  template_id text,
  CONSTRAINT crm_agendamentos_followups_pkey PRIMARY KEY (id)
);

-- =============================================================================
-- ARQUIVOS E NOTAS DOS NEGÓCIOS
-- =============================================================================

CREATE TABLE public.crm_negocio_arquivos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome_arquivo text NOT NULL,
  tamanho_arquivo bigint,
  tipo_arquivo text,
  url_arquivo text NOT NULL,
  tenant_id uuid NOT NULL,
  usuario_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  negocio_id uuid NOT NULL,
  CONSTRAINT crm_negocio_arquivos_pkey PRIMARY KEY (id),
  CONSTRAINT crm_negocio_arquivos_negocio_id_fkey FOREIGN KEY (negocio_id) REFERENCES public.crm_leads(id),
  CONSTRAINT crm_negocio_arquivos_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id),
  CONSTRAINT crm_negocio_arquivos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.crm_usuarios(id)
);

CREATE TABLE public.crm_negocio_notas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  conteudo text,
  tenant_id uuid NOT NULL,
  usuario_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  negocio_id uuid NOT NULL,
  CONSTRAINT crm_negocio_notas_pkey PRIMARY KEY (id),
  CONSTRAINT crm_negocio_notas_negocio_id_fkey FOREIGN KEY (negocio_id) REFERENCES public.crm_leads(id),
  CONSTRAINT crm_negocio_notas_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.crm_tenants(id),
  CONSTRAINT crm_negocio_notas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.crm_usuarios(id)
);

-- =============================================================================
-- CONEXÕES COM BANCO DE DADOS
-- =============================================================================

CREATE TABLE public.crm_database_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  nome_conexao text NOT NULL,
  supabase_url text NOT NULL CHECK (supabase_url ~ '^https://[a-z0-9]+\.supabase\.co$'::text),
  supabase_anon_key text NOT NULL,
  status_conexao text NOT NULL DEFAULT 'não_testado'::text CHECK (status_conexao = ANY (ARRAY['ativo'::text, 'conectado'::text, 'erro'::text, 'não_testado'::text])),
  ultimo_teste timestamp with time zone,
  mensagem_erro text,
  metadados jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT crm_database_connections_pkey PRIMARY KEY (id)
);

-- =============================================================================
-- AUDITORIA E SEGURANÇA
-- =============================================================================

CREATE TABLE public.crm_security_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  details jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT crm_security_audit_log_pkey PRIMARY KEY (id)
);

-- =============================================================================
-- TABELAS AUXILIARES E DE CONTROLE
-- =============================================================================

CREATE TABLE public.msg_buffer (
  id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  msg text,
  whatsapp text,
  tenant_id text,
  CONSTRAINT msg_buffer_pkey PRIMARY KEY (id)
);

CREATE TABLE public.n8n_chat_histories (
  id integer NOT NULL DEFAULT nextval('n8n_chat_histories_id_seq'::regclass),
  session_id character varying NOT NULL,
  message jsonb NOT NULL,
  CONSTRAINT n8n_chat_histories_pkey PRIMARY KEY (id)
);

CREATE TABLE public.sistema_buffer_agente (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  sessionId text,
  content json,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sistema_buffer_agente_pkey PRIMARY KEY (id)
);

CREATE TABLE public.sistema_controle_agendamentos (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  usuario_id text NOT NULL,
  cliente_id text NOT NULL,
  dia date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  hora_inicio time without time zone NOT NULL,
  CONSTRAINT sistema_controle_agendamentos_pkey PRIMARY KEY (id)
);

-- =============================================================================
-- ÍNDICES PARA PERFORMANCE
-- =============================================================================

-- Índices para queries frequentes
CREATE INDEX idx_crm_pessoas_tenant_id ON public.crm_pessoas(tenant_id);
CREATE INDEX idx_crm_empresas_tenant_id ON public.crm_empresas(tenant_id);
CREATE INDEX idx_crm_leads_tenant_id ON public.crm_leads(tenant_id);
CREATE INDEX idx_crm_leads_person_id ON public.crm_leads(person_id);
CREATE INDEX idx_crm_leads_stage_id ON public.crm_leads(stage_id);
CREATE INDEX idx_crm_messages_tenant_id ON public.crm_messages(tenant_id);
CREATE INDEX idx_crm_messages_lead_id ON public.crm_messages(lead_id);
CREATE INDEX idx_crm_agendamentos_tenant_id ON public.crm_agendamentos(tenant_id);
CREATE INDEX idx_crm_usuarios_tenant_id ON public.crm_usuarios(tenant_id);
CREATE INDEX idx_crm_usuarios_email ON public.crm_usuarios(email);

-- Índices únicos para evitar duplicatas
CREATE UNIQUE INDEX idx_crm_pessoa_empresas_unique ON public.crm_pessoa_empresas(pessoa_id, empresa_id, tenant_id);
CREATE UNIQUE INDEX idx_crm_agencia_tenants_unique ON public.crm_agencia_tenants(agencia_id, tenant_id);
CREATE UNIQUE INDEX idx_crm_agencia_usuarios_unique ON public.crm_agencia_usuarios(agencia_id, usuario_id);
CREATE UNIQUE INDEX idx_crm_usuario_times_unique ON public.crm_usuario_times(usuario_id, time_id, tenant_id);

-- =============================================================================
-- ATIVAR ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Ativar RLS em todas as tabelas principais
ALTER TABLE public.crm_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_agencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_agencia_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_agencia_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_pessoas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_pessoa_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_campanha_contatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_basesconhecimento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_basesconhecimento_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_agentes_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_agentes_ia_etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_agentes_ia_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_agentes_ia_etapas_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_llm_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_llm_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_campos_personalizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_usuario_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_horarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_stage_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_agendamentos_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_negocio_arquivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_negocio_notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_motivo_perda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_database_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_security_audit_log ENABLE ROW LEVEL SECURITY;