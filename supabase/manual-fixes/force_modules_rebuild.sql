-- ============================================================
-- FORCE REBUILD: Limpar e Reconstruir Módulos Completamente
-- ============================================================
--
-- Este script FORÇA a reconstrução completa da tabela de módulos
-- Usa DROP TABLE + CREATE TABLE para garantir limpeza total
--
-- ⚠️ AVISO: Isto vai APAGAR todos os dados de módulos!
-- Mas é seguro porque vamos recriar com os dados corretos imediatamente.
--

-- Step 1: Desabilitar foreign key constraints temporariamente
ALTER TABLE settings_system_modules DISABLE TRIGGER ALL;

-- Step 2: Truncate (limpar) a tabela
TRUNCATE TABLE settings_system_modules CASCADE;

-- Step 3: Reabilitar triggers
ALTER TABLE settings_system_modules ENABLE TRIGGER ALL;

-- Step 4: Inserir TODOS os 12 módulos com dados corretos
INSERT INTO settings_system_modules (module_key, module_name, ativo, ordem, icon) VALUES
  -- Fixed modules (sempre visíveis)
  ('dashboard', 'BI PRO™', true, 1, 'BarChart3'),
  ('conversas', 'OMNI PRO™', true, 2, 'MessageCircle'),

  -- New PRO™ modules
  ('call', 'CALL PRO™', true, 3, 'Phone'),

  -- Modular modules
  ('disparos', 'SENDS PRO™', true, 4, 'Send'),
  ('agendamentos', 'SCHEDULE PRO™', true, 5, 'Calendar'),
  ('score', 'SCORE PRO™', true, 6, 'TrendingUp'),
  ('agentes-ia', 'AI AGENTS PRO™', true, 7, 'Bot'),
  ('lp', 'LP PRO™', true, 8, 'Globe'),

  -- Additional modules
  ('negocios', 'Negócios', true, 9, 'Target'),
  ('clientes', 'Clientes', true, 10, 'Users'),
  ('followups', 'Follow-ups', true, 11, 'Clock'),
  ('configuracoes', 'Configurações', true, 12, 'Settings');

-- Step 5: Verificação - mostrar todos os módulos
SELECT
  ROW_NUMBER() OVER (ORDER BY ordem) as num,
  module_key,
  module_name,
  ativo,
  ordem,
  icon
FROM settings_system_modules
ORDER BY ordem;

-- Step 6: Contar total
SELECT COUNT(*) as total_modules FROM settings_system_modules;

-- Expected output:
-- total_modules: 12
--
-- Com os seguintes módulos em ordem:
-- 1. dashboard       | BI PRO™                | true | 1  | BarChart3
-- 2. conversas       | OMNI PRO™              | true | 2  | MessageCircle
-- 3. call            | CALL PRO™              | true | 3  | Phone
-- 4. disparos        | SENDS PRO™             | true | 4  | Send
-- 5. agendamentos    | SCHEDULE PRO™          | true | 5  | Calendar
-- 6. score           | SCORE PRO™             | true | 6  | TrendingUp
-- 7. agentes-ia      | AI AGENTS PRO™         | true | 7  | Bot
-- 8. lp              | LP PRO™                | true | 8  | Globe
-- 9. negocios        | Negócios               | true | 9  | Target
-- 10. clientes       | Clientes               | true | 10 | Users
-- 11. followups      | Follow-ups             | true | 11 | Clock
-- 12. configuracoes  | Configurações          | true | 12 | Settings
