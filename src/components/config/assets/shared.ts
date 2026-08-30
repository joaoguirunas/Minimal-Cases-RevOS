/**
 * shared.ts — Revenue OS™ Marketing Assets
 * Shared canvas primitives, design tokens, and UI atoms.
 * All module asset files import from here.
 */

// ─── Design tokens ────────────────────────────────────────────────────────────
export const D = {
  bg:     '#000000',
  surf:   '#1a1a22',
  surf2:  '#212130',
  surf3:  '#27273a',
  border: '#2e2e3e',
  text:   '#fafafa',
  muted:  '#a1a1aa',
  muted2: '#71717a',
  muted3: '#52525b',
  orange: '#FF4A00',
  wa:     '#22c55e',
  ig:     '#ec4899',
  em:     '#3b82f6',
  sms:    '#8b5cf6',
  tel:    '#f97316',
  ai:     '#a78bfa',
};

export const CH = [
  { id: 'whatsapp',  label: 'WA',      full: 'WhatsApp',  color: D.wa  },
  { id: 'instagram', label: 'IG',      full: 'Instagram', color: D.ig  },
  { id: 'email',     label: 'Email',   full: 'E-mail',    color: D.em  },
  { id: 'sms',       label: 'SMS',     full: 'SMS',       color: D.sms },
  { id: 'telefone',  label: 'Chamada', full: 'Telefone',  color: D.tel },
];

// ─── Module registry ──────────────────────────────────────────────────────────
export const MODULES = [
  { id: 'revenue-os',   name: 'Revenue OS™',       color: D.orange, icon: '🏆', desc: 'Visão geral do sistema completo',            stage: 2  },
  { id: 'bi-pro',       name: 'BI PRO™',            color: D.em,     icon: '📊', desc: 'Dashboards, CAC, funil e atribuição',       stage: 3  },
  { id: 'crm-pro',      name: 'CRM PRO™',           color: D.wa,     icon: '🎯', desc: 'Pipeline, leads, kanban e score',           stage: 4  },
  { id: 'omni-pro',     name: 'Omni PRO™',          color: D.ig,     icon: '💬', desc: '5 canais, IA 24/7, omnichannel',            stage: 'done' },
  { id: 'sends-pro',    name: 'Sends PRO™',          color: D.sms,    icon: '📨', desc: 'Disparos em massa, automação multicanal',   stage: 6  },
  { id: 'schedule-pro', name: 'Schedule PRO™',       color: '#06b6d4',icon: '📅', desc: 'Booking inteligente, Google Cal, equipes',  stage: 7  },
  { id: 'lp-pro',       name: 'LP PRO™',             color: '#f59e0b',icon: '🏗️', desc: 'Builder visual, 22 blocos, A/B testing',   stage: 8  },
  { id: 'score-pro',    name: 'Score PRO™',          color: '#ef4444',icon: '⚡', desc: 'BANT, qualificação IA, lead scoring',      stage: 9  },
  { id: 'ai-agents',    name: 'AI Agents PRO™',      color: D.ai,     icon: '🤖', desc: '11 ferramentas, agentic loop, memória',    stage: 10 },
] as const;

export type ModuleId = typeof MODULES[number]['id'];

