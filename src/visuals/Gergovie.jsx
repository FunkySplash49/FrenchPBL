import { useId, useRef, useState } from 'react';
import { useLang, pick } from '../lib/lang';
import { useScene, gsap, sceneTrigger, DUR, EASE } from '../lib/motion';
import { haptic } from '../lib/haptics';
import { Brackets } from './motionKit';

/*
 * Beat 8 — the fortunes of war in 52 BC, as a chart you can scrub
 * (after ink-orbit's forecast card). Above the line Rome has the upper hand, below it Gaul.
 * The curve is ILLUSTRATIVE (a reading of events, not data); the losses are Caesar's own figures.
 */
const EVENTS = [
  { v: 60,  when: { fr: 'Hiver 53', en: 'Winter 53' }, what: { fr: 'Rome tient la Gaule, les révoltes sont écrasées.', en: 'Rome holds Gaul; revolts are crushed.' } },
  { v: 12,  when: { fr: 'Début 52', en: 'Early 52' }, what: { fr: 'Vercingétorix soulève la Gaule.', en: 'Vercingétorix raises Gaul.' } },
  { v: -8,  when: { fr: 'Printemps 52', en: 'Spring 52' }, what: { fr: 'La terre brûlée affame les Romains.', en: 'Scorched earth starves the Romans.' } },
  { v: 34,  when: { fr: 'Avaricum', en: 'Avaricum' }, what: { fr: 'César prend la ville : ~800 survivants sur ~40 000.', en: 'Caesar takes the town: ~800 escape of ~40,000.' } },
  { v: -42, when: { fr: 'Gergovie', en: 'Gergovie' }, what: { fr: 'César battu : 46 centurions et ~700 hommes perdus.', en: 'Caesar beaten: 46 centurions and ~700 men lost.' } },
  { v: -62, when: { fr: 'Été 52', en: 'Summer 52' }, what: { fr: 'Les Éduens, alliés de Rome, changent de camp.', en: 'The Éduens, Rome’s allies, switch sides.' } },
  { v: 22,  when: { fr: 'Juillet 52', en: 'July 52' }, what: { fr: 'La cavalerie de César gagne ; repli sur Alésia.', en: 'Caesar’s cavalry wins; retreat to Alésia.' } },
  { v: 88,  when: { fr: 'Septembre 52', en: 'September 52' }, what: { fr: 'Alésia : Vercingétorix se rend.', en: 'Alésia: Vercingétorix surrenders.' } },
];
const FOCUS = 4; // Gergovie
const W = 320;
const H = 160;
const PAD = 16;
const MID = H / 2;

const xs = EVENTS.map((_, i) => PAD + (i / (EVENTS.length - 1)) * (W - PAD * 2));
const ys = EVENTS.map((e) => MID - (e.v / 100) * (MID - PAD));
const PTS = xs.map((x, i) => [x, ys[i]]);

function smooth(points) {
  return points.reduce((d, [x, y], i) => {
    if (i === 0) return `M${x.toFixed(1)},${y.toFixed(1)}`;
    const [px, py] = points[i - 1];
    const cx = (px + x) / 2;
    return `${d} C${cx.toFixed(1)},${py.toFixed(1)} ${cx.toFixed(1)},${y.toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}`;
  }, '');
}
const LINE = smooth(PTS);
const AREA = `${LINE} L${xs[xs.length - 1]},${MID} L${xs[0]},${MID} Z`;

const nearest = (x) => xs.reduce((best, v, i) => (Math.abs(v - x) < Math.abs(xs[best] - x) ? i : best), 0);

