-- YMP-6 — Toggle de entrada de novos leads da Yampi.
--
-- Com lead_intake_enabled = false:
--   • yampi-reconcile para de sintetizar checkout_iniciado dos carrinhos novos
--   • yampi-process-event NÃO cria contato nem lead novos (eventos de quem já
--     está no CRM continuam movendo o lead existente e a reconversão continua
--     sendo capturada — nada some do funil já montado)
-- Serve para congelar a esteira num recorte (ex.: só os carrinhos da semana
-- retrasada) sem que o fluxo ao vivo despeje leads novos no kanban.

ALTER TABLE public.yampi_connections
  ADD COLUMN IF NOT EXISTS lead_intake_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.yampi_connections.lead_intake_enabled IS
  'false = eventos Yampi não criam contatos/leads novos (leads existentes continuam se movendo); true = fluxo normal.';
