import { useLayoutEffect, useRef } from 'react';
import Phrase from './Phrase';
import { useLang, pick } from '../lib/lang';
import { useScene, gsap, ScrollTrigger, DUR, EASE } from '../lib/motion';
import { PARTS, PRESENTERS, BEATS } from '../data/beats';
import GaulMap from '../visuals/GaulMap';
import { CaesarCard, VercingetorixCard } from '../visuals/Cards';
import RhineBritain from '../visuals/RhineBritain';
import Gergovie from '../visuals/Gergovie';
import { SiegeBuild, SiegeFamine } from '../visuals/Siege';
import FinalAttackGame from '../visuals/FinalAttackGame';
import Legacy from '../visuals/Legacy';

function Visual({ v }) {
  switch (v.kind) {
    case 'map':
      return (
        <>
          <GaulMap mode={v.mode} />
          {v.card === 'vercingetorix' && <VercingetorixCard />}
        </>
      );
    case 'caesar': return <CaesarCard />;
    case 'rhine': return <RhineBritain />;
    case 'gergovie': return <Gergovie />;
    case 'alesia': return v.mode === 'famine' ? <SiegeFamine /> : <SiegeBuild />;
    case 'game': return <FinalAttackGame />;
    case 'legacy': return <Legacy />;
    default: return null;
  }
}

export default function Beat({ beat, onActive }) {
  const { lang } = useLang();
  const ref = useRef(null);
  const part = PARTS[beat.part];
  const nextBeat = BEATS.find((b) => b.n === beat.n + 1);
  const nextPresenter = nextBeat ? PRESENTERS[PARTS[nextBeat.part].presenter] : null;
  const headingId = `beat-${beat.n}-title`;

  // which beat is on screen → sky + rail
  useLayoutEffect(() => {
    const st = ScrollTrigger.create({
      trigger: ref.current,
      start: 'top 55%',
      end: 'bottom 55%',
      onToggle: (self) => { if (self.isActive) onActive(beat.n); },
    });
    return () => st.kill();
  }, [beat.n, onActive]);

  // text reveal: fade + small rise, never a slide from off-screen
  useScene(ref, ({ root, q }) => {
    gsap.from(q('.reveal'), {
      opacity: 0, y: 12, duration: DUR.slow, ease: EASE.out, stagger: 0.1, clearProps: 'transform',
      scrollTrigger: { trigger: root, start: 'top 72%', toggleActions: 'play none none reverse' },
    });
  });

  return (
    <section
      id={`beat-${beat.n}`}
      ref={ref}
      className={`beat beat-${beat.visual.kind}`}
      aria-labelledby={headingId}
      tabIndex={-1}
      data-beat={beat.n}
    >
      <div className="beat-copy panel">
        <p className="eyebrow reveal">
          <span className="beat-num">{String(beat.n).padStart(2, '0')}<span className="beat-of"> / 12</span></span>
          <span className="eyebrow-sep" aria-hidden="true">·</span>
          <Phrase text={beat.date} />
        </p>
        <p className="part-tag reveal">
          <Phrase text={{ fr: `Partie ${beat.part}`, en: `Part ${beat.part}` }} /> — {pick(part, lang)}
          <span className="presenter">{PRESENTERS[part.presenter]}</span>
        </p>
        <Phrase as="h2" id={headingId} text={beat.title} className="beat-title reveal" />
        <blockquote className="beat-line reveal">
          <Phrase as="p" text={beat.line} />
        </blockquote>
        {beat.body.map((p, i) => <Phrase key={i} as="p" text={p} className="beat-body reveal" />)}
        {beat.facts && (
          <ul className="facts reveal">
            {beat.facts.map((f) => (
              <li key={f.value + f.label.fr}>
                <span className="fact-value">{f.value}</span>
                <Phrase text={f.label} className="fact-label" />
              </li>
            ))}
          </ul>
        )}
        {beat.handover && (
          <div className="handover reveal">
            <p className="handover-kicker">
              {lang === 'en' ? 'Hand-over' : 'Passage de relais'}
              {nextPresenter && <> → <span className="presenter">{nextPresenter}</span></>}
            </p>
            <Phrase as="p" text={beat.handover} className="handover-line" />
          </div>
        )}
      </div>
      <div className="beat-visual">
        <Visual v={beat.visual} />
      </div>
    </section>
  );
}
