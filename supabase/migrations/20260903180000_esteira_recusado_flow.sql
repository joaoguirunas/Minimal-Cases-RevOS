-- EST-REC — Fluxo "Pagamento recusado" (webhook transaction.payment.refused → stage
-- "Pagamento recusado"): a Yampi entrega o carrinho inteiro no evento e o cliente
-- estava a um clique de pagar — é o abandono mais quente que existe.
BEGIN;
INSERT INTO public.email_templates (name, subject, html_body, active)
SELECT 'Esteira · REC-E1 — Seu pagamento não passou', 'Seu pagamento não passou, {{nome}} — dá pra resolver em 1 minuto', $tpl$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Seu pagamento não passou — acontece</title>
<style>body{margin:0;padding:0;background:#000}img{border:0;display:block}@media only screen and (max-width:620px){.w{width:100%!important}.p{padding-left:20px!important;padding-right:20px!important}.h1{font-size:34px!important;line-height:38px!important}}</style>
</head><body style="margin:0;padding:0;background:#000000;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#000;">e dá pra resolver em 1 minuto, com Pix ou outro cartão &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#000000;"><tr><td align="center" style="padding:24px 0;">
<table role="presentation" class="w" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;background:#000000;">
  <tr><td class="p" style="padding:40px 48px 0 48px;">
    <img src="{{asset_base}}/logo-white.png" width="49" height="56" alt="Minimal Cases" style="width:49px;height:56px;">
    <div style="font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:4px;color:#fff;font-weight:700;margin-top:6px;">MINIMAL CASES</div>
  </td></tr>
  <tr><td class="p" style="padding:22px 48px 0 48px;"><div style="height:1px;background:#ffffff;"></div></td></tr>
  <tr><td class="p" style="padding:44px 48px 0 48px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">
    <div class="h1" style="font-size:42px;line-height:46px;letter-spacing:-1.5px;color:#ffffff;">
      Seu pagamento não passou. <span style="color:#8a8a8a;">Acontece — e quase nunca é culpa sua.</span>
    </div>
  </td></tr>
  <tr><td style="padding:36px 0 0 0;">
    <img src="{{asset_base}}/lo-jaqueta.jpg" width="600" alt="" style="width:100%;max-width:600px;height:auto;">
  </td></tr>
  <tr><td class="p" style="padding:40px 48px 0 48px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:17px;line-height:27px;color:#ffffff;">
    {{nome}}, tudo bem.<br><br>
    O pagamento da sua <strong>{{produto}}</strong> foi recusado agora há pouco. Seu carrinho continua reservado, do jeito que você deixou. Normalmente é um destes três motivos:<br><br>
    <strong>1. O banco travou por segurança.</strong><br>
    <span style="color:#8a8a8a;">Compra online nova, valor fora do padrão. Tentar de novo com o mesmo cartão costuma passar.</span><br><br>
    <strong>2. Limite ou dados do cartão.</strong><br>
    <span style="color:#8a8a8a;">Outro cartão resolve. Ou Pix: cai na hora e ainda tem desconto no checkout.</span><br><br>
    <strong>3. Não era pra ser agora.</strong><br>
    <span style="color:#8a8a8a;">Sem problema. O link fica aberto.</span><br><br>
    Frete grátis com rastreio segue aplicado:<br>
    <a href="{{link_checkout}}?utm_source=crm&utm_medium=email&utm_campaign=pagamento-recusado&utm_content=rec-e1" style="color:#5b8def;text-decoration:underline;">Tentar de novo (Pix ou cartão) →</a><br><br>
    Se travou em algo, responde este e-mail. Eu leio.<br><br>
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
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE name LIKE 'Esteira · REC-E1%');

DO $$
DECLARE v_pipeline uuid; v_stage uuid; t_rec uuid;
BEGIN
  SELECT id INTO v_pipeline FROM public.leads_pipelines WHERE name = 'Esteira Minimal — Loja' LIMIT 1;
  IF v_pipeline IS NULL THEN RETURN; END IF;
  SELECT id INTO v_stage FROM public.leads_stages WHERE leads_pipelines_id = v_pipeline AND name = 'Pagamento recusado';
  SELECT id INTO t_rec FROM public.email_templates WHERE name LIKE 'Esteira · REC-E1%' LIMIT 1;
  IF v_stage IS NULL OR t_rec IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.leads_stages_followups WHERE leads_stages_id = v_stage) THEN
    INSERT INTO public.leads_stages_followups (leads_stages_id, type, subject, email_template_id, message, days, hours, minutes, business_hours_only, bh_only_last, active, vars) VALUES
      (v_stage, 'email', 'REC-E1 · Seu pagamento não passou', t_rec, '', 0, 0, 15, false, false, true, '{}'),
      (v_stage, 'sms', 'REC-SMS-01 · Tentar de novo', NULL, '{{nome}}, o pagamento da sua case Minimal nao passou. Seu carrinho segue reservado - Pix cai na hora: {{link_checkout}} Sair: responda SAIR', 0, 1, 0, true, false, true, '{}'),
      (v_stage, 'whatsapp_template', 'REC-WA-01 · Pagamento recusado', NULL, $m$Oi {{nome}}, o pagamento da sua *{{produto}}* não passou — acontece, quase nunca é culpa sua 🙂 Seu carrinho segue reservado. Quer tentar de novo com Pix (cai na hora) ou outro cartão?
{{link_checkout}}$m$, 0, 0, 30, true, false, false, '{}');
  END IF;
END $$;
COMMIT;
