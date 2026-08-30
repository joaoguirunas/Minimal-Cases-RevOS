/**
 * RevOSCards — 8 vertical marketing cards (1080×1920, 9:16)
 * One card per module: RevOS General, BI PRO, CRM PRO, OMNI PRO,
 * Call PRO, Sends PRO, Schedule PRO, Form PRO.
 *
 * Each card uses canvas rendering with shared design tokens.
 * Download as PNG.
 */
import { useEffect, useRef, useCallback } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { D, MODULES, rr, rgba, ft, glow, noGlow, drawBase, drawFooter, kpi } from './shared';

// ─── Extra colors not in shared D ─────────────────────────────────────────────
const CYAN   = '#06b6d4';
const AMBER  = '#f59e0b';
const PURPLE = '#8b5cf6';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function featureDot(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, label: string, color: string, sc: number,
  size = 34, weight = 500,
) {
  ctx.beginPath();
  ctx.arc(x + 10 * sc, y + 11 * sc, 5.5 * sc, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
  ft(ctx, sc, size, weight); ctx.fillStyle = D.text;
  ctx.fillText(label, x + 28 * sc, y + 24 * sc);
}

function channelRow(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  label: string, sublabel: string, color: string, sc: number,
) {
  rr(ctx, x, y, w, h, 14 * sc);
  ctx.fillStyle = rgba(color, .08); ctx.fill();
  ctx.strokeStyle = rgba(color, .22); ctx.lineWidth = 1.5;
  rr(ctx, x, y, w, h, 14 * sc); ctx.stroke();
  // color bar left
  rr(ctx, x, y, 6 * sc, h, 3 * sc); ctx.fillStyle = color; ctx.fill();
  // label
  glow(ctx, color, 8);
  ft(ctx, sc, 38, 700); ctx.fillStyle = color;
  ctx.fillText(label, x + 24 * sc, y + h * .52 + 4 * sc);
  noGlow(ctx);
  // sublabel
  ft(ctx, sc, 26, 400); ctx.fillStyle = D.muted;
  ctx.fillText(sublabel, x + 24 * sc, y + h * .82);
}

function featureCard(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  title: string, body: string, color: string, sc: number,
) {
  rr(ctx, x, y, w, h, 12 * sc);
  ctx.fillStyle = rgba(color, .07); ctx.fill();
  ctx.strokeStyle = rgba(color, .2); ctx.lineWidth = 1;
  rr(ctx, x, y, w, h, 12 * sc); ctx.stroke();
  ft(ctx, sc, 28, 700); ctx.fillStyle = color;
  ctx.fillText(title, x + 20 * sc, y + 40 * sc);
  ft(ctx, sc, 26, 400); ctx.fillStyle = D.muted;
  ctx.fillText(body, x + 20 * sc, y + 75 * sc);
}

// ─── Card 1: RevOS General ────────────────────────────────────────────────────
function drawOraCard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sc = w / 1080;
  drawBase(ctx, w, h, D.orange);

  // Eyebrow
  ft(ctx, sc, 22, 700); ctx.fillStyle = D.orange;
  ctx.fillText('A PLATAFORMA COMPLETA DE REVENUE', 80 * sc, 195 * sc);

  // Headline
  ft(ctx, sc, 108, 900); ctx.fillStyle = D.text;
  ctx.fillText('9 módulos.', 80 * sc, 380 * sc);
  glow(ctx, D.orange, 18);
  ctx.fillStyle = D.orange;
  ctx.fillText('1 plataforma.', 80 * sc, 498 * sc);
  noGlow(ctx);

  ft(ctx, sc, 36, 400); ctx.fillStyle = D.muted;
  ctx.fillText('Do lead ao fechamento. Tudo conectado,', 80 * sc, 572 * sc);
  ctx.fillText('automatizado e sob controle.', 80 * sc, 618 * sc);

  // Module grid 3×3
  const mods = MODULES.filter(m => m.id !== 'revenue-os');
  const cellW = 290 * sc, cellH = 186 * sc, gap = 18 * sc;
  const gridX = 80 * sc, gridY = 680 * sc;

  mods.forEach((mod, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const cx = gridX + col * (cellW + gap);
    const cy = gridY + row * (cellH + gap);

    rr(ctx, cx, cy, cellW, cellH, 14 * sc);
    ctx.fillStyle = rgba(mod.color, .09); ctx.fill();
    ctx.strokeStyle = rgba(mod.color, .25); ctx.lineWidth = 1;
    rr(ctx, cx, cy, cellW, cellH, 14 * sc); ctx.stroke();

    // Icon
    ft(ctx, sc, 52, 400); ctx.fillStyle = D.text; ctx.textAlign = 'center';
    ctx.fillText(mod.icon, cx + cellW / 2, cy + 74 * sc);

    // Name
    ft(ctx, sc, 22, 700); ctx.fillStyle = mod.color; ctx.textAlign = 'center';
    ctx.fillText(mod.name.replace('™', ''), cx + cellW / 2, cy + 112 * sc);

    // Color accent bar bottom
    const bw = 80 * sc, bh = 4 * sc;
    rr(ctx, cx + (cellW - bw) / 2, cy + cellH - 20 * sc, bw, bh, bh / 2);
    ctx.fillStyle = rgba(mod.color, .5); ctx.fill();

    ctx.textAlign = 'left';
  });

  // Badge
  const bdW = 520 * sc, bdH = 72 * sc, bdX = (w - bdW) / 2, bdY = 1680 * sc;
  rr(ctx, bdX, bdY, bdW, bdH, bdH / 2);
  ctx.fillStyle = rgba(D.orange, .12); ctx.fill();
  ctx.strokeStyle = rgba(D.orange, .35); ctx.lineWidth = 1.5;
  rr(ctx, bdX, bdY, bdW, bdH, bdH / 2); ctx.stroke();
  ft(ctx, sc, 28, 600); ctx.fillStyle = D.orange; ctx.textAlign = 'center';
  ctx.fillText('crm.joaoguirunas.com', w / 2, bdY + bdH / 2 + 10 * sc);
  ctx.textAlign = 'left';

  drawFooter(ctx, w, 'crm.joaoguirunas.com · A plataforma completa de revenue');
}

