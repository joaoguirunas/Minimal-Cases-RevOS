-- Cache da foto real do produto/SKU pros e-mails da esteira.
-- O webhook de carrinho da Yampi não traz imagem; buscamos no catálogo uma vez
-- por SKU e guardamos aqui (só service_role lê/escreve — edge functions).
CREATE TABLE IF NOT EXISTS public.yampi_sku_images (
  sku_id      bigint PRIMARY KEY,
  product_id  bigint,
  url         text,
  fetched_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.yampi_sku_images IS 'Foto do SKU (cor exata) vinda de GET /catalog/products/{id}?include=images,skus.images. url NULL = produto sem imagem (evita rebuscar por 7 dias).';
ALTER TABLE public.yampi_sku_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS yampi_sku_images_service_role ON public.yampi_sku_images;
CREATE POLICY yampi_sku_images_service_role ON public.yampi_sku_images
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
