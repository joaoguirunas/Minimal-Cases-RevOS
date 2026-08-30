-- CoachPRO™ — Seed: 7 playbook templates de sistema + playbooks de sistema (CF-1.4)
-- Migration: 20260422000200
-- UUIDs hardcoded para idempotência. ON CONFLICT (id) DO NOTHING em todos os INSERTs.
--
-- UUID ranges:
--   templates   11111111-0001..0007-0000-0000-000000000001
--   playbooks   22222222-0001..0007-0000-0000-000000000001
--   sections    33333333-0T0S-0000-0000-000000000001
--   criteria    44444444-0T0S-000C-0000-000000000001

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. PLAYBOOK TEMPLATES
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO public.playbook_templates
  (id, name, type, description, icon, color, is_system, display_order)
VALUES
  ('11111111-0001-0000-0000-000000000001',
   'Discovery Call — Vendas B2B', 'sales',
   'Diagnóstico estruturado com SPIN e qualificação MEDDIC para primeiras reuniões B2B.',
   'search', '#6366f1', true, 1),

  ('11111111-0002-0000-0000-000000000001',
   'Demo / Pitch — Vendas B2B', 'sales',
   'Demonstração customizada com validação contínua e fecho orientado a próximo passo.',
   'monitor', '#8b5cf6', true, 2),

  ('11111111-0003-0000-0000-000000000001',
   'Reunião de Fecho — Vendas B2B', 'sales',
   'Gestão de objecções e técnicas de fecho para reuniões de decisão.',
   'handshake', '#10b981', true, 3),

  ('11111111-0004-0000-0000-000000000001',
   'Kickoff de Projecto — Consultoria', 'consulting',
   'Alinhamento de expectativas, governance e plano de trabalho para arranque de projectos.',
   'briefcase', '#f59e0b', true, 4),

  ('11111111-0005-0000-0000-000000000001',
   'Sessão de Mentoria', 'mentoring',
   'Check-in, revisão de comprometimentos e definição de próximas acções.',
   'users', '#ec4899', true, 5),

  ('11111111-0006-0000-0000-000000000001',
   'Quarterly Business Review', 'cs',
   'Revisão de resultados, saúde da conta e planeamento do próximo trimestre.',
   'bar-chart-2', '#0ea5e9', true, 6),

  ('11111111-0007-0000-0000-000000000001',
   'Follow-up / Reconquista', 'sales',
   'Reactivação de oportunidades frias com diagnóstico do que mudou e re-apresentação de valor.',
   'refresh-cw', '#f97316', true, 7)

ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. PLAYBOOKS DE SISTEMA (um por template)
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO public.playbooks
  (id, name, type, description, parent_template_id, is_active, is_default_for_type)
VALUES
  ('22222222-0001-0000-0000-000000000001',
   'Discovery Call — Vendas B2B', 'sales',
   'Playbook de sistema — Discovery Call B2B.',
   '11111111-0001-0000-0000-000000000001', true, true),

  ('22222222-0002-0000-0000-000000000001',
   'Demo / Pitch — Vendas B2B', 'sales',
   'Playbook de sistema — Demo/Pitch B2B.',
   '11111111-0002-0000-0000-000000000001', true, false),

  ('22222222-0003-0000-0000-000000000001',
   'Reunião de Fecho — Vendas B2B', 'sales',
   'Playbook de sistema — Reunião de Fecho B2B.',
   '11111111-0003-0000-0000-000000000001', true, false),

  ('22222222-0004-0000-0000-000000000001',
   'Kickoff de Projecto — Consultoria', 'consulting',
   'Playbook de sistema — Kickoff de Projecto.',
   '11111111-0004-0000-0000-000000000001', true, true),

  ('22222222-0005-0000-0000-000000000001',
   'Sessão de Mentoria', 'mentoring',
   'Playbook de sistema — Sessão de Mentoria.',
   '11111111-0005-0000-0000-000000000001', true, true),

  ('22222222-0006-0000-0000-000000000001',
   'Quarterly Business Review', 'cs',
   'Playbook de sistema — QBR.',
   '11111111-0006-0000-0000-000000000001', true, true),

  ('22222222-0007-0000-0000-000000000001',
   'Follow-up / Reconquista', 'sales',
   'Playbook de sistema — Follow-up/Reconquista.',
   '11111111-0007-0000-0000-000000000001', true, false)

ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. SECÇÕES
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO public.playbook_sections
  (id, playbook_id, title, description, weight, display_order)
VALUES

-- Template 1: Discovery Call
  ('33333333-0101-0000-0000-000000000001', '22222222-0001-0000-0000-000000000001',
   'Abertura & Rapport', 'Estabelecer confiança e contexto no início da reunião.', 10.0, 1),
  ('33333333-0102-0000-0000-000000000001', '22222222-0001-0000-0000-000000000001',
   'Diagnóstico SPIN', 'Perguntas de Situação, Problema, Implicação e Necessidade.', 35.0, 2),
  ('33333333-0103-0000-0000-000000000001', '22222222-0001-0000-0000-000000000001',
   'Qualificação MEDDIC', 'Budget, Autoridade e Timeline.', 25.0, 3),
  ('33333333-0104-0000-0000-000000000001', '22222222-0001-0000-0000-000000000001',
   'Próximo Passo', 'Fechar a reunião com acção concreta e data definida.', 30.0, 4),

