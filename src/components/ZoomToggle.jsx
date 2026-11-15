import { useEffect, useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import { useLang } from '../lib/lang';
import { ScrollTrigger } from '../lib/motion';

/*
 * Phones: open a diagram full screen so it can be panned and pinch-zoomed.
 * Works on the same DOM node (class toggle), so animation state is kept.
 * The figure's slot keeps its height while open, so the page never jumps.
 */
export default function ZoomToggle({ target }) {
  const { lang } = useLang();
  const en = lang === 'en';
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fig = target.current;
    if (!fig) return undefined;
    const slot = fig.parentElement;
    if (open) {
      // freeze this diagram's scroll scenes so going full screen never resets them
      const frozen = ScrollTrigger.getAll().filter((st) => st.trigger && fig.contains(st.trigger));
      frozen.forEach((st) => st.disable(false));
      slot.style.minHeight = `${fig.offsetHeight}px`;
      fig.classList.add('is-zoomed');
      document.documentElement.classList.add('zoom-lock');
      fig.scrollTo?.({ left: (fig.scrollWidth - fig.clientWidth) / 2, top: 0 });
      const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
      document.addEventListener('keydown', onKey);
      return () => {
        document.removeEventListener('keydown', onKey);
        fig.classList.remove('is-zoomed');
        document.documentElement.classList.remove('zoom-lock');
        slot.style.minHeight = '';
        frozen.forEach((st) => st.enable(false));
        ScrollTrigger.refresh();
      };
    }
    return undefined;
  }, [open, target]);

  return (
    <button
      type="button"
      className={`zoom-toggle${open ? ' is-open' : ''}`}
      onClick={() => setOpen((o) => !o)}
      aria-pressed={open}
      aria-label={open ? (en ? 'Close full screen' : 'Fermer le plein écran') : (en ? 'Open full screen' : 'Agrandir en plein écran')}
    >
      {open
        ? <X size={20} strokeWidth={1.75} aria-hidden="true" />
        : <Maximize2 size={18} strokeWidth={1.75} aria-hidden="true" />}
      <span>{open ? (en ? 'Close' : 'Fermer') : (en ? 'Enlarge' : 'Agrandir')}</span>
    </button>
  );
}
