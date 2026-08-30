-- Update system module names to English
UPDATE settings_system_modules 
SET module_name = 'Dashboard' 
WHERE module_key = 'dashboard';

UPDATE settings_system_modules 
SET module_name = 'Leads' 
WHERE module_key = 'negocios';

UPDATE settings_system_modules 
SET module_name = 'Conversations' 
WHERE module_key = 'conversas';

UPDATE settings_system_modules 
SET module_name = 'Clients' 
WHERE module_key = 'clientes';

UPDATE settings_system_modules 
SET module_name = 'Appointments' 
WHERE module_key = 'agendamentos';

UPDATE settings_system_modules 
SET module_name = 'Campaigns' 
WHERE module_key = 'disparos';