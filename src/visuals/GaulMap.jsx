import { useId, useRef } from 'react';
import { LAND, BRITAIN, REGIONS, PROVINCE, RIVERS, PLACES, OPPIDA, FIRES } from '../data/gaul';
import { useLang, pick } from '../lib/lang';
import { useScene, gsap, sceneTrigger, DUR, EASE, STAGGER } from '../lib/motion';

/*
 * One map, five story states:
 *  tribes   — beat 1: ~60 peoples light up, Rome holds only the Province
 *  helvetii — beat 3: the migration, blocked at the Rhône, re-routed through the Éduens
 *  conquest — beat 4: regions turn Roman one campaign at a time
 *  revolt   — beat 6: Gaul turns green around Vercingétorix
 *  burn     — beat 7: scorched earth, Avaricum
 * The JSX always renders the FINAL state; GSAP animates from the start state.
 */

const CONQUEST_ORDER = ['helvetii', 'aedui', 'belgae', 'armorica', 'aquitania', 'arverni'];
const REVOLT_ORDER = ['arverni', 'aedui', 'aquitania', 'armorica', 'belgae', 'helvetii'];

const CAPTIONS = {
  tribes:   { fr: 'Environ 60 peuples, aucune capitale commune. Rome ne tient que la Province (depuis 121 av. J.-C.).', en: 'About 60 peoples, no shared capital. Rome holds only the Province (since 121 BC).' },
  helvetii: { fr: 'Les Helvètes veulent passer par la Province ; César les bloque sur le Rhône. Ils traversent alors le pays des Éduens.', en: 'The Helvetii try to cross the Province; Caesar blocks them on the Rhône. They go through Éduen land instead.' },
  conquest: { fr: 'Région par région, 58 → 53 av. J.-C. Les années indiquent la campagne principale.', en: 'Region by region, 58 → 53 BC. Years show the main campaign.' },
  revolt:   { fr: '52 av. J.-C. : Vercingétorix, proclamé à Gergovie, confirmé à Bibracte.', en: '52 BC: Vercingétorix, hailed at Gergovie, confirmed at Bibracte.' },
  burn:     { fr: 'Villages et récoltes brûlés pour affamer les Romains. Avaricum, épargnée, tombe.', en: 'Villages and crops burned to starve the Romans. Avaricum, spared, falls.' },
};

const TITLES = {
  tribes:   { fr: 'Carte de la Gaule : les peuples gaulois', en: 'Map of Gaul: the Gallic peoples' },
  helvetii: { fr: 'Carte : la migration des Helvètes', en: 'Map: the Helvetii migration' },
  conquest: { fr: 'Carte : la conquête romaine, 58–53 av. J.-C.', en: 'Map: the Roman conquest, 58–53 BC' },
  revolt:   { fr: 'Carte : la Gaule se soulève en 52 av. J.-C.', en: 'Map: Gaul rises in 52 BC' },
  burn:     { fr: 'Carte : la terre brûlée et Avaricum', en: 'Map: scorched earth and Avaricum' },
};

function regionSide(mode) {
  if (mode === 'conquest') return 'rome';
  if (mode === 'revolt' || mode === 'burn') return 'gaul';
  return null;
}

function Glyph({ side, x, y }) {
  if (side === 'rome') return <rect x={x - 4} y={y - 4} width="8" height="8" className="glyph-rome" />;
  if (side === 'gaul') return <circle cx={x} cy={y} r="4.5" className="glyph-gaul" />;
  return null;
}

