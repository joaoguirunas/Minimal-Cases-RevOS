/**
 * GSAP + ScrollTrigger wrapper — safe registration, scoped helpers, cleanup.
 *
 * Usage:
 *   import { registerGSAP, createScrollReveal, killAllScrollTriggers } from '@/lib/motion/gsap';
 *   registerGSAP();
 *   createScrollReveal(element, { y: 30, opacity: 0, duration: 0.8 });
 *   // on cleanup:
 *   killAllScrollTriggers();
 */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

let registered = false;

/** Register ScrollTrigger plugin (safe to call multiple times). */
export function registerGSAP(): void {
  if (registered) return;
  gsap.registerPlugin(ScrollTrigger);
  registered = true;
}

/** Check prefers-reduced-motion. */
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export interface ScrollRevealOptions {
  y?: number;
  x?: number;
  opacity?: number;
  scale?: number;
  duration?: number;
  delay?: number;
  ease?: string;
  start?: string;
  once?: boolean;
  stagger?: number;
  /** Container/scroller element (defaults to window) */
  scroller?: HTMLElement | Window;
}

const DEFAULT_OPTS: ScrollRevealOptions = {
  y: 30,
  opacity: 0,
  duration: 0.8,
  ease: 'power3.out',
  start: 'top 85%',
  once: true,
};

/**
 * Animate element from hidden state to visible on scroll.
 * Returns the ScrollTrigger instance for cleanup.
 */
export function createScrollReveal(
  element: Element | Element[],
  opts: ScrollRevealOptions = {},
): ScrollTrigger | null {
  if (prefersReducedMotion()) return null;
  if (!registered) registerGSAP();

  const merged = { ...DEFAULT_OPTS, ...opts };

  const fromVars: gsap.TweenVars = {
    opacity: merged.opacity ?? 0,
    duration: merged.duration,
    delay: merged.delay,
    ease: merged.ease,
  };
  if (merged.y) fromVars.y = merged.y;
  if (merged.x) fromVars.x = merged.x;
  if (merged.scale !== undefined) fromVars.scale = merged.scale;
  if (merged.stagger) fromVars.stagger = merged.stagger;

  fromVars.scrollTrigger = {
    trigger: Array.isArray(element) ? element[0] : element,
    start: merged.start,
    once: merged.once,
    ...(merged.scroller && merged.scroller !== window ? { scroller: merged.scroller } : {}),
  };

  const tween = gsap.from(element, fromVars);
  return tween.scrollTrigger ?? null;
}

/**
 * Batch-reveal children of a container with stagger.
 */
export function createStaggerReveal(
  container: Element,
  childSelector: string,
  opts: ScrollRevealOptions = {},
): ScrollTrigger | null {
  const children = Array.from(container.querySelectorAll(childSelector));
  if (children.length === 0) return null;
  return createScrollReveal(children, { stagger: 0.1, ...opts });
}

/** Kill all ScrollTrigger instances — call on unmount/navigation. */
export function killAllScrollTriggers(): void {
  ScrollTrigger.getAll().forEach((st) => st.kill());
}

/** Refresh all ScrollTrigger instances (after layout change). */
export function refreshScrollTriggers(): void {
  ScrollTrigger.refresh();
}

/** Export gsap and ScrollTrigger for advanced usage. */
export { gsap, ScrollTrigger };
