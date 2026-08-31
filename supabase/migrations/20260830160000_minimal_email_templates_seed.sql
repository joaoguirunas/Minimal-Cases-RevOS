-- EMAIL-2.1 — Seed: templates da esteira de carrinho abandonado Minimal Cases.
-- Gerado a partir de /Volumes/nvme/minimal/emails (proposta Growth Sales, ago/2026).
-- Idempotente: só insere quando não existe template com o mesmo nome.
-- Imagens servidas pelo próprio app em /email-assets ({{asset_base}} aponta pra lá;
-- em produção use a URL pública do deploy, ex. https://crm.suaurl.com/email-assets).

BEGIN;

INSERT INTO public.email_templates (name, subject, html_body, variables, category, active)
SELECT $q$Esteira · E1 — Faltou isso aqui$q$, $q${{nome}}, ficou faltando isso aqui 🤏$q$, $tpl$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{nome}}, ficou faltando isso aqui 🤏</title>
<style>body{margin:0;padding:0;background:#f4f4f4}img{border:0;display:block}@media only screen and (max-width:620px){.w{width:100%!important}.p{padding-left:20px!important;padding-right:20px!important}.h1{font-size:34px!important;line-height:38px!important}}</style>
</head><body style="margin:0;padding:0;background:#f4f4f4;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#f4f4f4;">e a sua case já sai correndo pra sua casa ☀️ &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f4f4;"><tr><td align="center" style="padding:24px 0;">
<table role="presentation" class="w" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;background:#ffffff;">
  <!-- LOGO -->
  <tr><td class="p" style="padding:40px 48px 0 48px;">
    <img src="{{asset_base}}/logo-black.png" width="49" height="56" alt="Minimal Cases" style="width:49px;height:56px;">
    <div style="font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:4px;color:#111;font-weight:700;margin-top:6px;">MINIMAL CASES</div>
  </td></tr>
  <tr><td class="p" style="padding:22px 48px 0 48px;"><div style="height:1px;background:#111;"></div></td></tr>
  <!-- HEADLINE -->
  <tr><td class="p" style="padding:44px 48px 0 48px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">
    <div class="h1" style="font-size:46px;line-height:50px;letter-spacing:-1.5px;color:#111;font-weight:400;">
      Faltou só isso aqui 🤏 <span style="color:#9b9b9b;">pra sua case sair daqui e chegar na sua casa, {{nome}}.</span>
    </div>
  </td></tr>
  <!-- HERO -->
  <tr><td style="padding:40px 0 0 0;">
    <img src="{{asset_base}}/hi-cafe-janela.jpg" width="600" alt="Sua case, no sol" style="width:100%;max-width:600px;height:auto;">
  </td></tr>
  <!-- BODY -->
  <tr><td class="p" style="padding:40px 48px 0 48px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">
    <div style="font-size:26px;line-height:32px;letter-spacing:-0.5px;color:#111;">
      Você já fez a parte difícil: <span style="color:#9b9b9b;">achou a case, escolheu a cor, imaginou ela no seu {{modelo_celular}}.</span> Agora é só a parte boa. <span style="color:#9b9b9b;">Um clique, e a gente cuida do resto — frete grátis, rastreio no WhatsApp e aquele momento de abrir a caixa.</span>
    </div>
  </td></tr>
  <!-- CART RECAP -->
  <tr><td class="p" style="padding:36px 48px 0 48px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e6e6e6;">
      <tr>
        <td width="160" style="padding:16px;"><img src="{{imagem_produto}}" width="128" height="128" alt="{{produto}}" style="width:128px;height:128px;background:#f4f4f4;"></td>
        <td style="padding:16px 16px 16px 0;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;vertical-align:middle;">
          <div style="font-size:11px;letter-spacing:2px;color:#9b9b9b;font-weight:700;">SEU CARRINHO</div>
          <div style="font-size:18px;line-height:24px;color:#111;margin-top:6px;">{{produto}}</div>
          <div style="font-size:13px;color:#9b9b9b;margin-top:4px;">{{modelo_celular}}</div>
          <div style="font-size:18px;color:#111;margin-top:10px;font-weight:700;">{{preco}}</div>
          <div style="font-size:12px;color:#1a8f4a;margin-top:4px;font-weight:700;">✓ Frete grátis + rastreio</div>
        </td>
      </tr>
    </table>
  </td></tr>
  <!-- CTA -->
  <tr><td align="center" style="padding:36px 48px 0 48px;">
    <a href="{{link_checkout}}?utm_source=crm&utm_medium=email&utm_campaign=carrinho-abandonado&utm_content=e1" style="display:inline-block;background:#111111;color:#ffffff;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:0.5px;text-decoration:none;padding:20px 44px;border-radius:40px;">FINALIZAR MEU PEDIDO</a>
    <div style="font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:12px;color:#9b9b9b;margin-top:14px;">Postamos em até 1 dia útil. Você acompanha tudo pelo WhatsApp.</div>
  </td></tr>
  <tr><td class="p" style="padding:44px 48px 0 48px;"><div style="height:1px;background:#e6e6e6;"></div></td></tr>
  <!-- TRUST -->
  <tr><td class="p" style="padding:28px 48px 0 48px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:13px;color:#111;text-align:center;">
      <tr>
        <td width="33%" style="padding:8px;"><div style="font-size:22px;">📦</div><div style="margin-top:6px;">Frete grátis<br><span style="color:#9b9b9b;">pra todo o Brasil</span></div></td>
        <td width="33%" style="padding:8px;"><div style="font-size:22px;">🧲</div><div style="margin-top:6px;">MagSafe real<br><span style="color:#9b9b9b;">não é ímã colado</span></div></td>
        <td width="33%" style="padding:8px;"><div style="font-size:22px;">🔁</div><div style="margin-top:6px;">7 dias pra trocar<br><span style="color:#9b9b9b;">sem burocracia</span></div></td>
      </tr>
    </table>
  </td></tr>
  <!-- SIGN -->
  <tr><td class="p" style="padding:40px 48px 48px 48px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#111;">
    Qualquer dúvida sobre encaixe no seu {{modelo_celular}}, responde esse e-mail ou <a href="{{link_whatsapp}}" style="color:#111;text-decoration:underline;">me chama no WhatsApp</a>.<br><br>
    <strong>{{remetente}}</strong><br><span style="color:#9b9b9b;">Minimal Cases™</span>
  </td></tr>
</table>
<table role="presentation" class="w" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;"><tr><td style="padding:20px 48px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:11px;line-height:16px;color:#9b9b9b;text-align:center;">
Minimal Cases · minimalcases.com.br · Você recebeu este e-mail porque iniciou uma compra em nossa loja.<br><a href="{{unsubscribe}}" style="color:#9b9b9b;">Cancelar inscrição</a>
</td></tr></table>
</td></tr></table>
</body></html>
$tpl$, ARRAY['asset_base','imagem_produto','link_checkout','link_whatsapp','modelo_celular','nome','preco','produto','remetente','unsubscribe']::text[], 'carrinho-abandonado', true
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE name = $q$Esteira · E1 — Faltou isso aqui$q$);

