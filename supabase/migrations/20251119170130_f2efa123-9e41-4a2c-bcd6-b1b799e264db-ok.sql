
-- Inserir mensagens para Conversa 1 - João Silva
INSERT INTO messages (people_id, leads_id, content, from_contact, message_type, status, created_at)
VALUES 
  ('1f863a2d-b572-47a2-8634-6e8bc56d01cc', 'ea28c00a-a608-4517-858a-54e309a2feb7', 'Olá! Gostaria de saber mais sobre o processo de visto EB2-NIW', 'cliente', 'texto', 'entregue', NOW() - INTERVAL '2 hours'),
  ('1f863a2d-b572-47a2-8634-6e8bc56d01cc', 'ea28c00a-a608-4517-858a-54e309a2feb7', 'Olá João! Claro, vou te explicar. O EB2-NIW é um visto de residência permanente para profissionais com qualificação excepcional. Você tem formação superior?', NULL, 'texto', 'lida', NOW() - INTERVAL '1 hour 55 minutes'),
  ('1f863a2d-b572-47a2-8634-6e8bc56d01cc', 'ea28c00a-a608-4517-858a-54e309a2feb7', 'Sim, sou engenheiro civil com 8 anos de experiência', 'cliente', 'texto', 'entregue', NOW() - INTERVAL '1 hour 50 minutes'),
  ('1f863a2d-b572-47a2-8634-6e8bc56d01cc', 'ea28c00a-a608-4517-858a-54e309a2feb7', 'Perfeito! Sua experiência é muito relevante. Vou te enviar um material explicativo sobre o processo. Podemos agendar uma call?', NULL, 'texto', 'lida', NOW() - INTERVAL '1 hour 45 minutes'),
  ('1f863a2d-b572-47a2-8634-6e8bc56d01cc', 'ea28c00a-a608-4517-858a-54e309a2feb7', 'Sim, pode ser! Qual o investimento necessário?', 'cliente', 'texto', 'entregue', NOW() - INTERVAL '30 minutes'),
  ('1f863a2d-b572-47a2-8634-6e8bc56d01cc', 'ea28c00a-a608-4517-858a-54e309a2feb7', 'Vou te passar todos os valores na nossa call. Que tal amanhã às 15h?', NULL, 'texto', 'entregue', NOW() - INTERVAL '5 minutes');

-- Inserir mensagens para Conversa 2 - Rafaela
INSERT INTO messages (people_id, leads_id, content, from_contact, message_type, status, created_at)
VALUES 
  ('83577fc0-5fb7-4ee2-8b6b-a325104b460d', '5f5de4c3-3227-411b-b3b0-efc8507b534d', 'Bom dia! Vi vocês no Instagram e quero entender melhor o processo', 'cliente', 'texto', 'entregue', NOW() - INTERVAL '5 hours'),
  ('83577fc0-5fb7-4ee2-8b6b-a325104b460d', '5f5de4c3-3227-411b-b3b0-efc8507b534d', 'Bom dia Rafaela! Que legal que nos encontrou! Qual tipo de visto você tem interesse?', NULL, 'texto', 'lida', NOW() - INTERVAL '4 hours 50 minutes'),
  ('83577fc0-5fb7-4ee2-8b6b-a325104b460d', '5f5de4c3-3227-411b-b3b0-efc8507b534d', 'Estou em dúvida entre EB2-NIW e EB1-A. Sou médica com algumas publicações', 'cliente', 'texto', 'entregue', NOW() - INTERVAL '4 hours 40 minutes'),
  ('83577fc0-5fb7-4ee2-8b6b-a325104b460d', '5f5de4c3-3227-411b-b3b0-efc8507b534d', 'Excelente! Com publicações você pode ter um perfil muito forte para EB1-A. Quantas publicações você tem?', NULL, 'texto', 'lida', NOW() - INTERVAL '4 hours 35 minutes'),
  ('83577fc0-5fb7-4ee2-8b6b-a325104b460d', '5f5de4c3-3227-411b-b3b0-efc8507b534d', 'Tenho 5 artigos publicados e fui revisora de um journal internacional', 'cliente', 'texto', 'entregue', NOW() - INTERVAL '4 hours 30 minutes'),
  ('83577fc0-5fb7-4ee2-8b6b-a325104b460d', '5f5de4c3-3227-411b-b3b0-efc8507b534d', '🎉 Maravilha! Seu perfil está ótimo para EB1-A. Vou te enviar nosso questionário de elegibilidade', NULL, 'texto', 'lida', NOW() - INTERVAL '4 hours 25 minutes'),
  ('83577fc0-5fb7-4ee2-8b6b-a325104b460d', '5f5de4c3-3227-411b-b3b0-efc8507b534d', 'Perfeito! Já estou preenchendo aqui', 'cliente', 'texto', 'entregue', NOW() - INTERVAL '1 hour');

-- Inserir mensagens para Conversa 3 - Segunda conversa da Rafaela
INSERT INTO messages (people_id, leads_id, content, from_contact, message_type, status, created_at)
VALUES 
  ('83577fc0-5fb7-4ee2-8b6b-a325104b460d', '1f35501c-d351-4123-8a0b-41eaaacd7ed1', 'Oi, já enviei o questionário preenchido por e-mail', 'cliente', 'texto', 'entregue', NOW() - INTERVAL '3 hours'),
  ('83577fc0-5fb7-4ee2-8b6b-a325104b460d', '1f35501c-d351-4123-8a0b-41eaaacd7ed1', 'Recebi sim! Estou analisando aqui. Seu perfil ficou excelente 👏', NULL, 'texto', 'lida', NOW() - INTERVAL '2 hours 50 minutes'),
  ('83577fc0-5fb7-4ee2-8b6b-a325104b460d', '1f35501c-d351-4123-8a0b-41eaaacd7ed1', 'Que bom! E agora, quais são os próximos passos?', 'cliente', 'texto', 'entregue', NOW() - INTERVAL '2 hours 45 minutes'),
  ('83577fc0-5fb7-4ee2-8b6b-a325104b460d', '1f35501c-d351-4123-8a0b-41eaaacd7ed1', 'Vou preparar uma proposta personalizada para você. Em até 24h te envio tudo detalhado', NULL, 'texto', 'lida', NOW() - INTERVAL '2 hours 40 minutes'),
  ('83577fc0-5fb7-4ee2-8b6b-a325104b460d', '1f35501c-d351-4123-8a0b-41eaaacd7ed1', 'Perfeito! Fico no aguardo', 'cliente', 'texto', 'entregue', NOW() - INTERVAL '2 hours 35 minutes');
