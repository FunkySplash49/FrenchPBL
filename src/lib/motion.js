import { useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/* Motion tokens — DESIGN.md §4.1 (GSAP equivalents of the CSS vars). */
export const DUR = { instant: 0.1, fast: 0.2, base: 0.4, slow: 0.8, cinematic: 1.6 };
export const EASE = { out: 'power3.out', in: 'power3.in', cinematic: 'power2.inOut' };
export const STAGGER = 0.06;

export const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
export const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia(REDUCED_QUERY).matches;

/**
 * Scroll trigger used by every story scene: plays when the scene enters,
 * resets when the reader scrolls back above it (so it replays on the way down).
 */
export const sceneTrigger = (trigger, extra = {}) => ({
  trigger,
  start: 'top 68%',
  toggleActions: 'play none none reset',
  ...extra,
});

/**
 * Build GSAP animations scoped to `ref`.
 * - Runs only when the reader has NOT asked for reduced motion (DESIGN.md §4.3).
 * - The DOM's default (un-animated) state is always the final, readable state;
 *   scenes animate *from* a hidden/initial state, so with JS or motion off everything shows.
 * - `build({ root, q })` — q is a scoped selector.
 */
export function useScene(ref, build, deps = []) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const mm = gsap.matchMedia(root);
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      build({ root, q: gsap.utils.selector(root) });
    });
    return () => mm.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export { gsap, ScrollTrigger };
