-- Inserir dados de exemplo para a tenant "Receita Previsível" (usando UUIDs válidos)

-- 1. Criar pipeline principal
WITH tenant_info AS (SELECT id as tenant_id FROM crm_tenants WHERE value = 'receita-previsivel')
INSERT INTO crm_pipelines (id, nome, descricao, tenant_id, ativo) 
SELECT gen_random_uuid(), 'Vendas Consultoria', 'Pipeline principal para vendas de consultoria', tenant_id, true
FROM tenant_info;

-- 2. Obter o ID do pipeline criado e criar etapas
WITH 
  tenant_info AS (SELECT id as tenant_id FROM crm_tenants WHERE value = 'receita-previsivel'),
  pipeline_info AS (SELECT id as pipeline_id FROM crm_pipelines WHERE nome = 'Vendas Consultoria' AND tenant_id IN (SELECT id FROM tenant_info))
INSERT INTO crm_stages (nome, pipeline_id, ordem, cor, tenant_id, ativo) 
SELECT nome, pipeline_id, ordem, cor, tenant_id, ativo FROM (VALUES
  ('Lead Qualificado', 1, '#3B82F6', true),
  ('Reunião Agendada', 2, '#F59E0B', true),
  ('Proposta Enviada', 3, '#8B5CF6', true),
  ('Negociação', 4, '#EF4444', true),
  ('Fechado Ganho', 5, '#10B981', true)
) AS stages_data(nome, ordem, cor, ativo)
CROSS JOIN tenant_info
CROSS JOIN pipeline_info;

-- 3. Criar motivos de perda
WITH tenant_info AS (SELECT id as tenant_id FROM crm_tenants WHERE value = 'receita-previsivel')
INSERT INTO crm_motivo_perda (nome, tenant_id) 
SELECT nome, tenant_id FROM (VALUES
  ('Preço Alto'),
  ('Não Era Decision Maker'),
  ('Timing Errado'),
  ('Escolheu Concorrente'),
  ('Não Respondeu')
) AS motivos_data(nome)
CROSS JOIN tenant_info;

-- 4. Criar empresas
WITH tenant_info AS (SELECT id as tenant_id FROM crm_tenants WHERE value = 'receita-previsivel')
INSERT INTO crm_empresas (nome_fantasia, razao_social, cnpj, telefone, email, site, tenant_id, status) 
SELECT nome_fantasia, razao_social, cnpj, telefone, email, site, tenant_id, status FROM (VALUES
  ('TechStart Inovação', 'TechStart Inovação Ltda', '12.345.678/0001-90', '(11) 98765-4321', 'contato@techstart.com.br', 'www.techstart.com.br', 'ativo'),
  ('Digital Solutions', 'Digital Solutions S.A.', '23.456.789/0001-01', '(11) 98765-4322', 'info@digitalsolutions.com.br', 'www.digitalsolutions.com.br', 'ativo'),
  ('Crescer Consultoria', 'Crescer Consultoria ME', '34.567.890/0001-12', '(11) 98765-4323', 'contato@crescer.com.br', 'www.crescer.com.br', 'ativo'),
  ('Inovar Marketing', 'Inovar Marketing Eireli', '45.678.901/0001-23', '(11) 98765-4324', 'vendas@inovar.com.br', 'www.inovar.com.br', 'ativo'),
  ('Expandir Negócios', 'Expandir Negócios Ltda', '56.789.012/0001-34', '(11) 98765-4325', 'comercial@expandir.com.br', 'www.expandir.com.br', 'ativo')
) AS empresas_data(nome_fantasia, razao_social, cnpj, telefone, email, site, status)
CROSS JOIN tenant_info;

-- 5. Criar pessoas (clientes)
WITH tenant_info AS (SELECT id as tenant_id FROM crm_tenants WHERE value = 'receita-previsivel')
INSERT INTO crm_pessoas (nome, email, whatsapp, documento, origem, score, tenant_id, status, objetivo, momento, renda) 
SELECT nome, email, whatsapp, documento, origem, score, tenant_id, status, objetivo, momento, renda FROM (VALUES
  ('João Silva Santos', 'joao@techstart.com.br', '11987654321', '123.456.789-00', 'site', 85, 'ativo', 'Aumentar vendas em 30%', 'Pronto para decidir', 'R$ 10.000 - R$ 20.000'),
  ('Maria Oliveira Costa', 'maria@digitalsolutions.com.br', '11987654322', '234.567.890-11', 'indicação', 90, 'ativo', 'Automatizar processos', 'Pesquisando soluções', 'R$ 20.000 - R$ 50.000'),
  ('Pedro Ferreira Lima', 'pedro@crescer.com.br', '11987654323', '345.678.901-22', 'google_ads', 75, 'ativo', 'Escalar equipe de vendas', 'Avaliando opções', 'R$ 5.000 - R$ 10.000'),
  ('Ana Carolina Rocha', 'ana@inovar.com.br', '11987654324', '456.789.012-33', 'facebook', 80, 'ativo', 'Melhorar ROI marketing', 'Urgente', 'R$ 15.000 - R$ 30.000'),
  ('Carlos Eduardo Alves', 'carlos@expandir.com.br', '11987654325', '567.890.123-44', 'linkedin', 70, 'ativo', 'Expandir para novos mercados', 'Planejando', 'R$ 25.000+')
) AS pessoas_data(nome, email, whatsapp, documento, origem, score, status, objetivo, momento, renda)
CROSS JOIN tenant_info;

