-- Inserir dados de exemplo para a tenant "Receita Previsível" (sem mensagens primeiro)

DO $$ 
DECLARE 
    tenant_uuid UUID;
    pipeline_uuid UUID;
    stage_ids UUID[];
    pessoa_ids UUID[];
    empresa_ids UUID[];
    lead_ids UUID[];
BEGIN
    -- Buscar tenant
    SELECT id INTO tenant_uuid FROM crm_tenants WHERE value = 'receita-previsivel' LIMIT 1;
    
    IF tenant_uuid IS NULL THEN
        RAISE EXCEPTION 'Tenant "receita-previsivel" não encontrado';
    END IF;

    -- 1. Criar pipeline
    INSERT INTO crm_pipelines (nome, descricao, tenant_id, ativo)
    VALUES ('Vendas Consultoria', 'Pipeline principal para vendas de consultoria', tenant_uuid, true)
    RETURNING id INTO pipeline_uuid;

    -- 2. Criar stages
    INSERT INTO crm_stages (nome, pipeline_id, ordem, cor, tenant_id, ativo) VALUES
    ('Lead Qualificado', pipeline_uuid, 1, '#3B82F6', tenant_uuid, true),
    ('Reunião Agendada', pipeline_uuid, 2, '#F59E0B', tenant_uuid, true),
    ('Proposta Enviada', pipeline_uuid, 3, '#8B5CF6', tenant_uuid, true),
    ('Negociação', pipeline_uuid, 4, '#EF4444', tenant_uuid, true),
    ('Fechado Ganho', pipeline_uuid, 5, '#10B981', tenant_uuid, true);

    -- Obter IDs das stages
    SELECT ARRAY(SELECT id FROM crm_stages WHERE pipeline_id = pipeline_uuid ORDER BY ordem) INTO stage_ids;

    -- 3. Criar motivos de perda
    INSERT INTO crm_motivo_perda (nome, tenant_id) VALUES
    ('Preço Alto', tenant_uuid),
    ('Não Era Decision Maker', tenant_uuid),
    ('Timing Errado', tenant_uuid),
    ('Escolheu Concorrente', tenant_uuid),
    ('Não Respondeu', tenant_uuid);

    -- 4. Criar empresas
    INSERT INTO crm_empresas (nome_fantasia, razao_social, cnpj, telefone, email, site, tenant_id, status) VALUES
    ('TechStart Inovação', 'TechStart Inovação Ltda', '12.345.678/0001-90', '(11) 98765-4321', 'contato@techstart.com.br', 'www.techstart.com.br', tenant_uuid, 'ativo'),
    ('Digital Solutions', 'Digital Solutions S.A.', '23.456.789/0001-01', '(11) 98765-4322', 'info@digitalsolutions.com.br', 'www.digitalsolutions.com.br', tenant_uuid, 'ativo'),
    ('Crescer Consultoria', 'Crescer Consultoria ME', '34.567.890/0001-12', '(11) 98765-4323', 'contato@crescer.com.br', 'www.crescer.com.br', tenant_uuid, 'ativo'),
    ('Inovar Marketing', 'Inovar Marketing Eireli', '45.678.901/0001-23', '(11) 98765-4324', 'vendas@inovar.com.br', 'www.inovar.com.br', tenant_uuid, 'ativo'),
    ('Expandir Negócios', 'Expandir Negócios Ltda', '56.789.012/0001-34', '(11) 98765-4325', 'comercial@expandir.com.br', 'www.expandir.com.br', tenant_uuid, 'ativo');

    -- Obter IDs das empresas
    SELECT ARRAY(SELECT id FROM crm_empresas WHERE tenant_id = tenant_uuid ORDER BY created_at) INTO empresa_ids;

    -- 5. Criar pessoas
    INSERT INTO crm_pessoas (nome, email, whatsapp, documento, origem, score, tenant_id, status, objetivo, momento, renda) VALUES
    ('João Silva Santos', 'joao@techstart.com.br', '11987654321', '123.456.789-00', 'site', 85, tenant_uuid, 'ativo', 'Aumentar vendas em 30%', 'Pronto para decidir', 'R$ 10.000 - R$ 20.000'),
    ('Maria Oliveira Costa', 'maria@digitalsolutions.com.br', '11987654322', '234.567.890-11', 'indicação', 90, tenant_uuid, 'ativo', 'Automatizar processos', 'Pesquisando soluções', 'R$ 20.000 - R$ 50.000'),
    ('Pedro Ferreira Lima', 'pedro@crescer.com.br', '11987654323', '345.678.901-22', 'google_ads', 75, tenant_uuid, 'ativo', 'Escalar equipe de vendas', 'Avaliando opções', 'R$ 5.000 - R$ 10.000'),
    ('Ana Carolina Rocha', 'ana@inovar.com.br', '11987654324', '456.789.012-33', 'facebook', 80, tenant_uuid, 'ativo', 'Melhorar ROI marketing', 'Urgente', 'R$ 15.000 - R$ 30.000'),
    ('Carlos Eduardo Alves', 'carlos@expandir.com.br', '11987654325', '567.890.123-44', 'linkedin', 70, tenant_uuid, 'ativo', 'Expandir para novos mercados', 'Planejando', 'R$ 25.000+');

    -- Obter IDs das pessoas
    SELECT ARRAY(SELECT id FROM crm_pessoas WHERE tenant_id = tenant_uuid ORDER BY created_at) INTO pessoa_ids;

    -- 6. Associar pessoas às empresas (1:1)
    INSERT INTO crm_pessoa_empresas (pessoa_id, empresa_id, tenant_id) VALUES
    (pessoa_ids[1], empresa_ids[1], tenant_uuid),
    (pessoa_ids[2], empresa_ids[2], tenant_uuid),
    (pessoa_ids[3], empresa_ids[3], tenant_uuid),
    (pessoa_ids[4], empresa_ids[4], tenant_uuid),
    (pessoa_ids[5], empresa_ids[5], tenant_uuid);

    -- 7. Criar negócios (leads)
    INSERT INTO crm_leads (titulo, person_id, empresa_id, pipeline_id, stage_id, valor, status, tenant_id, utm_source, utm_medium) VALUES
    ('Consultoria TechStart - Automação Vendas', pessoa_ids[1], empresa_ids[1], pipeline_uuid, stage_ids[3], 25000.00, 'em-andamento', tenant_uuid, 'google', 'cpc'),
    ('Digital Solutions - Implementação CRM', pessoa_ids[2], empresa_ids[2], pipeline_uuid, stage_ids[4], 45000.00, 'em-andamento', tenant_uuid, 'indicacao', 'referral'),
    ('Crescer - Treinamento Equipe', pessoa_ids[3], empresa_ids[3], pipeline_uuid, stage_ids[2], 15000.00, 'em-andamento', tenant_uuid, 'google', 'organic'),
    ('Inovar - Estratégia Marketing', pessoa_ids[4], empresa_ids[4], pipeline_uuid, stage_ids[5], 35000.00, 'ganho', tenant_uuid, 'facebook', 'social'),
    ('Expandir - Plano Expansão', pessoa_ids[5], empresa_ids[5], pipeline_uuid, stage_ids[1], 65000.00, 'em-andamento', tenant_uuid, 'linkedin', 'social');

    -- Obter IDs dos leads
    SELECT ARRAY(SELECT id FROM crm_leads WHERE tenant_id = tenant_uuid ORDER BY created_at) INTO lead_ids;

    -- 8. Criar mensagens/conversas (usando from_message como string simples)
    INSERT INTO crm_messages (lead_id, pessoa_id, from_message, message, canal, tipo_mensagem, tenant_id) VALUES
    (lead_ids[1], pessoa_ids[1], 'client', 'Olá! Gostaria de saber mais sobre consultoria em vendas para nossa empresa.', 'whatsapp', 'texto', tenant_uuid),
    (lead_ids[1], pessoa_ids[1], 'system', 'Olá João! Que bom ter você aqui. Vou te ajudar com informações sobre nossa consultoria. Qual é o principal desafio que vocês enfrentam em vendas?', 'whatsapp', 'texto', tenant_uuid),
    (lead_ids[2], pessoa_ids[2], 'client', 'Preciso implementar um CRM na nossa empresa. Vocês podem ajudar?', 'whatsapp', 'texto', tenant_uuid),
    (lead_ids[2], pessoa_ids[2], 'system', 'Claro, Maria! Implementação de CRM é nossa especialidade. Quantos usuários teriam acesso ao sistema?', 'whatsapp', 'texto', tenant_uuid),
    (lead_ids[3], pessoa_ids[3], 'client', 'Nossa equipe de vendas precisa de treinamento. Vocês oferecem isso?', 'whatsapp', 'texto', tenant_uuid);

    -- 9. Criar agendamentos
    INSERT INTO crm_agendamentos (negocio_id, data, hora_inicio, hora_fim, observacoes, status, tenant_id, origem) VALUES
    (lead_ids[1], CURRENT_DATE + INTERVAL '2 days', '14:00:00', '15:30:00', 'Reunião para apresentar proposta de consultoria em vendas', 'agendado', tenant_uuid, 'manual'),
    (lead_ids[2], CURRENT_DATE + INTERVAL '3 days', '10:00:00', '11:00:00', 'Demonstração do CRM e levantamento de requisitos', 'agendado', tenant_uuid, 'manual'),
    (lead_ids[3], CURRENT_DATE + INTERVAL '1 day', '16:00:00', '17:00:00', 'Alinhamento sobre treinamento da equipe', 'agendado', tenant_uuid, 'manual'),
    (lead_ids[4], CURRENT_DATE - INTERVAL '1 day', '09:00:00', '10:30:00', 'Reunião de fechamento - estratégia de marketing', 'realizado', tenant_uuid, 'manual'),
    (lead_ids[5], CURRENT_DATE + INTERVAL '5 days', '11:00:00', '12:00:00', 'Primeira reunião - plano de expansão', 'agendado', tenant_uuid, 'manual');

    -- 10. Criar times
    INSERT INTO crm_times (nome, descricao, tipo, prioridade, tenant_id, ativo) VALUES
    ('Vendas Inbound', 'Time responsável por leads que vêm do marketing', 'vendas', 1, tenant_uuid, true),
    ('Vendas Outbound', 'Time de prospecção ativa', 'vendas', 2, tenant_uuid, true),
    ('Suporte Pós-Venda', 'Time de atendimento e suporte aos clientes', 'suporte', 1, tenant_uuid, true),
    ('Marketing Digital', 'Time responsável pelas campanhas e geração de leads', 'marketing', 1, tenant_uuid, true),
    ('Sucesso do Cliente', 'Time focado na retenção e expansão de contas', 'suporte', 2, tenant_uuid, true);

    -- 11. Criar notas para negócios
    INSERT INTO crm_negocio_notas (negocio_id, titulo, conteudo, tenant_id) VALUES
    (lead_ids[1], 'Primeira conversa com João', 'Cliente muito interessado em automação. Tem urgência pois está perdendo vendas. Orçamento aprovado até R$ 30k. Decision maker confirmado.', tenant_uuid),
    (lead_ids[2], 'Reunião de descoberta', 'Empresa em crescimento, equipe de 15 pessoas. Precisam de CRM integrado com WhatsApp. Têm budget de R$ 50k para o projeto completo.', tenant_uuid),
    (lead_ids[3], 'Análise da equipe', 'Equipe de 8 vendedores, todos novatos. Precisam de treinamento completo em vendas consultivas. Orçamento limitado, negociar parcelamento.', tenant_uuid),
    (lead_ids[4], 'Proposta aprovada!', 'Cliente aprovou nossa proposta de estratégia de marketing. Projeto inicia na próxima semana. Pagamento à vista com 10% desconto.', tenant_uuid),
    (lead_ids[5], 'Reunião inicial', 'Empresa quer expandir para SP e RJ. Precisam de estruturação completa de vendas nas novas praças. Projeto de 6 meses, budget alto.', tenant_uuid);

    -- 12. Criar campanhas
    INSERT INTO crm_campanhas (nome, canal, mensagem, status, pipeline_id, etapa_id, tenant_id) VALUES
    ('Captação Consultoria Vendas', 'whatsapp', 'Olá! Sua empresa está perdendo vendas por falta de processo? Podemos ajudar você a aumentar seus resultados em 30 dias. Quer saber como?', 'ativa', pipeline_uuid, stage_ids[1], tenant_uuid),
    ('Follow-up CRM Implementation', 'email', 'Vimos que você tem interesse em CRM. Que tal uma demo personalizada para sua empresa?', 'ativa', pipeline_uuid, stage_ids[2], tenant_uuid),
    ('Treinamento Equipe Vendas', 'whatsapp', 'Sua equipe de vendas está preparada para os desafios de 2024? Nosso treinamento pode fazer a diferença!', 'rascunho', pipeline_uuid, stage_ids[1], tenant_uuid),
    ('Reativação Leads Frios', 'email', 'Ainda está interessado em melhorar seus resultados? Temos novidades que podem te interessar!', 'pausada', pipeline_uuid, stage_ids[1], tenant_uuid),
    ('Black Friday Consultoria', 'whatsapp', 'OFERTA ESPECIAL: 30% OFF em consultorias até o final do mês! Não perca essa oportunidade!', 'ativa', pipeline_uuid, stage_ids[3], tenant_uuid);

    RAISE NOTICE 'Dados de exemplo criados com sucesso para tenant: % com pipeline: %', tenant_uuid, pipeline_uuid;
END $$;