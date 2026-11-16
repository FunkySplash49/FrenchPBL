import { useRef, useState } from 'react';
import { useLang, pick } from '../lib/lang';
import Phrase from '../components/Phrase';
import { useScene, gsap, sceneTrigger, DUR, EASE } from '../lib/motion';
import { Brackets } from './motionKit';

/* Beat 12 — two versions of the surrender, what came after, the 1865 statue, the closing question. */
const VERSIONS = {
  cesar: {
    who: { fr: 'César', en: 'Caesar' },
    src: { fr: '*La Guerre des Gaules*, VII, 89', en: '*The Gallic War*, VII, 89' },
    text: {
      fr: 'Bref et sec. Les chefs sont amenés, les armes jetées, Vercingétorix est livré.',
      en: 'Plain and short. The chiefs are brought out, the weapons thrown down, Vercingétorix handed over.',
    },
  },
  plutarque: {
    who: { fr: 'Plutarque', en: 'Plutarch' },
    src: { fr: 'écrit environ 150 ans plus tard', en: 'written about 150 years later' },
    text: {
      fr: 'Théâtral. Vercingétorix sort à cheval dans sa plus belle armure, fait le tour du siège de César, descend, jette ses armes et s’assoit en silence à ses pieds.',
      en: 'Theatrical. Vercingétorix rides out in his finest armour, circles Caesar’s seat, dismounts, throws down his arms and sits silently at Caesar’s feet.',
    },
  },
};

const AFTER = [
  { y: { fr: '46 av. J.-C.', en: '46 BC' }, t: { fr: 'Vercingétorix exhibé au triomphe, puis exécuté', en: 'Vercingétorix paraded in the triumph, then executed' } },
  { y: { fr: '44 av. J.-C.', en: '44 BC' }, t: { fr: 'César assassiné', en: 'Caesar assassinated' } },
  { y: { fr: '27 av. J.-C.', en: '27 BC' }, t: { fr: 'La Gaule devient provinces romaines', en: 'Gaul becomes Roman provinces' } },
  { y: { fr: '1865', en: '1865' }, t: { fr: 'Statue de Napoléon III à Alise-Sainte-Reine', en: 'Napoléon III’s statue at Alise-Sainte-Reine' } },
  { y: { fr: 'après 1870', en: 'after 1870' }, t: { fr: '« Nos ancêtres les Gaulois » dans les manuels', en: '“Our ancestors the Gauls” in schoolbooks' } },
  { y: { fr: '1991–97', en: '1991–97' }, t: { fr: 'Les fouilles confirment le site', en: 'Excavations confirm the site' } },
  { y: { fr: '2012', en: '2012' }, t: { fr: 'Ouverture du [[museoparc|MuséoParc Alésia]]', en: '[[museoparc|MuséoParc Alésia]] opens' } },
];

const QUESTION = {
  fr: 'Vercingétorix a perdu la bataille. Pourquoi la France en a-t-elle fait un héros ?',
  en: 'Vercingétorix lost the battle. Why did France make him a hero?',
  say: 'vair-san-zhay-toh-reeks ah pair-dew lah bah-tah-yuh. pour-kwah lah frahns ahn ah-tay-ell feh uhn ay-roh ?',
};

// the real statue (Aimé Millet, 1865) — photo: Myrabella, CC BY-SA 4.0 (same file as the
// sources-step backdrop, credited in the Sources section)
function Statue() {
  return (
    <span className="statue statue-photo" aria-hidden="true">
      <img src={`${import.meta.env.BASE_URL}scenes/13-sources.jpg`} alt="" decoding="async" loading="lazy" />
    </span>
  );
}

export default function Legacy() {
  const { lang } = useLang();
  const en = lang === 'en';
  const [tab, setTab] = useState('cesar');
  const ref = useRef(null);
  const v = VERSIONS[tab];

  useScene(ref, ({ root, q }) => {
    gsap.timeline({ scrollTrigger: sceneTrigger(root), defaults: { ease: EASE.out } })
      .from(q('.statue'), { opacity: 0, y: 16, duration: DUR.slow })
      .from(q('.after li'), { opacity: 0, y: 8, duration: DUR.base, stagger: 0.08 }, '-=0.4')
      .from(q('.question'), { opacity: 0, duration: DUR.cinematic, ease: EASE.cinematic });
  });

  const onKey = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      e.stopPropagation();
      const next = tab === 'cesar' ? 'plutarque' : 'cesar';
      setTab(next);
      document.getElementById(`tab-${next}`)?.focus();
    }
  };

  return (
    <figure className="viz viz-legacy" ref={ref}>
      <Brackets />
      <p className="viz-title">{en ? 'Two versions of the surrender' : 'Deux versions de la reddition'}</p>
      <div className="tabs" role="tablist" aria-label={en ? 'Compare the sources' : 'Comparer les sources'}>
        {Object.entries(VERSIONS).map(([id, ver]) => (
          <button key={id} id={`tab-${id}`} role="tab" type="button"
            aria-selected={tab === id} aria-controls="tab-panel" tabIndex={tab === id ? 0 : -1}
            className="tab" onClick={() => setTab(id)} onKeyDown={onKey}>
            {pick(ver.who, lang)}
          </button>
        ))}
      </div>
      <div id="tab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="tab-panel">
        <Phrase as="p" text={v.text} className="version-text" />
        <Phrase as="p" text={v.src} className="version-src" />
        <Phrase as="p" className="version-note" text={{
          fr: 'Le célèbre [[royer|tableau de Lionel Royer]] (1899) suit Plutarque, pas César. C’est ainsi que naissent les légendes.',
          en: '[[royer|Lionel Royer’s famous painting]] (1899) follows Plutarch, not Caesar. That is how legends are made.',
        }} />
      </div>

      <div className="legacy-grid">
        <div className="statue-wrap">
          <Statue />
          <p className="statue-cap">1865 · Aimé Millet<br />Alise-Sainte-Reine</p>
        </div>
        <ol className="after">
          {AFTER.map((a) => (
            <li key={a.y.fr}><span className="after-y">{pick(a.y, lang)}</span><Phrase text={a.t} /></li>
          ))}
        </ol>
      </div>

      <div className="question">
        <p className="question-kicker">{en ? 'Question for the class' : 'Question pour la classe'}</p>
        <Phrase as="p" text={QUESTION} className="question-text" />
      </div>
    </figure>
  );
}
