import { Suspense, lazy } from 'react';
import { Languages } from 'lucide-react';
import { useLang } from '../lib/lang';
import { haptic } from '../lib/haptics';
import { GAMES } from './registry';
import { useT } from './kit';

/*
 * Game lab: it holds one game, La Percée, so it opens straight into it (no picker).
 * Bare /, ?g=percee, ?seed=… and ?bigscreen all land here; ?g=percee&board shows the class board alone.
 */
const PerceeBoard = lazy(() => import('./games/PerceeBoard'));
const boardOnly = () => { const q = new URLSearchParams(window.location.search); return q.get('g') === 'percee' && q.has('board'); };

export default function GameLab() {
  if (boardOnly()) return <Suspense fallback={null}><PerceeBoard /></Suspense>;
  return <Lab />;
}

function Lab() {
  const t = useT();
  const { lang, cycle } = useLang();
  const game = GAMES[0];
  const Game = game.component;

  return (
    <div className="lab">
      <header className="lab-head">
        <a className="wordmark-sm lab-home" href="https://alesia-story.vercel.app/">Alésia</a>
        <p className="lab-kicker">{t({ fr: 'Le jeu d’Alésia', en: 'The Alésia game' })}</p>
        <button type="button" className="lang-btn" onClick={() => { haptic('light'); cycle(); }}>
          <Languages size={20} strokeWidth={1.75} aria-hidden="true" />
          <span>{lang === 'en' ? 'EN' : lang === 'frp' ? 'FR +' : 'FR'}</span>
        </button>
      </header>

      <main className="lab-stage">
        <p className="lab-pitch">{t(game.pitch)}</p>
        <Suspense fallback={<p className="lab-loading">{t({ fr: 'Chargement…', en: 'Loading…' })}</p>}>
          <Game />
        </Suspense>
      </main>
    </div>
  );
}