-- Template 2: Demo / Pitch
  ('33333333-0201-0000-0000-000000000001', '22222222-0002-0000-0000-000000000001',
   'Alinhamento de Agenda', 'Confirmar expectativas e contexto antes da demo.', 15.0, 1),
  ('33333333-0202-0000-0000-000000000001', '22222222-0002-0000-0000-000000000001',
   'Demonstração Customizada', 'Mostrar apenas o que é relevante para os desafios do cliente.', 40.0, 2),
  ('33333333-0203-0000-0000-000000000001', '22222222-0002-0000-0000-000000000001',
   'Validação Contínua', 'Verificar ressonância ao longo da demo.', 25.0, 3),
  ('33333333-0204-0000-0000-000000000001', '22222222-0002-0000-0000-000000000001',
   'Closing da Demo', 'Fechar com impacto e próximo passo claro.', 20.0, 4),

-- Template 3: Reunião de Fecho
  ('33333333-0301-0000-0000-000000000001', '22222222-0003-0000-0000-000000000001',
   'Resumo de Valor', 'Reiterar o valor acordado antes de apresentar proposta.', 20.0, 1),
  ('33333333-0302-0000-0000-000000000001', '22222222-0003-0000-0000-000000000001',
   'Gestão de Objecções', 'Tratar objecções com empatia e dados.', 50.0, 2),
  ('33333333-0303-0000-0000-000000000001', '22222222-0003-0000-0000-000000000001',
   'Fecho', 'Pedir a decisão e gerir o processo.', 30.0, 3),

-- Template 4: Kickoff
  ('33333333-0401-0000-0000-000000000001', '22222222-0004-0000-0000-000000000001',
   'Alinhamento de Expectativas', 'Confirmar objectivos, critérios de sucesso e restrições.', 30.0, 1),
  ('33333333-0402-0000-0000-000000000001', '22222222-0004-0000-0000-000000000001',
   'Governance & Processo', 'Definir ritmo de comunicação, responsáveis e escalonamento.', 25.0, 2),
  ('33333333-0403-0000-0000-000000000001', '22222222-0004-0000-0000-000000000001',
   'Plano de Trabalho', 'Apresentar e validar o plano de fases e entregas.', 30.0, 3),
  ('33333333-0404-0000-0000-000000000001', '22222222-0004-0000-0000-000000000001',
   'Comprometimento Mútuo', 'Confirmar que ambas as partes compreendem as suas responsabilidades.', 15.0, 4),

-- Template 5: Mentoria
  ('33333333-0501-0000-0000-000000000001', '22222222-0005-0000-0000-000000000001',
   'Check-in Inicial', 'Estado emocional e foco do mentorado.', 15.0, 1),
  ('33333333-0502-0000-0000-000000000001', '22222222-0005-0000-0000-000000000001',
   'Revisão de Comprometimentos', 'O que foi prometido na última sessão e o que aconteceu.', 25.0, 2),
  ('33333333-0503-0000-0000-000000000001', '22222222-0005-0000-0000-000000000001',
   'Sessão de Trabalho', 'Trabalho sobre o tema central da sessão.', 40.0, 3),
  ('33333333-0504-0000-0000-000000000001', '22222222-0005-0000-0000-000000000001',
   'Comprometimentos para a Próxima', 'Acções concretas até à próxima sessão.', 20.0, 4),

-- Template 6: QBR
  ('33333333-0601-0000-0000-000000000001', '22222222-0006-0000-0000-000000000001',
   'Revisão de Resultados', 'Analisar performance vs objectivos do trimestre anterior.', 30.0, 1),
  ('33333333-0602-0000-0000-000000000001', '22222222-0006-0000-0000-000000000001',
   'Saúde da Conta', 'Avaliar satisfação, risco de churn e oportunidades de expansão.', 25.0, 2),
  ('33333333-0603-0000-0000-000000000001', '22222222-0006-0000-0000-000000000001',
   'Planeamento Q+1', 'Definir objectivos e iniciativas para o próximo trimestre.', 35.0, 3),
  ('33333333-0604-0000-0000-000000000001', '22222222-0006-0000-0000-000000000001',
   'Fidelização', 'Reforçar a relação e identificar próximos passos de expansão.', 10.0, 4),

-- Template 7: Follow-up
  ('33333333-0701-0000-0000-000000000001', '22222222-0007-0000-0000-000000000001',
   'Abertura Sem Pressão', 'Retomar contacto sem criar desconforto.', 20.0, 1),
  ('33333333-0702-0000-0000-000000000001', '22222222-0007-0000-0000-000000000001',
   'Diagnóstico do Que Mudou', 'Entender o contexto actual vs quando pararam de avançar.', 35.0, 2),
  ('33333333-0703-0000-0000-000000000001', '22222222-0007-0000-0000-000000000001',
   'Re-apresentação de Valor', 'Mostrar valor actualizado ou diferente do apresentado anteriormente.', 25.0, 3),
  ('33333333-0704-0000-0000-000000000001', '22222222-0007-0000-0000-000000000001',
   'Próximo Passo Concreto', 'Fechar com uma acção clara e de baixo compromisso.', 20.0, 4)

ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. CRITÉRIOS
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO public.playbook_criteria
  (id, section_id, title, description, weight, detection_hints, example_good, example_bad, is_required, display_order)
VALUES

