/**
 * LP PRO™ Motion Library — centralized exports.
 *
 * All motion functionality is encapsulated here.
 * Components should never import GSAP/Lenis directly — use these wrappers.
 */

// Smooth scroll
export { initLenis, destroyLenis, pauseLenis, resumeLenis, getLenis } from './lenis';
export type { LenisOptions } from './lenis';

// GSAP + ScrollTrigger
export {
  registerGSAP,
  createScrollReveal,
  createStaggerReveal,
  killAllScrollTriggers,
  refreshScrollTriggers,
} from './gsap';
export type { ScrollRevealOptions } from './gsap';

// Reveal presets
export { applyRevealPreset, applyRevealsToPage } from './reveal';
export type { RevealPreset, MotionIntensity } from './reveal';

// Animated counters
export { initCounters } from './counters';

// Marquee
export { initMarquees, destroyMarquees, getMarqueeCSS } from './marquee';

/**
 * Initialize all motion features for a published page.
 * Call once after DOM is ready.
 */
export async function initPageMotion(opts: {
  intensity?: import('./reveal').MotionIntensity;
  smoothScroll?: boolean;
  reveals?: boolean;
  counters?: boolean;
  marquees?: boolean;
  root?: Document | HTMLElement;
} = {}): Promise<void> {
  const {
    intensity = 'medium',
    smoothScroll = true,
    reveals = true,
    counters = true,
    marquees = true,
    root = document,
  } = opts;

  // Check prefers-reduced-motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Still init counters (they handle reduced motion internally — show final values)
    if (counters) {
      const { initCounters: initC } = await import('./counters');
      initC(root);
    }
    return;
  }

  // Init smooth scroll
  if (smoothScroll) {
    const { initLenis: initL } = await import('./lenis');
    initL({ intensity });
  }

  // Register GSAP
  const { registerGSAP: reg } = await import('./gsap');
  reg();

  // Apply reveal animations
  if (reveals) {
    const { applyRevealsToPage: apply } = await import('./reveal');
    apply(root, intensity);
  }

  // Init counters
  if (counters) {
    const { initCounters: initC } = await import('./counters');
    initC(root);
  }

  // Init marquees
  if (marquees) {
    const { initMarquees: initM } = await import('./marquee');
    initM(root, intensity);
  }
}

/**
 * Cleanup all motion features. Call on unmount/navigation.
 */
export function destroyPageMotion(): void {
  // Import synchronously — these are already loaded if initPageMotion was called
  import('./lenis').then(({ destroyLenis }) => destroyLenis());
  import('./gsap').then(({ killAllScrollTriggers }) => killAllScrollTriggers());
  import('./marquee').then(({ destroyMarquees }) => destroyMarquees());
}
