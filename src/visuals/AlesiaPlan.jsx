import { forwardRef, useId } from 'react';
import { useLang } from '../lib/lang';

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

export const SECTORS = {
  rea:    { x: WEAK_CAMP[0], y: WEAK_CAMP[1] },
  plaine: { x: 92, y: 300 },
  sud:    { x: 420, y: 392 },
};

const AlesiaPlan = forwardRef(function AlesiaPlan({ mode = 'build', highlight = null, routed = false, children }, ref) {
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

      {/* rivers: Ose (north), Oserain (south), Brenne (west) */}
      <g className="plan-terrain" aria-hidden="true">
        <path d="M600,128 C520,140 440,150 360,160 C290,168 220,176 132,196" className="river" />
        <path d="M600,318 C520,304 440,292 360,282 C290,272 210,250 132,214" className="river" />
        <path d="M112,0 C116,90 126,160 132,205 C140,270 146,360 140,440" className="river" />
        <text x="592" y="122" className="map-place river-name" textAnchor="end">Ose</text>
        <text x="560" y="336" className="map-place river-name" textAnchor="end">Oserain</text>
        <text x="100" y="420" className="map-place river-name" textAnchor="end">Brenne</text>
      </g>

      <g className="plan-scene">
        {/* the town on Mont-Auxois */}
        <g className="plan-town">
          <ellipse cx={C.x + 4} cy={C.y} rx="92" ry="42" className="plateau" />
          {DEFENDERS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5" className="unit-gaul defender" />)}
          <text x={C.x + 4} y={C.y - 50} textAnchor="middle" className="plan-label">Alésia</text>
        </g>

        {/* inner line + 23 forts */}
        <ellipse {...INNER} pathLength="1" className="wall wall-inner" />
        <g className="forts">
          {FORTS.map(([x, y], i) => <rect key={i} x={x - 4} y={y - 4} width="8" height="8" className="unit-rome fort" />)}
        </g>

        {/* outer line */}
        <ellipse {...OUTER} pathLength="1" className="wall wall-outer" />
        <ellipse {...OUTER} rx={OUTER.rx - 7} ry={OUTER.ry - 7} pathLength="1" className="wall wall-outer wall-outer-2" />

        {/* camps */}
        <g className="camps">
          {CAMPS.map(({ deg, p: [x, y] }) => (
            <rect key={deg} x={x - 9} y={y - 9} width="18" height="18" rx="2"
              className={`unit-rome camp${deg === -150 ? ' camp-weak' : ''}`} />
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

        {showRelief && (
          <g className={`relief${routed ? ' is-routed' : ''}`} aria-hidden="true">
            {RELIEF.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="6" className="unit-gaul relief-unit" />)}
          </g>
        )}

        {highlight && SECTORS[highlight] && (
          <circle cx={SECTORS[highlight].x} cy={SECTORS[highlight].y} r="30" className="sector-ring" />
        )}

        {children}
      </g>
    </svg>
  );
});

export default AlesiaPlan;
