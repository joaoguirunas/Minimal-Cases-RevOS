-- Inserir dados de exemplo para a tenant "Receita Previsível" (usando tenant existente)

-- Buscar ID da tenant existente "Receita Previsível"
-- Assumindo que o ID será usado conforme encontrado na base

-- 1. Criar pipeline principal
INSERT INTO crm_pipelines (id, nome, descricao, tenant_id, ativo) 
SELECT 'pipe-receita-1', 'Vendas Consultoria', 'Pipeline principal para vendas de consultoria', id, true
FROM crm_tenants WHERE value = 'receita-previsivel'
ON CONFLICT (id) DO NOTHING;

-- 2. Criar etapas do pipeline
WITH tenant_info AS (SELECT id as tenant_id FROM crm_tenants WHERE value = 'receita-previsivel')
INSERT INTO crm_stages (id, nome, pipeline_id, ordem, cor, tenant_id, ativo) 
SELECT * FROM (VALUES
  ('stage-receita-1', 'Lead Qualificado', 'pipe-receita-1', 1, '#3B82F6', true),
  ('stage-receita-2', 'Reunião Agendada', 'pipe-receita-1', 2, '#F59E0B', true),
  ('stage-receita-3', 'Proposta Enviada', 'pipe-receita-1', 3, '#8B5CF6', true),
  ('stage-receita-4', 'Negociação', 'pipe-receita-1', 4, '#EF4444', true),
  ('stage-receita-5', 'Fechado Ganho', 'pipe-receita-1', 5, '#10B981', true)
) AS stages_data(id, nome, pipeline_id, ordem, cor, ativo)
CROSS JOIN tenant_info
ON CONFLICT (id) DO NOTHING;

-- 3. Criar motivos de perda
WITH tenant_info AS (SELECT id as tenant_id FROM crm_tenants WHERE value = 'receita-previsivel')
INSERT INTO crm_motivo_perda (id, nome, tenant_id) 
SELECT * FROM (VALUES
  ('motivo-receita-1', 'Preço Alto'),
  ('motivo-receita-2', 'Não Era Decision Maker'),
  ('motivo-receita-3', 'Timing Errado'),
  ('motivo-receita-4', 'Escolheu Concorrente'),
  ('motivo-receita-5', 'Não Respondeu')
) AS motivos_data(id, nome)
CROSS JOIN tenant_info
ON CONFLICT (id) DO NOTHING;

-- 4. Criar empresas
WITH tenant_info AS (SELECT id as tenant_id FROM crm_tenants WHERE value = 'receita-previsivel')
INSERT INTO crm_empresas (id, nome_fantasia, razao_social, cnpj, telefone, email, site, tenant_id, status) 
SELECT * FROM (VALUES
  ('emp-receita-1', 'TechStart Inovação', 'TechStart Inovação Ltda', '12.345.678/0001-90', '(11) 98765-4321', 'contato@techstart.com.br', 'www.techstart.com.br', 'ativo'),
  ('emp-receita-2', 'Digital Solutions', 'Digital Solutions S.A.', '23.456.789/0001-01', '(11) 98765-4322', 'info@digitalsolutions.com.br', 'www.digitalsolutions.com.br', 'ativo'),
  ('emp-receita-3', 'Crescer Consultoria', 'Crescer Consultoria ME', '34.567.890/0001-12', '(11) 98765-4323', 'contato@crescer.com.br', 'www.crescer.com.br', 'ativo'),
  ('emp-receita-4', 'Inovar Marketing', 'Inovar Marketing Eireli', '45.678.901/0001-23', '(11) 98765-4324', 'vendas@inovar.com.br', 'www.inovar.com.br', 'ativo'),
  ('emp-receita-5', 'Expandir Negócios', 'Expandir Negócios Ltda', '56.789.012/0001-34', '(11) 98765-4325', 'comercial@expandir.com.br', 'www.expandir.com.br', 'ativo')
) AS empresas_data(id, nome_fantasia, razao_social, cnpj, telefone, email, site, status)
CROSS JOIN tenant_info
ON CONFLICT (id) DO NOTHING;