// ─── Card 2: BI PRO™ ─────────────────────────────────────────────────────────
function drawBIProCard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sc = w / 1080;
  drawBase(ctx, w, h, D.em, 'BI PRO™');

  ft(ctx, sc, 22, 700); ctx.fillStyle = D.em;
  ctx.fillText('João Guirunas —BI PRO™', 80 * sc, 195 * sc);

  ft(ctx, sc, 108, 900); ctx.fillStyle = D.text;
  ctx.fillText('Dados que', 80 * sc, 370 * sc);
  glow(ctx, D.em, 18);
  ctx.fillStyle = D.em;
  ctx.fillText('vendem.', 80 * sc, 488 * sc);
  noGlow(ctx);

  ft(ctx, sc, 36, 400); ctx.fillStyle = D.muted;
  ctx.fillText('Dashboards e insights que guiam cada', 80 * sc, 560 * sc);
  ctx.fillText('decisão de vendas e marketing.', 80 * sc, 606 * sc);

  // 3 KPI boxes
  const kW = 280 * sc, kH = 180 * sc, kGap = 20 * sc;
  const kY = 680 * sc;
  const kTotal = 3 * kW + 2 * kGap;
  const kX0 = (w - kTotal) / 2;
  kpi(ctx, kX0,             kY, kW, kH, '+234%', 'Leads',       '↑ vs mês ant.', D.em,      sc);
  kpi(ctx, kX0 + kW + kGap, kY, kW, kH, '−41%',  'CAC',         '↓ custo aquisição', D.wa,  sc);
  kpi(ctx, kX0 + (kW + kGap) * 2, kY, kW, kH, '8.7×', 'ROI',    '↑ retorno mídia', D.orange, sc);

  // Feature list
  const fX = 80 * sc, fY0 = 940 * sc, fStep = 90 * sc;
  const features = [
    'Funil de Conversão completo',
    'Atribuição de Mídia (Meta + Google)',
    'CAC Detalhado por canal',
    'Comparação de períodos',
    'Dashboards em tempo real',
  ];
  features.forEach((f, i) => featureDot(ctx, fX, fY0 + i * fStep, f, D.em, sc, 36, 500));

  // Divider
  ctx.strokeStyle = rgba(D.em, .15); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(80 * sc, 1430 * sc); ctx.lineTo(w - 80 * sc, 1430 * sc); ctx.stroke();

  ft(ctx, sc, 30, 400); ctx.fillStyle = rgba(D.em, .7);
  ctx.fillText('Visão 360° do seu negócio. Não é relatório —', 80 * sc, 1490 * sc);
  ctx.fillText('é inteligência de revenue.', 80 * sc, 1530 * sc);

  drawFooter(ctx, w, 'crm.joaoguirunas.com · BI PRO™ · Analytics de Revenue');
}