INSERT INTO public.email_templates (name, subject, html_body, variables, category, active)
SELECT $q$Esteira · E2 — Celular voando na praia$q$, $q$Celular voando na praia. E a gente rindo.$q$, $tpl$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Celular voando na praia. E a gente rindo.</title>
<style>body{margin:0;padding:0;background:#f4f4f4}img{border:0;display:block}@media only screen and (max-width:620px){.w{width:100%!important}.p{padding-left:20px!important;padding-right:20px!important}.h1{font-size:34px!important;line-height:38px!important}}</style>
</head><body style="margin:0;padding:0;background:#f4f4f4;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#f4f4f4;">porque quem tem case boa não fica tenso &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f4f4;"><tr><td align="center" style="padding:24px 0;">
<table role="presentation" class="w" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;background:#ffffff;">
  <tr><td class="p" style="padding:40px 48px 0 48px;">
    <img src="{{asset_base}}/logo-black.png" width="49" height="56" alt="Minimal Cases" style="width:49px;height:56px;">
    <div style="font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:4px;color:#111;font-weight:700;margin-top:6px;">MINIMAL CASES</div>
  </td></tr>
  <tr><td class="p" style="padding:22px 48px 0 48px;"><div style="height:1px;background:#111;"></div></td></tr>
  <tr><td class="p" style="padding:44px 48px 0 48px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">
    <div class="h1" style="font-size:46px;line-height:50px;letter-spacing:-1.5px;color:#111;">
      Celular voando na praia. <span style="color:#9b9b9b;">E ninguém prendendo a respiração.</span>
    </div>
  </td></tr>
  <tr><td style="padding:40px 0 0 0;">
    <img src="{{asset_base}}/hi-praia-drop.jpg" width="600" alt="Case Minimal na praia" style="width:100%;max-width:600px;height:auto;">
  </td></tr>
  <tr><td class="p" style="padding:40px 48px 0 48px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">
    <div style="font-size:26px;line-height:32px;letter-spacing:-0.5px;color:#111;">
      Tem um tipo de leveza que só quem parou de ter medo de derrubar o celular conhece. <span style="color:#9b9b9b;">Areia, piscina, bolso da bermuda, mão de criança.</span> A Minimal foi feita pra isso: <span style="color:#9b9b9b;">borda elevada pra câmera, cantos que absorvem o tombo, MagSafe de verdade que gruda no carregador do carro e não solta.</span> Tudo sem engrossar o aparelho. <span style="color:#9b9b9b;">Proteção que você esquece que existe — que é exatamente a ideia.</span>
    </div>
  </td></tr>
  <!-- SPECS -->
  <tr><td class="p" style="padding:36px 48px 0 48px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">
      <tr>
        <td width="50%" style="padding:18px 16px 18px 0;border-top:1px solid #111;"><div style="font-size:30px;letter-spacing:-1px;color:#111;">2 m</div><div style="font-size:13px;color:#9b9b9b;margin-top:4px;">altura de queda testada</div></td>
        <td width="50%" style="padding:18px 0 18px 16px;border-top:1px solid #111;"><div style="font-size:30px;letter-spacing:-1px;color:#111;">1,4 mm</div><div style="font-size:13px;color:#9b9b9b;margin-top:4px;">borda acima da lente</div></td>
      </tr>
      <tr>
        <td width="50%" style="padding:18px 16px 18px 0;border-top:1px solid #e6e6e6;border-bottom:1px solid #111;"><div style="font-size:30px;letter-spacing:-1px;color:#111;">N52</div><div style="font-size:13px;color:#9b9b9b;margin-top:4px;">ímãs MagSafe embutidos</div></td>
        <td width="50%" style="padding:18px 0 18px 16px;border-top:1px solid #e6e6e6;border-bottom:1px solid #111;"><div style="font-size:30px;letter-spacing:-1px;color:#111;">0</div><div style="font-size:13px;color:#9b9b9b;margin-top:4px;">amarelamento (fosca anti-UV)</div></td>
      </tr>
    </table>
  </td></tr>
  <tr><td class="p" style="padding:36px 48px 0 48px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">
    <div style="font-size:22px;line-height:28px;letter-spacing:-0.3px;color:#111;">
      A <strong>{{produto}}</strong> que você deixou no carrinho é exatamente essa. <span style="color:#9b9b9b;">Ainda está lá, esperando, com frete grátis aplicado. Bora colocar ela pra trabalhar?</span>
    </div>
  </td></tr>
  <tr><td align="center" style="padding:36px 48px 0 48px;">
    <a href="{{link_checkout}}?utm_source=crm&utm_medium=email&utm_campaign=carrinho-abandonado&utm_content=e2" style="display:inline-block;background:#111111;color:#ffffff;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:0.5px;text-decoration:none;padding:20px 44px;border-radius:40px;">PROTEGER MEU {{modelo_celular_curto}}</a>
  </td></tr>
  <!-- REVIEW -->
  <tr><td class="p" style="padding:44px 48px 0 48px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f4f4;">
      <tr><td style="padding:28px 28px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">
        <div style="font-size:16px;color:#111;letter-spacing:2px;">★★★★★</div>
        <div style="font-size:18px;line-height:26px;color:#111;margin-top:12px;">“Meu filho de 4 anos usa meu celular como brinquedo. Já foi pro chão umas dez vezes. Continua novinho. Comprei outra de presente pra minha irmã.”</div>
        <div style="font-size:13px;color:#9b9b9b;margin-top:12px;">Camila R. · Curitiba · compra verificada</div>
      </td></tr>
    </table>
  </td></tr>
  <tr><td class="p" style="padding:40px 48px 48px 48px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#111;">
    <strong>{{remetente}}</strong><br><span style="color:#9b9b9b;">Minimal Cases™</span>
  </td></tr>
</table>
<table role="presentation" class="w" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;"><tr><td style="padding:20px 48px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:11px;line-height:16px;color:#9b9b9b;text-align:center;">
Minimal Cases · minimalcases.com.br · <a href="{{unsubscribe}}" style="color:#9b9b9b;">Cancelar inscrição</a>
</td></tr></table>
</td></tr></table>
</body></html>
$tpl$, ARRAY['asset_base','link_checkout','modelo_celular_curto','produto','remetente','unsubscribe']::text[], 'carrinho-abandonado', true
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE name = $q$Esteira · E2 — Celular voando na praia$q$);

