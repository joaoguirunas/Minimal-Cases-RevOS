-- Seed: motivos padrão de perda (idempotente via UUIDs fixos)
INSERT INTO public.leads_loss_reasons (id, name, description, active)
VALUES
  ('a1b2c3d4-0001-0000-0000-000000000001', 'Sem interesse',  'Lead não demonstrou interesse no produto/serviço', true),
  ('a1b2c3d4-0001-0000-0000-000000000002', 'Preço',          'Lead considerou o preço elevado ou fora do budget', true),
  ('a1b2c3d4-0001-0000-0000-000000000003', 'Concorrente',    'Lead optou por solução de um concorrente',          true),
  ('a1b2c3d4-0001-0000-0000-000000000004', 'Sem resposta',   'Lead parou de responder após contato inicial',      true),
  ('a1b2c3d4-0001-0000-0000-000000000005', 'Fora do ICP',    'Lead fora do perfil ideal de cliente',              true)
ON CONFLICT (id) DO NOTHING;