// ─── Card 3: CRM PRO™ ────────────────────────────────────────────────────────
function drawCRMProCard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sc = w / 1080;
  drawBase(ctx, w, h, D.wa, 'CRM PRO™');

  ft(ctx, sc, 22, 700); ctx.fillStyle = D.wa;
  ctx.fillText('João Guirunas —CRM PRO™', 80 * sc, 195 * sc);

  ft(ctx, sc, 108, 900); ctx.fillStyle = D.text;
  ctx.fillText('Feche mais.', 80 * sc, 370 * sc);
  glow(ctx, D.wa, 18);
  ctx.fillStyle = D.wa;
  ctx.fillText('Perca menos.', 80 * sc, 488 * sc);
  noGlow(ctx);

  ft(ctx, sc, 36, 400); ctx.fillStyle = D.muted;
  ctx.fillText('Pipeline visual, qualificação por IA e', 80 * sc, 560 * sc);
  ctx.fillText('follow-ups automáticos integrados.', 80 * sc, 606 * sc);

  // Feature chips (3×2 grid)
  const chips = [
    { label: '🤖 AI Agents',    color: D.ai   },
    { label: '📋 Follow-ups',   color: D.wa   },
    { label: '⚡ Score BANT',   color: D.orange },
    { label: '📊 Kanban',       color: D.em   },
    { label: '🎯 Qualif. IA',   color: D.ai   },
    { label: '🔄 Pipeline',     color: D.wa   },
  ];

  const chipH = 80 * sc, chipGap = 16 * sc, startY = 680 * sc;
  const colW = (w - 160 * sc - chipGap) / 2;
  chips.forEach((chip, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const cx = 80 * sc + col * (colW + chipGap);
    const cy = startY + row * (chipH + chipGap);
    rr(ctx, cx, cy, colW, chipH, 10 * sc);
    ctx.fillStyle = rgba(chip.color, .1); ctx.fill();
    ctx.strokeStyle = rgba(chip.color, .3); ctx.lineWidth = 1;
    rr(ctx, cx, cy, colW, chipH, 10 * sc); ctx.stroke();
    ft(ctx, sc, 28, 600); ctx.fillStyle = chip.color; ctx.textAlign = 'center';
    ctx.fillText(chip.label, cx + colW / 2, cy + chipH / 2 + 10 * sc);
    ctx.textAlign = 'left';
  });

  // Pipeline stages
  const stages = ['Novo', 'Contato', 'Qualif.', 'Proposta', 'Fechado'];
  const stgW = (w - 160 * sc - (stages.length - 1) * 10 * sc) / stages.length;
  const stgY = 1030 * sc, stgH = 90 * sc;
  const colors = [D.muted3, D.em, D.wa, D.orange, '#22c55e'];
  stages.forEach((s, i) => {
    const sx = 80 * sc + i * (stgW + 10 * sc);
    rr(ctx, sx, stgY, stgW, stgH, 8 * sc);
    ctx.fillStyle = rgba(colors[i], .12); ctx.fill();
    ctx.strokeStyle = rgba(colors[i], .35); ctx.lineWidth = 1;
    rr(ctx, sx, stgY, stgW, stgH, 8 * sc); ctx.stroke();
    ft(ctx, sc, 24, 600); ctx.fillStyle = colors[i]; ctx.textAlign = 'center';
    ctx.fillText(s, sx + stgW / 2, stgY + stgH / 2 + 9 * sc);
    ctx.textAlign = 'left';
    // arrow (except last)
    if (i < stages.length - 1) {
      ft(ctx, sc, 22, 400); ctx.fillStyle = D.muted3; ctx.textAlign = 'center';
      ctx.fillText('→', sx + stgW + 5 * sc, stgY + stgH / 2 + 8 * sc);
      ctx.textAlign = 'left';
    }
  });

  // Tagline
  ctx.strokeStyle = rgba(D.wa, .15); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(80 * sc, 1200 * sc); ctx.lineTo(w - 80 * sc, 1200 * sc); ctx.stroke();

  const bullets = [
    'Campos personalizados por pipeline',
    'Histórico completo por lead',
    'Score automático com IA',
    'Webhooks e integrações nativas',
  ];
  bullets.forEach((b, i) => featureDot(ctx, 80 * sc, 1240 * sc + i * 90 * sc, b, D.wa, sc, 34, 500));

  drawFooter(ctx, w, 'crm.joaoguirunas.com · CRM PRO™ · Pipeline & Qualificação IA');
}

