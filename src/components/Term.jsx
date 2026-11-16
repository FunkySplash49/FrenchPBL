import { useEffect, useId, useRef, useState } from 'react';
import { VOCAB } from '../data/vocab';
import { haptic } from '../lib/haptics';
import { useLang } from '../lib/lang';

/*
 * A vocabulary word with a tooltip.
 *  FR / FR+pron: the French word is shown; the tip gives English + pronunciation.
 *  EN: the English word is shown; the tip flips — French word + how to say it.
 * Desktop: hover or keyboard focus. Phones: tap to open, tap elsewhere / Esc to close
 * (on small screens the tip docks above the bottom rail so it never overflows).
 */
export default function Term({ id, display }) {
  const tipId = useId();
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const { lang } = useLang();
  const v = VOCAB[id];

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!v) return <>{display ?? id}</>;

  const toggle = () => { if (!open) haptic('light'); setOpen((o) => !o); };
  const en = lang === 'en';
  const shownFr = display ?? v.fr;
  const shown = en ? (v.forms?.[display] ?? v.word ?? shownFr) : shownFr;
  const plural = display && display !== v.fr && v.forms?.[display] ? display : null;

  return (
    <span
      ref={ref}
      className={`term${en ? ' is-en' : ''}${open ? ' is-open' : ''}`}
      tabIndex={0}
      role="button"
      aria-expanded={open}
      aria-describedby={tipId}
      lang={en ? 'en' : 'fr'}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggle(); }
      }}
    >
      {shown}
      {en ? (
        <span role="tooltip" id={tipId} className="term-tip">
          <span className="term-tip-kicker">En français</span>
          <span className="term-tip-fr" lang="fr">{v.fr}{plural && <span className="term-tip-pl"> · pl. {plural}</span>}</span>
          <span className="term-tip-say">« {v.say} »</span>
        </span>
      ) : (
        <span role="tooltip" id={tipId} className="term-tip" lang="en">
          <span className="term-tip-fr" lang="fr">{v.fr}</span>
          <span className="term-tip-en">{v.en}</span>
          <span className="term-tip-say">« {v.say} »</span>
        </span>
      )}
    </span>
  );
}
