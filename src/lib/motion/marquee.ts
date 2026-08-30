/**
 * Marquee — infinite horizontal scroll for logos, testimonials, etc.
 * Falls back to pure CSS animation if JS unavailable.
 *
 * Usage:
 *   import { initMarquees } from '@/lib/motion/marquee';
 *   initMarquees(document, 'medium');
 *
 * HTML structure:
 *   <div data-marquee data-marquee-speed="40" data-marquee-direction="left" data-marquee-pause-hover="true">
 *     <div data-marquee-content>
 *       <!-- items -->
 *     </div>
 *   </div>
 *
 * CSS fallback (always included):
 *   @keyframes lp-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
 *   [data-marquee-content] { display: flex; animation: lp-marquee var(--marquee-duration, 20s) linear infinite; }
 */

export type MotionIntensity = 'low' | 'medium' | 'high';

const SPEED_SCALE: Record<MotionIntensity, number> = {
  low: 0.6,
  medium: 1.0,
  high: 1.5,
};

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface MarqueeInstance {
  el: HTMLElement;
  content: HTMLElement;
  clone: HTMLElement | null;
  paused: boolean;
  destroy: () => void;
}

const instances: MarqueeInstance[] = [];

/**
 * Initialize all [data-marquee] elements in root.
 * Duplicates content for seamless loop, calculates duration based on content width.
 */
export function initMarquees(
  root: Document | HTMLElement,
  intensity: MotionIntensity = 'medium',
): void {
  const marquees = root.querySelectorAll<HTMLElement>('[data-marquee]');
  const speedScale = SPEED_SCALE[intensity];

  marquees.forEach((el) => {
    const content = el.querySelector<HTMLElement>('[data-marquee-content]');
    if (!content) return;

    const baseSpeed = parseFloat(el.dataset.marqueeSpeed ?? '40'); // px per second
    const direction = el.dataset.marqueeDirection ?? 'left';
    const pauseOnHover = el.dataset.marqueePauseHover === 'true';

    // If reduced motion, show static
    if (prefersReducedMotion()) {
      content.style.animation = 'none';
      return;
    }

    // Clone content for seamless loop
    const clone = content.cloneNode(true) as HTMLElement;
    clone.setAttribute('aria-hidden', 'true');
    el.appendChild(clone);

    // Calculate duration based on content width
    const contentWidth = content.scrollWidth;
    const speed = baseSpeed * speedScale;
    const duration = contentWidth / speed;

    // Apply CSS animation
    const animDirection = direction === 'right' ? 'reverse' : 'normal';
    const cssVar = `${duration}s`;
    content.style.setProperty('--marquee-duration', cssVar);
    clone.style.setProperty('--marquee-duration', cssVar);
    content.style.animationDirection = animDirection;
    clone.style.animationDirection = animDirection;

    let paused = false;

    // Pause on hover
    const onEnter = () => {
      if (!pauseOnHover) return;
      content.style.animationPlayState = 'paused';
      clone.style.animationPlayState = 'paused';
      paused = true;
    };
    const onLeave = () => {
      if (!pauseOnHover) return;
      content.style.animationPlayState = 'running';
      clone.style.animationPlayState = 'running';
      paused = false;
    };

    if (pauseOnHover) {
      el.addEventListener('mouseenter', onEnter);
      el.addEventListener('mouseleave', onLeave);
    }

    const instance: MarqueeInstance = {
      el,
      content,
      clone,
      paused,
      destroy: () => {
        if (pauseOnHover) {
          el.removeEventListener('mouseenter', onEnter);
          el.removeEventListener('mouseleave', onLeave);
        }
        clone.remove();
      },
    };
    instances.push(instance);
  });
}

/** Destroy all marquee instances and remove clones. */
export function destroyMarquees(): void {
  instances.forEach((inst) => inst.destroy());
  instances.length = 0;
}

/**
 * Generate CSS keyframes for marquee fallback (include in published HTML).
 */
export function getMarqueeCSS(): string {
  return `
@keyframes lp-marquee {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
[data-marquee] {
  overflow: hidden;
  position: relative;
}
[data-marquee]::before,
[data-marquee]::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 60px;
  z-index: 2;
  pointer-events: none;
}
[data-marquee]::before {
  left: 0;
  background: linear-gradient(to right, var(--lp-bg, #fff), transparent);
}
[data-marquee]::after {
  right: 0;
  background: linear-gradient(to left, var(--lp-bg, #fff), transparent);
}
[data-marquee-content] {
  display: flex;
  gap: 2rem;
  flex-shrink: 0;
  animation: lp-marquee var(--marquee-duration, 20s) linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  [data-marquee-content] { animation: none !important; }
}
`.trim();
}
