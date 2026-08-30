-- Insert all task templates with subtasks

-- 1. Gestão & Governança (ccc8d62f-f37e-4c1e-a0c3-79853b25ba43)
WITH t1 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Planejamento semanal do projeto', 'Planejar atividades da semana, alinhar prioridades, responsáveis e prazos.', 60, 'ccc8d62f-f37e-4c1e-a0c3-79853b25ba43', true, 1)
  RETURNING id
),
s1 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Revisar status das tarefas', 'Definir prioridades', 'Atualizar cronograma', 'Comunicar time']), generate_series(1, 4) FROM t1
),
t2 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Acompanhamento de andamento', 'Monitorar progresso, remover bloqueios e garantir alinhamento.', 45, 'ccc8d62f-f37e-4c1e-a0c3-79853b25ba43', true, 2)
  RETURNING id
),
s2 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Revisar tarefas em atraso', 'Identificar impedimentos', 'Registrar decisões', 'Atualizar stakeholders']), generate_series(1, 4) FROM t2
),
t3 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Alinhamento interno entre áreas', 'Garantir alinhamento entre times técnico, CX e comercial.', 60, 'ccc8d62f-f37e-4c1e-a0c3-79853b25ba43', true, 3)
  RETURNING id
),
s3 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Preparar pauta', 'Reunir áreas', 'Registrar acordos', 'Definir próximos passos']), generate_series(1, 4) FROM t3
),
t4 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Organização do backlog', 'Revisar, priorizar e organizar tarefas pendentes.', 45, 'ccc8d62f-f37e-4c1e-a0c3-79853b25ba43', true, 4)
  RETURNING id
),
s4 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Revisar backlog', 'Ajustar prioridades', 'Refinar descrições', 'Arquivar itens obsoletos']), generate_series(1, 4) FROM t4
),
t5 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Relatório de status', 'Consolidar status do projeto para acompanhamento interno ou cliente.', 30, 'ccc8d62f-f37e-4c1e-a0c3-79853b25ba43', true, 5)
  RETURNING id
),
s5 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Coletar informações', 'Atualizar indicadores', 'Redigir resumo', 'Compartilhar relatório']), generate_series(1, 4) FROM t5
),

-- 2. Mapeamento & Melhoria de Processos (af05dcab-3c96-47ce-9a70-8a55a8e9ad4a)
t6 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Mapeamento de processo atual', 'Entender e documentar como o processo funciona hoje.', 120, 'af05dcab-3c96-47ce-9a70-8a55a8e9ad4a', true, 1)
  RETURNING id
),
s6 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Entrevistar envolvidos', 'Mapear etapas', 'Identificar entradas/saídas', 'Documentar fluxo']), generate_series(1, 4) FROM t6
),
t7 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Identificação de gargalos', 'Analisar o processo para identificar falhas e ineficiências.', 60, 'af05dcab-3c96-47ce-9a70-8a55a8e9ad4a', true, 2)
  RETURNING id
),
s7 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Analisar etapas', 'Identificar retrabalho', 'Listar pontos críticos', 'Registrar oportunidades']), generate_series(1, 4) FROM t7
),
t8 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Redesenho de processo', 'Propor melhorias no fluxo do processo.', 90, 'af05dcab-3c96-47ce-9a70-8a55a8e9ad4a', true, 3)
  RETURNING id
),
s8 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Criar novo fluxo', 'Validar com time', 'Ajustar proposta', 'Documentar versão final']), generate_series(1, 4) FROM t8
),
t9 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Padronização de processo', 'Criar padrão claro para execução recorrente.', 60, 'af05dcab-3c96-47ce-9a70-8a55a8e9ad4a', true, 4)
  RETURNING id
),
s9 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Definir regras', 'Criar checklist', 'Documentar instruções', 'Validar uso']), generate_series(1, 4) FROM t9
),
t10 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Preparação para automação', 'Estruturar processo para futura automação.', 60, 'af05dcab-3c96-47ce-9a70-8a55a8e9ad4a', true, 5)
  RETURNING id
),
s10 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Simplificar etapas', 'Definir gatilhos', 'Identificar ferramentas', 'Documentar requisitos']), generate_series(1, 4) FROM t10
),

