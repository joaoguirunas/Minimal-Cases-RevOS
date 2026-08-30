/**
 * OmniProAssets v5 — 6 Instagram Story cards (5 story arc + 1 brand) + animated video
 * Canvas-rendered, matching exact dark-mode Omni PRO UI (zinc palette, hsl 220 13%).
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Download, Play, Pause, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Design tokens (dark mode hsl 220 13% values) ────────────────────────────
const D = {
  bg:     '#000000',   // pure black
  surf:   '#1a1a22',   // hsl(220,13%,11%)
  surf2:  '#212130',   // hsl(220,13%,14%)
  surf3:  '#27273a',   // zinc-800 equiv (message bubbles)
  border: '#2e2e3e',   // hsl(220,13%,20%)
  text:   '#fafafa',   // zinc-50
  muted:  '#a1a1aa',   // zinc-400
  muted2: '#71717a',   // zinc-500
  muted3: '#52525b',   // zinc-600
  orange: '#FF4A00',
  wa:     '#22c55e',
  ig:     '#ec4899',
  em:     '#3b82f6',
  sms:    '#8b5cf6',
  tel:    '#f97316',
  ai:     '#a78bfa',
};

const CH = [
  { id: 'whatsapp',  label: 'WA',      full: 'WhatsApp',  color: D.wa  },
  { id: 'instagram', label: 'IG',      full: 'Instagram', color: D.ig  },
  { id: 'email',     label: 'Email',   full: 'E-mail',    color: D.em  },
  { id: 'sms',       label: 'SMS',     full: 'SMS',       color: D.sms },
  { id: 'telefone',  label: 'Chamada', full: 'Telefone',  color: D.tel },
];

// ─── Canvas primitives ────────────────────────────────────────────────────────
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function bubble(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, dir: 'in' | 'out' | 'ai') {
  const tl = r, tr = r;
  const bl = dir === 'in' ? 4 : r;
  const br = (dir === 'out' || dir === 'ai') ? 4 : r;
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.arcTo(x + w, y, x + w, y + tr, tr);
  ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  ctx.lineTo(x + bl, y + h);
  ctx.arcTo(x, y + h, x, y + h - bl, bl);
  ctx.arcTo(x, y, x + tl, y, tl);
  ctx.closePath();
}

function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function ft(ctx: CanvasRenderingContext2D, sc: number, size: number, wt = 400) {
  ctx.font = `${wt} ${Math.round(size * sc)}px Inter,-apple-system,"Helvetica Neue",sans-serif`;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW) { if (cur) lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

function glow(ctx: CanvasRenderingContext2D, color: string, blur: number) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
function noGlow(ctx: CanvasRenderingContext2D) { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }

// ─── Shared layout ────────────────────────────────────────────────────────────
function drawBase(ctx: CanvasRenderingContext2D, w: number, h: number, accent = D.orange) {
  const sc = w / 1080;
  ctx.fillStyle = D.bg; ctx.fillRect(0, 0, w, h);

  // Ambient glow top
  const g = ctx.createRadialGradient(w * .5, 0, 0, w * .5, 0, w * .85);
  g.addColorStop(0, rgba(accent, .07));
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h * .55);

  // Top bar
  ctx.fillStyle = accent; ctx.fillRect(0, 0, w, 5 * sc);

  ft(ctx, sc, 19, 600); ctx.fillStyle = D.muted3; ctx.textAlign = 'left';
  ctx.fillText('GROWTHSALES', 80 * sc, 118 * sc);
  ft(ctx, sc, 19, 400); ctx.fillStyle = D.muted3; ctx.textAlign = 'right';
  ctx.fillText('OMNI PRO™', w - 80 * sc, 118 * sc);
  ctx.textAlign = 'left';
}

function drawFooter(ctx: CanvasRenderingContext2D, w: number, sub: string) {
  const sc = w / 1080;
  ctx.strokeStyle = D.border; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(80 * sc, 1812 * sc); ctx.lineTo(w - 80 * sc, 1812 * sc); ctx.stroke();
  ft(ctx, sc, 22, 400); ctx.fillStyle = D.muted3; ctx.textAlign = 'center';
  ctx.fillText(sub, w / 2, 1868 * sc); ctx.textAlign = 'left';
}

// ─── UI atoms ─────────────────────────────────────────────────────────────────
function pill(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, color: string, sc: number, active = false): number {
  ft(ctx, sc, 25, 600);
  const tw = ctx.measureText(label).width;
  const pw = tw + 62 * sc, ph = 62 * sc, pr = ph / 2;
  rr(ctx, x, y, pw, ph, pr);
  ctx.fillStyle = rgba(color, active ? .2 : .1); ctx.fill();
  ctx.strokeStyle = rgba(color, active ? .6 : .28); ctx.lineWidth = 1.5;
  rr(ctx, x, y, pw, ph, pr); ctx.stroke();
  ctx.beginPath(); ctx.arc(x + 22 * sc, y + ph / 2, 7 * sc, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
  ft(ctx, sc, 25, 600); ctx.fillStyle = active ? color : rgba(color, .85);
  ctx.fillText(label, x + 38 * sc, y + ph / 2 + 9 * sc);
  return pw + 10 * sc;
}

function badge(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, sc: number) {
  ft(ctx, sc, 19, 600);
  const tw = ctx.measureText(text).width;
  const bw = tw + 22 * sc, bh = 30 * sc;
  rr(ctx, x, y, bw, bh, 4 * sc);
  ctx.fillStyle = rgba(color, .15); ctx.fill();
  ctx.fillStyle = color; ctx.textAlign = 'center';
  ctx.fillText(text, x + bw / 2, y + bh / 2 + 7 * sc);
  ctx.textAlign = 'left';
  return bw + 8 * sc;
}

function score(ctx: CanvasRenderingContext2D, x: number, y: number, val: number, sc: number) {
  ctx.beginPath(); ctx.arc(x, y, 25 * sc, 0, Math.PI * 2);
  ctx.fillStyle = rgba(D.orange, .9); ctx.fill();
  ft(ctx, sc, 19, 700); ctx.fillStyle = D.text; ctx.textAlign = 'center';
  ctx.fillText(String(val), x, y + 7 * sc); ctx.textAlign = 'left';
}

function contactRow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number,
  init: string, name: string, preview: string, time: string,
  ch: typeof CH[0], active: boolean, val: number | null, ai: boolean, sc: number) {
  const H = 106 * sc, av = 48 * sc;
  if (active) {
    ctx.fillStyle = rgba(D.orange, .07); ctx.fillRect(x, y, w, H);
    ctx.fillStyle = D.orange; ctx.fillRect(x, y + 8 * sc, 3 * sc, H - 16 * sc);
  }
  // Avatar
  const ax = x + 20 * sc + av / 2, ay = y + H / 2;
  ctx.beginPath(); ctx.arc(ax, ay, av / 2, 0, Math.PI * 2);
  ctx.fillStyle = active ? rgba(D.orange, .2) : D.surf2; ctx.fill();
  ft(ctx, sc, 20, 700); ctx.fillStyle = active ? D.orange : D.muted;
  ctx.textAlign = 'center'; ctx.fillText(init, ax, ay + 8 * sc); ctx.textAlign = 'left';

  const tx = x + 20 * sc + av + 14 * sc;
  ft(ctx, sc, 26, 600); ctx.fillStyle = D.text; ctx.fillText(name, tx, y + 38 * sc);
  ft(ctx, sc, 22, 400); ctx.fillStyle = D.muted;
  const pre = wrap(ctx, preview, w - tx - 110 * sc);
  ctx.fillText(pre[0] || '', tx, y + 66 * sc);

  ft(ctx, sc, 20, 400); ctx.fillStyle = D.muted2; ctx.textAlign = 'right';
  ctx.fillText(time, x + w - 18 * sc, y + 38 * sc); ctx.textAlign = 'left';

  let bx = x + w - 18 * sc;
  if (ai) { bx -= badge(ctx, bx - (ctx.measureText('IA ativa').width + 22 * sc) - 0, y + 60 * sc, 'IA ativa', D.ai, sc); }
  ft(ctx, sc, 19, 600);
  const cw = ctx.measureText(ch.label).width + 22 * sc, ch2 = 30 * sc;
  rr(ctx, bx - cw - 8 * sc, y + 60 * sc, cw, ch2, 4 * sc);
  ctx.fillStyle = rgba(ch.color, .15); ctx.fill();
  ctx.fillStyle = ch.color; ctx.textAlign = 'center';
  ctx.fillText(ch.label, bx - cw / 2 - 8 * sc, y + 75 * sc); ctx.textAlign = 'left';

  if (val) score(ctx, x + w - 190 * sc, y + 38 * sc, val, sc);
}

function msgIn(ctx: CanvasRenderingContext2D, x: number, y: number, maxW: number,
  text: string, time: string, ch: typeof CH[0], sc: number): number {
  ft(ctx, sc, 27, 400);
  const lines = wrap(ctx, text, maxW - 48 * sc);
  const lh = 40 * sc, pad = 22 * sc;
  const bw = Math.min(maxW, lines.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0) + pad * 2);
  const bh = lines.length * lh + pad + 32 * sc;
  bubble(ctx, x, y, bw, bh, 14 * sc, 'in');
  ctx.fillStyle = D.surf3; ctx.fill();
  lines.forEach((l, i) => { ft(ctx, sc, 27, 400); ctx.fillStyle = D.text; ctx.fillText(l, x + pad, y + pad + 2 * sc + i * lh); });
  ctx.beginPath(); ctx.arc(x + pad, y + bh - 12 * sc, 4 * sc, 0, Math.PI * 2);
  ctx.fillStyle = ch.color; ctx.fill();
  ft(ctx, sc, 19, 400); ctx.fillStyle = D.muted2;
  ctx.fillText(time, x + pad + 10 * sc, y + bh - 7 * sc);
  return bh + 10 * sc;
}

function msgAI(ctx: CanvasRenderingContext2D, x: number, y: number, maxW: number,
  text: string, time: string, sc: number): number {
  ft(ctx, sc, 27, 400);
  const lines = wrap(ctx, text, maxW - 52 * sc);
  const lh = 40 * sc, pad = 22 * sc;
  const bw = Math.min(maxW, lines.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0) + pad * 2);
  const bh = lines.length * lh + pad + 54 * sc;
  bubble(ctx, x, y, bw, bh, 14 * sc, 'ai');
  ctx.fillStyle = D.surf3; ctx.fill();
  ctx.fillStyle = D.ai; ctx.fillRect(x, y, 4 * sc, bh);
  glow(ctx, D.ai, 8); ft(ctx, sc, 19, 700); ctx.fillStyle = D.ai;
  ctx.fillText('IA', x + pad + 4 * sc, y + 26 * sc); noGlow(ctx);
  lines.forEach((l, i) => { ft(ctx, sc, 27, 400); ctx.fillStyle = D.text; ctx.fillText(l, x + pad + 4 * sc, y + 50 * sc + i * lh); });
  ft(ctx, sc, 19, 400); ctx.fillStyle = rgba(D.ai, .7);
  ctx.fillText(`${time} ✓✓`, x + pad + 4 * sc, y + bh - 10 * sc);
  return bh + 10 * sc;
}

function msgOut(ctx: CanvasRenderingContext2D, cw: number, y: number, maxW: number,
  text: string, time: string, sc: number): number {
  ft(ctx, sc, 27, 400);
  const lines = wrap(ctx, text, maxW - 48 * sc);
  const lh = 40 * sc, pad = 22 * sc;
  const bw = Math.min(maxW, lines.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0) + pad * 2);
  const bh = lines.length * lh + pad + 32 * sc;
  const bx = cw - 80 * sc - bw;
  bubble(ctx, bx, y, bw, bh, 14 * sc, 'out');
  ctx.fillStyle = D.surf2; ctx.fill();
  lines.forEach((l, i) => { ft(ctx, sc, 27, 400); ctx.fillStyle = D.text; ctx.fillText(l, bx + pad, y + pad + 2 * sc + i * lh); });
  ft(ctx, sc, 19, 400); ctx.fillStyle = D.muted2; ctx.textAlign = 'right';
  ctx.fillText(`${time} ✓✓`, bx + bw - pad, y + bh - 7 * sc); ctx.textAlign = 'left';
  return bh + 10 * sc;
}

function kpi(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  val: string, label: string, hint: string, color: string, sc: number) {
  rr(ctx, x, y, w, h, 14 * sc); ctx.fillStyle = D.surf; ctx.fill();
  ctx.strokeStyle = D.border; ctx.lineWidth = 1; rr(ctx, x, y, w, h, 14 * sc); ctx.stroke();
  rr(ctx, x, y, 4 * sc, h, 3 * sc); ctx.fillStyle = color; ctx.fill();
  glow(ctx, color, 12); ft(ctx, sc, 60, 800); ctx.fillStyle = color; ctx.textAlign = 'center';
  ctx.fillText(val, x + w / 2, y + h * .53); noGlow(ctx);
  ft(ctx, sc, 23, 400); ctx.fillStyle = D.muted; ctx.fillText(label, x + w / 2, y + h * .73);
  ft(ctx, sc, 21, 400); ctx.fillStyle = rgba(color, .8); ctx.fillText(hint, x + w / 2, y + h * .9);
  ctx.textAlign = 'left';
}

// ─── Carousel dots ────────────────────────────────────────────────────────────
function drawDots(ctx: CanvasRenderingContext2D, w: number, total: number, current: number, sc: number) {
  const r = 8 * sc, gap = 20 * sc;
  const totalW = total * r * 2 + (total - 1) * gap;
  let x = (w - totalW) / 2 + r;
  for (let i = 0; i < total; i++) {
    ctx.beginPath(); ctx.arc(x, 1770 * sc, r, 0, Math.PI * 2);
    ctx.fillStyle = i === current ? '#FF4A00' : 'rgba(255,255,255,0.2)'; ctx.fill();
    x += r * 2 + gap;
  }
}

// ─── Card 1 — O Problema (Hook) ───────────────────────────────────────────────
function drawCard1(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sc = w / 1080;
  drawBase(ctx, w, h, D.orange);

  // Eyebrow
  ft(ctx, sc, 22, 700); ctx.fillStyle = D.orange;
  ctx.fillText('O PROBLEMA', 80 * sc, 195 * sc);

  // Hero headline
  ft(ctx, sc, 108, 800); ctx.fillStyle = D.text;
  ctx.fillText('Quantos', 80 * sc, 400 * sc);
  ctx.fillText('leads você', 80 * sc, 520 * sc);
  ctx.fillStyle = D.orange;
  ctx.fillText('perdeu hoje?', 80 * sc, 640 * sc);

  ft(ctx, sc, 36, 400); ctx.fillStyle = D.muted;
  ctx.fillText('Enquanto você dorme, leads entram.', 80 * sc, 720 * sc);
  ctx.fillText('Ninguém responde. Eles vão embora.', 80 * sc, 766 * sc);

  // Missed messages panel
  const py = 820 * sc;
  rr(ctx, 80 * sc, py, 920 * sc, 56 * sc, 10 * sc);
  ctx.fillStyle = D.surf2; ctx.fill();
  ft(ctx, sc, 22, 600); ctx.fillStyle = D.muted3;
  ctx.fillText('Inbox das últimas 8 horas — sem resposta', 112 * sc, py + 36 * sc);

  const missed = [
    { ch: CH[0], count: 18, label: 'WhatsApp' },
    { ch: CH[1], count: 12, label: 'Instagram' },
    { ch: CH[2], count: 17, label: 'E-mail' },
    { ch: CH[3], count:  9, label: 'SMS' },
    { ch: CH[4], count:  6, label: 'Telefone' },
  ];
  let ry = py + 60 * sc;
  missed.forEach((m, i) => {
    const rowH = 96 * sc;
    rr(ctx, 80 * sc, ry, 920 * sc, rowH, 0);
    ctx.fillStyle = i % 2 === 0 ? D.surf : rgba(D.surf2, .6); ctx.fill();

    ctx.beginPath(); ctx.arc(112 * sc, ry + rowH / 2, 9 * sc, 0, Math.PI * 2);
    ctx.fillStyle = m.ch.color; ctx.fill();

    ft(ctx, sc, 28, 600); ctx.fillStyle = D.text;
    ctx.fillText(m.label, 132 * sc, ry + rowH / 2 + 10 * sc);

    // red badge
    const badgeW = 110 * sc, badgeH = 44 * sc;
    rr(ctx, 800 * sc, ry + (rowH - badgeH) / 2, badgeW, badgeH, badgeH / 2);
    ctx.fillStyle = 'rgba(239,68,68,.18)'; ctx.fill();
    ctx.strokeStyle = 'rgba(239,68,68,.45)'; ctx.lineWidth = 1;
    rr(ctx, 800 * sc, ry + (rowH - badgeH) / 2, badgeW, badgeH, badgeH / 2); ctx.stroke();
    ft(ctx, sc, 26, 700); ctx.fillStyle = '#ef4444'; ctx.textAlign = 'center';
    ctx.fillText(`${m.count} sem resp`, 855 * sc, ry + rowH / 2 + 9 * sc); ctx.textAlign = 'left';

    if (i < missed.length - 1) {
      ctx.strokeStyle = rgba(D.border, .5); ctx.lineWidth = .5;
      ctx.beginPath(); ctx.moveTo(112 * sc, ry + rowH); ctx.lineTo(968 * sc, ry + rowH); ctx.stroke();
    }
    ry += rowH;
  });

  // Total missed callout
  const ty = ry + 16 * sc;
  rr(ctx, 80 * sc, ty, 920 * sc, 90 * sc, 12 * sc);
  ctx.fillStyle = rgba('#ef4444', .1); ctx.fill();
  ctx.strokeStyle = rgba('#ef4444', .3); ctx.lineWidth = 1.5;
  rr(ctx, 80 * sc, ty, 920 * sc, 90 * sc, 12 * sc); ctx.stroke();
  glow(ctx, '#ef4444', 10);
  ft(ctx, sc, 34, 700); ctx.fillStyle = '#ef4444'; ctx.textAlign = 'center';
  ctx.fillText('62 leads sem resposta nas últimas 8h', w / 2, ty + 56 * sc);
  noGlow(ctx); ctx.textAlign = 'left';

  drawDots(ctx, w, 5, 0, sc);
  drawFooter(ctx, w, 'growthsales.ai · Omni PRO™ · 1 de 5');
}

// ─── Card 2 — A Dor ($) ───────────────────────────────────────────────────────
function drawCard2(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sc = w / 1080;
  drawBase(ctx, w, h, '#ef4444');

  ft(ctx, sc, 22, 700); ctx.fillStyle = '#ef4444';
  ctx.fillText('O CUSTO DO SILÊNCIO', 80 * sc, 195 * sc);

  ft(ctx, sc, 108, 800); ctx.fillStyle = D.text;
  ctx.fillText('Cada lead', 80 * sc, 400 * sc);
  ctx.fillText('perdido =', 80 * sc, 520 * sc);
  ctx.fillStyle = '#ef4444';
  ctx.fillText('dinheiro fora.', 80 * sc, 640 * sc);

  ft(ctx, sc, 34, 400); ctx.fillStyle = D.muted;
  ctx.fillText('Ticket médio R$800 · 40 leads/semana', 80 * sc, 714 * sc);
  ctx.fillText('sem resposta = prejuízo de R$32k/semana.', 80 * sc, 758 * sc);

  // Timeline of loss
  const steps = [
    { t: '0s',    label: 'Lead chega',         icon: '📩', color: D.wa },
    { t: '2h',    label: 'Sem resposta',        icon: '⏳', color: D.muted2 },
    { t: '4h',    label: 'Lead esfria',         icon: '🧊', color: D.em },
    { t: '24h',   label: 'Lead foi embora',     icon: '❌', color: '#ef4444' },
  ];

  let tx = 80 * sc;
  const stepW = 210 * sc, stepH = 200 * sc, ty2 = 810 * sc;
  steps.forEach((s, i) => {
    rr(ctx, tx, ty2, stepW, stepH, 14 * sc);
    ctx.fillStyle = D.surf; ctx.fill();
    ctx.strokeStyle = i === 3 ? rgba('#ef4444', .5) : D.border; ctx.lineWidth = i === 3 ? 1.5 : 1;
    rr(ctx, tx, ty2, stepW, stepH, 14 * sc); ctx.stroke();

    // top color bar
    rr(ctx, tx, ty2, stepW, 4 * sc, 3 * sc); ctx.fillStyle = s.color; ctx.fill();

    ft(ctx, sc, 40, 400); ctx.fillStyle = D.text; ctx.textAlign = 'center';
    ctx.fillText(s.icon, tx + stepW / 2, ty2 + 80 * sc);

    ft(ctx, sc, 22, 700); ctx.fillStyle = s.color;
    ctx.fillText(s.t, tx + stepW / 2, ty2 + 122 * sc);
    ft(ctx, sc, 20, 400); ctx.fillStyle = D.muted;
    ctx.fillText(s.label, tx + stepW / 2, ty2 + 156 * sc);
    ctx.textAlign = 'left';

    if (i < steps.length - 1) {
      ft(ctx, sc, 28, 700); ctx.fillStyle = D.muted3; ctx.textAlign = 'center';
      ctx.fillText('→', tx + stepW + 20 * sc, ty2 + stepH / 2 + 10 * sc);
      ctx.textAlign = 'left';
    }
    tx += stepW + 40 * sc;
  });

  // ROI callout
  const ry2 = ty2 + stepH + 32 * sc;
  rr(ctx, 80 * sc, ry2, 920 * sc, 220 * sc, 14 * sc);
  ctx.fillStyle = D.surf; ctx.fill(); ctx.strokeStyle = D.border; ctx.lineWidth = 1;
  rr(ctx, 80 * sc, ry2, 920 * sc, 220 * sc, 14 * sc); ctx.stroke();

  const cols = [
    { v: '40',        l: 'leads/sem perdidos', c: '#ef4444' },
    { v: 'R$800',     l: 'ticket médio',       c: D.orange },
    { v: 'R$32.000',  l: 'perdidos/semana',    c: '#ef4444' },
  ];
  cols.forEach((col, i) => {
    const cx2 = 80 * sc + i * 307 * sc + 153 * sc;
    glow(ctx, col.c, 12); ft(ctx, sc, 46, 800); ctx.fillStyle = col.c; ctx.textAlign = 'center';
    ctx.fillText(col.v, cx2, ry2 + 106 * sc); noGlow(ctx);
    ft(ctx, sc, 22, 400); ctx.fillStyle = D.muted;
    ctx.fillText(col.l, cx2, ry2 + 148 * sc);
    if (i < 2) {
      ctx.strokeStyle = D.border; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(80 * sc + (i + 1) * 307 * sc, ry2 + 30 * sc);
      ctx.lineTo(80 * sc + (i + 1) * 307 * sc, ry2 + 190 * sc); ctx.stroke();
    }
  });
  ctx.textAlign = 'left';

  drawDots(ctx, w, 5, 1, sc);
  drawFooter(ctx, w, 'growthsales.ai · Omni PRO™ · 2 de 5');
}

// ─── Card 3 — A Solução (IA) ──────────────────────────────────────────────────
function drawCard3(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sc = w / 1080;
  drawBase(ctx, w, h, D.ai);

  ft(ctx, sc, 22, 700); ctx.fillStyle = D.ai;
  ctx.fillText('A SOLUÇÃO', 80 * sc, 195 * sc);

  ft(ctx, sc, 108, 800); ctx.fillStyle = D.text;
  ctx.fillText('IA que', 80 * sc, 400 * sc);
  ctx.fillText('responde em', 80 * sc, 520 * sc);
  ctx.fillStyle = D.ai;
  ctx.fillText('8 segundos.', 80 * sc, 640 * sc);

  ft(ctx, sc, 34, 400); ctx.fillStyle = D.muted;
  ctx.fillText('24/7 · Todos os canais · Qualifica e agenda.', 80 * sc, 710 * sc);

  // Chat mockup
  const chatY = 760 * sc;
  rr(ctx, 80 * sc, chatY, 920 * sc, 56 * sc, 10 * sc);
  ctx.fillStyle = D.surf2; ctx.fill();
  ctx.fillStyle = D.ai; ctx.fillRect(80 * sc, chatY, 920 * sc, 4 * sc);
  ft(ctx, sc, 24, 600); ctx.fillStyle = D.ai;
  ctx.fillText('Omni PRO™ — Resposta automática por IA', 112 * sc, chatY + 36 * sc);

  // incoming
  let cy = chatY + 72 * sc;
  cy += msgIn(ctx, 80 * sc, cy, 920 * sc, 'Oi! Tenho interesse no plano PRO. Quanto custa?', '02:14', CH[0], sc);

  // response time badge
  const rtBadgeW = 280 * sc, rtBadgeH = 44 * sc;
  rr(ctx, (w - rtBadgeW) / 2, cy - 2 * sc, rtBadgeW, rtBadgeH, rtBadgeH / 2);
  ctx.fillStyle = rgba(D.ai, .12); ctx.fill();
  ctx.strokeStyle = rgba(D.ai, .35); ctx.lineWidth = 1;
  rr(ctx, (w - rtBadgeW) / 2, cy - 2 * sc, rtBadgeW, rtBadgeH, rtBadgeH / 2); ctx.stroke();
  glow(ctx, D.ai, 8); ft(ctx, sc, 22, 700); ctx.fillStyle = D.ai; ctx.textAlign = 'center';
  ctx.fillText('⚡ IA respondeu em 8s', w / 2, cy + 28 * sc); noGlow(ctx); ctx.textAlign = 'left';
  cy += 50 * sc;

  cy += msgAI(ctx, 80 * sc, cy, 920 * sc, 'Olá! Nosso plano Starter é R$297/mês. Me conta o tamanho do seu time?', '02:14', sc);
  cy += msgIn(ctx, 80 * sc, cy, 920 * sc, 'Somos 6 vendedores, foco em B2B.', '02:15', CH[0], sc);
  cy += msgAI(ctx, 80 * sc, cy, 920 * sc, 'Perfeito! Agendar demo amanhã às 10h?', '02:15', sc);

  // Channels strip
  const stripY = cy + 16 * sc;
  rr(ctx, 80 * sc, stripY, 920 * sc, 72 * sc, 10 * sc);
  ctx.fillStyle = rgba(D.ai, .08); ctx.fill(); ctx.strokeStyle = rgba(D.ai, .22); ctx.lineWidth = 1;
  rr(ctx, 80 * sc, stripY, 920 * sc, 72 * sc, 10 * sc); ctx.stroke();
  ft(ctx, sc, 26, 600); ctx.fillStyle = D.ai; ctx.textAlign = 'center';
  ctx.fillText('WA · IG · Email · SMS · Telefone — um único lugar', w / 2, stripY + 44 * sc);
  ctx.textAlign = 'left';

  drawDots(ctx, w, 5, 2, sc);
  drawFooter(ctx, w, 'growthsales.ai · Omni PRO™ · 3 de 5');
}

// ─── Card 4 — Os Resultados ───────────────────────────────────────────────────
function drawCard4(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sc = w / 1080;
  drawBase(ctx, w, h, D.wa);

  ft(ctx, sc, 22, 700); ctx.fillStyle = D.wa;
  ctx.fillText('OS RESULTADOS', 80 * sc, 195 * sc);

  ft(ctx, sc, 108, 800); ctx.fillStyle = D.text;
  ctx.fillText('Números que', 80 * sc, 400 * sc);
  ctx.fillText('falam por', 80 * sc, 520 * sc);
  ctx.fillStyle = D.wa;
  ctx.fillText('si só.', 80 * sc, 640 * sc);

  ft(ctx, sc, 34, 400); ctx.fillStyle = D.muted;
  ctx.fillText('Clientes OMNI PRO™ em 30 dias:', 80 * sc, 706 * sc);

  // 2×2 KPI grid
  const kw = 440 * sc, kh = 200 * sc;
  kpi(ctx, 80 * sc, 748 * sc, kw, kh, '1.200+', 'atendimentos', '↑ 3× vs mês anterior', D.wa, sc);
  kpi(ctx, 560 * sc, 748 * sc, kw, kh, '98%', 'resolvidos por IA', 'sem intervenção humana', D.ai, sc);
  kpi(ctx, 80 * sc, 976 * sc, kw, kh, '< 8s', 'tempo de resposta', '24/7 em todos os canais', D.orange, sc);
  kpi(ctx, 560 * sc, 976 * sc, kw, kh, '3,4×', 'taxa de conversão', 'vs equipe manual', D.em, sc);

  // Testimonial
  const testY = 1210 * sc;
  rr(ctx, 80 * sc, testY, 920 * sc, 300 * sc, 16 * sc);
  ctx.fillStyle = D.surf; ctx.fill();
  ctx.strokeStyle = rgba(D.wa, .3); ctx.lineWidth = 1.5;
  rr(ctx, 80 * sc, testY, 920 * sc, 300 * sc, 16 * sc); ctx.stroke();
  ctx.fillStyle = D.wa; ctx.fillRect(80 * sc, testY, 4 * sc, 300 * sc);

  // Stars
  glow(ctx, D.orange, 6);
  ft(ctx, sc, 38, 400); ctx.fillStyle = D.orange; ctx.textAlign = 'center';
  ctx.fillText('★★★★★', w / 2, testY + 60 * sc); noGlow(ctx);

  ft(ctx, sc, 30, 500); ctx.fillStyle = D.text; ctx.textAlign = 'center';
  ctx.fillText('"Fechamos R$48k no primeiro mês.', w / 2, testY + 120 * sc);
  ctx.fillText('A IA qualifica melhor que um SDR."', w / 2, testY + 160 * sc);
  ft(ctx, sc, 24, 400); ctx.fillStyle = D.muted;
  ctx.fillText('João Guirunas · CEO, Construtora JG · São Paulo', w / 2, testY + 204 * sc);
  ctx.textAlign = 'left';

  // comparison bar
  const compY = testY + 330 * sc;
  rr(ctx, 80 * sc, compY, 920 * sc, 160 * sc, 12 * sc);
  ctx.fillStyle = D.surf; ctx.fill(); ctx.strokeStyle = D.border; ctx.lineWidth = 1;
  rr(ctx, 80 * sc, compY, 920 * sc, 160 * sc, 12 * sc); ctx.stroke();

  const comparisons = [
    { l: 'Sem OMNI', pct: .28, c: D.muted3 },
    { l: 'Com OMNI', pct: .89, c: D.wa },
  ];
  comparisons.forEach((comp, i) => {
    const by = compY + 22 * sc + i * 60 * sc;
    ft(ctx, sc, 24, 600); ctx.fillStyle = D.muted;
    ctx.fillText(comp.l, 112 * sc, by + 28 * sc);
    const barX = 300 * sc, barW = 600 * sc, barH = 26 * sc;
    rr(ctx, barX, by, barW, barH, barH / 2);
    ctx.fillStyle = rgba(comp.c, .12); ctx.fill();
    rr(ctx, barX, by, barW * comp.pct, barH, barH / 2);
    ctx.fillStyle = rgba(comp.c, .85); ctx.fill();
    ft(ctx, sc, 22, 700); ctx.fillStyle = comp.c; ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(comp.pct * 100)}%`, 940 * sc, by + 21 * sc); ctx.textAlign = 'left';
  });

  drawDots(ctx, w, 5, 3, sc);
  drawFooter(ctx, w, 'growthsales.ai · Omni PRO™ · 4 de 5');
}

// ─── Card 5 — O CTA ───────────────────────────────────────────────────────────
function drawCard5(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sc = w / 1080;
  drawBase(ctx, w, h, D.orange);

  ft(ctx, sc, 22, 700); ctx.fillStyle = D.orange;
  ctx.fillText('COMECE AGORA', 80 * sc, 195 * sc);

  ft(ctx, sc, 108, 800); ctx.fillStyle = D.text;
  ctx.fillText('Transforme', 80 * sc, 400 * sc);
  ctx.fillText('leads em', 80 * sc, 520 * sc);
  ctx.fillStyle = D.orange;
  ctx.fillText('clientes.', 80 * sc, 640 * sc);

  // Big CTA button visual
  const btnY = 700 * sc, btnH = 130 * sc;
  rr(ctx, 80 * sc, btnY, 920 * sc, btnH, btnH / 2);
  const btnG = ctx.createLinearGradient(80 * sc, btnY, 1000 * sc, btnY + btnH);
  btnG.addColorStop(0, D.orange); btnG.addColorStop(1, '#e05520');
  ctx.fillStyle = btnG; ctx.fill();
  glow(ctx, D.orange, 30);
  ft(ctx, sc, 44, 800); ctx.fillStyle = D.text; ctx.textAlign = 'center';
  ctx.fillText('▶  Agendar Demonstração PRO', w / 2, btnY + btnH / 2 + 16 * sc);
  noGlow(ctx); ctx.textAlign = 'left';

  // Friction removers
  const perks = ['✓  Onboarding dedicado', '✓  Suporte 24/7 incluso', '✓  ROI em 30 dias'];
  perks.forEach((p, i) => {
    ft(ctx, sc, 28, 400); ctx.fillStyle = D.muted; ctx.textAlign = 'center';
    ctx.fillText(p, w / 2, btnY + btnH + 50 * sc + i * 46 * sc);
  });
  ctx.textAlign = 'left';

  // Social proof
  const spY = 1070 * sc;
  rr(ctx, 80 * sc, spY, 920 * sc, 120 * sc, 14 * sc);
  ctx.fillStyle = D.surf; ctx.fill(); ctx.strokeStyle = D.border; ctx.lineWidth = 1;
  rr(ctx, 80 * sc, spY, 920 * sc, 120 * sc, 14 * sc); ctx.stroke();
  glow(ctx, D.orange, 6);
  ft(ctx, sc, 36, 400); ctx.fillStyle = D.orange; ctx.textAlign = 'center';
  ctx.fillText('★★★★★', w / 2, spY + 56 * sc); noGlow(ctx);
  ft(ctx, sc, 26, 400); ctx.fillStyle = D.muted;
  ctx.fillText('4.9/5 de 312 avaliações · +180 empresas ativas', w / 2, spY + 94 * sc);
  ctx.textAlign = 'left';

  // URL strip
  const urlY = 1230 * sc;
  rr(ctx, 80 * sc, urlY, 920 * sc, 80 * sc, 14 * sc);
  const urlG = ctx.createLinearGradient(80 * sc, urlY, 1000 * sc, urlY);
  urlG.addColorStop(0, rgba(D.orange, .25)); urlG.addColorStop(1, rgba(D.orange, .1));
  ctx.fillStyle = urlG; ctx.fill();
  ctx.strokeStyle = rgba(D.orange, .45); ctx.lineWidth = 1.5;
  rr(ctx, 80 * sc, urlY, 920 * sc, 80 * sc, 14 * sc); ctx.stroke();
  glow(ctx, D.orange, 10); ft(ctx, sc, 36, 800); ctx.fillStyle = D.orange; ctx.textAlign = 'center';
  ctx.fillText('growthsales.ai', w / 2, urlY + 50 * sc); noGlow(ctx); ctx.textAlign = 'left';

  // Feature highlights
  const feats = [
    { icon: '🤖', title: 'IA 24/7',       sub: '11 ferramentas' },
    { icon: '📱', title: '5 Canais',       sub: 'WA · IG · Email · SMS · Tel' },
    { icon: '📊', title: 'CRM integrado', sub: 'Pipeline + Score + BI' },
    { icon: '⚡', title: '< 8s resposta', sub: 'Tempo real, sempre' },
  ];
  const featW = 210 * sc, featH = 170 * sc;
  let fx = 80 * sc, fy = 1350 * sc;
  feats.forEach((f, i) => {
    rr(ctx, fx, fy, featW, featH, 12 * sc);
    ctx.fillStyle = D.surf; ctx.fill(); ctx.strokeStyle = D.border; ctx.lineWidth = 1;
    rr(ctx, fx, fy, featW, featH, 12 * sc); ctx.stroke();
    ft(ctx, sc, 36, 400); ctx.fillStyle = D.text; ctx.textAlign = 'center';
    ctx.fillText(f.icon, fx + featW / 2, fy + 62 * sc);
    ft(ctx, sc, 22, 700); ctx.fillStyle = D.text;
    ctx.fillText(f.title, fx + featW / 2, fy + 104 * sc);
    ft(ctx, sc, 18, 400); ctx.fillStyle = D.muted;
    ctx.fillText(f.sub, fx + featW / 2, fy + 134 * sc);
    ctx.textAlign = 'left';
    if (i < feats.length - 1) {
      ft(ctx, sc, 26, 400); ctx.fillStyle = D.muted3; ctx.textAlign = 'center';
      ctx.fillText('·', fx + featW + 20 * sc, fy + featH / 2 + 10 * sc);
      ctx.textAlign = 'left';
    }
    fx += featW + 40 * sc;
  });

  drawDots(ctx, w, 5, 4, sc);
  drawFooter(ctx, w, 'growthsales.ai · Omni PRO™ · 5 de 5');
}

// ─── Card 6 — Brand Identity ──────────────────────────────────────────────────
function drawCard6(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sc = w / 1080;
  ctx.fillStyle = D.bg; ctx.fillRect(0, 0, w, h);

  // Ambient radial glow
  const amb = ctx.createRadialGradient(w * .5, h * .42, 0, w * .5, h * .42, w * .85);
  amb.addColorStop(0, rgba(D.orange, .08));
  amb.addColorStop(.55, rgba(D.orange, .025));
  amb.addColorStop(1, 'transparent');
  ctx.fillStyle = amb; ctx.fillRect(0, 0, w, h);

  // Top + bottom accent bars
  ctx.fillStyle = D.orange;
  ctx.fillRect(0, 0, w, 8 * sc);
  ctx.fillRect(0, h - 8 * sc, w, 8 * sc);

  // Logomark — outer glow ring + "G"
  const lx = w / 2, ly = 560 * sc, lr = 130 * sc;
  // outer soft ring
  const ringG = ctx.createRadialGradient(lx, ly, lr * .55, lx, ly, lr * 1.4);
  ringG.addColorStop(0, rgba(D.orange, .14));
  ringG.addColorStop(1, 'transparent');
  ctx.fillStyle = ringG;
  ctx.beginPath(); ctx.arc(lx, ly, lr * 1.4, 0, Math.PI * 2); ctx.fill();
  // ring
  ctx.beginPath(); ctx.arc(lx, ly, lr, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(D.orange, .38); ctx.lineWidth = 2.5 * sc; ctx.stroke();
  // inner circle fill
  ctx.beginPath(); ctx.arc(lx, ly, lr, 0, Math.PI * 2);
  ctx.fillStyle = rgba(D.orange, .07); ctx.fill();
  // "G" glyph
  glow(ctx, D.orange, 28 * sc);
  ft(ctx, sc, 112, 900); ctx.fillStyle = D.orange; ctx.textAlign = 'center';
  ctx.fillText('G', lx, ly + 40 * sc);
  noGlow(ctx);

  // Wordmark
  ft(ctx, sc, 96, 900); ctx.fillStyle = D.text; ctx.textAlign = 'center';
  ctx.fillText('GROWTH', w / 2, 800 * sc);
  glow(ctx, D.orange, 18 * sc);
  ctx.fillStyle = D.orange;
  ctx.fillText('SALES', w / 2, 908 * sc);
  noGlow(ctx);

  // Product line
  ft(ctx, sc, 36, 500); ctx.fillStyle = D.muted3; ctx.textAlign = 'center';
  ctx.fillText('R E V E N U E  O S ™', w / 2, 980 * sc);

  // Divider
  const dY = 1020 * sc;
  const dHalfW = 170 * sc;
  ctx.strokeStyle = rgba(D.orange, .28); ctx.lineWidth = 1 * sc;
  ctx.beginPath(); ctx.moveTo(w / 2 - dHalfW, dY); ctx.lineTo(w / 2 + dHalfW, dY); ctx.stroke();
  ctx.beginPath(); ctx.arc(w / 2, dY, 5 * sc, 0, Math.PI * 2);
  ctx.fillStyle = D.orange; ctx.fill();

  // Tagline
  ft(ctx, sc, 38, 400); ctx.fillStyle = D.muted; ctx.textAlign = 'center';
  ctx.fillText('Transforme leads em clientes.', w / 2, 1080 * sc);
  ctx.fillText('Automaticamente.', w / 2, 1132 * sc);

  // URL pill
  const urlY = 1220 * sc, urlW = 680 * sc, urlH = 96 * sc;
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

  // Module pills row
  const mods = ['BI PRO', 'CRM', 'OMNI', 'CALL', 'LP', 'AI'];
  const modY = 1380 * sc;
  ft(ctx, sc, 22, 700);
  const modTotalW = mods.reduce((sum, m) => sum + ctx.measureText(m).width + 48 * sc + 12 * sc, 0) - 12 * sc;
  let mx = (w - modTotalW) / 2;
  mods.forEach((m, i) => {
    const mw = ctx.measureText(m).width + 48 * sc, mh = 52 * sc;
    rr(ctx, mx, modY, mw, mh, mh / 2);
    ctx.fillStyle = rgba(D.orange, i % 2 === 0 ? .12 : .07); ctx.fill();
    ctx.strokeStyle = rgba(D.orange, i % 2 === 0 ? .4 : .2); ctx.lineWidth = 1;
    rr(ctx, mx, modY, mw, mh, mh / 2); ctx.stroke();
    ft(ctx, sc, 22, 700); ctx.fillStyle = i % 2 === 0 ? D.orange : D.muted2; ctx.textAlign = 'center';
    ctx.fillText(m, mx + mw / 2, modY + mh / 2 + 8 * sc);
    mx += mw + 12 * sc;
  });

  // KPI strip
  const kpY = 1490 * sc;
  rr(ctx, 80 * sc, kpY, 920 * sc, 180 * sc, 16 * sc);
  ctx.fillStyle = D.surf; ctx.fill();
  ctx.strokeStyle = D.border; ctx.lineWidth = 1;
  rr(ctx, 80 * sc, kpY, 920 * sc, 180 * sc, 16 * sc); ctx.stroke();
  const kpiItems = [
    { v: '1.200+', l: 'leads/dia' },
    { v: '98%',    l: 'via IA' },
    { v: '< 8s',   l: 'resposta' },
    { v: '3,4×',   l: 'conversão' },
  ];
  kpiItems.forEach((k, i) => {
    const kx = 80 * sc + i * 230 * sc + 115 * sc;
    glow(ctx, D.orange, 8 * sc);
    ft(ctx, sc, 50, 800); ctx.fillStyle = D.orange; ctx.textAlign = 'center';
    ctx.fillText(k.v, kx, kpY + 96 * sc); noGlow(ctx);
    ft(ctx, sc, 22, 400); ctx.fillStyle = D.muted2;
    ctx.fillText(k.l, kx, kpY + 140 * sc);
    if (i < 3) {
      ctx.strokeStyle = D.border; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(80 * sc + (i + 1) * 230 * sc, kpY + 28 * sc);
      ctx.lineTo(80 * sc + (i + 1) * 230 * sc, kpY + 152 * sc); ctx.stroke();
    }
  });
  ctx.textAlign = 'left';

  // Closing line
  ft(ctx, sc, 26, 400); ctx.fillStyle = D.muted3; ctx.textAlign = 'center';
  ctx.fillText('Vendas inteligentes. Resultados reais.', w / 2, 1750 * sc);
  ctx.textAlign = 'left';

  // Footer divider
  ctx.strokeStyle = D.border; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(80 * sc, 1812 * sc); ctx.lineTo(w - 80 * sc, 1812 * sc); ctx.stroke();
  ft(ctx, sc, 22, 400); ctx.fillStyle = D.muted3; ctx.textAlign = 'center';
  ctx.fillText('growthsales.ai · Revenue OS™', w / 2, 1868 * sc); ctx.textAlign = 'left';
}

// ─── Cards array ──────────────────────────────────────────────────────────────
const CARDS = [
  { id: 'problema',    title: 'O Problema',    subtitle: '62 leads perdidos/dia',         draw: drawCard1 },
  { id: 'custo',       title: 'A Dor',         subtitle: 'R$32k/semana desperdiçados',    draw: drawCard2 },
  { id: 'solucao',     title: 'A Solução',     subtitle: 'IA responde em 8 segundos',     draw: drawCard3 },
  { id: 'resultados',  title: 'Os Resultados', subtitle: '1.200+ atendimentos/30 dias',   draw: drawCard4 },
  { id: 'cta',         title: 'Comece Agora',  subtitle: 'Agendar demonstração PRO',      draw: drawCard5 },
  { id: 'brand',       title: 'Growth Sales',  subtitle: 'growthsales.ai · Revenue OS™', draw: drawCard6 },
];

// ─── Video v2 ─────────────────────────────────────────────────────────────────
const VD = 16000; // total loop duration ms

function ease3(t: number) { return 1 - Math.pow(1 - t, 3); }
function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }
function tw(elapsed: number, start: number, dur: number) { return clamp01((elapsed - start) / dur); }

/** Like wrap() but honours \n as a forced line break */
function wrapM(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  return text.split('\n').flatMap(seg => wrap(ctx, seg, maxW));
}

