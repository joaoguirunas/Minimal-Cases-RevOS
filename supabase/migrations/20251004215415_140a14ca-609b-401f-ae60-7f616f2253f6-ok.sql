-- Criar dados de exemplo conectados (valores corretos)

-- 1. Criar 5 empresas
INSERT INTO crm_empresas (id, nome_fantasia, razao_social, cnpj, email, telefone, site, status) VALUES
('11111111-1111-1111-1111-111111111111', 'Tech Solutions LTDA', 'Tech Solutions Tecnologia LTDA', '12.345.678/0001-90', 'contato@techsolutions.com.br', '(11) 98765-4321', 'www.techsolutions.com.br', 'ativo'),
('22222222-2222-2222-2222-222222222222', 'Inovação Digital', 'Inovação Digital Serviços LTDA', '23.456.789/0001-01', 'contato@inovacaodigital.com.br', '(11) 97654-3210', 'www.inovacaodigital.com.br', 'ativo'),
('33333333-3333-3333-3333-333333333333', 'Consultoria Empresarial', 'Consultoria Empresarial ME', '34.567.890/0001-12', 'atendimento@consultoriaempresarial.com.br', '(11) 96543-2109', 'www.consultoriaempresarial.com.br', 'ativo'),
('44444444-4444-4444-4444-444444444444', 'Marketing Pro', 'Marketing Pro Comunicação LTDA', '45.678.901/0001-23', 'vendas@marketingpro.com.br', '(11) 95432-1098', 'www.marketingpro.com.br', 'ativo'),
('55555555-5555-5555-5555-555555555555', 'Cloud Services Brasil', 'Cloud Services Brasil Tecnologia SA', '56.789.012/0001-34', 'comercial@cloudservices.com.br', '(11) 94321-0987', 'www.cloudservices.com.br', 'ativo')
ON CONFLICT (id) DO NOTHING;

-- 2. Criar 5 pessoas
INSERT INTO crm_pessoas (id, nome, email, whatsapp, documento, origem, status, score, atendimento_ia, status_atendimento) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'João Silva', 'joao.silva@email.com', '5511987654321', '123.456.789-00', 'site', 'ativo', 85, true, 'aberto'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Maria Santos', 'maria.santos@email.com', '5511976543210', '234.567.890-11', 'indicacao', 'ativo', 92, true, 'aberto'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Pedro Oliveira', 'pedro.oliveira@email.com', '5511965432109', '345.678.901-22', 'google', 'ativo', 78, true, 'aberto'),
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Ana Costa', 'ana.costa@email.com', '5511954321098', '456.789.012-33', 'facebook', 'ativo', 88, true, 'aberto'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Carlos Rodrigues', 'carlos.rodrigues@email.com', '5511943210987', '567.890.123-44', 'linkedin', 'ativo', 95, true, 'aberto')
ON CONFLICT (id) DO NOTHING;

-- 3. Associar pessoas a empresas
INSERT INTO crm_pessoa_empresas (pessoa_id, empresa_id) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333'),
('dddddddd-dddd-dddd-dddd-dddddddddddd', '44444444-4444-4444-4444-444444444444'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '55555555-5555-5555-5555-555555555555')
ON CONFLICT DO NOTHING;

