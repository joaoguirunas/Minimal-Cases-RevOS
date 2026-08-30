
-- Remover as foreign keys existentes que dependem dos UUIDs
ALTER TABLE crm_leads DROP CONSTRAINT IF EXISTS crm_leads_person_id_fkey;
ALTER TABLE crm_leads DROP CONSTRAINT IF EXISTS crm_leads_empresa_id_fkey;
ALTER TABLE crm_leads DROP CONSTRAINT IF EXISTS crm_leads_pipeline_id_fkey;
ALTER TABLE crm_leads DROP CONSTRAINT IF EXISTS crm_leads_stage_id_fkey;
ALTER TABLE crm_messages DROP CONSTRAINT IF EXISTS crm_messages_lead_id_fkey;
ALTER TABLE crm_pessoas DROP CONSTRAINT IF EXISTS crm_pessoas_empresa_id_fkey;
ALTER TABLE crm_stages DROP CONSTRAINT IF EXISTS crm_stages_pipeline_id_fkey;

-- Criar mapeamentos UUID -> INTEGER para cada tabela
CREATE TEMP TABLE empresa_mapping AS 
SELECT id as old_id, ROW_NUMBER() OVER (ORDER BY created_at) as new_id FROM crm_empresas;

CREATE TEMP TABLE pessoa_mapping AS 
SELECT id as old_id, ROW_NUMBER() OVER (ORDER BY created_at) as new_id FROM crm_pessoas;

CREATE TEMP TABLE pipeline_mapping AS 
SELECT id as old_id, ROW_NUMBER() OVER (ORDER BY created_at) as new_id FROM crm_pipelines;

CREATE TEMP TABLE stage_mapping AS 
SELECT id as old_id, ROW_NUMBER() OVER (ORDER BY ordem) as new_id FROM crm_stages;

CREATE TEMP TABLE lead_mapping AS 
SELECT id as old_id, ROW_NUMBER() OVER (ORDER BY created_at) as new_id FROM crm_leads;

-- Backup dos dados
CREATE TEMP TABLE backup_empresas AS SELECT * FROM crm_empresas;
CREATE TEMP TABLE backup_pessoas AS SELECT * FROM crm_pessoas;
CREATE TEMP TABLE backup_pipelines AS SELECT * FROM crm_pipelines;
CREATE TEMP TABLE backup_stages AS SELECT * FROM crm_stages;
CREATE TEMP TABLE backup_leads AS SELECT * FROM crm_leads;
CREATE TEMP TABLE backup_messages AS SELECT * FROM crm_messages;

-- Limpar todas as tabelas
TRUNCATE crm_messages, crm_leads, crm_stages, crm_pipelines, crm_pessoas, crm_empresas RESTART IDENTITY CASCADE;

-- Recriar estrutura da tabela crm_empresas com ID incremental
ALTER TABLE crm_empresas DROP COLUMN id;
ALTER TABLE crm_empresas ADD COLUMN id SERIAL PRIMARY KEY;

-- Inserir empresas na nova estrutura
INSERT INTO crm_empresas (nome_fantasia, razao_social, cnpj, telefone, email, site, observacoes, tenant_id, created_at, updated_at)
SELECT b.nome_fantasia, b.razao_social, b.cnpj, b.telefone, b.email, b.site, b.observacoes, b.tenant_id, b.created_at, b.updated_at
FROM backup_empresas b
JOIN empresa_mapping em ON b.id = em.old_id
ORDER BY em.new_id;

-- Recriar estrutura da tabela crm_pessoas
ALTER TABLE crm_pessoas DROP COLUMN id;
ALTER TABLE crm_pessoas ADD COLUMN id SERIAL PRIMARY KEY;
ALTER TABLE crm_pessoas DROP COLUMN empresa_id;
ALTER TABLE crm_pessoas ADD COLUMN empresa_id INTEGER;

-- Inserir pessoas com empresa_id mapeado
INSERT INTO crm_pessoas (nome, email, telefone, documento, empresa_id, origem, status, observacoes, tenant_id, created_at, updated_at)
SELECT b.nome, b.email, b.telefone, b.documento,
       CASE WHEN b.empresa_id IS NOT NULL THEN 
         (SELECT em2.new_id FROM empresa_mapping em2 WHERE em2.old_id = b.empresa_id)
       ELSE NULL END,
       b.origem, b.status, b.observacoes, b.tenant_id, b.created_at, b.updated_at
FROM backup_pessoas b
JOIN pessoa_mapping pm ON b.id = pm.old_id
ORDER BY pm.new_id;

-- Recriar estrutura da tabela crm_pipelines
ALTER TABLE crm_pipelines DROP COLUMN id;
ALTER TABLE crm_pipelines ADD COLUMN id SERIAL PRIMARY KEY;

-- Inserir pipelines
INSERT INTO crm_pipelines (nome, descricao, ativo, tenant_id, created_at, updated_at)
SELECT b.nome, b.descricao, b.ativo, b.tenant_id, b.created_at, b.updated_at
FROM backup_pipelines b
JOIN pipeline_mapping pm ON b.id = pm.old_id
ORDER BY pm.new_id;

-- Recriar estrutura da tabela crm_stages
ALTER TABLE crm_stages DROP COLUMN id;
ALTER TABLE crm_stages ADD COLUMN id SERIAL PRIMARY KEY;
ALTER TABLE crm_stages DROP COLUMN pipeline_id;
ALTER TABLE crm_stages ADD COLUMN pipeline_id INTEGER NOT NULL;

