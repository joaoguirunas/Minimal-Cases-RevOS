-- Criar tabela sends (disparos)
CREATE TABLE sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'imported',
  whatsapp_template_id uuid REFERENCES whatsapp_templates(id),
  pipeline_id uuid REFERENCES leads_pipelines(id),
  stage_id uuid REFERENCES leads_stages(id),
  webhook_id uuid,
  status text NOT NULL DEFAULT 'draft',
  total_contacts integer DEFAULT 0,
  sent_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  send_interval_seconds integer DEFAULT 5,
  filter_config jsonb,
  scheduled_at timestamp with time zone,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_by uuid REFERENCES settings_users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT valid_type CHECK (type IN ('imported', 'filtered')),
  CONSTRAINT valid_status CHECK (status IN ('draft', 'scheduled', 'running', 'completed', 'paused')),
  CONSTRAINT valid_interval CHECK (send_interval_seconds IN (5, 10, 30, 60, 300, 600, 1800, 3600))
);

-- Criar tabela sends_webhooks
CREATE TABLE sends_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  webhook_url text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Adicionar FK de webhook agora que a tabela existe
ALTER TABLE sends ADD CONSTRAINT fk_sends_webhook 
  FOREIGN KEY (webhook_id) REFERENCES sends_webhooks(id);

-- Criar tabela sends_people
CREATE TABLE sends_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  send_id uuid NOT NULL REFERENCES sends(id) ON DELETE CASCADE,
  people_id uuid NOT NULL REFERENCES clients_people(id),
  lead_id uuid REFERENCES leads(id),
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  sent_at timestamp with time zone,
  delivered_at timestamp with time zone,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT valid_contact_status CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'invalid'))
);

-- Criar índices para sends
CREATE INDEX idx_sends_status ON sends(status);
CREATE INDEX idx_sends_created_at ON sends(created_at DESC);
CREATE INDEX idx_sends_pipeline ON sends(pipeline_id);
CREATE INDEX idx_sends_webhook ON sends(webhook_id);
CREATE INDEX idx_sends_created_by ON sends(created_by);

-- Criar índices para sends_people
CREATE INDEX idx_sends_people_send ON sends_people(send_id);
CREATE INDEX idx_sends_people_people ON sends_people(people_id);
CREATE INDEX idx_sends_people_status ON sends_people(status);
CREATE INDEX idx_sends_people_lead ON sends_people(lead_id);

-- Habilitar RLS
ALTER TABLE sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE sends_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE sends_webhooks ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
CREATE POLICY sends_access_policy ON sends FOR ALL USING (true);
CREATE POLICY sends_people_access_policy ON sends_people FOR ALL USING (true);
CREATE POLICY sends_webhooks_access_policy ON sends_webhooks FOR ALL USING (true);

-- Criar triggers para updated_at
CREATE TRIGGER update_sends_updated_at 
  BEFORE UPDATE ON sends 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sends_people_updated_at 
  BEFORE UPDATE ON sends_people 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sends_webhooks_updated_at 
  BEFORE UPDATE ON sends_webhooks 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Ativar módulo disparos
UPDATE settings_system_modules 
SET ativo = true 
WHERE module_key = 'disparos';