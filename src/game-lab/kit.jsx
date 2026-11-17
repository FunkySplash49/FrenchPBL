import { useCallback, useEffect, useState } from 'react';
import { useLang, pick } from '../lib/lang';
import { haptic } from '../lib/haptics';
import TvScreen from '../visuals/TvScreen';

/*
 * Shared kit for the game lab. A game renders inside <GameFrame> — the same panel as the
 * story's diagrams (.viz), so it can be dropped into a story step as its visual.
 * Deliberately does not import visuals/motionKit: that pulls in GSAP + ScrollTrigger, which the
 * lab never uses. The corner brackets are the same markup as motionKit's <Brackets/>.
 */

/** t({fr,en}) in the current language */
export function useT() {
  const { lang } = useLang();
  return useCallback((s) => pick(s, lang), [lang]);
}

export { haptic };

export function usePersist(key, initial) {
  const [v, setV] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : initial; } catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } }, [key, v]);
  return [v, setV];
}

/** corner brackets + TV glass (same markup as visuals/motionKit's Brackets) */
function Brackets() {
  return (
    <>
      <span className="brk brk-tl" aria-hidden="true" />
      <span className="brk brk-tr" aria-hidden="true" />
      <span className="brk brk-bl" aria-hidden="true" />
      <span className="brk brk-br" aria-hidden="true" />
      <TvScreen />
    </>
  );
}

/**
 * Panel around a game.
 * title / kicker are {fr,en}; status is any node shown on the right of the header.
 */
export function GameFrame({ kicker, title, status, children, className = '' }) {
  const t = useT();
  return (
    <section className={`viz game-frame ${className}`}>
      <Brackets />
      <header className="gf-head">
        <div>
          {kicker && <p className="gf-kicker">{t(kicker)}</p>}
          <h3 className="gf-title">{t(title)}</h3>
        </div>
        <div className="gf-status">{status}</div>
      </header>
      {children}
    </section>
  );
}

/** Intro / end card inside a game */
export function Card({ title, children, action, onAction, tone = '' }) {
  const t = useT();
  return (
    <div className={`gf-card ${tone}`}>
      {title && <p className="gf-card-title">{t(title)}</p>}
      <div className="gf-card-body">{children}</div>
      {action && (
        <button type="button" className="btn-primary" onClick={() => { haptic('light'); onAction(); }}>{t(action)}</button>
      )}
    </div>
  );
}

/** End-of-game honesty: one source line + what the game simplified (research: 03-edu-design.md) */
export function Debrief({ source, simplified }) {
  const t = useT();
  return (
    <>
      {source && <p className="gf-source">{t(source)}</p>}
      {simplified && (
        <p className="gf-simplified">
          <strong>{t({ fr: 'Ce que le jeu simplifie : ', en: 'What this game simplifies: ' })}</strong>
          {t(simplified)}
        </p>
      )}
    </>
  );
}
