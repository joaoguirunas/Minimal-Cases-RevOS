/**
 * MarketingAssetsHub — João Guirunas Marketing Assets
 * Simplified single-page layout:
 *  • João Guirunas logo com download (SVG)
 *  • Module badges overview
 *  • 8 vertical module cards (9:16, canvas, PNG + SVG download)
 *  • 1 video: OMNI PRO™ animated 16s
 */
import { lazy, Suspense } from 'react';
import { OraLockup } from './OraLogo';
import { ModuleCardPreview, REV_CARDS } from './RevOSCards';

// Lazy-load heavy video component
const OmniProVideo = lazy(() =>
  import('../OmniProAssets').then(m => ({ default: m.OmniProVideo })),
);

const Spinner = () => (
  <div className="flex items-center justify-center py-16">
    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
  </div>
);

export default function MarketingAssetsHub() {
  return (
    <div className="space-y-12 pb-20">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="space-y-5">
        <OraLockup height={96} />
        <div className="space-y-1 max-w-xl">
          <h2 className="text-[18px] font-semibold text-foreground">Marketing Assets</h2>
          <p className="text-[13px] text-muted-foreground/60 leading-relaxed">
            Logo, 8 cards verticais (1080×1920 · 9:16) e 1 vídeo animado.
            Download em <strong>PNG</strong> e <strong>SVG</strong>.
            Prontos para Instagram Story, LinkedIn e apresentações.
          </p>
        </div>

        {/* Module badges */}
        <div className="flex flex-wrap gap-2">
          {REV_CARDS.map(c => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium border border-border bg-card"
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: c.color }}
              />
              {c.name}
            </span>
          ))}
        </div>
      </div>

      {/* ── Logo download ────────────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/40 mb-4">
          Logo João Guirunas
        </p>
        {null}
      </div>

      {/* ── Module cards grid ────────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/40 mb-5">
          8 cards · 1080×1920 · Instagram Story · PNG + SVG
        </p>
        <div className="grid grid-cols-4 gap-5 xl:grid-cols-8">
          {REV_CARDS.map(card => (
            <ModuleCardPreview key={card.id} card={card} />
          ))}
        </div>
      </div>

      {/* ── Video ─────────────────────────────────────────────────────────────── */}
      <div className="border-t border-border pt-10">
        <div className="mb-5 space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/40">
            Vídeo animado · OMNI PRO™ · 16s · 9:16 · 60fps
          </p>
          <p className="text-[12px] text-muted-foreground/55">
            Play · SVG frame · MP4 — 5 cenas: intro, WhatsApp, Instagram, resultados.
          </p>
        </div>
        <Suspense fallback={<Spinner />}>
          <OmniProVideo />
        </Suspense>
      </div>

    </div>
  );
}