-- 3. Estratégia & Consultoria (84f26d01-3ff8-4b26-a619-39cb277e5b13)
t11 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Diagnóstico inicial', 'Entender contexto, desafios e objetivos do cliente ou área.', 120, '84f26d01-3ff8-4b26-a619-39cb277e5b13', true, 1)
  RETURNING id
),
s11 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Coletar informações', 'Analisar contexto', 'Identificar oportunidades', 'Registrar diagnóstico']), generate_series(1, 4) FROM t11
),
t12 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Definição de objetivos', 'Definir objetivos claros e mensuráveis.', 60, '84f26d01-3ff8-4b26-a619-39cb277e5b13', true, 2)
  RETURNING id
),
s12 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Alinhar expectativas', 'Definir metas', 'Validar com envolvidos', 'Documentar objetivos']), generate_series(1, 4) FROM t12
),
t13 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Priorização de iniciativas', 'Decidir o que fazer primeiro com base em impacto e esforço.', 45, '84f26d01-3ff8-4b26-a619-39cb277e5b13', true, 3)
  RETURNING id
),
s13 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Listar iniciativas', 'Avaliar impacto', 'Avaliar esforço', 'Definir prioridades']), generate_series(1, 4) FROM t13
),
t14 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Definição de escopo', 'Delimitar claramente o que será feito e o que não será.', 45, '84f26d01-3ff8-4b26-a619-39cb277e5b13', true, 4)
  RETURNING id
),
s14 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Listar entregas', 'Definir limites', 'Validar escopo', 'Documentar acordo']), generate_series(1, 4) FROM t14
),
t15 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Revisão estratégica', 'Reavaliar estratégia com base em resultados.', 60, '84f26d01-3ff8-4b26-a619-39cb277e5b13', true, 5)
  RETURNING id
),
s15 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Analisar resultados', 'Identificar desvios', 'Ajustar direcionamento', 'Atualizar plano']), generate_series(1, 4) FROM t15
),

-- 4. Desenvolvimento & Implementação (f83150b6-d0be-4776-8f93-ab97a5ed64bb)
t16 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Implementação de funcionalidade', 'Desenvolver funcionalidade técnica conforme requisitos.', 180, 'f83150b6-d0be-4776-8f93-ab97a5ed64bb', true, 1)
  RETURNING id
),
s16 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Analisar requisitos', 'Desenvolver', 'Testar', 'Documentar']), generate_series(1, 4) FROM t16
),
t17 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Criação de script ou fluxo técnico', 'Criar script, automação ou lógica técnica específica.', 120, 'f83150b6-d0be-4776-8f93-ab97a5ed64bb', true, 2)
  RETURNING id
),
s17 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Definir lógica', 'Implementar', 'Testar execução', 'Ajustar erros']), generate_series(1, 4) FROM t17
),
t18 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Ajustes técnicos e correções', 'Corrigir bugs ou melhorar desempenho técnico.', 60, 'f83150b6-d0be-4776-8f93-ab97a5ed64bb', true, 3)
  RETURNING id
),
s18 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Identificar problema', 'Corrigir código', 'Testar', 'Validar correção']), generate_series(1, 4) FROM t18
),
t19 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Prototipação rápida', 'Criar versão inicial para validação rápida.', 90, 'f83150b6-d0be-4776-8f93-ab97a5ed64bb', true, 4)
  RETURNING id
),
s19 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Definir escopo mínimo', 'Implementar protótipo', 'Validar funcionamento', 'Coletar feedback']), generate_series(1, 4) FROM t19
),
t20 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Refatoração', 'Melhorar estrutura técnica sem alterar comportamento.', 120, 'f83150b6-d0be-4776-8f93-ab97a5ed64bb', true, 5)
  RETURNING id
),
s20 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Identificar melhorias', 'Refatorar', 'Testar', 'Atualizar documentação']), generate_series(1, 4) FROM t20
),

