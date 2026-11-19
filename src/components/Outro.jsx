import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUp, ExternalLink, X } from 'lucide-react';
import { useLang, pick } from '../lib/lang';
import { haptic } from '../lib/haptics';
import { ScrollTrigger } from '../lib/motion';
import { PRESENTERS } from '../data/beats';
import { SCENES } from '../data/scenes';

const SOURCES = [
  { label: 'César, La Guerre des Gaules, livre VII (trad. Nisard) — Wikisource', href: 'https://fr.wikisource.org/wiki/La_Guerre_des_Gaules/Livre_I' },
  { label: 'Caesar on the Siege of Alesia — Livius', href: 'https://livius.org/sources/content/caesar/caesar-on-the-siege-of-alesia' },
  { label: 'Bataille d’Alésia — World History Encyclopedia (FR)', href: 'https://www.worldhistory.org/trans/fr/2-1734/bataille-dalesia/' },
  { label: 'Siege of Alesia — Britannica', href: 'https://www.britannica.com/event/Siege-of-Alesia' },
  { label: 'Le Muséoparc nous fait revivre le siège — Hérodote.net', href: 'https://www.herodote.net/Le_Museoparc_nous_fait_revivre_le_siege-article-2657.php' },
  { label: 'Vercingetorix and Alesia — Musée d’Archéologie nationale', href: 'https://musee-archeologienationale.fr/node/740' },
];

/* The QR code, enlarged in the middle of the screen like the pictures on the topic pages.
   The page behind stays exactly where it is: scrolling and the story's keys are held while it is open. */
function QrZoom({ en, onClose }) {
  const reduce = useReducedMotion();
  const layer = useRef(null);
  const closeBtn = useRef(null);

  useEffect(() => {
    const back = document.activeElement;
    closeBtn.current?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); return; }
      if (e.key === 'Tab') { e.preventDefault(); closeBtn.current?.focus({ preventScroll: true }); return; }
      if (e.key !== 'Enter') { e.preventDefault(); e.stopPropagation(); }
    };
    const hold = (e) => e.preventDefault();
    const el = layer.current;
    window.addEventListener('keydown', onKey, true);
    el.addEventListener('wheel', hold, { passive: false });
    el.addEventListener('touchmove', hold, { passive: false });
    return () => {
      window.removeEventListener('keydown', onKey, true);
      el.removeEventListener('wheel', hold);
      el.removeEventListener('touchmove', hold);
      back?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  return createPortal(
    <motion.div ref={layer} className="qr-zoom" role="dialog" aria-modal="true" aria-label="QR code" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.figure
        initial={reduce ? false : { scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        <img src="./alesia-story-qr.svg" width="640" height="640" alt={en ? 'QR code to open alesia-story.vercel.app' : 'QR code pour ouvrir alesia-story.vercel.app'} />
        <figcaption>{en ? 'Scan to open the site' : 'Scannez pour ouvrir le site'}</figcaption>
        <button ref={closeBtn} type="button" className="qr-zoom-close" onClick={onClose} aria-label={en ? 'Close the QR code' : 'Fermer le QR code'}>
          <X size={18} aria-hidden="true" />
        </button>
      </motion.figure>
    </motion.div>,
    document.body,
  );
}

export default function Outro({ onActive, onTop }) {
  const { lang } = useLang();
  const en = lang === 'en';
  const ref = useRef(null);
  const [qrOpen, setQrOpen] = useState(false);
  const closeQr = useRef(() => setQrOpen(false)).current;

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
            <h3 className="outro-h">{en ? 'The team' : 'L’équipe'}</h3>
            <ul className="team">
              {Object.values(PRESENTERS).map((name) => (
                <li key={name}><span className="team-name">{name}</span></li>
              ))}
            </ul>
          </div>
          <div className="outro-sources">
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
                ? 'Portraits on the cards: Julius Caesar, marble bust, Metropolitan Museum of Art (CC0); gold stater of the Arverni with Vercingétorix’s name, BnF / Gallica (public domain). Map geography: Natural Earth (public domain).'
                : 'Portraits des cartes : Jules César, buste en marbre, Metropolitan Museum of Art (CC0) ; statère d’or arverne au nom de Vercingétorix, BnF / Gallica (domaine public). Géographie des cartes : Natural Earth (domaine public).'}
            </p>
            <p className="credits">
              {en
                ? 'Shown cropped and recoloured through an old-TV effect. Files and full credits: Wikimedia Commons (number = step of the story, 0 = title).'
                : 'Affichées recadrées et recolorées par un effet « vieille télé ». Fichiers et crédits complets : Wikimedia Commons (numéro = étape du récit, 0 = titre).'}
            </p>
          </div>
          <figure className="outro-qr">
            <button type="button" className="outro-qr-btn" onClick={() => { haptic('light'); setQrOpen(true); }}
              aria-label={en ? 'Enlarge the QR code' : 'Agrandir le QR code'}>
              <img src="./alesia-story-qr.svg" width="176" height="176" loading="lazy" decoding="async" alt="" />
            </button>
            <figcaption className="outro-h">{en ? 'Scan to open the site' : 'Scannez pour ouvrir le site'}</figcaption>
          </figure>
        </div>

        <a className="btn-primary lab-cta" href="https://alesia-game-lab.vercel.app/">
          {en ? 'Play La Percée →' : 'Jouer à La Percée →'}
        </a>
        <button type="button" className="btn-ghost" onClick={onTop}>
          <ArrowUp size={18} strokeWidth={1.75} aria-hidden="true" />
          {en ? 'Back to the start' : 'Revenir au début'}
        </button>
      </div>
      <AnimatePresence>{qrOpen && <QrZoom en={en} onClose={closeQr} />}</AnimatePresence>
    </section>
  );
}