// ─── Card 4: OMNI PRO™ ───────────────────────────────────────────────────────
function drawOmniProCard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sc = w / 1080;
  drawBase(ctx, w, h, D.ig, 'OMNI PRO™');

  ft(ctx, sc, 22, 700); ctx.fillStyle = D.ig;
  ctx.fillText('João Guirunas —OMNI PRO™', 80 * sc, 195 * sc);

  ft(ctx, sc, 108, 900); ctx.fillStyle = D.text;
  ctx.fillText('5 canais.', 80 * sc, 370 * sc);
  glow(ctx, D.ig, 18);
  ctx.fillStyle = D.ig;
  ctx.fillText('1 inbox.', 80 * sc, 488 * sc);
  noGlow(ctx);

  ft(ctx, sc, 36, 400); ctx.fillStyle = D.muted;
  ctx.fillText('Atenda todos os canais em um só lugar.', 80 * sc, 560 * sc);
  ctx.fillText('IA responde 24/7. Você fecha.', 80 * sc, 606 * sc);

  // Channel rows
  const channels = [
    { label: 'WhatsApp',  sub: 'Oficial · Janela 24h · Template', color: D.wa  },
    { label: 'Instagram', sub: 'DM · Janela 7 dias · IA nativa',  color: D.ig  },
    { label: 'E-mail',    sub: 'SMTP/IMAP · Ilimitado · HTML',     color: D.em  },
    { label: 'SMS',       sub: 'Disparo direto · 160 chars',       color: D.sms },
    { label: 'Telefone',  sub: 'VoIP · Gravação · Follow-up',      color: D.tel },
  ];
  const rowH = 118 * sc, rowGap = 14 * sc, rowY0 = 680 * sc;
  const rowW = w - 160 * sc;
  channels.forEach((ch, i) => {
    channelRow(ctx, 80 * sc, rowY0 + i * (rowH + rowGap), rowW, rowH, ch.label, ch.sub, ch.color, sc);
  });

  // AI badge
  const bdW = 640 * sc, bdH = 80 * sc, bdX = (w - bdW) / 2, bdY = 1530 * sc;
  rr(ctx, bdX, bdY, bdW, bdH, bdH / 2);
  const g2 = ctx.createLinearGradient(bdX, 0, bdX + bdW, 0);
  g2.addColorStop(0, rgba(D.ai, .18)); g2.addColorStop(1, rgba(D.ig, .18));
  ctx.fillStyle = g2; ctx.fill();
  ctx.strokeStyle = rgba(D.ai, .4); ctx.lineWidth = 1.5;
  rr(ctx, bdX, bdY, bdW, bdH, bdH / 2); ctx.stroke();
  glow(ctx, D.ai, 10);
  ft(ctx, sc, 30, 600); ctx.fillStyle = D.ai; ctx.textAlign = 'center';
  ctx.fillText('🤖  IA 24/7 · Respostas em segundos', w / 2, bdY + bdH / 2 + 11 * sc);
  noGlow(ctx); ctx.textAlign = 'left';

  // Stats
  ft(ctx, sc, 96, 900); ctx.fillStyle = D.text; ctx.textAlign = 'center';
  ctx.fillText('1.200+', w / 2, 1700 * sc);
  ft(ctx, sc, 30, 400); ctx.fillStyle = D.muted; ctx.textAlign = 'center';
  ctx.fillText('atendimentos automatizados/mês', w / 2, 1748 * sc);
  ctx.textAlign = 'left';

  drawFooter(ctx, w, 'crm.joaoguirunas.com · OMNI PRO™ · Omnichannel & IA');
}

