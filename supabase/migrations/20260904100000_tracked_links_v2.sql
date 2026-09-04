-- LINKS-V2 — Links rastreados: origem por toque, evento por clique, antibot, LGPD.
--
-- tracked_links       + source/label/template_name/followup_queue_id/message_id/execution_id/bot_hits/nudge_scheduled_at
-- tracked_link_clicks   1 linha por hit (humano ou robô). clicks/first/last_clicked_at de tracked_links
--                       passam a contar SÓ humano não duplicado (a RPC garante).
-- record_tracked_click  1 round-trip pro caminho quente da edge fn `r`.
-- purge_tracked_click_pii  apaga user_agent/ip_hash/referer com > 90 dias (pg_cron 03:17).
-- esteira_reconversions + attributed_link_id/source/template_name (qual toque converteu).

BEGIN;

-- ── tracked_links: origem ────────────────────────────────────────────────────
ALTER TABLE public.tracked_links
  ADD COLUMN IF NOT EXISTS source            text NOT NULL DEFAULT 'outro',
  ADD COLUMN IF NOT EXISTS label             text,
  ADD COLUMN IF NOT EXISTS template_name     text,
  ADD COLUMN IF NOT EXISTS followup_queue_id uuid REFERENCES public.followup_queue(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS message_id        bigint REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS execution_id      uuid,
  ADD COLUMN IF NOT EXISTS bot_hits          integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nudge_scheduled_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tracked_links_source_check') THEN
    ALTER TABLE public.tracked_links ADD CONSTRAINT tracked_links_source_check
      CHECK (source = ANY (ARRAY['esteira_email','esteira_whatsapp','esteira_sms','agente','manual','outro']));
  END IF;
END $$;

COMMENT ON COLUMN public.tracked_links.source IS 'Quem criou o link: esteira_email | esteira_whatsapp | esteira_sms | agente | manual | outro (legado).';
COMMENT ON COLUMN public.tracked_links.label IS 'Slot do link: link_checkout | link_novo_checkout | wa_button_url | yampi_enviar_link_carrinho | yampi_enviar_link_pagamento | enviar_link_compra.';
COMMENT ON COLUMN public.tracked_links.template_name IS 'Nome do template Meta / template de e-mail / subject do toque que carregou o link.';
COMMENT ON COLUMN public.tracked_links.clicks IS 'Cliques HUMANOS não duplicados (robôs em bot_hits; detalhe em tracked_link_clicks).';

-- Legado: e-mail e SMS só nasciam da esteira. WhatsApp pode ser esteira ou agente → fica 'outro'.
UPDATE public.tracked_links SET source = 'esteira_email' WHERE source = 'outro' AND channel = 'email';
UPDATE public.tracked_links SET source = 'esteira_sms'   WHERE source = 'outro' AND channel = 'sms';

CREATE INDEX IF NOT EXISTS tracked_links_message_idx  ON public.tracked_links (message_id) WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tracked_links_lead_idx     ON public.tracked_links (lead_id, created_at DESC) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tracked_links_fq_idx       ON public.tracked_links (followup_queue_id) WHERE followup_queue_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tracked_links_created_idx  ON public.tracked_links (created_at DESC);

-- ── tracked_link_clicks: 1 linha por hit ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tracked_link_clicks (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tracked_link_id uuid NOT NULL REFERENCES public.tracked_links(id) ON DELETE CASCADE,
  lead_id         uuid,
  people_id       uuid,
  clicked_at      timestamptz NOT NULL DEFAULT now(),
  is_bot          boolean NOT NULL DEFAULT false,
  bot_reason      text,
  is_duplicate    boolean NOT NULL DEFAULT false,
  device          text,
  user_agent      text,
  ip_hash         text,
  referer         text
);
COMMENT ON TABLE public.tracked_link_clicks IS
  'Cada GET no link rastreado. is_bot=true (crawler de preview/scanner/prefetch) e is_duplicate=true (mesmo link+ip em <10s) NÃO contam em tracked_links.clicks. user_agent/ip_hash/referer são apagados após 90 dias (purge_tracked_click_pii). ip_hash = sha256(salt|dia|ip) — nunca IP puro.';

CREATE INDEX IF NOT EXISTS tlc_link_idx         ON public.tracked_link_clicks (tracked_link_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS tlc_lead_human_idx   ON public.tracked_link_clicks (lead_id, clicked_at DESC)   WHERE is_bot = false AND is_duplicate = false AND lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tlc_people_human_idx ON public.tracked_link_clicks (people_id, clicked_at DESC) WHERE is_bot = false AND is_duplicate = false AND people_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tlc_clicked_idx      ON public.tracked_link_clicks (clicked_at);

ALTER TABLE public.tracked_link_clicks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tracked_link_clicks_select_active_users ON public.tracked_link_clicks;
CREATE POLICY tracked_link_clicks_select_active_users ON public.tracked_link_clicks FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.settings_users su WHERE su.auth_user_id = auth.uid() AND su.active = true));
DROP POLICY IF EXISTS tracked_link_clicks_service_role ON public.tracked_link_clicks;
CREATE POLICY tracked_link_clicks_service_role ON public.tracked_link_clicks
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Realtime (INSERT de clique → kanban/inbox/BI sem F5). RLS de SELECT vale pro canal.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tracked_link_clicks') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tracked_link_clicks;
  END IF;
