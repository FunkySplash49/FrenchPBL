import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useLang, pick } from '../lib/lang';
import { haptic } from '../lib/haptics';
import { Brackets } from '../visuals/motionKit';

/*
 * Shared kit for the game lab. Every game is a self-contained React component that
 * renders inside <GameFrame> — the same panel as the story's diagrams (.viz), so a
 * game can be dropped into any story step as its visual.
 */

/** t({fr,en}) in the current language */
export function useT() {
  const { lang } = useLang();
  return useCallback((s) => pick(s, lang), [lang]);
}

export const rand = (n) => Math.floor(Math.random() * n);
export const shuffle = (a) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = rand(i + 1); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
};
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export { haptic };

/** setInterval that pauses when `on` is false */
export function useTicker(fn, ms, on = true) {
  const saved = useRef(fn);
  saved.current = fn;
  useEffect(() => {
    if (!on) return undefined;
    const id = setInterval(() => saved.current(), ms);
    return () => clearInterval(id);
  }, [ms, on]);
}

export function usePersist(key, initial) {
  const [v, setV] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : initial; } catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } }, [key, v]);
  return [v, setV];
}

/**
 * Panel around a game.
 * title / kicker are {fr,en}; status is any node shown on the right of the header (score, turn…).
 */
export function GameFrame({ kicker, title, status, onRestart, children, className = '' }) {
  const t = useT();
  return (
    <section className={`viz game-frame ${className}`}>
      <Brackets />
      <header className="gf-head">
        <div>
          {kicker && <p className="gf-kicker">{t(kicker)}</p>}
          <h3 className="gf-title">{t(title)}</h3>
        </div>
        <div className="gf-status">
          {status}
          {onRestart && (
            <button type="button" className="gf-icon" onClick={() => { haptic('light'); onRestart(); }}
              aria-label={t({ fr: 'Recommencer', en: 'Restart' })}>
              <RotateCcw size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
          )}
        </div>
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

export function Meter({ label, value, max = 100, side = 'neutral' }) {
  const pct = clamp((value / max) * 100, 0, 100);
  return (
    <div className={`gf-meter gf-meter-${side}`} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)} aria-label={label}>
      <span className="gf-meter-label">{label}</span>
      <span className="gf-meter-bar"><span className="gf-meter-fill" style={{ transform: `scaleX(${pct / 100})` }} /></span>
      <span className="gf-meter-val">{Math.round(value)}</span>
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

/** live region for screen readers + a visual toast */
export function Toast({ msg }) {
  return <p className="gf-toast" aria-live="polite">{msg}</p>;
}
