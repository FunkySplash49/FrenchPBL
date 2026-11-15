import { useRef } from 'react';
import { useLang } from '../lib/lang';
import { useScene, gsap, sceneTrigger, DUR, EASE } from '../lib/motion';

/* Beat 8 — "Rome counter drops, Gaul rises". Momentum is illustrative; the losses are Caesar's own figures. */
export default function Gergovie() {
  const { lang } = useLang();
  const en = lang === 'en';
  const ref = useRef(null);

  useScene(ref, ({ root, q }) => {
    gsap.timeline({ scrollTrigger: sceneTrigger(root), defaults: { ease: EASE.out } })
      .fromTo(q('.mo-rome .mo-fill'), { scaleX: 0.9 }, { scaleX: 0.42, duration: DUR.cinematic, ease: EASE.cinematic })
      .fromTo(q('.mo-gaul .mo-fill'), { scaleX: 0.35 }, { scaleX: 0.88, duration: DUR.cinematic, ease: EASE.cinematic }, '<')
      .from(q('.centurion'), { opacity: 0, scale: 0, transformOrigin: '50% 50%', duration: DUR.fast, stagger: 0.025 }, '-=0.8')
      .from(q('.losses-text'), { opacity: 0, y: 8, duration: DUR.base })
      .from(q('.aedui-chip .chip-gaul'), { opacity: 0, duration: DUR.slow }, '+=0.2')
      .from(q('.aedui-note'), { opacity: 0, y: 6, duration: DUR.base });
  });

  return (
    <figure className="viz viz-gergovie" ref={ref}>
      <p className="viz-title">{en ? 'Momentum after Gergovie' : 'L’élan après Gergovie'}</p>
      <div className="momentum">
        <div className="mo mo-rome">
          <span className="mo-label"><span className="sw sw-rome" aria-hidden="true" />Rome</span>
          <span className="mo-bar"><span className="mo-fill" /></span>
          <span className="mo-arrow" aria-label={en ? 'falling' : 'en baisse'}>↓</span>
        </div>
        <div className="mo mo-gaul">
          <span className="mo-label"><span className="sw sw-gaul" aria-hidden="true" />{en ? 'Gauls' : 'Gaulois'}</span>
          <span className="mo-bar"><span className="mo-fill" /></span>
          <span className="mo-arrow" aria-label={en ? 'rising' : 'en hausse'}>↑</span>
        </div>
      </div>

      <div className="losses">
        <svg viewBox="0 0 230 50" className="centurions" role="img"
          aria-label={en ? '46 squares: the 46 centurions Caesar admits losing' : '46 carrés : les 46 centurions que César avoue avoir perdus'}>
          {Array.from({ length: 46 }, (_, i) => (
            <rect key={i} x={(i % 23) * 10} y={Math.floor(i / 23) * 12 + 14} width="7" height="7" className="unit-rome centurion" />
          ))}
        </svg>
        <p className="losses-text">
          <strong>46</strong> {en ? 'centurions and' : 'centurions et'} <strong>~700</strong> {en ? 'men lost — according to Caesar. Modern estimates are higher.' : 'hommes perdus — selon César. Les historiens pensent que c’est davantage.'}
        </p>
      </div>

      <div className="aedui">
        <span className="aedui-chip" aria-hidden="true">
          <span className="chip-rome">■ Rome</span>
          <span className="chip-gaul">● {en ? 'Gauls' : 'Gaule'}</span>
        </span>
        <p className="aedui-note">
          <strong>{en ? 'The Éduens switch sides.' : 'Les Éduens changent de camp.'}</strong>{' '}
          {en ? 'Rome’s oldest ally in Gaul joins the revolt.' : 'Le plus vieil allié de Rome en Gaule rejoint la révolte.'}
        </p>
      </div>
    </figure>
  );
}