-- Secção 1.1: Abertura & Rapport
  ('44444444-0101-0001-0000-000000000001', '33333333-0101-0000-0000-000000000001',
   'Apresentação e agenda co-criada',
   'O consultor apresenta-se, explica o objectivo e convida o cliente a ajustar a agenda.',
   1.0,
   ARRAY['obrigado por dedicar','objectivo de hoje','posso tirar notas','o que gostava de cobrir','agenda de hoje'],
   'Obrigado por dedicar 30 minutos. O objectivo é perceber os vossos desafios — há algo específico que gostasse de cobrir?',
   'Então, vou começar por apresentar a empresa e depois o produto.',
   false, 1),

  ('44444444-0101-0002-0000-000000000001', '33333333-0101-0000-0000-000000000001',
   'Permissão para questionar',
   'O consultor pede autorização para fazer perguntas antes de mergulhar no diagnóstico.',
   1.0,
   ARRAY['posso fazer-lhe algumas perguntas','para perceber melhor','autoriza que','faz sentido','antes de continuar'],
   'Para poder ser mais útil, posso fazer-lhe algumas perguntas sobre o contexto actual? Demora cerca de 10 minutos.',
   'Então, o vosso principal problema é provavelmente...',
   false, 2),

  ('44444444-0101-0003-0000-000000000001', '33333333-0101-0000-0000-000000000001',
   'Rapport genuíno',
   'O consultor encontra um ponto de conexão real antes de entrar no negócio.',
   0.5,
   ARRAY['vi que','li sobre','parabéns por','interessante o que fazem','como correu','acompanhei'],
   'Vi que a vossa empresa acabou de expandir para o mercado espanhol — como está a correr?',
   'Então, como posso ajudar?',
   false, 3),

-- Secção 1.2: Diagnóstico SPIN
  ('44444444-0102-0001-0000-000000000001', '33333333-0102-0000-0000-000000000001',
   'Perguntas de Situação',
   'Recolhe contexto factual sem interrogatório excessivo (máx 2-3 perguntas).',
   1.0,
   ARRAY['actualmente','como funciona hoje','quantas pessoas','qual é o processo','desde quando','o vosso processo'],
   'Como é que a vossa equipa gere actualmente o pipeline de vendas?',
   'Têm CRM? Quantos vendedores? Qual o volume? Há quanto tempo? Quem decide?',
   false, 1),

  ('44444444-0102-0002-0000-000000000001', '33333333-0102-0000-0000-000000000001',
   'Perguntas de Problema',
   'Identifica dificuldades e frustrações concretas com o processo actual.',
   1.5,
   ARRAY['dificuldade','frustração','o que não funciona','desafio','lento','manual','perde-se','fica por fazer'],
   'Qual é a maior dificuldade no vosso processo de follow-up hoje?',
   'Já sabemos que o CRM tem muitas limitações — o nosso resolve isso.',
   true, 2),

  ('44444444-0102-0003-0000-000000000001', '33333333-0102-0000-0000-000000000001',
   'Perguntas de Implicação',
   'Expande o impacto do problema para tornar a dor mais concreta e quantificável.',
   1.5,
   ARRAY['impacto','custo','quantas oportunidades','o que acontece se','quanto tempo perde','consequência','resultado disso'],
   'Quando o follow-up falha, quantas oportunidades estimam que perdem por mês?',
   'Pois, é um problema mesmo. Deixe-me mostrar como resolvemos isso.',
   true, 3),

  ('44444444-0102-0004-0000-000000000001', '33333333-0102-0000-0000-000000000001',
   'Perguntas de Necessidade',
   'Faz o cliente articular o valor da solução com as suas próprias palavras.',
   1.5,
   ARRAY['o que seria ideal','como seria diferente','se resolvesse','o que mais valorizaria','importância para vocês'],
   'Se conseguissem automatizar o follow-up, o que mudaria no dia-a-dia da equipa?',
   'Então precisam de automatizar, certo? Exactamente o que nós fazemos.',
   true, 4),

-- Secção 1.3: Qualificação MEDDIC
  ('44444444-0103-0001-0000-000000000001', '33333333-0103-0000-0000-000000000001',
   'Budget identificado',
   'Valida se existe orçamento disponível ou processo de aprovação claro.',
   1.5,
   ARRAY['orçamento','budget','aprovação','investimento','previsão','dotação','verba'],
   'Têm um orçamento reservado para ferramentas de sales enablement este ano?',
   'O preço não é problema, avancemos.',
   false, 1),

  ('44444444-0103-0002-0000-000000000001', '33333333-0103-0000-0000-000000000001',
   'Autoridade de decisão mapeada',
   'Identifica quem decide e se está presente ou acessível neste processo.',
   2.0,
   ARRAY['quem decide','aprovação de','director','CEO','comité','processo de compra','envolver','quem mais'],
   'Para além de si, quem mais estará envolvido na decisão final?',
   'Então fica com a nossa proposta e vê com a sua equipa.',
   true, 2),

  ('44444444-0103-0003-0000-000000000001', '33333333-0103-0000-0000-000000000001',
   'Timeline definida',
   'Compreende quando pretendem decidir e implementar.',
   1.5,
   ARRAY['quando','prazo','início','implementação','este trimestre','urgência','deadline','idealmente'],
   'Quando idealmente precisariam de ter isto a funcionar?',
   'Quando quiserem, nós adaptamo-nos.',
   false, 3),