// ─── Card 6: Sends PRO™ ───────────────────────────────────────────────────────
function drawSendsProCard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sc = w / 1080;
  drawBase(ctx, w, h, PURPLE, 'SENDS PRO™');

  ft(ctx, sc, 22, 700); ctx.fillStyle = PURPLE;
  ctx.fillText('João Guirunas —SENDS PRO™', 80 * sc, 195 * sc);

  ft(ctx, sc, 108, 900); ctx.fillStyle = D.text;
  ctx.fillText('1 disparo.', 80 * sc, 370 * sc);
  glow(ctx, PURPLE, 18);
  ctx.fillStyle = PURPLE;
  ctx.fillText('1000 leads.', 80 * sc, 488 * sc);
  noGlow(ctx);

  ft(ctx, sc, 36, 400); ctx.fillStyle = D.muted;
  ctx.fillText('Disparos em massa multicanal com', 80 * sc, 560 * sc);
  ctx.fillText('segmentação e automação total.', 80 * sc, 606 * sc);

  // 4 channel squares
  const channels2 = [
    { icon: '💬', label: 'WhatsApp', sub: 'Template + Texto', color: D.wa  },
    { icon: '📧', label: 'E-mail',   sub: 'HTML + Texto',     color: D.em  },
    { icon: '📱', label: 'SMS',      sub: '160 chars',        color: PURPLE },
    { icon: '📞', label: 'Ligação',  sub: 'VoIP automático',  color: D.tel },
  ];
  const sqW = 440 * sc, sqH = 240 * sc, sqGap = 20 * sc, sqY0 = 680 * sc;
  channels2.forEach((ch, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const sx = 80 * sc + col * (sqW + sqGap);
    const sy = sqY0 + row * (sqH + sqGap);
    rr(ctx, sx, sy, sqW, sqH, 14 * sc);
    ctx.fillStyle = rgba(ch.color, .09); ctx.fill();
    ctx.strokeStyle = rgba(ch.color, .28); ctx.lineWidth = 1.5;
    rr(ctx, sx, sy, sqW, sqH, 14 * sc); ctx.stroke();
    ft(ctx, sc, 56, 400); ctx.fillStyle = D.text; ctx.textAlign = 'center';
    ctx.fillText(ch.icon, sx + sqW / 2, sy + 90 * sc);
    ft(ctx, sc, 32, 700); ctx.fillStyle = ch.color; ctx.textAlign = 'center';
    ctx.fillText(ch.label, sx + sqW / 2, sy + 148 * sc);
    ft(ctx, sc, 24, 400); ctx.fillStyle = D.muted; ctx.textAlign = 'center';
    ctx.fillText(ch.sub, sx + sqW / 2, sy + 184 * sc);
    ctx.textAlign = 'left';
  });

  // Stats row
  ctx.strokeStyle = rgba(PURPLE, .15); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(80 * sc, 1250 * sc); ctx.lineTo(w - 80 * sc, 1250 * sc); ctx.stroke();

  const stats = [
    { val: '98%',    lbl: 'entrega',  color: D.wa    },
    { val: '< 2s',   lbl: 'envio',    color: PURPLE  },
    { val: 'ilimit.', lbl: 'contatos', color: D.orange },
  ];
  const stW = (w - 160 * sc) / 3;
  stats.forEach((st2, i) => {
    const sx = 80 * sc + i * stW;
    glow(ctx, st2.color, 10);
    ft(ctx, sc, 68, 900); ctx.fillStyle = st2.color; ctx.textAlign = 'center';
    ctx.fillText(st2.val, sx + stW / 2, 1370 * sc);
    noGlow(ctx);
    ft(ctx, sc, 26, 400); ctx.fillStyle = D.muted; ctx.textAlign = 'center';
    ctx.fillText(st2.lbl, sx + stW / 2, 1414 * sc);
    ctx.textAlign = 'left';
  });

  // Feature list
  const sendsFeatures = [
    'Segmentação por status, canal, score',
    'Templates aprovados (WA + Email)',
    'Relatório de entrega em tempo real',
    'Webhook de retorno automático',
  ];
  sendsFeatures.forEach((f, i) => featureDot(ctx, 80 * sc, 1480 * sc + i * 80 * sc, f, PURPLE, sc, 32, 500));

  drawFooter(ctx, w, 'crm.joaoguirunas.com · SENDS PRO™ · Disparos Multicanal');
}

