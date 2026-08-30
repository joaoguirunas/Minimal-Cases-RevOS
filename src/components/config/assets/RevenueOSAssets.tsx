/**
 * RevenueOSAssets — Revenue OS™ platform overview
 * 6 story cards + 16s animated video.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Download, Play, Pause, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  D, MODULES, rr, rgba, ft, wrap, glow, noGlow,
  drawBase, drawFooter, drawDots, kpi,
  ease3, clamp01, tw as tw2, VD, drawPhoneChrome,
} from './shared';

// ─── Card 1 — O Sistema (hook) ────────────────────────────────────────────────
function drawCard1(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sc = w / 1080;
  drawBase(ctx, w, h, D.orange);

  ft(ctx, sc, 22, 700); ctx.fillStyle = D.orange;
  ctx.fillText('REVENUE OS™', 80 * sc, 195 * sc);

  ft(ctx, sc, 96, 800); ctx.fillStyle = D.text;
  ctx.fillText('9 módulos.', 80 * sc, 370 * sc);
  glow(ctx, D.orange, 14);
  ctx.fillStyle = D.orange;
  ctx.fillText('1 plataforma.', 80 * sc, 478 * sc);
  noGlow(ctx);

  ft(ctx, sc, 34, 400); ctx.fillStyle = D.muted;
  ctx.fillText('Do lead ao fechamento. Tudo conectado,', 80 * sc, 548 * sc);
  ctx.fillText('automatizado e sob controle.', 80 * sc, 594 * sc);

  // Module grid 3×3
  const mods = MODULES.filter(m => m.id !== 'revenue-os');
  const cellW = 293 * sc, cellH = 188 * sc, cellGap = 16 * sc;
  const gridX = 80 * sc, gridY = 644 * sc;

  mods.forEach((mod, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const cx2 = gridX + col * (cellW + cellGap);
    const cy2 = gridY + row * (cellH + cellGap);

    rr(ctx, cx2, cy2, cellW, cellH, 12 * sc);
    ctx.fillStyle = rgba(mod.color, .09); ctx.fill();
    ctx.strokeStyle = rgba(mod.color, .30); ctx.lineWidth = 1;
    rr(ctx, cx2, cy2, cellW, cellH, 12 * sc); ctx.stroke();
    rr(ctx, cx2, cy2, cellW, 4 * sc, 3 * sc);
    ctx.fillStyle = mod.color; ctx.fill();

    ft(ctx, sc, 48, 400); ctx.textAlign = 'center';
    ctx.fillText(mod.icon, cx2 + cellW / 2, cy2 + 82 * sc);

    ft(ctx, sc, 22, 700); ctx.fillStyle = D.text;
    const shortName = mod.name.replace('™', '').trim();
    ctx.fillText(shortName, cx2 + cellW / 2, cy2 + 122 * sc);

    ft(ctx, sc, 17, 400); ctx.fillStyle = rgba(mod.color, .8);
    const tag = mod.desc.split('·')[0].split(',')[0].trim().substring(0, 18);
    ctx.fillText(tag, cx2 + cellW / 2, cy2 + 154 * sc);
    ctx.textAlign = 'left';
  });

  // Bottom stat strip
  const sY = 1484 * sc;
  rr(ctx, 80 * sc, sY, 920 * sc, 84 * sc, 12 * sc);
  ctx.fillStyle = rgba(D.orange, .08); ctx.fill();
  ctx.strokeStyle = rgba(D.orange, .22); ctx.lineWidth = 1;
  rr(ctx, 80 * sc, sY, 920 * sc, 84 * sc, 12 * sc); ctx.stroke();
  glow(ctx, D.orange, 6);
  ft(ctx, sc, 30, 700); ctx.fillStyle = D.orange; ctx.textAlign = 'center';
  ctx.fillText('Uma plataforma. Toda sua operação comercial.', w / 2, sY + 52 * sc);
  noGlow(ctx); ctx.textAlign = 'left';

  drawDots(ctx, w, 5, 0, sc);
  drawFooter(ctx, w, 'growthsales.ai · Revenue OS™ · 1 de 5');
}

// ─── Card 2 — O Problema ──────────────────────────────────────────────────────
function drawCard2(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sc = w / 1080;
  drawBase(ctx, w, h, '#ef4444');

  ft(ctx, sc, 22, 700); ctx.fillStyle = '#ef4444';
  ctx.fillText('O PROBLEMA', 80 * sc, 195 * sc);

  ft(ctx, sc, 96, 800); ctx.fillStyle = D.text;
  ctx.fillText('Ferramentas', 80 * sc, 370 * sc);
  ctx.fillText('fragmentadas', 80 * sc, 478 * sc);
  ctx.fillStyle = '#ef4444';
  ctx.fillText('custam caro.', 80 * sc, 586 * sc);

  ft(ctx, sc, 34, 400); ctx.fillStyle = D.muted;
  ctx.fillText('A maioria das empresas usa 5–9 ferramentas', 80 * sc, 658 * sc);
  ctx.fillText('distintas. Dados fragmentados, time confuso.', 80 * sc, 704 * sc);

  // Tool cost rows
  const tools = [
    { name: 'CRM externo',        price: 'R$890/mês',  color: D.muted3 },
    { name: 'Plataforma de chat',  price: 'R$650/mês',  color: D.muted3 },
    { name: 'Ferramenta de BI',    price: 'R$480/mês',  color: D.muted3 },
    { name: 'Automação de e-mail', price: 'R$320/mês',  color: D.muted3 },
    { name: 'Agendamento',         price: 'R$190/mês',  color: D.muted3 },
    { name: '+ 4 ferramentas…',    price: 'R$720/mês',  color: '#ef4444' },
  ];
  let ry = 766 * sc;
  tools.forEach((tool, i) => {
    const rowH = 76 * sc;
    rr(ctx, 80 * sc, ry, 920 * sc, rowH, 0);
    ctx.fillStyle = i % 2 === 0 ? D.surf : rgba(D.surf2, .6); ctx.fill();
    if (i === tools.length - 1) {
      ctx.strokeStyle = rgba('#ef4444', .3); ctx.lineWidth = 1;
      rr(ctx, 80 * sc, ry, 920 * sc, rowH, 0); ctx.stroke();
    }
    ft(ctx, sc, 28, i === tools.length - 1 ? 700 : 400);
    ctx.fillStyle = i === tools.length - 1 ? '#ef4444' : D.text;
    ctx.fillText(tool.name, 112 * sc, ry + rowH / 2 + 10 * sc);
    ft(ctx, sc, 28, 700); ctx.fillStyle = '#ef4444'; ctx.textAlign = 'right';
    ctx.fillText(tool.price, 968 * sc, ry + rowH / 2 + 10 * sc); ctx.textAlign = 'left';
    ry += rowH;
  });

  // Total row
  rr(ctx, 80 * sc, ry, 920 * sc, 94 * sc, 10 * sc);
  ctx.fillStyle = rgba('#ef4444', .12); ctx.fill();
  ctx.strokeStyle = rgba('#ef4444', .4); ctx.lineWidth = 1.5;
  rr(ctx, 80 * sc, ry, 920 * sc, 94 * sc, 10 * sc); ctx.stroke();
  glow(ctx, '#ef4444', 10);
  ft(ctx, sc, 38, 800); ctx.fillStyle = '#ef4444'; ctx.textAlign = 'center';
  ctx.fillText('Total: R$3.250/mês em plataformas', w / 2, ry + 58 * sc);
  noGlow(ctx); ctx.textAlign = 'left';

  ft(ctx, sc, 26, 400); ctx.fillStyle = D.muted2; ctx.textAlign = 'center';
  ctx.fillText('Revenue OS™ unifica tudo por muito menos.', w / 2, ry + 130 * sc);
  ctx.textAlign = 'left';

  drawDots(ctx, w, 5, 1, sc);
  drawFooter(ctx, w, 'growthsales.ai · Revenue OS™ · 2 de 5');
}

// ─── Card 3 — A Plataforma ────────────────────────────────────────────────────
function drawCard3(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sc = w / 1080;
  drawBase(ctx, w, h, D.ai);

  ft(ctx, sc, 22, 700); ctx.fillStyle = D.ai;
  ctx.fillText('A SOLUÇÃO', 80 * sc, 195 * sc);

  ft(ctx, sc, 96, 800); ctx.fillStyle = D.text;
  ctx.fillText('Uma IA para', 80 * sc, 370 * sc);
  ctx.fillText('coordenar', 80 * sc, 478 * sc);
  glow(ctx, D.ai, 14);
  ctx.fillStyle = D.ai;
  ctx.fillText('tudo.', 80 * sc, 586 * sc);
  noGlow(ctx);

  ft(ctx, sc, 34, 400); ctx.fillStyle = D.muted;
  ctx.fillText('9 módulos nativos. IA conectando cada etapa', 80 * sc, 656 * sc);
  ctx.fillText('da jornada do cliente. Zero integrações.', 80 * sc, 702 * sc);

  // Hub-spoke diagram
  const hubX = w / 2, hubY = 1040 * sc, hubR = 88 * sc;

  // Outer module icons (in a circle)
  const mods = MODULES.filter(m => m.id !== 'revenue-os');
  const spokeR = 360 * sc;
  mods.forEach((mod, i) => {
    const angle = (i / mods.length) * Math.PI * 2 - Math.PI / 2;
    const mx = hubX + Math.cos(angle) * spokeR;
    const my = hubY + Math.sin(angle) * spokeR;

    // Spoke line
    ctx.beginPath(); ctx.moveTo(hubX, hubY); ctx.lineTo(mx, my);
    ctx.strokeStyle = rgba(mod.color, .28); ctx.lineWidth = 1.5 * sc; ctx.stroke();

    // Module node
    ctx.beginPath(); ctx.arc(mx, my, 42 * sc, 0, Math.PI * 2);
    ctx.fillStyle = rgba(mod.color, .12); ctx.fill();
    ctx.strokeStyle = rgba(mod.color, .5); ctx.lineWidth = 1.5 * sc; ctx.stroke();
    ft(ctx, sc, 30, 400); ctx.fillStyle = mod.color; ctx.textAlign = 'center';
    ctx.fillText(mod.icon, mx, my + 11 * sc);
    ctx.textAlign = 'left';
  });

  // Central Revenue OS hub
  const hubG = ctx.createRadialGradient(hubX, hubY, 0, hubX, hubY, hubR);
  hubG.addColorStop(0, rgba(D.ai, .28));
  hubG.addColorStop(1, rgba(D.ai, .06));
  ctx.beginPath(); ctx.arc(hubX, hubY, hubR, 0, Math.PI * 2);
  ctx.fillStyle = hubG; ctx.fill();
  glow(ctx, D.ai, 24 * sc);
  ctx.strokeStyle = rgba(D.ai, .7); ctx.lineWidth = 2 * sc;
  ctx.beginPath(); ctx.arc(hubX, hubY, hubR, 0, Math.PI * 2); ctx.stroke();
  noGlow(ctx);
  ft(ctx, sc, 22, 800); ctx.fillStyle = D.ai; ctx.textAlign = 'center';
  ctx.fillText('Revenue', hubX, hubY - 12 * sc);
  ctx.fillText('OS™', hubX, hubY + 18 * sc);
  ctx.textAlign = 'left';

  // Bottom strip
  const stripY = 1480 * sc;
  rr(ctx, 80 * sc, stripY, 920 * sc, 80 * sc, 12 * sc);
  ctx.fillStyle = rgba(D.ai, .08); ctx.fill();
  ctx.strokeStyle = rgba(D.ai, .22); ctx.lineWidth = 1;
  rr(ctx, 80 * sc, stripY, 920 * sc, 80 * sc, 12 * sc); ctx.stroke();
  glow(ctx, D.ai, 6);
  ft(ctx, sc, 28, 700); ctx.fillStyle = D.ai; ctx.textAlign = 'center';
  ctx.fillText('IA nativa · Zero integrações · Setup em 1 dia', w / 2, stripY + 50 * sc);
  noGlow(ctx); ctx.textAlign = 'left';

  drawDots(ctx, w, 5, 2, sc);
  drawFooter(ctx, w, 'growthsales.ai · Revenue OS™ · 3 de 5');
}

// ─── Card 4 — Os Resultados ───────────────────────────────────────────────────
function drawCard4(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sc = w / 1080;
  drawBase(ctx, w, h, D.wa);

  ft(ctx, sc, 22, 700); ctx.fillStyle = D.wa;
  ctx.fillText('OS RESULTADOS', 80 * sc, 195 * sc);

  ft(ctx, sc, 96, 800); ctx.fillStyle = D.text;
  ctx.fillText('Números que', 80 * sc, 370 * sc);
  ctx.fillText('transformam', 80 * sc, 478 * sc);
  ctx.fillStyle = D.wa;
  ctx.fillText('operações.', 80 * sc, 586 * sc);

  ft(ctx, sc, 32, 400); ctx.fillStyle = D.muted;
  ctx.fillText('Clientes Revenue OS™ em 60 dias:', 80 * sc, 656 * sc);

  // 2×2 KPI grid
  const kw = 440 * sc, kh = 200 * sc;
  kpi(ctx, 80 * sc,  706 * sc, kw, kh, '3,4×',   'taxa de conversão', 'vs operação manual',      D.wa,     sc);
  kpi(ctx, 560 * sc, 706 * sc, kw, kh, '98%',    'atendimentos IA',   'sem intervenção humana',   D.ai,     sc);
  kpi(ctx, 80 * sc,  934 * sc, kw, kh, 'R$48k',  'receita 1º mês',    'cliente Construtora JG',   D.orange, sc);
  kpi(ctx, 560 * sc, 934 * sc, kw, kh, '< 8s',   'resposta 24/7',     '9 módulos conectados',     D.em,     sc);

  // Testimonial
  const testY = 1172 * sc;
  rr(ctx, 80 * sc, testY, 920 * sc, 300 * sc, 16 * sc);
  ctx.fillStyle = D.surf; ctx.fill();
  ctx.strokeStyle = rgba(D.wa, .3); ctx.lineWidth = 1.5;
  rr(ctx, 80 * sc, testY, 920 * sc, 300 * sc, 16 * sc); ctx.stroke();
  ctx.fillStyle = D.wa; ctx.fillRect(80 * sc, testY, 4 * sc, 300 * sc);

  glow(ctx, D.orange, 6);
  ft(ctx, sc, 38, 400); ctx.fillStyle = D.orange; ctx.textAlign = 'center';
  ctx.fillText('★★★★★', w / 2, testY + 60 * sc); noGlow(ctx);

  ft(ctx, sc, 30, 500); ctx.fillStyle = D.text; ctx.textAlign = 'center';
  ctx.fillText('"Revenue OS™ substituiu 6 ferramentas.', w / 2, testY + 120 * sc);
  ctx.fillText('Time mais produtivo, custo 60% menor."', w / 2, testY + 160 * sc);
  ft(ctx, sc, 24, 400); ctx.fillStyle = D.muted;
  ctx.fillText('João Guirunas · CEO, Construtora JG · São Paulo', w / 2, testY + 204 * sc);
  ctx.textAlign = 'left';

  // Comparison bar
  const compY = testY + 328 * sc;
  rr(ctx, 80 * sc, compY, 920 * sc, 160 * sc, 12 * sc);
  ctx.fillStyle = D.surf; ctx.fill(); ctx.strokeStyle = D.border; ctx.lineWidth = 1;
  rr(ctx, 80 * sc, compY, 920 * sc, 160 * sc, 12 * sc); ctx.stroke();

  [{ l: 'Sem Revenue OS', pct: .29, c: D.muted3 }, { l: 'Com Revenue OS', pct: .91, c: D.wa }].forEach((comp, i) => {
    const by = compY + 22 * sc + i * 60 * sc;
    ft(ctx, sc, 24, 600); ctx.fillStyle = D.muted;
    ctx.fillText(comp.l, 112 * sc, by + 28 * sc);
    const barX = 310 * sc, barW = 590 * sc, barH = 26 * sc;
    rr(ctx, barX, by, barW, barH, barH / 2); ctx.fillStyle = rgba(comp.c, .12); ctx.fill();
    rr(ctx, barX, by, barW * comp.pct, barH, barH / 2); ctx.fillStyle = rgba(comp.c, .85); ctx.fill();
    ft(ctx, sc, 22, 700); ctx.fillStyle = comp.c; ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(comp.pct * 100)}%`, 940 * sc, by + 21 * sc); ctx.textAlign = 'left';
  });

  drawDots(ctx, w, 5, 3, sc);
  drawFooter(ctx, w, 'growthsales.ai · Revenue OS™ · 4 de 5');
}

// ─── Card 5 — CTA ─────────────────────────────────────────────────────────────
function drawCard5(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sc = w / 1080;
  drawBase(ctx, w, h, D.orange);

  ft(ctx, sc, 22, 700); ctx.fillStyle = D.orange;
  ctx.fillText('COMECE AGORA', 80 * sc, 195 * sc);

  ft(ctx, sc, 96, 800); ctx.fillStyle = D.text;
  ctx.fillText('Sua operação', 80 * sc, 370 * sc);
  ctx.fillText('no próximo', 80 * sc, 478 * sc);
  ctx.fillStyle = D.orange;
  ctx.fillText('nível.', 80 * sc, 586 * sc);

  // CTA button
  const btnY = 660 * sc, btnH = 130 * sc;
  rr(ctx, 80 * sc, btnY, 920 * sc, btnH, btnH / 2);
  const btnG = ctx.createLinearGradient(80 * sc, btnY, 1000 * sc, btnY + btnH);
  btnG.addColorStop(0, D.orange); btnG.addColorStop(1, '#e05520');
  ctx.fillStyle = btnG; ctx.fill();
  glow(ctx, D.orange, 30);
  ft(ctx, sc, 44, 800); ctx.fillStyle = D.text; ctx.textAlign = 'center';
  ctx.fillText('▶  Agendar Demonstração PRO', w / 2, btnY + btnH / 2 + 16 * sc);
  noGlow(ctx); ctx.textAlign = 'left';

  const perks = ['✓  Onboarding dedicado', '✓  Suporte 24/7 incluso', '✓  ROI em 30 dias'];
  perks.forEach((p, i) => {
    ft(ctx, sc, 28, 400); ctx.fillStyle = D.muted; ctx.textAlign = 'center';
    ctx.fillText(p, w / 2, btnY + btnH + 50 * sc + i * 48 * sc);
  });
  ctx.textAlign = 'left';

  // Social proof
  const spY = 1066 * sc;
  rr(ctx, 80 * sc, spY, 920 * sc, 120 * sc, 14 * sc);
  ctx.fillStyle = D.surf; ctx.fill(); ctx.strokeStyle = D.border; ctx.lineWidth = 1;
  rr(ctx, 80 * sc, spY, 920 * sc, 120 * sc, 14 * sc); ctx.stroke();
  glow(ctx, D.orange, 6);
  ft(ctx, sc, 36, 400); ctx.fillStyle = D.orange; ctx.textAlign = 'center';
  ctx.fillText('★★★★★', w / 2, spY + 56 * sc); noGlow(ctx);
  ft(ctx, sc, 26, 400); ctx.fillStyle = D.muted;
  ctx.fillText('4.9/5 · +180 empresas · Implementação em 1 dia', w / 2, spY + 94 * sc);
  ctx.textAlign = 'left';

  // URL strip
  const urlY = 1236 * sc;
  rr(ctx, 80 * sc, urlY, 920 * sc, 80 * sc, 14 * sc);
  const urlG = ctx.createLinearGradient(80 * sc, urlY, 1000 * sc, urlY);
  urlG.addColorStop(0, rgba(D.orange, .25)); urlG.addColorStop(1, rgba(D.orange, .1));
  ctx.fillStyle = urlG; ctx.fill();
  ctx.strokeStyle = rgba(D.orange, .45); ctx.lineWidth = 1.5;
  rr(ctx, 80 * sc, urlY, 920 * sc, 80 * sc, 14 * sc); ctx.stroke();
  glow(ctx, D.orange, 10); ft(ctx, sc, 36, 800); ctx.fillStyle = D.orange; ctx.textAlign = 'center';
  ctx.fillText('growthsales.ai', w / 2, urlY + 50 * sc); noGlow(ctx); ctx.textAlign = 'left';

  // Module grid mini
  const mods = MODULES.filter(m => m.id !== 'revenue-os');
  const mw = 188 * sc, mh = 130 * sc, mg = 14 * sc;
  const mgridY = 1370 * sc;
  mods.slice(0, 5).forEach((mod, i) => {
    const mx2 = 80 * sc + i * (mw + mg);
    rr(ctx, mx2, mgridY, mw, mh, 10 * sc);
    ctx.fillStyle = rgba(mod.color, .08); ctx.fill();
    ctx.strokeStyle = rgba(mod.color, .25); ctx.lineWidth = 1;
    rr(ctx, mx2, mgridY, mw, mh, 10 * sc); ctx.stroke();
    ft(ctx, sc, 36, 400); ctx.fillStyle = mod.color; ctx.textAlign = 'center';
    ctx.fillText(mod.icon, mx2 + mw / 2, mgridY + 56 * sc);
    ft(ctx, sc, 18, 600); ctx.fillStyle = D.muted2;
    ctx.fillText(mod.name.replace('™', '').replace(' PRO', '').trim(), mx2 + mw / 2, mgridY + 96 * sc);
    ctx.textAlign = 'left';
  });
  mods.slice(5).forEach((mod, i) => {
    const mx2 = 80 * sc + i * (mw + mg);
    const my2 = mgridY + mh + mg;
    rr(ctx, mx2, my2, mw, mh, 10 * sc);
    ctx.fillStyle = rgba(mod.color, .08); ctx.fill();
    ctx.strokeStyle = rgba(mod.color, .25); ctx.lineWidth = 1;
    rr(ctx, mx2, my2, mw, mh, 10 * sc); ctx.stroke();
    ft(ctx, sc, 36, 400); ctx.fillStyle = mod.color; ctx.textAlign = 'center';
    ctx.fillText(mod.icon, mx2 + mw / 2, my2 + 56 * sc);
    ft(ctx, sc, 18, 600); ctx.fillStyle = D.muted2;
    ctx.fillText(mod.name.replace('™', '').replace(' PRO', '').trim(), mx2 + mw / 2, my2 + 96 * sc);
    ctx.textAlign = 'left';
  });

  drawDots(ctx, w, 5, 4, sc);
  drawFooter(ctx, w, 'growthsales.ai · Revenue OS™ · 5 de 5');
}

// ─── Card 6 — Brand Identity ──────────────────────────────────────────────────
function drawCard6(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sc = w / 1080;
  ctx.fillStyle = D.bg; ctx.fillRect(0, 0, w, h);

  const amb = ctx.createRadialGradient(w * .5, h * .42, 0, w * .5, h * .42, w * .85);
  amb.addColorStop(0, rgba(D.orange, .08));
  amb.addColorStop(.55, rgba(D.orange, .025));
  amb.addColorStop(1, 'transparent');
  ctx.fillStyle = amb; ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = D.orange;
  ctx.fillRect(0, 0, w, 8 * sc);
  ctx.fillRect(0, h - 8 * sc, w, 8 * sc);

  // Logomark
  const lx = w / 2, ly = 560 * sc, lr = 130 * sc;
  const ringG = ctx.createRadialGradient(lx, ly, lr * .55, lx, ly, lr * 1.4);
  ringG.addColorStop(0, rgba(D.orange, .14));
  ringG.addColorStop(1, 'transparent');
  ctx.fillStyle = ringG;
  ctx.beginPath(); ctx.arc(lx, ly, lr * 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(lx, ly, lr, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(D.orange, .38); ctx.lineWidth = 2.5 * sc; ctx.stroke();
  ctx.beginPath(); ctx.arc(lx, ly, lr, 0, Math.PI * 2);
  ctx.fillStyle = rgba(D.orange, .07); ctx.fill();
  glow(ctx, D.orange, 28 * sc);
  ft(ctx, sc, 112, 900); ctx.fillStyle = D.orange; ctx.textAlign = 'center';
  ctx.fillText('G', lx, ly + 40 * sc);
  noGlow(ctx);

  ft(ctx, sc, 96, 900); ctx.fillStyle = D.text; ctx.textAlign = 'center';
  ctx.fillText('GROWTH', w / 2, 800 * sc);
  glow(ctx, D.orange, 18 * sc);
  ctx.fillStyle = D.orange;
  ctx.fillText('SALES', w / 2, 908 * sc);
  noGlow(ctx);

  ft(ctx, sc, 34, 500); ctx.fillStyle = D.muted3; ctx.textAlign = 'center';
  ctx.fillText('R E V E N U E  O S ™', w / 2, 978 * sc);

  const dY = 1020 * sc;
  ctx.strokeStyle = rgba(D.orange, .28); ctx.lineWidth = 1 * sc;
  ctx.beginPath(); ctx.moveTo(w / 2 - 170 * sc, dY); ctx.lineTo(w / 2 + 170 * sc, dY); ctx.stroke();
  ctx.beginPath(); ctx.arc(w / 2, dY, 5 * sc, 0, Math.PI * 2);
  ctx.fillStyle = D.orange; ctx.fill();

  ft(ctx, sc, 38, 400); ctx.fillStyle = D.muted; ctx.textAlign = 'center';
  ctx.fillText('Transforme leads em clientes.', w / 2, 1078 * sc);
  ctx.fillText('Automaticamente.', w / 2, 1130 * sc);

  const urlY = 1218 * sc, urlW = 680 * sc, urlH = 96 * sc;
  const urlX = (w - urlW) / 2;
  rr(ctx, urlX, urlY, urlW, urlH, urlH / 2);
  const urlG2 = ctx.createLinearGradient(urlX, urlY, urlX + urlW, urlY + urlH);
  urlG2.addColorStop(0, rgba(D.orange, .24));
  urlG2.addColorStop(1, rgba(D.orange, .08));
  ctx.fillStyle = urlG2; ctx.fill();
  ctx.strokeStyle = rgba(D.orange, .5); ctx.lineWidth = 1.5 * sc;
  rr(ctx, urlX, urlY, urlW, urlH, urlH / 2); ctx.stroke();
  glow(ctx, D.orange, 16 * sc);
  ft(ctx, sc, 44, 800); ctx.fillStyle = D.orange; ctx.textAlign = 'center';
  ctx.fillText('growthsales.ai', w / 2, urlY + 62 * sc);
  noGlow(ctx);

  // Module strip
  const mods = MODULES.filter(m => m.id !== 'revenue-os');
  const stripY = 1384 * sc;
  rr(ctx, 80 * sc, stripY, 920 * sc, 72 * sc, 10 * sc);
  ctx.fillStyle = rgba(D.orange, .05); ctx.fill();
  ctx.strokeStyle = rgba(D.orange, .15); ctx.lineWidth = 1;
  rr(ctx, 80 * sc, stripY, 920 * sc, 72 * sc, 10 * sc); ctx.stroke();
  let mx3 = 100 * sc;
  mods.forEach((mod) => {
    ft(ctx, sc, 30, 400); ctx.fillStyle = rgba(mod.color, .9); ctx.textAlign = 'center';
    ctx.fillText(mod.icon, mx3, stripY + 46 * sc);
    mx3 += 103 * sc;
  });
  ctx.textAlign = 'left';

  // KPI strip
  const kpY = 1512 * sc;
  rr(ctx, 80 * sc, kpY, 920 * sc, 180 * sc, 16 * sc);
  ctx.fillStyle = D.surf; ctx.fill();
  ctx.strokeStyle = D.border; ctx.lineWidth = 1;
  rr(ctx, 80 * sc, kpY, 920 * sc, 180 * sc, 16 * sc); ctx.stroke();
  [
    { v: '9',      l: 'módulos' },
    { v: '98%',    l: 'via IA' },
    { v: '< 8s',   l: 'resposta' },
    { v: '3,4×',   l: 'conversão' },
  ].forEach((k, i) => {
    const kx2 = 80 * sc + i * 230 * sc + 115 * sc;
    glow(ctx, D.orange, 8 * sc);
    ft(ctx, sc, 50, 800); ctx.fillStyle = D.orange; ctx.textAlign = 'center';
    ctx.fillText(k.v, kx2, kpY + 96 * sc); noGlow(ctx);
    ft(ctx, sc, 22, 400); ctx.fillStyle = D.muted2;
    ctx.fillText(k.l, kx2, kpY + 140 * sc);
    if (i < 3) {
      ctx.strokeStyle = D.border; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(80 * sc + (i + 1) * 230 * sc, kpY + 28 * sc);
      ctx.lineTo(80 * sc + (i + 1) * 230 * sc, kpY + 152 * sc); ctx.stroke();
    }
  });
  ctx.textAlign = 'left';

  ft(ctx, sc, 26, 400); ctx.fillStyle = D.muted3; ctx.textAlign = 'center';
  ctx.fillText('Vendas inteligentes. Resultados reais.', w / 2, 1754 * sc);
  ctx.textAlign = 'left';

  ctx.strokeStyle = D.border; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(80 * sc, 1812 * sc); ctx.lineTo(w - 80 * sc, 1812 * sc); ctx.stroke();
  ft(ctx, sc, 22, 400); ctx.fillStyle = D.muted3; ctx.textAlign = 'center';
  ctx.fillText('growthsales.ai · Revenue OS™ · Brand Identity', w / 2, 1868 * sc);
  ctx.textAlign = 'left';
}

// ─── Cards registry ───────────────────────────────────────────────────────────
const CARDS = [
  { id: 'sistema',    title: 'O Sistema',     subtitle: '9 módulos · 1 plataforma',          draw: drawCard1 },
  { id: 'problema',   title: 'O Problema',    subtitle: 'Ferramentas fragmentadas = prejuízo', draw: drawCard2 },
  { id: 'plataforma', title: 'A Plataforma',  subtitle: 'IA coordena tudo nativamente',        draw: drawCard3 },
  { id: 'resultados', title: 'Os Resultados', subtitle: 'R$48k no 1º mês · 3,4× conversão',   draw: drawCard4 },
  { id: 'cta',        title: 'Comece Agora',  subtitle: 'Agendar demonstração PRO',            draw: drawCard5 },
  { id: 'brand',      title: 'Growth Sales',  subtitle: 'growthsales.ai · Revenue OS™',        draw: drawCard6 },
];

// ─── Video ────────────────────────────────────────────────────────────────────
function drawVideoFrame(ctx: CanvasRenderingContext2D, w: number, h: number, elapsed: number) {
  const t = elapsed % VD;
  const sc = w / 1080;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = D.bg; ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'left';

  const { cx, cy, cw, ch } = drawPhoneChrome(ctx, w, h);
  ctx.save();
  const bw2 = 24 * sc;
  rr(ctx, bw2, bw2, w - bw2 * 2, h - bw2 * 2, 108 * sc - bw2);
  ctx.clip();

  // ── SCENE 0: Intro (0–2500ms) ─────────────────────────────────────────────
  if (t < 2500) {
    const bg = ctx.createRadialGradient(cx + cw / 2, cy + ch * .35, 0, cx + cw / 2, cy + ch * .35, cw * .85);
    bg.addColorStop(0, rgba(D.orange, .10 * ease3(clamp01(t / 2500))));
    bg.addColorStop(1, 'transparent');
    ctx.fillStyle = bg; ctx.fillRect(cx, cy, cw, ch);

    ctx.save(); ctx.globalAlpha = ease3(tw2(t, 0, 500));
    ft(ctx, sc, 22, 700); ctx.fillStyle = D.muted3; ctx.textAlign = 'center';
    ctx.fillText('GROWTHSALES', cx + cw / 2, cy + 72 * sc); ctx.restore();

    const titleT = tw2(t, 180, 600);
    ctx.save(); ctx.globalAlpha = ease3(titleT);
    glow(ctx, D.orange, 48 * sc);
    ft(ctx, sc, 92, 900); ctx.fillStyle = D.text; ctx.textAlign = 'center';
    ctx.fillText('Revenue OS™', cx + cw / 2, cy + ch * .26 + (1 - ease3(titleT)) * 40 * sc);
    noGlow(ctx); ctx.restore();

    ctx.save(); ctx.globalAlpha = ease3(tw2(t, 500, 500));
    ft(ctx, sc, 38, 400); ctx.fillStyle = D.muted2; ctx.textAlign = 'center';
    ctx.fillText('9 módulos. 1 plataforma.', cx + cw / 2, cy + ch * .26 + 60 * sc); ctx.restore();

    // Module icons appearing
    const mods = MODULES.filter(m => m.id !== 'revenue-os');
    const icoR = 220 * sc;
    mods.forEach((mod, i) => {
      const pT = tw2(t, 650 + i * 120, 400);
      const angle = (i / mods.length) * Math.PI * 2 - Math.PI / 2;
      const mx2 = cx + cw / 2 + Math.cos(angle) * icoR;
      const my2 = cy + ch * .52 + Math.sin(angle) * icoR * 0.7;
      ctx.save(); ctx.globalAlpha = ease3(pT);
      const off = (1 - ease3(pT)) * 20 * sc;
      ctx.beginPath(); ctx.arc(mx2, my2 + off, 36 * sc, 0, Math.PI * 2);
      ctx.fillStyle = rgba(mod.color, .20); ctx.fill();
      ctx.strokeStyle = rgba(mod.color, .65); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(mx2, my2 + off, 36 * sc, 0, Math.PI * 2); ctx.stroke();
      glow(ctx, mod.color, 12 * sc);
      ft(ctx, sc, 26, 400); ctx.fillStyle = mod.color; ctx.textAlign = 'center';
      ctx.fillText(mod.icon, mx2, my2 + off + 10 * sc);
      noGlow(ctx); ctx.restore();
    });
    ctx.textAlign = 'left';

    ctx.fillStyle = rgba(D.orange, .14); ctx.fillRect(cx, cy + ch - 5 * sc, cw, 5 * sc);
    ctx.fillStyle = D.orange; ctx.fillRect(cx, cy + ch - 5 * sc, cw * clamp01(t / 2500), 5 * sc);
  }

  // ── SCENE 1: CRM Kanban (2500–8000ms) ────────────────────────────────────
  else if (t < 8000) {
    const st = t - 2500;
    const hH = 118 * sc;
    ctx.fillStyle = D.surf; ctx.fillRect(cx, cy, cw, hH);
    ctx.fillStyle = D.wa; ctx.fillRect(cx, cy, cw, 4 * sc);
    ctx.strokeStyle = D.border; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, cy + hH); ctx.lineTo(cx + cw, cy + hH); ctx.stroke();

    // Header content
    ft(ctx, sc, 40, 700); ctx.fillStyle = D.text;
    ctx.fillText('CRM PRO™', cx + 24 * sc, cy + hH / 2 - 6 * sc);
    ft(ctx, sc, 26, 400); ctx.fillStyle = D.wa;
    ctx.fillText('Pipeline ativo · 24 leads', cx + 24 * sc, cy + hH / 2 + 28 * sc);
    ft(ctx, sc, 26, 600);
    const spw = ctx.measureText('Score IA').width + 28 * sc;
    rr(ctx, cx + cw - spw - 16 * sc, cy + (hH - 44 * sc) / 2, spw, 44 * sc, 22 * sc);
    ctx.fillStyle = rgba(D.orange, .18); ctx.fill();
    ctx.strokeStyle = rgba(D.orange, .5); ctx.lineWidth = 1.5;
    rr(ctx, cx + cw - spw - 16 * sc, cy + (hH - 44 * sc) / 2, spw, 44 * sc, 22 * sc); ctx.stroke();
    ft(ctx, sc, 26, 700); ctx.fillStyle = D.orange; ctx.textAlign = 'center';
    ctx.fillText('Score IA', cx + cw - spw / 2 - 16 * sc, cy + hH / 2 + 9 * sc); ctx.textAlign = 'left';

    // Kanban columns
    const stages = [
      { name: 'Novo Lead',     color: D.muted3, count: 7 },
      { name: 'Qualificado',   color: D.orange, count: 4 },
      { name: 'Em Proposta',   color: D.em,     count: 3 },
      { name: 'Fechado',       color: D.wa,     count: 2 },
    ];
    const colW2 = cw * 0.42, colGap2 = 12 * sc;
    const colsY = cy + hH + 10 * sc;

    stages.slice(0, 3).forEach((stage, col) => {
      const colX2 = cx + col * (colW2 + colGap2);
      const colHdrH = 44 * sc;
      rr(ctx, colX2, colsY, colW2, colHdrH, 8 * sc);
      ctx.fillStyle = rgba(stage.color, .12); ctx.fill();
      ctx.strokeStyle = rgba(stage.color, .35); ctx.lineWidth = 1;
      rr(ctx, colX2, colsY, colW2, colHdrH, 8 * sc); ctx.stroke();
      ft(ctx, sc, 22, 700); ctx.fillStyle = stage.color; ctx.textAlign = 'center';
      ctx.fillText(stage.name, colX2 + colW2 / 2, colsY + colHdrH / 2 + 8 * sc);
      // Count badge
      const cnt = `${stage.count}`;
      const bw3 = ctx.measureText(cnt).width + 18 * sc;
      rr(ctx, colX2 + colW2 - bw3 - 6 * sc, colsY + 8 * sc, bw3, 28 * sc, 14 * sc);
      ctx.fillStyle = rgba(stage.color, .25); ctx.fill();
      ft(ctx, sc, 18, 700); ctx.fillStyle = stage.color;
      ctx.fillText(cnt, colX2 + colW2 - bw3 / 2 - 6 * sc, colsY + 28 * sc);
      ctx.textAlign = 'left';
    });

    // Static cards in columns 1 and 2
    const cardW2 = colW2 - 12 * sc, cardH2 = 120 * sc, cardsY = colsY + 44 * sc + 8 * sc;
    const staticCards = [
      { name: 'Marcos Lima',  sub: 'Tech · R$1.8k', score: 91, col: 1 },
      { name: 'Ana Costa',    sub: 'Varejo · R$620', score: 74, col: 1 },
      { name: 'Pedro Alves',  sub: 'SaaS · R$2.4k',  score: 88, col: 2 },
    ];
    staticCards.forEach(sc2 => {
      const sT = ease3(tw2(st, 200 + sc2.col * 300, 500));
      const colX2 = cx + sc2.col * (colW2 + colGap2);
      const existing = staticCards.filter(c => c.col === sc2.col).indexOf(sc2);
      ctx.save(); ctx.globalAlpha = sT;
      const cy3 = cardsY + existing * (cardH2 + 8 * sc) + (1 - sT) * 20 * sc;
      rr(ctx, colX2 + 6 * sc, cy3, cardW2, cardH2, 8 * sc);
      ctx.fillStyle = D.surf; ctx.fill();
      ctx.strokeStyle = D.border; ctx.lineWidth = 1;
      rr(ctx, colX2 + 6 * sc, cy3, cardW2, cardH2, 8 * sc); ctx.stroke();
      ft(ctx, sc, 26, 700); ctx.fillStyle = D.text;
      ctx.fillText(sc2.name, colX2 + 18 * sc, cy3 + 34 * sc);
      ft(ctx, sc, 21, 400); ctx.fillStyle = D.muted2;
      ctx.fillText(sc2.sub, colX2 + 18 * sc, cy3 + 62 * sc);
      // Score badge
      rr(ctx, colX2 + 6 * sc + cardW2 - 70 * sc, cy3 + 8 * sc, 64 * sc, 30 * sc, 15 * sc);
      ctx.fillStyle = rgba(D.orange, .2); ctx.fill();
      ft(ctx, sc, 19, 700); ctx.fillStyle = D.orange; ctx.textAlign = 'center';
      ctx.fillText(`★ ${sc2.score}`, colX2 + 6 * sc + cardW2 - 38 * sc, cy3 + 28 * sc);
      ctx.textAlign = 'left'; ctx.restore();
    });

    // THE animated lead card (col0 → col1)
    const cardAnim = ease3(clamp01((st - 2600) / 700));
    const col0X = cx + 0 * (colW2 + colGap2) + 6 * sc;
    const col1X = cx + 1 * (colW2 + colGap2) + 6 * sc;
    const animCardX = col0X + (col1X - col0X) * cardAnim;
    const animCardY = cardsY + (1 - ease3(clamp01(st / 500))) * 28 * sc;

    ctx.save(); ctx.globalAlpha = ease3(clamp01(st / 400));
    glow(ctx, st > 2600 ? D.wa : D.orange, 14 * sc);
    rr(ctx, animCardX, animCardY, cardW2, cardH2, 8 * sc);
    ctx.fillStyle = st > 2600 ? rgba(D.wa, .08) : D.surf; ctx.fill();
    ctx.strokeStyle = st > 2600 ? rgba(D.wa, .55) : rgba(D.orange, .45); ctx.lineWidth = 1.5;
    rr(ctx, animCardX, animCardY, cardW2, cardH2, 8 * sc); ctx.stroke();
    noGlow(ctx);
    ft(ctx, sc, 26, 700); ctx.fillStyle = D.text;
    ctx.fillText('João Guirunas', animCardX + 12 * sc, animCardY + 34 * sc);
    ft(ctx, sc, 21, 400); ctx.fillStyle = D.muted2;
    ctx.fillText('Construtora JG · R$4.8k', animCardX + 12 * sc, animCardY + 62 * sc);
    // IA badge
    if (st > 2200) {
      const ibT = ease3(clamp01((st - 2200) / 450));
      ctx.save(); ctx.globalAlpha = ibT;
      const ibl = 'IA ✓';
      ft(ctx, sc, 18, 700);
      const ibW = ctx.measureText(ibl).width + 16 * sc;
      rr(ctx, animCardX + cardW2 - ibW - 6 * sc, animCardY + 8 * sc, ibW, 28 * sc, 14 * sc);
      ctx.fillStyle = rgba(D.ai, .25); ctx.fill();
      ctx.fillStyle = D.ai; ctx.textAlign = 'center';
      ctx.fillText(ibl, animCardX + cardW2 - ibW / 2 - 6 * sc, animCardY + 28 * sc);
      ctx.textAlign = 'left'; ctx.restore();
    }
    // Score (appears after move)
    if (st > 3100) {
      const scT = ease3(clamp01((st - 3100) / 400));
      ctx.save(); ctx.globalAlpha = scT;
      rr(ctx, animCardX + cardW2 - 78 * sc, animCardY + 44 * sc, 72 * sc, 30 * sc, 15 * sc);
      ctx.fillStyle = rgba(D.orange, .22); ctx.fill();
      ft(ctx, sc, 19, 700); ctx.fillStyle = D.orange; ctx.textAlign = 'center';
      ctx.fillText('★ 94', animCardX + cardW2 - 42 * sc, animCardY + 64 * sc);
      ctx.textAlign = 'left'; ctx.restore();
    }
    ctx.restore();

    // Status notification
    if (st > 3600 && st < 5200) {
      const nT = ease3(clamp01((st - 3600) / 400));
      ctx.save(); ctx.globalAlpha = nT;
      const nY = cy + ch - 100 * sc;
      rr(ctx, cx + 16 * sc, nY, cw - 32 * sc, 72 * sc, 12 * sc);
      ctx.fillStyle = rgba(D.wa, .18); ctx.fill();
      ctx.strokeStyle = rgba(D.wa, .55); ctx.lineWidth = 1.5;
      rr(ctx, cx + 16 * sc, nY, cw - 32 * sc, 72 * sc, 12 * sc); ctx.stroke();
      glow(ctx, D.wa, 10 * sc);
      ft(ctx, sc, 26, 700); ctx.fillStyle = D.wa; ctx.textAlign = 'center';
      ctx.fillText('✅ Lead qualificado pela IA — Score 94', cx + cw / 2, nY + 44 * sc);
      noGlow(ctx); ctx.textAlign = 'left'; ctx.restore();
    }

    ctx.fillStyle = rgba(D.wa, .14); ctx.fillRect(cx, cy + ch - 5 * sc, cw, 5 * sc);
    ctx.fillStyle = D.wa; ctx.fillRect(cx, cy + ch - 5 * sc, cw * clamp01(st / 5500), 5 * sc);
  }

  // ── SCENE 2: Transition (8000–9300ms) ────────────────────────────────────
  else if (t < 9300) {
    const st = t - 8000;
    const entryT = ease3(tw2(st, 0, 400));
    const nbg = ctx.createRadialGradient(cx + cw / 2, cy + ch * .44, 0, cx + cw / 2, cy + ch * .44, cw * .75);
    nbg.addColorStop(0, rgba(D.orange, .16 * entryT)); nbg.addColorStop(1, 'transparent');
    ctx.fillStyle = nbg; ctx.fillRect(cx, cy, cw, ch);

    const cardT = ease3(tw2(st, 80, 460));
    ctx.save(); ctx.globalAlpha = cardT;
    const nx = cx + 20 * sc, ny = cy + 48 * sc, nw = cw - 40 * sc, nh = 120 * sc;
    const cardOff = (1 - cardT) * -50 * sc;
    rr(ctx, nx, ny + cardOff, nw, nh, 18 * sc);
    ctx.shadowColor = rgba(D.orange, .4); ctx.shadowBlur = 18 * sc;
    ctx.fillStyle = D.surf; ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = rgba(D.orange, .7); ctx.lineWidth = 2;
    rr(ctx, nx, ny + cardOff, nw, nh, 18 * sc); ctx.stroke();
    ft(ctx, sc, 24, 800); ctx.fillStyle = D.orange; ctx.textAlign = 'center';
    ctx.fillText('📩 Omni PRO™ — Nova mensagem', cx + cw / 2, ny + 42 * sc + cardOff);
    ft(ctx, sc, 22, 400); ctx.fillStyle = D.muted2;
    ctx.fillText('João via WhatsApp: "Pode me enviar a proposta?"', cx + cw / 2, ny + 72 * sc + cardOff);
    ft(ctx, sc, 19, 400); ctx.fillStyle = D.muted3;
    ctx.fillText('agora mesmo', cx + cw / 2, ny + 98 * sc + cardOff);
    ctx.textAlign = 'left'; ctx.restore();

    const txtT = ease3(tw2(st, 260, 520));
    ctx.save(); ctx.globalAlpha = txtT;
    const txtOff = (1 - txtT) * 30 * sc;
    ft(ctx, sc, 62, 700); ctx.fillStyle = D.orange; ctx.textAlign = 'center';
    ctx.fillText('⚡', cx + cw / 2, cy + ch * .42 + txtOff);
    ft(ctx, sc, 42, 700); ctx.fillStyle = D.text;
    ctx.fillText('IA respondeu', cx + cw / 2, cy + ch * .42 + 72 * sc + txtOff);
    ctx.fillText('automaticamente', cx + cw / 2, cy + ch * .42 + 128 * sc + txtOff);
    ft(ctx, sc, 28, 400); ctx.fillStyle = rgba(D.orange, .85);
    ctx.fillText('CRM → Omni PRO™ → IA → Lead', cx + cw / 2, cy + ch * .42 + 178 * sc + txtOff);
    ctx.textAlign = 'left'; ctx.restore();

    ctx.fillStyle = rgba(D.orange, .14); ctx.fillRect(cx, cy + ch - 5 * sc, cw, 5 * sc);
    ctx.fillStyle = D.orange; ctx.fillRect(cx, cy + ch - 5 * sc, cw * clamp01(st / 1300), 5 * sc);
  }

  // ── SCENE 3: BI Dashboard (9300–12600ms) ─────────────────────────────────
  else if (t < 12600) {
    const st = t - 9300;
    const hH = 118 * sc;
    ctx.fillStyle = D.surf; ctx.fillRect(cx, cy, cw, hH);
    ctx.fillStyle = D.em; ctx.fillRect(cx, cy, cw, 4 * sc);
    ctx.strokeStyle = D.border; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, cy + hH); ctx.lineTo(cx + cw, cy + hH); ctx.stroke();

    ft(ctx, sc, 40, 700); ctx.fillStyle = D.text;
    ctx.fillText('BI PRO™', cx + 24 * sc, cy + hH / 2 - 6 * sc);
    ft(ctx, sc, 26, 400); ctx.fillStyle = D.em;
    ctx.fillText('Dashboard · Este mês', cx + 24 * sc, cy + hH / 2 + 28 * sc);

    // 2×2 KPI cards
    const biKpis = [
      { v: 'R$127k', l: 'Receita',       c: D.wa     },
      { v: '3,4×',   l: 'Conversão',     c: D.orange },
      { v: '94',     l: 'Leads/dia',     c: D.em     },
      { v: '98%',    l: 'Via IA',        c: D.ai     },
    ];
    const kw3 = (cw - 3 * 8 * sc) / 2, kh3 = 148 * sc;
    const ky0 = cy + hH + 16 * sc;
    biKpis.forEach((k, i) => {
      const kT = ease3(tw2(st, 200 + i * 160, 480));
      const kx3 = cx + (i % 2) * (kw3 + 8 * sc);
      const ky3 = ky0 + Math.floor(i / 2) * (kh3 + 8 * sc);
      ctx.save(); ctx.globalAlpha = kT;
      ctx.shadowColor = rgba(k.c, .3); ctx.shadowBlur = 14 * sc;
      rr(ctx, kx3, ky3 + (1 - kT) * 28 * sc, kw3, kh3, 12 * sc);
      ctx.fillStyle = D.surf; ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = rgba(k.c, .4); ctx.lineWidth = 1.5;
      rr(ctx, kx3, ky3 + (1 - kT) * 28 * sc, kw3, kh3, 12 * sc); ctx.stroke();
      glow(ctx, k.c, 10 * sc);
      ft(ctx, sc, 58, 800); ctx.fillStyle = k.c; ctx.textAlign = 'center';
      ctx.fillText(k.v, kx3 + kw3 / 2, ky3 + 96 * sc + (1 - kT) * 28 * sc); noGlow(ctx);
      ft(ctx, sc, 24, 500); ctx.fillStyle = D.muted2;
      ctx.fillText(k.l, kx3 + kw3 / 2, ky3 + 132 * sc + (1 - kT) * 28 * sc);
      ctx.restore();
    });

    // Bar chart (monthly revenue trend)
    const chartY = ky0 + 2 * (kh3 + 8 * sc) + 20 * sc;
    const chartH = 180 * sc, chartW = cw - 32 * sc;
    const months = [0.42, 0.58, 0.51, 0.68, 0.79, 1.0];
    const barW3 = (chartW / months.length) * 0.6;
    const barGap = (chartW / months.length) * 0.4;

    rr(ctx, cx + 16 * sc, chartY, chartW, chartH + 44 * sc, 12 * sc);
    ctx.fillStyle = D.surf; ctx.fill();
    ctx.strokeStyle = D.border; ctx.lineWidth = 1;
    rr(ctx, cx + 16 * sc, chartY, chartW, chartH + 44 * sc, 12 * sc); ctx.stroke();

    ft(ctx, sc, 22, 600); ctx.fillStyle = D.muted2;
    ctx.fillText('Receita últimos 6 meses', cx + 28 * sc, chartY + 28 * sc);

    const mnames = ['Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar'];
    months.forEach((pct, mi) => {
      const bT = ease3(tw2(st, 800 + mi * 100, 500));
      const bx2 = cx + 16 * sc + mi * (barW3 + barGap) + barGap / 2;
      const bH2 = (chartH - 50 * sc) * pct * bT;
      const by2 = chartY + chartH - 8 * sc - bH2;

      rr(ctx, bx2, by2, barW3, bH2, 4 * sc);
      const barG2 = ctx.createLinearGradient(bx2, by2, bx2, by2 + bH2);
      barG2.addColorStop(0, rgba(mi === 5 ? D.wa : D.em, .95));
      barG2.addColorStop(1, rgba(mi === 5 ? D.wa : D.em, .35));
      ctx.fillStyle = barG2; ctx.fill();

      if (bT > 0.5) {
        ft(ctx, sc, 18, 400); ctx.fillStyle = D.muted3; ctx.textAlign = 'center';
        ctx.fillText(mnames[mi], bx2 + barW3 / 2, chartY + chartH + 28 * sc);
        ctx.textAlign = 'left';
      }
    });

    ctx.fillStyle = rgba(D.em, .14); ctx.fillRect(cx, cy + ch - 5 * sc, cw, 5 * sc);
    ctx.fillStyle = D.em; ctx.fillRect(cx, cy + ch - 5 * sc, cw * clamp01(st / 3300), 5 * sc);
  }

  // ── SCENE 4: Results + CTA (12600–16000ms) ───────────────────────────────
  else {
    const st = t - 12600;
    const rg = ctx.createRadialGradient(cx + cw / 2, cy + ch * .27, 0, cx + cw / 2, cy + ch * .27, cw * .85);
    rg.addColorStop(0, rgba(D.orange, .08 * ease3(clamp01(st / 600)))); rg.addColorStop(1, 'transparent');
    ctx.fillStyle = rg; ctx.fillRect(cx, cy, cw, ch);

    ctx.save(); ctx.globalAlpha = ease3(tw2(st, 0, 500));
    ft(ctx, sc, 22, 700); ctx.fillStyle = D.muted3; ctx.textAlign = 'center';
    ctx.fillText('GROWTHSALES · REVENUE OS™', cx + cw / 2, cy + 68 * sc);
    ft(ctx, sc, 62, 800); ctx.fillStyle = D.text;
    ctx.fillText('Resultados reais.', cx + cw / 2, cy + ch * .19);
    ctx.fillText('Em tempo real.', cx + cw / 2, cy + ch * .19 + 78 * sc);
    ctx.restore();

    const finalKpis = [
      { label: '9 módulos nativos', value: '1',        color: D.orange },
      { label: 'Taxa de conversão', value: '3,4×',     color: D.wa     },
      { label: 'Respostas via IA',  value: '98%',      color: D.ai     },
      { label: 'Tempo de resposta', value: '< 8s',     color: D.em     },
    ];
    const kw4 = 424 * sc, kh4 = 168 * sc, kgap4 = 22 * sc;
    const kx40 = cx + (cw - (2 * kw4 + kgap4)) / 2;
    const ky40 = cy + ch * .37;
    finalKpis.forEach((k, i) => {
      const kx4 = kx40 + (i % 2) * (kw4 + kgap4);
      const ky4 = ky40 + Math.floor(i / 2) * (kh4 + 18 * sc);
      const cT = ease3(tw2(st, 280 + i * 130, 480));
      ctx.save(); ctx.globalAlpha = cT;
      ctx.shadowColor = rgba(k.color, .28); ctx.shadowBlur = 18 * sc;
      rr(ctx, kx4, ky4 + (1 - cT) * 34 * sc, kw4, kh4, 14 * sc);
      ctx.fillStyle = D.surf; ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = rgba(k.color, .4); ctx.lineWidth = 1.5;
      rr(ctx, kx4, ky4 + (1 - cT) * 34 * sc, kw4, kh4, 14 * sc); ctx.stroke();
      glow(ctx, k.color, 12 * sc);
      ft(ctx, sc, 72, 800); ctx.fillStyle = k.color; ctx.textAlign = 'center';
      ctx.fillText(k.value, kx4 + kw4 / 2, ky4 + 110 * sc + (1 - cT) * 34 * sc); noGlow(ctx);
      ft(ctx, sc, 26, 500); ctx.fillStyle = D.muted2;
      ctx.fillText(k.label, kx4 + kw4 / 2, ky4 + 154 * sc + (1 - cT) * 34 * sc);
      ctx.restore();
    });

    const ctaT = ease3(tw2(st, 1600, 580));
    if (ctaT > 0) {
      ctx.save(); ctx.globalAlpha = ctaT;
      const ctaY = ky40 + 2 * (kh4 + 18 * sc) + 44 * sc;
      const ctaW = 556 * sc, ctaH = 84 * sc;
      glow(ctx, D.orange, 28 * sc);
      rr(ctx, cx + (cw - ctaW) / 2, ctaY + (1 - ctaT) * 22 * sc, ctaW, ctaH, ctaH / 2);
      ctx.fillStyle = D.orange; ctx.fill(); noGlow(ctx);
      ft(ctx, sc, 30, 700); ctx.fillStyle = D.bg; ctx.textAlign = 'center';
      ctx.fillText('Agendar demonstração →', cx + cw / 2, ctaY + 53 * sc + (1 - ctaT) * 22 * sc);
      ft(ctx, sc, 22, 400); ctx.fillStyle = D.muted3;
      ctx.fillText('growthsales.ai', cx + cw / 2, ctaY + 112 * sc + (1 - ctaT) * 22 * sc);
      ctx.textAlign = 'left'; ctx.restore();
    }

    ctx.fillStyle = rgba(D.orange, .14); ctx.fillRect(cx, cy + ch - 5 * sc, cw, 5 * sc);
    ctx.fillStyle = D.orange; ctx.fillRect(cx, cy + ch - 5 * sc, cw * clamp01(st / 3400), 5 * sc);
  }

  ctx.restore(); // end screen clip

  // Glass overlay
  ctx.save();
  const sheen2 = ctx.createLinearGradient(0, 0, w * 0.55, h * 0.38);
  sheen2.addColorStop(0, 'rgba(255,255,255,0.04)');
  sheen2.addColorStop(1, 'rgba(255,255,255,0)');
  rr(ctx, 0, 0, w, h, 108 * sc);
  ctx.fillStyle = sheen2; ctx.fill();
  ctx.restore();
}

// ─── CardPreview ──────────────────────────────────────────────────────────────
function CardPreview({ card }: { card: typeof CARDS[number] }) {
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState<'jpg' | 'svg' | null>(null);

  useEffect(() => {
    const c = previewRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    card.draw(ctx, c.width, c.height);
  }, [card]);

  const dl = useCallback(() => {
    setBusy('jpg');
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
    const ctx = c.getContext('2d')!;
    card.draw(ctx, 1080, 1920);
    c.toBlob(blob => {
      if (!blob) { setBusy(null); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `revenue-os-${card.id}.jpg`;
      document.body.appendChild(a); a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); setBusy(null); }, 150);
    }, 'image/jpeg', 0.95);
  }, [card]);

  const dlSvg = useCallback(() => {
    setBusy('svg');
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
    const ctx2 = c.getContext('2d')!;
    card.draw(ctx2, 1080, 1920);
    const bg = c.toDataURL('image/png');
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1080" height="1920" viewBox="0 0 1080 1920">
  <title>Revenue OS™ — ${card.title} · growthsales.ai</title>
  <g id="background-raster"><image href="${bg}" width="1080" height="1920"/></g>
  <g id="text-layer" font-family="Inter,-apple-system,Helvetica Neue,sans-serif">
    <text x="80" y="195" fill="#FF4A00" font-size="22" font-weight="700" letter-spacing="3">${card.title.toUpperCase()}</text>
    <text x="540" y="1868" fill="#52525b" font-size="22" text-anchor="middle">growthsales.ai · Revenue OS™</text>
  </g>
</svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `revenue-os-${card.id}.svg`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); setBusy(null); }, 150);
  }, [card]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="aspect-[9/16] w-full rounded-[6px] overflow-hidden border border-border">
        <canvas ref={previewRef} width={540} height={960} className="w-full h-full" style={{ imageRendering: 'auto' }} />
      </div>
      <p className="text-[11px] font-semibold text-foreground leading-none">{card.title}</p>
      <p className="text-[10px] text-muted-foreground/60 leading-none">{card.subtitle}</p>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" className="h-6 text-[9px] px-1.5 gap-1 flex-1"
          disabled={!!busy} onClick={dl}>
          {busy === 'jpg' ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Download className="w-2.5 h-2.5" />} JPG
        </Button>
        <Button variant="outline" size="sm" className="h-6 text-[9px] px-1.5 gap-1 flex-1"
          disabled={!!busy} onClick={dlSvg}>
          {busy === 'svg' ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Download className="w-2.5 h-2.5" />} SVG
        </Button>
      </div>
    </div>
  );
}

// ─── VideoDemo ────────────────────────────────────────────────────────────────
function VideoDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const startRef  = useRef<number>(0);
  const pausedAt  = useRef<number>(0);
  const paused    = useRef<boolean>(false);
  const [playing, setPlaying]     = useState(true);
  const [recording, setRecording] = useState(false);
  const [recErr, setRecErr]       = useState('');

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const loop = (now: number) => {
      if (!startRef.current) startRef.current = now;
      const elapsed = paused.current ? pausedAt.current : now - startRef.current;
      drawVideoFrame(ctx, c.width, c.height, elapsed);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const togglePlay = () => {
    if (!paused.current) {
      paused.current = true; pausedAt.current = performance.now() - startRef.current; setPlaying(false);
    } else {
      paused.current = false; startRef.current = performance.now() - pausedAt.current; setPlaying(true);
    }
  };

  const dlFrame = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const url = c.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url; a.download = 'revenue-os-frame.png';
    document.body.appendChild(a); a.click();
    setTimeout(() => document.body.removeChild(a), 150);
  }, []);

  const record = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    if (typeof (c as HTMLCanvasElement & { captureStream?: () => MediaStream }).captureStream !== 'function') {
      setRecErr('Use Chrome ou Edge para gravar.'); return;
    }
    setRecording(true); setRecErr('');
    const chunks: Blob[] = [];
    const fmtCandidates = [
      { mime: 'video/mp4;codecs=h264', ext: 'mp4' },
      { mime: 'video/mp4',              ext: 'mp4' },
      { mime: 'video/webm;codecs=vp9',  ext: 'webm' },
      { mime: 'video/webm',             ext: 'webm' },
    ];
    const fmt = fmtCandidates.find(f => MediaRecorder.isTypeSupported(f.mime)) ?? { mime: 'video/webm', ext: 'webm' };
    let mr: MediaRecorder;
    try {
      mr = new MediaRecorder(
        (c as HTMLCanvasElement & { captureStream: (fps?: number) => MediaStream }).captureStream(60),
        { mimeType: fmt.mime, videoBitsPerSecond: 12_000_000 }
      );
    } catch { setRecErr('MediaRecorder não suportado.'); setRecording(false); return; }
    mr.ondataavailable = e => { if (e.data?.size > 0) chunks.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunks, { type: fmt.mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `revenue-os-demo.${fmt.ext}`;
      document.body.appendChild(a); a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 300);
      setRecording(false);
    };
    paused.current = false; startRef.current = performance.now();
    mr.start(100); setTimeout(() => mr.stop(), VD + 600);
  }, []);

  return (
    <div className="flex gap-8 items-start">
      <div className="flex-shrink-0" style={{ width: 270 }}>
        <div
          className="aspect-[9/16] w-full rounded-[18px] overflow-visible"
          style={{
            transform: 'perspective(960px) rotateY(-14deg) rotateX(5deg)',
            transformOrigin: 'center center',
            filter: 'drop-shadow(0 40px 80px rgba(0,0,0,0.65)) drop-shadow(0 0 1px rgba(255,255,255,0.04))',
          }}
        >
          <canvas
            ref={canvasRef} width={1080} height={1920}
            className="w-full h-full rounded-[18px]"
            style={{ imageRendering: 'auto', display: 'block' }}
          />
        </div>
        <div className="flex gap-1.5 mt-3">
          <Button variant="outline" size="sm" className="h-7 text-[10px] px-2 gap-1 flex-1" onClick={togglePlay}>
            {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {playing ? 'Pausar' : 'Play'}
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-[10px] px-2 gap-1 flex-1" onClick={dlFrame}>
            <Download className="w-3 h-3" /> PNG
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-[10px] px-2 gap-1 flex-1"
            disabled={recording} onClick={record}>
            {recording ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
            {recording ? 'Gravando…' : 'MP4'}
          </Button>
        </div>
        {recErr && <p className="text-[9px] text-destructive mt-1">{recErr}</p>}
      </div>

      <div className="pt-1 space-y-3">
        <div>
          <p className="text-[13px] font-semibold text-foreground">Vídeo animado</p>
          <p className="text-[11px] text-muted-foreground/60">16s · 9:16 · 60fps · Instagram Story</p>
        </div>
        <div className="space-y-2.5">
          {([
            { range: '0–2.5s',   label: 'Intro',          color: D.orange, desc: 'Revenue OS™ + 9 módulos aparecem em órbita' },
            { range: '2.5–8s',   label: 'CRM PRO™',       color: D.wa,     desc: 'Lead João qualificado pela IA — Score 94' },
            { range: '8–9.3s',   label: 'Transição',      color: D.orange, desc: 'Omni PRO™ intercepta mensagem automaticamente' },
            { range: '9.3–12.6s',label: 'BI PRO™',        color: D.em,     desc: 'Dashboard: R$127k · gráfico 6 meses' },
            { range: '12.6–16s', label: 'Resultados',     color: D.orange, desc: '3,4× · 98% · < 8s · Agendar demo' },
          ] as const).map(s => (
            <div key={s.range} className="flex gap-2.5 items-start">
              <span className="text-[9px] font-mono mt-0.5 flex-shrink-0"
                style={{ color: s.color, background: s.color + '18', borderRadius: 3, padding: '1px 5px' }}>
                {s.range}
              </span>
              <div>
                <p className="text-[11px] font-semibold text-foreground leading-none">{s.label}</p>
                <p className="text-[10px] text-muted-foreground/55 leading-tight mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function RevenueOSAssets() {
  return (
    <div className="space-y-10 pb-16">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary/70">Revenue OS™</p>
        <h2 className="text-[18px] font-semibold text-foreground">Assets — Visão Geral da Plataforma</h2>
        <p className="text-[13px] text-muted-foreground/60 max-w-lg leading-relaxed">
          6 cards verticais (1080×1920 · 9:16) e 1 vídeo animado de 16 segundos mostrando
          os 9 módulos do Revenue OS™. Export em <strong>JPG</strong>, <strong>SVG</strong> e <strong>MP4</strong>.
        </p>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/40 mb-4">
          6 cards · 1080×1920 · Instagram Story
        </p>
        <div className="grid grid-cols-6 gap-4">
          {CARDS.map(card => <CardPreview key={card.id} card={card} />)}
        </div>
      </div>

      <div className="border-t border-border pt-8">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/40 mb-5">
          Vídeo animado · 16s · 5 cenas · 60fps
        </p>
        <VideoDemo />
      </div>
    </div>
  );
}
