import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Star, WifiOff } from 'lucide-react';
import { fetchClassBoard, sameName } from './classApi';

/*
 * La Percée — the shared class board (one row per name, best score). Loads /api/board, refreshes
 * every `every` ms while on screen (and when the tab comes back), and shows `fallback` (the board
 * stored on this device) with a notice when the API cannot be reached.
 */

export const NIGHTS_MAX = 5;
export const fmtPts = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
export const fmtTime = (s) => (s == null ? '–' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`);
const clock = (ms, lang) => new Date(ms).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export const CB = {
  title: { fr: 'Classement de la classe', en: 'Class board' },
  rank: { fr: 'Rang', en: 'Rank' },
  name: { fr: 'Nom', en: 'Name' },
  points: { fr: 'Points', en: 'Points' },
  nights: { fr: 'Nuits', en: 'Nights' },
  gold: { fr: 'Or', en: 'Gold' },
  goldNights: { fr: 'nuits en or', en: 'gold nights' },
  time: { fr: 'Temps', en: 'Time' },
  you: { fr: 'vous', en: 'you' },
  refresh: { fr: 'Actualiser', en: 'Refresh' },
  loading: { fr: 'Chargement du classement…', en: 'Loading the board…' },
  empty: { fr: 'Personne n’a encore enregistré de score. Soyez le premier !', en: 'Nobody has saved a score yet. Be the first!' },
  updated: { fr: 'Mis à jour à', en: 'Updated at' },
  auto: { fr: 'actualisation automatique', en: 'refreshes automatically' },
  offline: { fr: 'Classement de la classe injoignable (hors ligne ?). Voici les scores enregistrés sur cet appareil.', en: 'The class board cannot be reached (offline?). Here are the scores saved on this device.' },
  offlineScreen: { fr: 'Classement injoignable pour l’instant. Nouvel essai automatique…', en: 'The board cannot be reached right now. Retrying automatically…' },
  one: { fr: 'Un nom = une ligne : seul le meilleur score compte.', en: 'One name = one row: only the best score counts.' },
};

/** the live data: { rows, state: 'loading' | 'live' | 'offline', at, refresh }. `paused`: no requests (e.g. while a run is played) */
export function useClassBoard({ every = 15000, refreshKey = 0, paused = false } = {}) {
  const [rows, setRows] = useState(null);
  const [state, setState] = useState('loading');
  const [at, setAt] = useState(0);
  const busy = useRef(false);
  const alive = useRef(true);
  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const r = await fetchClassBoard();
    busy.current = false;
    if (!alive.current) return;
    if (r.ok) { setRows(r.rows); setState('live'); setAt(Date.now()); } else setState('offline');
  }, []);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { if (!paused) refresh(); }, [refresh, refreshKey, paused]);
  useEffect(() => {
    if (paused) return undefined;
    const id = setInterval(() => { if (!document.hidden) refresh(); }, every);
    const onVis = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [refresh, every, paused]);
  return { rows, state, at, refresh };
}

export function ClassRows({ rows, me, t, limit = 100, start = 0 }) {
  return (
    <ol className="pc-rows pc-class">
      <li className="pc-rows-head" aria-hidden="true">
        <span>#</span><span>{t(CB.name)}</span><span>{t(CB.points)}</span><span>{t(CB.nights)}</span><span>{t(CB.gold)}</span><span>{t(CB.time)}</span>
      </li>
      {rows.slice(0, limit).map((r, i) => {
        const mine = sameName(r.name, me);
        return (
          <li key={`${r.name}-${i}`} className={mine ? 'is-me' : undefined}>
            <span className="pc-rank">{start + i + 1}</span>
            <span className="pc-who">{r.name}{mine && <small className="pc-new"> {t(CB.you)}</small>}</span>
            <span className="pc-score">{fmtPts(r.points || 0)}</span>
            <span>{r.nights}/{NIGHTS_MAX}</span>
            <span className="pc-goldcol" title={t(CB.goldNights)}>
              {r.gold > 0 ? <><Star size="0.9em" aria-hidden="true" fill="currentColor" />{r.gold}</> : '–'}
              <span className="pc-sr"> {t(CB.goldNights)}</span>
            </span>
            <span>{fmtTime(r.time)}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** the board inside the game (menu card and end of run) */
export function ClassBoard({ me, t, lang, refreshKey = 0, paused = false, fallback = null, onScreenHref = null }) {
  const { rows, state, at, refresh } = useClassBoard({ refreshKey, paused });
  return (
    <section className="pc-board" aria-label={t(CB.title)}>
      <div className="pc-board-head">
        <h4 className="pc-board-title">{t(CB.title)}</h4>
        <button type="button" className="gf-btn" onClick={refresh} aria-label={t(CB.refresh)}>
          <RefreshCw size={16} aria-hidden="true" /> {t(CB.refresh)}
        </button>
      </div>
      {state === 'offline' && !rows ? (
        <>
          <p className="pc-offline" role="status"><WifiOff size={16} aria-hidden="true" /> {t(CB.offline)}</p>
          {fallback}
        </>
      ) : !rows ? (
        <p className="pc-note" role="status">{t(CB.loading)}</p>
      ) : (
        <>
          {state === 'offline' && <p className="pc-offline" role="status"><WifiOff size={16} aria-hidden="true" /> {t(CB.offlineScreen)}</p>}
          {rows.length ? <ClassRows rows={rows} me={me} t={t} /> : <p className="gf-simplified">{t(CB.empty)}</p>}
          <p className="pc-note" aria-live="off">{t(CB.one)} {at ? <>{t(CB.updated)} {clock(at, lang)} · {t(CB.auto)}.</> : null}
            {onScreenHref && <> <a href={onScreenHref} target="_blank" rel="noopener">{t({ fr: 'Ouvrir en plein écran', en: 'Open full screen' })}</a></>}</p>
        </>
      )}
    </section>
  );
}
