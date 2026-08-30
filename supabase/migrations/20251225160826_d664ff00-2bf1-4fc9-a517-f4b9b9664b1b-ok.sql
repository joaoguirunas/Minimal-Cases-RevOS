-- Inserir mensagens de exemplo para João Guiriunas
INSERT INTO public.messages (people_id, leads_id, content, from_contact, message_type, channel, status, created_at) VALUES
-- Mensagem inicial do cliente
('a4d03903-dbbb-4875-b9db-ca3cfb6be8f4', 'ba79a7ce-2ec7-47b6-a473-1c2a6ffce4df', 'Olá, boa tarde! Vi sobre o processo de imigração para os EUA e gostaria de mais informações.', 'cliente', 'texto', 'whatsapp', 'pendente', NOW() - INTERVAL '2 days'),

-- Resposta do atendente humano
('a4d03903-dbbb-4875-b9db-ca3cfb6be8f4', 'ba79a7ce-2ec7-47b6-a473-1c2a6ffce4df', 'Olá João! Tudo bem? Fico feliz em saber do seu interesse. Poderia me contar um pouco mais sobre sua situação atual? Qual sua área de atuação profissional?', 'humano', 'texto', 'whatsapp', 'enviada', NOW() - INTERVAL '2 days' + INTERVAL '5 minutes'),

-- Cliente responde
('a4d03903-dbbb-4875-b9db-ca3cfb6be8f4', 'ba79a7ce-2ec7-47b6-a473-1c2a6ffce4df', 'Sou engenheiro de software, trabalho há 8 anos na área. Tenho interesse em me mudar com minha família.', 'cliente', 'texto', 'whatsapp', 'pendente', NOW() - INTERVAL '2 days' + INTERVAL '15 minutes'),

-- Atendente humano continua
('a4d03903-dbbb-4875-b9db-ca3cfb6be8f4', 'ba79a7ce-2ec7-47b6-a473-1c2a6ffce4df', 'Excelente! Engenheiros de software têm ótimas chances no processo de visto EB-2 NIW. Você tem mestrado ou doutorado na área?', 'humano', 'texto', 'whatsapp', 'enviada', NOW() - INTERVAL '2 days' + INTERVAL '20 minutes'),

-- Cliente responde
('a4d03903-dbbb-4875-b9db-ca3cfb6be8f4', 'ba79a7ce-2ec7-47b6-a473-1c2a6ffce4df', 'Tenho mestrado em Ciência da Computação pela UFSC.', 'cliente', 'texto', 'whatsapp', 'pendente', NOW() - INTERVAL '1 day' + INTERVAL '2 hours'),

-- Atendente humano explica
('a4d03903-dbbb-4875-b9db-ca3cfb6be8f4', 'ba79a7ce-2ec7-47b6-a473-1c2a6ffce4df', 'Perfeito! Com mestrado e 8 anos de experiência, seu perfil é muito forte para o EB-2 NIW. Sua família é composta por quantas pessoas?', 'humano', 'texto', 'whatsapp', 'enviada', NOW() - INTERVAL '1 day' + INTERVAL '2 hours' + INTERVAL '10 minutes'),

-- Cliente responde sobre família
('a4d03903-dbbb-4875-b9db-ca3cfb6be8f4', 'ba79a7ce-2ec7-47b6-a473-1c2a6ffce4df', 'Somos 4 pessoas: eu, minha esposa e 2 filhos (6 e 9 anos).', 'cliente', 'texto', 'whatsapp', 'pendente', NOW() - INTERVAL '1 day' + INTERVAL '3 hours'),

-- Atendente humano propõe reunião
('a4d03903-dbbb-4875-b9db-ca3cfb6be8f4', 'ba79a7ce-2ec7-47b6-a473-1c2a6ffce4df', 'Entendi! Vou preparar uma análise detalhada do seu caso. Podemos agendar uma reunião para esta semana para discutirmos as opções?', 'humano', 'texto', 'whatsapp', 'enviada', NOW() - INTERVAL '1 day' + INTERVAL '3 hours' + INTERVAL '5 minutes'),

-- Cliente aceita
('a4d03903-dbbb-4875-b9db-ca3cfb6be8f4', 'ba79a7ce-2ec7-47b6-a473-1c2a6ffce4df', 'Claro! Pode ser quinta-feira às 15h?', 'cliente', 'texto', 'whatsapp', 'pendente', NOW() - INTERVAL '12 hours'),

-- Confirmação humano
('a4d03903-dbbb-4875-b9db-ca3cfb6be8f4', 'ba79a7ce-2ec7-47b6-a473-1c2a6ffce4df', 'Perfeito! Confirmado quinta-feira às 15h. Vou enviar o link da reunião por aqui. Até lá!', 'humano', 'texto', 'whatsapp', 'enviada', NOW() - INTERVAL '12 hours' + INTERVAL '2 minutes');