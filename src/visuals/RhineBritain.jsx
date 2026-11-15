import { useRef } from 'react';
import { useLang } from '../lib/lang';
import { useScene, gsap, sceneTrigger, DUR, EASE } from '../lib/motion';

/* Beat 5 — the Rhine bridge (built in 10 days) and the boats to Britain. Pure propaganda. */
const PILES = Array.from({ length: 9 }, (_, i) => 30 + i * 19);
const BOATS = [[250, 196], [290, 214], [330, 192], [270, 232], [318, 236]];

export default function RhineBritain() {
  const { lang } = useLang();
  const ref = useRef(null);
  const en = lang === 'en';

  useScene(ref, ({ root, q }) => {
    gsap.timeline({ scrollTrigger: sceneTrigger(root), defaults: { ease: EASE.out } })
      // Rome builds: methodical, evenly spaced
      .from(q('.pile'), { scaleY: 0, transformOrigin: '50% 100%', duration: DUR.fast, stagger: 0.09, ease: 'none' })
      .from(q('.deck'), { strokeDashoffset: 1, duration: DUR.slow, ease: 'none' })
      .from(q('.tag-days'), { opacity: 0, y: 6, duration: DUR.base })
      .from(q('.boat'), { y: 70, opacity: 0, duration: DUR.cinematic, ease: EASE.cinematic, stagger: 0.12 }, '-=0.6')
      .from(q('.tag-britain'), { opacity: 0, y: 6, duration: DUR.base });
  });

  return (
    <figure className="viz viz-rhine" ref={ref}>
      <svg viewBox="0 0 400 270" role="img" aria-labelledby="rb-t">
        <title id="rb-t">{en
          ? 'Left: a Roman bridge over the Rhine, built in 10 days (55 BC). Right: Roman boats crossing to Britain (55 and 54 BC).'
          : 'À gauche : un pont romain sur le Rhin, construit en 10 jours (55 av. J.-C.). À droite : des bateaux romains vers la Bretagne (55 et 54 av. J.-C.).'}</title>

        {/* Rhine panel */}
        <g>
          <text x="100" y="22" textAnchor="middle" className="plan-label">{en ? 'Rhine · 55' : 'Rhin · 55'}</text>
          <path d="M70,40 C90,90 60,150 90,200 C110,232 96,250 104,270 L176,270 C168,240 184,220 168,190 C140,140 168,90 150,40 Z" className="water" />
          <g>
            {PILES.map((x, i) => (
              <g key={i} className="pile">
                <rect x={x} y="136" width="4" height="40" className="unit-rome" />
                <rect x={x + 7} y="136" width="4" height="40" className="unit-rome" />
              </g>
            ))}
            <line x1="24" y1="134" x2="200" y2="134" pathLength="1" className="deck" />
          </g>
          <g className="tag-days">
            <rect x="58" y="196" width="84" height="24" rx="4" className="tag-bg" />
            <text x="100" y="213" textAnchor="middle" className="map-note">{en ? '10 days' : '10 jours'}</text>
          </g>
        </g>

        <line x1="212" y1="30" x2="212" y2="250" className="divider" />

        {/* Britain panel */}
        <g>
          <text x="306" y="22" textAnchor="middle" className="plan-label">{en ? 'Britain · 55–54' : 'Bretagne · 55–54'}</text>
          <path d="M224,40 L392,40 L392,96 C360,110 330,100 300,112 C270,122 246,112 224,118 Z" className="land" />
          <path d="M224,118 C246,112 270,122 300,112 C330,100 360,110 392,96" className="cliff" />
          <rect x="224" y="118" width="168" height="152" className="water" />
          {BOATS.map(([x, y], i) => (
            <g key={i} className="boat">
              <path d={`M${x - 14},${y} L${x + 14},${y} L${x + 9},${y + 7} L${x - 9},${y + 7} Z`} className="hull" />
              <line x1={x} y1={y} x2={x} y2={y - 18} className="mast" />
              <rect x={x - 7} y={y - 17} width="14" height="12" className="unit-rome" />
            </g>
          ))}
          <g className="tag-britain">
            <rect x="236" y="56" width="140" height="24" rx="4" className="tag-bg" />
            <text x="306" y="73" textAnchor="middle" className="map-note">{en ? 'Rome is amazed' : 'Rome est éblouie'}</text>
          </g>
        </g>
      </svg>
      <figcaption className="viz-caption">
        <span>{en
          ? 'Little territory gained — the point was the headlines in Rome.'
          : 'Peu de territoire gagné : le but, c’était de faire parler de lui à Rome.'}</span>
      </figcaption>
    </figure>
  );
}