-- 5. Lógica de IA & Prompts (ca936b27-f7b0-4e50-ae26-ca83d0e82b35)
t21 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Criação de prompt inicial', 'Criar prompt base para uso específico.', 45, 'ca936b27-f7b0-4e50-ae26-ca83d0e82b35', true, 1)
  RETURNING id
),
s21 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Definir objetivo', 'Criar prompt', 'Testar respostas', 'Ajustar linguagem']), generate_series(1, 4) FROM t21
),
t22 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Otimização de prompt', 'Melhorar qualidade e consistência das respostas.', 30, 'ca936b27-f7b0-4e50-ae26-ca83d0e82b35', true, 2)
  RETURNING id
),
s22 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Testar variações', 'Comparar resultados', 'Ajustar estrutura', 'Documentar versão final']), generate_series(1, 4) FROM t22
),
t23 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Definição de regras de comportamento', 'Definir limites, tom e estilo da IA.', 45, 'ca936b27-f7b0-4e50-ae26-ca83d0e82b35', true, 3)
  RETURNING id
),
s23 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Definir regras', 'Integrar ao prompt', 'Testar cenários', 'Validar respostas']), generate_series(1, 4) FROM t23
),
t24 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Testes de cenários', 'Testar IA em diferentes situações reais.', 45, 'ca936b27-f7b0-4e50-ae26-ca83d0e82b35', true, 4)
  RETURNING id
),
s24 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Criar cenários', 'Executar testes', 'Registrar falhas', 'Ajustar lógica']), generate_series(1, 4) FROM t24
),
t25 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Documentação de lógica', 'Documentar funcionamento da IA para uso interno.', 30, 'ca936b27-f7b0-4e50-ae26-ca83d0e82b35', true, 5)
  RETURNING id
),
s25 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Descrever lógica', 'Registrar exemplos', 'Organizar documentação', 'Compartilhar com time']), generate_series(1, 4) FROM t25
),

-- 6. Automações & Agentes (9ac4e676-6a70-43af-8ea7-6f3794a736e5)
t26 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Criação de automação', 'Criar fluxo automatizado para tarefa recorrente.', 120, '9ac4e676-6a70-43af-8ea7-6f3794a736e5', true, 1)
  RETURNING id
),
s26 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Definir gatilho', 'Criar fluxo', 'Testar execução', 'Ajustar falhas']), generate_series(1, 4) FROM t26
),
t27 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Configuração de agente', 'Criar agente para executar tarefas específicas.', 120, '9ac4e676-6a70-43af-8ea7-6f3794a736e5', true, 2)
  RETURNING id
),
s27 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Definir objetivo', 'Configurar agente', 'Testar comportamento', 'Ajustar lógica']), generate_series(1, 4) FROM t27
),
t28 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Monitoramento de automação', 'Acompanhar execução e falhas da automação.', 30, '9ac4e676-6a70-43af-8ea7-6f3794a736e5', true, 3)
  RETURNING id
),
s28 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Verificar logs', 'Identificar erros', 'Ajustar fluxo', 'Registrar melhorias']), generate_series(1, 4) FROM t28
),
t29 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Ajuste de automação existente', 'Melhorar automação já criada.', 60, '9ac4e676-6a70-43af-8ea7-6f3794a736e5', true, 4)
  RETURNING id
),
s29 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Analisar fluxo atual', 'Ajustar lógica', 'Testar', 'Atualizar documentação']), generate_series(1, 4) FROM t29
),
t30 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Desativação de automação', 'Desativar automação obsoleta ou problemática.', 20, '9ac4e676-6a70-43af-8ea7-6f3794a736e5', true, 5)
  RETURNING id
),
s30 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Validar decisão', 'Desativar fluxo', 'Comunicar envolvidos', 'Registrar mudança']), generate_series(1, 4) FROM t30
),