END $$;

-- ── RPC: caminho quente do redirect (1 round-trip) ───────────────────────────
CREATE OR REPLACE FUNCTION public.record_tracked_click(
  p_token      text,
  p_is_bot     boolean,
  p_bot_reason text,
  p_user_agent text,
  p_ip_hash    text,
  p_referer    text,
  p_device     text
)
RETURNS TABLE (
  destination     text,
  lead_id         uuid,
  people_id       uuid,
  tracked_link_id uuid,
  counted         boolean,
  first_human     boolean,
  source          text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l         public.tracked_links%ROWTYPE;
  v_dup     boolean := false;
  v_counted boolean := false;
  v_first   boolean := false;
BEGIN
  SELECT * INTO l FROM public.tracked_links t WHERE t.token = p_token;
  IF NOT FOUND THEN RETURN; END IF;

  IF NOT p_is_bot THEN
    -- Android: abre no navegador do WhatsApp e depois "abrir no Chrome" = 2 GETs em segundos.
    SELECT EXISTS (
      SELECT 1 FROM public.tracked_link_clicks c
      WHERE c.tracked_link_id = l.id AND c.is_bot = false AND c.is_duplicate = false
        AND c.ip_hash IS NOT DISTINCT FROM p_ip_hash
        AND c.clicked_at > now() - interval '10 seconds'
    ) INTO v_dup;
  END IF;

  INSERT INTO public.tracked_link_clicks
    (tracked_link_id, lead_id, people_id, is_bot, bot_reason, is_duplicate, device, user_agent, ip_hash, referer)
  VALUES
    (l.id, l.lead_id, l.people_id, p_is_bot, p_bot_reason, v_dup, p_device, left(p_user_agent, 512), p_ip_hash, left(p_referer, 512));

  IF p_is_bot THEN
    UPDATE public.tracked_links SET bot_hits = bot_hits + 1 WHERE id = l.id;
  ELSIF NOT v_dup THEN
    v_counted := true;
    v_first   := l.first_clicked_at IS NULL;
    UPDATE public.tracked_links
       SET clicks = clicks + 1,
           first_clicked_at = COALESCE(first_clicked_at, now()),
           last_clicked_at  = now()
     WHERE id = l.id;
  END IF;

  RETURN QUERY SELECT l.destination, l.lead_id, l.people_id, l.id, v_counted, v_first, l.source;
END;
$$;

REVOKE ALL ON FUNCTION public.record_tracked_click(text, boolean, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_tracked_click(text, boolean, text, text, text, text, text) TO service_role;
COMMENT ON FUNCTION public.record_tracked_click IS 'Edge fn r: registra o hit, conta só humano não duplicado e devolve destino/lead/pessoa em 1 chamada.';

-- ── LGPD: minimização — apaga UA/hash/referer com mais de 90 dias ────────────
CREATE OR REPLACE FUNCTION public.purge_tracked_click_pii()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.tracked_link_clicks
     SET user_agent = NULL, ip_hash = NULL, referer = NULL
   WHERE clicked_at < now() - interval '90 days'
     AND (user_agent IS NOT NULL OR ip_hash IS NOT NULL OR referer IS NOT NULL);
$$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tracked-click-pii-purge') THEN
      PERFORM cron.unschedule('tracked-click-pii-purge');
    END IF;
    PERFORM cron.schedule('tracked-click-pii-purge', '17 3 * * *', $c$SELECT public.purge_tracked_click_pii();$c$);
  END IF;
END $$;

-- ── esteira_reconversions: qual link converteu ───────────────────────────────
ALTER TABLE public.esteira_reconversions
  ADD COLUMN IF NOT EXISTS attributed_link_id       uuid,
  ADD COLUMN IF NOT EXISTS attributed_link_source   text,
  ADD COLUMN IF NOT EXISTS attributed_template_name text;
COMMENT ON COLUMN public.esteira_reconversions.attributed_template_name IS
  'Quando attribution_level=clique: template/toque do link clicado antes do pagamento (ex.: minimal_esteira_wa01, "E2 · Celular voando").';

COMMIT;
