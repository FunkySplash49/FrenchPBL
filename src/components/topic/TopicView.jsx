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
 *   1. dive   — the story pulls back (winding up), then the camera plunges into the word;
 *               as it plunges, the topic's pictures start streaming out of the far end
 *   2. flight — the pictures fly past the camera (perspective tunnel)
 *   3. page   — mid-stream, the title settles in; the stream eases into a slow drift
 * Any click / key during 1–2 skips to the page. Esc, Back or "Retour" plays it in reverse.
 */
const INTRO_TO = 1.8; // stream position where the intro flight hands over to the drift
const INTRO_S = 3.6;  // s
const LAND_AT = 1.05; // the title lands while pictures are still streaming past
const DRIFT_S = 26;   // s per tunnel length once the page is up

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
  const stream = useRef(null);

  // the picture stream: one continuous flight — fast while the camera dives,
  // easing off into an ambient drift. The title lands mid-stream, so the
  // pictures overlap both the dive and the landing with no gap.
  const startStream = useCallback(() => {
    if (stream.current || reduce) return;
    const s = { stop: () => {} };
    stream.current = s;
    const intro = animate(progress, INTRO_TO, {
      duration: INTRO_S, ease: [0.3, 0.55, 0.35, 1],
      onUpdate: (v) => { if (v > LAND_AT) setPhase('page'); },
      onComplete: () => {
        const from = progress.get();
        const drift = animate(progress, from + 100, { duration: 100 * DRIFT_S, ease: 'linear' });
        s.stop = () => drift.stop();
      },
    });
    s.stop = () => intro.stop();
  }, [progress, reduce]);

  useEffect(() => () => { stream.current?.stop(); stream.current = null; }, []);

  // skipping: the stream keeps flowing, only the title comes in early
  const toPage = useCallback(() => { startStream(); setPhase('page'); }, [startStream]);

  // 1. dive: the story winds up; the stream starts as the camera plunges
  useEffect(() => {
    // fetch + decode the pictures during the wind-up so the flight is never empty
    topic?.images.forEach((im) => { const i = new Image(); i.decoding = 'async'; i.src = im.thumb; i.decode?.().catch(() => {}); });
    if (reduce) return;
    if (phase === 'dive') diveIn(origin, startStream);
    else startStream();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 3. page: focus the way back
  useEffect(() => {
    if (phase === 'page') backRef.current?.focus({ preventScroll: true });
  }, [phase]);

  // lock the page behind; put the story back (in reverse) when leaving.
  // Runs once per open: `reduce` resolves a moment after mount (null → false), and making it a
  // dependency re-ran this effect mid-dive — the cleanup started the reverse animation while the
  // dive was starting, so the zoom aimed at a distorted position (it looked like a scroll jump).
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;
  useEffect(() => {
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => { html.style.overflow = before; diveOut(reduceRef.current); };
  }, []);

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
      {/* behind the page: the story's painted CRT backdrop, which switches to this topic's
          picture with the same pixel-by-pixel channel change as scrolling (components/Backdrop).
          A light shade on top keeps the title and pictures readable. */}
      <motion.div
        className="tv-void"
        aria-hidden="true"
        initial={{ opacity: origin && !reduce ? 0 : 1 }}
        animate={{ opacity: 1 }}
        transition={{ delay: origin && !reduce ? 0.7 : 0, duration: 0.6 }}
      />

      <div className="tv-scroll" ref={scrollRef}>
        <section className="tv-hero">
          <TopicTunnel images={imgs} progress={progress} reduce={reduce} onPick={pickImg} />
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
