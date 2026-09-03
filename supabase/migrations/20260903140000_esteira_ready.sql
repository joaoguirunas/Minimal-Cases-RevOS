-- EST-READY — Esteira pronta pra rodar conforme a proposta (03/09/2026).
--
--  • leads_stages_followups.vars: vars estáticas por regra ({cupom}, {cupom_pct}, {expira_horas})
--  • settings_business_hours: 09h–20h todos os dias, sem cancelar toques "held" (bh_only_last=false)
--  • templates PIX-E1 / PIX-E2 (esteira Pix gerado e não pago)
--  • 14 regras de follow-up: Carrinho abandonado (E1–E6, SMS-01/02, WA-01/02/03 inativos
--    até ter canal WhatsApp + template aprovado) e Pagamento pendente (PIX-SMS-01,
--    PIX-E1, PIX-E2, PIX-WA-01/03 inativos)
--  • enqueue_stage_followups(): disparo em massa pros leads JÁ parados num stage
--    (a fila só é alimentada na troca de stage; os 297 do backfill precisam disso)

BEGIN;

ALTER TABLE public.leads_stages_followups
  ADD COLUMN IF NOT EXISTS vars jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.leads_stages_followups.vars IS
  'Vars estáticas injetadas no render do e-mail/SMS desta regra (ex.: {"cupom":"VOLTA10","cupom_pct":"10","expira_horas":"24"}).';

INSERT INTO public.settings_business_hours (enabled, start_hour, end_hour, days_of_week, timezone, bh_only_last)
SELECT true, 9, 20, ARRAY[0,1,2,3,4,5,6], 'America/Sao_Paulo', false
WHERE NOT EXISTS (SELECT 1 FROM public.settings_business_hours);

