-- Fase 3: carrinhos de 3 a 10 dias que passaram pela recuperação da Reportana (2 dias)
-- e ainda não entraram na nossa esteira. 18 pessoas aprovadas pelo usuário em 25/09.
-- Mesmo fluxo da Fase 2: lead novo na Esteira Validação (tag "Fase 3"), sequência v2
-- agendada a partir de agora, e só estes números liberados no WhatsApp.
INSERT INTO public.lead_tags (name, color) SELECT 'Fase 3', '#8B5CF6'
 WHERE NOT EXISTS (SELECT 1 FROM public.lead_tags WHERE name = 'Fase 3');

CREATE TABLE IF NOT EXISTS public._fase3_leads (loja_lead_id uuid, lead_id uuid, people_id uuid);
ALTER TABLE public._fase3_leads ENABLE ROW LEVEL SECURITY;

-- candidatos: rechecagem no momento do go (ainda sem esteira, sem toque, sem compra)
CREATE TEMP TABLE _f3c AS
SELECT DISTINCT ON (l.people_id) l.id loja_lead_id, l.people_id, l.title, l.value, l.sku_id, l.created_at, l.lead_source
  FROM public.leads l
  JOIN public.leads_stages s ON s.id = l.leads_stages_id
  JOIN public.leads_pipelines p ON p.id = l.leads_pipelines_id
 WHERE p.name = 'Esteira Minimal — Loja' AND s.name = 'Carrinho abandonado' AND l.status = 'in_progress'
   AND l.people_id IN ('0f40568f-9f2c-44d1-836b-570d2ebe4796','10c38d23-c479-4721-a765-653ee3cff5ef','13b7ee89-6c72-4a15-830d-2f947bc762b9','1f23fe1c-5757-465f-893d-f0095b59993e','2bf27755-cd63-435f-853a-d2696f13fd5c','307d6e42-2504-48ca-9eaf-477e21faa144','3699f1e9-506b-43f8-9c36-7df40b769ba6','6f589834-9e71-47e4-95a5-d5cbc6575116','78726b40-616d-4e9a-bc25-618179b056fb','7a0f0e39-4876-493b-b7ab-7754e6fe3d49','835261f2-3e3e-4c43-ac62-9267e1c031c6','8553abae-fae0-428f-a3ec-3b093e60f0ef','97e9f81f-b58f-42c8-9bc9-6da097c5629b','99c556f2-9087-4cca-9d31-9c796da75695','b5a16258-c71d-4ba3-949a-1bb8b295fecb','f74f88b1-2d46-488e-a04f-4954e0a74989','f7789fcf-902b-40da-8c8a-cd42f39ea9e6','f94b1bfe-5133-47e0-9b54-003ff817be4c')
   AND NOT EXISTS (SELECT 1 FROM public.leads v JOIN public.leads_pipelines vp ON vp.id = v.leads_pipelines_id
                    WHERE v.people_id = l.people_id AND vp.name = 'Esteira Validação')
   AND NOT EXISTS (SELECT 1 FROM public.followup_queue q WHERE q.person_id = l.people_id AND q.status IN ('queued','sent','pending','held'))
   AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.people_id = l.people_id AND o.is_paid AND o.paid_at > l.created_at - interval '1 day')
 ORDER BY l.people_id, l.created_at DESC;

ALTER TABLE public.leads DISABLE TRIGGER on_lead_stage_changed;
ALTER TABLE public.leads DISABLE TRIGGER leads_stage_duplication_trigger;
ALTER TABLE public.leads DISABLE TRIGGER trigger_dispatch_new_lead_webhooks;
ALTER TABLE public.leads DISABLE TRIGGER trg_disable_ai_on_atendimento_humano;
WITH ins AS (
  INSERT INTO public.leads (title, people_id, leads_pipelines_id, leads_stages_id, status, lead_source, value, sku_id, created_at)
  SELECT c.title, c.people_id, (SELECT id FROM public.leads_pipelines WHERE name = 'Esteira Validação'),
         '3a5eb8c6-8707-4cb5-bac0-3e3d646c6ec0', 'in_progress', coalesce(c.lead_source, 'yampi'), c.value, c.sku_id, c.created_at
    FROM _f3c c
  RETURNING id, people_id)
INSERT INTO public._fase3_leads (loja_lead_id, lead_id, people_id)
SELECT c.loja_lead_id, ins.id, ins.people_id FROM ins JOIN _f3c c ON c.people_id = ins.people_id;
ALTER TABLE public.leads ENABLE TRIGGER on_lead_stage_changed;
ALTER TABLE public.leads ENABLE TRIGGER leads_stage_duplication_trigger;
ALTER TABLE public.leads ENABLE TRIGGER trigger_dispatch_new_lead_webhooks;
ALTER TABLE public.leads ENABLE TRIGGER trg_disable_ai_on_atendimento_humano;

INSERT INTO public.leads_tags (lead_id, tag_id)
SELECT f.lead_id, (SELECT id FROM public.lead_tags WHERE name = 'Fase 3') FROM public._fase3_leads f
ON CONFLICT DO NOTHING;

-- mesmos toques da Fase 2 (W1, E1–E6, W2), horários a partir de agora; o worker espaça os WhatsApp
INSERT INTO public.followup_queue (followup_id, lead_id, person_id, channel, template_id, message, subject, source_type, scheduled_for, status)
SELECT r.id, f.lead_id, f.people_id, r.type, r.template_id, r.message, r.subject, 'stage',
       now() + make_interval(days => coalesce(r.days,0), hours => coalesce(r.hours,0), mins => coalesce(r.minutes,0)), 'pending'
  FROM public._fase3_leads f
 CROSS JOIN public.leads_stages_followups r
 WHERE r.leads_stages_id = '3a5eb8c6-8707-4cb5-bac0-3e3d646c6ec0' AND r.trigger_on = 'stage'
   AND (r.subject LIKE 'Esteira v2 ·%[Validação]' OR r.id IN (
        'eebdb9fd-86f0-44b8-b02f-bb98def4c0ba','37543c07-898e-4ad4-916b-5f97ac8562ed',
        'c816a580-651e-4934-a75d-46fa13f732e3','a45ec099-1e80-4d58-a720-edfc385276a2'))
   AND NOT EXISTS (SELECT 1 FROM public.followup_queue q WHERE q.lead_id = f.lead_id AND q.followup_id = r.id);

-- libera só estes números (com 55) no WhatsApp
UPDATE public.omni_channel_configs c
   SET settings = c.settings || jsonb_build_object('test_allowlist', (
         SELECT jsonb_agg(DISTINCT x) FROM (
           SELECT jsonb_array_elements_text(coalesce(c.settings->'test_allowlist', '[]'::jsonb)) x
           UNION
           SELECT CASE WHEN length(d) IN (10,11) THEN '55' || d ELSE d END
             FROM (SELECT regexp_replace(p.whatsapp, '\D', '', 'g') d FROM public._fase3_leads f
                     JOIN public.clients_people p ON p.id = f.people_id WHERE p.whatsapp IS NOT NULL) n) u))
 WHERE c.channel = 'whatsapp';

SELECT (SELECT count(*) FROM public._fase3_leads) leads,
       (SELECT count(*) FROM public.followup_queue WHERE lead_id IN (SELECT lead_id FROM public._fase3_leads)) toques,
       (SELECT jsonb_array_length(settings->'test_allowlist') FROM public.omni_channel_configs WHERE channel = 'whatsapp') allowlist;
