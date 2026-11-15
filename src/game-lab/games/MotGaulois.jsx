import { useCallback, useEffect, useMemo, useState } from 'react';
import { Delete, CornerDownLeft } from 'lucide-react';
import { GameFrame, Card, Debrief, useT, haptic, rand } from '../kit';
import './MotGaulois.css';

/*
 * Wordle → "Le mot gaulois": guess a 5-letter French word that comes from Gaulish.
 * Tiles: gold = right place, ember = in the word, dark = absent (no green/red: those mean Gaul/Rome).
 * Each tile also carries a text label for screen readers, and a corner mark (● / ◦) so colour is never alone.
 */
const WORDS = [
  { w: 'CHENE', show: 'chêne', root: '*cassanos', fr: 'l’arbre sacré des druides', en: 'oak — the druids’ sacred tree' },
  { w: 'RUCHE', show: 'ruche', root: '*rusca', fr: '« écorce » : les ruches étaient faites d’écorce', en: '“bark”: hives were made of bark' },
  { w: 'LANDE', show: 'lande', root: '*landa', fr: 'terre, étendue', en: 'land, open ground' },
  { w: 'BRAIE', show: 'braie', root: 'bracae', fr: 'le pantalon des Gaulois, moqué par les Romains', en: 'the Gauls’ trousers, mocked by the Romans' },
  { w: 'BALAI', show: 'balai', root: '*banatlo', fr: '« genêt » : on fabriquait les balais avec cette plante', en: '“broom plant”: brooms were made from it' },
  { w: 'TONNE', show: 'tonne', root: '*tunna', fr: 'le tonneau, une invention gauloise', en: 'the barrel, a Gallic invention' },
  { w: 'CREME', show: 'crème', root: '*crama', fr: 'la crème du lait', en: 'cream' },
  { w: 'GREVE', show: 'grève', root: '*grava', fr: 'gravier, rivage de sable', en: 'gravel, sandy shore' },
  { w: 'BORNE', show: 'borne', root: '*bodina', fr: 'limite, marque de frontière', en: 'boundary, landmark' },
  { w: 'JAMBE', show: 'jambe', root: '*cambo-', fr: '« courbe » → la jambe (via le latin tardif camba)', en: '“curved” → leg (via late Latin camba)' },
  { w: 'GALET', show: 'galet', root: '*gallos', fr: 'pierre, caillou', en: 'stone, pebble' },
];