// ─── Canvas primitives ────────────────────────────────────────────────────────
export function rr(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export function bubble(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
  dir: 'in' | 'out' | 'ai',
) {
  const tl = r, tr = r;
  const bl = dir === 'in'  ? 4 : r;
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

export function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function ft(ctx: CanvasRenderingContext2D, sc: number, size: number, wt = 400) {
  ctx.font = `${wt} ${Math.round(size * sc)}px Inter,-apple-system,"Helvetica Neue",sans-serif`;
}

export function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
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

/** wrap() that honours \n as forced line break */
export function wrapM(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  return text.split('\n').flatMap(seg => wrap(ctx, seg, maxW));
}

export function glow(ctx: CanvasRenderingContext2D, color: string, blur: number) {
  ctx.shadowColor = color; ctx.shadowBlur = blur;
}
export function noGlow(ctx: CanvasRenderingContext2D) {
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
}

// ─── Shared layout ────────────────────────────────────────────────────────────
export function drawBase(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  accent = D.orange,
  modLabel = '',
) {
  const sc = w / 1080;
  ctx.fillStyle = D.bg; ctx.fillRect(0, 0, w, h);

  const g = ctx.createRadialGradient(w * .5, 0, 0, w * .5, 0, w * .85);
  g.addColorStop(0, rgba(accent, .07));
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h * .55);

  ctx.fillStyle = accent; ctx.fillRect(0, 0, w, 5 * sc);

  ft(ctx, sc, 19, 700); ctx.fillStyle = D.muted3; ctx.textAlign = 'left';
  ctx.fillText('João Guirunas', 80 * sc, 118 * sc);
  if (modLabel) {
    ft(ctx, sc, 19, 400); ctx.fillStyle = D.muted3; ctx.textAlign = 'right';
    ctx.fillText(modLabel, w - 80 * sc, 118 * sc);
  }
  ctx.textAlign = 'left';
}

export function drawFooter(ctx: CanvasRenderingContext2D, w: number, sub = 'crm.joaoguirunas.com') {
  const sc = w / 1080;
  ctx.strokeStyle = D.border; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(80 * sc, 1812 * sc); ctx.lineTo(w - 80 * sc, 1812 * sc); ctx.stroke();
  ft(ctx, sc, 22, 400); ctx.fillStyle = D.muted3; ctx.textAlign = 'center';
  ctx.fillText(sub, w / 2, 1868 * sc); ctx.textAlign = 'left';
}

// ─── UI atoms ─────────────────────────────────────────────────────────────────
export function pill(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, label: string, color: string, sc: number,
  active = false,
): number {
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

export function badge(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, text: string, color: string, sc: number,
): number {
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

export function kpi(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  val: string, label: string, hint: string, color: string, sc: number,
) {
  rr(ctx, x, y, w, h, 14 * sc); ctx.fillStyle = D.surf; ctx.fill();
  ctx.strokeStyle = D.border; ctx.lineWidth = 1; rr(ctx, x, y, w, h, 14 * sc); ctx.stroke();
  rr(ctx, x, y, 4 * sc, h, 3 * sc); ctx.fillStyle = color; ctx.fill();
  glow(ctx, color, 12); ft(ctx, sc, 60, 800); ctx.fillStyle = color; ctx.textAlign = 'center';
  ctx.fillText(val, x + w / 2, y + h * .53); noGlow(ctx);
  ft(ctx, sc, 23, 400); ctx.fillStyle = D.muted; ctx.fillText(label, x + w / 2, y + h * .73);
  ft(ctx, sc, 21, 400); ctx.fillStyle = rgba(color, .8); ctx.fillText(hint, x + w / 2, y + h * .9);
  ctx.textAlign = 'left';
}

export function drawDots(
  ctx: CanvasRenderingContext2D,
  w: number, total: number, current: number, sc: number,
) {
  const r = 8 * sc, gap = 20 * sc;
  const totalW = total * r * 2 + (total - 1) * gap;
  let x = (w - totalW) / 2 + r;
  for (let i = 0; i < total; i++) {
    ctx.beginPath(); ctx.arc(x, 1770 * sc, r, 0, Math.PI * 2);
    ctx.fillStyle = i === current ? D.orange : 'rgba(255,255,255,0.2)'; ctx.fill();
    x += r * 2 + gap;
  }
}

// ─── Message UI atoms (used by video scenes) ──────────────────────────────────
export function msgIn(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, maxW: number,
  text: string, time: string, ch: typeof CH[number], sc: number,
): number {
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

export function msgAI(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, maxW: number,
  text: string, time: string, sc: number,
): number {
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

export function msgOut(
  ctx: CanvasRenderingContext2D,
  cw: number, y: number, maxW: number,
  text: string, time: string, sc: number,
): number {
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

// ─── Animation helpers ────────────────────────────────────────────────────────
export function ease3(t: number): number { return 1 - Math.pow(1 - t, 3); }
export function clamp01(v: number): number { return Math.max(0, Math.min(1, v)); }
export function tw(elapsed: number, start: number, dur: number): number {
  return clamp01((elapsed - start) / dur);
}

/** Total video loop duration (ms) */
export const VD = 16000;

// ─── Phone chrome ─────────────────────────────────────────────────────────────
export function drawPhoneChrome(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
): { cx: number; cy: number; cw: number; ch: number } {
  const sc = w / 1080;
  const bw = 24 * sc, br = 108 * sc;

  rr(ctx, 0, 0, w, h, br);
  const bodyG = ctx.createLinearGradient(0, 0, w * 0.18, h);
  bodyG.addColorStop(0, '#222228');
  bodyG.addColorStop(0.5, '#161618');
  bodyG.addColorStop(1, '#0e0e10');
  ctx.fillStyle = bodyG; ctx.fill();

  rr(ctx, 0, 0, w, h, br);
  ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 2.5 * sc; ctx.stroke();

  const sw = w - bw * 2, sh = h - bw * 2;
  rr(ctx, bw, bw, sw, sh, br - bw);
  ctx.fillStyle = D.bg; ctx.fill();

  const niW = 152 * sc, niH = 34 * sc;
  const niX = (w - niW) / 2, niY = bw + 14 * sc;
  rr(ctx, niX, niY, niW, niH, niH / 2);
  ctx.fillStyle = '#08080f'; ctx.fill();
  ctx.beginPath(); ctx.arc(niX + niW * 0.76, niY + niH / 2, 5.5 * sc, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1a28'; ctx.fill();
  ctx.beginPath(); ctx.arc(niX + niW * 0.76, niY + niH / 2, 2.5 * sc, 0, Math.PI * 2);
  ctx.fillStyle = '#0d0d1a'; ctx.fill();

  const hbW = 260 * sc, hbH = 6 * sc;
  rr(ctx, (w - hbW) / 2, h - bw / 2 - hbH / 2 - 2 * sc, hbW, hbH, hbH / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fill();

  ctx.fillStyle = '#252530';
  rr(ctx, -3 * sc, h * 0.32, 4 * sc, 60 * sc, 2 * sc); ctx.fill();
  rr(ctx, -3 * sc, h * 0.46, 4 * sc, 60 * sc, 2 * sc); ctx.fill();
  rr(ctx, w - 1 * sc, h * 0.37, 4 * sc, 88 * sc, 2 * sc); ctx.fill();

  const sheen = ctx.createLinearGradient(0, 0, w * 0.6, h * 0.4);
  sheen.addColorStop(0, 'rgba(255,255,255,0.055)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  rr(ctx, 0, 0, w, h, br);
  ctx.fillStyle = sheen; ctx.fill();

  const cx = bw, cy = bw + niH + 20 * sc;
  const cw2 = sw, ch2 = sh - niH - 20 * sc;
  return { cx, cy, cw: cw2, ch: ch2 };
}
