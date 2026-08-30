-- BAETA generic seed — só registro de módulos do produto, bucket de storage e
-- motivos de perda padrão. Nenhum dado de negócio, nenhuma credencial.

INSERT INTO public.settings_system_modules (id, module_key, module_name, is_active, order_index, icon) VALUES
  ('3f8d5189-a2fe-4274-9795-e03bdd6fee7a', 'dashboard', 'BI PRO™', true, 1, null),
  ('e2740e10-e343-4489-b0d6-cb800a71fbe9', 'negocios', 'CRM PRO™', true, 2, null),
  ('f259ca3b-95f7-42ef-a47a-ee825a92a482', 'clientes', 'CRM Pessoas™', true, 3, null),
  ('ef53e0a7-7b51-45f0-a8d0-d58c273901f0', 'conversas', 'OMNI PRO™', true, 4, null),
  ('5c4faae0-e675-4df4-bf0a-db5c1a065dcf', 'disparos', 'SENDS PRO™', true, 6, null),
  ('681fa460-dd67-49ac-8276-21f274b6b690', 'agendamentos', 'SCHEDULE PRO™', true, 7, null),
  ('26aa12a4-45ed-49b2-b9c1-bbc714496889', 'lp', 'FORM PRO™', true, 8, null),
  ('708822dd-1000-4829-b1a0-9640a7ab92ab', 'agentes-ia', 'AI AGENTS™', true, 9, null),
  ('0d65bcd3-3f71-4d42-afca-d95779adc0a3', 'score', 'SCORE PRO™', true, 10, null)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) VALUES
  ('omni-media', 'omni-media', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.leads_loss_reasons (id, name, active) VALUES
  ('a1b2c3d4-0001-0000-0000-000000000001', 'Sem interesse', true),
  ('a1b2c3d4-0001-0000-0000-000000000002', 'Preço', true),
  ('a1b2c3d4-0001-0000-0000-000000000003', 'Concorrente', true),
  ('a1b2c3d4-0001-0000-0000-000000000004', 'Sem resposta', true),
  ('a1b2c3d4-0001-0000-0000-000000000005', 'Fora do ICP', true)
ON CONFLICT (id) DO NOTHING;
