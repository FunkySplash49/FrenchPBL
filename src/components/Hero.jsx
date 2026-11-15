import { useLayoutEffect, useRef } from 'react';
import { useLang } from '../lib/lang';
import { useScene, gsap, ScrollTrigger, DUR, EASE } from '../lib/motion';

/* Opening title. The two rings behind the wordmark are the two Roman lines. */
export default function Hero({ onActive, onStart }) {
  const { lang } = useLang();
  const en = lang === 'en';
  const ref = useRef(null);

  useLayoutEffect(() => {
    const st = ScrollTrigger.create({
      trigger: ref.current, start: 'top 55%', end: 'bottom 55%',
      onToggle: (s) => { if (s.isActive) onActive(0); },
    });
    return () => st.kill();
  }, [onActive]);

  useScene(ref, ({ q }) => {
    gsap.timeline({ defaults: { ease: EASE.out } })
      .from(q('.ring'), { strokeDashoffset: 1, duration: DUR.cinematic * 1.2, ease: EASE.cinematic, stagger: 0.3 })
      .from(q('.hero-word'), { opacity: 0, y: 16, duration: DUR.slow }, 0.4)
      .from(q('.hero-sub, .hero-lead, .hero-actions'), { opacity: 0, y: 12, duration: DUR.slow, stagger: 0.12 }, '-=0.3');
  });

  return (
    <section id="beat-0" className="hero" ref={ref} aria-labelledby="hero-title" tabIndex={-1}>
      <svg className="hero-rings" viewBox="0 0 600 400" aria-hidden="true">
        <ellipse cx="300" cy="200" rx="270" ry="170" pathLength="1" className="ring ring-outer" />
        <ellipse cx="300" cy="200" rx="200" ry="120" pathLength="1" className="ring ring-inner" />
      </svg>
      <div className="hero-inner">
        <p className="hero-sub eyebrow">
          {en ? 'September 52 BC · Caesar against Vercingétorix' : 'Septembre 52 av. J.-C. · César contre Vercingétorix'}
        </p>
        <h1 id="hero-title" className="hero-word" lang="fr">Alésia</h1>
        <p className="hero-lead">
          {en
            ? 'How a siege inside a siege ended Gallic independence — in 12 steps.'
            : 'Comment un siège dans le siège a mis fin à la Gaule indépendante — en 12 étapes.'}
        </p>
        <div className="hero-actions">
          <button type="button" className="btn-primary" onClick={onStart}>
            {en ? 'Begin' : 'Commencer'}
          </button>
          <p className="hero-keys">
            {en ? 'Scroll, or press' : 'Défilez, ou appuyez sur'} <kbd>→</kbd> / <kbd>{en ? 'Space' : 'Espace'}</kbd>
          </p>
        </div>
      </div>
    </section>
  );
}