INSERT INTO public.email_templates (name, subject, html_body, active)
SELECT 'Esteira · PIX-E1 — Seu Pix vence em pouco tempo', 'Seu Pix vence em pouco tempo, {{nome}}', $tpl$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Seu Pix vence em pouco tempo</title>
<style>body{margin:0;padding:0;background:#000}img{border:0;display:block}@media only screen and (max-width:620px){.w{width:100%!important}.p{padding-left:20px!important;padding-right:20px!important}.h1{font-size:34px!important;line-height:38px!important}}</style>
</head><body style="margin:0;padding:0;background:#000000;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#000;">o pedido segue reservado — só falta o Pix cair &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#000000;"><tr><td align="center" style="padding:24px 0;">
<table role="presentation" class="w" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;background:#000000;">
  <tr><td class="p" style="padding:40px 48px 0 48px;">
    <img src="{{asset_base}}/logo-white.png" width="49" height="56" alt="Minimal Cases" style="width:49px;height:56px;">
    <div style="font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:4px;color:#fff;font-weight:700;margin-top:6px;">MINIMAL CASES</div>
  </td></tr>
  <tr><td class="p" style="padding:22px 48px 0 48px;"><div style="height:1px;background:#ffffff;"></div></td></tr>
  <tr><td class="p" style="padding:44px 48px 0 48px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">
    <div class="h1" style="font-size:46px;line-height:50px;letter-spacing:-1.5px;color:#ffffff;">
      Seu Pix está esperando. <span style="color:#8a8a8a;">O pedido está reservado. Falta só o pagamento cair.</span> <span style="color:#555;">Quando o Pix vence, o pedido some.</span>
    </div>
  </td></tr>
  <tr><td style="padding:40px 0 0 0;">
    <img src="{{asset_base}}/e4-caixa-pov.jpg" width="600" alt="Abrindo a caixa" style="width:100%;max-width:600px;height:auto;">
  </td></tr>
  <!-- STATUS TRACKER -->
  <tr><td class="p" style="padding:36px 48px 0 48px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:12px;text-align:center;">
      <tr>
        <td width="25%" style="padding:0 4px;"><div style="height:4px;background:#ffffff;"></div><div style="color:#fff;margin-top:10px;">Case escolhida</div></td>
        <td width="25%" style="padding:0 4px;"><div style="height:4px;background:#ffffff;"></div><div style="color:#fff;margin-top:10px;">Frete grátis aplicado</div></td>
        <td width="25%" style="padding:0 4px;"><div style="height:4px;background:#e8632b;"></div><div style="color:#e8632b;margin-top:10px;font-weight:700;">Pagamento ←</div></td>
        <td width="25%" style="padding:0 4px;"><div style="height:4px;background:#333;"></div><div style="color:#666;margin-top:10px;">Na sua casa</div></td>
      </tr>
    </table>
  </td></tr>
  <tr><td class="p" style="padding:40px 48px 0 48px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">
    <div style="font-size:24px;line-height:31px;letter-spacing:-0.5px;color:#ffffff;">
      Essa cara aí de cima? <span style="color:#8a8a8a;">É a cara de quem abriu a caixa. Você gerou o Pix da sua <strong style="color:#fff;">{{produto}}</strong> e ele ainda não caiu.</span> Quando vencer, o pedido é cancelado sozinho. <span style="color:#8a8a8a;">Sem drama, é só o jeito que o banco funciona — mas dá pra resolver em 10 segundos.</span>
    </div>
  </td></tr>
  <!-- CUPOM -->
  <tr><td class="p" style="padding:32px 48px 0 48px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px dashed #555;">
      <tr><td align="center" style="padding:24px;font-family:Courier New,Courier,monospace;">
        <div style="font-size:11px;letter-spacing:3px;color:#8a8a8a;">STATUS DO PIX</div>
        <div style="font-size:28px;letter-spacing:4px;color:#ffffff;font-weight:700;margin-top:8px;">AGUARDANDO</div>
        <div style="font-size:12px;color:#8a8a8a;margin-top:8px;">assim que cair, o rastreio chega no seu WhatsApp</div>
      </td></tr>
    </table>
  </td></tr>
  <!-- COUNTDOWN -->
  <tr><td class="p" style="padding:28px 48px 0 48px;"><div style="height:1px;background:#333;"></div></td></tr>
  <tr><td align="center" style="padding:24px 48px 0 48px;font-family:Courier New,Courier,monospace;font-size:13px;letter-spacing:1px;color:#ffffff;">EXPIRA EM</td></tr>
  <tr><td align="center" style="padding:16px 48px 0 48px;">
    <!-- Substituir pelo bloco de countdown da ferramenta (Klaviyo Countdown / MailTimers GIF) apontando para {{expira_em}} -->
    <img src="{{countdown_gif}}" width="400" alt="Contagem regressiva" style="width:400px;max-width:100%;height:auto;">
  </td></tr>
  <tr><td class="p" style="padding:24px 48px 0 48px;"><div style="height:1px;background:#333;"></div></td></tr>
  <tr><td align="center" style="padding:36px 48px 0 48px;">
    <a href="{{link_checkout}}?utm_source=crm&utm_medium=email&utm_campaign=pix-pendente&utm_content=pix-e1" style="display:inline-block;background:#ffffff;color:#000000;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:0.5px;text-decoration:none;padding:20px 44px;border-radius:40px;">PAGAR AGORA</a>
    <div style="font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:12px;color:#8a8a8a;margin-top:14px;">{{total}} · Pix ou cartão em até 3x · frete grátis</div>
  </td></tr>
  <tr><td class="p" style="padding:44px 48px 48px 48px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#fff;">
    <strong>{{remetente}}</strong><br><span style="color:#8a8a8a;">Minimal Cases™</span>
  </td></tr>
</table>
<table role="presentation" class="w" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;"><tr><td style="padding:20px 48px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:11px;line-height:16px;color:#8a8a8a;text-align:center;">
Minimal Cases · minimalcases.com.br · <a href="{{unsubscribe}}" style="color:#8a8a8a;">Cancelar inscrição</a>
</td></tr></table>
</td></tr></table>
</body></html>
$tpl$, true
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE name LIKE 'Esteira · PIX-E1%');