-- Secção 1.4: Próximo Passo
  ('44444444-0104-0001-0000-000000000001', '33333333-0104-0000-0000-000000000001',
   'Resumo dos pontos-chave',
   'O consultor resume os principais pontos discutidos antes de fechar.',
   1.0,
   ARRAY['resumindo','para confirmar','o que percebemos','principais desafios','ficou claro que','sintetizando'],
   'Para resumir: o vosso principal desafio é X, o impacto é Y, e o objectivo é resolver até Z.',
   'Óptimo, foi uma boa conversa. Qualquer coisa fala comigo.',
   false, 1),

  ('44444444-0104-0002-0000-000000000001', '33333333-0104-0000-0000-000000000001',
   'Próximo passo concreto agendado',
   'A reunião termina com data e acção definidas para ambas as partes.',
   2.0,
   ARRAY['próxima reunião','envio até','agendarmos','ficamos de','data','semana que vem','dia e hora'],
   'Posso enviar-lhe uma proposta até quinta e agendarmos 30 minutos na semana que vem para a rever?',
   'Envio a proposta e depois vemos.',
   true, 2),

  ('44444444-0104-0003-0000-000000000001', '33333333-0104-0000-0000-000000000001',
   'Comprometimento explícito do cliente',
   'O cliente confirma verbalmente o próximo passo e as suas responsabilidades.',
   1.5,
   ARRAY['fico de','vou partilhar','confirmo','fazemos isso','pode contar','combinámos','da nossa parte'],
   'Perfeito, então fico de enviar os dados de consumo até amanhã para incluir na proposta.',
   'Sim, sim, depois vejo.',
   false, 3),

-- Secção 2.1: Alinhamento de Agenda
  ('44444444-0201-0001-0000-000000000001', '33333333-0201-0000-0000-000000000001',
   'Confirmação de contexto anterior',
   'Valida o que foi discutido na reunião anterior antes de iniciar a demo.',
   1.5,
   ARRAY['na última conversa','recordando','conforme combinámos','o que discutimos','contexto de antes'],
   'Na nossa última conversa focámos-nos em X — hoje quero mostrar exactamente como isso funciona. Faz sentido?',
   'Então vou mostrar tudo o que o produto faz.',
   false, 1),

  ('44444444-0201-0002-0000-000000000001', '33333333-0201-0000-0000-000000000001',
   'Critérios de decisão clarificados',
   'Percebe o que o cliente precisa de ver para sentir que pode avançar.',
   2.0,
   ARRAY['critério','o que precisam de ver','para tomarem a decisão','o que vos convenceria','benchmark','decisão'],
   'O que precisa de ver hoje para sentir que esta pode ser a solução certa?',
   'Confio que vão ficar impressionados.',
   true, 2),

-- Secção 2.2: Demonstração Customizada
  ('44444444-0202-0001-0000-000000000001', '33333333-0202-0000-0000-000000000001',
   'Demo centrada no problema do cliente',
   'Cada funcionalidade é mostrada no contexto de um desafio real mencionado pelo cliente.',
   2.0,
   ARRAY['como mencionaram','o vosso caso','exactamente para isso','no contexto de','para resolver o que descreveram'],
   'Como mencionaram que perdem tempo com follow-ups manuais, deixem-me mostrar como automatizamos isso.',
   'Esta funcionalidade é muito poderosa, permite fazer X, Y e Z...',
   true, 1),

  ('44444444-0202-0002-0000-000000000001', '33333333-0202-0000-0000-000000000001',
   'Storytelling com casos reais',
   'Usa exemplos de clientes similares para contextualizar benefícios.',
   1.5,
   ARRAY['um cliente similar','empresa como a vossa','caso real','resultados que vimos','exemplo concreto'],
   'Uma empresa de consultoria com perfil similar à vossa reduziu o tempo de onboarding em 40% com esta funcionalidade.',
   'Temos muitos clientes satisfeitos.',
   false, 2),

  ('44444444-0202-0003-0000-000000000001', '33333333-0202-0000-0000-000000000001',
   'Foco e ritmo adequados',
   'Não demonstra funcionalidades irrelevantes, mantém o fio condutor.',
   1.0,
   ARRAY['foco em','o que é mais relevante','deixo de parte','o que importa para vocês','não vamos perder tempo com'],
   'Há outras funcionalidades que posso mostrar mais tarde — hoje foco-me no que é mais relevante para vocês.',
   'E aqui temos o módulo de relatórios, e também temos X, Y, Z...',
   false, 3),

-- Secção 2.3: Validação Contínua
  ('44444444-0203-0001-0000-000000000001', '33333333-0203-0000-0000-000000000001',
   'Perguntas de validação durante a demo',
   'Para regularmente para verificar se a demo ressoa com o cliente.',
   2.0,
   ARRAY['faz sentido','isso resolve','o que acham','reconhecem','conseguem ver','ressoa','é parecido com'],
   'Conseguem ver como isto se aplicaria ao vosso processo de follow-up?',
   '[Apresenta 20 minutos sem parar para pedir feedback]',
   true, 1),

  ('44444444-0203-0002-0000-000000000001', '33333333-0203-0000-0000-000000000001',
   'Gestão de dúvidas em tempo real',
   'Responde a dúvidas sem perder o fio condutor da demo.',
   1.5,
   ARRAY['boa pergunta','respondendo a isso','voltando a','para não perdermos o fio','anoto para depois'],
   'Boa pergunta — respondo já a isso e depois continuamos. [responde e retoma]',
   'Deixe-me terminar e depois respondo a tudo.',
   false, 2),

-- Secção 2.4: Closing da Demo
  ('44444444-0204-0001-0000-000000000001', '33333333-0204-0000-0000-000000000001',
   'Resumo de valor personalizado',
   'Termina com resumo dos benefícios no contexto específico do cliente.',
   2.0,
   ARRAY['o que vimos hoje','benefício para vocês','impacto estimado','o que isto resolve no vosso caso','em resumo'],
   'Em resumo: com isto resolvem o problema X, poupam Y horas por semana e conseguem Z.',
   'Então, gostaram? Temos mais funcionalidades se quiserem ver.',
   false, 1),

  ('44444444-0204-0002-0000-000000000001', '33333333-0204-0000-0000-000000000001',
   'Próximo passo definido',
   'Fecha com acção concreta — proposta, piloto, ou reunião de decisão.',
   2.0,
   ARRAY['próximo passo','proposta','piloto','teste','reunião de decisão','avançar','quando podemos'],
   'Qual preferem como próximo passo: uma proposta formal ou um piloto de 2 semanas?',
   'Deixo-vos pensar e depois entram em contacto.',
   true, 2),

