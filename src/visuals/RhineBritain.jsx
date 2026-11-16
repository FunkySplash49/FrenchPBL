import { useRef } from 'react';
import { useLang } from '../lib/lang';
import { useScene, gsap, sceneTrigger, DUR, EASE } from '../lib/motion';
import { useLive, Packet, Brackets } from './motionKit';
import { KENT, GAUL_COAST, CH } from '../data/channel';

/*
 * Beat 5 — two feats for the headlines in Rome.
 *  Left: the Rhine bridge as Caesar describes building it (Gallic War IV.17): pairs of
 *        sharpened piles driven into the bed at a slant (with and against the current),
 *        cross-beams between them, a deck of planks and wickerwork, and guard piles
 *        upstream against logs sent down the river. Built in 10 days.
 *  Right: the real Channel (Natural Earth coastline): from Portus Itius (Boulogne) to a
 *        landing near Deal in Kent (the exact beach is debated).
 * No numbers beyond the brief's "10 days" (site rule).
 */
const BENTS = [30, 56, 82, 108, 134, 160, 186];
const SURFACE = 158;
const BED = 214;
const DECK = 128;
const t = (x, y) => `${x.toFixed(1)},${y.toFixed(1)}`;

// a sharpened pile from the bed to just under the deck, leaning `lean` px at the top
function pile(x, lean) {
  const top = DECK - 4;
  return `M${t(x - 1.6 + lean, top)} L${t(x + 1.6 + lean, top)} L${t(x + 1.6, BED)} L${t(x, BED + 5)} L${t(x - 1.6, BED)} Z`;
}

const ROUTE = `M${CH.portus[0]},${CH.portus[1]} C${CH.portus[0] + 6},${CH.portus[1] - 20} ${CH.deal[0] + 14},${CH.deal[1] + 22} ${CH.deal[0] + 4},${CH.deal[1] + 4}`;
const BOATS = [0.28, 0.55, 0.8];

