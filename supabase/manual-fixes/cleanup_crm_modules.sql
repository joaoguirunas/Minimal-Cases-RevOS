-- ============================================================
-- CLEANUP: Remove CRM sub-modules from configurable list
-- ============================================================
--
-- Este script atualiza os módulos para remover os sub-módulos do CRM
-- da lista de módulos configuráveis em Settings.
--
-- Follow-ups, Clientes, Negócios são agora controlados por um único
-- módulo "negocios" (CRM PRO™)
--

-- Update: Renomear "Negócios" para "CRM PRO™"
UPDATE settings_system_modules
SET module_name = 'CRM PRO™'
WHERE module_key = 'negocios';

-- Verify the changes
SELECT module_key, module_name, ativo, ordem
FROM settings_system_modules
ORDER BY ordem;

-- Expected result:
-- The list should show all 12 modules, but in Settings → Modules
-- only these will be shown (others are filtered):
-- 1. BI PRO™
-- 2. OMNI PRO™
-- 3. CALL PRO™
-- 4. SENDS PRO™
-- 5. SCHEDULE PRO™
-- 6. SCORE PRO™
-- 7. AI AGENTS PRO™
-- 8. LP PRO™
-- 9. Configurações
--
-- Hidden from Settings (but still in database):
-- - negocios (CRM PRO™)
-- - clientes (sub-module of CRM)
-- - followups (sub-module of CRM)