INSERT INTO public.email_templates (name, subject, html_body, variables, category, active)
SELECT $q$Esteira · E3 — Eu ia te mandar um WhatsApp$q$, $q${{nome}} eu ia te mandar um WhatsApp$q$, $tpl$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{nome}} eu ia te mandar um WhatsApp</title>
<style>body{margin:0;padding:0;background:#000}img{border:0;display:block}@media only screen and (max-width:620px){.w{width:100%!important}.p{padding-left:20px!important;padding-right:20px!important}.h1{font-size:34px!important;line-height:38px!important}}</style>
</head><body style="margin:0;padding:0;background:#000000;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#000;">mas achei melhor escrever &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#000000;"><tr><td align="center" style="padding:24px 0;">
<table role="presentation" class="w" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;background:#000000;">
  <tr><td class="p" style="padding:40px 48px 0 48px;">
    <img src="{{asset_base}}/logo-white.png" width="49" height="56" alt="Minimal Cases" style="width:49px;height:56px;">
    <div style="font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:4px;color:#fff;font-weight:700;margin-top:6px;">MINIMAL CASES</div>
  </td></tr>
  <tr><td class="p" style="padding:22px 48px 0 48px;"><div style="height:1px;background:#ffffff;"></div></td></tr>
  <tr><td class="p" style="padding:44px 48px 0 48px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">
    <div class="h1" style="font-size:42px;line-height:46px;letter-spacing:-1.5px;color:#ffffff;">
      Eu ia te mandar um WhatsApp. <span style="color:#8a8a8a;">Mas achei que escrever seria mais honesto.</span>
    </div>
  </td></tr>
  <tr><td style="padding:36px 0 0 0;">
    <img src="{{asset_base}}/lo-jaqueta.jpg" width="600" alt="" style="width:100%;max-width:600px;height:auto;">
  </td></tr>
  <tr><td class="p" style="padding:40px 48px 0 48px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:17px;line-height:27px;color:#ffffff;">
    {{nome}}, boa noite.<br><br>
    Faz dois dias que a sua <strong>{{produto}}</strong> está parada no carrinho. Eu vejo isso acontecer todo dia e quase sempre é por um destes três motivos:<br><br>
    <strong>1. “Não sei se serve no meu celular.”</strong><br>
    <span style="color:#8a8a8a;">Serve. Essa é a versão exata pro {{modelo_celular}}. Encaixe de botões, câmera e MagSafe medidos no aparelho real. Se chegar e não encaixar, eu troco e pago o frete.</span><br><br>
    <strong>2. “Vou esperar uma promoção.”</strong><br>
    <span style="color:#8a8a8a;">Justo. Só que o frete grátis com rastreio já está aplicado, e essa cor específica é a que mais roda. Não consigo prometer que ela vai estar aqui semana que vem.</span><br><br>
    <strong>3. “Esqueci.”</strong><br>
    <span style="color:#8a8a8a;">Acontece com os melhores. Por isso esse e-mail.</span><br><br>
    O link continua o mesmo, com tudo preenchido do jeito que você deixou:<br>
    <a href="{{link_checkout}}?utm_source=crm&utm_medium=email&utm_campaign=carrinho-abandonado&utm_content=e3" style="color:#5b8def;text-decoration:underline;">Finalizar meu pedido com frete grátis →</a><br><br>
    Se for outro motivo, responde este e-mail. Eu leio.<br><br>
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
$tpl$, ARRAY['asset_base','cargo','link_checkout','modelo_celular','nome','produto','remetente','unsubscribe']::text[], 'carrinho-abandonado', true
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE name = $q$Esteira · E3 — Eu ia te mandar um WhatsApp$q$);

