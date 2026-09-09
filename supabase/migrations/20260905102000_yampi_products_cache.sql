-- AGENTE-PRODUTO — o agente conhece o produto do carrinho.
BEGIN;
CREATE TABLE IF NOT EXISTS public.yampi_products_cache (
  product_id bigint PRIMARY KEY,
  summary    jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.yampi_products_cache IS 'Resumo do produto (GET /catalog/products/{id}?include=texts,brand,categories,skus,images) pro agente. TTL 24h em resolveProductSummary().';
ALTER TABLE public.yampi_products_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS yampi_products_cache_service_role ON public.yampi_products_cache;
CREATE POLICY yampi_products_cache_service_role ON public.yampi_products_cache
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

UPDATE public.ai_agents
   SET general_rules = COALESCE(general_rules, '') || E'\n- PRODUTO: o CONTEXTO traz um bloco "Produto do carrinho" (material, cores e modelos disponíveis, faixa de preço, estoque). Use-o pra responder "é de couro?", "tem em preto?", "serve no 17 Pro?" antes de perguntar. Pra detalhe que não está lá (medidas, o que vem na caixa, garantia), chame consultar_produto. NUNCA invente especificação, cor ou modelo.',
       enabled_tools = CASE WHEN 'consultar_produto' = ANY (COALESCE(enabled_tools, '{}')) THEN enabled_tools ELSE array_append(COALESCE(enabled_tools, '{}'), 'consultar_produto') END,
       updated_at = now()
 WHERE name = 'Minimal · Recuperação WhatsApp'
   AND COALESCE(general_rules, '') NOT LIKE '%PRODUTO:%';
COMMIT;
