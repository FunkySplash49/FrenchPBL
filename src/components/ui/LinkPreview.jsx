import { useRef, useState } from 'react';
import * as HoverCard from '@radix-ui/react-hover-card';
import { AnimatePresence, motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion';
import { PREVIEWS } from '../../data/previews';
import { useLang, pick } from '../../lib/lang';
import { haptic } from '../../lib/haptics';
import { openTopic } from '../../lib/topic';

/*
 * Picture preview on a key word — adapted from Aceternity's LinkPreview
 * (Radix hover card + framer-motion spring + mouse-follow drift) for this
 * Vite/JS project: no Next.js Image/Link, no screenshot API — curated Wikimedia pictures.
 *
 * Mouse: hover opens the picture card, click opens the word's pop-up topic card (#/sujet/<id>).
 * Touch: first tap opens the card (with a haptic tick), second tap opens the topic card.
 */
const preloaded = new Set();
const preload = (src) => {
  if (!src || preloaded.has(src)) return;
  preloaded.add(src);
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
};

function Caption({ text }) {
  // *italic* inside captions
  return text.split(/(\*[^*]+\*)/g).map((part, i) =>
    part.startsWith('*') && part.endsWith('*') ? <em key={i}>{part.slice(1, -1)}</em> : part,
  );
}

export function LinkPreview({ id, children }) {
  const p = PREVIEWS[id];
  const { lang } = useLang();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const wasOpenAtPress = useRef(false);
  const touchPress = useRef(false);
  const triggerRef = useRef(null);

  const x = useMotionValue(0);
  const drift = useSpring(x, { stiffness: 100, damping: 15 });

  if (!p) return <>{children}</>;

  const setBoth = (v) => { openRef.current = v; setOpen(v); };

  const onMouseMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - r.left - r.width / 2) / 2);
  };

  return (
    <HoverCard.Root openDelay={50} closeDelay={100} open={open} onOpenChange={setBoth}>
      <HoverCard.Trigger asChild>
        <a
          ref={triggerRef}
          href={`#/sujet/${id}`}
          className={`lp-link${p.italic ? ' is-italic' : ''}`}
          onMouseMove={onMouseMove}
          onPointerEnter={() => preload(p.img)}
          onFocus={() => preload(p.img)}
          onPointerDown={(e) => {
            touchPress.current = e.pointerType !== 'mouse';
            wasOpenAtPress.current = openRef.current;
            preload(p.img);
          }}
          onClick={(e) => {
            e.preventDefault();
            if (touchPress.current && !wasOpenAtPress.current) {
              setBoth(true);
              haptic('light');
              return;
            }
            haptic('tick');
            setBoth(false);
            openTopic(id, e.currentTarget.getBoundingClientRect());
          }}
        >
          {children}
          <span className="lp-arrow" aria-hidden="true">→</span>
          <span className="sr-only">{lang === 'en' ? ' (opens a card about it)' : ' (ouvre une fiche)'}</span>
        </a>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="top"
          align="center"
          sideOffset={10}
          collisionPadding={12}
          className="lp-content"
          onPointerDownOutside={(e) => {
            // a second tap on the word itself should open the topic card, not close the card
            if (triggerRef.current?.contains(e.target)) e.preventDefault();
          }}
        >
          <AnimatePresence>
            {open && (
              <motion.div
                className="lp-card"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.6 }}
                animate={reduce
                  ? { opacity: 1, transition: { duration: 0.15 } }
                  : { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 20 } }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.6 }}
                style={reduce ? undefined : { x: drift }}
              >
                <a
                  className="lp-card-link"
                  href={`#/sujet/${id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    haptic('tick');
                    setBoth(false);
                    openTopic(id, triggerRef.current?.getBoundingClientRect());
                  }}
                >
                  <img
                    src={p.img}
                    alt=""
                    width="240"
                    height="150"
                    decoding="async"
                    style={{ objectPosition: p.pos }}
                  />
                  <span className="lp-caption"><Caption text={pick(p.caption, lang)} /></span>
                  <span className="lp-more">{lang === 'en' ? 'More about it →' : 'En savoir plus →'}</span>
                </a>
                <a className="lp-credit" href={p.file} target="_blank" rel="noreferrer">
                  {lang === 'en' ? 'Image: Wikimedia Commons' : 'Image : Wikimedia Commons'}
                </a>
              </motion.div>
            )}
          </AnimatePresence>
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}

export default LinkPreview;
