/**
 * Lenis smooth scroll wrapper — encapsulated init/destroy/toggle.
 * Respects prefers-reduced-motion and disables on mobile (touch).
 *
 * Usage (in preview or published runtime):
 *   import { initLenis, destroyLenis } from '@/lib/motion/lenis';
 *   const lenis = initLenis({ intensity: 'medium' });
 *   // on cleanup:
 *   destroyLenis();
 */

import Lenis from 'lenis';

let instance: Lenis | null = null;
let rafId: number | null = null;

export interface LenisOptions {
  intensity?: 'low' | 'medium' | 'high';
  wrapper?: HTMLElement | Window;
  content?: HTMLElement;
}

const DURATION_MAP: Record<string, number> = {
  low: 0.8,
  medium: 1.2,
  high: 1.6,
};

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Initialize Lenis smooth scroll.
 * Returns the Lenis instance or null if skipped (reduced-motion / mobile).
 */
export function initLenis(opts: LenisOptions = {}): Lenis | null {
  // Skip if reduced motion or touch device
  if (prefersReducedMotion() || isTouchDevice()) return null;

  // Avoid double-init
  if (instance) return instance;

  const duration = DURATION_MAP[opts.intensity ?? 'medium'] ?? 1.2;

  instance = new Lenis({
    duration,
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    orientation: 'vertical',
    gestureOrientation: 'vertical',
    smoothWheel: true,
    ...(opts.wrapper && opts.wrapper !== window ? { wrapper: opts.wrapper as HTMLElement } : {}),
    ...(opts.content ? { content: opts.content } : {}),
  });

  function raf(time: number) {
    instance?.raf(time);
    rafId = requestAnimationFrame(raf);
  }
  rafId = requestAnimationFrame(raf);

  return instance;
}

/** Pause smooth scroll (e.g. when modal is open). */
export function pauseLenis(): void {
  instance?.stop();
}

/** Resume smooth scroll. */
export function resumeLenis(): void {
  instance?.start();
}

/** Completely destroy Lenis and free resources. */
export function destroyLenis(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  instance?.destroy();
  instance = null;
}

/** Get current Lenis instance (or null). */
export function getLenis(): Lenis | null {
  return instance;
}
