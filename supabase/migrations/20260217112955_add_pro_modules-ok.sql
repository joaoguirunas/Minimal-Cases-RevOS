-- Reconstruct all system modules with correct PRO™ naming and order
-- This migration ensures all modules are present with correct names and icons

-- Delete all existing modules to rebuild cleanly
DELETE FROM settings_system_modules;

-- Insert all modules with correct PRO™ naming, icons, and order
INSERT INTO settings_system_modules (module_key, module_name, ativo, ordem, icon) VALUES
  ('dashboard', 'BI PRO™', true, 1, 'BarChart3'),
  ('conversas', 'OMNI PRO™', true, 2, 'MessageCircle'),
  ('call', 'CALL PRO™', true, 3, 'Phone'),
  ('disparos', 'SENDS PRO™', true, 4, 'Send'),
  ('agendamentos', 'SCHEDULE PRO™', true, 5, 'Calendar'),
  ('score', 'SCORE PRO™', true, 6, 'TrendingUp'),
  ('agentes-ia', 'AI AGENTS PRO™', true, 7, 'Bot'),
  ('lp', 'FORM PRO™', true, 8, 'Globe'),
  ('negocios', 'CRM PRO™', true, 9, 'Target'),
  ('clientes', 'Clientes', true, 10, 'Users'),
  ('followups', 'Follow-ups', true, 11, 'Clock'),
  ('configuracoes', 'Configurações', true, 12, 'Settings');

-- Add a comment explaining this is a complete module rebuild
-- This ensures the ModulosConfig page displays all available modules
