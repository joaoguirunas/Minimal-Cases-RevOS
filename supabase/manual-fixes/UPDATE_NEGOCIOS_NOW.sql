-- ⚡ URGENTE: Renomear "Negócios" para "CRM PRO™" AGORA

-- Verificar estado atual
SELECT module_key, module_name FROM settings_system_modules WHERE module_key = 'negocios';

-- EXECUTAR ESTA LINHA PARA CORRIGIR:
UPDATE settings_system_modules
SET module_name = 'CRM PRO™'
WHERE module_key = 'negocios';

-- Verificar se foi atualizado
SELECT module_key, module_name, icon, ativo, ordem
FROM settings_system_modules
WHERE module_key = 'negocios';

-- Resultado esperado:
-- negocios | CRM PRO™ | PieChart | true | 9
