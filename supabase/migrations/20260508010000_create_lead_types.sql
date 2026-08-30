-- ═══════════════════════════════════════════════════════════════════
-- 20260508010000_create_lead_types.sql
-- Cria tabela lead_types para substituir tipos hardcoded de importação.
-- Seed com os 4 tipos existentes (Recomendação, Pessoal, Evento, Network).
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.lead_types (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text        NOT NULL DEFAULT '',
  csv_headers text[]      NOT NULL DEFAULT '{nome,whatsapp}',
  csv_example text[]      NOT NULL DEFAULT '{}',
  is_active   boolean     NOT NULL DEFAULT true,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS lead_types_name_key ON public.lead_types (name);
CREATE INDEX IF NOT EXISTS lead_types_sort_order_idx ON public.lead_types (sort_order, name);

ALTER TABLE public.lead_types ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'lead_types' AND policyname = 'lead_types_select'
  ) THEN
    EXECUTE 'CREATE POLICY lead_types_select ON public.lead_types FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;

-- Escrita: apenas manager e admin
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'lead_types' AND policyname = 'lead_types_write'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY lead_types_write ON public.lead_types
        FOR ALL TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.settings_users
            WHERE auth_user_id = auth.uid()
              AND user_type IN ('manager', 'admin')
              AND active = true
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.settings_users
            WHERE auth_user_id = auth.uid()
              AND user_type IN ('manager', 'admin')
              AND active = true
          )
        )
    $pol$;
  END IF;
END $$;

-- Seed: 4 tipos existentes
INSERT INTO public.lead_types (name, description, csv_headers, csv_example, sort_order)
VALUES
  (
    'Recomendação',
    'Contatos indicados por terceiros',
    ARRAY['nome','whatsapp','recomendante','relacao_recomendante'],
    ARRAY['José Silva','5548999999999','Carlos Mendes','seu amigo do trabalho'],
    0
  ),
  (
    'Pessoal',
    'Contatos da sua rede pessoal',
    ARRAY['nome','whatsapp'],
    ARRAY['Ana Costa','5548988888888'],
    1
  ),
  (
    'Evento',
    'Participantes de eventos',
    ARRAY['nome','whatsapp','nome_evento'],
    ARRAY['Pedro Lima','5548977777777','Workshop Imóveis 2025'],
    2
  ),
  (
    'Network',
    'Conexões profissionais',
    ARRAY['nome','whatsapp'],
    ARRAY['Maria Souza','5548966666666'],
    3
  )
ON CONFLICT (name) DO NOTHING;

COMMIT;
