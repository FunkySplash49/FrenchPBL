import { Languages } from 'lucide-react';
import { useLang } from '../lib/lang';
import { haptic } from '../lib/haptics';

const LABEL = {
  fr:  { short: 'FR', long: 'Français', next: 'English' },
  en:  { short: 'EN', long: 'English', next: 'Français + prononciation' },
  frp: { short: 'FR +', long: 'Français + prononciation', next: 'Français' },
};

export default function TopBar({ onHome }) {
  const { lang, cycle } = useLang();
  const l = LABEL[lang];
  return (
    <header className="topbar">
      <button type="button" className="wordmark-sm" onClick={onHome} aria-label={lang === 'en' ? 'Back to the start' : 'Revenir au début'}>
        Alésia
      </button>
      <button
        type="button"
        className="lang-btn"
        onClick={() => { haptic('light'); cycle(); }}
        aria-label={`${lang === 'en' ? 'Language' : 'Langue'} : ${l.long}. ${lang === 'en' ? 'Switch to' : 'Passer en'} ${l.next}`}
      >
        <Languages size={20} strokeWidth={1.75} aria-hidden="true" />
        <span>{l.short}</span>
      </button>
    </header>
  );
}
