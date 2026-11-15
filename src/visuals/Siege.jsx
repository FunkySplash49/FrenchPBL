import { useRef } from 'react';
import AlesiaPlan, { PlanKey } from './AlesiaPlan';
import ZoomToggle from '../components/ZoomToggle';
import { useLive, Brackets } from './motionKit';
import { useLang } from '../lib/lang';
import { useScene, gsap, sceneTrigger, DUR, EASE, STAGGER } from '../lib/motion';

function Legend({ en, civilians }) {
  return (
    <span className="legend" aria-hidden="true">
      <span className="legend-item"><span className="sw sw-rome" />{en ? 'Roman forts & camps' : 'Forts et camps romains'}</span>
      <span className="legend-item"><span className="sw sw-gaul" />{en ? 'Gauls' : 'Gaulois'}</span>
      {civilians && <span className="legend-item"><span className="sw sw-civ" />{en ? 'Mandubii civilians' : 'Civils mandubiens'}</span>}
    </span>
  );
}

/* Beat 9 — camera pans in, Rome encircles: inner line, forts, outer line, camps. */
export function SiegeBuild() {
  const { lang } = useLang();
  const ref = useRef(null);
  const live = useLive(ref);

  useScene(ref, ({ root, q }) => {
    const tl = gsap.timeline({ scrollTrigger: sceneTrigger(root), defaults: { ease: EASE.out } });
    tl.from(q('.plan-scene'), { scale: 0.55, opacity: 0, transformOrigin: '55% 50%', duration: DUR.cinematic, ease: EASE.cinematic })
      .from(q('.wall-inner'), { strokeDashoffset: 1, duration: DUR.cinematic, ease: 'none' }, '-=0.3')
      // methodical, evenly timed — Rome builds
      .from(q('.fort'), { scale: 0, transformOrigin: '50% 50%', duration: DUR.fast, stagger: 0.05 }, '<0.2')
      .from(q('.wall-outer'), { strokeDashoffset: 1, duration: DUR.cinematic, ease: 'none', stagger: 0.15 })
      .from(q('.camp'), { scale: 0, opacity: 0, transformOrigin: '50% 50%', duration: DUR.base, stagger: 0.1 }, '<0.4')
      .from(q('.wall-labels .tag'), { opacity: 0, y: 6, duration: DUR.base, stagger: STAGGER * 2 });
  });

  const en = lang === 'en';
  return (
    <figure className="viz viz-plan" ref={ref}>
      <Brackets />
      <ZoomToggle target={ref} />
      <AlesiaPlan mode="build" live={live} />
      <PlanKey />
      <figcaption className="viz-caption">
        <span>{en
          ? 'Schematic plan, not to scale. Both walls are Roman: one traps the town, one keeps the relief army out.'
          : "Plan schématique, pas à l'échelle. Les deux murs sont romains : l'un enferme la ville, l'autre arrête l'armée de secours."}</span>
        <Legend en={en} />
      </figcaption>
    </figure>
  );
}

/* Beat 10 — food runs out inside; civilians trapped between the lines; the relief army arrives. */
export function SiegeFamine() {
  const { lang } = useLang();
  const ref = useRef(null);
  const daysRef = useRef(null);
  const live = useLive(ref);

  useScene(ref, ({ root, q }) => {
    const counter = { v: 30 };
    const show = () => { if (daysRef.current) daysRef.current.textContent = String(Math.round(counter.v)); };
    const tl = gsap.timeline({ scrollTrigger: sceneTrigger(root), defaults: { ease: EASE.out } });
    tl.fromTo(q('.food-fill'), { scaleX: 1 }, { scaleX: 0, duration: 2.6, ease: 'power1.in' })
      .fromTo(counter, { v: 30 }, { v: 0, duration: 2.6, ease: 'power1.in', onUpdate: show }, '<')
      .from(q('.civilian'), { opacity: 0, x: 18, duration: DUR.slow, stagger: { each: 0.05, from: 'random' } }, '-=1.4')
      // Gaul surges — relief army arrives from the west, in waves, slightly irregular
      .from(q('.relief-unit'), {
        x: -90, opacity: 0, duration: DUR.cinematic, ease: EASE.out,
        stagger: { each: 0.06, from: 'random' },
      }, '-=0.4');
  });

  const en = lang === 'en';
  return (
    <figure className="viz viz-plan" ref={ref}>
      <Brackets />
      <ZoomToggle target={ref} />
      <div className="food" role="img" aria-label={en ? 'Food inside the town: about 30 days, then nothing.' : 'Vivres dans la ville : environ 30 jours, puis plus rien.'}>
        <span className="food-label">{en ? 'Food' : 'Vivres'}</span>
        <span className="food-bar"><span className="food-fill" /></span>
        <span className="food-days" aria-hidden="true"><span ref={daysRef}>0</span> / 30 {en ? 'days' : 'jours'}</span>
      </div>
      <AlesiaPlan mode="famine" live={live} />
      <PlanKey showRelief civilians />
      <figcaption className="viz-caption">
        <span>{en
          ? 'Inside: hunger. Between the lines: the expelled civilians. Outside: the relief army.'
          : "Dedans : la faim. Entre les lignes : les civils chassés. Dehors : l'armée de secours."}</span>
        <Legend en={en} civilians />
      </figcaption>
    </figure>
  );
}
