-- Insert all task set categories with proper descriptions
INSERT INTO public.process_task_set_categories (name, description, color, sort_order, active) VALUES
('Gestão & Governança', 'Planejamento, acompanhamento de projetos, organização do trabalho, tomada de decisão e alinhamento entre times.', '#6366F1', 1, true),
('Mapeamento & Melhoria de Processos', 'Análise, desenho, documentação e otimização de processos internos e de clientes.', '#8B5CF6', 2, true),
('Estratégia & Consultoria', 'Diagnóstico, definição de objetivos, escopo, prioridades e direcionamento estratégico.', '#EC4899', 3, true),
('Desenvolvimento & Implementação', 'Construção técnica de sistemas, aplicações, automações e soluções com ou sem IA.', '#14B8A6', 4, true),
('Lógica de IA & Prompts', 'Definição do raciocínio, comportamento, regras e respostas da IA em diferentes contextos.', '#F59E0B', 5, true),
('Automações & Agentes', 'Criação de fluxos e agentes que executam tarefas e processos automaticamente.', '#10B981', 6, true),
('Integrações & Infraestrutura', 'Conexão entre sistemas, ferramentas, APIs, dados e ambientes técnicos.', '#3B82F6', 7, true),
('Dados & Base de Conhecimento', 'Organização, estruturação e manutenção de dados e conteúdos usados pela IA.', '#6366F1', 8, true),
('CX & Atendimento', 'Atendimento ao cliente, suporte, pós-venda, experiência e relacionamento, com ou sem IA.', '#F97316', 9, true),
('Comercial & Marketing', 'Vendas, marketing, prospecção, comunicação, posicionamento e crescimento do negócio.', '#EF4444', 10, true),
('Financeiro & Administrativo', 'Gestão financeira, faturamento, contratos, custos, pagamentos e rotinas administrativas.', '#84CC16', 11, true),
('Qualidade, Segurança & Compliance', 'Testes, validações, controle de riscos, privacidade, segurança e conformidade.', '#06B6D4', 12, true),
('Pessoas & Capacitação', 'Treinamento, onboarding, documentação, repasse de conhecimento e evolução do time.', '#A855F7', 13, true);