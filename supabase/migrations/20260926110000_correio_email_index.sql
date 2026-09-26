-- Busca de pessoa por e-mail normalizado (supressão, descadastro, importação do Klaviyo).
CREATE INDEX IF NOT EXISTS idx_clients_people_email_norm ON public.clients_people (public.email_norm(email));
