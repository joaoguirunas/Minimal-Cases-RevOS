-- Adicionar ícones para todos os módulos do sistema
UPDATE settings_system_modules
SET icon = CASE 
  WHEN module_key = 'dashboard' THEN 'BarChart3'
  WHEN module_key = 'conversas' THEN 'MessageCircle'
  WHEN module_key = 'negocios' THEN 'PieChart'
  WHEN module_key = 'disparos' THEN 'Send'
  WHEN module_key = 'agendamentos' THEN 'Calendar'
  WHEN module_key = 'clientes' THEN 'Users'
  WHEN module_key = 'agentes-ia' THEN 'Bot'
  WHEN module_key = 'followups' THEN 'Clock'
  WHEN module_key = 'configuracoes' THEN 'Settings'
  ELSE icon
END
WHERE icon IS NULL OR icon = '';