INSERT INTO public.email_templates (name, subject, html_body, variables, category, active)
SELECT $q$Esteira · E4 — Seu pedido está a caminho… quase$q$, $q$Seu pedido está a caminho… quase$q$, $tpl$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Seu pedido está a caminho… quase</title>
<style>body{margin:0;padding:0;background:#000}img{border:0;display:block}@media only screen and (max-width:620px){.w{width:100%!important}.p{padding-left:20px!important;padding-right:20px!important}.h1{font-size:34px!important;line-height:38px!important}}</style>
</head><body style="margin:0;padding:0;background:#000000;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#000;">falta só um clique (e liberei 10% pra hoje) &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#000000;"><tr><td align="center" style="padding:24px 0;">
<table role="presentation" class="w" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;background:#000000;">
  <tr><td class="p" style="padding:40px 48px 0 48px;">
    <img src="{{asset_base}}/logo-white.png" width="49" height="56" alt="Minimal Cases" style="width:49px;height:56px;">
    <div style="font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:4px;color:#fff;font-weight:700;margin-top:6px;">MINIMAL CASES</div>
  </td></tr>
  <tr><td class="p" style="padding:22px 48px 0 48px;"><div style="height:1px;background:#ffffff;"></div></td></tr>
  <tr><td class="p" style="padding:44px 48px 0 48px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">
    <div class="h1" style="font-size:46px;line-height:50px;letter-spacing:-1.5px;color:#ffffff;">
      Seu pedido está a caminho. <span style="color:#8a8a8a;">Quase. Falta só você apertar o botão.</span> <span style="color:#555;">E hoje ele vem com 10% a menos.</span>
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
      Essa cara aí de cima? <span style="color:#8a8a8a;">É a cara de quem abriu a caixa. Quero ver a sua também. Então liberei <strong style="color:#fff;">10%</strong> exclusivo pra sua {{produto}}, válido por 24 horas.</span> Depois disso, some. <span style="color:#8a8a8a;">Sem drama, é só o jeito que a gente funciona.</span>
    </div>
  </td></tr>
  <!-- CUPOM -->
  <tr><td class="p" style="padding:32px 48px 0 48px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px dashed #555;">
      <tr><td align="center" style="padding:24px;font-family:Courier New,Courier,monospace;">
        <div style="font-size:11px;letter-spacing:3px;color:#8a8a8a;">SEU CUPOM</div>
        <div style="font-size:36px;letter-spacing:6px;color:#ffffff;font-weight:700;margin-top:8px;">{{cupom}}</div>
        <div style="font-size:12px;color:#8a8a8a;margin-top:8px;">aplicado automaticamente pelo botão abaixo</div>
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
    <a href="{{link_checkout}}?discount={{cupom}}&utm_source=crm&utm_medium=email&utm_campaign=carrinho-abandonado&utm_content=e4" style="display:inline-block;background:#ffffff;color:#000000;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:0.5px;text-decoration:none;padding:20px 44px;border-radius:40px;">ATIVAR 10% E FINALIZAR</a>
    <div style="font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:12px;color:#8a8a8a;margin-top:14px;">{{preco}} → <strong style="color:#fff;">{{preco_com_cupom}}</strong> · frete grátis · rastreio no WhatsApp</div>
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
$tpl$, ARRAY['asset_base','countdown_gif','cupom','expira_em','link_checkout','preco','preco_com_cupom','produto','remetente','unsubscribe']::text[], 'carrinho-abandonado', true
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE name = $q$Esteira · E4 — Seu pedido está a caminho… quase$q$);

