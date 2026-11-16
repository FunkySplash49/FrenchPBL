import { useRef } from 'react';
import { Coins, Crown, ShieldCheck, Megaphone } from 'lucide-react';
import Phrase from '../components/Phrase';
import { useLang } from '../lib/lang';
import { useScene, gsap, sceneTrigger, DUR, EASE } from '../lib/motion';
import { Brackets } from './motionKit';
import TvScreen from './TvScreen';

/*
 * Portraits from the period, engraved-looking (static CSS filter): Rome = square frame,
 * Gaul = round frame. Caesar: marble bust, Metropolitan Museum (CC0). Vercingétorix:
 * a gold stater of the Arverni bearing his name (BnF / Gallica, public domain) — the
 * only image of him made in his lifetime. Credits in the Sources section (Outro).
 */
const BASE = import.meta.env.BASE_URL;
function RomanMedallion() {
  return (
    <span className="medallion portrait portrait-rome" aria-hidden="true">
      <img src={`${BASE}cards/caesar.jpg`} alt="" width="76" height="76" decoding="async" loading="lazy" />
    </span>
  );
}

function GaulMedallion() {
  return (
    <span className="medallion portrait portrait-gaul" aria-hidden="true">
      <img src={`${BASE}cards/vercingetorix.jpg`} alt="" width="76" height="76" decoding="async" loading="lazy" />
    </span>
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
      <TvScreen />
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
