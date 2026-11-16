import { useState } from 'react';

/*
 * Old-TV glass laid over a diagram box (.viz): scanlines, vignette, a warm middle band
 * and, now and then, a soft tracking band rolling down (styles/viz-tv.css).
 * Purely decorative and pointer-events: none, so every click lands on the real content.
 * Each box starts its roll at a different moment so they never pass in sync.
 */
const CYCLE_S = 15; // keep in sync with --tv-cycle

export default function TvScreen() {
  const [delay] = useState(() => `${-(Math.random() * CYCLE_S).toFixed(2)}s`);
  return (
    <span className="tv-fx" aria-hidden="true">
      <span className="tv-roll" style={{ animationDelay: delay }} />
    </span>
  );
}
