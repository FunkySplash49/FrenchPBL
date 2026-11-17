/*
 * Is the page being flung right now — a fast scroll passing steps by rather than reading
 * them (same threshold as the backdrop's scene switch, components/ui/crt-scenes)?
 * One passive scroll listener for the whole page.
 */
const FLING = 1.2; // px/ms ≈ 70 px per frame
let at = -1e9; let y = 0; let speed = 0;

if (typeof window !== 'undefined') {
  y = window.scrollY;
  window.addEventListener('scroll', () => {
    const now = performance.now(); const ny = window.scrollY;
    if (ny === y) return;
    const inst = Math.abs(ny - y) / Math.max(8, now - at);
    speed = now - at > 120 ? inst : speed * 0.5 + inst * 0.5;
    y = ny; at = now;
  }, { passive: true });
}

export function isFlinging() {
  return performance.now() - at < 120 && speed >= FLING;
}

/** Run fn once the page is not being flung (at once if it isn't). Returns a cancel function. */
export function afterFling(fn) {
  let t = 0;
  const go = () => { if (isFlinging()) t = setTimeout(go, 50); else fn(); };
  go();
  return () => clearTimeout(t);
}