-- 7. Integrações & Infraestrutura (dfa01eab-57ba-4e8c-aeb3-433521c430b2)
t31 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Integração entre sistemas', 'Conectar dois ou mais sistemas.', 120, 'dfa01eab-57ba-4e8c-aeb3-433521c430b2', true, 1)
  RETURNING id
),
s31 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Definir dados', 'Configurar integração', 'Testar troca', 'Validar resultado']), generate_series(1, 4) FROM t31
),
t32 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Configuração de API', 'Configurar consumo ou exposição de API.', 90, 'dfa01eab-57ba-4e8c-aeb3-433521c430b2', true, 2)
  RETURNING id
),
s32 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Analisar documentação', 'Configurar acesso', 'Testar chamadas', 'Ajustar erros']), generate_series(1, 4) FROM t32
),
t33 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Manutenção de integração', 'Ajustar integração existente.', 60, 'dfa01eab-57ba-4e8c-aeb3-433521c430b2', true, 3)
  RETURNING id
),
s33 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Identificar problema', 'Ajustar configuração', 'Testar', 'Validar correção']), generate_series(1, 4) FROM t33
),
t34 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Configuração de ambiente', 'Preparar ambiente técnico para uso.', 60, 'dfa01eab-57ba-4e8c-aeb3-433521c430b2', true, 4)
  RETURNING id
),
s34 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Criar ambiente', 'Configurar acessos', 'Testar funcionamento', 'Documentar']), generate_series(1, 4) FROM t34
),
t35 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Monitoramento técnico', 'Acompanhar estabilidade técnica.', 30, 'dfa01eab-57ba-4e8c-aeb3-433521c430b2', true, 5)
  RETURNING id
),
s35 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Verificar status', 'Identificar alertas', 'Corrigir falhas', 'Registrar ocorrências']), generate_series(1, 4) FROM t35
),

-- 8. Dados & Base de Conhecimento (685f20e8-3eb0-4fef-a819-91ddfa549dfd)
t36 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Organização de documentos', 'Organizar documentos usados pela IA.', 60, '685f20e8-3eb0-4fef-a819-91ddfa549dfd', true, 1)
  RETURNING id
),
s36 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Coletar documentos', 'Padronizar formatos', 'Organizar pastas', 'Validar conteúdo']), generate_series(1, 4) FROM t36
),
t37 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Limpeza de dados', 'Remover dados duplicados ou irrelevantes.', 60, '685f20e8-3eb0-4fef-a819-91ddfa549dfd', true, 2)
  RETURNING id
),
s37 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Analisar dados', 'Identificar problemas', 'Limpar dados', 'Validar resultado']), generate_series(1, 4) FROM t37
),
t38 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Atualização de base de conhecimento', 'Atualizar informações existentes.', 45, '685f20e8-3eb0-4fef-a819-91ddfa549dfd', true, 3)
  RETURNING id
),
s38 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Revisar conteúdo', 'Atualizar dados', 'Testar uso', 'Registrar mudança']), generate_series(1, 4) FROM t38
),
t39 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Estruturação para IA', 'Preparar dados para uso por IA.', 90, '685f20e8-3eb0-4fef-a819-91ddfa549dfd', true, 4)
  RETURNING id
),
s39 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Definir estrutura', 'Organizar conteúdo', 'Testar acesso', 'Ajustar formato']), generate_series(1, 4) FROM t39
),
t40 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Auditoria de dados', 'Verificar qualidade e confiabilidade dos dados.', 45, '685f20e8-3eb0-4fef-a819-91ddfa549dfd', true, 5)
  RETURNING id
),
s40 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Revisar dados', 'Identificar falhas', 'Registrar problemas', 'Propor correções']), generate_series(1, 4) FROM t40
),

-- 9. CX & Atendimento (91b8da12-eb01-4f3a-b9a1-b3247c9c862e)
t41 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Atendimento ao cliente', 'Atender solicitações de clientes.', 30, '91b8da12-eb01-4f3a-b9a1-b3247c9c862e', true, 1)
  RETURNING id
),
s41 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Analisar solicitação', 'Responder cliente', 'Registrar atendimento', 'Encerrar chamado']), generate_series(1, 4) FROM t41
),
t42 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Ajuste de fluxo de atendimento', 'Melhorar fluxo de atendimento existente.', 60, '91b8da12-eb01-4f3a-b9a1-b3247c9c862e', true, 2)
  RETURNING id
),
s42 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Analisar fluxo', 'Propor melhorias', 'Ajustar processo', 'Validar mudança']), generate_series(1, 4) FROM t42
),
t43 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Criação de FAQ', 'Criar ou atualizar perguntas frequentes.', 45, '91b8da12-eb01-4f3a-b9a1-b3247c9c862e', true, 3)
  RETURNING id
),
s43 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Coletar dúvidas', 'Criar respostas', 'Revisar linguagem', 'Publicar']), generate_series(1, 4) FROM t43
),
t44 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Monitoramento de experiência', 'Avaliar satisfação do cliente.', 30, '91b8da12-eb01-4f3a-b9a1-b3247c9c862e', true, 4)
  RETURNING id
),
s44 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Coletar feedback', 'Analisar respostas', 'Identificar melhorias', 'Registrar ações']), generate_series(1, 4) FROM t44
),
t45 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Pós-venda', 'Acompanhar cliente após entrega.', 30, '91b8da12-eb01-4f3a-b9a1-b3247c9c862e', true, 5)
  RETURNING id
),
s45 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Contatar cliente', 'Coletar feedback', 'Registrar insights', 'Propor melhorias']), generate_series(1, 4) FROM t45
),

