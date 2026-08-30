-- Alterações na tabela messages
-- 1. Remover colunas desnecessárias
ALTER TABLE public.messages DROP COLUMN IF EXISTS audio_url;
ALTER TABLE public.messages DROP COLUMN IF EXISTS audio_duration;
ALTER TABLE public.messages DROP COLUMN IF EXISTS transcription;
ALTER TABLE public.messages DROP COLUMN IF EXISTS tokens_qty;
ALTER TABLE public.messages DROP COLUMN IF EXISTS llm;
ALTER TABLE public.messages DROP COLUMN IF EXISTS metadata;

-- 2. Adicionar nova coluna whatsapp_template_id
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS whatsapp_template_id text;

-- 3. Adicionar coluna status (antes de atualizar from_contact)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS status text DEFAULT 'enviada';

-- 4. Atualizar valores existentes de from_contact para corresponder ao novo enum
-- Mapear valores antigos para novos valores válidos
UPDATE public.messages 
SET from_contact = CASE 
  WHEN from_contact IN ('agente_ia', 'ia', 'bot', 'ai') THEN 'agente_ia'
  WHEN from_contact IN ('humano', 'human', 'user', 'usuario', 'vendedor') THEN 'humano'
  ELSE 'cliente'
END
WHERE from_contact NOT IN ('cliente', 'agente_ia', 'humano');

-- 5. Agora adicionar constraints com enum
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_from_contact_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_from_contact_check 
  CHECK (from_contact = ANY (ARRAY['cliente'::text, 'agente_ia'::text, 'humano'::text]));

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_status_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_status_check 
  CHECK (status = ANY (ARRAY['pendente'::text, 'enviada'::text, 'entregue'::text, 'lida'::text, 'erro'::text]));

-- 6. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_messages_status ON public.messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_from_contact ON public.messages(from_contact);
CREATE INDEX IF NOT EXISTS idx_messages_whatsapp_template ON public.messages(whatsapp_template_id);

-- 7. Atualizar RLS policies
DROP POLICY IF EXISTS "messages_access_policy" ON public.messages;

-- Policy para SELECT: Super admin e gestores veem tudo, usuários comuns apenas seus leads
CREATE POLICY "messages_select_policy" ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM settings_users su
      WHERE su.auth_user_id = auth.uid()
      AND (su.super_adm = true OR su.gestor = true)
    )
    OR
    EXISTS (
      SELECT 1 FROM leads l
      INNER JOIN settings_users su ON su.id = l.users_id
      WHERE l.id = messages.leads_id
      AND su.auth_user_id = auth.uid()
    )
  );

-- Policy para INSERT: Super admin e gestores podem inserir qualquer, usuários comuns apenas em seus leads
CREATE POLICY "messages_insert_policy" ON public.messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM settings_users su
      WHERE su.auth_user_id = auth.uid()
      AND (su.super_adm = true OR su.gestor = true)
    )
    OR
    EXISTS (
      SELECT 1 FROM leads l
      INNER JOIN settings_users su ON su.id = l.users_id
      WHERE l.id = messages.leads_id
      AND su.auth_user_id = auth.uid()
    )
  );

-- Policy para UPDATE: Super admin e gestores podem atualizar qualquer, usuários comuns apenas seus leads
CREATE POLICY "messages_update_policy" ON public.messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM settings_users su
      WHERE su.auth_user_id = auth.uid()
      AND (su.super_adm = true OR su.gestor = true)
    )
    OR
    EXISTS (
      SELECT 1 FROM leads l
      INNER JOIN settings_users su ON su.id = l.users_id
      WHERE l.id = messages.leads_id
      AND su.auth_user_id = auth.uid()
    )
  );

-- 8. Habilitar Realtime para a tabela messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;