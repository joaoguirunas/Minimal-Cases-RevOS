-- Adicionar foreign keys explícitas com nomes corretos

-- Messages foreign keys
ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_people_id_fkey,
  ADD CONSTRAINT messages_people_id_fkey
    FOREIGN KEY (people_id) REFERENCES clients_people(id) ON DELETE CASCADE;

ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_leads_id_fkey,
  ADD CONSTRAINT messages_leads_id_fkey
    FOREIGN KEY (leads_id) REFERENCES leads(id) ON DELETE CASCADE;

ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_users_id_fkey,
  ADD CONSTRAINT messages_users_id_fkey
    FOREIGN KEY (users_id) REFERENCES settings_users(id) ON DELETE SET NULL;

-- Leads foreign keys
ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_people_id_fkey,
  ADD CONSTRAINT leads_people_id_fkey
    FOREIGN KEY (people_id) REFERENCES clients_people(id) ON DELETE CASCADE;

ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_companies_id_fkey,
  ADD CONSTRAINT leads_companies_id_fkey
    FOREIGN KEY (companies_id) REFERENCES clients_companies(id) ON DELETE SET NULL;

ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_users_id_fkey,
  ADD CONSTRAINT leads_users_id_fkey
    FOREIGN KEY (users_id) REFERENCES settings_users(id) ON DELETE SET NULL;

ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_teams_id_fkey,
  ADD CONSTRAINT leads_teams_id_fkey
    FOREIGN KEY (teams_id) REFERENCES settings_teams(id) ON DELETE SET NULL;

ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_leads_pipelines_id_fkey,
  ADD CONSTRAINT leads_leads_pipelines_id_fkey
    FOREIGN KEY (leads_pipelines_id) REFERENCES leads_pipelines(id) ON DELETE RESTRICT;

ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_leads_stages_id_fkey,
  ADD CONSTRAINT leads_leads_stages_id_fkey
    FOREIGN KEY (leads_stages_id) REFERENCES leads_stages(id) ON DELETE RESTRICT;

-- Leads stages foreign keys
ALTER TABLE leads_stages
  DROP CONSTRAINT IF EXISTS leads_stages_leads_pipelines_id_fkey,
  ADD CONSTRAINT leads_stages_leads_pipelines_id_fkey
    FOREIGN KEY (leads_pipelines_id) REFERENCES leads_pipelines(id) ON DELETE CASCADE;

-- Clients people companies foreign keys
ALTER TABLE clients_people_companies
  DROP CONSTRAINT IF EXISTS clients_people_companies_people_id_fkey,
  ADD CONSTRAINT clients_people_companies_people_id_fkey
    FOREIGN KEY (people_id) REFERENCES clients_people(id) ON DELETE CASCADE;

ALTER TABLE clients_people_companies
  DROP CONSTRAINT IF EXISTS clients_people_companies_companies_id_fkey,
  ADD CONSTRAINT clients_people_companies_companies_id_fkey
    FOREIGN KEY (companies_id) REFERENCES clients_companies(id) ON DELETE CASCADE;
