-- Drop old settings_modules table
DROP TABLE IF EXISTS settings_modules CASCADE;

-- Create new settings_system_modules table
CREATE TABLE settings_system_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key TEXT NOT NULL UNIQUE,
  module_name TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  ordem INTEGER NOT NULL,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE settings_system_modules ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "authenticated_read" ON settings_system_modules
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_write" ON settings_system_modules
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert system modules
INSERT INTO settings_system_modules (module_key, module_name, ativo, ordem, icon) VALUES
  ('dashboard', 'Dashboard', true, 1, 'LayoutDashboard'),
  ('conversas', 'Conversas', true, 2, 'MessageSquare'),
  ('negocios', 'Negócios', true, 3, 'Target'),
  ('clientes', 'Clientes', true, 4, 'Users'),
  ('agendamentos', 'Reuniões', true, 5, 'Calendar'),
  ('disparos', 'Disparos', true, 6, 'Send'),
  ('agentes-ia', 'Agentes IA', true, 7, 'Bot'),
  ('followups', 'Follow-ups', true, 8, 'Clock'),
  ('configuracoes', 'Configurações', true, 9, 'Settings');

-- Create trigger for updated_at
CREATE TRIGGER update_settings_system_modules_updated_at
  BEFORE UPDATE ON settings_system_modules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();