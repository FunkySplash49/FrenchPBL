import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X, ChevronDown, ExternalLink } from 'lucide-react';
import { TOPICS } from '../../data/topics';
import { PREVIEWS } from '../../data/previews';
import { useLang, pick, frTypo } from '../../lib/lang';
import { closeTopic, takeOrigin } from '../../lib/topic';
import { haptic } from '../../lib/haptics';
import TopicTunnel from './TopicTunnel';
import './topic.css';

/*
 * A key word's pop-up card: a perspective tunnel of pictures (Wikimedia Commons)
 * across the top, then a brief — what it is, key facts — with "read more" for the
 * longer notes and sources. Grows out of the clicked word; Esc / Back / backdrop closes.
 */
function rich(s) {
  return s.split(/(\*[^*]+\*)/g).map((part, i) =>
    part.startsWith('*') && part.endsWith('*') && part.length > 2 ? <em key={i}>{part.slice(1, -1)}</em> : part);
}

function useText() {
  const { lang } = useLang();
  return (t) => {
    // keep "60 000" / "75,000" on one line
    const s = pick(t, lang).replace(/(\d)[  ](\d{3})\b/g, '$1 $2');
    return rich(lang === 'en' ? s : frTypo(s));
  };
}

function fallback(id) {
  const p = PREVIEWS[id];
  if (!p) return null;
  return {
    title: { fr: id, en: id }, kicker: { fr: 'Repère', en: 'Key word' }, intro: p.caption,
    sections: [], facts: [], images: [{ thumb: p.img, file: p.file, caption: p.caption }],
    sources: [{ label: 'Wikipédia', url: p.url }],
  };
}

export default function TopicCard({ id }) {
  const topic = TOPICS[id] || fallback(id);
  const reduce = useReducedMotion();
  const { lang, cycle } = useLang();
  const tx = useText();
  const closeRef = useRef(null);
  const bodyRef = useRef(null);
  const [origin] = useState(() => takeOrigin());
  const [more, setMore] = useState(false);
  const [zoom, setZoom] = useState(null);
  const en = lang === 'en';

  useEffect(() => {
    const prev = document.activeElement;
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = 'hidden';
    closeRef.current?.focus({ preventScroll: true });
    return () => { html.style.overflow = before; prev?.focus?.({ preventScroll: true }); };
  }, []);

  useEffect(() => {
    const on = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); if (zoom != null) setZoom(null); else closeTopic(); }
      // keep the story's presenter keys (→ / Space) from firing underneath
      if ([' ', 'ArrowRight', 'ArrowLeft', 'Home'].includes(e.key) && !e.target.closest?.('button, a')) e.stopPropagation();
    };
    window.addEventListener('keydown', on, true);
    return () => window.removeEventListener('keydown', on, true);
  }, [zoom]);

  if (!topic) return null;
  const imgs = topic.images;

  // grow out of the clicked word
  const dx = origin ? origin.x - window.innerWidth / 2 : 0;
  const dy = origin ? origin.y - window.innerHeight / 2 : 40;
  const pickImg = (i) => { haptic('light'); setZoom(i); };
  const toggleMore = () => {
    haptic('light');
    setMore((m) => !m);
  };

  return (
    <motion.div
      className="tc-layer"
      lang={en ? 'en' : 'fr'}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25, delay: 0.05 } }}
    >
      <div className="tc-scrim" onClick={closeTopic} aria-hidden="true" />
      <motion.div
        className="tc-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tc-title"
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.2, x: dx, y: dy }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, x: 0, y: 0, transition: { type: 'spring', stiffness: 210, damping: 24 } }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4, x: dx, y: dy, transition: { duration: 0.28, ease: [0.64, 0, 0.78, 0] } }}
      >
        <div className="tc-hero">
          <TopicTunnel images={imgs} reduce={reduce} onPick={pickImg} />
          <div className="tc-hero-fade" aria-hidden="true" />
          <div className="tc-tools">
            <button type="button" className="tc-btn tc-lang" onClick={() => { haptic('light'); cycle(); }}
              aria-label={en ? 'Language: English. Change language' : 'Langue : français. Changer de langue'}>
              {en ? 'EN' : 'FR'}
            </button>
            <button ref={closeRef} type="button" className="tc-btn" onClick={closeTopic} aria-label={en ? 'Close' : 'Fermer'}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="tc-body" ref={bodyRef}>
          <p className="tc-kicker">{tx(topic.kicker)}</p>
          <h2 id="tc-title" className="tc-title">{tx(topic.title)}</h2>
          <p className="tc-intro">{tx(topic.intro)}</p>

          {topic.facts?.length > 0 && (
            <dl className="tc-facts">
              {topic.facts.slice(0, 4).map((f, i) => (
                <div key={i} className="tc-fact">
                  <dt>{tx(f.label)}</dt>
                  <dd>{tx(f.value)}</dd>
                </div>
              ))}
            </dl>
          )}

          {topic.sections.length > 0 && (
            <button type="button" className="tc-morebtn" aria-expanded={more} onClick={toggleMore}>
              {more ? (en ? 'Less' : 'Moins') : (en ? 'Read more' : 'Lire plus')}
              <ChevronDown size={16} aria-hidden="true" style={{ transform: more ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s' }} />
            </button>
          )}

          <AnimatePresence initial={false}>
            {more && (
              <motion.div
                className="tc-more"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 200, damping: 28 }}
              >
                {topic.sections.map((s, i) => (
                  <section key={i} className="tc-sec">
                    <h3>{tx(s.h)}</h3>
                    <p>{tx(s.p)}</p>
                  </section>
                ))}
                <div className="tc-sources">
                  <h3>Sources</h3>
                  <ul>
                    {topic.sources.map((s) => (
                      <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.label} <ExternalLink size={12} aria-hidden="true" /></a></li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="tc-credit">
            {en ? 'Tap a picture to enlarge it · Pictures: Wikimedia Commons' : 'Touchez une image pour l’agrandir · Images : Wikimedia Commons'}
          </p>
        </div>

        <AnimatePresence>
          {zoom != null && imgs[zoom] && (
            <motion.div
              className="tc-zoom"
              onClick={() => setZoom(null)}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <motion.figure
                initial={reduce ? false : { scale: 0.85 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                onClick={(e) => e.stopPropagation()}
              >
                <img src={imgs[zoom].thumb} alt={pick(imgs[zoom].caption, lang).replace(/\*/g, '')} />
                <figcaption>
                  {tx(imgs[zoom].caption)}{' · '}
                  <a href={`https://commons.wikimedia.org/wiki/File:${encodeURIComponent(imgs[zoom].file)}`} target="_blank" rel="noreferrer">
                    {en ? 'credit' : 'crédit'} <ExternalLink size={11} aria-hidden="true" />
                  </a>
                </figcaption>
                <div className="tc-zoom-nav">
                  <button type="button" className="tc-btn" onClick={() => setZoom((zoom - 1 + imgs.length) % imgs.length)} aria-label={en ? 'Previous picture' : 'Image précédente'}>‹</button>
                  <span>{zoom + 1} / {imgs.length}</span>
                  <button type="button" className="tc-btn" onClick={() => setZoom((zoom + 1) % imgs.length)} aria-label={en ? 'Next picture' : 'Image suivante'}>›</button>
                  <button type="button" className="tc-btn" onClick={() => setZoom(null)} aria-label={en ? 'Close picture' : 'Fermer l’image'}><X size={16} aria-hidden="true" /></button>
                </div>
              </motion.figure>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