-- 6. Associar pessoas às empresas
WITH 
  tenant_info AS (SELECT id as tenant_id FROM crm_tenants WHERE value = 'receita-previsivel'),
  pessoas_empresas AS (
    SELECT 
      p.id as pessoa_id, 
      e.id as empresa_id,
      ROW_NUMBER() OVER() as rn
    FROM crm_pessoas p
    JOIN crm_empresas e ON p.tenant_id = e.tenant_id
    WHERE p.tenant_id IN (SELECT id FROM tenant_info)
  )
INSERT INTO crm_pessoa_empresas (pessoa_id, empresa_id, tenant_id)
SELECT pe.pessoa_id, pe.empresa_id, t.tenant_id
FROM pessoas_empresas pe
CROSS JOIN tenant_info t
WHERE pe.rn <= 5;

-- 7. Criar negócios (leads) - relacionando com pipeline e stages existentes
WITH 
  tenant_info AS (SELECT id as tenant_id FROM crm_tenants WHERE value = 'receita-previsivel'),
  pipeline_info AS (SELECT id as pipeline_id FROM crm_pipelines WHERE nome = 'Vendas Consultoria' AND tenant_id IN (SELECT id FROM tenant_info)),
  stages_info AS (
    SELECT id as stage_id, ordem 
    FROM crm_stages 
    WHERE pipeline_id IN (SELECT pipeline_id FROM pipeline_info)
    ORDER BY ordem
  ),
  pessoas_empresas AS (
    SELECT 
      p.id as pessoa_id, 
      e.id as empresa_id,
      p.nome as pessoa_nome,
      e.nome_fantasia as empresa_nome,
      ROW_NUMBER() OVER() as rn
    FROM crm_pessoas p
    JOIN crm_empresas e ON p.tenant_id = e.tenant_id
    WHERE p.tenant_id IN (SELECT id FROM tenant_info)
    LIMIT 5
  ),
  leads_data AS (
    SELECT 
      pe.*,
      CASE pe.rn
        WHEN 1 THEN 'Consultoria TechStart - Automação Vendas'
        WHEN 2 THEN 'Digital Solutions - Implementação CRM'
        WHEN 3 THEN 'Crescer - Treinamento Equipe'
        WHEN 4 THEN 'Inovar - Estratégia Marketing'
        WHEN 5 THEN 'Expandir - Plano Expansão'
      END as titulo,
      CASE pe.rn
        WHEN 1 THEN 25000.00
        WHEN 2 THEN 45000.00
        WHEN 3 THEN 15000.00
        WHEN 4 THEN 35000.00
        WHEN 5 THEN 65000.00
      END as valor,
      CASE pe.rn
        WHEN 1 THEN 'em-andamento'
        WHEN 2 THEN 'em-andamento'
        WHEN 3 THEN 'em-andamento'
        WHEN 4 THEN 'ganho'
        WHEN 5 THEN 'em-andamento'
      END as status,
      CASE pe.rn
        WHEN 1 THEN (SELECT stage_id FROM stages_info WHERE ordem = 3)
        WHEN 2 THEN (SELECT stage_id FROM stages_info WHERE ordem = 4)
        WHEN 3 THEN (SELECT stage_id FROM stages_info WHERE ordem = 2)
        WHEN 4 THEN (SELECT stage_id FROM stages_info WHERE ordem = 5)
        WHEN 5 THEN (SELECT stage_id FROM stages_info WHERE ordem = 1)
      END as stage_id
    FROM pessoas_empresas pe
  )
INSERT INTO crm_leads (titulo, person_id, empresa_id, pipeline_id, stage_id, valor, status, tenant_id, utm_source, utm_medium)
SELECT 
  ld.titulo, 
  ld.pessoa_id, 
  ld.empresa_id,
  pi.pipeline_id,
  ld.stage_id,
  ld.valor,
  ld.status,
  ti.tenant_id,
  'google',
  'organic'
FROM leads_data ld
CROSS JOIN tenant_info ti
CROSS JOIN pipeline_info pi;

-- 8. Criar times
WITH tenant_info AS (SELECT id as tenant_id FROM crm_tenants WHERE value = 'receita-previsivel')
INSERT INTO crm_times (nome, descricao, tipo, prioridade, tenant_id, ativo) 
SELECT nome, descricao, tipo::crm_time_tipo, prioridade, tenant_id, ativo FROM (VALUES
  ('Vendas Inbound', 'Time responsável por leads que vêm do marketing', 'vendas', 1, true),
  ('Vendas Outbound', 'Time de prospecção ativa', 'vendas', 2, true),
  ('Suporte Pós-Venda', 'Time de atendimento e suporte aos clientes', 'suporte', 1, true),
  ('Marketing Digital', 'Time responsável pelas campanhas e geração de leads', 'marketing', 1, true),
  ('Sucesso do Cliente', 'Time focado na retenção e expansão de contas', 'suporte', 2, true)
) AS times_data(nome, descricao, tipo, prioridade, ativo)
CROSS JOIN tenant_info;