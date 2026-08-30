-- Meeting Records — resumos, gravações, transcrições e análise IA
-- Uma reunião pode ter N artefatos de diferentes tipos/fontes

-- 1. Campo outcome no meetings (útil para filtros e BI)
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS outcome text
    CHECK (outcome IN ('venda', 'follow_up', 'sem_interesse', 'reagendada', 'nao_compareceu'));

-- 2. Tabela principal de artefatos
CREATE TABLE IF NOT EXISTS public.meeting_records (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id    uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,

  -- Tipo de artefato
  record_type   text NOT NULL CHECK (record_type IN (
    'recording',    -- vídeo (Loom, Google Meet, Zoom, etc.)
    'transcript',   -- transcrição em texto
    'summary',      -- resumo escrito pelo humano
    'ai_summary',   -- resumo gerado por IA
    'ai_analysis',  -- análise completa (tópicos, sentimento, próximos passos)
    'note'          -- anotação manual
  )),

  -- Ferramenta de origem
  source        text,  -- 'loom', 'google_meet', 'zoom', 'fireflies', 'fathom', 'manual', 'ai'

  -- Gravação / vídeo
  url           text,               -- share URL (ex: https://loom.com/share/xxx)
  duration_seconds integer,         -- duração em segundos
  thumbnail_url text,               -- thumbnail do vídeo

  -- Conteúdo textual (transcrição, resumo, análise)
  title         text,
  content       text,               -- texto principal
  content_format text DEFAULT 'markdown'
    CHECK (content_format IN ('text', 'markdown', 'html', 'json')),

  -- Campos específicos de análise IA
  ai_sentiment  text
    CHECK (ai_sentiment IN ('positivo', 'neutro', 'negativo', 'misto')),
  ai_score      integer CHECK (ai_score >= 0 AND ai_score <= 100),  -- 0-100
  ai_key_topics text[],       -- principais tópicos discutidos
  ai_next_steps text[],       -- próximos passos identificados
  ai_objections text[],       -- objeções levantadas
  ai_metadata   jsonb,        -- dados adicionais estruturados da IA (raw output, tokens, etc.)

  -- Metadados
  recorded_at   timestamptz,  -- quando a gravação/evento aconteceu
  created_by    uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS meeting_records_meeting_id_idx ON public.meeting_records(meeting_id);
CREATE INDEX IF NOT EXISTS meeting_records_type_idx       ON public.meeting_records(meeting_id, record_type);
CREATE INDEX IF NOT EXISTS meeting_records_source_idx     ON public.meeting_records(source);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trigger_update_meeting_records_updated_at ON public.meeting_records;
CREATE TRIGGER trigger_update_meeting_records_updated_at
  BEFORE UPDATE ON public.meeting_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.meeting_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meeting_records_all" ON public.meeting_records;
CREATE POLICY "meeting_records_all"
  ON public.meeting_records
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