-- Inserir stages com pipeline_id mapeado
INSERT INTO crm_stages (nome, cor, ordem, ativo, pipeline_id, tenant_id, created_at, updated_at)
SELECT b.nome, b.cor, b.ordem, b.ativo,
       (SELECT pm2.new_id FROM pipeline_mapping pm2 WHERE pm2.old_id = b.pipeline_id),
       b.tenant_id, b.created_at, b.updated_at
FROM backup_stages b
JOIN stage_mapping sm ON b.id = sm.old_id
ORDER BY sm.new_id;

-- Recriar estrutura da tabela crm_leads
ALTER TABLE crm_leads DROP COLUMN id;
ALTER TABLE crm_leads ADD COLUMN id SERIAL PRIMARY KEY;
ALTER TABLE crm_leads DROP COLUMN person_id;
ALTER TABLE crm_leads ADD COLUMN person_id INTEGER NOT NULL;
ALTER TABLE crm_leads DROP COLUMN empresa_id;
ALTER TABLE crm_leads ADD COLUMN empresa_id INTEGER;
ALTER TABLE crm_leads DROP COLUMN pipeline_id;
ALTER TABLE crm_leads ADD COLUMN pipeline_id INTEGER NOT NULL;
ALTER TABLE crm_leads DROP COLUMN stage_id;
ALTER TABLE crm_leads ADD COLUMN stage_id INTEGER NOT NULL;

-- Inserir leads com todas as referências mapeadas
INSERT INTO crm_leads (person_id, empresa_id, pipeline_id, stage_id, valor, status, responsavel, data_criacao, data_ultima_interacao, ultima_interacao, utm_source, utm_medium, utm_campaign, utm_term, utm_content, gclid, fbclid, status_followup, tentativas_followup, bloqueia_ia, tenant_id, created_at, updated_at)
SELECT 
  (SELECT pm2.new_id FROM pessoa_mapping pm2 WHERE pm2.old_id = b.person_id),
  CASE WHEN b.empresa_id IS NOT NULL THEN 
    (SELECT em2.new_id FROM empresa_mapping em2 WHERE em2.old_id = b.empresa_id)
  ELSE NULL END,
  (SELECT pm3.new_id FROM pipeline_mapping pm3 WHERE pm3.old_id = b.pipeline_id),
  (SELECT sm2.new_id FROM stage_mapping sm2 WHERE sm2.old_id = b.stage_id),
  b.valor, b.status, b.responsavel, b.data_criacao, b.data_ultima_interacao, b.ultima_interacao,
  b.utm_source, b.utm_medium, b.utm_campaign, b.utm_term, b.utm_content, b.gclid, b.fbclid,
  b.status_followup, b.tentativas_followup, b.bloqueia_ia, b.tenant_id, b.created_at, b.updated_at
FROM backup_leads b
JOIN lead_mapping lm ON b.id = lm.old_id
ORDER BY lm.new_id;

-- Recriar estrutura da tabela crm_messages
ALTER TABLE crm_messages DROP COLUMN lead_id;
ALTER TABLE crm_messages ADD COLUMN lead_id INTEGER NOT NULL;

-- Inserir mensagens com lead_id mapeado
INSERT INTO crm_messages (from_message, message, tipo_mensagem, audio_url, transcricao, duracao_audio, thread_id, llm, tokens_qty, lead_id, usuario_id, tenant_id, created_at, updated_at)
SELECT b.from_message, b.message, b.tipo_mensagem, b.audio_url, b.transcricao, b.duracao_audio, b.thread_id, b.llm, b.tokens_qty,
       (SELECT lm2.new_id FROM lead_mapping lm2 WHERE lm2.old_id = b.lead_id),
       b.usuario_id, b.tenant_id, b.created_at, b.updated_at
FROM backup_messages b
WHERE EXISTS (SELECT 1 FROM lead_mapping lm2 WHERE lm2.old_id = b.lead_id)
ORDER BY b.id;

-- Recriar as foreign keys
ALTER TABLE crm_pessoas ADD CONSTRAINT crm_pessoas_empresa_id_fkey 
FOREIGN KEY (empresa_id) REFERENCES crm_empresas(id) ON DELETE SET NULL;

ALTER TABLE crm_stages ADD CONSTRAINT crm_stages_pipeline_id_fkey 
FOREIGN KEY (pipeline_id) REFERENCES crm_pipelines(id) ON DELETE CASCADE;

ALTER TABLE crm_leads ADD CONSTRAINT crm_leads_person_id_fkey 
FOREIGN KEY (person_id) REFERENCES crm_pessoas(id) ON DELETE CASCADE;

ALTER TABLE crm_leads ADD CONSTRAINT crm_leads_empresa_id_fkey 
FOREIGN KEY (empresa_id) REFERENCES crm_empresas(id) ON DELETE SET NULL;

ALTER TABLE crm_leads ADD CONSTRAINT crm_leads_pipeline_id_fkey 
FOREIGN KEY (pipeline_id) REFERENCES crm_pipelines(id) ON DELETE CASCADE;

ALTER TABLE crm_leads ADD CONSTRAINT crm_leads_stage_id_fkey 
FOREIGN KEY (stage_id) REFERENCES crm_stages(id) ON DELETE RESTRICT;

ALTER TABLE crm_messages ADD CONSTRAINT crm_messages_lead_id_fkey 
FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE CASCADE;

-- Atualizar a constraint única
ALTER TABLE crm_leads ADD CONSTRAINT crm_leads_person_id_pipeline_id_key 
UNIQUE(person_id, pipeline_id);

-- Limpar tabelas temporárias
DROP TABLE empresa_mapping, pessoa_mapping, pipeline_mapping, stage_mapping, lead_mapping;
DROP TABLE backup_empresas, backup_pessoas, backup_pipelines, backup_stages, backup_leads, backup_messages;
