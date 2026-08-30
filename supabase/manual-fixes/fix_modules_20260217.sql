-- ============================================
-- MANUAL FIX: Reconstruct System Modules
-- ============================================
--
-- Este script reconstrói completamente a tabela settings_system_modules
-- com todos os módulos PRO™ corretamente nomeados.
--
-- COMO USAR:
-- 1. Vá para Supabase Dashboard → SQL Editor
-- 2. Cole TODO este script
-- 3. Clique em "Execute" ou "Run"
-- 4. Verifique que todos os 12 módulos aparecem

-- First, verify the table exists
SELECT COUNT(*) as total_modules FROM settings_system_modules;

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
  ('lp', 'LP PRO™', true, 8, 'Globe'),
  ('negocios', 'Negócios', true, 9, 'Target'),
  ('clientes', 'Clientes', true, 10, 'Users'),
  ('followups', 'Follow-ups', true, 11, 'Clock'),
  ('configuracoes', 'Configurações', true, 12, 'Settings');

-- Verify the fix
SELECT module_key, module_name, icon, ativo, ordem
FROM settings_system_modules
ORDER BY ordem;

-- Expected output: 12 rows with all modules correctly named
-- Check that:
-- 1. All 12 modules are present
-- 2. Module names include "PRO™" where appropriate
-- 3. Icons are correct (BarChart3, MessageCircle, Phone, Send, Calendar, TrendingUp, Bot, Globe, Target, Users, Clock, Settings)
-- 4. All have ativo = true
-- 5. Order is correct (1-12)