INSERT INTO public.email_templates (name, subject, html_body, active)
SELECT 'Esteira · PIX-E2 — Ficou pra depois?', 'Ficou pra depois, {{nome}}?', $tpl$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ficou pra depois?</title>
<style>body{margin:0;padding:0;background:#000}img{border:0;display:block}@media only screen and (max-width:620px){.w{width:100%!important}.p{padding-left:20px!important;padding-right:20px!important}.h1{font-size:34px!important;line-height:38px!important}}</style>
</head><body style="margin:0;padding:0;background:#000000;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#000;">deixei um checkout novo pronto, com cartão em até 3x &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#000000;"><tr><td align="center" style="padding:24px 0;">
<table role="presentation" class="w" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;background:#000000;">
  <tr><td class="p" style="padding:40px 48px 0 48px;">
    <img src="{{asset_base}}/logo-white.png" width="49" height="56" alt="Minimal Cases" style="width:49px;height:56px;">
    <div style="font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:4px;color:#fff;font-weight:700;margin-top:6px;">MINIMAL CASES</div>
  </td></tr>
  <tr><td class="p" style="padding:22px 48px 0 48px;"><div style="height:1px;background:#ffffff;"></div></td></tr>
  <tr><td class="p" style="padding:44px 48px 0 48px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">
    <div class="h1" style="font-size:42px;line-height:46px;letter-spacing:-1.5px;color:#ffffff;">
      Ficou pra depois? <span style="color:#8a8a8a;">Acontece. Deixei um checkout novo pronto pra você.</span>
    </div>
  </td></tr>
  <tr><td style="padding:36px 0 0 0;">
    <img src="{{asset_base}}/lo-jaqueta.jpg" width="600" alt="" style="width:100%;max-width:600px;height:auto;">
  </td></tr>
  <tr><td class="p" style="padding:40px 48px 0 48px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:17px;line-height:27px;color:#ffffff;">
    {{nome}}, tudo bem.<br><br>
    Seu Pix da <strong>{{produto}}</strong> venceu e o pedido foi cancelado automaticamente. Nada perdido: montei o carrinho de novo, com tudo do jeito que você deixou.<br><br>
    <strong>1. Prefere cartão?</strong><br>
    <span style="color:#8a8a8a;">Em até 3x sem juros. Aprova na hora e o pedido já entra na fila de postagem.</span><br><br>
    <strong>2. Prefere Pix?</strong><br>
    <span style="color:#8a8a8a;">Gera um novo em 10 segundos e cai na hora. Sem precisar refazer nada.</span><br><br>
    <strong>3. Só esqueceu?</strong><br>
    <span style="color:#8a8a8a;">Acontece com os melhores. Por isso esse e-mail.</span><br><br>
    O frete grátis com rastreio segue aplicado:<br>
    <a href="{{link_checkout}}?utm_source=crm&utm_medium=email&utm_campaign=pix-pendente&utm_content=pix-e2" style="color:#5b8def;text-decoration:underline;">Finalizar meu pedido →</a><br><br>
    Se travou em alguma coisa, responde este e-mail. Eu leio.<br><br>
    Até mais.
  </td></tr>
  <tr><td class="p" style="padding:44px 48px 48px 48px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
      <td style="font-family:Helvetica Neue,Helvetica,Arial,sans-serif;color:#fff;vertical-align:bottom;"><div style="font-size:22px;font-weight:700;letter-spacing:-0.5px;">{{remetente}}</div><div style="font-size:12px;color:#8a8a8a;">{{cargo}}</div><div style="font-size:11px;color:#fff;margin-top:14px;font-weight:700;">MINIMAL CASES™</div></td>
      <td align="right" style="vertical-align:bottom;"><img src="{{asset_base}}/logo-white.png" width="63" height="72" alt="" style="width:63px;height:72px;"></td>
    </tr></table>
  </td></tr>
</table>
<table role="presentation" class="w" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;"><tr><td style="padding:20px 48px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:11px;line-height:16px;color:#8a8a8a;text-align:center;">
Minimal Cases · minimalcases.com.br · <a href="{{unsubscribe}}" style="color:#8a8a8a;">Cancelar inscrição</a>
</td></tr></table>
</td></tr></table>
</body></html>
$tpl$, true
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE name LIKE 'Esteira · PIX-E2%');

DO $$
DECLARE
  v_pipeline uuid; v_carrinho uuid; v_pendente uuid;
  t_e1 uuid; t_e2 uuid; t_e3 uuid; t_e4 uuid; t_e5 uuid; t_e6 uuid; t_p1 uuid; t_p2 uuid;
