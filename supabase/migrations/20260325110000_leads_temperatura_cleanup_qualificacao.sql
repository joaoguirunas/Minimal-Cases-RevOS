-- ══════════════════════════════════════════════════════════════════════════════
-- 1. Add temperatura_pre_venda + probabilidade_fechamento to leads
-- 2. Cleanup pessoa qualificação — delete all old fields, insert 8 clean ones
--
-- Standard fields:
--   leads.temperatura_pre_venda    (1-5 🔥)
--   leads.probabilidade_fechamento (1-5 ⭐ → 20/40/60/80/100%)
--   clients_people.disc_profile           — already exists
--   clients_people.disc_summary           — already exists
--   clients_people.conversation_summary   — already exists
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Add standard columns to leads ───────────────────────────────────────

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS temperatura_pre_venda smallint
    CHECK (temperatura_pre_venda IS NULL OR (temperatura_pre_venda >= 1 AND temperatura_pre_venda <= 5)),
  ADD COLUMN IF NOT EXISTS probabilidade_fechamento smallint
    CHECK (probabilidade_fechamento IS NULL OR (probabilidade_fechamento >= 1 AND probabilidade_fechamento <= 5));

COMMENT ON COLUMN public.leads.temperatura_pre_venda    IS 'Temperatura pré-venda (1-5 🔥). Quão quente é o lead antes do contato comercial.';
COMMENT ON COLUMN public.leads.probabilidade_fechamento IS 'Probabilidade de fechamento (1-5 ⭐ → 20/40/60/80/100%). Chance de fechar o negócio.';

-- ─── 2. Delete ALL pessoa qualificação field definitions (CASCADE removes values) ─

DELETE FROM public.lead_field_definitions
 WHERE entity_type = 'pessoa'
   AND category = 'qualificacao';

-- ─── 3. Insert 8 clean qualification fields for pessoa ──────────────────────

INSERT INTO public.lead_field_definitions
  (name, key, type, category, entity_type, active, agent_managed, order_index)
VALUES
  ('Gargalo Principal',            'gargalo_principal',      'textarea', 'qualificacao', 'pessoa', true, true, 0),
  ('Tamanho da Equipe Comercial',  'tamanho_equipe',         'text',     'qualificacao', 'pessoa', true, true, 1),
  ('Volume de Leads/Mês',          'volume_leads_mes',       'text',     'qualificacao', 'pessoa', true, true, 2),
  ('Ferramentas Atuais',           'ferramentas_atuais',     'textarea', 'qualificacao', 'pessoa', true, true, 3),
  ('Autoridade de Decisão',        'autoridade_decisao',     'text',     'qualificacao', 'pessoa', true, true, 4),
  ('Budget Disponível',            'budget_disponivel',      'text',     'qualificacao', 'pessoa', true, true, 5),
  ('Timeline de Implementação',    'timeline_implementacao', 'text',     'qualificacao', 'pessoa', true, true, 6),
  ('Objeções Previstas',           'objecoes_previstas',     'textarea', 'qualificacao', 'pessoa', true, true, 7);
