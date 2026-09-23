-- Etapa "Influenciado": comprou até 7 dias depois de um toque nosso, sem prova
-- (sem cupom nosso, sem clique rastreado, sem comercial). Fica entre
-- "Recuperado" e "Comprou sozinho" nos pipelines de esteira.
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT id FROM public.leads_pipelines WHERE name IN ('Esteira Minimal — Loja', 'Esteira Validação') LOOP
    IF NOT EXISTS (SELECT 1 FROM public.leads_stages WHERE leads_pipelines_id = p.id AND name = 'Influenciado') THEN
      UPDATE public.leads_stages SET order_index = order_index + 1
       WHERE leads_pipelines_id = p.id
         AND order_index > (SELECT order_index FROM public.leads_stages WHERE leads_pipelines_id = p.id AND name = 'Recuperado');
      INSERT INTO public.leads_stages (name, leads_pipelines_id, order_index, color, active)
      SELECT 'Influenciado', p.id, order_index + 1, '#F59E0B', true
        FROM public.leads_stages WHERE leads_pipelines_id = p.id AND name = 'Recuperado';
    END IF;
  END LOOP;
END $$;

-- Etapa final de quem pagou, a partir da atribuição do pedido (fonte única).
CREATE OR REPLACE FUNCTION public.stage_for_paid_class(p_class text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_class WHEN 'recuperado' THEN 'Recuperado' WHEN 'influenciado' THEN 'Influenciado' ELSE 'Comprou sozinho' END $$;

-- Reclassifica quem já pagou: lead ganho (ou arquivado da Fase 1) cujo pedido
-- pago após o lead foi influenciado/recuperado vai para a etapa certa.
CREATE TEMP TABLE _alvo ON COMMIT DROP AS
SELECT DISTINCT ON (l.id) l.id lead_id, l.leads_pipelines_id, a.class, a.paid_at
  FROM public.leads l
  JOIN public.leads_pipelines pl ON pl.id = l.leads_pipelines_id AND pl.name IN ('Esteira Minimal — Loja', 'Esteira Validação')
  JOIN public.order_attribution a ON a.people_id = l.people_id AND a.paid_at >= l.created_at
 WHERE l.status IN ('won', 'archived')
 ORDER BY l.id, CASE a.class WHEN 'recuperado' THEN 0 WHEN 'influenciado' THEN 1 ELSE 2 END, a.paid_at;

ALTER TABLE public.leads DISABLE TRIGGER on_lead_stage_changed;
ALTER TABLE public.leads DISABLE TRIGGER trg_conversion_stage_enter;
ALTER TABLE public.leads DISABLE TRIGGER trg_conversion_lead_won;
UPDATE public.leads l
   SET leads_stages_id = s.id, status = 'won', won_at = coalesce(l.won_at, t.paid_at)
  FROM _alvo t JOIN public.leads_stages s ON s.leads_pipelines_id = t.leads_pipelines_id AND s.name = public.stage_for_paid_class(t.class)
 WHERE l.id = t.lead_id AND t.class IN ('recuperado', 'influenciado') AND l.leads_stages_id IS DISTINCT FROM s.id;
ALTER TABLE public.leads ENABLE TRIGGER on_lead_stage_changed;
ALTER TABLE public.leads ENABLE TRIGGER trg_conversion_stage_enter;
ALTER TABLE public.leads ENABLE TRIGGER trg_conversion_lead_won;