-- Secção 3.1: Resumo de Valor
  ('44444444-0301-0001-0000-000000000001', '33333333-0301-0000-0000-000000000001',
   'Recap do impacto acordado',
   'Resume o problema e o impacto quantificado identificados em reuniões anteriores.',
   2.0,
   ARRAY['como combinámos','recordando','o impacto que identificámos','custo actual','oportunidade de','o que discutimos'],
   'Como combinámos, o vosso custo actual de X é Y — e o objectivo é reduzir para Z.',
   'Então, estão prontos para avançar?',
   true, 1),

  ('44444444-0301-0002-0000-000000000001', '33333333-0301-0000-0000-000000000001',
   'Proposta centrada em ROI',
   'Apresenta a proposta em termos de retorno, não de funcionalidades ou preço isolado.',
   1.5,
   ARRAY['retorno','ROI','payback','poupança','receita adicional','investimento vs resultado','em X meses'],
   'O investimento é X por mês — com base no que discutimos, o retorno esperado é Y em 3 meses.',
   'O plano custa X e inclui estas funcionalidades...',
   false, 2),

-- Secção 3.2: Gestão de Objecções
  ('44444444-0302-0001-0000-000000000001', '33333333-0302-0000-0000-000000000001',
   'Acolhimento da objecção',
   'Valida e explora a objecção antes de responder, não rebate imediatamente.',
   2.0,
   ARRAY['percebo','faz sentido','ouço essa preocupação','pode expandir','o que está por trás','contexto dessa preocupação'],
   'Percebo essa preocupação — pode dizer-me mais sobre o que está por trás disso?',
   'Mas já vimos que o nosso produto resolve exactamente esse problema!',
   true, 1),

  ('44444444-0302-0002-0000-000000000001', '33333333-0302-0000-0000-000000000001',
   'Resposta com evidência',
   'Usa dados, casos ou demonstração concreta para responder à objecção.',
   2.0,
   ARRAY['dados mostram','cliente com situação similar','caso concreto','posso mostrar','estudo','evidência','resultados de'],
   'Temos um cliente com situação idêntica — posso partilhar os resultados deles?',
   'Não se preocupe com isso, somos os melhores do mercado.',
   true, 2),

  ('44444444-0302-0003-0000-000000000001', '33333333-0302-0000-0000-000000000001',
   'Verificação de resolução da objecção',
   'Confirma se a objecção foi endereçada antes de avançar.',
   1.5,
   ARRAY['isso resolve a dúvida','faz mais sentido agora','ficou mais claro','ainda há preocupações','responde à questão'],
   'Isso responde à vossa preocupação ou há algo que ainda não está claro?',
   '[Avança sem verificar se a objecção foi resolvida]',
   false, 3),

-- Secção 3.3: Fecho
  ('44444444-0303-0001-0000-000000000001', '33333333-0303-0000-0000-000000000001',
   'Pedido de decisão directo',
   'Pede a decisão claramente, sem hesitar ou deixar em aberto.',
   2.5,
   ARRAY['avançamos','podemos confirmar','o que falta para','assinatura','contrato','decisão hoje','o que precisam'],
   'Com base em tudo o que discutimos, o que falta para avançarmos hoje?',
   'Então... o que acham? Quando acham que conseguem decidir?',
   true, 1),

  ('44444444-0303-0002-0000-000000000001', '33333333-0303-0000-0000-000000000001',
   'Urgência baseada em factos',
   'Cria urgência com base em dados reais — datas de implementação, janelas de disponibilidade.',
   1.5,
   ARRAY['prazo de implementação','disponibilidade','inicio do trimestre','janela de','deadline real','para arrancarmos'],
   'Para arrancarmos no início de Maio, precisamos de confirmar até ao fim desta semana — é viável?',
   'Esta promoção termina hoje.',
   false, 2),

-- Secção 4.1: Alinhamento de Expectativas
  ('44444444-0401-0001-0000-000000000001', '33333333-0401-0000-0000-000000000001',
   'Objectivo e critério de sucesso',
   'Ambas as partes concordam com o que significa sucesso para este projecto.',
   2.0,
   ARRAY['objectivo do projecto','definição de sucesso','como saberemos','métricas','resultado esperado','KPI'],
   'Como saberemos, ao fim de 3 meses, que este projecto foi um sucesso para vocês?',
   'O objectivo é implementar o sistema até Junho.',
   true, 1),

  ('44444444-0401-0002-0000-000000000001', '33333333-0401-0000-0000-000000000001',
   'Restrições e dependências identificadas',
   'Levanta riscos, restrições técnicas ou organizacionais que possam bloquear o projecto.',
   1.5,
   ARRAY['restrição','dependência','bloqueio','aprovação necessária','sistema legado','equipa disponível','acesso a'],
   'Há alguma restrição técnica ou aprovação que possamos precisar que não tenhamos identificado?',
   'Deve correr tudo bem — começamos na próxima semana.',
   false, 2),

