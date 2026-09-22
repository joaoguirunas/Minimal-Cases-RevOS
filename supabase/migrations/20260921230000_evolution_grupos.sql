-- GRUPOS-01 — Grupos do WhatsApp não-oficial usados pelo agente.
--
-- O número da Evolution não atende cliente: ele fala com o TIME. Dois destinos,
-- escolhidos na tela de Integrações a partir dos grupos em que o número está:
--   · fornecedor  — recebe pedido de alteração de pedido ainda não despachado;
--   · atendimento — recebe o handoff humano com link, nome e resumo da conversa.
--
-- Guardamos o JID (chave real, `...@g.us`) e o nome no momento da escolha — o
-- nome é só para a UI não precisar consultar a Evolution para exibir a seleção,
-- e pode ficar velho se renomearem o grupo; o JID nunca muda.

ALTER TABLE public.settings_whatsapp_channels
  ADD COLUMN IF NOT EXISTS evolution_group_fornecedor_jid   text,
  ADD COLUMN IF NOT EXISTS evolution_group_fornecedor_nome  text,
  ADD COLUMN IF NOT EXISTS evolution_group_atendimento_jid  text,
  ADD COLUMN IF NOT EXISTS evolution_group_atendimento_nome text;

COMMENT ON COLUMN public.settings_whatsapp_channels.evolution_group_fornecedor_jid IS
  'JID (…@g.us) do grupo do fornecedor: destino dos pedidos de alteração de pedido não despachado.';
COMMENT ON COLUMN public.settings_whatsapp_channels.evolution_group_atendimento_jid IS
  'JID (…@g.us) do grupo do time: destino do handoff humano, com link da conversa, nome e resumo.';