export default function Gergovie() {
  const { lang } = useLang();
  const en = lang === 'en';
  const ref = useRef(null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [idx, setIdx] = useState(FOCUS);
  const lastTouch = useRef(false);

  useScene(ref, ({ root, q }) => {
    gsap.timeline({ scrollTrigger: sceneTrigger(root), defaults: { ease: EASE.out } })
      .from(q('.fx-line'), { strokeDashoffset: 1, duration: DUR.cinematic * 1.2, ease: EASE.cinematic })
      .from(q('.fx-area'), { opacity: 0, duration: DUR.slow }, '-=0.8')
      .from(q('.fx-cursor'), { opacity: 0, duration: DUR.base })
      .from(q('.centurion'), { opacity: 0, scale: 0, transformOrigin: '50% 50%', duration: DUR.fast, stagger: 0.025 }, '-=0.2')
      .from(q('.losses-text'), { opacity: 0, y: 8, duration: DUR.base })
      .from(q('.aedui-chip .chip-gaul'), { opacity: 0, duration: DUR.slow }, '+=0.2')
      .from(q('.aedui-note'), { opacity: 0, y: 6, duration: DUR.base });
  });

  const move = (i) => {
    if (i === idx) return;
    setIdx(i);
    if (lastTouch.current) haptic('tick');
  };
  const onPointer = (e) => {
    lastTouch.current = e.pointerType !== 'mouse';
    const r = e.currentTarget.getBoundingClientRect();
    move(nearest(((e.clientX - r.left) / r.width) * W));
  };
  const onKey = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      e.stopPropagation();
      lastTouch.current = false;
      move(Math.max(0, Math.min(EVENTS.length - 1, idx + (e.key === 'ArrowRight' ? 1 : -1))));
    }
  };

  const ev = EVENTS[idx];
  const [px, py] = PTS[idx];
  const rome = ev.v >= 0;
  const tipX = Math.max(46, Math.min(W - 46, px));
  const tipY = py < 40 ? py + 24 : py - 14;

  return (
    <figure className="viz viz-gergovie" ref={ref}>
      <Brackets />
      <p className="viz-title">{en ? 'Fortunes of war, 52 BC' : 'Le sort de la guerre en 52 av. J.-C.'}</p>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="fx-chart"
        tabIndex={0}
        role="slider"
        aria-label={en ? 'Who has the upper hand during 52 BC' : 'Qui a l’avantage au cours de 52 av. J.-C.'}
        aria-valuemin={0}
        aria-valuemax={EVENTS.length - 1}
        aria-valuenow={idx}
        aria-valuetext={`${pick(ev.when, lang)} : ${pick(ev.what, lang)}`}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onKeyDown={onKey}
      >
        <defs>
          <clipPath id={`${uid}-top`}><rect x="0" y="0" width={W} height={MID} /></clipPath>
          <clipPath id={`${uid}-bot`}><rect x="0" y={MID} width={W} height={MID} /></clipPath>
        </defs>
        {[0.25, 0.75].map((g) => <line key={g} x1={PAD} x2={W - PAD} y1={H * g} y2={H * g} className="fx-grid" />)}
        <path d={AREA} className="fx-area fx-area-rome" clipPath={`url(#${uid}-top)`} />
        <path d={AREA} className="fx-area fx-area-gaul" clipPath={`url(#${uid}-bot)`} />
        <line x1={PAD} x2={W - PAD} y1={MID} y2={MID} className="fx-zero" />
        <text x={PAD} y={PAD - 4} className="fx-axis">{en ? '▲ Rome ahead' : '▲ Rome en tête'}</text>
        <text x={PAD} y={H - 4} className="fx-axis">{en ? '▼ Gaul ahead' : '▼ la Gaule en tête'}</text>
        <path d={LINE} pathLength="1" className="fx-line" />
        {PTS.map(([x, y], i) => (
          EVENTS[i].v >= 0
            ? <rect key={i} x={x - 3} y={y - 3} width="6" height="6" className={`fx-pt fx-pt-rome${i === idx ? ' is-on' : ''}`} />
            : <circle key={i} cx={x} cy={y} r="3.4" className={`fx-pt fx-pt-gaul${i === idx ? ' is-on' : ''}`} />
        ))}
        <g className="fx-cursor">
          <line x1={px} x2={px} y1={PAD} y2={H - PAD} className="fx-cursor-line" />
          <circle cx={px} cy={py} r="9" className={`fx-halo ${rome ? 'is-rome' : 'is-gaul'}`} />
          <g transform={`translate(${tipX} ${tipY})`}>
            <rect x="-44" y="-12" width="88" height="16" rx="3" className="fx-tip" />
            <text x="0" y="0" textAnchor="middle" className="fx-tip-text">{pick(ev.when, lang)}</text>
          </g>
        </g>
      </svg>
      <p className="fx-readout" aria-hidden="true">
        <span className={`fx-badge ${rome ? 'is-rome' : 'is-gaul'}`}>{rome ? '■ Rome' : (en ? '● Gaul' : '● Gaule')}</span>
        <strong>{pick(ev.when, lang)}</strong> — {pick(ev.what, lang)}
      </p>
      <p className="fx-hint">
        {en ? 'Drag across the chart (or use ← →). The curve is an illustration, not data.' : 'Glissez sur la courbe (ou ← →). La courbe est une illustration, pas des données.'}
      </p>

      <div className="losses">
        <svg viewBox="0 0 230 50" className="centurions" role="img"
          aria-label={en ? '46 squares: the 46 centurions Caesar admits losing' : '46 carrés : les 46 centurions que César avoue avoir perdus'}>
          {Array.from({ length: 46 }, (_, i) => (
            <rect key={i} x={(i % 23) * 10} y={Math.floor(i / 23) * 12 + 14} width="7" height="7" className="unit-rome centurion" />
          ))}
        </svg>
        <p className="losses-text">
          <strong>46</strong> {en ? 'centurions and' : 'centurions et'} <strong>~700</strong> {en ? 'men lost at Gergovie — according to Caesar. Modern estimates are higher.' : 'hommes perdus à Gergovie — selon César. Les historiens pensent que c’est davantage.'}
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
