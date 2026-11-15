import { useMemo, useState } from 'react';
import { Target, Shield, ArrowUpFromLine } from 'lucide-react';
import { GameFrame, Card, Debrief, useT, haptic, rand } from '../kit';
import './Rempart.css';

/*
 * Into the Breach → "Tenir le rempart".
 * A 7-column stretch of Caesar's outer line. Gauls (circles) come from the plain and ALWAYS show
 * their next move (perfect information). Each of your 3 cohorts (squares) slides along the wall,
 * then acts once: Pilum (hit the nearest Gaul in its column), Bouclier (shield its wall section),
 * Pousser (shove the Gaul right in front back one row — onto the lilia if you planned it).
 * Survive 8 waves; lose if 3 wall sections fall.
 */
const COLS = 7;
const ROWS = 5;       // row 0 = far plain … row 4 = right under the wall
const TRAP_ROW = 3;   // the lilia, between plain and wall
const WAVES = 8;
const WALL_HP = 2;

const newGame = () => ({
  turn: 1,
  wall: Array(COLS).fill(WALL_HP),
  traps: [1, 3, 5].map((c) => ({ r: TRAP_ROW, c, used: false })),
  enemies: spawn([], 3),
  cohorts: [{ id: 0, c: 1 }, { id: 1, c: 3 }, { id: 2, c: 5 }],
  acted: {},
  shields: {},
  tired: {},
  log: [],
  over: null,
});

function spawn(enemies, n, turn = 1) {
  const out = [...enemies];
  for (let k = 0; k < n; k++) {
    const free = [...Array(COLS).keys()].filter((c) => !out.some((e) => e.r <= 1 && e.c === c));
    if (!free.length) break;
    const c = free[rand(free.length)];
    out.push({ id: Math.random().toString(36).slice(2), r: rand(2), c, hp: Math.random() < 0.15 + turn * 0.08 ? 2 : 1 });
  }
  return out;
}

/* what each Gaul will do at the end of the turn (telegraphed) */
const intent = (e) => (e.r >= ROWS - 1 ? { kind: 'attack', c: e.c } : { kind: 'move', r: e.r + 1, c: e.c });

