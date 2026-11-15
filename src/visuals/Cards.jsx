import { useRef } from 'react';
import { Coins, Crown, ShieldCheck, Megaphone } from 'lucide-react';
import Phrase from '../components/Phrase';
import { useLang } from '../lib/lang';
import { useScene, gsap, sceneTrigger, DUR, EASE } from '../lib/motion';
import { Brackets } from './motionKit';

/* Laurel medallion (Rome = square frame) and torque medallion (Gaul = round frame). */
function RomanMedallion() {
  return (
    <svg viewBox="0 0 120 120" className="medallion" aria-hidden="true">
      <rect x="6" y="6" width="108" height="108" rx="6" className="med-frame-rome" />
      {Array.from({ length: 7 }, (_, i) => {
        const a = (200 + i * 20) * (Math.PI / 180);
        const x = 60 + 38 * Math.cos(a);
        const y = 64 + 38 * Math.sin(a);
        return (
          <g key={i}>
            <ellipse cx={x} cy={y} rx="4" ry="9" transform={`rotate(${200 + i * 20 + 90} ${x} ${y})`} className="laurel" />
            <ellipse cx={120 - x} cy={y} rx="4" ry="9" transform={`rotate(${-(200 + i * 20 + 90)} ${120 - x} ${y})`} className="laurel" />
          </g>
        );
      })}
      <text x="60" y="70" textAnchor="middle" className="med-text">CAESAR</text>
    </svg>
  );
}

function GaulMedallion() {
  return (
    <svg viewBox="0 0 120 120" className="medallion" aria-hidden="true">
      <circle cx="60" cy="60" r="54" className="med-frame-gaul" />
      <path d="M28,72 C34,40 86,40 92,72" className="torque" />
      <circle cx="28" cy="74" r="6" className="torque-end" />
      <circle cx="92" cy="74" r="6" className="torque-end" />
      <text x="60" y="64" textAnchor="middle" className="med-text med-text-sm">VERCINGETORIXS</text>
    </svg>
  );
}

const MOTIVES = [
  { icon: Coins, k: { fr: 'Dettes', en: 'Debt' },
    v: { fr: 'Le consulat de 59 l’a ruiné. La guerre rapporte butin et esclaves.', en: 'His consulship of 59 ruined him. War brings plunder and slaves.' } },
  { icon: Crown, k: { fr: 'Ambition', en: 'Ambition' },
    v: { fr: 'Face à Pompée et Crassus, il lui faut une gloire militaire et une armée fidèle.', en: 'Next to Pompey and Crassus, he needs military glory and a loyal army.' } },
  { icon: ShieldCheck, k: { fr: 'Protection', en: 'Protection' },
    v: { fr: 'Tant qu’il commande, ses ennemis ne peuvent pas le poursuivre.', en: 'While he holds command, his enemies cannot prosecute him.' } },
];

/* Beat 2 */
export function CaesarCard() {
  const { lang } = useLang();
  const ref = useRef(null);
  useScene(ref, ({ root, q }) => {
    gsap.timeline({ scrollTrigger: sceneTrigger(root), defaults: { ease: EASE.out } })
      .from(q('.medallion'), { opacity: 0, scale: 0.9, duration: DUR.slow })
      .from(q('.motive'), { opacity: 0, y: 12, duration: DUR.base, stagger: 0.14 }, '-=0.3')
      .from(q('.official'), { opacity: 0, y: 12, duration: DUR.base }, '+=0.2');
  });
  const en = lang === 'en';
  return (
    <figure className="viz viz-card" ref={ref}>
      <Brackets />
      <div className="card-head">
        <RomanMedallion />
        <div>
          <p className="card-kicker">{en ? 'Proconsul of Gaul, 58 BC' : 'Proconsul des Gaules, 58 av. J.-C.'}</p>
          <p className="card-name">César</p>
        </div>
      </div>
      <p className="card-sub">{en ? 'The real reasons' : 'Les vraies raisons'}</p>
      <ul className="motives">
        {MOTIVES.map(({ icon: Icon, k, v }) => (
          <li key={k.fr} className="motive">
            <span className="motive-icon"><Icon size={20} strokeWidth={1.75} aria-hidden="true" /></span>
            <span><Phrase as="strong" text={k} /> <Phrase text={v} /></span>
          </li>
        ))}
      </ul>
      <div className="official">
        <span className="motive-icon"><Megaphone size={20} strokeWidth={1.75} aria-hidden="true" /></span>
        <span>
          <strong>{en ? 'The official reason' : 'La raison officielle'}</strong>{' '}
          {en ? '“Protecting Rome and its allies.”' : '« Protéger Rome et ses alliés. »'}
          <span className="official-note">{en ? 'A justification, not a cause.' : 'Une justification, pas une cause.'}</span>
        </span>
      </div>
    </figure>
  );
}

/* Shown under the map in beat 6 */
export function VercingetorixCard() {
  const { lang } = useLang();
  const en = lang === 'en';
  const facts = [
    [en ? 'People' : 'Peuple', en ? 'Arverne (Auvergne)' : 'Arverne (Auvergne)'],
    [en ? 'Born' : 'Né', en ? 'around 82 BC' : 'vers 82 av. J.-C.'],
    [en ? 'Name' : 'Nom', en ? '“great king of warriors”' : '« grand roi des guerriers »'],
    [en ? 'Chosen' : 'Choisi', en ? 'supreme commander at Bibracte' : 'chef suprême à Bibracte'],
  ];
  return (
    <div className="viz-card viz-card-inline">
      <div className="card-head">
        <GaulMedallion />
        <div>
          <p className="card-kicker">{en ? 'Leader of the revolt, 52 BC' : 'Chef de la révolte, 52 av. J.-C.'}</p>
          <p className="card-name card-name-gaul">Vercingétorix</p>
        </div>
      </div>
      <dl className="facts-dl">
        {facts.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
    </div>
  );
}
