-- Allow anonymous users to read form_pro_forms (for public form sharing pages)
DROP POLICY IF EXISTS "allow_anon_read_form_pro_forms" ON form_pro_forms;
CREATE POLICY "allow_anon_read_form_pro_forms"
  ON form_pro_forms
  FOR SELECT
  TO anon
  USING (true);

-- Allow anonymous users to read settings (for company branding on public pages)
DROP POLICY IF EXISTS "allow_anon_read_settings" ON settings;
CREATE POLICY "allow_anon_read_settings"
  ON settings
  FOR SELECT
  TO anon
  USING (true);
