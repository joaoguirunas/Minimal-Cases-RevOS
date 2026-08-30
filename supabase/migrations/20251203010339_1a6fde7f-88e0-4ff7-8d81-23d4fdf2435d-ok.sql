-- ============================================
-- ETAPA 9: DADOS INICIAIS
-- ============================================

-- Inserir configurações padrão
INSERT INTO public.settings (company_name, timezone, language, currency)
VALUES ('Minha Empresa', 'America/Sao_Paulo', 'pt-br', 'BRL')
ON CONFLICT DO NOTHING;

-- Inserir módulos do sistema
INSERT INTO public.settings_system_modules (module_key, module_name, icon, ordem, ativo) VALUES
  ('dashboard', 'Dashboard', 'LayoutDashboard', 1, true),
  ('negocios', 'Negócios', 'Briefcase', 2, true),
  ('conversas', 'Conversas', 'MessageSquare', 3, true),
  ('clientes', 'Clientes', 'Users', 4, true),
  ('reunioes', 'Reuniões', 'Calendar', 5, true),
  ('agentes-ia', 'Agentes IA', 'Bot', 6, true),
  ('disparos', 'Disparos', 'Send', 7, true),
  ('followups', 'Follow-ups', 'Clock', 8, true),
  ('horarios', 'Horários', 'Clock', 9, true),
  ('configuracoes', 'Configurações', 'Settings', 10, true)
ON CONFLICT (module_key) DO NOTHING;

-- Criar pipeline padrão
INSERT INTO public.leads_pipelines (name, description, active)
VALUES ('Pipeline Principal', 'Pipeline padrão do sistema', true)
ON CONFLICT DO NOTHING;

-- Criar etapas padrão para o pipeline
DO $$
DECLARE
  v_pipeline_id uuid;
BEGIN
  SELECT id INTO v_pipeline_id FROM public.leads_pipelines WHERE name = 'Pipeline Principal' LIMIT 1;
  
  IF v_pipeline_id IS NOT NULL THEN
    INSERT INTO public.leads_stages (leads_pipelines_id, name, color, order_index, active) VALUES
      (v_pipeline_id, 'Novo Lead', '#3B82F6', 1, true),
      (v_pipeline_id, 'Qualificação', '#F59E0B', 2, true),
      (v_pipeline_id, 'Proposta', '#8B5CF6', 3, true),
      (v_pipeline_id, 'Negociação', '#EC4899', 4, true),
      (v_pipeline_id, 'Fechamento', '#10B981', 5, true)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Criar motivos de perda padrão
INSERT INTO public.leads_loss_reasons (name, description, active) VALUES
  ('Preço', 'Cliente achou muito caro', true),
  ('Timing', 'Não é o momento certo', true),
  ('Concorrência', 'Escolheu outra solução', true),
  ('Sem resposta', 'Cliente parou de responder', true),
  ('Não qualificado', 'Lead não tinha perfil adequado', true)
ON CONFLICT DO NOTHING;

-- Criar time padrão
INSERT INTO public.settings_teams (name, description, team_type, priority, active)
VALUES ('Time Comercial', 'Time de vendas principal', 'vendas', 1, true)
ON CONFLICT DO NOTHING;