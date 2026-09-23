-- Fase 2: 243 carrinhos de 15 a 21/09 entram na Esteira Validação.
-- Lead novo por pessoa (como na Fase 1), data do carrinho preservada.
-- Gatilhos de etapa DESLIGADOS na transação: nada é enfileirado sozinho — os
-- toques entram como 'held' logo abaixo e só viram 'pending' no go.
ALTER TABLE public.leads DISABLE TRIGGER on_lead_stage_changed;
ALTER TABLE public.leads DISABLE TRIGGER leads_stage_duplication_trigger;
ALTER TABLE public.leads DISABLE TRIGGER trigger_dispatch_new_lead_webhooks;
ALTER TABLE public.leads DISABLE TRIGGER trg_disable_ai_on_atendimento_humano;

CREATE TABLE IF NOT EXISTS public._fase2_leads (loja_lead_id uuid, lead_id uuid, people_id uuid);
ALTER TABLE public._fase2_leads ENABLE ROW LEVEL SECURITY;

WITH ins AS (
  INSERT INTO public.leads (title, people_id, leads_pipelines_id, leads_stages_id, status, lead_source, value, sku_id, created_at)
  SELECT c.title, c.people_id,
         (SELECT id FROM public.leads_pipelines WHERE name = 'Esteira Validação'),
         '3a5eb8c6-8707-4cb5-bac0-3e3d646c6ec0', 'in_progress', coalesce(c.lead_source, 'yampi'), c.value, c.sku_id, c.created_at
  FROM public._fase2_candidatos c
  WHERE NOT EXISTS (SELECT 1 FROM public._fase2_leads f WHERE f.people_id = c.people_id)
  RETURNING id, people_id
)
INSERT INTO public._fase2_leads (loja_lead_id, lead_id, people_id)
SELECT c.loja_lead_id, ins.id, ins.people_id FROM ins JOIN public._fase2_candidatos c ON c.people_id = ins.people_id;

ALTER TABLE public.leads ENABLE TRIGGER on_lead_stage_changed;
ALTER TABLE public.leads ENABLE TRIGGER leads_stage_duplication_trigger;
ALTER TABLE public.leads ENABLE TRIGGER trigger_dispatch_new_lead_webhooks;
ALTER TABLE public.leads ENABLE TRIGGER trg_disable_ai_on_atendimento_humano;

-- Tags: Fase 1 = quem já estava na Validação; Fase 2 = o lote novo.
INSERT INTO public.leads_tags (lead_id, tag_id)
SELECT l.id, (SELECT id FROM public.lead_tags WHERE name = 'Fase 1')
FROM public.leads l
WHERE l.leads_pipelines_id = (SELECT id FROM public.leads_pipelines WHERE name = 'Esteira Validação')
  AND l.id NOT IN (SELECT lead_id FROM public._fase2_leads)
ON CONFLICT DO NOTHING;
INSERT INTO public.leads_tags (lead_id, tag_id)
SELECT f.lead_id, (SELECT id FROM public.lead_tags WHERE name = 'Fase 2') FROM public._fase2_leads f
ON CONFLICT DO NOTHING;

-- Toques retidos: E1, E2, E3, E6 (iguais) + W1, E4 v2, W2, E5 v2 da Validação.
-- scheduled_for aqui é provisório; no go é recalculado a partir do momento do go.
INSERT INTO public.followup_queue (followup_id, lead_id, person_id, channel, template_id, message, subject, source_type, scheduled_for, status)
SELECT r.id, f.lead_id, f.people_id, r.type, r.template_id, r.message, r.subject, 'stage',
       now() + make_interval(days => coalesce(r.days,0), hours => coalesce(r.hours,0), mins => coalesce(r.minutes,0)),
       'held'
FROM public._fase2_leads f
CROSS JOIN public.leads_stages_followups r
WHERE r.leads_stages_id = '3a5eb8c6-8707-4cb5-bac0-3e3d646c6ec0'
  AND r.trigger_on = 'stage'
  AND (r.subject LIKE 'Esteira v2 ·%[Validação]' OR r.id IN (
        'eebdb9fd-86f0-44b8-b02f-bb98def4c0ba',  -- E1
        '37543c07-898e-4ad4-916b-5f97ac8562ed',  -- E2
        'c816a580-651e-4934-a75d-46fa13f732e3',  -- E3
        'a45ec099-1e80-4d58-a720-edfc385276a2')) -- E6
  AND NOT EXISTS (SELECT 1 FROM public.followup_queue q WHERE q.lead_id = f.lead_id AND q.followup_id = r.id);
