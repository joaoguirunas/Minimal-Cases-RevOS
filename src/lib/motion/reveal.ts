/**
 * Reveal animation presets — higher-level abstraction over GSAP ScrollTrigger.
 *
 * Usage:
 *   import { applyRevealPreset, applyRevealsToPage } from '@/lib/motion/reveal';
 *   applyRevealPreset(element, 'fadeUp');
 *   // or batch:
 *   applyRevealsToPage(document, 'medium');
 */

import { createScrollReveal, createStaggerReveal, type ScrollRevealOptions } from './gsap';

export type RevealPreset = 'fadeUp' | 'fadeIn' | 'slideLeft' | 'slideRight' | 'scale' | 'stagger';
export type MotionIntensity = 'low' | 'medium' | 'high';

interface PresetConfig extends ScrollRevealOptions {
  /** For stagger preset, the child selector */
  childSelector?: string;
}

const PRESETS: Record<RevealPreset, PresetConfig> = {
  fadeUp: {
    y: 30,
    opacity: 0,
    duration: 0.7,
    ease: 'power3.out',
  },
  fadeIn: {
    opacity: 0,
    duration: 0.5,
    ease: 'power2.out',
  },
  slideLeft: {
    x: -40,
    opacity: 0,
    duration: 0.7,
    ease: 'power3.out',
  },
  slideRight: {
    x: 40,
    opacity: 0,
    duration: 0.7,
    ease: 'power3.out',
  },
  scale: {
    opacity: 0,
    scale: 0.95,
    duration: 0.5,
    ease: 'power2.out',
  },
  stagger: {
    y: 20,
    opacity: 0,
    duration: 0.6,
    stagger: 0.08,
    ease: 'power3.out',
    childSelector: ':scope > *',
  },
};

/** Intensity multipliers: mobile-friendly low, dramatic high. */
const INTENSITY_SCALE: Record<MotionIntensity, { distance: number; duration: number; stagger: number }> = {
  low:    { distance: 0.5,  duration: 0.8, stagger: 0.6 },
  medium: { distance: 1.0,  duration: 1.0, stagger: 1.0 },
  high:   { distance: 1.4,  duration: 1.2, stagger: 1.3 },
};

function scalePreset(preset: PresetConfig, intensity: MotionIntensity): PresetConfig {
  const scale = INTENSITY_SCALE[intensity];
  const scaled = { ...preset };
  if (scaled.y) scaled.y = Math.round(scaled.y * scale.distance);
  if (scaled.x) scaled.x = Math.round(scaled.x * scale.distance);
  if (scaled.duration) scaled.duration = scaled.duration * scale.duration;
  if (scaled.stagger) scaled.stagger = scaled.stagger * scale.stagger;
  return scaled;
}

/**
 * Apply a reveal preset to a single element.
 */
export function applyRevealPreset(
  element: Element,
  preset: RevealPreset,
  intensity: MotionIntensity = 'medium',
  extraOpts: ScrollRevealOptions = {},
) {
  const config = scalePreset(PRESETS[preset], intensity);

  if (preset === 'stagger' && config.childSelector) {
    return createStaggerReveal(element, config.childSelector, { ...config, ...extraOpts });
  }
  return createScrollReveal(element, { ...config, ...extraOpts });
}

/**
 * Auto-apply reveals to all elements with [data-reveal] attribute.
 * data-reveal value is the preset name (e.g. data-reveal="fadeUp").
 */
export function applyRevealsToPage(
  root: Document | HTMLElement,
  intensity: MotionIntensity = 'medium',
) {
  const elements = root.querySelectorAll<HTMLElement>('[data-reveal]');
  elements.forEach((el) => {
    const preset = (el.dataset.reveal || 'fadeUp') as RevealPreset;
    if (PRESETS[preset]) {
      applyRevealPreset(el, preset, intensity);
    }
  });
}