-- Secção 4.2: Governance & Processo
  ('44444444-0402-0001-0000-000000000001', '33333333-0402-0000-0000-000000000001',
   'Cadência de comunicação definida',
   'Estabelece com que frequência e através de que canal comunicam durante o projecto.',
   1.5,
   ARRAY['reunião semanal','ponto de situação','canal principal','Slack','email','relatório quinzenal','frequência'],
   'Proponho reunião semanal às terças + relatório escrito quinzenal. Faz sentido?',
   'Qualquer coisa me contactam.',
   false, 1),

  ('44444444-0402-0002-0000-000000000001', '33333333-0402-0000-0000-000000000001',
   'Responsáveis clarificados',
   'Cada área de responsabilidade tem um nome atribuído — sem ambiguidades.',
   2.0,
   ARRAY['responsável por','ponto de contacto','da vossa parte','da nossa parte','owner','quem trata de'],
   'Da vossa parte, quem é o responsável por aprovar entregas? Da nossa parte serei eu.',
   'Qualquer pessoa da equipa pode tratar disso.',
   true, 2),

  ('44444444-0402-0003-0000-000000000001', '33333333-0402-0000-0000-000000000001',
   'Processo de escalonamento acordado',
   'Define como resolver bloqueios não resolvidos em 48h.',
   1.0,
   ARRAY['escalonamento','bloqueio','se houver problema','quem contactar','resolve em','urgência'],
   'Se houver um bloqueio que não consigamos resolver em 48h, quem é o decisor a envolver?',
   'Se houver problemas vemos na altura.',
   false, 3),

-- Secção 4.3: Plano de Trabalho
  ('44444444-0403-0001-0000-000000000001', '33333333-0403-0000-0000-000000000001',
   'Fases e milestones validados',
   'O cliente confirma o plano de fases, entregas e datas.',
   2.0,
   ARRAY['fase','milestone','entrega','data prevista','valida','aprovação de fase','confirmam'],
   'Temos 3 fases — Fase 1 termina a 15 de Maio com entrega X. Confirmam que é exequível da vossa parte?',
   'O projecto tem 3 fases que vos envio depois.',
   true, 1),

  ('44444444-0403-0002-0000-000000000001', '33333333-0403-0000-0000-000000000001',
   'Responsabilidades do cliente no plano',
   'O cliente sabe o que tem de fazer para o plano avançar.',
   1.5,
   ARRAY['da vossa parte precisamos','acesso a','dados necessários','participação de','aprovação até','o que precisamos de vocês'],
   'Para cumprir a Fase 1, precisamos de acesso ao sistema X e de 2h da equipa Y na primeira semana.',
   'Da nossa parte tratamos de tudo.',
   true, 2),

-- Secção 4.4: Comprometimento Mútuo
  ('44444444-0404-0001-0000-000000000001', '33333333-0404-0000-0000-000000000001',
   'Comprometimento explícito de ambas as partes',
   'Ambas as partes confirmam verbalmente as suas responsabilidades.',
   2.0,
   ARRAY['confirmamos','ficamos de','da nossa parte comprometemo-nos','podem contar','acordo','alinhados','fica registado'],
   'Da nossa parte comprometemo-nos a entregar X. Da vossa, ficam de providenciar Y até Z. Estamos alinhados?',
   'Óptimo, então avancemos.',
   true, 1),

-- Secção 5.1: Check-in Inicial
  ('44444444-0501-0001-0000-000000000001', '33333333-0501-0000-0000-000000000001',
   'Check-in de energia e foco',
   'O mentor pergunta como o mentorado está e qual o tema prioritário para a sessão.',
   1.5,
   ARRAY['como estás','nível de energia','o que te traz hoje','foco desta sessão','o que está na cabeça','estado'],
   'Como estás hoje? Em que queres focar esta sessão?',
   'Então, vamos continuar de onde ficámos.',
   false, 1),

  ('44444444-0501-0002-0000-000000000001', '33333333-0501-0000-0000-000000000001',
   'Agenda negociada',
   'O mentor e o mentorado acordam no que é mais importante para trabalhar hoje.',
   1.0,
   ARRAY['o que é mais importante','prioridade desta sessão','o que faria mais diferença','foco em','escolhemos'],
   'Tens dois temas — qual faria mais diferença trabalhar hoje?',
   'Vamos então falar de X como planeei.',
   false, 2),

-- Secção 5.2: Revisão de Comprometimentos
  ('44444444-0502-0001-0000-000000000001', '33333333-0502-0000-0000-000000000001',
   'Revisão de acções prometidas',
   'Revê o que foi comprometido na sessão anterior sem julgamento.',
   2.0,
   ARRAY['na última sessão','ficaste de','o que aconteceu com','comprometimento anterior','acção que tomaste','como correu'],
   'Na última sessão ficaste de fazer X — o que aconteceu?',
   'Bem, hoje vou partilhar algumas ideias novas...',
   true, 1),

  ('44444444-0502-0002-0000-000000000001', '33333333-0502-0000-0000-000000000001',
   'Aprendizagem da não-execução',
   'Quando algo não foi feito, explora o porquê sem julgamento ou pressão.',
   1.5,
   ARRAY['o que impediu','aprendizagem','o que farias diferente','bloqueio','resistência','o que é que isto te diz'],
   'O que te impediu de avançar? O que aprendes sobre ti com isso?',
   'Pois, é importante fazeres o que combinámos.',
   false, 2),

