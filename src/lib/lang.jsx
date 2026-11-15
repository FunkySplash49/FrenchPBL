import { createContext, useContext, useEffect, useState } from 'react';

/**
 * Three language modes:
 *  fr  — French (default)
 *  en  — English
 *  frp — French + an italic pronunciation hint under key lines
 */
const LangContext = createContext({ lang: 'fr', cycle: () => {} });
const ORDER = ['fr', 'en', 'frp'];
const KEY = 'alesia-lang';

function readStored() {
  try {
    const v = localStorage.getItem(KEY);
    return ORDER.includes(v) ? v : 'fr';
  } catch {
    return 'fr';
  }
}

export function LangProvider({ children }) {
  const [lang, setLang] = useState(readStored);

  useEffect(() => {
    document.documentElement.lang = lang === 'en' ? 'en' : 'fr';
    try { localStorage.setItem(KEY, lang); } catch { /* private mode: fine */ }
  }, [lang]);

  const cycle = () => setLang((l) => ORDER[(ORDER.indexOf(l) + 1) % ORDER.length]);

  return <LangContext.Provider value={{ lang, cycle }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

/** Pick the active string from a { fr, en, say } object (or pass a plain string through). */
export function pick(text, lang) {
  if (text == null) return '';
  if (typeof text === 'string') return text;
  return lang === 'en' && text.en ? text.en : text.fr;
}

/** French typography: narrow no-break space before : ; ! ? » and after «. */
export function frTypo(s) {
  return s
    .replace(/ ([:;!?»])/g, ' $1')
    .replace(/« /g, '« ');
}
