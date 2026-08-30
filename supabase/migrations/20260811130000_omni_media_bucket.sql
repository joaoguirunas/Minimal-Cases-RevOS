-- Bucket `omni-media` (uploadToOmniMedia em whatsapp-inbound, uploadEvolutionMedia
-- em evolution-webhook) referenciado pelo código há tempo mas NUNCA existiu de fato
-- (storage.buckets tinha 0 linhas) — mídia recebida (Meta e Evolution) vinha
-- silenciosamente falhando o upload (try/catch non-fatal, só loga erro) e caindo
-- pro placeholder de texto. Criado aqui, público (getPublicUrl é usado — precisa
-- ser público pra `<img src>` funcionar sem assinatura).

BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('omni-media', 'omni-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "omni_media_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'omni-media');

-- smoke test
SELECT
  (SELECT count(*) FROM storage.buckets WHERE id = 'omni-media' AND public = true) AS bucket_ok,
  (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='omni_media_public_read') AS policy_ok;

COMMIT;