// ─── Card 7: Schedule PRO™ ────────────────────────────────────────────────────
function drawScheduleProCard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sc = w / 1080;
  drawBase(ctx, w, h, CYAN, 'SCHEDULE PRO™');

  ft(ctx, sc, 22, 700); ctx.fillStyle = CYAN;
  ctx.fillText('João Guirunas —SCHEDULE PRO™', 80 * sc, 195 * sc);

  ft(ctx, sc, 108, 900); ctx.fillStyle = D.text;
  ctx.fillText('Reuniões', 80 * sc, 360 * sc);
  glow(ctx, CYAN, 18);
  ctx.fillStyle = CYAN;
  ctx.fillText('sem esforço.', 80 * sc, 478 * sc);
  noGlow(ctx);

  ft(ctx, sc, 36, 400); ctx.fillStyle = D.muted;
  ctx.fillText('Booking inteligente com Google Calendar,', 80 * sc, 550 * sc);
  ctx.fillText('equipes e qualificação automática.', 80 * sc, 596 * sc);

  // Calendar mini visual
  const calX = 80 * sc, calY = 666 * sc;
  const calW = w - 160 * sc, calH = 520 * sc;
  rr(ctx, calX, calY, calW, calH, 16 * sc);
  ctx.fillStyle = rgba(CYAN, .06); ctx.fill();
  ctx.strokeStyle = rgba(CYAN, .22); ctx.lineWidth = 1.5;
  rr(ctx, calX, calY, calW, calH, 16 * sc); ctx.stroke();

  // Calendar header
  ft(ctx, sc, 28, 600); ctx.fillStyle = CYAN; ctx.textAlign = 'center';
  ctx.fillText('Março  2026', calX + calW / 2, calY + 48 * sc);
  ctx.textAlign = 'left';

  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const cellSz = (calW - 32 * sc) / 7;
  days.forEach((d, i) => {
    ft(ctx, sc, 22, 600); ctx.fillStyle = D.muted2; ctx.textAlign = 'center';
    ctx.fillText(d, calX + 16 * sc + i * cellSz + cellSz / 2, calY + 90 * sc);
    ctx.textAlign = 'left';
  });

  // Cal divider
  ctx.strokeStyle = rgba(CYAN, .12); ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(calX + 16 * sc, calY + 102 * sc);
  ctx.lineTo(calX + calW - 16 * sc, calY + 102 * sc);
  ctx.stroke();

  // Days grid (5 rows, 7 cols, start on Sunday=2 for March 2026)
  const numbers = [
    [0,  0,  0,  0,  0,  0,  1 ],
    [2,  3,  4,  5,  6,  7,  8 ],
    [9,  10, 11, 12, 13, 14, 15],
    [16, 17, 18, 19, 20, 21, 22],
    [23, 24, 25, 26, 27, 28, 29],
  ];
  const booked = new Set([10, 13, 17, 20, 24, 27]);
  const today = 10;
  numbers.forEach((row, ri) => {
    row.forEach((d, ci) => {
      if (d === 0) return;
      const nx = calX + 16 * sc + ci * cellSz + cellSz / 2;
      const ny = calY + 130 * sc + ri * 70 * sc;
      if (d === today) {
        ctx.beginPath(); ctx.arc(nx, ny - 12 * sc, 22 * sc, 0, Math.PI * 2);
        ctx.fillStyle = CYAN; ctx.fill();
        ft(ctx, sc, 24, 700); ctx.fillStyle = '#000'; ctx.textAlign = 'center';
      } else if (booked.has(d)) {
        ctx.beginPath(); ctx.arc(nx, ny - 12 * sc, 20 * sc, 0, Math.PI * 2);
        ctx.fillStyle = rgba(CYAN, .18); ctx.fill();
        ctx.beginPath(); ctx.arc(nx, ny - 12 * sc, 20 * sc, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(CYAN, .4); ctx.lineWidth = 1; ctx.stroke();
        ft(ctx, sc, 22, 600); ctx.fillStyle = CYAN; ctx.textAlign = 'center';
      } else {
        ft(ctx, sc, 22, 400); ctx.fillStyle = d < today ? D.muted3 : D.muted; ctx.textAlign = 'center';
      }
      ctx.fillText(String(d), nx, ny);
      ctx.textAlign = 'left';
    });
  });

  // Feature list below calendar
  ctx.strokeStyle = rgba(CYAN, .12); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(80 * sc, 1260 * sc); ctx.lineTo(w - 80 * sc, 1260 * sc); ctx.stroke();

  const schedFeatures = [
    'Booking público sem fricção',
    'Sincronização Google Calendar',
    'Microsoft Teams nativo',
    'Rodízio de equipe inteligente',
    'Qualificação automática pré-reunião',
  ];
  schedFeatures.forEach((f, i) => featureDot(ctx, 80 * sc, 1300 * sc + i * 86 * sc, f, CYAN, sc, 34, 500));

  drawFooter(ctx, w, 'crm.joaoguirunas.com · SCHEDULE PRO™ · Booking Inteligente');
}

