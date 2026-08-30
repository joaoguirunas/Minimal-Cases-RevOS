-- Canned Responses (Respostas Padrão)
-- Triggered by typing / in the composer (WhatsApp + Instagram DM)

CREATE TABLE IF NOT EXISTS public.canned_responses (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text        NOT NULL,           -- Display name: "Saudação inicial"
  shortcut    text,                           -- Optional trigger: "ola" → matches /ola
  content     text        NOT NULL,           -- Full message text
  channels    text[]      DEFAULT ARRAY['whatsapp','instagram'],
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.canned_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "canned_responses_all" ON public.canned_responses;
CREATE POLICY "canned_responses_all"
  ON public.canned_responses FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed: 5 responses to get started
INSERT INTO public.canned_responses (title, shortcut, content, channels) VALUES
  ('Saudação inicial',     'ola',       'Olá! Tudo bem? 😊 Como posso te ajudar hoje?',                                          ARRAY['whatsapp','instagram']),
  ('Aguarde um momento',   'aguarde',   'Perfeito! Só um momento que já verifico aqui para você.',                                ARRAY['whatsapp','instagram']),
  ('Obrigado pelo contato','obrigado',  'Obrigado pelo contato! Foi um prazer te atender. Qualquer dúvida é só chamar. 👋',        ARRAY['whatsapp','instagram']),
  ('Enviar proposta',      'proposta',  'Vou preparar uma proposta personalizada para você e envio em breve. Pode aguardar?',     ARRAY['whatsapp','instagram']),
  ('Agendar reunião',      'reuniao',   'Que tal agendarmos uma conversa rápida de 30 minutos para eu te apresentar melhor? Qual horário funciona para você?', ARRAY['whatsapp','instagram']);
