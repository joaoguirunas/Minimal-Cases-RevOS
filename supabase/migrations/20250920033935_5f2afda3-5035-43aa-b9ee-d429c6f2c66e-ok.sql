-- Inserir dados de exemplo para "Receita Previsível" apenas se não existirem

DO $$ 
DECLARE 
    tenant_uuid UUID;
    pipeline_uuid UUID;
    stage_count INT;
    pessoa_count INT;
    empresa_count INT;
BEGIN
    -- Buscar tenant
    SELECT id INTO tenant_uuid FROM crm_tenants WHERE value = 'receita-previsivel' LIMIT 1;
    
    IF tenant_uuid IS NULL THEN
        RAISE EXCEPTION 'Tenant "receita-previsivel" não encontrado';
    END IF;

    -- Verificar se já existem dados para este tenant
    SELECT COUNT(*) INTO pessoa_count FROM crm_pessoas WHERE tenant_id = tenant_uuid;
    SELECT COUNT(*) INTO empresa_count FROM crm_empresas WHERE tenant_id = tenant_uuid;
    
    -- Se já tem dados suficientes, não fazer nada
    IF pessoa_count >= 5 AND empresa_count >= 5 THEN
        RAISE NOTICE 'Tenant % já possui dados suficientes (%pessoas, % empresas)', tenant_uuid, pessoa_count, empresa_count;
        RETURN;
    END IF;

    -- 1. Criar/buscar pipeline
    SELECT id INTO pipeline_uuid FROM crm_pipelines WHERE nome = 'Vendas Consultoria' AND tenant_id = tenant_uuid;
    
    IF pipeline_uuid IS NULL THEN
        INSERT INTO crm_pipelines (nome, descricao, tenant_id, ativo)
        VALUES ('Vendas Consultoria', 'Pipeline principal para vendas de consultoria', tenant_uuid, true)
        RETURNING id INTO pipeline_uuid;
        
        -- 2. Criar stages para o pipeline
        INSERT INTO crm_stages (nome, pipeline_id, ordem, cor, tenant_id, ativo) VALUES
        ('Lead Qualificado', pipeline_uuid, 1, '#3B82F6', tenant_uuid, true),
        ('Reunião Agendada', pipeline_uuid, 2, '#F59E0B', tenant_uuid, true),
        ('Proposta Enviada', pipeline_uuid, 3, '#8B5CF6', tenant_uuid, true),
        ('Negociação', pipeline_uuid, 4, '#EF4444', tenant_uuid, true),
        ('Fechado Ganho', pipeline_uuid, 5, '#10B981', tenant_uuid, true);
        
        RAISE NOTICE 'Pipeline criado: %', pipeline_uuid;
    END IF;

    -- 3. Criar empresas se necessário
    IF empresa_count < 5 THEN
        INSERT INTO crm_empresas (nome_fantasia, razao_social, cnpj, telefone, email, site, tenant_id, status) VALUES
        ('TechStart Inovação', 'TechStart Inovação Ltda', '12.345.678/0001-90', '(11) 98765-4321', 'contato@techstart.com.br', 'www.techstart.com.br', tenant_uuid, 'ativo'),
        ('Digital Solutions', 'Digital Solutions S.A.', '23.456.789/0001-01', '(11) 98765-4322', 'info@digitalsolutions.com.br', 'www.digitalsolutions.com.br', tenant_uuid, 'ativo'),
        ('Crescer Consultoria', 'Crescer Consultoria ME', '34.567.890/0001-12', '(11) 98765-4323', 'contato@crescer.com.br', 'www.crescer.com.br', tenant_uuid, 'ativo'),
        ('Inovar Marketing', 'Inovar Marketing Eireli', '45.678.901/0001-23', '(11) 98765-4324', 'vendas@inovar.com.br', 'www.inovar.com.br', tenant_uuid, 'ativo'),
        ('Expandir Negócios', 'Expandir Negócios Ltda', '56.789.012/0001-34', '(11) 98765-4325', 'comercial@expandir.com.br', 'www.expandir.com.br', tenant_uuid, 'ativo');
        
        RAISE NOTICE 'Empresas criadas para tenant %', tenant_uuid;
    END IF;

    -- 4. Criar pessoas se necessário
    IF pessoa_count < 5 THEN
        INSERT INTO crm_pessoas (nome, email, whatsapp, documento, origem, score, tenant_id, status, objetivo, momento, renda) VALUES
        ('João Silva Santos', 'joao@techstart.com.br', '11987654321', '123.456.789-00', 'site', 85, tenant_uuid, 'ativo', 'Aumentar vendas em 30%', 'Pronto para decidir', 'R$ 10.000 - R$ 20.000'),
        ('Maria Oliveira Costa', 'maria@digitalsolutions.com.br', '11987654322', '234.567.890-11', 'indicação', 90, tenant_uuid, 'ativo', 'Automatizar processos', 'Pesquisando soluções', 'R$ 20.000 - R$ 50.000'),
        ('Pedro Ferreira Lima', 'pedro@crescer.com.br', '11987654323', '345.678.901-22', 'google_ads', 75, tenant_uuid, 'ativo', 'Escalar equipe de vendas', 'Avaliando opções', 'R$ 5.000 - R$ 10.000'),
        ('Ana Carolina Rocha', 'ana@inovar.com.br', '11987654324', '456.789.012-33', 'facebook', 80, tenant_uuid, 'ativo', 'Melhorar ROI marketing', 'Urgente', 'R$ 15.000 - R$ 30.000'),
        ('Carlos Eduardo Alves', 'carlos@expandir.com.br', '11987654325', '567.890.123-44', 'linkedin', 70, tenant_uuid, 'ativo', 'Expandir para novos mercados', 'Planejando', 'R$ 25.000+');
        
        RAISE NOTICE 'Pessoas criadas para tenant %', tenant_uuid;
    END IF;

    -- 5. Criar motivos de perda
    INSERT INTO crm_motivo_perda (nome, tenant_id) 
    SELECT * FROM (VALUES
        ('Preço Alto', tenant_uuid),
        ('Não Era Decision Maker', tenant_uuid),
        ('Timing Errado', tenant_uuid),
        ('Escolheu Concorrente', tenant_uuid),
        ('Não Respondeu', tenant_uuid)
    ) AS t(nome, tenant_id)
    WHERE NOT EXISTS (
        SELECT 1 FROM crm_motivo_perda mp 
        WHERE mp.nome = t.nome AND mp.tenant_id = t.tenant_id
    );

    -- 6. Criar times
    INSERT INTO crm_times (nome, descricao, tipo, prioridade, tenant_id, ativo) 
    SELECT * FROM (VALUES
        ('Vendas Inbound', 'Time responsável por leads que vêm do marketing', 'vendas'::crm_time_tipo, 1, tenant_uuid, true),
        ('Vendas Outbound', 'Time de prospecção ativa', 'vendas'::crm_time_tipo, 2, tenant_uuid, true),
        ('Suporte Pós-Venda', 'Time de atendimento e suporte aos clientes', 'suporte'::crm_time_tipo, 1, tenant_uuid, true),
        ('Marketing Digital', 'Time responsável pelas campanhas e geração de leads', 'marketing'::crm_time_tipo, 1, tenant_uuid, true),
        ('Sucesso do Cliente', 'Time focado na retenção e expansão de contas', 'suporte'::crm_time_tipo, 2, tenant_uuid, true)
    ) AS t(nome, descricao, tipo, prioridade, tenant_id, ativo)
    WHERE NOT EXISTS (
        SELECT 1 FROM crm_times tm 
        WHERE tm.nome = t.nome AND tm.tenant_id = t.tenant_id
    );

    RAISE NOTICE 'Dados básicos criados com sucesso para tenant: %', tenant_uuid;
END $$;