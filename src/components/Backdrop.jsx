import { useRef } from 'react';
import { useScene, gsap } from '../lib/motion';

/*
 * Fixed sunset behind the whole story (z-backdrop).
 * Light follows the story (DESIGN.md §4.2.3): the sun sinks and the sky darkens beat by beat,
 * darkest at the surrender. Skies are stacked layers crossfaded by opacity, never repainted.
 * Parallax only on the terrain layers (5–15 %), never on content.
 */
export const SKIES = ['gold', 'amber', 'ember', 'dusk', 'night', 'afterglow'];

/* sun drop (% of viewport height) per sky */
const SUN = { gold: 0, amber: 10, ember: 22, dusk: 34, night: 52, afterglow: 44 };

export default function Backdrop({ sky = 'gold' }) {
  const ref = useRef(null);

  useScene(ref, ({ q }) => {
    const st = { trigger: document.documentElement, start: 0, end: 'max', scrub: 1 };
    gsap.to(q('.terrain-far'), { yPercent: 5, ease: 'none', scrollTrigger: st });
    gsap.to(q('.terrain-mid'), { yPercent: 10, ease: 'none', scrollTrigger: st });
    gsap.to(q('.terrain-near'), { yPercent: 15, ease: 'none', scrollTrigger: st });
  });

  return (
    <div className="backdrop" ref={ref} aria-hidden="true">
      {SKIES.map((s) => (
        <div key={s} className={`sky sky-${s}${s === sky ? ' is-on' : ''}`} />
      ))}
      <div className="sun" style={{ transform: `translate(-50%, ${SUN[sky] ?? 0}vh)` }} />
      <svg className="terrain" viewBox="0 0 1440 360" preserveAspectRatio="xMidYMax slice">
        <path className="terrain-far" d="M0,210 C160,170 300,200 440,176 C600,150 720,190 860,168 C1010,146 1160,182 1300,160 L1440,150 L1440,360 L0,360 Z" />
        {/* Mont-Auxois: the flat-topped plateau of Alésia */}
        <path className="terrain-mid" d="M0,262 C140,240 260,258 380,240 C470,228 520,196 600,190 L840,186 C910,190 960,226 1060,240 C1180,256 1320,236 1440,248 L1440,360 L0,360 Z" />
        <path className="terrain-near" d="M0,306 C200,284 360,312 560,296 C760,280 900,314 1100,298 C1250,286 1360,304 1440,296 L1440,360 L0,360 Z" />
      </svg>
      <div className="vignette" />
    </div>
  );
}