/** Draw phone chrome frame; returns clipped screen rect */
function drawPhoneChrome(ctx: CanvasRenderingContext2D, w: number, h: number): { cx: number; cy: number; cw: number; ch: number } {
  const sc = w / 1080;
  const bw = 24 * sc;
  const br = 108 * sc;

  // Phone body gradient
  rr(ctx, 0, 0, w, h, br);
  const bodyG = ctx.createLinearGradient(0, 0, w * 0.18, h);
  bodyG.addColorStop(0, '#222228');
  bodyG.addColorStop(0.5, '#161618');
  bodyG.addColorStop(1, '#0e0e10');
  ctx.fillStyle = bodyG; ctx.fill();

  // Outer rim highlight
  rr(ctx, 0, 0, w, h, br);
  ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 2.5 * sc; ctx.stroke();

  // Screen cutout
  const sw = w - bw * 2, sh = h - bw * 2;
  rr(ctx, bw, bw, sw, sh, br - bw);
  ctx.fillStyle = D.bg; ctx.fill();

  // Dynamic island / notch
  const niW = 152 * sc, niH = 34 * sc;
  const niX = (w - niW) / 2, niY = bw + 14 * sc;
  rr(ctx, niX, niY, niW, niH, niH / 2);
  ctx.fillStyle = '#08080f'; ctx.fill();
  // Camera lens dot
  ctx.beginPath(); ctx.arc(niX + niW * 0.76, niY + niH / 2, 5.5 * sc, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1a28'; ctx.fill();
  ctx.beginPath(); ctx.arc(niX + niW * 0.76, niY + niH / 2, 2.5 * sc, 0, Math.PI * 2);
  ctx.fillStyle = '#0d0d1a'; ctx.fill();

  // Home bar
  const hbW = 260 * sc, hbH = 6 * sc;
  rr(ctx, (w - hbW) / 2, h - bw / 2 - hbH / 2 - 2 * sc, hbW, hbH, hbH / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fill();

  // Side buttons (power + volume)
  ctx.fillStyle = '#252530';
  rr(ctx, -3 * sc, h * 0.32, 4 * sc, 60 * sc, 2 * sc); ctx.fill();
  rr(ctx, -3 * sc, h * 0.46, 4 * sc, 60 * sc, 2 * sc); ctx.fill();
  rr(ctx, w - 1 * sc, h * 0.37, 4 * sc, 88 * sc, 2 * sc); ctx.fill();

  // Specular glass sheen
  const sheen = ctx.createLinearGradient(0, 0, w * 0.6, h * 0.4);
  sheen.addColorStop(0, 'rgba(255,255,255,0.055)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  rr(ctx, 0, 0, w, h, br);
  ctx.fillStyle = sheen; ctx.fill();

  const cx = bw, cy = bw + niH + 20 * sc;
  const cw = sw, ch = sh - niH - 20 * sc;
  return { cx, cy, cw, ch };
}

function drawVideoFrame(ctx: CanvasRenderingContext2D, w: number, h: number, elapsed: number) {
  const t = elapsed % VD;
  const sc = w / 1080;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = D.bg; ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'left';

  // ── Phone chrome (draws frame, returns clipped content rect) ──────────────
  const { cx, cy, cw, ch } = drawPhoneChrome(ctx, w, h);

  // ── Clip to screen area ───────────────────────────────────────────────────
  ctx.save();
  const bw2 = 24 * sc, br2 = 108 * sc;
  const niH2 = 34 * sc;
  rr(ctx, bw2, bw2, w - bw2 * 2, h - bw2 * 2, br2 - bw2);
  ctx.clip();

  // ── SCENE 0: Intro (0–2500ms) ─────────────────────────────────────────────
  if (t < 2500) {
    const bg1 = ctx.createRadialGradient(cx + cw / 2, cy + ch * .35, 0, cx + cw / 2, cy + ch * .35, cw * .85);
    bg1.addColorStop(0, rgba(D.orange, .10 * ease3(clamp01(t / 2500))));
    bg1.addColorStop(1, 'transparent');
    ctx.fillStyle = bg1; ctx.fillRect(cx, cy, cw, ch);

    ctx.save(); ctx.globalAlpha = ease3(tw(t, 0, 500));
    ft(ctx, sc, 24, 700); ctx.fillStyle = D.muted3; ctx.textAlign = 'center';
    ctx.fillText('GROWTHSALES', cx + cw / 2, cy + 72 * sc); ctx.restore();

    const titleT = tw(t, 200, 600);
    ctx.save(); ctx.globalAlpha = ease3(titleT);
    glow(ctx, D.orange, 48 * sc);
    ft(ctx, sc, 118, 900); ctx.fillStyle = D.text; ctx.textAlign = 'center';
    ctx.fillText('Omni PRO™', cx + cw / 2, cy + ch * .30 + (1 - ease3(titleT)) * 40 * sc);
    noGlow(ctx); ctx.restore();

    ctx.save(); ctx.globalAlpha = ease3(tw(t, 500, 500));
    ft(ctx, sc, 44, 400); ctx.fillStyle = D.muted2; ctx.textAlign = 'center';
    ctx.fillText('Todos os canais. Uma só tela.', cx + cw / 2, cy + ch * .30 + 70 * sc); ctx.restore();

    const pillW = 148 * sc, pillH = 48 * sc, pillGap = 12 * sc;
    const totalPW = CH.length * pillW + (CH.length - 1) * pillGap;
    let px = cx + (cw - totalPW) / 2;
    const py = cy + ch * .50;
    CH.forEach((ch2, i) => {
      const pT = tw(t, 700 + i * 140, 450);
      ctx.save(); ctx.globalAlpha = ease3(pT);
      const offY = (1 - ease3(pT)) * 28 * sc;
      rr(ctx, px, py + offY, pillW, pillH, pillH / 2);
      ctx.fillStyle = rgba(ch2.color, .22); ctx.fill();
      ctx.strokeStyle = rgba(ch2.color, .70); ctx.lineWidth = 1.5;
      rr(ctx, px, py + offY, pillW, pillH, pillH / 2); ctx.stroke();
      glow(ctx, ch2.color, 16 * sc);
      ft(ctx, sc, 26, 700); ctx.fillStyle = ch2.color; ctx.textAlign = 'center';
      ctx.fillText(ch2.full, px + pillW / 2, py + pillH * .68 + offY);
      noGlow(ctx); ctx.restore();
      px += pillW + pillGap;
    });
    ctx.textAlign = 'left';

    // progress bar
    ctx.fillStyle = rgba(D.orange, .14); ctx.fillRect(cx, cy + ch - 5 * sc, cw, 5 * sc);
    ctx.fillStyle = D.orange; ctx.fillRect(cx, cy + ch - 5 * sc, cw * clamp01(t / 2500), 5 * sc);
  }

  // ── SCENE 1: WhatsApp (2500–8000ms) ──────────────────────────────────────
  else if (t < 8000) {
    const st = t - 2500;
    const hH = 126 * sc;
    ctx.fillStyle = D.surf; ctx.fillRect(cx, cy, cw, hH);
    ctx.fillStyle = D.wa; ctx.fillRect(cx, cy, cw, 4 * sc);
    ctx.strokeStyle = D.border; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, cy + hH); ctx.lineTo(cx + cw, cy + hH); ctx.stroke();

    ctx.beginPath(); ctx.arc(cx + 62 * sc, cy + hH / 2, 36 * sc, 0, Math.PI * 2);
    ctx.fillStyle = rgba(D.wa, .2); ctx.fill();
    ft(ctx, sc, 32, 800); ctx.fillStyle = D.wa; ctx.textAlign = 'center';
    ctx.fillText('J', cx + 62 * sc, cy + hH / 2 + 11 * sc); ctx.textAlign = 'left';
    ft(ctx, sc, 44, 700); ctx.fillStyle = D.text;
    ctx.fillText('João Guirunas', cx + 112 * sc, cy + hH / 2 - 8 * sc);
    ctx.beginPath(); ctx.arc(cx + 113 * sc, cy + hH / 2 + 20 * sc, 7 * sc, 0, Math.PI * 2);
    ctx.fillStyle = D.wa; ctx.fill();
    ft(ctx, sc, 28, 400); ctx.fillStyle = D.wa;
    ctx.fillText('Online agora', cx + 126 * sc, cy + hH / 2 + 27 * sc);
    ft(ctx, sc, 28, 600);
    const cpw = ctx.measureText('WhatsApp').width + 36 * sc;
    rr(ctx, cx + cw - cpw - 16 * sc, cy + (hH - 48 * sc) / 2, cpw, 48 * sc, 24 * sc);
    ctx.fillStyle = rgba(D.wa, .18); ctx.fill();
    ctx.strokeStyle = rgba(D.wa, .55); ctx.lineWidth = 1.5;
    rr(ctx, cx + cw - cpw - 16 * sc, cy + (hH - 48 * sc) / 2, cpw, 48 * sc, 24 * sc); ctx.stroke();
    ctx.fillStyle = D.wa; ctx.textAlign = 'center';
    ctx.fillText('WhatsApp', cx + cw - cpw / 2 - 16 * sc, cy + hH / 2 + 10 * sc); ctx.textAlign = 'left';

    type VMsg2 = { dir: string; text: string; time: string; special?: boolean; appearAt: number };
    const msgs: VMsg2[] = [
      { dir: 'in',  text: 'Olá! Vi vocês no Instagram.\nTenho interesse no plano.',   time: '09:41', appearAt: 300  },
      { dir: 'ai',  text: 'Oi João! Qual o tamanho\ndo seu time de vendas?',           time: '09:41', appearAt: 1400 },
      { dir: 'in',  text: 'Somos 8 consultores.\nFoco em B2B.',                        time: '09:42', appearAt: 2700 },
      { dir: 'out', text: '✅ Reunião confirmada!\nAmanhã às 10h — link enviado.',      time: '09:43', appearAt: 3900, special: true },
    ];
    const pad = 44 * sc, maxBW = cw * .86, lh = 76 * sc;
    let msgY = cy + hH + 42 * sc;

    ctx.save();
    ctx.beginPath(); ctx.rect(cx, cy + hH, cw, ch - hH - 72 * sc); ctx.clip();

    for (const m of msgs) {
      if (st < m.appearAt - 80) break;
      const mT = ease3(tw(st, m.appearAt, 360));
      const offY = (1 - mT) * 46 * sc;
      ft(ctx, sc, 52, 400);
      const lines = wrapM(ctx, m.text, maxBW - 88 * sc);
      const bh = lines.length * lh + (m.dir === 'ai' ? 226 : 188) * sc;
      const mxL = lines.reduce((mx, l) => Math.max(mx, ctx.measureText(l).width), 0);
      const bw3 = Math.min(maxBW, mxL + 108 * sc);
      ctx.save(); ctx.globalAlpha = mT;
      ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 18 * sc; ctx.shadowOffsetY = 6 * sc;
      if (m.dir === 'ai') {
        bubble(ctx, cx + pad, msgY + offY, bw3, bh, 28 * sc, 'ai');
        ctx.fillStyle = D.surf3; ctx.fill();
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        ctx.fillStyle = D.ai; ctx.fillRect(cx + pad, msgY + offY, 6 * sc, bh);
        ft(ctx, sc, 28, 700); ctx.fillStyle = D.ai;
        ctx.fillText('IA · Growthsales', cx + pad + 20 * sc, msgY + offY + 52 * sc);
        lines.forEach((l, li) => { ft(ctx, sc, 52, 400); ctx.fillStyle = D.text; ctx.fillText(l, cx + pad + 20 * sc, msgY + offY + 106 * sc + li * lh); });
        ft(ctx, sc, 28, 400); ctx.fillStyle = rgba(D.ai, .7);
        ctx.fillText(m.time + ' ✓✓', cx + pad + 20 * sc, msgY + offY + bh - 44 * sc);
      } else if (m.dir === 'in') {
        bubble(ctx, cx + pad, msgY + offY, bw3, bh, 28 * sc, 'in');
        ctx.fillStyle = D.surf3; ctx.fill();
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        lines.forEach((l, li) => { ft(ctx, sc, 52, 400); ctx.fillStyle = D.text; ctx.fillText(l, cx + pad + 28 * sc, msgY + offY + 84 * sc + li * lh); });
        ft(ctx, sc, 28, 400); ctx.fillStyle = D.muted2;
        ctx.fillText(m.time, cx + pad + 28 * sc, msgY + offY + bh - 44 * sc);
      } else {
        const bx = cx + cw - pad - bw3;
        bubble(ctx, bx, msgY + offY, bw3, bh, 28 * sc, 'out');
        if (m.special) { glow(ctx, D.wa, 22 * sc); ctx.fillStyle = rgba(D.wa, .18); ctx.fill(); noGlow(ctx); }
        else { ctx.fillStyle = D.surf3; ctx.fill(); }
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        ctx.strokeStyle = rgba(D.wa, m.special ? .55 : .22); ctx.lineWidth = 1.5;
        bubble(ctx, bx, msgY + offY, bw3, bh, 28 * sc, 'out'); ctx.stroke();
        lines.forEach((l, li) => {
          ft(ctx, sc, 52, m.special ? 600 : 400); ctx.fillStyle = m.special ? D.wa : D.text; ctx.textAlign = 'right';
          ctx.fillText(l, bx + bw3 - 28 * sc, msgY + offY + 84 * sc + li * lh);
        });
        ft(ctx, sc, 28, 400); ctx.fillStyle = D.wa; ctx.textAlign = 'right';
        ctx.fillText(m.time + ' ✓✓', bx + bw3 - 24 * sc, msgY + offY + bh - 44 * sc); ctx.textAlign = 'left';
      }
      ctx.restore();
      msgY += bh + 60 * sc;
    }
    // Typing dots (between msg1 & msg2)
    if (st > 1200 && st < 1400) {
      ctx.save(); ctx.globalAlpha = Math.min(1, (st - 1200) / 200);
      const tdW = 90 * sc, tdH = 58 * sc;
      bubble(ctx, cx + pad, msgY, tdW, tdH, 13 * sc, 'ai');
      ctx.fillStyle = D.surf3; ctx.fill();
      ctx.fillStyle = D.ai; ctx.fillRect(cx + pad, msgY, 4 * sc, tdH);
      const tp2 = st / 280;
      [0,1,2].forEach(di => {
        const pulse = (Math.sin(tp2 + di * 1.1) + 1) / 2;
        ctx.beginPath(); ctx.arc(cx + pad + 16 * sc + di * 22 * sc, msgY + tdH / 2, 6 * sc, 0, Math.PI * 2);
        ctx.fillStyle = rgba(D.ai, .28 + pulse * .65); ctx.fill();
      });
      ctx.restore();
    }
    ctx.restore();

    const iy = cy + ch - 62 * sc;
    ctx.fillStyle = D.surf; ctx.fillRect(cx, iy - 10 * sc, cw, 72 * sc);
    ctx.strokeStyle = D.border; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, iy - 10 * sc); ctx.lineTo(cx + cw, iy - 10 * sc); ctx.stroke();
    rr(ctx, cx + 16 * sc, iy, cw - 80 * sc, 50 * sc, 10 * sc); ctx.fillStyle = D.surf3; ctx.fill();
    ft(ctx, sc, 30, 400); ctx.fillStyle = D.muted3;
    ctx.fillText('Escreva uma mensagem…', cx + 30 * sc, iy + 33 * sc);
    rr(ctx, cx + cw - 58 * sc, iy + 2 * sc, 46 * sc, 46 * sc, 10 * sc);
    ctx.fillStyle = D.orange; ctx.fill();
    ft(ctx, sc, 30, 700); ctx.fillStyle = D.text; ctx.textAlign = 'center';
    ctx.fillText('↑', cx + cw - 35 * sc, iy + 32 * sc); ctx.textAlign = 'left';

    ctx.fillStyle = rgba(D.wa, .14); ctx.fillRect(cx, cy + ch - 5 * sc, cw, 5 * sc);
    ctx.fillStyle = D.wa; ctx.fillRect(cx, cy + ch - 5 * sc, cw * clamp01(st / 5500), 5 * sc);
  }

  // ── SCENE 2: Channel switch (8000–9300ms) ────────────────────────────────
  else if (t < 9300) {
    const st = t - 8000;
    const entryT = ease3(tw(st, 0, 400));
    const nbg = ctx.createRadialGradient(cx + cw / 2, cy + ch * .44, 0, cx + cw / 2, cy + ch * .44, cw * .75);
    nbg.addColorStop(0, rgba(D.ig, .18 * entryT)); nbg.addColorStop(1, 'transparent');
    ctx.fillStyle = nbg; ctx.fillRect(cx, cy, cw, ch);

    const cardT = ease3(tw(st, 100, 460));
    const cardOff = (1 - cardT) * -55 * sc;
    const nx = cx + 24 * sc, ny = cy + 52 * sc, nw = cw - 48 * sc, nh = 126 * sc;
    ctx.save(); ctx.globalAlpha = cardT;
    rr(ctx, nx, ny + cardOff, nw, nh, 20 * sc);
    ctx.shadowColor = rgba(D.ig, .4); ctx.shadowBlur = 20 * sc;
    ctx.fillStyle = D.surf; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = rgba(D.ig, .7); ctx.lineWidth = 2;
    rr(ctx, nx, ny + cardOff, nw, nh, 20 * sc); ctx.stroke();
    ctx.beginPath(); ctx.arc(nx + 52 * sc, ny + nh / 2 + cardOff, 24 * sc, 0, Math.PI * 2);
    ctx.fillStyle = rgba(D.ig, .22); ctx.fill();
    ft(ctx, sc, 24, 800); ctx.fillStyle = D.ig; ctx.textAlign = 'center';
    ctx.fillText('IG', nx + 52 * sc, ny + nh / 2 + 8 * sc + cardOff); ctx.textAlign = 'left';
    ft(ctx, sc, 26, 700); ctx.fillStyle = D.text;
    ctx.fillText('📩 Nova mensagem · Instagram', nx + 90 * sc, ny + 43 * sc + cardOff);
    ft(ctx, sc, 25, 400); ctx.fillStyle = D.muted2;
    ctx.fillText('Giovanna: "Amei o post!"', nx + 90 * sc, ny + 78 * sc + cardOff);
    ft(ctx, sc, 20, 400); ctx.fillStyle = D.muted3;
    ctx.fillText('agora mesmo', nx + 90 * sc, ny + 108 * sc + cardOff);
    ctx.restore();

    const txtT = ease3(tw(st, 280, 520));
    ctx.save(); ctx.globalAlpha = txtT;
    const txtOff = (1 - txtT) * 32 * sc;
    ft(ctx, sc, 68, 700); ctx.fillStyle = D.ig; ctx.textAlign = 'center';
    ctx.fillText('📩', cx + cw / 2, cy + ch * .44 + txtOff);
    ft(ctx, sc, 44, 700); ctx.fillStyle = D.text;
    ctx.fillText('Canal trocado', cx + cw / 2, cy + ch * .44 + 80 * sc + txtOff);
    ctx.fillText('automaticamente', cx + cw / 2, cy + ch * .44 + 140 * sc + txtOff);
    ft(ctx, sc, 30, 400); ctx.fillStyle = rgba(D.ig, .85);
    ctx.fillText('WhatsApp → Instagram', cx + cw / 2, cy + ch * .44 + 192 * sc + txtOff);
    ctx.textAlign = 'left'; ctx.restore();

    ctx.fillStyle = rgba(D.ig, .14); ctx.fillRect(cx, cy + ch - 5 * sc, cw, 5 * sc);
    ctx.fillStyle = D.ig; ctx.fillRect(cx, cy + ch - 5 * sc, cw * clamp01(st / 1300), 5 * sc);
  }

  // ── SCENE 3: Instagram (9300–12600ms) ────────────────────────────────────
  else if (t < 12600) {
    const st = t - 9300;
    const hH = 126 * sc;
    ctx.fillStyle = D.surf; ctx.fillRect(cx, cy, cw, hH);
    ctx.fillStyle = D.ig; ctx.fillRect(cx, cy, cw, 4 * sc);
    ctx.strokeStyle = D.border; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, cy + hH); ctx.lineTo(cx + cw, cy + hH); ctx.stroke();

    ctx.beginPath(); ctx.arc(cx + 62 * sc, cy + hH / 2, 36 * sc, 0, Math.PI * 2);
    ctx.fillStyle = rgba(D.ig, .2); ctx.fill();
    ft(ctx, sc, 32, 800); ctx.fillStyle = D.ig; ctx.textAlign = 'center';
    ctx.fillText('G', cx + 62 * sc, cy + hH / 2 + 11 * sc); ctx.textAlign = 'left';
    ft(ctx, sc, 44, 700); ctx.fillStyle = D.text;
    ctx.fillText('Giovanna Lima', cx + 112 * sc, cy + hH / 2 - 8 * sc);
    ctx.beginPath(); ctx.arc(cx + 113 * sc, cy + hH / 2 + 20 * sc, 7 * sc, 0, Math.PI * 2);
    ctx.fillStyle = D.ig; ctx.fill();
    ft(ctx, sc, 28, 400); ctx.fillStyle = D.ig;
    ctx.fillText('Online agora', cx + 126 * sc, cy + hH / 2 + 27 * sc);
    ft(ctx, sc, 28, 600);
    const igpw = ctx.measureText('Instagram').width + 36 * sc;
    rr(ctx, cx + cw - igpw - 16 * sc, cy + (hH - 48 * sc) / 2, igpw, 48 * sc, 24 * sc);
    ctx.fillStyle = rgba(D.ig, .18); ctx.fill();
    ctx.strokeStyle = rgba(D.ig, .55); ctx.lineWidth = 1.5;
    rr(ctx, cx + cw - igpw - 16 * sc, cy + (hH - 48 * sc) / 2, igpw, 48 * sc, 24 * sc); ctx.stroke();
    ctx.fillStyle = D.ig; ctx.textAlign = 'center';
    ctx.fillText('Instagram', cx + cw - igpw / 2 - 16 * sc, cy + hH / 2 + 10 * sc); ctx.textAlign = 'left';

    const igMsgs = [
      { dir: 'in', text: 'Oi! Amei o post.\nComo funciona o PRO?', time: '14:22', appearAt: 300 },
      { dir: 'ai', text: 'Olá Giovanna! 🎉\nIA nativa, omnichannel\ne CRM integrado!', time: '14:23', appearAt: 1500 },
    ];
    const pad = 44 * sc, maxBW = cw * .86, lh = 76 * sc;
    let msgY = cy + hH + 42 * sc;
    ctx.save();
    ctx.beginPath(); ctx.rect(cx, cy + hH, cw, ch - hH - 72 * sc); ctx.clip();
    for (const m of igMsgs) {
      if (st < m.appearAt - 80) break;
      const mT = ease3(tw(st, m.appearAt, 360));
      const offY = (1 - mT) * 46 * sc;
      ft(ctx, sc, 52, 400);
      const lines = wrapM(ctx, m.text, maxBW - 88 * sc);
      const bh = lines.length * lh + (m.dir === 'ai' ? 226 : 188) * sc;
      const mxL = lines.reduce((mx, l) => Math.max(mx, ctx.measureText(l).width), 0);
      const bw4 = Math.min(maxBW, mxL + 108 * sc);
      ctx.save(); ctx.globalAlpha = mT;
      ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 18 * sc; ctx.shadowOffsetY = 6 * sc;
      if (m.dir === 'ai') {
        bubble(ctx, cx + pad, msgY + offY, bw4, bh, 28 * sc, 'ai');
        ctx.fillStyle = D.surf3; ctx.fill();
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        ctx.fillStyle = D.ig; ctx.fillRect(cx + pad, msgY + offY, 6 * sc, bh);
        ft(ctx, sc, 28, 700); ctx.fillStyle = D.ig;
        ctx.fillText('IA · Instagram', cx + pad + 20 * sc, msgY + offY + 52 * sc);
        lines.forEach((l, li) => { ft(ctx, sc, 52, 400); ctx.fillStyle = D.text; ctx.fillText(l, cx + pad + 20 * sc, msgY + offY + 106 * sc + li * lh); });
        ft(ctx, sc, 28, 400); ctx.fillStyle = rgba(D.ig, .7);
        ctx.fillText(m.time + ' ✓✓', cx + pad + 20 * sc, msgY + offY + bh - 44 * sc);
      } else {
        bubble(ctx, cx + pad, msgY + offY, bw4, bh, 28 * sc, 'in');
        ctx.fillStyle = D.surf3; ctx.fill();
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        lines.forEach((l, li) => { ft(ctx, sc, 52, 400); ctx.fillStyle = D.text; ctx.fillText(l, cx + pad + 28 * sc, msgY + offY + 84 * sc + li * lh); });
        ft(ctx, sc, 28, 400); ctx.fillStyle = D.muted2;
        ctx.fillText(m.time, cx + pad + 28 * sc, msgY + offY + bh - 44 * sc);
      }
      ctx.restore();
      msgY += bh + 60 * sc;
    }
    ctx.restore();

    const iy = cy + ch - 62 * sc;
    ctx.fillStyle = D.surf; ctx.fillRect(cx, iy - 10 * sc, cw, 72 * sc);
    ctx.strokeStyle = D.border; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, iy - 10 * sc); ctx.lineTo(cx + cw, iy - 10 * sc); ctx.stroke();
    rr(ctx, cx + 16 * sc, iy, cw - 80 * sc, 50 * sc, 10 * sc); ctx.fillStyle = D.surf3; ctx.fill();
    ft(ctx, sc, 30, 400); ctx.fillStyle = D.muted3;
    ctx.fillText('Escreva uma mensagem…', cx + 30 * sc, iy + 33 * sc);
    rr(ctx, cx + cw - 58 * sc, iy + 2 * sc, 46 * sc, 46 * sc, 10 * sc);
    ctx.fillStyle = D.ig; ctx.fill();
    ft(ctx, sc, 24, 700); ctx.fillStyle = D.text; ctx.textAlign = 'center';
    ctx.fillText('↑', cx + cw - 30 * sc, iy + 24 * sc); ctx.textAlign = 'left';

    ctx.fillStyle = rgba(D.ig, .14); ctx.fillRect(cx, cy + ch - 5 * sc, cw, 5 * sc);
    ctx.fillStyle = D.ig; ctx.fillRect(cx, cy + ch - 5 * sc, cw * clamp01(st / 3300), 5 * sc);
  }

  // ── SCENE 4: Results (12600–16000ms) ─────────────────────────────────────
  else {
    const st = t - 12600;
    const rg = ctx.createRadialGradient(cx + cw / 2, cy + ch * .27, 0, cx + cw / 2, cy + ch * .27, cw * .85);
    rg.addColorStop(0, rgba(D.orange, .08 * ease3(clamp01(st / 600)))); rg.addColorStop(1, 'transparent');
    ctx.fillStyle = rg; ctx.fillRect(cx, cy, cw, ch);

    ctx.save(); ctx.globalAlpha = ease3(tw(st, 0, 500));
    ft(ctx, sc, 24, 700); ctx.fillStyle = D.muted3; ctx.textAlign = 'center';
    ctx.fillText('GROWTHSALES · OMNI PRO™', cx + cw / 2, cy + 68 * sc);
    ft(ctx, sc, 66, 800); ctx.fillStyle = D.text;
    ctx.fillText('Resultados reais.', cx + cw / 2, cy + ch * .19);
    ctx.fillText('Em tempo real.', cx + cw / 2, cy + ch * .19 + 84 * sc);
    ctx.restore();

    const kpis = [
      { label: 'Atendimentos/dia', value: '1.200+', color: D.wa     },
      { label: 'Canais unificados', value: '5',     color: D.ig     },
      { label: 'Respostas via IA',  value: '98%',   color: D.ai     },
      { label: 'Tempo resposta',    value: '< 2min',color: D.orange },
    ];
    const kw = 424 * sc, kh = 168 * sc, kgap = 22 * sc;
    const kx0 = cx + (cw - (2 * kw + kgap)) / 2;
    const ky0 = cy + ch * .37;
    kpis.forEach((k, i) => {
      const kx = kx0 + (i % 2) * (kw + kgap);
      const ky = ky0 + Math.floor(i / 2) * (kh + 18 * sc);
      const cT = ease3(tw(st, 280 + i * 130, 480));
      ctx.save(); ctx.globalAlpha = cT;
      ctx.shadowColor = rgba(k.color, .28); ctx.shadowBlur = 18 * sc;
      rr(ctx, kx, ky + (1 - cT) * 34 * sc, kw, kh, 14 * sc);
      ctx.fillStyle = D.surf; ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = rgba(k.color, .4); ctx.lineWidth = 1.5;
      rr(ctx, kx, ky + (1 - cT) * 34 * sc, kw, kh, 14 * sc); ctx.stroke();
      glow(ctx, k.color, 12 * sc);
      ft(ctx, sc, 72, 800); ctx.fillStyle = k.color; ctx.textAlign = 'center';
      ctx.fillText(k.value, kx + kw / 2, ky + 110 * sc + (1 - cT) * 34 * sc); noGlow(ctx);
      ft(ctx, sc, 26, 500); ctx.fillStyle = D.muted2;
      ctx.fillText(k.label, kx + kw / 2, ky + 154 * sc + (1 - cT) * 34 * sc);
      ctx.restore();
    });

    const ctaT = ease3(tw(st, 1600, 580));
    if (ctaT > 0) {
      ctx.save(); ctx.globalAlpha = ctaT;
      const ctaY = ky0 + 2 * (kh + 18 * sc) + 44 * sc;
      const ctaW = 556 * sc, ctaH = 84 * sc;
      glow(ctx, D.orange, 28 * sc);
      rr(ctx, cx + (cw - ctaW) / 2, ctaY + (1 - ctaT) * 22 * sc, ctaW, ctaH, ctaH / 2);
      ctx.fillStyle = D.orange; ctx.fill(); noGlow(ctx);
      ft(ctx, sc, 32, 700); ctx.fillStyle = D.bg; ctx.textAlign = 'center';
      ctx.fillText('Agendar demonstração →', cx + cw / 2, ctaY + 53 * sc + (1 - ctaT) * 22 * sc);
      ft(ctx, sc, 22, 400); ctx.fillStyle = D.muted3;
      ctx.fillText('growthsales.ai', cx + cw / 2, ctaY + 112 * sc + (1 - ctaT) * 22 * sc);
      ctx.textAlign = 'left'; ctx.restore();
    }

    ctx.fillStyle = rgba(D.orange, .14); ctx.fillRect(cx, cy + ch - 5 * sc, cw, 5 * sc);
    ctx.fillStyle = D.orange; ctx.fillRect(cx, cy + ch - 5 * sc, cw * clamp01(st / 3400), 5 * sc);
  }

  ctx.restore(); // end screen clip

  // Re-draw phone chrome on top (glass overlay)
  ctx.save();
  const sheen2 = ctx.createLinearGradient(0, 0, w * 0.55, h * 0.38);
  sheen2.addColorStop(0, 'rgba(255,255,255,0.04)');
  sheen2.addColorStop(1, 'rgba(255,255,255,0)');
  rr(ctx, 0, 0, w, h, 108 * sc);
  ctx.fillStyle = sheen2; ctx.fill();
  ctx.restore();
}


