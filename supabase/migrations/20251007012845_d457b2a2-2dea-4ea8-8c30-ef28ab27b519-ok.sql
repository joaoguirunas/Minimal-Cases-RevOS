-- Insert 5 sample people with valid UUIDs (hex only)
INSERT INTO clients_people (id, name, email, whatsapp, service_status, ai_enabled, score, notes, type, status) VALUES
('a1b2c3d4-e5f6-4789-a123-567890abcdef', 'John Smith', 'john.smith@example.com', '+1234567890', 'aberto', true, 85, 'High priority lead, interested in enterprise solutions', 'lead', 'ativo'),
('b2c3d4e5-f6a7-4890-b234-678901bcdeaf', 'Maria Garcia', 'maria.garcia@example.com', '+1234567891', 'aberto', true, 72, 'Looking for consulting services', 'lead', 'ativo'),
('c3d4e5f6-a7b8-4901-c345-789012cdeabc', 'Robert Johnson', 'robert.johnson@example.com', '+1234567892', 'em-atendimento', true, 90, 'VIP client, quick decision maker', 'cliente', 'ativo'),
('d4e5f6a7-b8c9-4012-d456-890123deabcd', 'Ana Silva', 'ana.silva@example.com', '+1234567893', 'aberto', false, 60, 'Needs follow-up next week', 'lead', 'ativo'),
('e5f6a7b8-c9d0-4123-e567-901234efabcd', 'Michael Chen', 'michael.chen@example.com', '+1234567894', 'fechado', true, 95, 'Closed deal, ongoing support', 'cliente', 'ativo');

-- Insert 5 sample companies with valid UUIDs
INSERT INTO clients_companies (id, trade_name, legal_name, tax_id, email, phone, status, notes) VALUES
('f6a7b8c9-d0e1-4234-f678-012345fabcde', 'Tech Solutions Inc', 'Tech Solutions Incorporated', '12345678901234', 'contact@techsolutions.com', '+1234567895', 'ativo', 'B2B software company'),
('a7b8c9d0-e1f2-4345-a789-123456abcdef', 'Global Consulting Ltd', 'Global Consulting Limited', '23456789012345', 'info@globalconsulting.com', '+1234567896', 'ativo', 'Management consulting firm'),
('b8c9d0e1-f2a3-4456-b890-234567abcdef', 'Green Energy Corp', 'Green Energy Corporation', '34567890123456', 'hello@greenenergy.com', '+1234567897', 'ativo', 'Renewable energy provider'),
('c9d0e1f2-a3b4-4567-c901-345678abcdef', 'Digital Marketing Pro', 'Digital Marketing Pro LLC', '45678901234567', 'team@digitalmarketing.com', '+1234567898', 'ativo', 'Digital marketing agency'),
('d0e1f2a3-b4c5-4678-d012-456789abcdef', 'Finance Partners', 'Finance Partners Group', '56789012345678', 'partners@financepartners.com', '+1234567899', 'ativo', 'Financial services company');

-- Link people to companies
INSERT INTO clients_people_companies (people_id, companies_id) VALUES
('a1b2c3d4-e5f6-4789-a123-567890abcdef', 'f6a7b8c9-d0e1-4234-f678-012345fabcde'),
('b2c3d4e5-f6a7-4890-b234-678901bcdeaf', 'a7b8c9d0-e1f2-4345-a789-123456abcdef'),
('c3d4e5f6-a7b8-4901-c345-789012cdeabc', 'b8c9d0e1-f2a3-4456-b890-234567abcdef'),
('d4e5f6a7-b8c9-4012-d456-890123deabcd', 'c9d0e1f2-a3b4-4567-c901-345678abcdef'),
('e5f6a7b8-c9d0-4123-e567-901234efabcd', 'd0e1f2a3-b4c5-4678-d012-456789abcdef');

-- Insert 5 sample leads
WITH first_pipeline AS (
  SELECT id FROM leads_pipelines WHERE active = true ORDER BY created_at LIMIT 1
),
first_stage AS (
  SELECT id FROM leads_stages WHERE active = true ORDER BY order_index LIMIT 1
)
INSERT INTO leads (people_id, companies_id, leads_pipelines_id, leads_stages_id, title, value, status, utm_source, utm_campaign)
SELECT 
  people_id::uuid,
  companies_id::uuid,
  (SELECT id FROM first_pipeline),
  (SELECT id FROM first_stage),
  title,
  value::numeric,
  status,
  utm_source,
  utm_campaign