// ─── Card 8: Form PRO™ ────────────────────────────────────────────────────────
function drawFormProCard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sc = w / 1080;
  drawBase(ctx, w, h, AMBER, 'FORM PRO™');

  ft(ctx, sc, 22, 700); ctx.fillStyle = AMBER;
  ctx.fillText('João Guirunas —FORM PRO™', 80 * sc, 195 * sc);

  ft(ctx, sc, 96, 900); ctx.fillStyle = D.text;
  ctx.fillText('Landing pages', 80 * sc, 360 * sc);
  glow(ctx, AMBER, 18);
  ctx.fillStyle = AMBER;
  ctx.fillText('que convertem.', 80 * sc, 466 * sc);
  noGlow(ctx);

  ft(ctx, sc, 36, 400); ctx.fillStyle = D.muted;
  ctx.fillText('Builder visual com 22 blocos prontos,', 80 * sc, 538 * sc);
  ctx.fillText('A/B Testing e analytics completos.', 80 * sc, 584 * sc);

  // Stat badges row
  const badges = [
    { val: '22', lbl: 'Blocos', color: AMBER   },
    { val: 'A/B', lbl: 'Testing', color: D.orange },
    { val: '10', lbl: 'Layouts', color: D.em   },
    { val: '12', lbl: 'Temas', color: D.wa    },
  ];
  const bsW = (w - 160 * sc - 3 * 16 * sc) / 4, bsH = 140 * sc, bsY = 650 * sc;
  badges.forEach((b, i) => {
    const bx = 80 * sc + i * (bsW + 16 * sc);
    rr(ctx, bx, bsY, bsW, bsH, 12 * sc);
    ctx.fillStyle = rgba(b.color, .09); ctx.fill();
    ctx.strokeStyle = rgba(b.color, .28); ctx.lineWidth = 1;
    rr(ctx, bx, bsY, bsW, bsH, 12 * sc); ctx.stroke();
    glow(ctx, b.color, 10);
    ft(ctx, sc, 52, 900); ctx.fillStyle = b.color; ctx.textAlign = 'center';
    ctx.fillText(b.val, bx + bsW / 2, bsY + 78 * sc);
    noGlow(ctx);
    ft(ctx, sc, 24, 400); ctx.fillStyle = D.muted; ctx.textAlign = 'center';
    ctx.fillText(b.lbl, bx + bsW / 2, bsY + 116 * sc);
    ctx.textAlign = 'left';
  });

  // Mini LP preview
  const lpX = 80 * sc, lpY = 870 * sc, lpW = w - 160 * sc, lpH = 460 * sc;
  rr(ctx, lpX, lpY, lpW, lpH, 14 * sc);
  ctx.fillStyle = rgba(AMBER, .06); ctx.fill();
  ctx.strokeStyle = rgba(AMBER, .2); ctx.lineWidth = 1.5;
  rr(ctx, lpX, lpY, lpW, lpH, 14 * sc); ctx.stroke();

  // Hero block
  const hBH = 100 * sc;
  rr(ctx, lpX + 16 * sc, lpY + 16 * sc, lpW - 32 * sc, hBH, 8 * sc);
  const hg = ctx.createLinearGradient(lpX + 16 * sc, 0, lpX + lpW - 16 * sc, 0);
  hg.addColorStop(0, rgba(AMBER, .2)); hg.addColorStop(1, rgba(D.orange, .1));
  ctx.fillStyle = hg; ctx.fill();
  ft(ctx, sc, 24, 700); ctx.fillStyle = AMBER; ctx.textAlign = 'center';
  ctx.fillText('Hero Section', lpX + lpW / 2, lpY + 76 * sc);
  ctx.textAlign = 'left';

  // Feature blocks row
  const fbW = (lpW - 32 * sc - 2 * 8 * sc) / 3, fbH = 80 * sc, fbY2 = lpY + 136 * sc;
  const fbColors = [D.em, D.wa, D.orange];
  ['Features', 'Benefícios', 'Prova'].forEach((lbl, i) => {
    const fbx = lpX + 16 * sc + i * (fbW + 8 * sc);
    rr(ctx, fbx, fbY2, fbW, fbH, 6 * sc);
    ctx.fillStyle = rgba(fbColors[i], .12); ctx.fill();
    ft(ctx, sc, 20, 600); ctx.fillStyle = fbColors[i]; ctx.textAlign = 'center';
    ctx.fillText(lbl, fbx + fbW / 2, fbY2 + fbH / 2 + 8 * sc);
    ctx.textAlign = 'left';
  });

  // CTA block
  const ctaW = lpW - 32 * sc, ctaH = 70 * sc, ctaY2 = fbY2 + fbH + 8 * sc;
  rr(ctx, lpX + 16 * sc, ctaY2, ctaW, ctaH, 8 * sc);
  ctx.fillStyle = rgba(AMBER, .22); ctx.fill();
  ft(ctx, sc, 26, 700); ctx.fillStyle = '#000'; ctx.textAlign = 'center';
  // Draw with amber background then dark text
  rr(ctx, lpX + 16 * sc, ctaY2, ctaW, ctaH, 8 * sc);
  ctx.fillStyle = rgba(AMBER, .9); ctx.fill();
  ft(ctx, sc, 26, 700); ctx.fillStyle = '#000'; ctx.textAlign = 'center';
  ctx.fillText('QUERO COMEÇAR →', lpX + lpW / 2, ctaY2 + ctaH / 2 + 10 * sc);
  ctx.textAlign = 'left';

  // Form section
  const fsY = ctaY2 + ctaH + 10 * sc;
  rr(ctx, lpX + 16 * sc, fsY, ctaW, 90 * sc, 6 * sc);
  ctx.fillStyle = rgba(D.text, .04); ctx.fill();
  ctx.strokeStyle = rgba(D.text, .1); ctx.lineWidth = 1;
  rr(ctx, lpX + 16 * sc, fsY, ctaW, 90 * sc, 6 * sc); ctx.stroke();
  ft(ctx, sc, 20, 400); ctx.fillStyle = D.muted3; ctx.textAlign = 'center';
  ctx.fillText('Form  ·  Score automático  ·  CRM', lpX + lpW / 2, fsY + 55 * sc);
  ctx.textAlign = 'left';

  // Features below
  ctx.strokeStyle = rgba(AMBER, .12); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(80 * sc, 1410 * sc); ctx.lineTo(w - 80 * sc, 1410 * sc); ctx.stroke();

  const formFeatures = [
    'Builder visual drag & drop',
    'SEO integrado por página',
    'Score automático no submit',
    'Analytics e métricas de conversão',
    'Integração direta ao CRM PRO™',
  ];
  formFeatures.forEach((f, i) => featureDot(ctx, 80 * sc, 1450 * sc + i * 78 * sc, f, AMBER, sc, 32, 500));

  drawFooter(ctx, w, 'crm.joaoguirunas.com · FORM PRO™ · Builder & Conversão');
}

