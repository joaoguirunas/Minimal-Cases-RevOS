/**
 * ModuleStub — placeholder while module assets are in development
 */
import { useEffect, useRef } from 'react';
import { D, MODULES, rgba, rr, ft, glow, noGlow, drawBase, drawFooter, drawDots } from './shared';

type ModuleId = typeof MODULES[number]['id'];

interface StubProps {
  moduleId: ModuleId;
}

function drawStubCard(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  mod: typeof MODULES[number],
  cardIdx: number,
) {
  const sc = w / 1080;
  drawBase(ctx, w, h, mod.color);

  // Eyebrow
  ft(ctx, sc, 22, 700); ctx.fillStyle = mod.color;
  ctx.fillText('EM DESENVOLVIMENTO', 80 * sc, 195 * sc);

  // Large icon
  ft(ctx, sc, 180, 400); ctx.fillStyle = mod.color; ctx.textAlign = 'center';
  ctx.fillText(mod.icon, w / 2, 560 * sc);
  ctx.textAlign = 'left';

  // Module name
  glow(ctx, mod.color, 20);
  ft(ctx, sc, 84, 900); ctx.fillStyle = mod.color; ctx.textAlign = 'center';
  ctx.fillText(mod.name, w / 2, 720 * sc);
  noGlow(ctx);

  // Description
  ft(ctx, sc, 38, 400); ctx.fillStyle = '#a1a1aa'; ctx.textAlign = 'center';
  ctx.fillText(mod.desc, w / 2, 804 * sc);
  ctx.textAlign = 'left';

  // Coming soon badge
  const badgeY = 880 * sc, badgeW = 400 * sc, badgeH = 80 * sc;
  const badgeX = (w - badgeW) / 2;
  rr(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2);
  ctx.fillStyle = rgba(mod.color, .15); ctx.fill();
  ctx.strokeStyle = rgba(mod.color, .4); ctx.lineWidth = 1.5 * sc;
  rr(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2); ctx.stroke();
  ft(ctx, sc, 30, 700); ctx.fillStyle = mod.color; ctx.textAlign = 'center';
  ctx.fillText(`Stage ${mod.stage} · Em breve`, w / 2, badgeY + badgeH / 2 + 11 * sc);
  ctx.textAlign = 'left';

  // Card number indicator
  ft(ctx, sc, 26, 400); ctx.fillStyle = '#52525b'; ctx.textAlign = 'center';
  ctx.fillText(`Card ${cardIdx + 1} de 6`, w / 2, 1020 * sc);
  ctx.textAlign = 'left';

  drawDots(ctx, w, 5, Math.min(cardIdx, 4), sc);
  drawFooter(ctx, w, `growthsales.ai · ${mod.name} · ${cardIdx + 1} de 6`);
}

function StubCardPreview({ mod, idx }: { mod: typeof MODULES[number]; idx: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    drawStubCard(ctx, c.width, c.height, mod, idx);
  }, [mod, idx]);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="aspect-[9/16] w-full rounded-[6px] overflow-hidden border border-border">
        <canvas ref={ref} width={540} height={960} className="w-full h-full" style={{ imageRendering: 'auto' }} />
      </div>
      <p className="text-[11px] font-semibold text-foreground leading-none">Card {idx + 1}</p>
      <p className="text-[10px] text-muted-foreground/50 leading-none">Em desenvolvimento</p>
    </div>
  );
}

export default function ModuleStub({ moduleId }: StubProps) {
  const mod = MODULES.find(m => m.id === moduleId)!;
  const accentStyle = { color: mod.color };

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={accentStyle}>
          Revenue OS™
        </p>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{mod.icon}</span>
          <h2 className="text-[18px] font-semibold text-foreground">{mod.name}</h2>
        </div>
        <p className="text-[13px] text-muted-foreground/60 max-w-lg leading-relaxed">
          {mod.desc} — assets em produção (Stage {mod.stage}).
        </p>
      </div>

      {/* Stage progress */}
      <div className="flex items-center gap-3 p-4 rounded-[6px] border border-border bg-card">
        <div
          className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse"
          style={{ backgroundColor: mod.color }}
        />
        <div>
          <p className="text-[12px] font-semibold text-foreground">
            Stage {mod.stage} — Em desenvolvimento
          </p>
          <p className="text-[11px] text-muted-foreground/55 mt-0.5">
            6 cards Instagram Story (9:16) + 1 vídeo animado 16s · exportação JPG, SVG e MP4
          </p>
        </div>
      </div>

      {/* Card previews */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/40 mb-4">
          6 cards · 1080×1920 · Instagram Story
        </p>
        <div className="grid grid-cols-6 gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <StubCardPreview key={i} mod={mod} idx={i} />
          ))}
        </div>
      </div>

      {/* Video placeholder */}
      <div className="border-t border-border pt-8">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/40 mb-5">
          Vídeo animado · 16s · 5 cenas · 60fps
        </p>
        <div
          className="flex items-center justify-center rounded-[12px] border border-dashed"
          style={{
            width: 270,
            aspectRatio: '9/16',
            borderColor: rgba(mod.color, .35),
            background: rgba(mod.color, .04),
          }}
        >
          <div className="text-center space-y-2">
            <span className="text-4xl">{mod.icon}</span>
            <p className="text-[11px] font-semibold" style={accentStyle}>{mod.name}</p>
            <p className="text-[10px] text-muted-foreground/50">Vídeo · Stage {mod.stage}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