export default function GaulMap({ mode = 'tribes' }) {
  const { lang } = useLang();
  const ref = useRef(null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const clip = `land-${uid}`;
  const grid = `grid-${uid}`;
  const arrowRome = `ar-${uid}`;
  const arrowGaul = `ag-${uid}`;
  const side = regionSide(mode);

  useScene(ref, ({ root, q }) => {
    const tl = gsap.timeline({ scrollTrigger: sceneTrigger(root), defaults: { ease: EASE.out } });
    tl.from(q('.map-labels > g:not([data-year])'), { opacity: 0, y: 6, duration: DUR.base, stagger: STAGGER });

    if (mode === 'tribes') {
      tl.from(q('.oppidum'), {
        scale: 0, opacity: 0, transformOrigin: '50% 50%', duration: DUR.base,
        stagger: { each: 0.025, from: 'random' },
      }, '<0.1');
      tl.from(q('.province-fill'), { opacity: 0, duration: DUR.slow }, '-=0.4');
    }

    if (mode === 'helvetii') {
      tl.from(q('.hl-region'), { opacity: 0, duration: DUR.base })
        .from(q('.route-blocked'), { strokeDashoffset: 1, duration: DUR.slow, ease: EASE.cinematic })
        .from(q('.barrier'), { scale: 0, transformOrigin: '50% 50%', duration: DUR.fast }, '-=0.15')
        .from(q('.route-rome'), { strokeDashoffset: 1, duration: DUR.slow, ease: EASE.cinematic }, '<')
        .from(q('.route-new'), { strokeDashoffset: 1, duration: DUR.cinematic, ease: EASE.cinematic })
        .from(q('.ally-tag'), { opacity: 0, y: 4, duration: DUR.base }, '-=0.6');
    }

    if (mode === 'conquest') {
      CONQUEST_ORDER.forEach((id, i) => {
        tl.from(q(`[data-region="${id}"]`), { opacity: 0, duration: DUR.slow, ease: EASE.cinematic }, i === 0 ? '>' : '>-0.35');
        tl.from(q(`[data-year="${id}"]`), { opacity: 0, scale: 0.6, transformOrigin: '50% 50%', duration: DUR.fast }, '<0.2');
      });
    }

    if (mode === 'revolt') {
      tl.from(q('.leader'), { scale: 0, opacity: 0, transformOrigin: '50% 50%', duration: DUR.base }, '<');
      // Gaul surges — staggered with a little irregularity (DESIGN.md §4.2)
      REVOLT_ORDER.forEach((id, i) => {
        tl.from(q(`[data-region="${id}"]`), { opacity: 0, duration: DUR.slow }, 0.4 + i * 0.22 + (i % 2) * 0.08);
      });
      tl.from(q('.pulse'), { scale: 0.2, opacity: 0, transformOrigin: '50% 50%', duration: DUR.cinematic, ease: EASE.out }, 0.3);
    }

    if (mode === 'burn') {
      tl.from(q('.fire'), {
        scale: 0, opacity: 0, transformOrigin: '50% 100%', duration: DUR.base,
        stagger: { each: 0.12, from: 'random' },
      })
        .from(q('.avaricum'), { opacity: 0, scale: 0.6, transformOrigin: '50% 50%', duration: DUR.base });
      // gentle flicker, background-only decoration
      gsap.to(q('.fire-core'), {
        opacity: 0.55, duration: 0.6, ease: 'sine.inOut', yoyo: true, repeat: -1,
        stagger: { each: 0.15, from: 'random' },
      });
    }
  }, [mode]);

  const label = (r, extra) => (
    <g key={r.id}>
      <Glyph side={extra} x={r.label[0]} y={r.label[1] - 15} />
      <text x={r.label[0]} y={r.label[1]} className="map-label" textAnchor="middle">
        {pick(r.name, lang)}
      </text>
    </g>
  );

  return (
    <figure className="viz viz-map" ref={ref}>
      <svg viewBox="0 0 400 420" role="img" aria-labelledby={`${uid}-t ${uid}-d`} className="map-svg">
        <title id={`${uid}-t`}>{pick(TITLES[mode], lang)}</title>
        <desc id={`${uid}-d`}>{pick(CAPTIONS[mode], lang)}</desc>
        <defs>
          <clipPath id={clip}><path d={LAND} /></clipPath>
          <pattern id={grid} width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0 L0 0 0 20" className="grid-line" />
          </pattern>
          <marker id={arrowRome} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="arrowhead-rome" />
          </marker>
          <marker id={arrowGaul} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="arrowhead-gaul" />
          </marker>
        </defs>

        <rect width="400" height="420" fill={`url(#${grid})`} />
        <path d={BRITAIN} className="land" />
        <text x="142" y="22" className="map-label map-label-sea" textAnchor="middle">Bretagne</text>
        <path d={LAND} className="land" />

        <g clipPath={`url(#${clip})`}>
          {/* region colour overlays (final state) */}
          {side && REGIONS.map((r) => (
            <path key={r.id} d={r.d} data-region={r.id}
              className={`region-fill is-${side}${mode === 'burn' ? ' is-dim' : ''}`} />
          ))}
          {mode === 'helvetii' && (
            <path d={REGIONS.find((r) => r.id === 'helvetii').d} className="region-fill is-accent hl-region" />
          )}
          <path d={PROVINCE.d} className="region-fill is-rome province-fill" />
          {/* borders */}
          {REGIONS.map((r) => <path key={r.id} d={r.d} className="region-border" />)}
          <path d={PROVINCE.d} className="region-border" />
        </g>

        <path d={LAND} className="coast" />
        {RIVERS.map((r) => <path key={r.id} d={r.d} className="river" />)}

        {mode === 'tribes' && (
          <g aria-hidden="true">
            {OPPIDA.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" className="oppidum" />)}
          </g>
        )}

        {mode === 'helvetii' && (
          <g aria-hidden="true">
            {/* 1. first route, through the Province — blocked on the Rhône */}
            <path d="M360,206 C348,222 338,232 324,240" pathLength="1" className="route route-gaul route-blocked" markerEnd={`url(#${arrowGaul})`} />
            <g className="barrier">
              <rect x="306" y="240" width="20" height="7" rx="1" className="glyph-rome" transform="rotate(-38 316 243)" />
            </g>
            <path d="M318,330 C318,300 318,276 316,256" pathLength="1" className="route route-rome" markerEnd={`url(#${arrowRome})`} />
            {/* 2. second route, north, into Éduen land */}
            <path d="M356,166 C330,146 300,146 280,156 S252,176 242,186" pathLength="1" className="route route-gaul route-new" markerEnd={`url(#${arrowGaul})`} />
            {/* 3. Rome answers the Éduens' call */}
            <path d="M282,330 C276,300 266,268 256,236" pathLength="1" className="route route-rome" markerEnd={`url(#${arrowRome})`} />
            <g className="ally-tag">
              <rect x="128" y="206" width="98" height="20" rx="4" className="tag-bg" />
              <text x="177" y="220" textAnchor="middle" className="map-note">
                {lang === 'en' ? 'Rome’s allies →' : 'alliés de Rome →'}
              </text>
            </g>
          </g>
        )}

        {mode === 'burn' && (
          <g aria-hidden="true">
            {FIRES.map(([x, y], i) => (
              <g key={i} className="fire">
                <path d={`M${x},${y} c-5,-4 -4,-10 0,-15 c1,5 6,6 5,11 c0,3 -2,4 -5,4 z`} className="fire-outer" />
                <path d={`M${x},${y} c-2,-2 -2,-5 0,-8 c1,3 3,4 2,6 c0,1 -1,2 -2,2 z`} className="fire-core" />
              </g>
            ))}
          </g>
        )}

        <g className="map-labels">
          {REGIONS.map((r) => label(r, side))}
          {mode === 'conquest' && REGIONS.map((r) => (
            <g key={`y-${r.id}`} data-year={r.id}>
              <rect x={r.label[0] - 15} y={r.label[1] + 5} width="30" height="16" rx="3" className="year-chip" />
              <text x={r.label[0]} y={r.label[1] + 17} textAnchor="middle" className="year-text">{r.year}</text>
            </g>
          ))}
          {label(PROVINCE, 'rome')}
        </g>

        {mode === 'revolt' && (
          <g>
            <circle cx={PLACES.gergovie.x} cy={PLACES.gergovie.y} r="34" className="pulse" />
            <g className="leader">
              <circle cx={PLACES.gergovie.x} cy={PLACES.gergovie.y} r="9" className="leader-dot" />
              <text x={PLACES.gergovie.x} y={PLACES.gergovie.y + 26} textAnchor="middle" className="map-place">Gergovie</text>
            </g>
            <circle cx={PLACES.bibracte.x} cy={PLACES.bibracte.y} r="5" className="place-dot" />
            <text x={PLACES.bibracte.x - 9} y={PLACES.bibracte.y + 4} textAnchor="end" className="map-place">Bibracte</text>
          </g>
        )}

        {mode === 'burn' && (
          <g className="avaricum">
            <circle cx={PLACES.avaricum.x} cy={PLACES.avaricum.y} r="7" className="leader-dot" />
            <line x1={PLACES.avaricum.x - 4} y1={PLACES.avaricum.y + 8} x2="160" y2="282" className="leader-line" />
            <rect x="100" y="282" width="116" height="38" rx="5" className="tag-bg" />
            <text x="158" y="298" textAnchor="middle" className="map-place">Avaricum</text>
            <text x="158" y="314" textAnchor="middle" className="map-note">40 000 → 800</text>
          </g>
        )}

        {(mode === 'tribes' || mode === 'helvetii') && (
          <g>
            <circle cx={PLACES.geneve.x} cy={PLACES.geneve.y} r="3.5" className="place-dot" />
            <text x={PLACES.geneve.x + 8} y={PLACES.geneve.y + 14} className="map-place">Genève</text>
          </g>
        )}
      </svg>

      <figcaption className="viz-caption">
        <span>{pick(CAPTIONS[mode], lang)}</span>
        <span className="legend" aria-hidden="true">
          <span className="legend-item"><span className="sw sw-rome" />Rome</span>
          <span className="legend-item"><span className="sw sw-gaul" />{lang === 'en' ? 'Gauls' : 'Gaulois'}</span>
        </span>
      </figcaption>
    </figure>
  );
}
