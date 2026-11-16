import { forwardRef, useId } from 'react';
import { Fragment } from 'react';
import { useLang } from '../lib/lang';
import { Packet, Flow, UnitTip, ellipsePath } from './motionKit';

/*
 * Schematic plan of the siege (viewBox 0 0 600 440). Not to scale.
 * Rome = squares (forts, camps), Gaul = circles (defenders, relief army).
 *  - inner line ("ligne intérieure", ~16 km, 23 forts) faces the town
 *  - outer line ("ligne extérieure", ~21 km) faces the relief army
 *  - Mont Réa (north-west) = the weak camp
 */
export const C = { x: 330, y: 218 };
export const INNER = { cx: 332, cy: 218, rx: 168, ry: 112 };
export const OUTER = { cx: 320, cy: 222, rx: 250, ry: 180 };
const CAMP_RING = { cx: 326, cy: 220, rx: 208, ry: 146 };

const onEllipse = (e, deg, f = 1) => {
  const a = (deg * Math.PI) / 180;
  return [e.cx + e.rx * f * Math.cos(a), e.cy + e.ry * f * Math.sin(a)];
};

const FORTS = Array.from({ length: 23 }, (_, i) => onEllipse(INNER, (360 / 23) * i - 90));
const CAMPS = [-150, -100, -40, 10, 60, 110, 160, 205].map((d) => ({ deg: d, p: onEllipse(CAMP_RING, d) }));
export const WEAK_CAMP = onEllipse(CAMP_RING, -150); // Mont Réa, north-west
const DEFENDERS = [
  [290, 206], [312, 196], [336, 192], [360, 198], [382, 210], [300, 228], [326, 222], [350, 220], [374, 230], [338, 240],
];
const CIVILIANS = Array.from({ length: 16 }, (_, i) => onEllipse({ cx: 334, cy: 218, rx: 128, ry: 80 }, 130 + i * 6.5));
const RELIEF = Array.from({ length: 22 }, (_, i) => {
  const deg = 140 + (i % 11) * 9 + (i > 10 ? 4 : 0);
  return onEllipse(OUTER, deg, i > 10 ? 1.24 : 1.13);
});

/* terrain: the hills ringing Mont-Auxois (Napoleon III's excavation plan names) — contour rings */
const HILLS = [
  { id: 'rea', name: '', cx: 128, cy: 120, rx: 54, ry: 30, lx: 0, ly: 0 }, // named by the camp tag
  { id: 'bussy', name: { fr: 'Montagne de Bussy', en: 'Bussy hill' }, cx: 372, cy: 54, rx: 92, ry: 26, lx: 372, ly: 22 },
  { id: 'flavigny', name: { fr: 'Montagne de Flavigny', en: 'Flavigny hill' }, cx: 334, cy: 396, rx: 120, ry: 28, lx: 334, ly: 432 },
  { id: 'pennevelle', name: 'Pennevelle', cx: 566, cy: 228, rx: 30, ry: 70, lx: 562, ly: 154 },
];
const CONTOURS = [1, 0.7, 0.42];
// steep slopes of the plateau: short hachures pointing downhill
const PLATEAU = { cx: C.x + 4, cy: C.y, rx: 92, ry: 42 };
const HACHURES = Array.from({ length: 44 }, (_, i) => {
  const a = (i / 44) * Math.PI * 2;
  const x1 = PLATEAU.cx + PLATEAU.rx * Math.cos(a); const y1 = PLATEAU.cy + PLATEAU.ry * Math.sin(a);
  const len = 7 + (i % 3) * 2;
  return `M${x1.toFixed(1)},${y1.toFixed(1)} l${(Math.cos(a) * len).toFixed(1)},${(Math.sin(a) * len * 0.7).toFixed(1)}`;
}).join(' ');
const scaled = (e, f) => ({ cx: e.cx, cy: e.cy, rx: e.rx * f, ry: e.ry * f });

/* relief army approach routes (from the west, onto the plain) */
const APPROACH = [
  'M0,120 C30,130 46,140 70,150',
  'M0,230 C26,232 30,236 48,240',
  'M0,340 C30,334 50,326 76,316',
  'M40,0 C60,30 80,52 104,70',
];

const RIVER_OSE = 'M600,128 C520,140 440,150 360,160 C290,168 220,176 132,196';
const RIVER_OSERAIN = 'M600,318 C520,304 440,292 360,282 C290,272 210,250 132,214';
const RIVER_BRENNE = 'M112,0 C116,90 126,160 132,205 C140,270 146,360 140,440';

export const SECTORS = {
  rea:    { x: WEAK_CAMP[0], y: WEAK_CAMP[1] },
  plaine: { x: 92, y: 300 },
  sud:    { x: 420, y: 392 },
};