-- 4. Verificar/criar pipeline padrão e stages
INSERT INTO crm_pipelines (id, nome, descricao, ativo)
VALUES ('99999999-9999-9999-9999-999999999999', 'Vendas', 'Pipeline padrão de vendas', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO crm_stages (id, pipeline_id, nome, ordem, cor, ativo) VALUES
('88888888-8888-8888-8888-888888888881', '99999999-9999-9999-9999-999999999999', 'Contato Inicial', 1, '#3B82F6', true),
('88888888-8888-8888-8888-888888888882', '99999999-9999-9999-9999-999999999999', 'Qualificação', 2, '#8B5CF6', true),
('88888888-8888-8888-8888-888888888883', '99999999-9999-9999-9999-999999999999', 'Proposta', 3, '#F59E0B', true),
('88888888-8888-8888-8888-888888888884', '99999999-9999-9999-9999-999999999999', 'Negociação', 4, '#10B981', true),
('88888888-8888-8888-8888-888888888885', '99999999-9999-9999-9999-999999999999', 'Fechado', 5, '#059669', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Criar 5 negócios (leads) conectados
INSERT INTO crm_leads (id, person_id, empresa_id, pipeline_id, stage_id, titulo, valor, status, controle) VALUES
('77777777-7777-7777-7777-777777777771', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', '88888888-8888-8888-8888-888888888881', 'Implementação Sistema ERP', 45000.00, 'em-andamento', 'manual'),
('77777777-7777-7777-7777-777777777772', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', '99999999-9999-9999-9999-999999999999', '88888888-8888-8888-8888-888888888882', 'Consultoria Digital', 32000.00, 'em-andamento', 'manual'),
('77777777-7777-7777-7777-777777777773', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', '99999999-9999-9999-9999-999999999999', '88888888-8888-8888-8888-888888888883', 'Planejamento Estratégico', 28000.00, 'em-andamento', 'manual'),
('77777777-7777-7777-7777-777777777774', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '44444444-4444-4444-4444-444444444444', '99999999-9999-9999-9999-999999999999', '88888888-8888-8888-8888-888888888884', 'Campanha Marketing Digital', 18000.00, 'em-andamento', 'manual'),
('77777777-7777-7777-7777-777777777775', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '55555555-5555-5555-5555-555555555555', '99999999-9999-9999-9999-999999999999', '88888888-8888-8888-8888-888888888885', 'Migração Cloud', 65000.00, 'em-andamento', 'manual')
ON CONFLICT (id) DO NOTHING;

-- 6. Criar mensagens/conversas (cliente = usuário, agente_ia = assistente)
INSERT INTO crm_messages (lead_id, pessoa_id, from_message, message, tipo_mensagem, canal) VALUES
('77777777-7777-7777-7777-777777777771', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cliente', 'Olá! Gostaria de saber mais sobre suas soluções de ERP.', 'texto', 'whatsapp'),
('77777777-7777-7777-7777-777777777771', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'agente_ia', 'Olá João! Ficamos felizes com seu interesse. Podemos agendar uma reunião para apresentar nossas soluções?', 'texto', 'whatsapp'),
('77777777-7777-7777-7777-777777777772', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cliente', 'Preciso de uma consultoria para transformação digital da empresa.', 'texto', 'whatsapp'),
('77777777-7777-7777-7777-777777777772', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'agente_ia', 'Olá Maria! Temos experiência em projetos de transformação digital. Vou enviar nossa proposta.', 'texto', 'whatsapp'),
('77777777-7777-7777-7777-777777777773', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'cliente', 'Quero fazer um planejamento estratégico para 2025.', 'texto', 'whatsapp'),
('77777777-7777-7777-7777-777777777773', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'agente_ia', 'Ótimo Pedro! Vamos estruturar um plano completo para sua empresa.', 'texto', 'whatsapp'),
('77777777-7777-7777-7777-777777777774', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'cliente', 'Preciso aumentar minha presença digital. Vocês podem ajudar?', 'texto', 'whatsapp'),
('77777777-7777-7777-7777-777777777774', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'agente_ia', 'Com certeza Ana! Vamos criar uma estratégia completa de marketing digital.', 'texto', 'whatsapp'),
('77777777-7777-7777-7777-777777777775', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'cliente', 'Estamos migrando para cloud. Qual o melhor caminho?', 'texto', 'whatsapp'),
('77777777-7777-7777-7777-777777777775', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'agente_ia', 'Olá Carlos! Vamos avaliar sua infraestrutura atual e propor a melhor solução cloud.', 'texto', 'whatsapp')
ON CONFLICT DO NOTHING;

-- 7. Criar agendamentos
INSERT INTO crm_agendamentos (id, negocio_id, data, hora_inicio, hora_fim, status, origem) VALUES
('66666666-6666-6666-6666-666666666661', '77777777-7777-7777-7777-777777777771', CURRENT_DATE + INTERVAL '2 days', '10:00:00', '11:00:00', 'agendado', 'manual'),
('66666666-6666-6666-6666-666666666662', '77777777-7777-7777-7777-777777777772', CURRENT_DATE + INTERVAL '3 days', '14:00:00', '15:00:00', 'agendado', 'manual'),
('66666666-6666-6666-6666-666666666663', '77777777-7777-7777-7777-777777777773', CURRENT_DATE + INTERVAL '4 days', '09:00:00', '10:30:00', 'agendado', 'manual'),
('66666666-6666-6666-6666-666666666664', '77777777-7777-7777-7777-777777777774', CURRENT_DATE + INTERVAL '5 days', '15:00:00', '16:00:00', 'agendado', 'manual'),
('66666666-6666-6666-6666-666666666665', '77777777-7777-7777-7777-777777777775', CURRENT_DATE + INTERVAL '1 week', '11:00:00', '12:00:00', 'agendado', 'manual')
ON CONFLICT (id) DO NOTHING;