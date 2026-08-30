-- Inserir dados de exemplo para a tenant "Receita Previsível"

-- 1. Verificar/Criar a tenant
INSERT INTO crm_tenants (id, name, value, ativo, webhook_conversas, modulos_ativos)
VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'Receita Previsível',
  'receita-previsivel',
  true,
  'https://webhook-exemplo.com/receita-previsivel',
  '{"negocios": true, "conversas": true, "campanhas": true, "reunioes": true, "clientes": true}'::jsonb
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  modulos_ativos = EXCLUDED.modulos_ativos;

-- 2. Criar pipeline principal
INSERT INTO crm_pipelines (id, nome, descricao, tenant_id, ativo) VALUES
('pipe-1', 'Vendas Consultoria', 'Pipeline principal para vendas de consultoria', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', true);

-- 3. Criar etapas do pipeline
INSERT INTO crm_stages (id, nome, pipeline_id, ordem, cor, tenant_id, ativo) VALUES
('stage-1', 'Lead Qualificado', 'pipe-1', 1, '#3B82F6', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', true),
('stage-2', 'Reunião Agendada', 'pipe-1', 2, '#F59E0B', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', true),
('stage-3', 'Proposta Enviada', 'pipe-1', 3, '#8B5CF6', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', true),
('stage-4', 'Negociação', 'pipe-1', 4, '#EF4444', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', true),
('stage-5', 'Fechado Ganho', 'pipe-1', 5, '#10B981', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', true);

-- 4. Criar motivos de perda
INSERT INTO crm_motivo_perda (id, nome, tenant_id) VALUES
('motivo-1', 'Preço Alto', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('motivo-2', 'Não Era Decision Maker', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('motivo-3', 'Timing Errado', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('motivo-4', 'Escolheu Concorrente', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('motivo-5', 'Não Respondeu', 'f47ac10b-58cc-4372-a567-0e02b2c3d479');

-- 5. Criar empresas
INSERT INTO crm_empresas (id, nome_fantasia, razao_social, cnpj, telefone, email, site, tenant_id, status) VALUES
('emp-1', 'TechStart Inovação', 'TechStart Inovação Ltda', '12.345.678/0001-90', '(11) 98765-4321', 'contato@techstart.com.br', 'www.techstart.com.br', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'ativo'),
('emp-2', 'Digital Solutions', 'Digital Solutions S.A.', '23.456.789/0001-01', '(11) 98765-4322', 'info@digitalsolutions.com.br', 'www.digitalsolutions.com.br', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'ativo'),
('emp-3', 'Crescer Consultoria', 'Crescer Consultoria ME', '34.567.890/0001-12', '(11) 98765-4323', 'contato@crescer.com.br', 'www.crescer.com.br', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'ativo'),
('emp-4', 'Inovar Marketing', 'Inovar Marketing Eireli', '45.678.901/0001-23', '(11) 98765-4324', 'vendas@inovar.com.br', 'www.inovar.com.br', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'ativo'),
('emp-5', 'Expandir Negócios', 'Expandir Negócios Ltda', '56.789.012/0001-34', '(11) 98765-4325', 'comercial@expandir.com.br', 'www.expandir.com.br', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'ativo');

-- 6. Criar pessoas (clientes)
INSERT INTO crm_pessoas (id, nome, email, whatsapp, documento, origem, score, tenant_id, status, objetivo, momento, renda) VALUES
('pessoa-1', 'João Silva Santos', 'joao@techstart.com.br', '11987654321', '123.456.789-00', 'site', 85, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'ativo', 'Aumentar vendas em 30%', 'Pronto para decidir', 'R$ 10.000 - R$ 20.000'),
('pessoa-2', 'Maria Oliveira Costa', 'maria@digitalsolutions.com.br', '11987654322', '234.567.890-11', 'indicação', 90, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'ativo', 'Automatizar processos', 'Pesquisando soluções', 'R$ 20.000 - R$ 50.000'),
('pessoa-3', 'Pedro Ferreira Lima', 'pedro@crescer.com.br', '11987654323', '345.678.901-22', 'google_ads', 75, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'ativo', 'Escalar equipe de vendas', 'Avaliando opções', 'R$ 5.000 - R$ 10.000'),
('pessoa-4', 'Ana Carolina Rocha', 'ana@inovar.com.br', '11987654324', '456.789.012-33', 'facebook', 80, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'ativo', 'Melhorar ROI marketing', 'Urgente', 'R$ 15.000 - R$ 30.000'),
('pessoa-5', 'Carlos Eduardo Alves', 'carlos@expandir.com.br', '11987654325', '567.890.123-44', 'linkedin', 70, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'ativo', 'Expandir para novos mercados', 'Planejando', 'R$ 25.000+');

-- 7. Associar pessoas às empresas
INSERT INTO crm_pessoa_empresas (id, pessoa_id, empresa_id, tenant_id) VALUES
('pe-1', 'pessoa-1', 'emp-1', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('pe-2', 'pessoa-2', 'emp-2', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('pe-3', 'pessoa-3', 'emp-3', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('pe-4', 'pessoa-4', 'emp-4', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('pe-5', 'pessoa-5', 'emp-5', 'f47ac10b-58cc-4372-a567-0e02b2c3d479');

-- 8. Criar negócios (leads)
INSERT INTO crm_leads (id, titulo, person_id, empresa_id, pipeline_id, stage_id, valor, status, tenant_id, utm_source, utm_medium, utm_campaign) VALUES
('lead-1', 'Consultoria TechStart - Automação Vendas', 'pessoa-1', 'emp-1', 'pipe-1', 'stage-3', 25000.00, 'em-andamento', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'google', 'cpc', 'consultoria-vendas'),
('lead-2', 'Digital Solutions - Implementação CRM', 'pessoa-2', 'emp-2', 'pipe-1', 'stage-4', 45000.00, 'em-andamento', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'indicacao', 'referral', 'crm-implementation'),
('lead-3', 'Crescer - Treinamento Equipe', 'pessoa-3', 'emp-3', 'pipe-1', 'stage-2', 15000.00, 'em-andamento', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'google', 'organic', 'treinamento'),
('lead-4', 'Inovar - Estratégia Marketing', 'pessoa-4', 'emp-4', 'pipe-1', 'stage-5', 35000.00, 'ganho', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'facebook', 'social', 'marketing-strategy'),
('lead-5', 'Expandir - Plano Expansão', 'pessoa-5', 'emp-5', 'pipe-1', 'stage-1', 65000.00, 'em-andamento', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'linkedin', 'social', 'expansao-negocios');

-- 9. Criar mensagens/conversas
INSERT INTO crm_messages (id, lead_id, pessoa_id, from_message, message, canal, tipo_mensagem, tenant_id, created_at) VALUES
(1, 'lead-1', 'pessoa-1', 'pessoa-1', 'Olá! Gostaria de saber mais sobre consultoria em vendas para nossa empresa.', 'whatsapp', 'texto', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', NOW() - INTERVAL '2 days'),
(2, 'lead-1', 'pessoa-1', 'system', 'Olá João! Que bom ter você aqui. Vou te ajudar com informações sobre nossa consultoria. Qual é o principal desafio que vocês enfrentam em vendas?', 'whatsapp', 'texto', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', NOW() - INTERVAL '2 days' + INTERVAL '5 minutes'),
(3, 'lead-2', 'pessoa-2', 'pessoa-2', 'Preciso implementar um CRM na nossa empresa. Vocês podem ajudar?', 'whatsapp', 'texto', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', NOW() - INTERVAL '1 day'),
(4, 'lead-2', 'pessoa-2', 'system', 'Claro, Maria! Implementação de CRM é nossa especialidade. Quantos usuários teriam acesso ao sistema?', 'whatsapp', 'texto', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', NOW() - INTERVAL '1 day' + INTERVAL '3 minutes'),
(5, 'lead-3', 'pessoa-3', 'pessoa-3', 'Nossa equipe de vendas precisa de treinamento. Vocês oferecem isso?', 'whatsapp', 'texto', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', NOW() - INTERVAL '6 hours');

-- 10. Criar agendamentos
INSERT INTO crm_agendamentos (id, negocio_id, data, hora_inicio, hora_fim, observacoes, status, tenant_id, origem) VALUES
('agend-1', 'lead-1', CURRENT_DATE + INTERVAL '2 days', '14:00:00', '15:30:00', 'Reunião para apresentar proposta de consultoria em vendas', 'agendado', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'manual'),
('agend-2', 'lead-2', CURRENT_DATE + INTERVAL '3 days', '10:00:00', '11:00:00', 'Demonstração do CRM e levantamento de requisitos', 'agendado', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'manual'),
('agend-3', 'lead-3', CURRENT_DATE + INTERVAL '1 day', '16:00:00', '17:00:00', 'Alinhamento sobre treinamento da equipe', 'agendado', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'manual'),
('agend-4', 'lead-4', CURRENT_DATE - INTERVAL '1 day', '09:00:00', '10:30:00', 'Reunião de fechamento - estratégia de marketing', 'realizado', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'manual'),
('agend-5', 'lead-5', CURRENT_DATE + INTERVAL '5 days', '11:00:00', '12:00:00', 'Primeira reunião - plano de expansão', 'agendado', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'manual');

-- 11. Criar campanhas
INSERT INTO crm_campanhas (id, nome, canal, mensagem, status, pipeline_id, etapa_id, tenant_id) VALUES
('camp-1', 'Captação Consultoria Vendas', 'whatsapp', 'Olá! Sua empresa está perdendo vendas por falta de processo? Podemos ajudar você a aumentar seus resultados em 30 dias. Quer saber como?', 'ativa', 'pipe-1', 'stage-1', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('camp-2', 'Follow-up CRM Implementation', 'email', 'Vimos que você tem interesse em CRM. Que tal uma demo personalizada para sua empresa?', 'ativa', 'pipe-1', 'stage-2', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('camp-3', 'Treinamento Equipe Vendas', 'whatsapp', 'Sua equipe de vendas está preparada para os desafios de 2024? Nosso treinamento pode fazer a diferença!', 'rascunho', 'pipe-1', 'stage-1', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('camp-4', 'Reativação Leads Frios', 'email', 'Ainda está interessado em melhorar seus resultados? Temos novidades que podem te interessar!', 'pausada', 'pipe-1', 'stage-1', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('camp-5', 'Black Friday Consultoria', 'whatsapp', 'OFERTA ESPECIAL: 30% OFF em consultorias até o final do mês! Não perca essa oportunidade!', 'ativa', 'pipe-1', 'stage-3', 'f47ac10b-58cc-4372-a567-0e02b2c3d479');

-- 12. Criar contatos das campanhas
INSERT INTO crm_campanha_contatos (id, campanha_id, nome, telefone, email, status_envio, tenant_id) VALUES
('cc-1', 'camp-1', 'João Silva Santos', '11987654321', 'joao@techstart.com.br', 'enviado', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('cc-2', 'camp-1', 'Roberto Mendes', '11987654326', 'roberto@exemplo.com.br', 'pendente', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('cc-3', 'camp-2', 'Maria Oliveira Costa', '11987654322', 'maria@digitalsolutions.com.br', 'enviado', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('cc-4', 'camp-2', 'Fernanda Lima', '11987654327', 'fernanda@exemplo.com.br', 'erro', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('cc-5', 'camp-5', 'Carlos Eduardo Alves', '11987654325', 'carlos@expandir.com.br', 'enviado', 'f47ac10b-58cc-4372-a567-0e02b2c3d479');

-- 13. Criar times
INSERT INTO crm_times (id, nome, descricao, tipo, prioridade, tenant_id, ativo) VALUES
('time-1', 'Vendas Inbound', 'Time responsável por leads que vêm do marketing', 'vendas', 1, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', true),
('time-2', 'Vendas Outbound', 'Time de prospecção ativa', 'vendas', 2, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', true),
('time-3', 'Suporte Pós-Venda', 'Time de atendimento e suporte aos clientes', 'suporte', 1, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', true),
('time-4', 'Marketing Digital', 'Time responsável pelas campanhas e geração de leads', 'marketing', 1, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', true),
('time-5', 'Sucesso do Cliente', 'Time focado na retenção e expansão de contas', 'suporte', 2, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', true);

-- 14. Criar notas para negócios
INSERT INTO crm_negocio_notas (id, negocio_id, titulo, conteudo, tenant_id) VALUES
('nota-1', 'lead-1', 'Primeira conversa com João', 'Cliente muito interessado em automação. Tem urgência pois está perdendo vendas. Orçamento aprovado até R$ 30k. Decision maker confirmado.', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('nota-2', 'lead-2', 'Reunião de descoberta', 'Empresa em crescimento, equipe de 15 pessoas. Precisam de CRM integrado com WhatsApp. Têm budget de R$ 50k para o projeto completo.', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('nota-3', 'lead-3', 'Análise da equipe', 'Equipe de 8 vendedores, todos novatos. Precisam de treinamento completo em vendas consultivas. Orçamento limitado, negociar parcelamento.', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('nota-4', 'lead-4', 'Proposta aprovada!', 'Cliente aprovou nossa proposta de estratégia de marketing. Projeto inicia na próxima semana. Pagamento à vista com 10% desconto.', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('nota-5', 'lead-5', 'Reunião inicial', 'Empresa quer expandir para SP e RJ. Precisam de estruturação completa de vendas nas novas praças. Projeto de 6 meses, budget alto.', 'f47ac10b-58cc-4372-a567-0e02b2c3d479');

-- 15. Criar followups para stages
INSERT INTO crm_stage_followups (id, stage_id, tipo, assunto, mensagem, dias, horas, minutos, tenant_id, ativo) VALUES
('sf-1', 'stage-1', 'texto', 'Follow-up Lead Qualificado', 'Olá! Vi que você demonstrou interesse em nossos serviços. Tem alguma dúvida que posso esclarecer?', 1, 0, 0, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', true),
('sf-2', 'stage-2', 'texto', 'Lembrete Reunião', 'Oi! Nossa reunião está confirmada para amanhã. Tem alguma pergunta específica que gostaria que preparássemos?', 0, 24, 0, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', true),
('sf-3', 'stage-3', 'texto', 'Follow-up Proposta', 'Olá! Enviei nossa proposta ontem. Conseguiu dar uma olhada? Tem alguma dúvida ou ajuste que precisa fazer?', 2, 0, 0, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', true),
('sf-4', 'stage-4', 'texto', 'Acompanhar Negociação', 'Oi! Como estão as análises internas? Posso ajudar com mais alguma informação para acelerar a decisão?', 1, 0, 0, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', true),
('sf-5', 'stage-1', 'texto', 'Segunda tentativa contato', 'Oi! Tentei contato anteriormente sobre consultoria em vendas. Ainda tem interesse em conversar sobre como podemos ajudar?', 3, 0, 0, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', true);