const AlesiaPlan = forwardRef(function AlesiaPlan({ mode = 'build', highlight = null, routed = false, live = false, children }, ref) {
  const { lang } = useLang();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const en = lang === 'en';
  const showRelief = mode !== 'build';

  return (
    <svg ref={ref} viewBox="0 0 600 440" role="img" aria-labelledby={`${uid}-t ${uid}-d`} className="plan-svg">
      <title id={`${uid}-t`}>{en ? 'Plan of the siege of Alésia' : "Plan du siège d'Alésia"}</title>
      <desc id={`${uid}-d`}>
        {en
          ? 'The town on its plateau, ringed by a Roman inner line of about 16 km with 23 forts, and an outer line of about 21 km facing the relief army. The weak camp is on Mont Réa, to the north-west.'
          : "La ville sur son plateau, entourée d'une ligne intérieure romaine d'environ 16 km avec 23 forts, et d'une ligne extérieure d'environ 21 km face à l'armée de secours. Le camp faible est sur le Mont Réa, au nord-ouest."}
      </desc>
      <defs>
        <pattern id={`g-${uid}`} width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0 L0 0 0 24" className="grid-line" />
        </pattern>
      </defs>
      <rect width="600" height="440" fill={`url(#g-${uid})`} />

      {/* hills: contour rings + names (positions schematic) */}
      <g className="plan-hills" aria-hidden="true">
        {HILLS.map((h) => (
          <g key={h.id}>
            {CONTOURS.map((f) => <ellipse key={f} cx={h.cx} cy={h.cy} rx={h.rx * f} ry={h.ry * f} className="contour" />)}
            {h.name && <text x={h.lx} y={h.ly} textAnchor="middle" className="hill-name">{typeof h.name === 'string' ? h.name : (en ? h.name.en : h.name.fr)}</text>}
          </g>
        ))}
        <text x="30" y="362" className="hill-name">{en ? 'Les Laumes plain' : 'Plaine des Laumes'}</text>
      </g>
      {/* rivers: Ose (north), Oserain (south), Brenne (west) */}
      <g className="plan-terrain" aria-hidden="true">
        {[RIVER_OSE, RIVER_OSERAIN, RIVER_BRENNE].map((d) => <path key={`b${d}`} d={d} className="river-bank" />)}
        <path d={RIVER_OSE} className="river" />
        <path d={RIVER_OSERAIN} className="river" />
        <path d={RIVER_BRENNE} className="river" />
        <text x="592" y="122" className="map-place river-name" textAnchor="end">Ose</text>
        <text x="560" y="336" className="map-place river-name" textAnchor="end">Oserain</text>
        <text x="100" y="420" className="map-place river-name" textAnchor="end">Brenne</text>
      </g>

      <g className="plan-scene">
        {/* the town on Mont-Auxois */}
        <path d={HACHURES} className="hachure" aria-hidden="true" />
        <g className="plan-town">
          <UnitTip label={en ? 'Alésia · ~80,000 Gauls (per Caesar)' : 'Alésia · ~80 000 Gaulois (selon César)'} x={C.x + 4} y={C.y + 62}>
            <ellipse cx={C.x + 4} cy={C.y} rx="92" ry="42" className="plateau" />
            {DEFENDERS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5" className="unit-gaul defender" />)}
          </UnitTip>
          <text x={C.x + 4} y={C.y - 50} textAnchor="middle" className="plan-label">Alésia</text>
        </g>

        {/* inner line (faces the town): traps in front, ditch, rampart with towers + 23 forts */}
        <g className="works" aria-hidden="true">
          <ellipse {...scaled(INNER, 0.9)} className="traps" />
          <ellipse {...scaled(INNER, 0.955)} className="ditch" />
          <ellipse {...INNER} pathLength="1" className="towers" />
        </g>
        <ellipse {...INNER} pathLength="1" className="wall wall-inner" />
        <g className="forts">
          {FORTS.map(([x, y], i) => <rect key={i} x={x - 4} y={y - 4} width="8" height="8" className="unit-rome fort" />)}
        </g>

        {/* outer line (faces the relief army): traps + ditch outside, rampart with towers */}
        <g className="works" aria-hidden="true">
          <ellipse {...scaled(OUTER, 1.075)} className="traps" />
          <ellipse {...scaled(OUTER, 1.035)} className="ditch" />
          <ellipse {...OUTER} pathLength="1" className="towers" />
        </g>
        <ellipse {...OUTER} pathLength="1" className="wall wall-outer" />
        <ellipse {...OUTER} rx={OUTER.rx - 7} ry={OUTER.ry - 7} pathLength="1" className="wall wall-outer wall-outer-2" />

        {/* camps */}
        <g className="camps">
          {CAMPS.map(({ deg, p: [x, y] }) => (
            <UnitTip key={deg} x={x} y={y - 14}
              label={deg === -150
                ? (en ? 'Mont Réa · badly placed camp' : 'Mont Réa · camp mal placé')
                : (en ? 'Roman camp' : 'Camp romain')}>
              <rect x={x - 9} y={y - 9} width="18" height="18" rx="2"
                className={`unit-rome camp${deg === -150 ? ' camp-weak' : ''}`} />
            </UnitTip>
          ))}
        </g>

        <g className="wall-labels">
          <g className="tag">
            <rect x="350" y="80" width="150" height="22" rx="4" className="tag-bg" />
            <text x="425" y="95" textAnchor="middle" className="map-note">{en ? 'Inner line · 16 km' : 'Ligne intérieure · 16 km'}</text>
          </g>
          <g className="tag">
            <rect x="420" y="24" width="160" height="22" rx="4" className="tag-bg" />
            <text x="500" y="39" textAnchor="middle" className="map-note">{en ? 'Outer line · 21 km' : 'Ligne extérieure · 21 km'}</text>
          </g>
          <g className="tag">
            <rect x={WEAK_CAMP[0] - 44} y={WEAK_CAMP[1] - 38} width="88" height="20" rx="4" className="tag-bg" />
            <text x={WEAK_CAMP[0]} y={WEAK_CAMP[1] - 24} textAnchor="middle" className="map-note">Mont Réa</text>
          </g>
        </g>

        {mode === 'famine' && (
          <g className="civilians" aria-hidden="true">
            {CIVILIANS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.6" className="civilian" />)}
          </g>
        )}

        {/* Rome patrols its inner ring — Caesar's "internal lines" */}
        {live && mode === 'build' && [0, 1, 2, 3].map((k) => (
          <Packet key={k} d={ellipsePath(INNER)} shape="square" size={3.6} dur={9} begin={k * 2.25} />
        ))}

        {showRelief && mode === 'famine' && (
          <g aria-hidden="true">
            {APPROACH.map((d) => <Flow key={d} d={d} side="gaul" on />)}
            {live && APPROACH.map((d, i) => [0, 1].map((k) => (
              <Packet key={`${i}${k}`} d={d} dur={1.6 + (i % 2) * 0.4} begin={i * 0.3 + k * 0.85} />
            )))}
          </g>
        )}

        {showRelief && (
          <UnitTip label={en ? 'Relief army (Vercassivellaunos)' : 'Armée de secours (Vercassivellaunos)'} x={70} y={44}>
            <g className={`relief${routed ? ' is-routed' : ''}`}>
              {RELIEF.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="6" className="unit-gaul relief-unit" />)}
            </g>
          </UnitTip>
        )}

        {highlight && SECTORS[highlight] && (
          <circle cx={SECTORS[highlight].x} cy={SECTORS[highlight].y} r="30" className="sector-ring" />
        )}

        {/* camera HUD: definition, not noise */}
        <g className="plan-hud" aria-hidden="true">
          <circle cx="16" cy="16" r="4" className="hud-rec" />
          <text x="26" y="20" className="hud-text">REC · {en ? 'SEPT. 52 BC' : 'SEPT. 52 av. J.-C.'}</text>
          <g transform={`translate(${C.x + 4} ${C.y})`} className="reticle">
            <path d="M-20,0 h9 M11,0 h9 M0,-20 v9 M0,11 v9" className="ret-tick" />
          </g>
          <text x="590" y="432" textAnchor="end" className="hud-text">47°32′N · 4°29′E</text>
          <g transform="translate(578 70)">
            <path d="M0,-12 L4.5,4 L0,0.5 L-4.5,4 Z" className="north" />
            <text x="0" y="-16" textAnchor="middle" className="hud-text">N</text>
          </g>
        </g>

        {children}
      </g>
    </svg>
  );
});

export default AlesiaPlan;

/* Written key — shown on phones, where the plan's in-diagram labels are too small to read. */
export function PlanKey({ showRelief = false, civilians = false }) {
  const { lang } = useLang();
  const en = lang === 'en';
  const rows = [
    ['rome', en ? 'Inner line · ~16 km · 23 forts (faces the town)' : 'Ligne intérieure · ~16 km · 23 forts (face à la ville)'],
    ['rome', en ? 'Outer line · ~21 km (faces the relief army)' : 'Ligne extérieure · ~21 km (face au secours)'],
    ['weak', en ? 'Mont Réa camp, north-west — the weak spot' : 'Camp du Mont Réa, au nord-ouest — le point faible'],
    ['gaul', en ? 'Alésia on Mont-Auxois, between the Ose and the Oserain' : "Alésia sur le Mont-Auxois, entre l'Ose et l'Oserain"],
  ];
  if (civilians) rows.push(['civ', en ? 'Expelled civilians, trapped between the lines' : 'Civils chassés, bloqués entre les lignes']);
  if (showRelief) rows.push(['gaul', en ? 'Relief army, arriving from the west' : "Armée de secours, arrivée par l'ouest"]);
  return (
    <ul className="plan-key">
      {rows.map(([k, t]) => (
        <Fragment key={t}><li><span className={`key-sw key-${k}`} aria-hidden="true" />{t}</li></Fragment>
      ))}
    </ul>
  );
}