-- 5. Criar pessoas (clientes)
WITH tenant_info AS (SELECT id as tenant_id FROM crm_tenants WHERE value = 'receita-previsivel')
INSERT INTO crm_pessoas (id, nome, email, whatsapp, documento, origem, score, tenant_id, status, objetivo, momento, renda) 
SELECT * FROM (VALUES
  ('pessoa-receita-1', 'João Silva Santos', 'joao@techstart.com.br', '11987654321', '123.456.789-00', 'site', 85, 'ativo', 'Aumentar vendas em 30%', 'Pronto para decidir', 'R$ 10.000 - R$ 20.000'),
  ('pessoa-receita-2', 'Maria Oliveira Costa', 'maria@digitalsolutions.com.br', '11987654322', '234.567.890-11', 'indicação', 90, 'ativo', 'Automatizar processos', 'Pesquisando soluções', 'R$ 20.000 - R$ 50.000'),
  ('pessoa-receita-3', 'Pedro Ferreira Lima', 'pedro@crescer.com.br', '11987654323', '345.678.901-22', 'google_ads', 75, 'ativo', 'Escalar equipe de vendas', 'Avaliando opções', 'R$ 5.000 - R$ 10.000'),
  ('pessoa-receita-4', 'Ana Carolina Rocha', 'ana@inovar.com.br', '11987654324', '456.789.012-33', 'facebook', 80, 'ativo', 'Melhorar ROI marketing', 'Urgente', 'R$ 15.000 - R$ 30.000'),
  ('pessoa-receita-5', 'Carlos Eduardo Alves', 'carlos@expandir.com.br', '11987654325', '567.890.123-44', 'linkedin', 70, 'ativo', 'Expandir para novos mercados', 'Planejando', 'R$ 25.000+')
) AS pessoas_data(id, nome, email, whatsapp, documento, origem, score, status, objetivo, momento, renda)
CROSS JOIN tenant_info
ON CONFLICT (id) DO NOTHING;

-- 6. Associar pessoas às empresas
WITH tenant_info AS (SELECT id as tenant_id FROM crm_tenants WHERE value = 'receita-previsivel')
INSERT INTO crm_pessoa_empresas (id, pessoa_id, empresa_id, tenant_id) 
SELECT * FROM (VALUES
  ('pe-receita-1', 'pessoa-receita-1', 'emp-receita-1'),
  ('pe-receita-2', 'pessoa-receita-2', 'emp-receita-2'),
  ('pe-receita-3', 'pessoa-receita-3', 'emp-receita-3'),
  ('pe-receita-4', 'pessoa-receita-4', 'emp-receita-4'),
  ('pe-receita-5', 'pessoa-receita-5', 'emp-receita-5')
) AS pe_data(id, pessoa_id, empresa_id)
CROSS JOIN tenant_info
ON CONFLICT (id) DO NOTHING;

-- 7. Criar negócios (leads)
WITH tenant_info AS (SELECT id as tenant_id FROM crm_tenants WHERE value = 'receita-previsivel')
INSERT INTO crm_leads (id, titulo, person_id, empresa_id, pipeline_id, stage_id, valor, status, tenant_id, utm_source, utm_medium, utm_campaign) 
SELECT * FROM (VALUES
  ('lead-receita-1', 'Consultoria TechStart - Automação Vendas', 'pessoa-receita-1', 'emp-receita-1', 'pipe-receita-1', 'stage-receita-3', 25000.00, 'em-andamento', 'google', 'cpc', 'consultoria-vendas'),
  ('lead-receita-2', 'Digital Solutions - Implementação CRM', 'pessoa-receita-2', 'emp-receita-2', 'pipe-receita-1', 'stage-receita-4', 45000.00, 'em-andamento', 'indicacao', 'referral', 'crm-implementation'),
  ('lead-receita-3', 'Crescer - Treinamento Equipe', 'pessoa-receita-3', 'emp-receita-3', 'pipe-receita-1', 'stage-receita-2', 15000.00, 'em-andamento', 'google', 'organic', 'treinamento'),
  ('lead-receita-4', 'Inovar - Estratégia Marketing', 'pessoa-receita-4', 'emp-receita-4', 'pipe-receita-1', 'stage-receita-5', 35000.00, 'ganho', 'facebook', 'social', 'marketing-strategy'),
  ('lead-receita-5', 'Expandir - Plano Expansão', 'pessoa-receita-5', 'emp-receita-5', 'pipe-receita-1', 'stage-receita-1', 65000.00, 'em-andamento', 'linkedin', 'social', 'expansao-negocios')
) AS leads_data(id, titulo, person_id, empresa_id, pipeline_id, stage_id, valor, status, utm_source, utm_medium, utm_campaign)
CROSS JOIN tenant_info
ON CONFLICT (id) DO NOTHING;

-- 8. Criar times
WITH tenant_info AS (SELECT id as tenant_id FROM crm_tenants WHERE value = 'receita-previsivel')
INSERT INTO crm_times (id, nome, descricao, tipo, prioridade, tenant_id, ativo) 
SELECT * FROM (VALUES
  ('time-receita-1', 'Vendas Inbound', 'Time responsável por leads que vêm do marketing', 'vendas', 1, true),
  ('time-receita-2', 'Vendas Outbound', 'Time de prospecção ativa', 'vendas', 2, true),
  ('time-receita-3', 'Suporte Pós-Venda', 'Time de atendimento e suporte aos clientes', 'suporte', 1, true),
  ('time-receita-4', 'Marketing Digital', 'Time responsável pelas campanhas e geração de leads', 'marketing', 1, true),
  ('time-receita-5', 'Sucesso do Cliente', 'Time focado na retenção e expansão de contas', 'suporte', 2, true)
) AS times_data(id, nome, descricao, tipo, prioridade, ativo)
CROSS JOIN tenant_info
ON CONFLICT (id) DO NOTHING;