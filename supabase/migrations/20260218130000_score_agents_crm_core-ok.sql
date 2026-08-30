-- Score e Agentes IA agora são parte do CRM core, não módulos opcionais.
-- Garantir que estejam sempre ativos.
UPDATE settings_system_modules
SET ativo = true
WHERE module_key IN ('score', 'agentes-ia');