INSERT INTO public.email_templates (name, subject, html_body, variables, category, active)
SELECT $q$Esteira · E5 — Últimas horas$q$, $q$Expira em algumas horas, {{nome}}$q$, $tpl$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Expira em algumas horas, {{nome}}</title>
<style>body{margin:0;padding:0;background:#000}img{border:0;display:block}@media only screen and (max-width:620px){.w{width:100%!important}.p{padding-left:20px!important;padding-right:20px!important}.h1{font-size:34px!important;line-height:38px!important}}</style>
</head><body style="margin:0;padding:0;background:#000000;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#000;">depois disso volta pro preço normal &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#000000;"><tr><td align="center" style="padding:24px 0;">
<table role="presentation" class="w" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;background:#000000;">
  <tr><td class="p" style="padding:40px 48px 0 48px;">
    <img src="{{asset_base}}/logo-white.png" width="49" height="56" alt="Minimal Cases" style="width:49px;height:56px;">
    <div style="font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:4px;color:#fff;font-weight:700;margin-top:6px;">MINIMAL CASES</div>
  </td></tr>
  <tr><td class="p" style="padding:22px 48px 0 48px;"><div style="height:1px;background:#ffffff;"></div></td></tr>
  <tr><td class="p" style="padding:44px 48px 0 48px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">
    <div class="h1" style="font-size:52px;line-height:54px;letter-spacing:-2px;color:#ffffff;">
      Últimas horas. <span style="color:#8a8a8a;">Depois disso, sua case volta pro preço normal. E eu paro de te escrever.</span>
    </div>
  </td></tr>
  <tr><td style="padding:40px 0 0 0;"><img src="{{asset_base}}/lo-cabeceira.jpg" width="600" alt="" style="width:100%;max-width:600px;height:auto;"></td></tr>
  <!-- BIG PRODUCT -->
  <tr><td align="center" style="padding:36px 48px 0 48px;">
    <img src="{{imagem_produto}}" width="260" height="260" alt="{{produto}}" style="width:260px;max-width:100%;height:auto;border-radius:4px;">
  </td></tr>
  <tr><td align="center" style="padding:24px 48px 0 48px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">
    <div style="font-size:14px;color:#8a8a8a;">{{produto}} · {{modelo_celular}}</div>
    <div style="font-size:40px;letter-spacing:-1.5px;color:#fff;margin-top:8px;"><span style="color:#555;text-decoration:line-through;font-size:22px;">{{preco}}</span> &nbsp;{{preco_com_cupom}}</div>
    <div style="font-size:13px;color:#e8632b;margin-top:6px;font-weight:700;">com {{cupom}} · frete grátis</div>
  </td></tr>
  <tr><td class="p" style="padding:36px 48px 0 48px;"><div style="height:1px;background:#333;"></div></td></tr>
  <tr><td align="center" style="padding:24px 48px 0 48px;font-family:Courier New,Courier,monospace;font-size:13px;letter-spacing:1px;color:#ffffff;">O CUPOM MORRE EM</td></tr>
  <tr><td align="center" style="padding:16px 48px 0 48px;">
    <img src="{{countdown_gif}}" width="400" alt="Contagem regressiva" style="width:400px;max-width:100%;height:auto;">
  </td></tr>
  <tr><td class="p" style="padding:24px 48px 0 48px;"><div style="height:1px;background:#333;"></div></td></tr>
  <tr><td align="center" style="padding:36px 48px 0 48px;">
    <a href="{{link_checkout}}?discount={{cupom}}&utm_source=crm&utm_medium=email&utm_campaign=carrinho-abandonado&utm_content=e5" style="display:inline-block;background:#e8632b;color:#ffffff;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:0.5px;text-decoration:none;padding:20px 44px;border-radius:40px;">GARANTIR ANTES QUE EXPIRE</a>
  </td></tr>
  <tr><td class="p" style="padding:44px 48px 0 48px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:16px;line-height:25px;color:#8a8a8a;">
    <span style="color:#fff;">Sem truque:</span> o cupom expira porque a gente não trabalha com “promoção eterna”. Quem chega antes, paga menos. Quem chega depois, paga o justo. Os dois recebem a mesma case, o mesmo frete grátis, os mesmos 7 dias pra trocar — e a mesma cara de feliz abrindo a caixa.
  </td></tr>
  <tr><td class="p" style="padding:40px 48px 48px 48px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#fff;">
    <strong>{{remetente}}</strong><br><span style="color:#8a8a8a;">Minimal Cases™</span>
  </td></tr>
</table>
<table role="presentation" class="w" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;"><tr><td style="padding:20px 48px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:11px;line-height:16px;color:#8a8a8a;text-align:center;">
Minimal Cases · minimalcases.com.br · <a href="{{unsubscribe}}" style="color:#8a8a8a;">Cancelar inscrição</a>
</td></tr></table>
</td></tr></table>
</body></html>
$tpl$, ARRAY['asset_base','countdown_gif','cupom','imagem_produto','link_checkout','modelo_celular','nome','preco','preco_com_cupom','produto','remetente','unsubscribe']::text[], 'carrinho-abandonado', true
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE name = $q$Esteira · E5 — Últimas horas$q$);