FROM (VALUES
  ('a1b2c3d4-e5f6-4789-a123-567890abcdef', 'f6a7b8c9-d0e1-4234-f678-012345fabcde', 'Enterprise Software License', '50000.00', 'em-andamento', 'google', 'enterprise_2024'),
  ('b2c3d4e5-f6a7-4890-b234-678901bcdeaf', 'a7b8c9d0-e1f2-4345-a789-123456abcdef', 'Consulting Package', '25000.00', 'em-andamento', 'linkedin', 'consulting_q1'),
  ('c3d4e5f6-a7b8-4901-c345-789012cdeabc', 'b8c9d0e1-f2a3-4456-b890-234567abcdef', 'Annual Support Contract', '75000.00', 'ganho', 'referral', 'partner_program'),
  ('d4e5f6a7-b8c9-4012-d456-890123deabcd', 'c9d0e1f2-a3b4-4567-c901-345678abcdef', 'Marketing Campaign', '15000.00', 'em-andamento', 'facebook', 'social_media_ads'),
  ('e5f6a7b8-c9d0-4123-e567-901234efabcd', 'd0e1f2a3-b4c5-4678-d012-456789abcdef', 'Financial Advisory', '35000.00', 'em-andamento', 'organic', 'website_contact')
) AS v(people_id, companies_id, title, value, status, utm_source, utm_campaign);

-- Insert 5 sample messages
WITH sample_leads AS (
  SELECT l.id as lead_id, l.people_id, ROW_NUMBER() OVER (ORDER BY l.created_at) as rn
  FROM leads l 
  WHERE l.people_id IN (
    'a1b2c3d4-e5f6-4789-a123-567890abcdef',
    'b2c3d4e5-f6a7-4890-b234-678901bcdeaf',
    'c3d4e5f6-a7b8-4901-c345-789012cdeabc',
    'd4e5f6a7-b8c9-4012-d456-890123deabcd',
    'e5f6a7b8-c9d0-4123-e567-901234efabcd'
  )
  ORDER BY l.created_at
  LIMIT 5
),
messages_data AS (
  SELECT * FROM (VALUES
    (1, '+1234567890', 'Hello, I am interested in learning more about your enterprise solutions.'),
    (2, '+1234567891', 'Can we schedule a consultation call this week?'),
    (3, '+1234567892', 'Thanks for the great service! Looking forward to continuing our partnership.'),
    (4, '+1234567893', 'I have some questions about your pricing plans.'),
    (5, '+1234567894', 'The contract looks good. Let''s proceed with the next steps.')
  ) AS v(msg_rn, from_contact, content)
)
INSERT INTO messages (leads_id, people_id, from_contact, content, channel, message_type)
SELECT 
  sl.lead_id,
  sl.people_id,
  md.from_contact,
  md.content,
  'whatsapp',
  'texto'
FROM sample_leads sl
JOIN messages_data md ON sl.rn = md.msg_rn;

-- Insert 5 sample meetings
WITH sample_leads AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM leads 
  WHERE people_id IN (
    'a1b2c3d4-e5f6-4789-a123-567890abcdef',
    'b2c3d4e5-f6a7-4890-b234-678901bcdeaf',
    'c3d4e5f6-a7b8-4901-c345-789012cdeabc',
    'd4e5f6a7-b8c9-4012-d456-890123deabcd',
    'e5f6a7b8-c9d0-4123-e567-901234efabcd'
  )
  LIMIT 5
),
meetings_data AS (
  SELECT * FROM (VALUES
    (1, 2, '10:00:00', '11:00:00', 'agendado', 'Initial discovery call', 'Google Meet'),
    (2, 3, '14:00:00', '15:00:00', 'agendado', 'Product demo presentation', 'Zoom'),
    (3, -1, '09:00:00', '10:00:00', 'concluido', 'Quarterly review meeting', 'Office'),
    (4, 5, '15:30:00', '16:30:00', 'agendado', 'Follow-up discussion', 'Microsoft Teams'),
    (5, 1, '11:00:00', '12:00:00', 'agendado', 'Contract negotiation', 'Google Meet')
  ) AS v(meet_rn, days_offset, start_time, end_time, status, notes, location)
)
INSERT INTO meetings (leads_id, date, start_time, end_time, status, notes, location)
SELECT 
  sl.id,
  CURRENT_DATE + (md.days_offset || ' days')::interval,
  md.start_time::time,
  md.end_time::time,
  md.status,
  md.notes,
  md.location
FROM sample_leads sl
JOIN meetings_data md ON sl.rn = md.meet_rn;