export default function Rempart() {
  const t = useT();
  const [g, setG] = useState(newGame);
  const [sel, setSel] = useState(null);       // cohort id
  const [mode, setMode] = useState(null);     // 'pilum' | 'shield' | 'push'
  const [started, setStarted] = useState(false);
  const [flash, setFlash] = useState(null);

  const breached = g.wall.filter((h) => h <= 0).length;
  const cohortAt = (c) => g.cohorts.find((k) => k.c === c);
  const say = (fr, en) => setFlash({ fr, en });

  const moveCohort = (id, c) => {
    if (g.acted[id] || cohortAt(c)) return;
    const k = g.cohorts.find((x) => x.id === id);
    if (Math.abs(k.c - c) > 2) { say('Une cohorte se déplace de 2 sections au plus.', 'A cohort moves at most 2 sections.'); return; }
    setG({ ...g, cohorts: g.cohorts.map((x) => (x.id === id ? { ...x, c } : x)) });
    haptic('light');
  };

  const act = (kind) => {
    if (sel === null || g.acted[sel]) return;
    const k = g.cohorts.find((x) => x.id === sel);
    let enemies = g.enemies; let traps = g.traps; const shields = { ...g.shields };
    if (kind === 'shield') {
      if (g.tired[k.c]) { say('Les boucliers de cette section ont tenu hier : les hommes sont épuisés. Repoussez ou frappez !', 'This section shielded last turn: the men are exhausted. Push or strike!'); return; }
      shields[k.c] = true; say('Bouclier levé sur cette section.', 'Shields up on this section.');
    }
    if (kind === 'pilum') {
      const target = enemies.filter((e) => e.c === k.c && e.r >= 1).sort((a, b) => b.r - a.r)[0];
      if (!target) { say('Aucun Gaulois à portée dans cette colonne.', 'No Gaul in range in this column.'); return; }
      enemies = enemies.map((e) => (e.id === target.id ? { ...e, hp: e.hp - 1 } : e)).filter((e) => e.hp > 0);
      say('Pilum lancé !', 'Pilum thrown!');
    }
    if (kind === 'push') {
      const target = enemies.find((e) => e.c === k.c && e.r === ROWS - 1);
      if (!target) { say('Il faut un Gaulois juste devant le mur.', 'Needs a Gaul right in front of the wall.'); return; }
      const nr = target.r - 1;
      const trap = traps.find((tr) => tr.r === nr && tr.c === target.c && !tr.used);
      if (trap) {
        enemies = enemies.filter((e) => e.id !== target.id);
        traps = traps.map((tr) => (tr === trap ? { ...tr, used: true } : tr));
        say('Repoussé dans les lis !', 'Pushed into the lilies!');
      } else if (enemies.some((e) => e.r === nr && e.c === target.c)) {
        enemies = enemies.map((e) => (e.r === nr && e.c === target.c ? { ...e, hp: e.hp - 1 } : e.id === target.id ? { ...e, hp: e.hp - 1 } : e)).filter((e) => e.hp > 0);
        say('Collision ! Les deux Gaulois sont blessés.', 'Collision! Both Gauls are hurt.');
      } else {
        enemies = enemies.map((e) => (e.id === target.id ? { ...e, r: nr } : e));
        say('Repoussé.', 'Pushed back.');
      }
    }
    haptic('tick');
    setG({ ...g, enemies, traps, shields, acted: { ...g.acted, [sel]: kind } });
    setSel(null); setMode(null);
  };

  const endTurn = () => {
    let wall = [...g.wall]; let enemies = []; let traps = g.traps;
    // resolve every telegraphed move, nearest the wall first
    const order = [...g.enemies].sort((a, b) => b.r - a.r);
    for (const e of order) {
      const it = intent(e);
      if (it.kind === 'attack') {
        if (!g.shields[e.c] && wall[e.c] > 0) wall[e.c] -= 1;
        enemies.push(e);
      } else {
        const blocked = enemies.some((o) => o.r === it.r && o.c === it.c);
        const trap = traps.find((tr) => tr.r === it.r && tr.c === it.c && !tr.used);
        if (!blocked && trap) { traps = traps.map((tr) => (tr === trap ? { ...tr, used: true } : tr)); continue; }
        enemies.push(blocked ? e : { ...e, r: it.r });
      }
    }
    const fallen = wall.filter((h) => h <= 0).length;
    const turn = g.turn + 1;
    let over = null;
    if (fallen >= 3) over = 'lost';
    else if (turn > WAVES) over = 'won';
    if (!over) enemies = spawn(enemies, turn >= 5 ? 4 : turn >= 3 ? 3 : 2, turn);
    haptic(over === 'lost' ? 'miss' : over === 'won' ? 'success' : 'tick');
    setG({ ...g, turn: over ? g.turn : turn, wall, enemies, traps, acted: {}, shields: {}, tired: g.shields, over });
    setFlash(null); setSel(null); setMode(null);
  };

  const restart = () => { setG(newGame()); setSel(null); setMode(null); setFlash(null); setStarted(true); };
  const cells = useMemo(() => [...Array(ROWS).keys()].flatMap((r) => [...Array(COLS).keys()].map((c) => ({ r, c }))), []);
  const selC = sel !== null ? g.cohorts.find((k) => k.id === sel) : null;

  return (
    <GameFrame
      kicker={{ fr: 'Tactique · inspiré d’Into the Breach', en: 'Tactics · after Into the Breach' }}
      title={{ fr: 'Tenir le rempart', en: 'Hold the rampart' }}
      status={started && (
        <>
          <span className="gf-pill">{t({ fr: 'Vague', en: 'Wave' })} {Math.min(g.turn, WAVES)}/{WAVES}</span>
          <span className="gf-pill">{t({ fr: 'Brèches', en: 'Breaches' })} {breached}/3</span>
        </>
      )}
      onRestart={started ? restart : undefined}
    >
      {!started ? (
        <Card title={{ fr: 'Septembre 52 av. J.-C., la ligne extérieure', en: 'September 52 BC, the outer line' }}
          action={{ fr: 'Prendre position', en: 'Take position' }} onAction={() => setStarted(true)}>
          <p>{t({ fr: 'L’armée de secours gauloise attaque le mur. Chaque guerrier ● montre à l’avance ce qu’il va faire (flèche ou ✕ rouge sur le mur). À vous de lire le champ de bataille.', en: 'The Gallic relief army attacks the wall. Every warrior ● shows in advance what it will do (arrow, or a red ✕ on the wall). Read the battlefield.' })}</p>
          <ul className="rp-rules">
            <li>{t({ fr: '■ Touchez une cohorte, puis une section du mur pour la déplacer (2 au plus).', en: '■ Tap a cohort, then a wall section to move it (2 at most).' })}</li>
            <li>{t({ fr: 'Puis une action : Pilum (touche le Gaulois le plus proche dans la colonne), Bouclier (protège la section ce tour-ci, pas deux tours de suite), Pousser (recule le Gaulois collé au mur — dans les lis ⌇ ?).', en: 'Then one action: Pilum (hits the nearest Gaul in the column), Shield (protects the section this turn, not two turns running), Push (shoves the Gaul at the wall back — into the lilies ⌇?).' })}</li>
            <li>{t({ fr: 'Tenez 8 vagues. 3 sections tombées = défaite.', en: 'Hold 8 waves. 3 sections down = defeat.' })}</li>
          </ul>
        </Card>
      ) : (
        <div className="rp">
          <div className="rp-grid" style={{ '--cols': COLS }} role="grid" aria-label={t({ fr: 'Champ de bataille', en: 'Battlefield' })}>
            {cells.map(({ r, c }) => {
              const e = g.enemies.find((x) => x.r === r && x.c === c);
              const trap = g.traps.find((x) => x.r === r && x.c === c && !x.used);
              const it = e && intent(e);
              const incoming = g.enemies.some((x) => { const i = intent(x); return i.kind === 'move' && i.r === r && i.c === c; });
              return (
                <div key={`${r}-${c}`} role="gridcell" className={`rp-cell${r === TRAP_ROW ? ' is-ditch' : ''}${incoming ? ' is-incoming' : ''}`}
                  aria-label={e ? t({ fr: `Gaulois (${e.hp} PV)${it.kind === 'attack' ? ', va frapper le mur' : ', va avancer'}`, en: `Gaul (${e.hp} HP)${it.kind === 'attack' ? ', will strike the wall' : ', will advance'}` }) : trap ? t({ fr: 'Lis cachés', en: 'Hidden lilies' }) : undefined}>
                  {trap && <span className="rp-trap" aria-hidden="true">⌇</span>}
                  {e && (
                    <span className={`rp-gaul${e.hp > 1 ? ' is-strong' : ''}`}>
                      <span className="rp-arrow" aria-hidden="true">{it.kind === 'attack' ? '✕' : '↓'}</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="rp-wall" style={{ '--cols': COLS }}>
            {g.wall.map((hp, c) => {
              const k = cohortAt(c);
              const threatened = g.enemies.some((e) => intent(e).kind === 'attack' && e.c === c);
              return (
                <button key={c} type="button"
                  className={`rp-sec hp-${Math.max(0, hp)}${threatened ? ' is-threat' : ''}${g.shields[c] ? ' is-shielded' : ''}${g.tired[c] ? ' is-tired' : ''}${selC && selC.c === c ? ' is-sel' : ''}`}
                  onClick={() => {
                    if (g.over) return;
                    if (k && !g.acted[k.id]) { setSel(k.id); haptic('light'); }
                    else if (sel !== null && !k) moveCohort(sel, c);
                  }}
                  aria-label={t({ fr: `Section ${c + 1}, ${hp} PV${k ? ', cohorte' : ''}${threatened ? ', menacée' : ''}`, en: `Section ${c + 1}, ${hp} HP${k ? ', cohort' : ''}${threatened ? ', threatened' : ''}` })}>
                  {threatened && !g.shields[c] && <span className="rp-x" aria-hidden="true">✕</span>}
                  {k && <span className={`rp-cohort${g.acted[k.id] ? ' is-done' : ''}`} aria-hidden="true" />}
                  <span className="rp-hp" aria-hidden="true">{'▮'.repeat(Math.max(0, hp))}{'▯'.repeat(WALL_HP - Math.max(0, hp))}</span>
                </button>
              );
            })}
          </div>

          {g.over ? (
            <Card tone={g.over === 'won' ? 'is-win' : ''} title={g.over === 'won' ? { fr: 'Le mur a tenu', en: 'The wall held' } : { fr: 'Le mur est percé', en: 'The wall is breached' }}
              action={{ fr: 'Rejouer', en: 'Play again' }} onAction={restart}>
              <p>{g.over === 'won'
                ? t({ fr: 'Comme en septembre 52 : César déplace ses réserves le long de ses lignes plus vite que les Gaulois ne coordonnent leurs attaques.', en: 'As in September 52: Caesar shifts his reserves along his lines faster than the Gauls can coordinate their attacks.' })
                : t({ fr: 'Au Mont Réa, les Gaulois ont failli réussir : c’est là que César a dû mener lui-même les réserves.', en: 'At Mont Réa the Gauls nearly did it: that is where Caesar had to lead the reserves himself.' })}</p>
              <Debrief
                source={{ fr: 'César, *Guerre des Gaules* VII.84–88 : attaques sur plusieurs points à la fois, réserves envoyées là où le mur cède.', en: 'Caesar, *Gallic War* VII.84–88: attacks on several points at once, reserves sent wherever the wall gave way.' }}
                simplified={{ fr: 'personne ne voyait les intentions de l’ennemi à l’avance, et les vraies lignes faisaient 21 km, pas 7 cases.', en: 'nobody saw the enemy’s intentions in advance, and the real line was 21 km long, not 7 squares.' }}
              />
            </Card>
          ) : (
            <div className="rp-controls">
              <div className="gf-row" role="group" aria-label={t({ fr: 'Action de la cohorte', en: 'Cohort action' })}>
                <button type="button" className="gf-btn" disabled={sel === null} onClick={() => act('pilum')}><Target size={16} aria-hidden="true" /> Pilum</button>
                <button type="button" className="gf-btn" disabled={sel === null} onClick={() => act('shield')}><Shield size={16} aria-hidden="true" /> {t({ fr: 'Bouclier', en: 'Shield' })}</button>
                <button type="button" className="gf-btn" disabled={sel === null} onClick={() => act('push')}><ArrowUpFromLine size={16} aria-hidden="true" /> {t({ fr: 'Pousser', en: 'Push' })}</button>
              </div>
              <button type="button" className="btn-primary" onClick={endTurn}>{t({ fr: 'Fin du tour', en: 'End turn' })}</button>
            </div>
          )}
          <p className="gf-toast" aria-live="polite">
            {flash ? t(flash) : sel !== null ? t({ fr: 'Cohorte choisie : touchez une section libre pour la déplacer, ou choisissez une action.', en: 'Cohort selected: tap a free section to move it, or pick an action.' }) : t({ fr: 'Touchez une cohorte ■ sur le mur.', en: 'Tap a cohort ■ on the wall.' })}
          </p>
        </div>
      )}
    </GameFrame>
  );
}