-- Secção 5.3: Sessão de Trabalho
  ('44444444-0503-0001-0000-000000000001', '33333333-0503-0000-0000-000000000001',
   'Escuta activa e perguntas poderosas',
   'O mentor escuta mais do que fala e usa perguntas abertas que expandem perspectivas.',
   2.5,
   ARRAY['o que pensas','como te sentes','o que te impede','qual seria a tua melhor decisão','e então','o que mais'],
   'O que pensas que devias fazer? O que te impede de avançar nessa direcção?',
   'Na minha experiência, o que deves fazer é...',
   true, 1),

  ('44444444-0503-0002-0000-000000000001', '33333333-0503-0000-0000-000000000001',
   'Chegada a insight ou decisão',
   'A sessão produz uma clareza, decisão ou acção que o mentorado articula com as suas palavras.',
   2.0,
   ARRAY['percebi que','a minha decisão é','ficou claro','o que vou fazer','insight','descoberta','agora entendo'],
   'Então, o que ficou mais claro para ti desta conversa?',
   '[Sessão termina sem que o mentorado articule o que aprendeu]',
   true, 2),

  ('44444444-0503-0003-0000-000000000001', '33333333-0503-0000-0000-000000000001',
   'Foco no mentorado, não no mentor',
   'O mentor partilha experiência própria apenas quando directamente relevante e em dose limitada.',
   1.5,
   ARRAY['o que funciona para ti','a tua perspectiva','o que tu acreditas','o que te faz sentido','no teu caso'],
   'O que faz mais sentido para o teu contexto específico?',
   'Vou contar-te o que eu fiz quando tive este problema...',
   false, 3),

-- Secção 5.4: Comprometimentos para a Próxima
  ('44444444-0504-0001-0000-000000000001', '33333333-0504-0000-0000-000000000001',
   'Comprometimentos SMART',
   'As acções para a próxima sessão são específicas, mensuráveis e com prazo definido.',
   2.0,
   ARRAY['até','específico','vou fazer X até Y','fico de','comprometimento','acção concreta','data limite'],
   'Fico de falar com o meu gestor até sexta-feira e reportar o resultado na próxima sessão.',
   'Vou tentar trabalhar nisso.',
   true, 1),

  ('44444444-0504-0002-0000-000000000001', '33333333-0504-0000-0000-000000000001',
   'Acompanhamento definido',
   'Define como o mentor vai acompanhar os comprometimentos entre sessões.',
   1.0,
   ARRAY['vou verificar','manda-me','ponto intermédio','acompanhamento','check-in rápido','antes da próxima'],
   'Manda-me uma mensagem até quarta a dizer como correu a conversa com o teu gestor.',
   'Então vemo-nos na próxima sessão.',
   false, 2),

-- Secção 6.1: Revisão de Resultados
  ('44444444-0601-0001-0000-000000000001', '33333333-0601-0000-0000-000000000001',
   'Performance vs KPIs acordados',
   'Revê os dados com o cliente e pede a sua leitura antes de comentar.',
   2.0,
   ARRAY['vs objectivo','alcançámos','ficámos abaixo','resultado de','KPI','o que os dados dizem','na vossa leitura'],
   'Alcançámos 87% do objectivo de leads — na vossa leitura, o que contribuiu mais para isso?',
   'Os resultados estão aqui no slide — passemos ao próximo trimestre.',
   true, 1),

  ('44444444-0601-0002-0000-000000000001', '33333333-0601-0000-0000-000000000001',
   'Celebração de wins',
   'Reconhece os sucessos do trimestre antes de focar nos gaps.',
   1.0,
   ARRAY['celebrar','conseguimos','ponto positivo','o que correu bem','win','conquista','destaque'],
   'Antes de vermos o que podemos melhorar, quero destacar 3 coisas que correram muito bem.',
   '[Passa directamente para os problemas sem reconhecer sucessos]',
   false, 2),

-- Secção 6.2: Saúde da Conta
  ('44444444-0602-0001-0000-000000000001', '33333333-0602-0000-0000-000000000001',
   'NPS / satisfação qualitativa',
   'Pergunta directamente pela satisfação e acolhe feedback crítico com abertura.',
   2.0,
   ARRAY['satisfação','NPS','pontuação','o que não está bem','feedback honesto','melhorar','o que podemos fazer melhor'],
   'De 0 a 10, quanto nos recomendaria? O que poderíamos fazer para subir 1 ponto?',
   'Estamos satisfeitos com a vossa satisfação — avancemos.',
   true, 1),

  ('44444444-0602-0002-0000-000000000001', '33333333-0602-0000-0000-000000000001',
   'Identificação de riscos de continuidade',
   'Detecta sinais de churn ou mudança de contexto organizacional.',
   1.5,
   ARRAY['mudança','orçamento','reorganização','prioridades mudaram','novo responsável','pressão interna','contexto mudou'],
   'Há alguma mudança interna — orçamento, equipa, prioridades — que deva conhecer?',
   'Então renovamos o contrato como habitualmente?',
   false, 2),

-- Secção 6.3: Planeamento Q+1
  ('44444444-0603-0001-0000-000000000001', '33333333-0603-0000-0000-000000000001',
   'Objectivos Q+1 co-criados',
   'Os objectivos do próximo trimestre são definidos com o cliente, não impostos.',
   2.0,
   ARRAY['Q+1','próximo trimestre','objectivo para','o que querem alcançar','prioridade de','foco em','diferente'],
   'O que querem alcançar no próximo trimestre que seja diferente do que fizemos até agora?',
   'Os objectivos do próximo trimestre são estes — confirmam?',
   true, 1),

  ('44444444-0603-0002-0000-000000000001', '33333333-0603-0000-0000-000000000001',
   'Iniciativas e responsabilidades definidas',
   'Define quem faz o quê para atingir os objectivos do trimestre.',
   1.5,
   ARRAY['iniciativa','responsável','da nossa parte','da vossa parte','acção para','quem lidera','fica de fazer'],
   'Para atingir X, proponho que da nossa parte façamos A e da vossa parte B. Faz sentido?',
   'Vamos ver o que fazemos no próximo trimestre.',
   false, 2),