// ─── Components ───────────────────────────────────────────────────────────────
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
    const c = document.createElement('canvas');
    c.width = 1080; c.height = 1920;
    const ctx = c.getContext('2d')!;
    card.draw(ctx, 1080, 1920);
    c.toBlob(blob => {
      if (!blob) { setBusy(null); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `omni-pro-${card.id}.jpg`;
      document.body.appendChild(a); a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); setBusy(null); }, 150);
    }, 'image/jpeg', 0.95);
  }, [card]);

  const dlSvg = useCallback(() => {
    setBusy('svg');
    const c = document.createElement('canvas');
    c.width = 1080; c.height = 1920;
    const ctx2 = c.getContext('2d')!;
    card.draw(ctx2, 1080, 1920);
    const bgDataUrl = c.toDataURL('image/png');

    // Build SVG text layer per card — editable in Figma
    const textLayers: Record<string, string> = {
      problema: `
    <text x="80" y="195" fill="#FF4A00" font-size="22" font-weight="700" letter-spacing="3">O PROBLEMA</text>
    <text x="80" y="400" fill="#fafafa" font-size="108" font-weight="800">Quantos</text>
    <text x="80" y="520" fill="#fafafa" font-size="108" font-weight="800">leads você</text>
    <text x="80" y="640" fill="#FF4A00" font-size="108" font-weight="800">perdeu hoje?</text>
    <text x="80" y="720" fill="#a1a1aa" font-size="36">Enquanto você dorme, leads entram.</text>
    <text x="80" y="766" fill="#a1a1aa" font-size="36">Ninguém responde. Eles vão embora.</text>
    <text x="540" y="1868" fill="#52525b" font-size="22" text-anchor="middle">growthsales.ai · Omni PRO™ · 1 de 5</text>`,
      custo: `
    <text x="80" y="195" fill="#ef4444" font-size="22" font-weight="700" letter-spacing="3">O CUSTO DO SILÊNCIO</text>
    <text x="80" y="400" fill="#fafafa" font-size="108" font-weight="800">Cada lead</text>
    <text x="80" y="520" fill="#fafafa" font-size="108" font-weight="800">perdido =</text>
    <text x="80" y="640" fill="#ef4444" font-size="108" font-weight="800">dinheiro fora.</text>
    <text x="80" y="714" fill="#a1a1aa" font-size="34">Ticket médio R$800 · 40 leads/semana</text>
    <text x="80" y="758" fill="#a1a1aa" font-size="34">sem resposta = prejuízo de R$32k/semana.</text>
    <text x="540" y="1868" fill="#52525b" font-size="22" text-anchor="middle">growthsales.ai · Omni PRO™ · 2 de 5</text>`,
      solucao: `
    <text x="80" y="195" fill="#a78bfa" font-size="22" font-weight="700" letter-spacing="3">A SOLUÇÃO</text>
    <text x="80" y="400" fill="#fafafa" font-size="108" font-weight="800">IA que</text>
    <text x="80" y="520" fill="#fafafa" font-size="108" font-weight="800">responde em</text>
    <text x="80" y="640" fill="#a78bfa" font-size="108" font-weight="800">8 segundos.</text>
    <text x="80" y="710" fill="#a1a1aa" font-size="34">24/7 · Todos os canais · Qualifica e agenda.</text>
    <text x="540" y="1868" fill="#52525b" font-size="22" text-anchor="middle">growthsales.ai · Omni PRO™ · 3 de 5</text>`,
      resultados: `
    <text x="80" y="195" fill="#22c55e" font-size="22" font-weight="700" letter-spacing="3">OS RESULTADOS</text>
    <text x="80" y="400" fill="#fafafa" font-size="108" font-weight="800">Números que</text>
    <text x="80" y="520" fill="#fafafa" font-size="108" font-weight="800">falam por</text>
    <text x="80" y="640" fill="#22c55e" font-size="108" font-weight="800">si só.</text>
    <text x="80" y="706" fill="#a1a1aa" font-size="34">Clientes OMNI PRO™ em 30 dias:</text>
    <g id="kpis" font-family="inherit">
      <text x="300" y="878" fill="#22c55e" font-size="60" font-weight="800" text-anchor="middle">1.200+</text>
      <text x="300" y="920" fill="#a1a1aa" font-size="23" text-anchor="middle">atendimentos</text>
      <text x="780" y="878" fill="#a78bfa" font-size="60" font-weight="800" text-anchor="middle">98%</text>
      <text x="780" y="920" fill="#a1a1aa" font-size="23" text-anchor="middle">resolvidos por IA</text>
      <text x="300" y="1106" fill="#FF4A00" font-size="60" font-weight="800" text-anchor="middle">&lt; 8s</text>
      <text x="300" y="1148" fill="#a1a1aa" font-size="23" text-anchor="middle">tempo de resposta</text>
      <text x="780" y="1106" fill="#3b82f6" font-size="60" font-weight="800" text-anchor="middle">3,4×</text>
      <text x="780" y="1148" fill="#a1a1aa" font-size="23" text-anchor="middle">taxa de conversão</text>
    </g>
    <text x="540" y="1868" fill="#52525b" font-size="22" text-anchor="middle">growthsales.ai · Omni PRO™ · 4 de 5</text>`,
      cta: `
    <text x="80" y="195" fill="#FF4A00" font-size="22" font-weight="700" letter-spacing="3">COMECE AGORA</text>
    <text x="80" y="400" fill="#fafafa" font-size="108" font-weight="800">Transforme</text>
    <text x="80" y="520" fill="#fafafa" font-size="108" font-weight="800">leads em</text>
    <text x="80" y="640" fill="#FF4A00" font-size="108" font-weight="800">clientes.</text>
    <text x="540" y="776" fill="#fafafa" font-size="44" font-weight="800" text-anchor="middle">▶  Agendar Demonstração PRO</text>
    <text x="540" y="862" fill="#a1a1aa" font-size="28" text-anchor="middle">✓  Onboarding dedicado</text>
    <text x="540" y="908" fill="#a1a1aa" font-size="28" text-anchor="middle">✓  Suporte 24/7 incluso</text>
    <text x="540" y="954" fill="#a1a1aa" font-size="28" text-anchor="middle">✓  ROI em 30 dias</text>
    <text x="540" y="1305" fill="#FF4A00" font-size="36" font-weight="800" text-anchor="middle">growthsales.ai</text>
    <text x="540" y="1868" fill="#52525b" font-size="22" text-anchor="middle">growthsales.ai · Omni PRO™ · 5 de 5</text>`,
      brand: `
    <text x="540" y="800" fill="#fafafa" font-size="96" font-weight="900" text-anchor="middle">GROWTH</text>
    <text x="540" y="908" fill="#FF4A00" font-size="96" font-weight="900" text-anchor="middle">SALES</text>
    <text x="540" y="980" fill="#52525b" font-size="36" font-weight="500" text-anchor="middle">REVENUE OS™</text>
    <text x="540" y="1080" fill="#a1a1aa" font-size="38" text-anchor="middle">Transforme leads em clientes.</text>
    <text x="540" y="1132" fill="#a1a1aa" font-size="38" text-anchor="middle">Automaticamente.</text>
    <text x="540" y="1281" fill="#FF4A00" font-size="44" font-weight="800" text-anchor="middle">growthsales.ai</text>
    <text x="540" y="1868" fill="#52525b" font-size="22" text-anchor="middle">growthsales.ai · Revenue OS™</text>`,
    };

    const textLayer = textLayers[card.id] ?? '';
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1080" height="1920" viewBox="0 0 1080 1920">
  <title>Omni PRO™ — ${card.title} · growthsales.ai</title>
  <!-- Background layer (raster) — hide/delete this group to work with text only -->
  <g id="background-raster">
    <image href="${bgDataUrl}" width="1080" height="1920"/>
  </g>
  <!-- Text layer (vector, editable in Figma) -->
  <g id="text-layer" font-family="Inter,-apple-system,Helvetica Neue,sans-serif">${textLayer}
  </g>
</svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `omni-pro-${card.id}.svg`;
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
      paused.current = true;
      pausedAt.current = performance.now() - startRef.current;
      setPlaying(false);
    } else {
      paused.current = false;
      startRef.current = performance.now() - pausedAt.current;
      setPlaying(true);
    }
  };

  const dlSvgFrame = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const dataUrl = c.toDataURL('image/png');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><image href="${dataUrl}" width="1080" height="1920"/></svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'omni-pro-video-frame.svg';
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 150);
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
    } catch {
      setRecErr('MediaRecorder não suportado.'); setRecording(false); return;
    }
    mr.ondataavailable = e => { if (e.data?.size > 0) chunks.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunks, { type: fmt.mime });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `omni-pro-demo.${fmt.ext}`;
      document.body.appendChild(a); a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 300);
      setRecording(false);
    };
    paused.current = false;
    startRef.current = performance.now();
    mr.start(100);
    setTimeout(() => mr.stop(), VD + 600);
  }, []);

  return (
    <div className="flex gap-8 items-start">
      <div className="flex-shrink-0" style={{ width: 270 }}>
        <div
          className="aspect-[9/16] w-full rounded-[18px] overflow-visible"
          style={{
            transform: 'perspective(960px) rotateY(-14deg) rotateX(5deg) scale(1)',
            transformOrigin: 'center center',
            filter: 'drop-shadow(0 40px 80px rgba(0,0,0,0.65)) drop-shadow(0 0 1px rgba(255,255,255,0.04))',
          }}
        >
          <canvas
            ref={canvasRef}
            width={1080}
            height={1920}
            className="w-full h-full rounded-[18px]"
            style={{ imageRendering: 'auto', display: 'block' }}
          />
        </div>
        <div className="flex gap-1.5 mt-3">
          <Button variant="outline" size="sm" className="h-7 text-[10px] px-2 gap-1 flex-1"
            onClick={togglePlay}>
            {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {playing ? 'Pausar' : 'Play'}
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-[10px] px-2 gap-1 flex-1"
            onClick={dlSvgFrame}>
            <Download className="w-3 h-3" /> SVG
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
            { range: '0–2.5s',  label: 'Intro',      color: D.orange, desc: 'Logo + 5 canais aparecem com easing' },
            { range: '2.5–8s',  label: 'WhatsApp',   color: D.wa,     desc: 'João, IA qualifica, reunião confirmada' },
            { range: '8–9.3s',  label: 'Transição',  color: D.ig,     desc: 'Notificação Instagram com slide-in' },
            { range: '9.3–12.6s',label: 'Instagram', color: D.ig,     desc: 'Giovanna, IA responde em segundos' },
            { range: '12.6–16s',label: 'Resultados', color: D.orange, desc: '1.200+ atendimentos · 98% IA · CTA' },
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


// Named export — video only (used by MarketingAssetsHub)
export { VideoDemo as OmniProVideo };

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function OmniProAssets() {
  return (
    <div className="space-y-10 pb-16">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary/70">Omni PRO™</p>
        <h2 className="text-[18px] font-semibold text-foreground">Assets para Instagram</h2>
        <p className="text-[13px] text-muted-foreground/60 max-w-lg leading-relaxed">
          6 cards verticais (1080×1920 · 9:16) e 1 vídeo animado de 16 segundos.
          Export em <strong>JPG</strong>, <strong>SVG</strong> e <strong>MP4</strong>.
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
