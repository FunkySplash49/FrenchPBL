import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowDown, X, ExternalLink } from 'lucide-react';
import { TOPICS } from '../../data/topics';
import { PREVIEWS } from '../../data/previews';
import { useLang, pick, frTypo } from '../../lib/lang';
import { closeTopic, takeOrigin } from '../../lib/topic';
import { diveIn, diveOut } from '../../lib/dive';
import { haptic } from '../../lib/haptics';
import TopicTunnel from './TopicTunnel';
import './topic.css';

/*
 * A key word's own page (#/sujet/<id>), entered through a camera move that plays by itself:
 *   1. dive   — the story pulls back (winding up), then the camera plunges into the word
 *   2. flight — the topic's pictures fly past the camera (perspective tunnel)
 *   3. page   — the title settles over the drifting pictures; the article sits below
 * Any click / key during 1–2 skips to the page. Esc, Back or "Retour" plays it in reverse.
 */
const FLIGHT_S = 2.8;

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

export default function TopicView({ id }) {
  const topic = TOPICS[id] || fallback(id);
  const reduce = useReducedMotion();
  const { lang, cycle } = useLang();
  const en = lang === 'en';
  const tx = useText();
  const scrollRef = useRef(null);
  const articleRef = useRef(null);
  const backRef = useRef(null);
  const [origin] = useState(() => takeOrigin());
  const [phase, setPhase] = useState(reduce ? 'page' : origin ? 'dive' : 'flight');
  const [zoom, setZoom] = useState(null);
  const progress = useMotionValue(0);
  const ambient = useMotionValue(0);
  const flight = useRef(null);

  // skipping: snap the flight to its end and show the page
  const toPage = useCallback(() => {
    flight.current?.complete();
    setPhase('page');
  }, []);

  // 1. dive: the story winds up and plunges (lib/dive.js), then 2. the flight starts
  useEffect(() => {
    let alive = true;
    // fetch + decode the pictures during the wind-up so the flight is never empty
    topic?.images.forEach((im) => { const i = new Image(); i.decoding = 'async'; i.src = im.thumb; i.decode?.().catch(() => {}); });
    if (phase === 'dive') diveIn(origin).then(() => { if (alive) setPhase((p) => (p === 'dive' ? 'flight' : p)); });
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 2. flight: pictures leave the far end and pass the camera, by themselves
  useEffect(() => {
    if (phase !== 'flight') return undefined;
    // land as the last pictures pass the camera (no empty tail)
    const c = animate(progress, 1, {
      duration: FLIGHT_S, ease: [0.4, 0, 0.6, 1],
      onUpdate: (v) => { if (v > 0.8) setPhase('page'); },
    });
    flight.current = c;
  }, [phase, progress]);

  // 3. page: pictures keep drifting behind the title
  useEffect(() => {
    if (phase !== 'page' || reduce) return undefined;
    let a; let loop; let alive = true;
    // let the last pictures finish passing, then drift on
    const start = () => {
      if (!alive) return;
      progress.jump(1);
      a = animate(ambient, 1, { duration: 0.9 });
      loop = animate(progress, [1, 3], { duration: 44, ease: 'linear', repeat: Infinity });
    };
    const f = flight.current;
    if (f && progress.get() < 1) f.finished.then(start); else start();
    backRef.current?.focus({ preventScroll: true });
    return () => { alive = false; a?.stop(); loop?.stop(); };
  }, [phase, progress, ambient, reduce]);

  // lock the page behind; put the story back (in reverse) when leaving
  useEffect(() => {
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => { html.style.overflow = before; diveOut(reduce); };
  }, [reduce]);

  // keys: skip the intro / close / keep the story's presenter keys quiet underneath
  useEffect(() => {
    const on = (e) => {
      const typing = e.target.closest?.('button, a');
      if (e.key === 'Escape') { e.preventDefault(); if (zoom != null) setZoom(null); else closeTopic(); }
      else if (phase !== 'page') { e.preventDefault(); toPage(); }
      if ([' ', 'ArrowRight', 'ArrowLeft', 'Home'].includes(e.key) && !typing) e.stopPropagation();
    };
    window.addEventListener('keydown', on, true);
    return () => window.removeEventListener('keydown', on, true);
  }, [zoom, phase, toPage]);

  if (!topic) return null;
  const imgs = topic.images;
  const intro = phase !== 'page';
  const toArticle = () => articleRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  const pickImg = (i) => { if (intro) return; haptic('light'); setZoom(i); };

  return (
    <motion.div
      className={`tv${intro ? ' is-intro' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tv-title"
      lang={en ? 'en' : 'fr'}
      initial={{ opacity: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: 'blur(6px)', transition: { duration: 0.45, ease: [0.64, 0, 0.78, 0] } }}
      onPointerDown={intro ? toPage : undefined}
    >
      {/* the dark of the "inside": fades in as the camera passes through the word */}
      <motion.div
        className="tv-void"
        aria-hidden="true"
        initial={{ opacity: origin && !reduce ? 0 : 1 }}
        animate={{ opacity: 1 }}
        transition={phase === 'dive' ? { delay: 0.85, duration: 0.45 } : { duration: 0.3 }}
      />

      <div className="tv-scroll" ref={scrollRef}>
        <section className="tv-hero">
          {phase !== 'dive' && (
            <TopicTunnel images={imgs} progress={progress} ambient={ambient} reduce={reduce} onPick={pickImg} />
          )}
          <motion.div
            className="tv-head"
            initial={false}
            animate={intro ? { opacity: 0, scale: 0.7, filter: 'blur(8px)' } : { opacity: 1, scale: 1, filter: 'blur(0px)' }}
            transition={{ type: 'spring', stiffness: 90, damping: 18 }}
          >
            <p className="tv-kicker">{tx(topic.kicker)}</p>
            <h1 id="tv-title" className="tv-title">{tx(topic.title)}</h1>
            <p className="tv-lede">{tx(topic.intro)}</p>
            <button type="button" className="tv-read" onClick={toArticle} tabIndex={intro ? -1 : 0}>
              {en ? 'Read' : 'Lire'} <ArrowDown size={16} aria-hidden="true" />
            </button>
          </motion.div>
          {intro && phase !== 'dive' && <p className="tv-skip" aria-hidden="true">{en ? 'tap to skip' : 'touchez pour passer'}</p>}
        </section>

        {!intro && (
          <article className="tv-article" ref={articleRef}>
            {topic.facts?.length > 0 && (
              <dl className="tv-facts">
                {topic.facts.map((f, i) => (
                  <div key={i} className="tv-fact"><dt>{tx(f.label)}</dt><dd>{tx(f.value)}</dd></div>
                ))}
              </dl>
            )}

            {topic.sections.map((s, i) => (
              <motion.section
                key={i}
                className="tv-sec"
                initial={reduce ? false : { opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ root: scrollRef, once: true, amount: 0.25 }}
                transition={{ type: 'spring', stiffness: 110, damping: 20 }}
              >
                <h2>{tx(s.h)}</h2>
                <p>{tx(s.p)}</p>
                {imgs[i + 1] && (
                  <figure className="tv-fig">
                    <button type="button" onClick={() => setZoom(i + 1)} aria-label={en ? 'Enlarge picture' : 'Agrandir l’image'}>
                      <img src={imgs[i + 1].thumb} alt="" loading="lazy" decoding="async" />
                    </button>
                    <figcaption>{tx(imgs[i + 1].caption)}</figcaption>
                  </figure>
                )}
              </motion.section>
            ))}

            <section className="tv-gallery" aria-label={en ? 'All pictures' : 'Toutes les images'}>
              <h2>{en ? 'Pictures' : 'Images'}</h2>
              <ul>
                {imgs.map((img, i) => (
                  <li key={img.thumb}>
                    <button type="button" onClick={() => setZoom(i)}>
                      <img src={img.thumb} alt={pick(img.caption, lang).replace(/\*/g, '')} loading="lazy" decoding="async" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <footer className="tv-sources">
              <h2>Sources</h2>
              <ul>
                {topic.sources.map((s) => (
                  <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.label} <ExternalLink size={13} aria-hidden="true" /></a></li>
                ))}
              </ul>
              <p className="tv-credit">
                {en ? 'Pictures: Wikimedia Commons (author and licence on each file).' : 'Images : Wikimedia Commons (auteur et licence sur chaque fichier).'}
              </p>
              <button type="button" className="btn-primary tv-done" onClick={closeTopic}>
                <ArrowLeft size={16} aria-hidden="true" /> {en ? 'Back to the story' : 'Retour au récit'}
              </button>
            </footer>
          </article>
        )}
      </div>

      <AnimatePresence>
        {!intro && (
          <motion.div className="tv-bar" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <button ref={backRef} type="button" className="tv-btn tv-back" onClick={closeTopic}>
              <ArrowLeft size={18} aria-hidden="true" /> <span>{en ? 'Back to the story' : 'Retour au récit'}</span>
            </button>
            <span className="tv-bar-end">
              <button type="button" className="tv-btn tv-round" onClick={() => { haptic('light'); cycle(); }}
                aria-label={en ? 'Language: English. Change language' : 'Langue : français. Changer de langue'}>
                {en ? 'EN' : 'FR'}
              </button>
              <button type="button" className="tv-btn tv-round" onClick={closeTopic} aria-label={en ? 'Close' : 'Fermer'}>
                <X size={20} aria-hidden="true" />
              </button>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {zoom != null && imgs[zoom] && (
          <motion.div className="tv-zoom" onClick={() => setZoom(null)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.figure
              initial={reduce ? false : { scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }}
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
              <div className="tv-zoom-nav">
                <button type="button" className="tv-btn tv-round" onClick={() => setZoom((zoom - 1 + imgs.length) % imgs.length)} aria-label={en ? 'Previous picture' : 'Image précédente'}>‹</button>
                <span>{zoom + 1} / {imgs.length}</span>
                <button type="button" className="tv-btn tv-round" onClick={() => setZoom((zoom + 1) % imgs.length)} aria-label={en ? 'Next picture' : 'Image suivante'}>›</button>
                <button type="button" className="tv-btn tv-round" onClick={() => setZoom(null)} aria-label={en ? 'Close picture' : 'Fermer l’image'}><X size={18} aria-hidden="true" /></button>
              </div>
            </motion.figure>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
