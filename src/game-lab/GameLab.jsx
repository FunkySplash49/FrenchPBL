import { Suspense, useEffect, useState } from 'react';
import { Languages } from 'lucide-react';
import { useLang } from '../lib/lang';
import { haptic } from '../lib/haptics';
import { GAMES } from './registry';
import { useT } from './kit';

/* Game lab: browse and play every prototype. ?g=<id> opens one directly. */
function readId() {
  const id = new URLSearchParams(window.location.search).get('g');
  return GAMES.some((g) => g.id === id) ? id : GAMES[0].id;
}

export default function GameLab() {
  const t = useT();
  const { lang, cycle } = useLang();
  const [id, setId] = useState(readId);
  const game = GAMES.find((g) => g.id === id);
  const Game = game.component;

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('g', id);
    window.history.replaceState(null, '', url);
  }, [id]);

  return (
    <div className="lab">
      <header className="lab-head">
        <a className="wordmark-sm lab-home" href="https://alesia-story.vercel.app/">Alésia</a>
        <p className="lab-kicker">Game Lab · {GAMES.length} {t({ fr: 'prototypes', en: 'prototypes' })}</p>
        <button type="button" className="lang-btn" onClick={() => { haptic('light'); cycle(); }}>
          <Languages size={20} strokeWidth={1.75} aria-hidden="true" />
          <span>{lang === 'en' ? 'EN' : lang === 'frp' ? 'FR +' : 'FR'}</span>
        </button>
      </header>

      <nav className="lab-list" aria-label={t({ fr: 'Prototypes', en: 'Prototypes' })}>
        {GAMES.map((g, i) => (
          <button
            key={g.id}
            type="button"
            className={`lab-item${g.id === id ? ' is-on' : ''}`}
            aria-current={g.id === id ? 'true' : undefined}
            onClick={() => { haptic('tick'); setId(g.id); }}
          >
            <span className="lab-num">{String(i + 1).padStart(2, '0')}</span>
            <span className="lab-name">{t(g.title)}</span>
            <span className="lab-meta">
              {g.inspired} · {g.depth === 'ultimate' ? t({ fr: '★ projet principal', en: '★ main project' }) : g.depth === 'complex' ? t({ fr: 'complexe', en: 'complex' }) : t({ fr: 'simple', en: 'simple' })} · ~{g.minutes} min
            </span>
          </button>
        ))}
      </nav>

      <main className="lab-stage">
        <p className="lab-pitch">{t(game.pitch)}</p>
        <Suspense fallback={<p className="lab-loading">{t({ fr: 'Chargement…', en: 'Loading…' })}</p>}>
          <Game key={game.id} />
        </Suspense>
      </main>
    </div>
  );
}
