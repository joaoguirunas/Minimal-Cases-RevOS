/**
 * LP PRO™ Section Presets — 15 "anti-quadrado" layout compositions.
 * Each preset defines CSS classes, optional SVG dividers, and responsive behavior.
 */

import type { SectionPreset } from '../types';

export const SECTION_PRESETS: SectionPreset[] = [
  // ── Layout Presets ─────────────────────────────────────────────────────────

  {
    id: 'split-left',
    name: 'Split Left',
    category: 'layout',
    intensity: 'low',
    description: 'Content on the left, visual/image on the right (50/50 or 60/40).',
    css: 'display:grid;grid-template-columns:1.2fr 1fr;gap:3rem;align-items:center;',
    responsiveOverrides: {
      mobile: { css: 'display:flex;flex-direction:column;gap:2rem;' },
    },
    motionPreset: 'slideLeft',
  },

  {
    id: 'split-right',
    name: 'Split Right',
    category: 'layout',
    intensity: 'low',
    description: 'Visual/image on the left, content on the right.',
    css: 'display:grid;grid-template-columns:1fr 1.2fr;gap:3rem;align-items:center;',
    responsiveOverrides: {
      mobile: { css: 'display:flex;flex-direction:column-reverse;gap:2rem;' },
    },
    motionPreset: 'slideRight',
  },

  {
    id: 'contained-narrow',
    name: 'Contained Narrow',
    category: 'layout',
    intensity: 'low',
    description: 'Narrow max-width (640px) centered with generous whitespace. Editorial feel.',
    css: 'max-width:640px;margin-left:auto;margin-right:auto;text-align:center;',
    motionPreset: 'fadeUp',
  },

  // ── Depth Presets ──────────────────────────────────────────────────────────

  {
    id: 'elevated-glass',
    name: 'Elevated Glass',
    category: 'depth',
    intensity: 'medium',
    description: 'Subtle glassmorphism: backdrop-blur + semi-transparent background + soft border.',
    css: 'background:rgba(255,255,255,0.6);backdrop-filter:blur(var(--lp-blur,10px));-webkit-backdrop-filter:blur(var(--lp-blur,10px));border:1px solid rgba(255,255,255,0.18);border-radius:var(--lp-radius-lg,16px);padding:3rem;',
    wrapperStyle: 'position:relative;overflow:hidden;',
    responsiveOverrides: {
      mobile: { css: 'padding:1.5rem;border-radius:var(--lp-radius,8px);' },
    },
    motionPreset: 'scale',
  },

  {
    id: 'gradient-mesh',
    name: 'Gradient Mesh',
    category: 'depth',
    intensity: 'medium',
    description: 'Soft multi-color gradient mesh background using layered radial gradients.',
    css: 'position:relative;overflow:hidden;',
    wrapperStyle: 'background:radial-gradient(ellipse at 20% 50%,rgba(99,102,241,0.15) 0%,transparent 50%),radial-gradient(ellipse at 80% 20%,rgba(236,72,153,0.1) 0%,transparent 50%),radial-gradient(ellipse at 60% 80%,rgba(34,211,238,0.1) 0%,transparent 50%),var(--lp-bg-alt,#f8fafc);',
    responsiveOverrides: {
      mobile: { wrapperStyle: 'background:var(--lp-bg-alt,#f8fafc);' },
    },
    motionPreset: 'fadeIn',
  },

  {
    id: 'framed-offset',
    name: 'Framed Offset',
    category: 'depth',
    intensity: 'medium',
    description: 'Cards with asymmetric offset/overlap — inner container shifted with decorative border.',
    css: 'position:relative;padding:2rem;',
    wrapperStyle: 'border:2px solid var(--lp-border,rgba(0,0,0,0.08));border-radius:var(--lp-radius-lg,16px);transform:translateX(8px) translateY(-8px);box-shadow:var(--lp-shadow-lg,0 12px 28px rgba(0,0,0,0.15));background:var(--lp-surface,#fff);',
    responsiveOverrides: {
      mobile: { wrapperStyle: 'transform:none;' },
    },
    motionPreset: 'fadeUp',
  },

  {
    id: 'spotlight',
    name: 'Spotlight',
    category: 'depth',
    intensity: 'high',
    description: 'Dark section with radial gradient "spotlight" behind content.',
    css: 'position:relative;color:var(--lp-text,#f0f0f5);text-align:center;',
    wrapperStyle: 'background:radial-gradient(ellipse at 50% 30%,rgba(99,102,241,0.2) 0%,transparent 60%),var(--lp-bg,#0a0a0f);',
    motionPreset: 'scale',
  },

  // ── Divider Presets ────────────────────────────────────────────────────────

  {
    id: 'wave-divider-top',
    name: 'Wave Divider Top',
    category: 'divider',
    intensity: 'low',
    description: 'SVG wave divider at the top of the section, creating organic separation.',
    css: 'position:relative;padding-top:4rem;',
    beforeHtml: `<svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" style="position:absolute;top:-1px;left:0;width:100%;height:60px;" preserveAspectRatio="none"><path d="M0 60L48 52C96 44 192 28 288 22C384 16 480 20 576 28C672 36 768 48 864 50C960 52 1056 44 1152 36C1248 28 1344 20 1392 16L1440 12V0H0Z" fill="var(--lp-bg,#fff)"/></svg>`,
    motionPreset: 'fadeUp',
  },

  {
    id: 'wave-divider-bottom',
    name: 'Wave Divider Bottom',
    category: 'divider',
    intensity: 'low',
    description: 'SVG wave divider at the bottom of the section.',
    css: 'position:relative;padding-bottom:4rem;',
    afterHtml: `<svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" style="position:absolute;bottom:-1px;left:0;width:100%;height:60px;" preserveAspectRatio="none"><path d="M0 0L48 8C96 16 192 32 288 38C384 44 480 40 576 32C672 24 768 12 864 10C960 8 1056 16 1152 24C1248 32 1344 40 1392 44L1440 48V60H0Z" fill="var(--lp-bg,#fff)"/></svg>`,
    motionPreset: 'fadeUp',
  },

  {
    id: 'diagonal-cut',
    name: 'Diagonal Cut',
    category: 'divider',
    intensity: 'medium',
    description: 'Section with diagonal CSS clip-path border for dynamic separation.',
    css: 'position:relative;',
    wrapperStyle: 'clip-path:polygon(0 4%,100% 0,100% 96%,0 100%);padding:6rem 0;',
    responsiveOverrides: {
      mobile: { wrapperStyle: 'clip-path:polygon(0 2%,100% 0,100% 98%,0 100%);padding:4rem 0;' },
    },
    motionPreset: 'fadeIn',
  },

  // ── Grid Presets ───────────────────────────────────────────────────────────

  {
    id: 'bento-soft',
    name: 'Bento Soft',
    category: 'grid',
    intensity: 'medium',
    description: 'Asymmetric grid layout with different card sizes, soft radius, and gaps.',
    css: 'display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:auto;gap:1.5rem;',
    responsiveOverrides: {
      mobile: { css: 'display:flex;flex-direction:column;gap:1rem;' },
    },
    motionPreset: 'stagger',
  },

  {
    id: 'stacked-cards',
    name: 'Stacked Cards',
    category: 'grid',
    intensity: 'medium',
    description: 'Cards that stack/overlap slightly, creating depth via layered translates.',
    css: 'display:flex;flex-direction:column;gap:0;',
    wrapperStyle: 'perspective:1000px;',
    motionPreset: 'fadeUp',
  },

  // ── Scroll Presets ─────────────────────────────────────────────────────────

  {
    id: 'sticky-side',
    name: 'Sticky Side',
    category: 'scroll',
    intensity: 'medium',
    description: 'On desktop: one column sticks (position:sticky) while the other scrolls.',
    css: 'display:grid;grid-template-columns:1fr 1fr;gap:3rem;align-items:start;',
    wrapperStyle: 'min-height:60vh;',
    responsiveOverrides: {
      mobile: { css: 'display:flex;flex-direction:column;gap:2rem;' },
    },
    motionPreset: 'fadeUp',
  },

  {
    id: 'edge-fade',
    name: 'Edge Fade',
    category: 'scroll',
    intensity: 'low',
    description: 'Content with horizontal fade masks at edges — ideal for logos, testimonials.',
    css: 'position:relative;overflow:hidden;',
    wrapperStyle: '-webkit-mask-image:linear-gradient(to right,transparent,black 10%,black 90%,transparent);mask-image:linear-gradient(to right,transparent,black 10%,black 90%,transparent);',
  },

  {
    id: 'parallax-depth',
    name: 'Parallax Depth',
    category: 'scroll',
    intensity: 'high',
    description: 'Foreground content moves at different speed than background. Requires motion.',
    css: 'position:relative;overflow:hidden;',
    wrapperStyle: 'transform-style:preserve-3d;',
    responsiveOverrides: {
      mobile: { wrapperStyle: 'transform-style:flat;' },
    },
    motionPreset: 'fadeUp',
  },
];

/** Quick lookup by ID */
export const SECTION_PRESET_MAP = new Map(SECTION_PRESETS.map((p) => [p.id, p]));

/**
 * Get CSS string to inject for a section preset.
 * Handles mobile responsiveness via media query.
 */
export function getPresetCSS(presetId: string, isMobile = false): {
  css: string;
  wrapperStyle: string;
  beforeHtml: string;
  afterHtml: string;
} {
  const preset = SECTION_PRESET_MAP.get(presetId);
  if (!preset) return { css: '', wrapperStyle: '', beforeHtml: '', afterHtml: '' };

  const mobile = isMobile && preset.responsiveOverrides?.mobile;

  return {
    css: mobile?.css ?? preset.css,
    wrapperStyle: mobile?.wrapperStyle ?? preset.wrapperStyle ?? '',
    beforeHtml: preset.beforeHtml ?? '',
    afterHtml: preset.afterHtml ?? '',
  };
}
