-- Permite marcar um template com uma finalidade interna (ex: 'retomada' —
-- usado pelo comercial pra reabrir conversas fora da janela de 24h, seja
-- reengajamento de lead frio ou primeiro contato atrasado de quem só
-- preencheu formulário). Não é campo da Meta, é só pra filtro no CRM.

ALTER TABLE public.whatsapp_templates
  ADD COLUMN IF NOT EXISTS purpose text;

COMMENT ON COLUMN public.whatsapp_templates.purpose IS
  'Tag interna opcional do CRM (não é campo da Meta). Ex: ''retomada'' = template usado pelo comercial pra reabrir conversa fora da janela de 24h.';