-- 10. Comercial & Marketing (027e03c1-8bc1-45ae-a78a-4dd58bfef1d9)
t46 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Prospecção de leads', 'Identificar e abordar potenciais clientes.', 60, '027e03c1-8bc1-45ae-a78a-4dd58bfef1d9', true, 1)
  RETURNING id
),
s46 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Identificar leads', 'Preparar abordagem', 'Entrar em contato', 'Registrar resultado']), generate_series(1, 4) FROM t46
),
t47 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Reunião comercial', 'Apresentar soluções e entender necessidades.', 60, '027e03c1-8bc1-45ae-a78a-4dd58bfef1d9', true, 2)
  RETURNING id
),
s47 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Preparar reunião', 'Conduzir conversa', 'Registrar necessidades', 'Definir próximos passos']), generate_series(1, 4) FROM t47
),
t48 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Criação de proposta', 'Elaborar proposta comercial.', 60, '027e03c1-8bc1-45ae-a78a-4dd58bfef1d9', true, 3)
  RETURNING id
),
s48 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Definir escopo', 'Calcular valores', 'Redigir proposta', 'Revisar']), generate_series(1, 4) FROM t48
),
t49 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Criação de conteúdo', 'Criar conteúdo para marketing ou vendas.', 60, '027e03c1-8bc1-45ae-a78a-4dd58bfef1d9', true, 4)
  RETURNING id
),
s49 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Definir tema', 'Criar conteúdo', 'Revisar', 'Publicar']), generate_series(1, 4) FROM t49
),
t50 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Follow-up comercial', 'Acompanhar leads e propostas enviadas.', 30, '027e03c1-8bc1-45ae-a78a-4dd58bfef1d9', true, 5)
  RETURNING id
),
s50 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Revisar pipeline', 'Entrar em contato', 'Atualizar status', 'Registrar retorno']), generate_series(1, 4) FROM t50
),

-- 11. Financeiro & Administrativo (821bc3ce-f454-4e03-9c70-f6ee7f96b119)
t51 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Emissão de faturamento', 'Emitir nota ou cobrança.', 30, '821bc3ce-f454-4e03-9c70-f6ee7f96b119', true, 1)
  RETURNING id
),
s51 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Conferir dados', 'Emitir documento', 'Enviar cliente', 'Registrar']), generate_series(1, 4) FROM t51
),
t52 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Controle de custos', 'Registrar e acompanhar custos.', 30, '821bc3ce-f454-4e03-9c70-f6ee7f96b119', true, 2)
  RETURNING id
),
s52 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Levantar custos', 'Registrar', 'Analisar variação', 'Atualizar controle']), generate_series(1, 4) FROM t52
),
t53 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Gestão de contratos', 'Criar ou revisar contratos.', 60, '821bc3ce-f454-4e03-9c70-f6ee7f96b119', true, 3)
  RETURNING id
),
s53 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Revisar cláusulas', 'Ajustar termos', 'Validar', 'Arquivar']), generate_series(1, 4) FROM t53
),
t54 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Pagamentos', 'Executar pagamentos.', 20, '821bc3ce-f454-4e03-9c70-f6ee7f96b119', true, 4)
  RETURNING id
),
s54 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Conferir valores', 'Efetuar pagamento', 'Registrar', 'Arquivar comprovante']), generate_series(1, 4) FROM t54
),
t55 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Relatório financeiro', 'Consolidar informações financeiras.', 45, '821bc3ce-f454-4e03-9c70-f6ee7f96b119', true, 5)
  RETURNING id
),
s55 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Coletar dados', 'Analisar números', 'Criar relatório', 'Compartilhar']), generate_series(1, 4) FROM t55
),

