import { RefreshCw, WifiOff } from 'lucide-react';
import { useT } from '../kit';
import { useLang } from '../../lib/lang';
import { useClassBoard, ClassRows, CB } from './percee/ClassBoard';
import { useGamekeeper } from './percee/Gamekeeper';
import './Percee.css';

/*
 * La Percée — the class board alone, full screen, for the classroom's big screen:  ?g=percee&board
 * Refreshes itself every 15 s; nothing to touch. The language follows the lab's setting (?lang is not needed).
 * With &admin (?g=percee&board&admin) the teacher also gets the gamekeeper panel (reset the board,
 * remove one row) once the key is entered; without it nothing of that panel is rendered or requested.
 */
const isAdmin = () => new URLSearchParams(window.location.search).has('admin');

export default function PerceeBoard() {
  return isAdmin() ? <KeeperBoard /> : <Board />;
}

function KeeperBoard() {
  const t = useT();
  const board = useClassBoard({ every: 15000 });
  const gk = useGamekeeper({ rows: board.rows, refresh: board.refresh, t });
  return <Board board={board} gk={gk} />;
}

function Board({ board, gk = null }) {
  const t = useT();
  const { lang, cycle } = useLang();
  const own = useClassBoard({ every: 15000, paused: !!board });
  const { rows, state, at, refresh } = board || own;
  const rowAction = gk ? gk.rowAction : null;
  const play = (() => { const u = new URL(window.location.href); u.searchParams.delete('board'); u.searchParams.delete('admin'); u.searchParams.set('g', 'percee'); return u.toString(); })();
  return (
    <main className="pcb">
      <header className="pcb-head">
        <div>
          <p className="pcb-kicker">{t({ fr: 'La Percée · Alésia, 52 av. J.-C.', en: 'The Breakout · Alésia, 52 BC' })}</p>
          <h1 className="pcb-title">{t(CB.title)}</h1>
        </div>
        <div className="pcb-tools">
          <button type="button" className="gf-btn" onClick={cycle}>{lang === 'en' ? 'EN' : 'FR'}</button>
          <button type="button" className="gf-btn" onClick={() => refresh({ fresh: true })}><RefreshCw size="1em" aria-hidden="true" /> {t(CB.refresh)}</button>
        </div>
        {gk && gk.panel}
      </header>
      {state === 'offline' && <p className="pc-offline pcb-off" role="status"><WifiOff size="1em" aria-hidden="true" /> {t(CB.offlineScreen)}</p>}
      {!rows ? (
        state === 'loading' && <p className="pcb-msg" role="status">{t(CB.loading)}</p>
      ) : rows.length ? (
        rows.length > 18 ? (
          // a whole class does not fit one column on the wall screen: two columns, top half on the left
          <div className="pcb-cols">
            <ClassRows rows={rows.slice(0, Math.ceil(rows.length / 2))} me={null} t={t} rowAction={rowAction} />
            <ClassRows rows={rows.slice(Math.ceil(rows.length / 2))} start={Math.ceil(rows.length / 2)} me={null} t={t} rowAction={rowAction} />
          </div>
        ) : <ClassRows rows={rows} me={null} t={t} rowAction={rowAction} />
      ) : <p className="pcb-msg">{t(CB.empty)}</p>}
      <footer className="pcb-foot">
        <span>{t(CB.one)}</span>
        <span>{at ? `${t(CB.updated)} ${new Date(at).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'fr-FR')} · ${t(CB.auto)}` : ''}</span>
        <a href={play}>{t({ fr: 'Jouer', en: 'Play' })}</a>
      </footer>
    </main>
  );
}
