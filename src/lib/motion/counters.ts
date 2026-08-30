/**
 * Animated number counter — counts from 0 to target on scroll visibility.
 *
 * Usage:
 *   import { initCounters } from '@/lib/motion/counters';
 *   initCounters(document);
 *
 * HTML: <span data-counter="1500" data-counter-suffix="+" data-counter-duration="2">0</span>
 */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { registerGSAP } from './gsap';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function formatNumber(n: number, decimals: number): string {
  if (decimals > 0) return n.toFixed(decimals);
  return Math.round(n).toLocaleString('pt-BR');
}

/**
 * Initialize counters on all [data-counter] elements within root.
 * Options read from data attributes:
 * - data-counter="1500"         → target number
 * - data-counter-suffix="+"     → suffix text (optional)
 * - data-counter-prefix="R$ "   → prefix text (optional)
 * - data-counter-duration="2"   → animation duration in seconds (default 2)
 * - data-counter-decimals="0"   → decimal places (default 0)
 */
export function initCounters(root: Document | HTMLElement): void {
  registerGSAP();

  const elements = root.querySelectorAll<HTMLElement>('[data-counter]');

  elements.forEach((el) => {
    const target = parseFloat(el.dataset.counter ?? '0');
    const suffix = el.dataset.counterSuffix ?? '';
    const prefix = el.dataset.counterPrefix ?? '';
    const duration = parseFloat(el.dataset.counterDuration ?? '2');
    const decimals = parseInt(el.dataset.counterDecimals ?? '0', 10);

    if (isNaN(target)) return;

    // If reduced motion, show final value immediately
    if (prefersReducedMotion()) {
      el.textContent = `${prefix}${formatNumber(target, decimals)}${suffix}`;
      return;
    }

    const proxy = { value: 0 };

    gsap.to(proxy, {
      value: target,
      duration,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 85%',
        once: true,
      },
      onUpdate: () => {
        el.textContent = `${prefix}${formatNumber(proxy.value, decimals)}${suffix}`;
      },
    });
  });
}
