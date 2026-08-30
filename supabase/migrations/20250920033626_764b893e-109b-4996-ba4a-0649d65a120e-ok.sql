-- Inserir dados de exemplo para a tenant "Receita Previsível" (versão simplificada)

-- Obter tenant ID
DO $$
DECLARE
    tenant_uuid UUID;
    pipeline_uuid UUID;
    stage1_uuid UUID;
    stage2_uuid UUID;
    stage3_uuid UUID;
    stage4_uuid UUID;
    stage5_uuid UUID;
    emp1_uuid UUID;
    emp2_uuid UUID;
    emp3_uuid UUID;
    emp4_uuid UUID;
    emp5_uuid UUID;
    pessoa1_uuid UUID;
    pessoa2_uuid UUID;
    pessoa3_uuid UUID;
    pessoa4_uuid UUID;
    pessoa5_uuid UUID;
BEGIN
    -- Obter tenant ID
    SELECT id INTO tenant_uuid FROM crm_tenants WHERE value = 'receita-previsivel';
    
    -- 1. Criar pipeline principal
    INSERT INTO crm_pipelines (nome, descricao, tenant_id, ativo) 
    VALUES ('Vendas Consultoria', 'Pipeline principal para vendas de consultoria', tenant_uuid, true)
    RETURNING id INTO pipeline_uuid;

    -- 2. Criar etapas
    INSERT INTO crm_stages (nome, pipeline_id, ordem, cor, tenant_id, ativo) 
    VALUES ('Lead Qualificado', pipeline_uuid, 1, '#3B82F6', tenant_uuid, true)
    RETURNING id INTO stage1_uuid;
    
    INSERT INTO crm_stages (nome, pipeline_id, ordem, cor, tenant_id, ativo) 
    VALUES ('Reunião Agendada', pipeline_uuid, 2, '#F59E0B', tenant_uuid, true)
    RETURNING id INTO stage2_uuid;
    
    INSERT INTO crm_stages (nome, pipeline_id, ordem, cor, tenant_id, ativo) 
    VALUES ('Proposta Enviada', pipeline_uuid, 3, '#8B5CF6', tenant_uuid, true)
    RETURNING id INTO stage3_uuid;
    
    INSERT INTO crm_stages (nome, pipeline_id, ordem, cor, tenant_id, ativo) 
    VALUES ('Negociação', pipeline_uuid, 4, '#EF4444', tenant_uuid, true)
    RETURNING id INTO stage4_uuid;
    
    INSERT INTO crm_stages (nome, pipeline_id, ordem, cor, tenant_id, ativo) 
    VALUES ('Fechado Ganho', pipeline_uuid, 5, '#10B981', tenant_uuid, true)
    RETURNING id INTO stage5_uuid;

    -- 3. Criar motivos de perda
    INSERT INTO crm_motivo_perda (nome, tenant_id) VALUES
    ('Preço Alto', tenant_uuid),
    ('Não Era Decision Maker', tenant_uuid),
    ('Timing Errado', tenant_uuid),
    ('Escolheu Concorrente', tenant_uuid),
    ('Não Respondeu', tenant_uuid);

    -- 4. Criar empresas
    INSERT INTO crm_empresas (nome_fantasia, razao_social, cnpj, telefone, email, site, tenant_id, status) 
    VALUES ('TechStart Inovação', 'TechStart Inovação Ltda', '12.345.678/0001-90', '(11) 98765-4321', 'contato@techstart.com.br', 'www.techstart.com.br', tenant_uuid, 'ativo')
    RETURNING id INTO emp1_uuid;
    
    INSERT INTO crm_empresas (nome_fantasia, razao_social, cnpj, telefone, email, site, tenant_id, status) 
    VALUES ('Digital Solutions', 'Digital Solutions S.A.', '23.456.789/0001-01', '(11) 98765-4322', 'info@digitalsolutions.com.br', 'www.digitalsolutions.com.br', tenant_uuid, 'ativo')
    RETURNING id INTO emp2_uuid;
    
    INSERT INTO crm_empresas (nome_fantasia, razao_social, cnpj, telefone, email, site, tenant_id, status) 
    VALUES ('Crescer Consultoria', 'Crescer Consultoria ME', '34.567.890/0001-12', '(11) 98765-4323', 'contato@crescer.com.br', 'www.crescer.com.br', tenant_uuid, 'ativo')
    RETURNING id INTO emp3_uuid;
    
    INSERT INTO crm_empresas (nome_fantasia, razao_social, cnpj, telefone, email, site, tenant_id, status) 
    VALUES ('Inovar Marketing', 'Inovar Marketing Eireli', '45.678.901/0001-23', '(11) 98765-4324', 'vendas@inovar.com.br', 'www.inovar.com.br', tenant_uuid, 'ativo')
    RETURNING id INTO emp4_uuid;
    
    INSERT INTO crm_empresas (nome_fantasia, razao_social, cnpj, telefone, email, site, tenant_id, status) 
    VALUES ('Expandir Negócios', 'Expandir Negócios Ltda', '56.789.012/0001-34', '(11) 98765-4325', 'comercial@expandir.com.br', 'www.expandir.com.br', tenant_uuid, 'ativo')
    RETURNING id INTO emp5_uuid;

    -- 5. Criar pessoas
    INSERT INTO crm_pessoas (nome, email, whatsapp, documento, origem, score, tenant_id, status, objetivo, momento, renda) 
    VALUES ('João Silva Santos', 'joao@techstart.com.br', '11987654321', '123.456.789-00', 'site', 85, tenant_uuid, 'ativo', 'Aumentar vendas em 30%', 'Pronto para decidir', 'R$ 10.000 - R$ 20.000')
    RETURNING id INTO pessoa1_uuid;
    
    INSERT INTO crm_pessoas (nome, email, whatsapp, documento, origem, score, tenant_id, status, objetivo, momento, renda) 
    VALUES ('Maria Oliveira Costa', 'maria@digitalsolutions.com.br', '11987654322', '234.567.890-11', 'indicação', 90, tenant_uuid, 'ativo', 'Automatizar processos', 'Pesquisando soluções', 'R$ 20.000 - R$ 50.000')
    RETURNING id INTO pessoa2_uuid;
    
    INSERT INTO crm_pessoas (nome, email, whatsapp, documento, origem, score, tenant_id, status, objetivo, momento, renda) 
    VALUES ('Pedro Ferreira Lima', 'pedro@crescer.com.br', '11987654323', '345.678.901-22', 'google_ads', 75, tenant_uuid, 'ativo', 'Escalar equipe de vendas', 'Avaliando opções', 'R$ 5.000 - R$ 10.000')
    RETURNING id INTO pessoa3_uuid;
    
    INSERT INTO crm_pessoas (nome, email, whatsapp, documento, origem, score, tenant_id, status, objetivo, momento, renda) 
    VALUES ('Ana Carolina Rocha', 'ana@inovar.com.br', '11987654324', '456.789.012-33', 'facebook', 80, tenant_uuid, 'ativo', 'Melhorar ROI marketing', 'Urgente', 'R$ 15.000 - R$ 30.000')
    RETURNING id INTO pessoa4_uuid;
    
    INSERT INTO crm_pessoas (nome, email, whatsapp, documento, origem, score, tenant_id, status, objetivo, momento, renda) 
    VALUES ('Carlos Eduardo Alves', 'carlos@expandir.com.br', '11987654325', '567.890.123-44', 'linkedin', 70, tenant_uuid, 'ativo', 'Expandir para novos mercados', 'Planejando', 'R$ 25.000+')
    RETURNING id INTO pessoa5_uuid;

    -- 6. Associar pessoas às empresas
    INSERT INTO crm_pessoa_empresas (pessoa_id, empresa_id, tenant_id) VALUES
    (pessoa1_uuid, emp1_uuid, tenant_uuid),
    (pessoa2_uuid, emp2_uuid, tenant_uuid),
    (pessoa3_uuid, emp3_uuid, tenant_uuid),
    (pessoa4_uuid, emp4_uuid, tenant_uuid),
    (pessoa5_uuid, emp5_uuid, tenant_uuid);

    -- 7. Criar negócios (leads)
    INSERT INTO crm_leads (titulo, person_id, empresa_id, pipeline_id, stage_id, valor, status, tenant_id, utm_source, utm_medium) VALUES
    ('Consultoria TechStart - Automação Vendas', pessoa1_uuid, emp1_uuid, pipeline_uuid, stage3_uuid, 25000.00, 'em-andamento', tenant_uuid, 'google', 'cpc'),
    ('Digital Solutions - Implementação CRM', pessoa2_uuid, emp2_uuid, pipeline_uuid, stage4_uuid, 45000.00, 'em-andamento', tenant_uuid, 'indicacao', 'referral'),
    ('Crescer - Treinamento Equipe', pessoa3_uuid, emp3_uuid, pipeline_uuid, stage2_uuid, 15000.00, 'em-andamento', tenant_uuid, 'google', 'organic'),
    ('Inovar - Estratégia Marketing', pessoa4_uuid, emp4_uuid, pipeline_uuid, stage5_uuid, 35000.00, 'ganho', tenant_uuid, 'facebook', 'social'),
    ('Expandir - Plano Expansão', pessoa5_uuid, emp5_uuid, pipeline_uuid, stage1_uuid, 65000.00, 'em-andamento', tenant_uuid, 'linkedin', 'social');

    -- 8. Criar times
    INSERT INTO crm_times (nome, descricao, tipo, prioridade, tenant_id, ativo) VALUES
    ('Vendas Inbound', 'Time responsável por leads que vêm do marketing', 'vendas', 1, tenant_uuid, true),
    ('Vendas Outbound', 'Time de prospecção ativa', 'vendas', 2, tenant_uuid, true),
    ('Suporte Pós-Venda', 'Time de atendimento e suporte aos clientes', 'suporte', 1, tenant_uuid, true),
    ('Marketing Digital', 'Time responsável pelas campanhas e geração de leads', 'marketing', 1, tenant_uuid, true),
    ('Sucesso do Cliente', 'Time focado na retenção e expansão de contas', 'suporte', 2, tenant_uuid, true);

END $$;