// ─── Module card registry ─────────────────────────────────────────────────────
// eslint-disable-next-line react-refresh/only-export-components
export const REV_CARDS = [
  { id: 'jg',           name: 'João Guirunas', icon: '🏆', color: D.orange, draw: drawOraCard        },
  { id: 'bi-pro',       name: 'BI PRO™',         icon: '📊', color: D.em,    draw: drawBIProCard         },
  { id: 'crm-pro',      name: 'CRM PRO™',        icon: '🎯', color: D.wa,    draw: drawCRMProCard        },
  { id: 'omni-pro',     name: 'OMNI PRO™',       icon: '💬', color: D.ig,    draw: drawOmniProCard       },
  { id: 'sends-pro',    name: 'Sends PRO™',       icon: '📨', color: PURPLE,  draw: drawSendsProCard      },
  { id: 'schedule-pro', name: 'Schedule PRO™',    icon: '📅', color: CYAN,    draw: drawScheduleProCard   },
  { id: 'form-pro',     name: 'Form PRO™',        icon: '🏗️', color: AMBER,   draw: drawFormProCard       },
] as const;

// ─── ModuleCardPreview component ─────────────────────────────────────────────
interface ModuleCardPreviewProps {
  card: typeof REV_CARDS[number];
}

export function ModuleCardPreview({ card }: ModuleCardPreviewProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    card.draw(ctx, c.width, c.height);
  }, [card]);

  const downloadPng = useCallback(() => {
    const c = ref.current; if (!c) return;
    const a = document.createElement('a');
    a.download = `joaoguirunas-${card.id}.png`;
    a.href = c.toDataURL('image/png', 1.0);
    a.click();
  }, [card]);

  const downloadSvg = useCallback(() => {
    const c = ref.current; if (!c) return;
    const dataUrl = c.toDataURL('image/png', 1.0);
    const svg = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"',
      '     width="1080" height="1920" viewBox="0 0 1080 1920">',
      `  <image width="1080" height="1920" href="${dataUrl}"/>`,
      '</svg>',
    ].join('\n');
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `joaoguirunas-${card.id}.svg`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  }, [card]);

  return (
    <div className="flex flex-col gap-2 group">
      {/* Card preview */}
      <div
        className="relative rounded-[8px] overflow-hidden border border-border"
        style={{ aspectRatio: '9/16' }}
      >
        <canvas
          ref={ref}
          width={1080}
          height={1920}
          className="w-full h-full"
          style={{ imageRendering: 'auto', display: 'block' }}
        />
        {/* Hover overlay */}
        <div
          className="absolute inset-0 flex items-end justify-center pb-3 gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'linear-gradient(transparent 60%, rgba(0,0,0,0.8))' }}
        >
          <Button
            size="sm"
            variant="outline"
            className="h-[30px] text-[10px] px-2 gap-1 bg-black/60 border-white/20 text-white hover:bg-black/80"
            onClick={downloadPng}
          >
            <Download className="w-3 h-3" />
            PNG
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-[30px] text-[10px] px-2 gap-1 bg-black/60 border-white/20 text-white hover:bg-black/80"
            onClick={downloadSvg}
          >
            <Download className="w-3 h-3" />
            SVG
          </Button>
        </div>
      </div>
      {/* Meta */}
      <div className="flex items-center gap-1.5 px-0.5">
        <span className="text-sm leading-none">{card.icon}</span>
        <div>
          <p className="text-[11px] font-semibold text-foreground leading-none">{card.name}</p>
          <p className="text-[10px] text-muted-foreground/45 leading-none mt-0.5">1080×1920 · PNG + SVG</p>
        </div>
        <div
          className="ml-auto w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: card.color }}
        />
      </div>
    </div>
  );
}