-- Secção 6.4: Fidelização
  ('44444444-0604-0001-0000-000000000001', '33333333-0604-0000-0000-000000000001',
   'Oportunidade de expansão identificada',
   'Detecta e apresenta uma oportunidade de upsell ou cross-sell relevante para o contexto actual.',
   1.5,
   ARRAY['oportunidade de','expansão','novo módulo','outra área','crescer com','próximo passo de parceria','faz sentido explorar'],
   'Com base no que cresceram este trimestre, faz sentido explorar X — seria relevante para vocês?',
   'E temos este outro produto que podem considerar.',
   false, 1),

-- Secção 7.1: Abertura Sem Pressão
  ('44444444-0701-0001-0000-000000000001', '33333333-0701-0000-0000-000000000001',
   'Abertura sem referência a tentativas anteriores',
   'Retoma o contacto sem mencionar follow-ups ignorados ou sensação de perseguição.',
   1.5,
   ARRAY['queria partilhar','lembrei-me de vocês','novo contexto','algo relevante','motivo do contacto','queria perceber'],
   'Queria partilhar algo que acredito ser relevante para vocês neste momento.',
   'Já tentei contactar várias vezes — finalmente consegui falar consigo.',
   false, 1),

  ('44444444-0701-0002-0000-000000000001', '33333333-0701-0000-0000-000000000001',
   'Tom de parceria, não de urgência de fecho',
   'Posiciona o contacto como interesse genuíno no cliente, não como pressão para fechar.',
   1.5,
   ARRAY['como têm estado','como está a correr','actualização do vosso lado','curiosidade','partilhar','perceber'],
   'Queria perceber como têm estado e se o contexto que discutimos mudou de alguma forma.',
   'Queria perceber se estão prontos para avançar agora.',
   false, 2),

-- Secção 7.2: Diagnóstico do Que Mudou
  ('44444444-0702-0001-0000-000000000001', '33333333-0702-0000-0000-000000000001',
   'Diagnóstico de contexto actual',
   'Percebe o que mudou na empresa ou nas prioridades desde a última conversa.',
   2.0,
   ARRAY['desde que falámos','o que mudou','contexto actual','prioridades hoje','como está agora','entretanto'],
   'Desde que falámos em Outubro, o que mudou nas vossas prioridades de vendas?',
   'O nosso produto é o mesmo — continua a ser uma boa opção para vocês.',
   true, 1),

  ('44444444-0702-0002-0000-000000000001', '33333333-0702-0000-0000-000000000001',
   'Razão de paragem explorada',
   'Pergunta o que levou à paragem do processo anterior sem julgamento.',
   1.5,
   ARRAY['o que aconteceu','por que pararam','o que mudou na altura','decisão de não avançar','o que estava em jogo'],
   'O que aconteceu na altura que levou a não avançarmos? Quero perceber para podermos ser mais úteis agora.',
   'Não sei porque é que não avançaram — o produto é excelente.',
   false, 2),

-- Secção 7.3: Re-apresentação de Valor
  ('44444444-0703-0001-0000-000000000001', '33333333-0703-0000-0000-000000000001',
   'Novo ângulo de valor',
   'Apresenta algo novo — caso de sucesso, funcionalidade ou resultado — não o mesmo pitch.',
   2.0,
   ARRAY['novidade','desde então','caso recente','evoluímos','novo resultado','diferente do que mostrámos','entretanto lançámos'],
   'Desde que falámos, temos um caso de uma empresa igual à vossa — posso partilhar o que conseguiram?',
   'O nosso produto continua a ser a melhor solução para o vosso problema.',
   true, 1),

  ('44444444-0703-0002-0000-000000000001', '33333333-0703-0000-0000-000000000001',
   'Ligação ao contexto actual do cliente',
   'Liga o valor apresentado ao que aprendeu sobre o contexto actual do cliente.',
   1.5,
   ARRAY['dado o que partilhaste','com base no que mudou','no vosso contexto actual','para a vossa situação de hoje','dado isso'],
   'Dado que agora têm uma equipa maior, isto é ainda mais relevante do que quando falámos.',
   'Como disse, a solução serve para qualquer empresa.',
   false, 2),

-- Secção 7.4: Próximo Passo Concreto
  ('44444444-0704-0001-0000-000000000001', '33333333-0704-0000-0000-000000000001',
   'Proposta de baixo compromisso',
   'O próximo passo proposto é fácil de aceitar — não pede uma decisão imediata.',
   2.0,
   ARRAY['30 minutos','partilhar','sem compromisso','ver se faz sentido','explorar','fácil de cancelar','rápida chamada'],
   'Que tal 30 minutos para perceber se o contexto está diferente e se faz sentido explorar?',
   'Então quando é que conseguem tomar a decisão?',
   true, 1),

  ('44444444-0704-0002-0000-000000000001', '33333333-0704-0000-0000-000000000001',
   'Proposta com data concreta ou alternativa',
   'Fecha com data específica ou duas opções, em vez de deixar em aberto.',
   1.5,
   ARRAY['terça ou quarta','próxima semana','esta semana','duas opções','escolhem o que for melhor','qual funciona'],
   'Terça às 10h ou quarta às 15h — qual funciona melhor para si?',
   'Quando quiserem, estou disponível.',
   false, 2)

ON CONFLICT (id) DO NOTHING;
