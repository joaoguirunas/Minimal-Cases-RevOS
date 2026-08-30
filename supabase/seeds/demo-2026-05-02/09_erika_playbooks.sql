-- =====================================================================
-- Arquivo:  09_erika_playbooks.sql
-- Objetivo: Substituir todos os playbooks existentes pelos playbooks
--           da Erika (Corretor de Seguros — 1ª e 2ª Reunião)
-- Tabelas:  evaluation_criteria_results, evaluation_section_results,
--           meeting_evaluations, meeting_playbook_assignments,
--           playbooks, playbook_sections, playbook_criteria
-- Idempotente: verifica IDs fixos antes de executar
-- =====================================================================

DO $$
DECLARE
  v_existing int;
BEGIN
  -- Idempotência: pular se os playbooks da Erika já existem
  SELECT count(*) INTO v_existing
  FROM playbooks
  WHERE id IN (
    '55555555-0001-0000-0000-000000000001',
    '55555555-0002-0000-0000-000000000001'
  );

  IF v_existing >= 2 THEN
    RAISE NOTICE '09_erika_playbooks: playbooks já existem. Pulando.';
    RETURN;
  END IF;

  -- ── 1. Limpar dados de avaliação (ordem: RESTRICT constraints) ──────

  -- 1a. evaluation_criteria_results (FK → playbook_criteria: RESTRICT)
  DELETE FROM evaluation_criteria_results;

  -- 1b. evaluation_section_results (FK → playbook_sections: RESTRICT)
  DELETE FROM evaluation_section_results;

  -- 1c. meeting_evaluations (FK → playbooks: RESTRICT)
  DELETE FROM meeting_evaluations;

  -- 1d. meeting_records de seed
  DELETE FROM meeting_records
  WHERE meeting_id IN (
    SELECT id FROM meetings WHERE description LIKE '%DEMO_SEED_2026-05-02%'
  );

  -- 1e. meeting_playbook_assignments (FK → playbooks: RESTRICT)
  DELETE FROM meeting_playbook_assignments;

  -- ── 2. Apagar todos os playbooks (CASCADE → sections → criteria) ────
  DELETE FROM playbooks;

  RAISE NOTICE '09_erika_playbooks: dados anteriores limpos.';

  -- ── 3. Inserir playbooks da Erika ───────────────────────────────────

  INSERT INTO playbooks (id, name, type, description, is_active, is_default_for_type)
  VALUES
    ('55555555-0001-0000-0000-000000000001',
     'Corretor de Seguros — 1ª Reunião',
     'sales',
     'Playbook de Erika para a primeira reunião com cliente: conexão, diagnóstico de necessidade e compromisso com a segunda reunião.',
     true, true),
    ('55555555-0002-0000-0000-000000000001',
     'Corretor de Seguros — 2ª Reunião',
     'sales',
     'Playbook de Erika para a segunda reunião: validação, apresentação de solução, fechamento e pedido de recomendação.',
     true, false);

  -- ── 4. Seções — 1ª Reunião ──────────────────────────────────────────

  INSERT INTO playbook_sections (id, playbook_id, title, description, weight, display_order)
  VALUES
    ('66666666-0101-0000-0000-000000000001',
     '55555555-0001-0000-0000-000000000001',
     'Conexão e Quebra-Gelo Estratégico',
     'Criar conforto, gerar proximidade e abrir espaço emocional para o cliente participar da conversa com naturalidade. O foco é desarmar e conectar, não diagnosticar.',
     14, 1),

    ('66666666-0102-0000-0000-000000000001',
     '55555555-0001-0000-0000-000000000001',
     'Geração de Confiança',
     'Gerar identificação, proximidade e segurança emocional. Pitch pessoal humano + perguntas de vida pessoal sem entrar em financeiro.',
     14, 2),

    ('66666666-0103-0000-0000-000000000001',
     '55555555-0001-0000-0000-000000000001',
     'Geração de Credibilidade',
     'Materializar o trabalho do corretor com material visual, estrutura de trabalho e ancoragem institucional. SPIN leve de contexto profissional para transição ao diagnóstico.',
     14, 3),

    ('66666666-0104-0000-0000-000000000001',
     '55555555-0001-0000-0000-000000000001',
     'Despertar de Necessidade',
     'Levar o cliente à consciência de uma vulnerabilidade real. A dor deve sair da boca do cliente, não do corretor. Técnica do silêncio essencial.',
     15, 4),

    ('66666666-0105-0000-0000-000000000001',
     '55555555-0001-0000-0000-000000000001',
     'Levantamento Estratégico',
     'Coletar informações detalhadas da realidade financeira (família, renda, despesas, patrimônio) e aplicar pergunta de sentimento ao final.',
     15, 5),

    ('66666666-0106-0000-0000-000000000001',
     '55555555-0001-0000-0000-000000000001',
     'Geração de Curiosidade e Compromisso',
     'Agradecer + confidencialidade → posicionar personalização → gerar curiosidade (sem entregar solução) → agendar 2ª reunião com cônjuge.',
     14, 6),

    ('66666666-0107-0000-0000-000000000001',
     '55555555-0001-0000-0000-000000000001',
     'Pedido de Recomendação — 1ª Reunião',
     'Gerar novos leads qualificados através da recomendação. Usar concordância tácita, direcionar perfil e coletar nomes reais.',
     14, 7);

  -- ── 5. Seções — 2ª Reunião ──────────────────────────────────────────

  INSERT INTO playbook_sections (id, playbook_id, title, description, weight, display_order)
  VALUES
    ('66666666-0201-0000-0000-000000000001',
     '55555555-0002-0000-0000-000000000001',
     'Leitura de Cenário',
     'Entender o que aconteceu entre as reuniões: percepções, influências externas, objeções. Nunca avançar com objeção ativa.',
     14, 1),

    ('66666666-0202-0000-0000-000000000001',
     '55555555-0002-0000-0000-000000000001',
     'Validação das Informações',
     'Confirmar todos os dados coletados na 1ª reunião com o cliente. Elimina objeções futuras de "não é a minha realidade".',
     14, 2),

    ('66666666-0203-0000-0000-000000000001',
     '55555555-0002-0000-0000-000000000001',
     'Apresentação dos Gráficos',
     'Cenário atual, morte financeira e necessidade acumulada. Transformar emoção da 1ª reunião em convicção baseada em números reais.',
     15, 3),

    ('66666666-0204-0000-0000-000000000001',
     '55555555-0002-0000-0000-000000000001',
     'Apresentação da Solução',
     'Solução personalizada com fundamentação dos valores. Concordância tácita progressiva. Técnica do Desafio da Companhia. Transição direta para proposta sem perguntar.',
     15, 4),

    ('66666666-0205-0000-0000-000000000001',
     '55555555-0002-0000-0000-000000000001',
     'Preenchimento da Proposta',
     'Ordem: saúde → pessoal → beneficiários → financeiro. Parabenização reforça segurança da decisão.',
     14, 5),

    ('66666666-0206-0000-0000-000000000001',
     '55555555-0002-0000-0000-000000000001',
     'Tratamento de Objeções',
     'Ouvir sem reagir, isolar a objeção real, aplicar técnica (bumerangue, recapitulação, realidade) e retornar imediatamente ao fluxo.',
     14, 6),

    ('66666666-0207-0000-0000-000000000001',
     '55555555-0002-0000-0000-000000000001',
     'Pedido de Recomendação — 2ª Reunião',
     'Melhor momento do processo para pedir: cliente acabou de comprar, está validado emocionalmente e confia. Coleta estruturada de leads.',
     14, 7);

  -- ── 6. Critérios — 1ª Reunião ───────────────────────────────────────

  -- S1: Conexão e Quebra-Gelo
  INSERT INTO playbook_criteria (id, section_id, title, description, weight, detection_hints, example_good, example_bad, is_required, display_order)
  VALUES
    ('77777777-0101-0001-0000-000000000001',
     '66666666-0101-0000-0000-000000000001',
     'Início não técnico com perguntas leves e abertas',
     'Conversa começa sem pitch de produto. Tom natural, uso de perguntas abertas leves sobre contexto e rotina.',
     1.0,
     ARRAY['"Antes da gente começar…"', '"Queria te conhecer um pouquinho melhor…"', '"Como está sua rotina esses dias?"', '"O que te fez aceitar essa conversa?"'],
     'Conversa flui com leveza, cliente responde espontaneamente sobre contexto pessoal.',
     'Corretor entra direto em produto ou perguntas financeiras logo nos primeiros minutos.',
     true, 1),

    ('77777777-0101-0002-0000-000000000001',
     '66666666-0101-0000-0000-000000000001',
     'Referência à origem do contato',
     'Menciona quem indicou ou como o cliente chegou. Ativa confiança por associação e reduz resistência.',
     1.0,
     ARRAY['"Como você conhece o [nome]?"', '"Foi ele/ela que comentou sobre essa conversa?"', '"Vocês se conhecem há bastante tempo?"'],
     'Corretor menciona o indicador e usa como âncora de confiança para abrir a conversa.',
     'Corretor ignora a origem do contato ou não faz referência à indicação.',
     true, 2),

    ('77777777-0101-0003-0000-000000000001',
     '66666666-0101-0000-0000-000000000001',
     'Pergunta sobre expectativa da reunião',
     'Obrigatório: perguntar o que o cliente espera da conversa. Direciona toda a reunião a partir da resposta.',
     1.0,
     ARRAY['"O que você espera desse encontro?"', '"O que você gostaria de sair daqui entendendo melhor?"', '"O que te fez aceitar esse encontro?"'],
     'Pergunta feita com genuinidade, cliente responde com profundidade sobre expectativa.',
     'Etapa de expectativa pulada, corretor vai direto para apresentação.',
     true, 3);

  -- S2: Geração de Confiança
  INSERT INTO playbook_criteria (id, section_id, title, description, weight, detection_hints, example_good, example_bad, is_required, display_order)
  VALUES
    ('77777777-0102-0001-0000-000000000001',
     '66666666-0102-0000-0000-000000000001',
     'Pitch pessoal humano: história, propósito e toque pessoal',
     'Corretor se apresenta de forma humana com trajetória, motivação e elemento pessoal. Tom de conversa, não apresentação formal. Tempo: até 1 minuto.',
     1.0,
     ARRAY['"Deixa eu te contar um pouquinho sobre mim…"', '"Eu comecei nessa área porque…"', '"O que me motiva é…"', '"Minha família é…"'],
     'Pitch curto, humano, com história real e propósito claro. Cliente se identifica.',
     'Pitch técnico, longo, focado em números e resultados. Parece script decorado.',
     true, 1),

    ('77777777-0102-0002-0000-000000000001',
     '66666666-0102-0000-0000-000000000001',
     'Perguntas sobre vida pessoal — sem entrar em financeiro',
     'Perguntas abertas sobre família, momento de vida e rotina. Ausência total de perguntas sobre renda, organização financeira ou seguro nessa etapa.',
     1.0,
     ARRAY['"Você é casado(a)?"', '"Tem filhos?"', '"Como está seu momento hoje?"', '"Sua rotina hoje é mais puxada?"'],
     'Corretor explora contexto pessoal com interesse genuíno. Sem mencionar dinheiro, seguro ou produto.',
     'Corretor entra em perguntas financeiras ou de produto. Conversa vira interrogatório.',
     true, 2),

    ('77777777-0102-0003-0000-000000000001',
     '66666666-0102-0000-0000-000000000001',
     'Cliente fala mais do que o corretor',
     'Indicador de conexão: cliente começa a compartilhar com profundidade. Corretor escuta mais do que fala nessa etapa.',
     1.0,
     ARRAY['cliente responde com elaboração', 'client shares personal context', '"Ah, que interessante…" (validação)'],
     'Cliente fala mais de 50% do tempo nessa etapa. Respostas longas e espontâneas.',
     'Corretor domina a fala. Cliente responde com monossílabos. Falta conexão.',
     true, 3);

  -- S3: Geração de Credibilidade
  INSERT INTO playbook_criteria (id, section_id, title, description, weight, detection_hints, example_good, example_bad, is_required, display_order)
  VALUES
    ('77777777-0103-0001-0000-000000000001',
     '66666666-0103-0000-0000-000000000001',
     'Uso de material visual compartilhado',
     'Apresentação, PDF ou tela compartilhada. Ativa gatilhos de realidade, estrutura e confiabilidade.',
     1.0,
     ARRAY['"Vou compartilhar minha tela com você…"', '"Deixa eu te mostrar rapidamente…"', '"Tenho um material aqui…"'],
     'Material visual presente: cliente vê algo organizado, com logomarca e estrutura clara.',
     'Conversa toda "no boca a boca", sem nenhum material visual. Parece improviso.',
     true, 1),

    ('77777777-0103-0002-0000-000000000001',
     '66666666-0103-0000-0000-000000000001',
     'Explicação da estrutura de trabalho (consultoria)',
     'Corretor explica como trabalha: processo, personalização e continuidade. Posiciona como consultor, não vendedor.',
     1.0,
     ARRAY['"Meu trabalho não é vender um produto, é estruturar uma solução…"', '"Cada cliente é analisado de forma individual…"', '"Acompanho você ao longo do tempo…"'],
     'Processo explicado com clareza: etapas, personalização e acompanhamento contínuo.',
     'Corretor foca só na empresa ou no produto. Não explica como pensa e trabalha.',
     true, 2),

    ('77777777-0103-0003-0000-000000000001',
     '66666666-0103-0000-0000-000000000001',
     'Citação e ancoragem institucional da companhia',
     'Menciona a companhia/seguradora com dados concretos (tempo de mercado, porte, presença). Reduz percepção de risco.',
     1.0,
     ARRAY['"Hoje eu trabalho com a companhia…"', '"É uma empresa com X anos de mercado…"', '"Tem presença em…"', '"Atende milhões de clientes…"'],
     'Companhia citada com dados concretos que geram segurança. Tom informativo, não exagerado.',
     'Companhia não mencionada ou citada sem nenhum dado de sustentação.',
     true, 3);

  -- S4: Despertar de Necessidade
  INSERT INTO playbook_criteria (id, section_id, title, description, weight, detection_hints, example_good, example_bad, is_required, display_order)
  VALUES
    ('77777777-0104-0001-0000-000000000001',
     '66666666-0104-0000-0000-000000000001',
     'Construção da linha da vida do cliente',
     'Corretor organiza a trajetória do cliente: início da carreira, conquistas, estrutura familiar. Faz o cliente perceber o valor do que construiu.',
     1.0,
     ARRAY['"Com quantos anos você começou a trabalhar?"', '"Já são X anos construindo sua vida…"', '"Nesse tempo você já conquistou o quê?"'],
     'Linha da vida construída com dados reais do cliente. Cliente reconhece e valoriza o que construiu.',
     'Etapa pulada. Corretor vai direto para perguntas de risco sem contextualizar a vida do cliente.',
     true, 1),

    ('77777777-0104-0002-0000-000000000001',
     '66666666-0104-0000-0000-000000000001',
     'Perguntas hipotéticas e de implicação emocional',
     'Perguntas estruturadas sobre cenários de risco que ativam reflexão e impacto real. Sem exagero (terror psicológico penalizado).',
     1.0,
     ARRAY['"Numa situação hipotética…"', '"Se você não pudesse mais gerar renda…"', '"Como ficaria a sua família?"', '"Você está preparado pra isso hoje?"'],
     'Perguntas fazem o cliente entrar em reflexão profunda. Tom de respeito e leveza.',
     'Perguntas superficiais ou exagero no medo. Corretor faz o discurso da dor sem perguntar.',
     true, 2),

    ('77777777-0104-0003-0000-000000000001',
     '66666666-0104-0000-0000-000000000001',
     'Técnica do silêncio e verbalização da dor pelo cliente',
     'Após pergunta relevante, corretor mantém silêncio (3-8 seg). Etapa só completa quando cliente verbaliza despreparo com as próprias palavras.',
     1.0,
     ARRAY['"Nunca parei pra pensar nisso…"', '"Não estou preparado…"', '"Isso seria complicado…"', '"Realmente… isso é um problema…"'],
     'Silêncio usado conscientemente. Cliente demora antes de responder. Dor verbalizada pelo próprio cliente.',
     'Corretor preenche os silêncios, ajuda o cliente a responder ou verbaliza a dor por ele.',
     true, 3);

  -- S5: Levantamento Estratégico
  INSERT INTO playbook_criteria (id, section_id, title, description, weight, detection_hints, example_good, example_bad, is_required, display_order)
  VALUES
    ('77777777-0105-0001-0000-000000000001',
     '66666666-0105-0000-0000-000000000001',
     'Uso de estrutura/formulário para coleta',
     'Corretor usa formulário ou roteiro estruturado. Posiciona processo como sério, analítico e personalizado.',
     1.0,
     ARRAY['"Vou pegar algumas informações com você…"', '"Pra montar um planejamento dentro da sua realidade…"', '"No nosso próximo encontro eu te trago isso estruturado…"'],
     'Coleta organizada com formulário. Cliente entende que existe análise, não venda imediata.',
     'Coleta aleatória sem estrutura. Informações superficiais. Parecer improviso.',
     true, 1),

    ('77777777-0105-0002-0000-000000000001',
     '66666666-0105-0000-0000-000000000001',
     'Cobertura de múltiplas dimensões financeiras',
     'Exploração completa: estrutura familiar, educação, despesas mensais, dívidas, renda, patrimônio e seguros existentes.',
     1.0,
     ARRAY['"Hoje, quanto você tem de custo fixo mensal?"', '"Você tem alguma dívida hoje?"', '"Você já tem alguma reserva?"', '"Você já possui algum seguro hoje?"'],
     'Todas as dimensões cobertas. Coleta profunda e detalhada. Cliente compartilha realidade real.',
     'Coleta superficial. Dimensões importantes puladas. Dados insuficientes para planejamento.',
     true, 2),

    ('77777777-0105-0003-0000-000000000001',
     '66666666-0105-0000-0000-000000000001',
     'Pergunta de sentimento ao final (aberta)',
     'Pergunta obrigatória ao encerrar a coleta. Deve ser aberta — revela objeções ocultas e nível de envolvimento.',
     1.0,
     ARRAY['"Diante de tudo o que a gente conversou… o que você sente a respeito?"', '"O que passou pela sua cabeça?"'],
     'Pergunta aberta que provoca elaboração. Resposta do cliente revela sentimento real.',
     'Corretor usa pergunta fechada: "Fez sentido?" ou "Você gostou?" — não revela pensamento real.',
     true, 3);

  -- S6: Geração de Curiosidade e Compromisso
  INSERT INTO playbook_criteria (id, section_id, title, description, weight, detection_hints, example_good, example_bad, is_required, display_order)
  VALUES
    ('77777777-0106-0001-0000-000000000001',
     '66666666-0106-0000-0000-000000000001',
     'Frases de curiosidade sem entregar a solução',
     'Cria tensão positiva e expectativa. Corretor NÃO explica a solução, NÃO ensina. Apenas desperta desejo.',
     1.0,
     ARRAY['"Eu tenho certeza que você vai se surpreender muito positivamente…"', '"É diferente de tudo que você já viu…"', '"Quando você enxergar isso, vai fazer muito sentido…"'],
     'Corretor desperta curiosidade sem revelar solução. Cliente quer saber mais.',
     'Corretor explica demais, antecipa a solução ou já começa a ensinar. Mata a curiosidade.',
     true, 1),

    ('77777777-0106-0002-0000-000000000001',
     '66666666-0106-0000-0000-000000000001',
     'Agendamento confirmado da próxima reunião',
     'Reunião só termina quando a próxima está marcada. Condução ativa — não deixa "ver depois".',
     1.0,
     ARRAY['"Vamos já deixar um horário agendado?"', '"Qual dia da próxima semana funciona melhor pra você?"', '"No nosso próximo encontro…"'],
     'Data e hora da próxima reunião confirmadas dentro da mesma chamada.',
     'Reunião encerrada sem agendamento. Cliente sai com "te mando mensagem" ou similar.',
     true, 2),

    ('77777777-0106-0003-0000-000000000001',
     '66666666-0106-0000-0000-000000000001',
     'Inclusão do cônjuge/decisores na próxima reunião',
     'Solicita presença dos decisores na segunda reunião. Reduz objeções de "preciso falar com minha esposa".',
     1.0,
     ARRAY['"Esse é um momento importante, então é interessante que seu cônjuge esteja junto…"', '"Se puder trazer a [pessoa] na próxima…"'],
     'Inclusão do cônjuge ou decisor solicitada de forma natural e bem posicionada.',
     'Não menciona cônjuge. Deixa decisores de fora da próxima reunião.',
     true, 3);

  -- S7: Pedido de Recomendação — 1ª Reunião
  INSERT INTO playbook_criteria (id, section_id, title, description, weight, detection_hints, example_good, example_bad, is_required, display_order)
  VALUES
    ('77777777-0107-0001-0000-000000000001',
     '66666666-0107-0000-0000-000000000001',
     'Pedido com técnica de concordância tácita',
     'Antes de pedir, cria sequência de "sim" do cliente. Posiciona o pedido como convite, não favor.',
     1.0,
     ARRAY['"Foi possível você entender como funciona o meu trabalho?"', '"Assim como você foi recomendado por alguém que se importa…"'],
     'Pedido feito após validação positiva. Tom de convite com valor emocional.',
     'Pedido genérico e seco: "Você pode me indicar alguém?" — sem preparação emocional.',
     true, 1),

    ('77777777-0107-0002-0000-000000000001',
     '66666666-0107-0000-0000-000000000001',
     'Direcionamento de perfil e coleta de nomes reais',
     'Não pede qualquer lead. Direciona perfil (família, renda, momento de vida) e coleta nomes, profissão e proximidade.',
     1.0,
     ARRAY['"Quem são 2 ou 3 pessoas que você gosta e acredita que isso faria diferença?"', '"Quem vem na sua cabeça agora?"', '"O que ela faz hoje?"'],
     'Perfil direcionado. Nomes reais coletados com contexto. Lead qualificado.',
     'Pedido vago sem direcionamento. Cliente responde "não sei agora" ou nomeia leads frios.',
     true, 2),

    ('77777777-0107-0003-0000-000000000001',
     '66666666-0107-0000-0000-000000000001',
     'Facilitação da indicação (script ou permissão de contato)',
     'Remove a fricção: oferece mensagem pronta ou pergunta se pode mencionar o nome do cliente ao contato.',
     1.0,
     ARRAY['"Posso falar que foi você que me indicou?"', '"Você prefere me conectar ou eu entro em contato direto?"', '"Eu gostaria de te dar a oportunidade de presentear…"'],
     'Indicação facilitada com mensagem pronta ou permissão de contato. Alta conversão esperada.',
     'Depende do cliente lembrar depois. Sem facilitação. Indicação fica no abstrato.',
     true, 3);

  -- ── 7. Critérios — 2ª Reunião ───────────────────────────────────────

  -- S1: Leitura de Cenário
  INSERT INTO playbook_criteria (id, section_id, title, description, weight, detection_hints, example_good, example_bad, is_required, display_order)
  VALUES
    ('77777777-0201-0001-0000-000000000001',
     '66666666-0201-0000-0000-000000000001',
     'Perguntas abertas sobre o intervalo entre reuniões',
     'Explora o que aconteceu após a 1ª reunião: pensamentos, conversas, pesquisas. Sem indução.',
     1.0,
     ARRAY['"Da nossa última conversa pra hoje… o que passou pela sua cabeça?"', '"Você chegou a conversar com alguém?"', '"Você pesquisou algo sobre isso?"'],
     'Corretor abre o cliente com perguntas abertas antes de apresentar qualquer coisa.',
     'Corretor vai direto para a apresentação sem verificar o estado emocional do cliente.',
     true, 1),

    ('77777777-0201-0002-0000-000000000001',
     '66666666-0201-0000-0000-000000000001',
     'Escuta ativa sem interrupção ou defesa',
     'Corretor ouve o cliente sem rebater, defender ou interromper. Apenas escuta e observa.',
     1.0,
     ARRAY['cliente fala mais que o corretor', 'corretor valida antes de responder', '"Entendo…" "Faz sentido você pensar isso…"'],
     'Corretor escuta completamente antes de falar. Não interrompe nem defende na primeira objeção.',
     'Corretor interrompe, defende a solução ou rebate diretamente a preocupação do cliente.',
     true, 2),

    ('77777777-0201-0003-0000-000000000001',
     '66666666-0201-0000-0000-000000000001',
     'Tratamento de objeção antes de avançar',
     'Regra de ouro: nunca apresentar com objeção ativa. Se houver objeção, tratá-la antes de continuar.',
     1.0,
     ARRAY['"Deixa eu te explicar um ponto importante sobre isso…"', '"Agora olhando por esse lado, faz mais sentido pra você?"', 'confirmação explícita antes de avançar'],
     'Objeção identificada, tratada e cliente confirma alinhamento antes de a apresentação começar.',
     'Corretor avança para a apresentação ignorando sinais de resistência do cliente.',
     true, 3);

  -- S2: Validação das Informações
  INSERT INTO playbook_criteria (id, section_id, title, description, weight, detection_hints, example_good, example_bad, is_required, display_order)
  VALUES
    ('77777777-0202-0001-0000-000000000001',
     '66666666-0202-0000-0000-000000000001',
     'Transição estratégica antes de mostrar a solução',
     'Posiciona validação como cuidado profissional, não burocracia. Faz o cliente entender que é personalizado.',
     1.0,
     ARRAY['"Antes de te mostrar o planejamento…"', '"Eu quero validar com você algumas informações…"', '"Pra garantir que está 100% dentro da sua realidade…"'],
     'Transição clara e bem posicionada. Cliente entende o propósito antes de ver os dados.',
     'Corretor entra direto na análise ou na solução sem validar os dados coletados.',
     true, 1),

    ('77777777-0202-0002-0000-000000000001',
     '66666666-0202-0000-0000-000000000001',
     'Confirmação ativa dos dados pelo cliente',
     'Cada bloco de dados confirmado explicitamente pelo cliente. Cria autorresponsabilidade.',
     1.0,
     ARRAY['"Essas informações estão corretas pra você?"', '"Faz sentido dentro da sua realidade hoje?"', '"Está fiel ao que você vive hoje?"'],
     'Cliente confirma cada bloco de dados. Participação ativa. Dados 100% validados.',
     'Dados apresentados sem confirmação. Cliente passivo. Risco alto de objeção futura.',
     true, 2),

    ('77777777-0202-0003-0000-000000000001',
     '66666666-0202-0000-0000-000000000001',
     'Amarração: compromisso com a própria realidade',
     'Após validação, corretor ancora que "esse é o seu cenário". Cliente assume a realidade e perde espaço para objeção de valor.',
     1.0,
     ARRAY['"Perfeito, então esse é o seu cenário hoje…"', '"Isso representa exatamente a sua realidade…"', '"Com base nisso, eu vou te mostrar agora…"'],
     'Cliente concorda explicitamente com o cenário. Compromisso implícito com a própria realidade.',
     'Corretor passa para a solução sem amarrar o cliente na realidade validada.',
     true, 3);

  -- S3: Apresentação dos Gráficos
  INSERT INTO playbook_criteria (id, section_id, title, description, weight, detection_hints, example_good, example_bad, is_required, display_order)
  VALUES
    ('77777777-0203-0001-0000-000000000001',
     '66666666-0203-0000-0000-000000000001',
     'Apresentação do cenário atual (estabilidade)',
     'Primeiro gráfico: cliente está bem hoje. Gera identificação sem criar dor prematura.',
     1.0,
     ARRAY['"Esse primeiro gráfico mostra a sua realidade atual…"', '"Aqui comparando custo de vida com capacidade de geração de renda…"', '"Hoje você sente que está confortável…?"'],
     'Cliente se vê no gráfico. Corretor gera identificação antes de entrar no cenário de risco.',
     'Corretor pula o cenário atual e vai direto para morte financeira. Impacto sem base.',
     true, 1),

    ('77777777-0203-0002-0000-000000000001',
     '66666666-0203-0000-0000-000000000001',
     'Apresentação da morte financeira com impacto emocional',
     'Cenário onde o cliente perde capacidade produtiva mas mantém despesas. Perguntas de impacto sem terror psicológico.',
     1.0,
     ARRAY['"Aqui a gente tira a sua capacidade de gerar renda…"', '"Você continua tendo despesas mas perde a renda…"', '"Você gostaria de depender de alguém?"'],
     'Impacto emocional real. Cliente reage com reflexão. Tom respeitoso, não assustador.',
     'Apresentação técnica e fria. Sem emoção. Cliente não se conecta com o cenário.',
     true, 2),

    ('77777777-0203-0003-0000-000000000001',
     '66666666-0203-0000-0000-000000000001',
     'Perguntas reflexivas conectadas à realidade do cliente',
     'Após cada gráfico, perguntas que fazem o cliente ver-se no cenário. Usa dados que o cliente mesmo forneceu.',
     1.0,
     ARRAY['"Você tem esse valor hoje disponível?"', '"Como você se sentiria tendo que reduzir seu padrão de vida?"', '"Você está preparado para parar de trabalhar hoje?"'],
     'Perguntas personalizadas com dados do cliente. Reação visível — pausas, tom emocional.',
     'Apresentação de números sem perguntas. Cliente assiste passivamente sem conexão.',
     true, 3);

  -- S4: Apresentação da Solução
  INSERT INTO playbook_criteria (id, section_id, title, description, weight, detection_hints, example_good, example_bad, is_required, display_order)
  VALUES
    ('77777777-0204-0001-0000-000000000001',
     '66666666-0204-0000-0000-000000000001',
     'Posicionamento e fundamentação da solução',
     'Solução apresentada como personalizada. Cada valor fundamentado com dados reais do cliente: família, despesas, patrimônio.',
     1.0,
     ARRAY['"Com base em tudo que você me trouxe…"', '"Eu trouxe esse valor de X porque… você me disse que…"', '"Esse valor cobre exatamente…"'],
     'Números têm lógica clara conectada à realidade do cliente. Não parecem arbitrários.',
     'Valores apresentados sem justificativa. Cliente questiona a origem dos números.',
     true, 1),

    ('77777777-0204-0002-0000-000000000001',
     '66666666-0204-0000-0000-000000000001',
     'Concordância tácita progressiva',
     'Após cada benefício, corretor pergunta "faz sentido?" e aguarda o sim antes de continuar. Fechamento invisível.',
     1.0,
     ARRAY['"Faz sentido pra você?"', 'cliente responde sim após cada benefício', 'progressão de validações'],
     'Série de "sim" construída progressivamente. Cliente valida a solução antes de ver o preço.',
     'Corretor apresenta tudo de uma vez sem pausas para validação. Sem concordância tácita.',
     true, 2),

    ('77777777-0204-0003-0000-000000000001',
     '66666666-0204-0000-0000-000000000001',
     'Transição direta para proposta sem perguntar se quer fechar',
     'Após validação completa, corretor conduz para proposta assumindo continuidade. Não pergunta "você quer?".',
     1.0,
     ARRAY['"A partir de agora, a gente vai preencher uma proposta…"', '"Pra gente enviar pra companhia…"', '"Me fala uma coisa… quando foi a última vez que você foi ao médico?"'],
     'Fluxo contínuo sem quebra. Cliente segue naturalmente para proposta.',
     'Corretor pergunta "você quer fechar?" ou "o que você acha?". Quebra o fluxo e abre espaço para objeção.',
     true, 3);

  -- S5: Preenchimento da Proposta
  INSERT INTO playbook_criteria (id, section_id, title, description, weight, detection_hints, example_good, example_bad, is_required, display_order)
  VALUES
    ('77777777-0205-0001-0000-000000000001',
     '66666666-0205-0000-0000-000000000001',
     'Ordem correta de preenchimento',
     'Sequência: saúde → dados pessoais → família/beneficiários → financeiro. Financeiro sempre por último.',
     1.0,
     ARRAY['"Quando foi a última vez que você foi ao médico?"', '"Faz uso de algum medicamento?"', '"Quem você gostaria de proteger?"'],
     'Preenchimento começa pela saúde. Financeiro aparece apenas no final, quando cliente já está comprometido.',
     'Preenchimento começa pelo pagamento ou dados financeiros. Ativa resistência prematura.',
     true, 1),

    ('77777777-0205-0002-0000-000000000001',
     '66666666-0205-0000-0000-000000000001',
     'Beneficiários com reforço emocional',
     'Perguntas sobre beneficiários reconectam o cliente ao propósito da decisão: família e proteção.',
     1.0,
     ARRAY['"Quem você gostaria de proteger?"', '"Quem receberia esse valor?"', '"Quem são as pessoas mais importantes pra você?"'],
     'Cliente responde com emoção sobre beneficiários. Propósito da decisão reforçado naturalmente.',
     'Beneficiários preenchidos de forma burocrática sem conexão emocional.',
     true, 2),

    ('77777777-0205-0003-0000-000000000001',
     '66666666-0205-0000-0000-000000000001',
     'Parabenização e reforço da decisão',
     'Após proposta preenchida, corretor parabeniza e ancora o valor da decisão. Evita arrependimento pós-decisão.',
     1.0,
     ARRAY['"Quero te parabenizar por essa decisão…"', '"Você está colocando sua família em primeiro lugar…"', '"Poucas pessoas têm essa consciência…"'],
     'Parabenização genuína. Cliente sai seguro da decisão. Tom de celebração.',
     'Proposta preenchida sem reforço. Cliente sai inseguro ou com dúvida sobre a decisão.',
     true, 3);

  -- S6: Tratamento de Objeções
  INSERT INTO playbook_criteria (id, section_id, title, description, weight, detection_hints, example_good, example_bad, is_required, display_order)
  VALUES
    ('77777777-0206-0001-0000-000000000001',
     '66666666-0206-0000-0000-000000000001',
     'Ouve sem reagir e isola a objeção real',
     'Primeira resposta é silêncio e escuta. Depois pergunta para entender a objeção real por trás da superficial.',
     1.0,
     ARRAY['"O que exatamente te fez pensar nisso?"', '"Quando você diz isso, está relacionado ao quê exatamente?"', 'pausa antes de responder'],
     'Corretor para, ouve completamente e faz perguntas para entender a objeção real.',
     'Corretor interrompe, rebate imediatamente ou fica na defensiva ao ouvir a objeção.',
     true, 1),

    ('77777777-0206-0002-0000-000000000001',
     '66666666-0206-0000-0000-000000000001',
     'Aplica técnica de tratamento específica',
     'Usa uma das técnicas: Bumerangue, Recapitulação, Realidade, Responsabilidade ou Elegibilidade.',
     1.0,
     ARRAY['"justamente porque você não sabe o que pode acontecer é que faz sentido se proteger agora…"', '"Vamos recapitular o que construímos pra você…"', '"Mas essa não foi a realidade que você mesmo validou comigo?"'],
     'Técnica aplicada corretamente. Objeção enfraquece. Cliente permanece na conversa.',
     'Resposta genérica sem técnica. Corretor tenta convencer com mais informação ou preço menor.',
     true, 2),

    ('77777777-0206-0003-0000-000000000001',
     '66666666-0206-0000-0000-000000000001',
     'Retorna ao fluxo da proposta após tratamento',
     'Regra de ouro: trata → volta para proposta imediatamente. Nunca deixa a objeção "ganhar espaço".',
     1.0,
     ARRAY['"Perfeito… me fala uma coisa… quando foi a última vez que você foi ao médico?"', 'transição imediata de volta à proposta após tratar'],
     'Após tratamento, retorna imediatamente à proposta. Fluxo mantido.',
     'Após tratar, fica esperando o cliente "decidir". Perde controle da conversa.',
     true, 3);

  -- S7: Pedido de Recomendação — 2ª Reunião
  INSERT INTO playbook_criteria (id, section_id, title, description, weight, detection_hints, example_good, example_bad, is_required, display_order)
  VALUES
    ('77777777-0207-0001-0000-000000000001',
     '66666666-0207-0000-0000-000000000001',
     'Pedido após fechamento com validação da decisão',
     'Melhor momento do processo. Cliente comprou, está validado emocionalmente. Primeiro reforça a decisão, depois pede.',
     1.0,
     ARRAY['"Você tomou uma excelente decisão…"', '"Isso aqui muda completamente o seu cenário…"', '"Deixa eu te fazer uma pergunta…"'],
     'Sequência: parabeniza → ancora valor → faz pedido. Natural e com alta conversão.',
     'Pedido feito de forma mecânica ou sem validar a decisão primeiro.',
     true, 1),

    ('77777777-0207-0002-0000-000000000001',
     '66666666-0207-0000-0000-000000000001',
     'Direcionamento de perfil e coleta estruturada',
     'Direciona o perfil ideal (família, construindo patrimônio, depende da renda) e coleta nome + profissão + proximidade.',
     1.0,
     ARRAY['"Alguém que tenha família como você…"', '"Algum amigo próximo que ainda não tem esse tipo de proteção…"', '"Qual o nome? O que ele faz? Ele tem família?"'],
     'Indicações qualificadas com perfil alinhado. Corretor coleta contexto completo de cada lead.',
     'Pedido genérico: "me indica alguém?" sem direcionar perfil ou coletar informações.',
     true, 2),

    ('77777777-0207-0003-0000-000000000001',
     '66666666-0207-0000-0000-000000000001',
     'Validação da abordagem e permissão de contato',
     'Remove a última fricção: define como o corretor vai contatar o lead (com ou sem apresentação do indicador).',
     1.0,
     ARRAY['"Posso falar que foi você que me indicou?"', '"Você prefere me conectar ou eu entro em contato?"', '"Você pode mandar uma mensagem pra ele agora?"'],
     'Abordagem definida dentro da reunião. Alta conversão por eliminação de fricção.',
     'Corretor depende do cliente "lembrar depois". Sem definir como o contato vai acontecer.',
     true, 3);

  -- ── 8. Critérios adicionais (gaps vs. documento) ───────────────────

  -- S3 1ª Reunião C4: SPIN profissional
  INSERT INTO playbook_criteria (id, section_id, title, description, weight, detection_hints, example_good, example_bad, is_required, display_order)
  VALUES (
    '77777777-0103-0004-0000-000000000001',
    '66666666-0103-0000-0000-000000000001',
    'Perguntas SPIN de contexto profissional',
    'Após credibilidade, inicia coleta suave de contexto profissional via SPIN leve: Situação (trabalho, há quanto tempo), Problema (já teve orientação?), Implicação (fez sentido na época?), Necessidade (o que quer entender).',
    1.0,
    ARRAY['"Hoje você trabalha com o quê exatamente?"', '"Você atua há quanto tempo nessa área?"', '"Você já teve algum tipo de orientação ou planejamento nessa área?"', '"E fez sentido pra você na época?"', '"O que você gostaria de entender melhor sobre isso hoje?"'],
    'Perguntas SPIN aplicadas com naturalidade após a apresentação de credibilidade. Transição orgânica para o diagnóstico.',
    'Corretor pula o contexto profissional e vai direto para o diagnóstico financeiro sem esta ponte de SPIN.',
    true, 4);

  -- S6 1ª Reunião C4: Confidencialidade
  INSERT INTO playbook_criteria (id, section_id, title, description, weight, detection_hints, example_good, example_bad, is_required, display_order)
  VALUES (
    '77777777-0106-0004-0000-000000000001',
    '66666666-0106-0000-0000-000000000001',
    'Agradecimento e garantia de confidencialidade',
    'Primeiro passo da etapa: agradecer pelas informações e tranquilizar o cliente sobre o uso dos dados. Reduz medo de exposição e resistência antes de qualquer frase de curiosidade.',
    1.0,
    ARRAY['"Quero te agradecer pelas informações…"', '"Pode ficar muito tranquilo…"', '"Essas informações são totalmente confidenciais…"', '"Só eu vou ter acesso a isso…"'],
    'Cliente tranquilizado sobre confidencialidade antes de qualquer avanço. Tom de cuidado e respeito.',
    'Corretor avança para curiosidade sem agradecer ou reforçar a confidencialidade das informações coletadas.',
    true, 4);

  -- S3 2ª Reunião C4: Necessidade Acumulada + Tabelas
  INSERT INTO playbook_criteria (id, section_id, title, description, weight, detection_hints, example_good, example_bad, is_required, display_order)
  VALUES (
    '77777777-0203-0004-0000-000000000001',
    '66666666-0203-0000-0000-000000000001',
    'Necessidade Acumulada, Comparação e Tabelas',
    'Gráfico 3: projeta o custo total de vida ao longo da expectativa ("X milhões"). Comparação potencial vs risco. Tabelas com GAP matemático entre o que precisa e o que tem disponível.',
    1.0,
    ARRAY['"Esse gráfico aqui é um dos mais importantes…"', '"Aqui a gente projeta toda a sua estrutura de custo ao longo da vida…"', '"No seu caso, estamos falando de aproximadamente X milhões ao longo da vida…"', '"Isso sem aumentar padrão de vida, sem trocar de carro…"', '"Esse valor aqui não está coberto…"'],
    'Cliente visualmente impactado com a magnitude dos números. GAP matemático entre necessidade e capacidade claramente compreendido.',
    'Corretor pula a necessidade acumulada e as tabelas. Cliente não tem visão do custo total de vida nem do gap real.',
    true, 4);

  -- S4 2ª Reunião C4: Desafio da Companhia
  INSERT INTO playbook_criteria (id, section_id, title, description, weight, detection_hints, example_good, example_bad, is_required, display_order)
  VALUES (
    '77777777-0204-0004-0000-000000000001',
    '66666666-0204-0000-0000-000000000001',
    'Técnica do Desafio da Companhia',
    'Após validação da solução, ativa o psicológico: a companhia vai analisar o perfil e pode aceitar, ajustar, melhorar ou recusar. Gera urgência, curiosidade e desafio pessoal.',
    1.0,
    ARRAY['"A companhia vai analisar o seu perfil…"', '"Ela pode te aceitar… pode ajustar… ou até recusar…"', '"Há casos onde o benefício é até melhorado…"', '"Vai depender da análise que eles fizerem…"'],
    'Cliente demonstra curiosidade e urgência sobre o resultado da análise. Desafio pessoal ativado.',
    'Corretor apresenta a proposta sem mencionar a análise da companhia. Perde urgência e o gatilho do desafio.',
    true, 4);

  RAISE NOTICE '09_erika_playbooks: 2 playbooks + 14 seções + 46 critérios inseridos com sucesso.';
END $$;