INSERT INTO public.email_templates (name, subject, html_body, variables, category, active)
SELECT $q$Esteira · E6 — Vou liberar sua case$q$, $q$Vou liberar sua case pra outra pessoa$q$, $tpl$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vou liberar sua case pra outra pessoa</title>
<style>body{margin:0;padding:0;background:#f4f4f4}img{border:0;display:block}@media only screen and (max-width:620px){.w{width:100%!important}.p{padding-left:20px!important;padding-right:20px!important}.h1{font-size:34px!important;line-height:38px!important}.col{display:block!important;width:100%!important}}</style>
</head><body style="margin:0;padding:0;background:#f4f4f4;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#f4f4f4;">sem ressentimentos &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f4f4;"><tr><td align="center" style="padding:24px 0;">
<table role="presentation" class="w" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;background:#ffffff;">
  <tr><td class="p" style="padding:40px 48px 0 48px;">
    <img src="{{asset_base}}/logo-black.png" width="49" height="56" alt="Minimal Cases" style="width:49px;height:56px;">
    <div style="font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:4px;color:#111;font-weight:700;margin-top:6px;">MINIMAL CASES</div>
  </td></tr>
  <tr><td class="p" style="padding:22px 48px 0 48px;"><div style="height:1px;background:#111;"></div></td></tr>
  <tr><td class="p" style="padding:44px 48px 0 48px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">
    <div class="h1" style="font-size:46px;line-height:50px;letter-spacing:-1.5px;color:#111;">
      Vou liberar sua case pra outra pessoa. <span style="color:#9b9b9b;">Sem ressentimentos. Sério.</span>
    </div>
  </td></tr>
  <tr><td style="padding:40px 0 0 0;">
    <img src="{{asset_base}}/hi-amigas.jpg" width="600" alt="Amigas com Minimal Cases" style="width:100%;max-width:600px;height:auto;">
  </td></tr>
  <tr><td class="p" style="padding:40px 48px 0 48px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">
    <div style="font-size:24px;line-height:31px;letter-spacing:-0.5px;color:#111;">
      Uma semana é tempo suficiente. <span style="color:#9b9b9b;">Talvez a {{produto}} não era a sua. Talvez o momento não era. Tudo bem — a gente segue de boa.</span> Esse é o último e-mail sobre esse carrinho. <span style="color:#9b9b9b;">Mas antes de esvaziar, deixo o que a galera mais está levando essa semana. Vai que a sua case é outra.</span>
    </div>
  </td></tr>
  <!-- GRID MAIS VENDIDAS -->
  <tr><td class="p" style="padding:36px 48px 0 48px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">
      <tr>
        <td class="col" width="50%" style="padding:0 8px 24px 0;vertical-align:top;">
          <a href="https://minimalcases.com.br/products/case-iphone-fosca-design-minimalista-magsafe?utm_source=crm&utm_medium=email&utm_campaign=carrinho-abandonado&utm_content=e6" style="text-decoration:none;color:#111;">
          <img src="{{asset_base}}/prod-fosca.jpg" width="244" alt="" style="width:100%;height:auto;background:#f4f4f4;">
          <div style="font-size:15px;line-height:20px;margin-top:12px;">Case iPhone Fosca Minimalista MagSafe</div>
          <div style="font-size:14px;color:#9b9b9b;margin-top:4px;"><span style="text-decoration:line-through;">R$ 199,90</span> <strong style="color:#111;">R$ 144,90</strong></div></a>
        </td>
        <td class="col" width="50%" style="padding:0 0 24px 8px;vertical-align:top;">
          <a href="https://minimalcases.com.br/products/case-iphone-carbono-design-ondas-magsafe?utm_source=crm&utm_medium=email&utm_campaign=carrinho-abandonado&utm_content=e6" style="text-decoration:none;color:#111;">
          <img src="{{asset_base}}/prod-carbono.jpg" width="244" alt="" style="width:100%;height:auto;background:#f4f4f4;">
          <div style="font-size:15px;line-height:20px;margin-top:12px;">Case iPhone Carbono Ondas MagSafe</div>
          <div style="font-size:14px;color:#9b9b9b;margin-top:4px;"><strong style="color:#111;">R$ 154,90</strong></div></a>
        </td>
      </tr>
      <tr>
        <td class="col" width="50%" style="padding:0 8px 0 0;vertical-align:top;">
          <a href="https://minimalcases.com.br/products/case-iphone-couro-porta-cartoes-magnetico?utm_source=crm&utm_medium=email&utm_campaign=carrinho-abandonado&utm_content=e6" style="text-decoration:none;color:#111;">
          <img src="{{asset_base}}/prod-couro.jpg" width="244" alt="" style="width:100%;height:auto;background:#f4f4f4;">
          <div style="font-size:15px;line-height:20px;margin-top:12px;">Case iPhone Couro Porta-Cartões</div>
          <div style="font-size:14px;color:#9b9b9b;margin-top:4px;"><strong style="color:#111;">R$ 142,90</strong></div></a>
        </td>
        <td class="col" width="50%" style="padding:0 0 0 8px;vertical-align:top;">
          <a href="https://minimalcases.com.br/products/case-samsung-couro-legitimo-natural-com-magsafe?utm_source=crm&utm_medium=email&utm_campaign=carrinho-abandonado&utm_content=e6" style="text-decoration:none;color:#111;">
          <img src="{{asset_base}}/prod-samsung.jpg" width="244" alt="" style="width:100%;height:auto;background:#f4f4f4;">
          <div style="font-size:15px;line-height:20px;margin-top:12px;">Case Samsung Couro Legítimo MagSafe</div>
          <div style="font-size:14px;color:#9b9b9b;margin-top:4px;"><strong style="color:#111;">R$ 219,90</strong></div></a>
        </td>
      </tr>
    </table>
  </td></tr>
  <tr><td align="center" style="padding:40px 48px 0 48px;">
    <a href="https://minimalcases.com.br/collections/mais-vendidas?utm_source=crm&utm_medium=email&utm_campaign=carrinho-abandonado&utm_content=e6" style="display:inline-block;background:#111111;color:#ffffff;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:0.5px;text-decoration:none;padding:20px 44px;border-radius:40px;">VER AS MAIS VENDIDAS</a>
    <div style="font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:12px;color:#9b9b9b;margin-top:14px;">Ou <a href="{{link_checkout}}?utm_source=crm&utm_medium=email&utm_campaign=carrinho-abandonado&utm_content=e6-cart" style="color:#111;">recuperar o carrinho original</a> — ainda dá.</div>
  </td></tr>
  <tr><td class="p" style="padding:44px 48px 48px 48px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#111;">
    Foi um prazer. Quando o seu celular precisar, a gente está aqui.<br><br>
    <strong>{{remetente}}</strong><br><span style="color:#9b9b9b;">Minimal Cases™</span>
  </td></tr>
</table>
<table role="presentation" class="w" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;"><tr><td style="padding:20px 48px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:11px;line-height:16px;color:#9b9b9b;text-align:center;">
Minimal Cases · minimalcases.com.br · <a href="{{unsubscribe}}" style="color:#9b9b9b;">Cancelar inscrição</a>
</td></tr></table>
</td></tr></table>
</body></html>
$tpl$, ARRAY['asset_base','link_checkout','produto','remetente','unsubscribe']::text[], 'carrinho-abandonado', true
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE name = $q$Esteira · E6 — Vou liberar sua case$q$);

COMMIT;