BEGIN
  SELECT id INTO v_pipeline FROM public.leads_pipelines WHERE name = 'Esteira Minimal — Loja' LIMIT 1;
  IF v_pipeline IS NULL THEN RETURN; END IF;
  SELECT id INTO v_carrinho FROM public.leads_stages WHERE leads_pipelines_id = v_pipeline AND name = 'Carrinho abandonado';
  SELECT id INTO v_pendente FROM public.leads_stages WHERE leads_pipelines_id = v_pipeline AND name = 'Pagamento pendente';
  SELECT id INTO t_e1 FROM public.email_templates WHERE name LIKE 'Esteira · E1 %' LIMIT 1;
  SELECT id INTO t_e2 FROM public.email_templates WHERE name LIKE 'Esteira · E2 %' LIMIT 1;
  SELECT id INTO t_e3 FROM public.email_templates WHERE name LIKE 'Esteira · E3 %' LIMIT 1;
  SELECT id INTO t_e4 FROM public.email_templates WHERE name LIKE 'Esteira · E4 %' LIMIT 1;
  SELECT id INTO t_e5 FROM public.email_templates WHERE name LIKE 'Esteira · E5 %' LIMIT 1;
  SELECT id INTO t_e6 FROM public.email_templates WHERE name LIKE 'Esteira · E6 %' LIMIT 1;
  SELECT id INTO t_p1 FROM public.email_templates WHERE name LIKE 'Esteira · PIX-E1%' LIMIT 1;
  SELECT id INTO t_p2 FROM public.email_templates WHERE name LIKE 'Esteira · PIX-E2%' LIMIT 1;

  -- Idempotente: só semeia se o stage ainda não tem regras.
  IF v_carrinho IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.leads_stages_followups WHERE leads_stages_id = v_carrinho) THEN
    INSERT INTO public.leads_stages_followups (leads_stages_id, type, subject, email_template_id, message, days, hours, minutes, business_hours_only, bh_only_last, active, vars) VALUES
      (v_carrinho, 'whatsapp_template', 'WA-01 · Dúvida do modelo?', NULL, $m$Oi {{nome}}, aqui é o {{remetente}} da Minimal Cases 👋

Vi que você deixou a *{{produto}}* separada aí no carrinho.

Só passando pra confirmar uma coisa: ela é pro seu *{{modelo_celular}}* mesmo? Se tiver qualquer dúvida de encaixe, MagSafe ou material, me responde aqui que eu te ajudo em 2 min.

Se já estiver tudo certo, é só voltar de onde parou (frete grátis com rastreio já aplicado 😉):
{{link_checkout}}$m$, 0, 0, 30, true, false, false, '{}'),
      (v_carrinho, 'email', 'E1 · Faltou isso aqui', t_e1, '', 0, 1, 0, true, false, true, '{}'),
      (v_carrinho, 'sms', 'SMS-01 · Link direto', NULL, '{{nome}}, sua case Minimal ficou no carrinho. Frete gratis + rastreio garantidos: {{link_checkout}} Sair: responda SAIR', 0, 3, 0, true, false, true, '{}'),
      (v_carrinho, 'email', 'E2 · Celular voando na praia', t_e2, '', 1, 0, 0, true, false, true, '{}'),
      (v_carrinho, 'email', 'E3 · Eu ia te mandar um WhatsApp', t_e3, '', 2, 0, 0, true, false, true, '{}'),
      (v_carrinho, 'whatsapp_template', 'WA-02 · Segurei sua case', NULL, $m${{nome}}, segurei sua {{produto}} no carrinho até amanhã 🫡

Depois disso o sistema libera pra outra pessoa e eu não consigo garantir a cor.

Se quiser fechar, é só continuar de onde parou:
{{link_checkout}}

Frete grátis + rastreio já está aplicado.$m$, 2, 0, 15, true, false, false, '{}'),
      (v_carrinho, 'email', 'E4 · Seu pedido está a caminho… quase (VOLTA10)', t_e4, '', 3, 0, 0, true, false, true, '{"cupom":"VOLTA10","cupom_pct":"10","expira_horas":"24"}'),
      (v_carrinho, 'sms', 'SMS-02 · Cupom vencendo', NULL, '{{nome}}, seu cupom VOLTA10 (10% OFF) na sua case Minimal expira em 12h: {{link_checkout}} Sair: responda SAIR', 3, 12, 0, true, false, true, '{"cupom":"VOLTA10"}'),
      (v_carrinho, 'email', 'E5 · Últimas horas (ULTIMA15)', t_e5, '', 5, 0, 0, true, false, true, '{"cupom":"ULTIMA15","cupom_pct":"15","expira_horas":"12"}'),
      (v_carrinho, 'whatsapp_template', 'WA-03 · Última vez que falo disso', NULL, $m${{nome}}, última vez que te falo disso, prometo 🙏

Liberei *15% OFF* na sua {{produto}} com o cupom *ULTIMA15*. Vale só até {{expira_em}}.

{{link_checkout}}

Depois disso volta pro preço normal e eu tiro sua case do carrinho. Sem drama 🤝$m$, 5, 1, 0, true, false, false, '{"cupom":"ULTIMA15","expira_horas":"12"}'),
      (v_carrinho, 'email', 'E6 · Vou liberar sua case', t_e6, '', 7, 0, 0, true, false, true, '{}');
  END IF;

  IF v_pendente IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.leads_stages_followups WHERE leads_stages_id = v_pendente) THEN
    INSERT INTO public.leads_stages_followups (leads_stages_id, type, subject, email_template_id, message, days, hours, minutes, business_hours_only, bh_only_last, active, vars) VALUES
      (v_pendente, 'whatsapp_template', 'PIX-WA-01 · Seu Pix está esperando', NULL, $m${{nome}}, seu Pix da *{{produto}}* está esperando 👀

O código copia-e-cola está na página do pedido. Se preferir, dá pra pagar com cartão em até 3x:
{{link_checkout}}

Já pagou? Me responde aqui que eu confirmo.$m$, 0, 0, 5, false, false, false, '{}'),
      (v_pendente, 'sms', 'PIX-SMS-01 · Link do pedido', NULL, '{{nome}}, seu Pix da Minimal Cases ainda nao caiu. O codigo esta na pagina do pedido: {{link_checkout}} Sair: responda SAIR', 0, 0, 20, true, false, true, '{}'),
      (v_pendente, 'email', 'PIX-E1 · Seu Pix vence em pouco tempo', t_p1, '', 0, 1, 0, false, false, true, '{"expira_horas":"2"}'),
      (v_pendente, 'email', 'PIX-E2 · Ficou pra depois?', t_p2, '', 1, 0, 0, true, false, true, '{}'),
      (v_pendente, 'whatsapp_template', 'PIX-WA-03 · Última chamada (VOLTA10)', NULL, $m${{nome}}, última chamada: seu pedido da *{{produto}}* ainda dá pra fechar com *10% OFF* (cupom VOLTA10) nas próximas 12h.

{{link_checkout}}

Depois disso o carrinho é liberado. Sem drama 🤝$m$, 2, 0, 0, true, false, false, '{"cupom":"VOLTA10","cupom_pct":"10","expira_horas":"12"}');
  END IF;
