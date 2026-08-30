-- PASSO 1: Inserir clientes únicos (mais recente por email)
WITH unique_leads AS (
  SELECT DISTINCT ON (email) 
    id as site_lead_id,
    nome,
    email,
    telefone,
    empresa,
    pagina_origem,
    utm_source,
    utm_medium,
    utm_campaign,
    created_at
  FROM site_leads
  ORDER BY email, created_at DESC
)
INSERT INTO clients_people (name, email, whatsapp, notes, source, status, created_at)
SELECT 
  nome,
  email,
  telefone,
  CONCAT('Empresa: ', COALESCE(empresa, 'N/A'), 
         ' | Origem: ', COALESCE(pagina_origem, 'site'),
         CASE WHEN utm_source IS NOT NULL THEN ' | UTM: ' || utm_source ELSE '' END),
  COALESCE(pagina_origem, 'site_leads'),
  'ativo',
  created_at
FROM unique_leads
ON CONFLICT DO NOTHING;

-- PASSO 2: Criar negócios para cada lead original
INSERT INTO leads (title, people_id, leads_pipelines_id, leads_stages_id, status, description, created_at)
SELECT 
  'Lead - ' || sl.nome,
  cp.id,
  '49d056f8-f681-4338-9622-bcbf19a010df'::uuid,
  'd03c693a-9814-451c-890b-c4823b98d99a'::uuid,
  'em-andamento',
  CONCAT('Empresa: ', COALESCE(sl.empresa, 'N/A'),
         CASE WHEN sl.pagina_origem IS NOT NULL THEN ' | Página: ' || sl.pagina_origem ELSE '' END,
         CASE WHEN sl.utm_campaign IS NOT NULL THEN ' | Campanha: ' || sl.utm_campaign ELSE '' END),
  sl.created_at
FROM site_leads sl
JOIN clients_people cp ON cp.email = sl.email;