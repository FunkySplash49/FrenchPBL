import { useEffect, useId, useRef, useState } from 'react';
import { VOCAB } from '../data/vocab';

/*
 * A French vocabulary word with a tooltip (English + pronunciation).
 * Desktop: hover or keyboard focus. Phones: tap to open, tap elsewhere / Esc to close
 * (on small screens the tip docks above the bottom rail so it never overflows).
 */
export default function Term({ id, display }) {
  const tipId = useId();
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
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

  const toggle = () => setOpen((o) => !o);
  return (
    <span
      ref={ref}
      className={`term${open ? ' is-open' : ''}`}
      tabIndex={0}
      role="button"
      aria-expanded={open}
      aria-describedby={tipId}
      lang="fr"
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggle(); }
      }}
    >
      {display ?? v.fr}
      <span role="tooltip" id={tipId} className="term-tip" lang="en">
        <span className="term-tip-fr" lang="fr">{v.fr}</span>
        <span className="term-tip-en">{v.en}</span>
        <span className="term-tip-say">« {v.say} »</span>
      </span>
    </span>
  );
}