END $$;

-- ── Disparo em massa pros leads JÁ parados num stage ─────────────────────────
CREATE OR REPLACE FUNCTION public.enqueue_stage_followups(p_stage_id uuid, p_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_leads int := 0; v_pairs int := 0; v_inserted int := 0;
BEGIN
  CREATE TEMP TABLE _esteira_cand ON COMMIT DROP AS
  SELECT l.id AS lead_id, l.people_id, f.id AS followup_id, f.type AS channel, f.template_id, f.message, f.subject,
         now() + make_interval(days => coalesce(f.days,0), hours => coalesce(f.hours,0), mins => coalesce(f.minutes,0)) AS scheduled_for
  FROM public.leads l
  JOIN public.leads_stages_followups f ON f.leads_stages_id = p_stage_id AND f.active = true
  LEFT JOIN public.clients_people p ON p.id = l.people_id
  WHERE l.leads_stages_id = p_stage_id
    AND l.status = 'in_progress'
    AND coalesce(l.control, '') <> 'sem_fup'
    AND (f.control IS NULL OR f.control = l.control)
    AND (f.score_matrix_id IS NULL OR f.score_matrix_id = p.score_matrix_id)
    AND NOT EXISTS (SELECT 1 FROM public.followup_queue q
                    WHERE q.lead_id = l.id AND q.followup_id = f.id AND q.status <> 'cancelled');

  SELECT count(DISTINCT lead_id), count(*) INTO v_leads, v_pairs FROM _esteira_cand;

  IF NOT p_dry_run THEN
    INSERT INTO public.followup_queue (followup_id, lead_id, person_id, channel, template_id, message, subject, source_type, scheduled_for, status)
    SELECT followup_id, lead_id, people_id, channel, template_id, message, subject, 'stage', scheduled_for, 'pending' FROM _esteira_cand;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object('leads', v_leads, 'entries', v_pairs, 'inserted', v_inserted, 'dry_run', p_dry_run);
END
$fn$;
REVOKE ALL ON FUNCTION public.enqueue_stage_followups(uuid, boolean) FROM PUBLIC, anon, authenticated;

COMMIT;
