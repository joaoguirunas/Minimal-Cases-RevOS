-- E2-TITULO — "Celular voando na praia. E a gente rindo." → opção A. Idempotente: só roda enquanto o subject antigo existir.
-- Opção B: subject '{{nome}}, para de segurar o celular com medo.' · h1 'Para de segurar o celular com medo. <span style="color:#9b9b9b;">Ele está protegido.</span>' · name 'Esteira · E2 — Sem medo'
-- Opção C: subject '2 metros de queda. Zero drama, {{nome}}.' · h1 '2 metros de queda. <span style="color:#9b9b9b;">Zero drama.</span>' · name 'Esteira · E2 — 2 metros de queda'
BEGIN;
UPDATE public.email_templates
   SET name = 'Esteira · E2 — Pode derrubar',
       subject = 'Pode derrubar, {{nome}}.',
       html_body = replace(replace(html_body,
         '<title>Celular voando na praia. E a gente rindo.</title>',
         '<title>Pode derrubar. A gente aguenta o tombo.</title>'),
         'Celular voando na praia. <span style="color:#9b9b9b;">E ninguém prendendo a respiração.</span>',
         'Pode derrubar. <span style="color:#9b9b9b;">A gente aguenta o tombo.</span>'),
       updated_at = now()
 WHERE id = '52e679cf-375e-4f6b-98d4-79311abe6702'
   AND subject = 'Celular voando na praia. E a gente rindo.';
COMMIT;
