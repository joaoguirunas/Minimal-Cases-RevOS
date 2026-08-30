-- FWUP-16: Garantir todos os módulos em settings_system_modules
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- PROBLEMA:
--   A migration add_pro_modules (que inseria os 12 módulos) nunca entrou no
--   client-migrations.json e portanto não foi propagada para tenants como ORA.
--   Tenants antigos ficaram com apenas 3 módulos (dashboard, negocios, conversas)
--   provenientes do seed original.
--
-- SOLUÇÃO:
--   Upsert de todos os módulos do catálogo atual (src/utils/modules.ts).
--   ON CONFLICT (module_key) DO UPDATE atualiza nome e order_index mas NÃO
--   sobrescreve is_active — preserva escolhas do admin do tenant.
--
-- IDEMPOTENTE: ON CONFLICT (module_key) DO UPDATE.
-- SEM BEGIN/COMMIT: auto-commit por statement.
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO public.settings_system_modules (module_key, module_name, is_active, order_index, icon)
VALUES
  ('dashboard',    'BI PRO™',        true,  1,  'BarChart3'),
  ('negocios',     'CRM PRO™',       true,  2,  'Target'),
  ('clientes',     'CRM Pessoas™',   true,  3,  'Users'),
  ('conversas',    'OMNI PRO™',      true,  4,  'MessageCircle'),
  ('call',         'CALL PRO™',      true,  5,  'Phone'),
  ('disparos',     'SENDS PRO™',     true,  6,  'Send'),
  ('agendamentos', 'SCHEDULE PRO™',  true,  7,  'Calendar'),
  ('lp',           'FORM PRO™',      true,  8,  'Globe'),
  ('prospect',     'PROSPECT PRO™',  true,  9,  'Search'),
  ('agentes-ia',   'AI AGENTS™',     true,  10, 'Bot'),
  ('score',        'SCORE PRO™',     true,  11, 'TrendingUp'),
  ('coach',        'CoachPRO™',      true,  12, 'GraduationCap')
ON CONFLICT (module_key) DO UPDATE
  SET module_name  = EXCLUDED.module_name,
      order_index  = EXCLUDED.order_index,
      icon         = EXCLUDED.icon;
-- is_active não é atualizado — preserva configuração do admin do tenant
