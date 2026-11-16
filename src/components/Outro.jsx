import { useLayoutEffect, useRef } from 'react';
import { ArrowUp, ExternalLink } from 'lucide-react';
import { useLang, pick } from '../lib/lang';
import { ScrollTrigger } from '../lib/motion';
import { PARTS, PRESENTERS } from '../data/beats';
import { SCENES } from '../data/scenes';

const SOURCES = [
  { label: 'César, La Guerre des Gaules, livre VII (trad. Nisard) — Wikisource', href: 'https://fr.wikisource.org/wiki/La_Guerre_des_Gaules/Livre_I' },
  { label: 'Caesar on the Siege of Alesia — Livius', href: 'https://livius.org/sources/content/caesar/caesar-on-the-siege-of-alesia' },
  { label: 'Bataille d’Alésia — World History Encyclopedia (FR)', href: 'https://www.worldhistory.org/trans/fr/2-1734/bataille-dalesia/' },
  { label: 'Siege of Alesia — Britannica', href: 'https://www.britannica.com/event/Siege-of-Alesia' },
  { label: 'Le Muséoparc nous fait revivre le siège — Hérodote.net', href: 'https://www.herodote.net/Le_Museoparc_nous_fait_revivre_le_siege-article-2657.php' },
  { label: 'Vercingetorix and Alesia — Musée d’Archéologie nationale', href: 'https://musee-archeologienationale.fr/node/740' },
];

export default function Outro({ onActive, onTop }) {
  const { lang } = useLang();
  const en = lang === 'en';
  const ref = useRef(null);

  useLayoutEffect(() => {
    const st = ScrollTrigger.create({
      trigger: ref.current, start: 'top 55%', end: 'bottom bottom',
      onToggle: (s) => { if (s.isActive) onActive(13); },
    });
    return () => st.kill();
  }, [onActive]);

  return (
    <section id="beat-13" className="outro" ref={ref} aria-labelledby="outro-title" tabIndex={-1}>
      <div className="outro-inner panel">
        <h2 id="outro-title" className="outro-title">{en ? 'Sources & team' : 'Sources et équipe'}</h2>
        <p className="caveat">
          {en
            ? 'Almost everything we know comes from the winner. Caesar wrote the main source about himself, so every number here is a claim — “according to Caesar…”. The Gauls left no written account; archaeology at Alise-Sainte-Reine largely confirms his fortifications.'
            : 'Presque tout ce que nous savons vient du vainqueur. César a écrit la source principale sur lui-même : chaque chiffre est donc une affirmation — « selon César… ». Les Gaulois n’ont laissé aucun récit écrit ; l’archéologie à Alise-Sainte-Reine confirme en grande partie ses fortifications.'}
        </p>

        <div className="outro-grid">
          <div>
            <h3 className="outro-h">{en ? 'Who presents what' : 'Qui présente quoi'}</h3>
            <ol className="team">
              {Object.entries(PARTS).map(([n, p]) => (
                <li key={n}>
                  <span className="team-name">{PRESENTERS[p.presenter]}</span>
                  <span className="team-part">{pick(p, lang)}</span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className="outro-h">Sources</h3>
            <ul className="sources">
              {SOURCES.map((s) => (
                <li key={s.href}>
                  <a href={s.href} target="_blank" rel="noreferrer">
                    {s.label}<ExternalLink size={14} strokeWidth={1.75} aria-hidden="true" />
                    <span className="sr-only">{en ? '(opens in a new tab)' : '(nouvel onglet)'}</span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="credits">
              {en
                ? 'Pictures in the previews: Wikimedia Commons (free licences; tap “Image” on a card for the author and licence).'
                : 'Images des aperçus : Wikimedia Commons (licences libres ; touchez « Image » sur une carte pour l’auteur et la licence).'}
            </p>
            <h3 className="outro-h outro-h-sub">{en ? 'Background pictures' : 'Images de fond'}</h3>
            <ol className="scene-credits" start={0}>
              {SCENES.map((s) => (
                <li key={s.href}>
                  <a href={s.href} target="_blank" rel="noreferrer">
                    {pick(s.artist, lang)}, <cite>{pick(s.title, lang)}</cite>, {pick(s.date, lang)}
                    <span className="sr-only">{en ? '(opens in a new tab)' : '(nouvel onglet)'}</span>
                  </a>
                  <span className="scene-lic"> — {s.license === 'Public domain' ? (en ? 'public domain' : 'domaine public') : s.license}</span>
                </li>
              ))}
            </ol>
            <p className="credits">
              {en
                ? 'Shown cropped and recoloured through an old-TV effect. Files and full credits: Wikimedia Commons (number = step of the story, 0 = title).'
                : 'Affichées recadrées et recolorées par un effet « vieille télé ». Fichiers et crédits complets : Wikimedia Commons (numéro = étape du récit, 0 = titre).'}
            </p>
          </div>
        </div>

        <a className="btn-primary lab-cta" href="./game-lab.html">
          {en ? 'Play the Alésia games →' : 'Jouer aux jeux d’Alésia →'}
        </a>
        <button type="button" className="btn-ghost" onClick={onTop}>
          <ArrowUp size={18} strokeWidth={1.75} aria-hidden="true" />
          {en ? 'Back to the start' : 'Revenir au début'}
        </button>
      </div>
    </section>
  );
}