-- 12. Qualidade, Segurança & Compliance (8329325a-e7c4-4c0e-a7ca-3dc2d30c20dc)
t56 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Testes de qualidade', 'Testar soluções antes de entrega.', 60, '8329325a-e7c4-4c0e-a7ca-3dc2d30c20dc', true, 1)
  RETURNING id
),
s56 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Definir cenários', 'Executar testes', 'Registrar falhas', 'Validar correções']), generate_series(1, 4) FROM t56
),
t57 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Revisão de segurança', 'Avaliar riscos de segurança.', 45, '8329325a-e7c4-4c0e-a7ca-3dc2d30c20dc', true, 2)
  RETURNING id
),
s57 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Analisar acessos', 'Identificar riscos', 'Propor ajustes', 'Registrar revisão']), generate_series(1, 4) FROM t57
),
t58 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Validação final', 'Validar entrega antes do uso.', 30, '8329325a-e7c4-4c0e-a7ca-3dc2d30c20dc', true, 3)
  RETURNING id
),
s58 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Revisar requisitos', 'Testar funcionamento', 'Aprovar entrega', 'Registrar aprovação']), generate_series(1, 4) FROM t58
),
t59 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Auditoria interna', 'Verificar conformidade interna.', 60, '8329325a-e7c4-4c0e-a7ca-3dc2d30c20dc', true, 4)
  RETURNING id
),
s59 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Revisar processos', 'Identificar desvios', 'Registrar achados', 'Propor correções']), generate_series(1, 4) FROM t59
),
t60 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Controle de acessos', 'Gerenciar permissões e acessos.', 20, '8329325a-e7c4-4c0e-a7ca-3dc2d30c20dc', true, 5)
  RETURNING id
),
s60 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Revisar acessos', 'Ajustar permissões', 'Registrar mudanças', 'Validar segurança']), generate_series(1, 4) FROM t60
),

-- 13. Pessoas & Capacitação (87551b70-aa1e-4c92-8b5c-fe582e254b2c)
t61 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Onboarding de colaborador', 'Integrar novo membro ao time.', 60, '87551b70-aa1e-4c92-8b5c-fe582e254b2c', true, 1)
  RETURNING id
),
s61 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Apresentar processos', 'Conceder acessos', 'Explicar ferramentas', 'Tirar dúvidas']), generate_series(1, 4) FROM t61
),
t62 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Treinamento interno', 'Capacitar time em ferramentas ou processos.', 90, '87551b70-aa1e-4c92-8b5c-fe582e254b2c', true, 2)
  RETURNING id
),
s62 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Preparar material', 'Conduzir treinamento', 'Tirar dúvidas', 'Registrar presença']), generate_series(1, 4) FROM t62
),
t63 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Criação de documentação', 'Criar documentação para uso interno.', 60, '87551b70-aa1e-4c92-8b5c-fe582e254b2c', true, 3)
  RETURNING id
),
s63 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Definir conteúdo', 'Redigir', 'Revisar', 'Publicar']), generate_series(1, 4) FROM t63
),
t64 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Atualização de documentação', 'Manter documentação atualizada.', 30, '87551b70-aa1e-4c92-8b5c-fe582e254b2c', true, 4)
  RETURNING id
),
s64 AS (
  INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
  SELECT id, unnest(ARRAY['Revisar conteúdo', 'Atualizar', 'Validar', 'Comunicar mudança']), generate_series(1, 4) FROM t64
),
t65 AS (
  INSERT INTO process_task_templates (title, description, time_minutes, category_id, is_template, sort_order)
  VALUES ('Compartilhamento de conhecimento', 'Compartilhar aprendizados com o time.', 30, '87551b70-aa1e-4c92-8b5c-fe582e254b2c', true, 5)
  RETURNING id
)
INSERT INTO process_subtask_templates (task_template_id, title, sort_order)
SELECT id, unnest(ARRAY['Preparar material', 'Apresentar', 'Registrar insights', 'Arquivar conteúdo']), generate_series(1, 4) FROM t65;