const ROWS = [
  ['A', 'Z', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['Q', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M'],
  ['ENTER', 'W', 'X', 'C', 'V', 'B', 'N', 'BACK'],
];
const MAX = 6;
const LEN = 5;

function score(guess, answer) {
  const res = Array(LEN).fill('absent');
  const pool = {};
  for (let i = 0; i < LEN; i++) {
    if (guess[i] === answer[i]) res[i] = 'hit';
    else pool[answer[i]] = (pool[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < LEN; i++) {
    if (res[i] !== 'hit' && pool[guess[i]]) { res[i] = 'near'; pool[guess[i]]--; }
  }
  return res;
}

const RANK = { absent: 1, near: 2, hit: 3 };

export default function MotGaulois() {
  const t = useT();
  const [round, setRound] = useState(() => rand(WORDS.length));
  const target = WORDS[round % WORDS.length];
  const [guesses, setGuesses] = useState([]);
  const [current, setCurrent] = useState('');
  const [shake, setShake] = useState(false);
  const [started, setStarted] = useState(false);

  const won = guesses.some((g) => g === target.w);
  const over = won || guesses.length >= MAX;

  const keyState = useMemo(() => {
    const m = {};
    guesses.forEach((g) => score(g, target.w).forEach((s, i) => {
      if (!m[g[i]] || RANK[s] > RANK[m[g[i]]]) m[g[i]] = s;
    }));
    return m;
  }, [guesses, target.w]);

  const press = useCallback((k) => {
    if (over) return;
    if (k === 'BACK') { setCurrent((c) => c.slice(0, -1)); return; }
    if (k === 'ENTER') {
      if (current.length < LEN) {
        setShake(true); haptic('miss'); setTimeout(() => setShake(false), 400);
        return;
      }
      const next = [...guesses, current];
      setGuesses(next);
      setCurrent('');
      haptic(current === target.w ? 'success' : 'tick');
      return;
    }
    if (/^[A-Z]$/.test(k)) setCurrent((c) => (c.length < LEN ? c + k : c));
  }, [over, current, guesses, target.w]);

  // physical keyboard, only while this game has focus inside it
  const onKeyDown = (e) => {
    const k = e.key;
    if (k === 'Enter') { e.preventDefault(); e.stopPropagation(); press('ENTER'); }
    else if (k === 'Backspace') { e.preventDefault(); e.stopPropagation(); press('BACK'); }
    else if (/^[a-zA-Zàâäéèêëîïôöùûüç]$/.test(k)) {
      e.stopPropagation();
      press(k.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase());
    }
  };

  const restart = () => {
    setRound((r) => r + 1 + rand(WORDS.length - 1));
    setGuesses([]); setCurrent(''); setStarted(true);
  };

  useEffect(() => { setGuesses([]); setCurrent(''); }, [round]);

  const rows = Array.from({ length: MAX }, (_, r) => {
    if (r < guesses.length) return { letters: guesses[r].split(''), states: score(guesses[r], target.w) };
    if (r === guesses.length && !over) return { letters: current.padEnd(LEN).split(''), states: Array(LEN).fill('typing'), active: true };
    return { letters: Array(LEN).fill(' '), states: Array(LEN).fill('empty') };
  });

  const label = (s) => ({
    hit: t({ fr: 'bien placée', en: 'right place' }),
    near: t({ fr: 'mal placée', en: 'wrong place' }),
    absent: t({ fr: 'absente', en: 'not in word' }),
  }[s] || '');

  return (
    <GameFrame
      kicker={{ fr: 'Jeu de mots · inspiré de Wordle', en: 'Word game · after Wordle' }}
      title={{ fr: 'Le mot gaulois', en: 'The Gaulish word' }}
      status={<span className="gf-pill">{guesses.length}/{MAX}</span>}
      onRestart={restart}
    >
      {!started ? (
        <Card
          title={{ fr: 'Les Gaulois parlent encore', en: 'The Gauls still speak' }}
          action={{ fr: 'Jouer', en: 'Play' }}
          onAction={() => setStarted(true)}
        >
          <p>{t({ fr: 'Le français vient surtout du latin… mais une centaine de mots viennent du gaulois. Devinez le mot de 5 lettres en 6 essais.', en: 'French mostly comes from Latin… but about a hundred words come from Gaulish. Guess the 5-letter word in 6 tries.' })}</p>
          <p className="gf-simplified">
            <span className="mg-legend mg-hit">A</span> {t({ fr: 'bien placée', en: 'right place' })}{'  '}
            <span className="mg-legend mg-near">B</span> {t({ fr: 'dans le mot', en: 'in the word' })}{'  '}
            <span className="mg-legend mg-absent">C</span> {t({ fr: 'absente', en: 'absent' })}
          </p>
        </Card>
      ) : (
        <div className="mg" tabIndex={0} onKeyDown={onKeyDown} aria-label={t({ fr: 'Grille : tapez au clavier ou utilisez les touches', en: 'Grid: type on your keyboard or use the keys' })}>
          <div className="mg-grid" role="grid">
            {rows.map((row, r) => (
              <div key={r} role="row" className={`mg-row${row.active && shake ? ' is-shake' : ''}`}>
                {row.letters.map((l, i) => (
                  <span
                    key={i}
                    role="gridcell"
                    className={`mg-tile mg-${row.states[i]}`}
                    style={{ transitionDelay: r < guesses.length ? `${i * 90}ms` : '0ms' }}
                    aria-label={l.trim() ? `${l} ${label(row.states[i])}` : undefined}
                  >
                    {l}
                  </span>
                ))}
              </div>
            ))}
          </div>

          {over ? (
            <Card tone={won ? 'is-win' : ''} title={won ? { fr: 'Bien joué !', en: 'Well done!' } : { fr: 'Le mot était…', en: 'The word was…' }}
              action={{ fr: 'Nouveau mot', en: 'New word' }} onAction={restart}>
              <p className="mg-answer"><strong>{target.show}</strong> ← <em>{target.root}</em> {t({ fr: '(gaulois)', en: '(Gaulish)' })}</p>
              <p>{t({ fr: target.fr, en: target.en })}</p>
              <Debrief
                source={{ fr: 'Étymologies : dictionnaires du CNRTL / Wiktionnaire (formes gauloises reconstruites, marquées *).', en: 'Etymologies: CNRTL / Wiktionary (reconstructed Gaulish forms, marked *).' }}
                simplified={{ fr: 'les Gaulois n’écrivaient presque pas : beaucoup de ces racines sont reconstruites par les linguistes.', en: 'the Gauls wrote very little: many of these roots are reconstructed by linguists.' }}
              />
            </Card>
          ) : (
            <div className="mg-keys" aria-label={t({ fr: 'Clavier', en: 'Keyboard' })}>
              {ROWS.map((row, r) => (
                <div key={r} className="mg-keyrow">
                  {row.map((k) => (
                    <button
                      key={k}
                      type="button"
                      className={`mg-key${k.length > 1 ? ' is-wide' : ''} mg-k-${keyState[k] || 'none'}`}
                      onClick={() => { haptic('light'); press(k); }}
                      aria-label={k === 'ENTER' ? t({ fr: 'Valider', en: 'Enter' }) : k === 'BACK' ? t({ fr: 'Effacer', en: 'Delete' }) : k}
                    >
                      {k === 'ENTER' ? <CornerDownLeft size={18} aria-hidden="true" /> : k === 'BACK' ? <Delete size={18} aria-hidden="true" /> : k}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </GameFrame>
  );
}