export default function RhineBritain() {
  const { lang } = useLang();
  const ref = useRef(null);
  const en = lang === 'en';
  const live = useLive(ref);

  useScene(ref, ({ root, q }) => {
    gsap.timeline({ scrollTrigger: sceneTrigger(root), defaults: { ease: EASE.out } })
      // Rome builds: methodical, evenly spaced, bank to bank
      .from(q('.pile'), { scaleY: 0, transformOrigin: '50% 100%', duration: DUR.fast, stagger: 0.09, ease: 'none' })
      .from(q('.beam'), { scaleX: 0, transformOrigin: '0% 50%', duration: DUR.fast, stagger: 0.06, ease: 'none' }, '-=0.3')
      .from(q('.deck'), { strokeDashoffset: 1, duration: DUR.slow, ease: 'none' })
      .from(q('.guard'), { opacity: 0, x: -8, duration: DUR.base, stagger: 0.05 }, '-=0.3')
      .from(q('.callout'), { opacity: 0, duration: DUR.base, stagger: 0.12 })
      .from(q('.tag-days'), { opacity: 0, y: 6, duration: DUR.base }, '<')
      .from(q('.route'), { strokeDashoffset: 1, duration: DUR.slow, ease: EASE.cinematic }, '-=0.4')
      .from(q('.boat'), { opacity: 0, scale: 0.6, transformOrigin: '50% 50%', duration: DUR.base, ease: EASE.cinematic, stagger: 0.15 }, '-=0.5')
      .from(q('.tag-britain'), { opacity: 0, y: 6, duration: DUR.base });
  });

  const L = (fr, eng) => (en ? eng : fr);

  return (
    <figure className="viz viz-rhine" ref={ref}>
      <Brackets />
      <svg viewBox="0 0 400 270" role="img" aria-labelledby="rb-t">
        <title id="rb-t">{en
          ? 'Left: Caesar’s bridge over the Rhine as he describes it — paired piles driven in at a slant, cross-beams, a plank deck, guard piles upstream — built in 10 days (55 BC). Right: map of the Channel, Roman ships from Portus Itius (Boulogne) to Kent (55 and 54 BC).'
          : 'À gauche : le pont de César sur le Rhin tel qu’il le décrit — pieux jumelés enfoncés en biais, poutres transversales, tablier de planches, pieux de protection en amont — construit en 10 jours (55 av. J.-C.). À droite : carte de la Manche, navires romains de Portus Itius (Boulogne) vers le Kent (55 et 54 av. J.-C.).'}</title>
        <defs>
          <pattern id="rb-planks" width="5" height="6" patternUnits="userSpaceOnUse">
            <path d="M0,0 v6" className="plank" />
          </pattern>
          <clipPath id="rb-inset"><rect x="0" y="0" width="168" height="214" /></clipPath>
          <marker id="rb-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="arrowhead-rome" />
          </marker>
        </defs>

        {/* ── Rhine: elevation of the bridge, bank to bank ── */}
        <g>
          <text x="106" y="22" textAnchor="middle" className="plan-label">{L('Rhin · 55', 'Rhine · 55')}</text>
          {/* banks and river bed */}
          <path d={`M0,${DECK + 2} L18,${DECK + 2} L26,${SURFACE} L22,${BED + 8} L190,${BED + 8} L186,${SURFACE} L196,${DECK + 2} L212,${DECK + 2} L212,262 L0,262 Z`} className="bank" />
          <rect x="22" y={SURFACE} width="168" height={BED - SURFACE + 8} className="water" />
          {/* current lines */}
          {[168, 180, 192, 204].map((y, i) => (
            <path key={y} d={`M${30 + i * 9},${y} q8,-3 16,0 t16,0 M${104 + i * 7},${y + 2} q8,-3 16,0 t16,0`} className="current" />
          ))}
          {/* guard piles upstream (seen behind, lighter) */}
          {BENTS.map((x) => <path key={`g${x}`} d={pile(x + 9, 7)} className="guard" />)}
          {/* bents: a pair of piles leaning toward each other, a cross-beam near the top */}
          {BENTS.map((x) => (
            <g key={x} className="pile">
              <path d={pile(x - 5, 6)} className="unit-rome pile-shape" />
              <path d={pile(x + 5, -6)} className="unit-rome pile-shape" />
            </g>
          ))}
          {BENTS.map((x) => <rect key={`b${x}`} x={x - 9} y={DECK - 3} width="18" height="4" className="beam" />)}
          {/* deck: planks and wickerwork */}
          <rect x="16" y={DECK - 9} width="182" height="6" fill="url(#rb-planks)" className="deck-planks" />
          <line x1="14" y1={DECK - 9} x2="200" y2={DECK - 9} pathLength="1" className="deck" />
          {/* legionaries march across, methodically */}
          {live && [0, 1, 2, 3, 4].map((k) => (
            <Packet key={k} d={`M20,${DECK - 14} L196,${DECK - 14}`} shape="square" size={3} dur={4} begin={k * 0.8} />
          ))}
          {/* callouts */}
          <g className="callout">
            <line x1="56" y1={DECK - 14} x2="40" y2="58" className="leader-line" />
            <text x="8" y="52" className="callout-text">{L('tablier : planches + clayonnage', 'deck: planks + wickerwork')}</text>
          </g>
          <g className="callout">
            <line x1="134" y1={DECK - 2} x2="150" y2="76" className="leader-line" />
            <text x="204" y="70" textAnchor="end" className="callout-text">{L('poutres transversales', 'cross-beams')}</text>
          </g>
          <g className="callout">
            <line x1="82" y1="196" x2="64" y2="240" className="leader-line" />
            <text x="8" y="250" className="callout-text">{L('pieux jumelés, en biais', 'paired piles, slanted')}</text>
          </g>
          <g className="callout">
            <line x1="170" y1="186" x2="172" y2="236" className="leader-line" />
            <text x="206" y="250" textAnchor="end" className="callout-text">{L('protections en amont', 'upstream guards')}</text>
          </g>
          <g className="tag-days">
            <rect x="74" y="86" width="64" height="22" rx="4" className="tag-bg" />
            <text x="106" y="101" textAnchor="middle" className="map-note">{L('10 jours', '10 days')}</text>
          </g>
        </g>

        <line x1="214" y1="30" x2="214" y2="250" className="divider" />

        {/* ── the Channel: real coastlines ── */}
        <g transform="translate(226 34)">
          <text x="84" y="-12" textAnchor="middle" className="plan-label">{L('Bretagne · 55–54', 'Britain · 55–54')}</text>
          <g clipPath="url(#rb-inset)">
          <rect x="0" y="0" width="168" height="214" className="map-sea inset-sea" />
          <g className="water-lines">
            <path d={`${KENT} ${GAUL_COAST}`} className="wl wl-2" />
            <path d={`${KENT} ${GAUL_COAST}`} className="wl wl-1" />
          </g>
          <path d={KENT} className="land" />
          <path d={GAUL_COAST} className="land" />
          <path d={`${KENT} ${GAUL_COAST}`} className="coast" />
          </g>
          <rect x="0" y="0" width="168" height="214" className="inset-frame" />
          <text x="16" y="30" className="land-label">{L('Bretagne', 'Britain')}</text>
          <text x="152" y="200" textAnchor="end" className="land-label">{L('Gaule', 'Gaul')}</text>
          <text x={CH.thames[0] + 2} y={CH.thames[1] + 14} className="sea-label">{L('Tamise', 'Thames')}</text>
          <text x="18" y="120" className="sea-label">{L('Manche', 'Channel')}</text>
          {/* the crossing */}
          <path d={ROUTE} pathLength="1" className="route route-rome sea-route" markerEnd="url(#rb-arrow)" />
          {BOATS.map((f, i) => {
            const x = CH.portus[0] + (CH.deal[0] - CH.portus[0]) * f + 8 * Math.sin(f * 3.1);
            const y = CH.portus[1] + (CH.deal[1] - CH.portus[1]) * f;
            return (
              <g key={i} className="boat" transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
                <path d="M-8,0 L8,0 L5,4 L-5,4 Z" className="hull" />
                <line x1="0" y1="0" x2="0" y2="-10" className="mast" />
                <rect x="-4" y="-9.5" width="8" height="6.5" className="unit-rome" />
              </g>
            );
          })}
          <g className="reticle" transform={`translate(${CH.deal[0]} ${CH.deal[1]})`}>
            <circle r="5" className="ret-ring" />
            <circle r="1.4" className="ret-dot" />
          </g>
          <text x={CH.deal[0] + 9} y={CH.deal[1] + 3} className="map-place-sm">Deal ?</text>
          <circle cx={CH.portus[0]} cy={CH.portus[1]} r="3" className="place-dot" />
          <text x={CH.portus[0] + 6} y={CH.portus[1] + 12} className="map-place-sm">Portus Itius</text>
          <text x={CH.portus[0] + 6} y={CH.portus[1] + 22} className="callout-text">(Boulogne)</text>
          <g className="tag-britain">
            <rect x="8" y="140" width="100" height="20" rx="4" className="tag-bg" />
            <text x="58" y="154" textAnchor="middle" className="map-note">{L('Rome est éblouie', 'Rome is amazed')}</text>
          </g>
        </g>
      </svg>
      <figcaption className="viz-caption">
        <span>{en
          ? 'Little territory gained — the point was the headlines in Rome. (The landing beach near Deal is debated.)'
          : 'Peu de territoire gagné : le but, c’était de faire parler de lui à Rome. (La plage du débarquement, près de Deal, est discutée.)'}</span>
      </figcaption>
    </figure>
  );
}
