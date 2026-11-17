import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Volume2, VolumeX, Share2, Zap, Pause, Play, Eye, EyeOff, Maximize, RotateCcw, LogOut, Circle, GripHorizontal, MoveHorizontal, Send, Check, WifiOff } from 'lucide-react';
import { GameFrame, Card, Debrief, useT, haptic, usePersist } from '../kit';
import { generate, step, render, createMinimap, throwStone, medalFor, nextGap, angDiff, NIGHTS, TUNE, WORLD } from './percee/engine';
import { createFP } from './percee/fp3d';
import { createInput } from './percee/input';
import { makeAudio } from './percee/audio';
import { loadBoard, saveBoard, addEntry, standings, todaySeed, randomSeed, fmtTime, scoreNight, scoreRun, POINTS } from './percee/board';
import { submitClassScore, nameProblem, tidyName, loadPending, savePending } from './percee/classApi';
import { ClassBoard } from './percee/ClassBoard';
import { useLang } from '../../lib/lang';
import { NIGHT_LINES, FACTS, HINTS, MEDALS, BIG_CONTROLS, BIG_LABELS, POINT_LABELS as PL, POINT_RULE } from './percee/text';
import './Percee.css';

/*
 * La Percée — a night ride out of besieged Alésia, in first person.
 *
 * This file is the React shell: menu, HUD, pause menu, summaries, leaderboard, and the frame loop
 * that ties together the engine (percee/engine.js), the 3D view (percee/fp3d.js), the controls
 * (percee/input.js) and the sound (percee/audio.js). While you play, the stage is a fixed
 * full-viewport layer (a portal on <body>), so the view is as large as the screen allows.
 */

const readUrlSeed = () => new URLSearchParams(window.location.search).get('seed');
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── big-screen touch mode ──
   A wall-sized touch panel (the classroom's 4K Samsung) is played standing up, by one student who
   cannot reach both sides of the screen. There the phone layout (stick under the left thumb, look on
   the right, buttons in the corners) is replaced by one console low in the middle of the screen.
   On: touch-capable and a large viewport in device-independent pixels (a phone or tablet never is),
   or forced with ?bigscreen (?bigscreen=0 forces it off), or the setting (auto / on / off). */
const touchCapable = () => (navigator.maxTouchPoints || 0) > 0 || window.matchMedia('(any-pointer: coarse)').matches;
const bigAuto = () => touchCapable() && (Math.max(window.innerWidth, window.innerHeight) >= 1600 || (window.screen?.width || 0) >= 2560);
const urlBig = () => {
  const q = new URLSearchParams(window.location.search);
  if (!q.has('bigscreen')) return null;
  return !/^(0|off|false|no)$/i.test(q.get('bigscreen') || '');
};
/** CSS px (inside the zoomed page) per physical millimetre, for console sizes. Browsers do not know the
    panel's size: a 4K-class panel is taken as a 75-inch board (about 1660 mm wide), a smaller one as
    65 inches, and the result is kept within sane bounds. The console size setting corrects the rest. */
const mmUnit = (size = 1) => {
  const dpr = window.devicePixelRatio || 1; const sw = window.screen?.width || window.innerWidth;
  const dipPerMm = Math.min(3.4, Math.max(1.67, sw / (sw * dpr >= 3000 ? 1660 : 1440)));
  const z = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
  return (dipPerMm / z) * size;
};

function cssColors(el) {
  const cs = getComputedStyle(el);
  const v = (n) => cs.getPropertyValue(n).trim();
  return {
    ground: v('--ink-800'), speck: 'rgba(205,183,154,0.10)', river: 'rgba(120,140,150,0.35)',
    forest: v('--ink-950'), forestDot: 'rgba(90,60,36,0.9)', plateau: 'rgba(47,107,58,0.30)',
    gaul: v('--gaul-400'), rome: v('--rome-600'), romeLight: v('--rome-400'), wall: v('--rome-400'),
    trap: v('--gold-400'), text: v('--parchment-50'),
    coneIn: 'rgba(245,178,107,0.42)', coneSee: 'rgba(240,106,90,0.55)', coneOut: 'rgba(245,178,107,0.0)', night: 'rgba(8,5,3,0.86)',
  };
}

/* ── small pieces ─────────────────────────────────────────────── */
function Medal({ level, t }) {
  if (!level) return <span className="pc-medal is-0" aria-label={t({ fr: 'pas de médaille', en: 'no medal' })}>–</span>;
  return <span className={`pc-medal is-${level}`}>{t(MEDALS[level])}</span>;
}

/** 12 345 → "12 345" (narrow no-break space, readable in French and English) */
const fmtPts = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');

/** a number that counts up once when it appears (instant under reduced motion) */
function CountUp({ value, ms = 900 }) {
  const [v, setV] = useState(() => (reducedMotion() ? value : 0));
  useEffect(() => {
    if (reducedMotion()) { setV(value); return undefined; }
    let raf = 0; const t0 = performance.now(); const from = 0;
    const f = (now) => { const k = Math.min(1, (now - t0) / ms); const e = 1 - (1 - k) ** 3; setV(from + (value - from) * e); if (k < 1) raf = requestAnimationFrame(f); };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return <>{fmtPts(v)}</>;
}

/** the lines of a points breakdown: [{ label, n, pts }] → a definition list; zero lines are left out */
function Breakdown({ lines, total, totalLabel, t }) {
  return (
    <dl className="pc-pts">
      {lines.filter((l) => l.pts !== 0).map((l, i) => (
        <div key={i} className={l.pts < 0 ? 'is-minus' : undefined}>
          <dt>{t(l.label)}{l.n > 1 ? <span className="pc-pts-n"> ×{l.n}</span> : null}</dt>
          <dd>{l.pts > 0 ? '+' : '−'}{fmtPts(Math.abs(l.pts))}</dd>
        </div>
      ))}
      <div className="pc-pts-total"><dt>{t(totalLabel)}</dt><dd><CountUp value={total} /> <small>{t(PL.pts)}</small></dd></div>
    </dl>
  );
}

const golds = (r) => (r.medals || []).filter((m) => m === 3).length;

/** the board stored on this device (shown when the class board cannot be reached) */
function LocalBoard({ board, seed, name, highlight, t }) {
  const daily = todaySeed();
  const [tab, setTab] = useState(seed === daily ? 'daily' : 'map');
  const shown = tab === 'daily' ? daily : seed;
  const st = standings(board, shown, { top: 10, id: highlight, name });
  const row = (r, i) => (
    <li key={r.id} className={r.id === highlight ? 'is-me' : undefined}>
      <span className="pc-rank">{i + 1}</span>
      <span className="pc-who">{r.name}{r.src === 'code' && <small> · {t({ fr: 'code', en: 'code' })}</small>}{r.src === 'old' && <small title={t(PL.oldTitle)}> · ≈ {t(PL.old)}</small>}{r.id === highlight && <small className="pc-new"> {t({ fr: 'nouveau', en: 'new' })}</small>}</span>
      <span className="pc-score">{fmtPts(r.points || 0)}</span>
      <span>{r.nights}/{NIGHTS}</span>
      <span className="pc-goldcol">{golds(r) > 0 ? `★${golds(r)}` : '–'}<span className="pc-sr"> {t({ fr: 'nuits en or', en: 'gold nights' })}</span></span>
      <span>{r.time == null ? '–' : fmtTime(r.time)}</span>
    </li>
  );
  return (
    <div className="pc-localboard">
      <div className="pc-tabs" role="tablist" aria-label={t({ fr: 'Classement sur cet appareil', en: 'Board on this device' })}>
        <button type="button" role="tab" aria-selected={tab === 'daily'} className={`pc-tab${tab === 'daily' ? ' is-on' : ''}`} onClick={() => setTab('daily')}>{t({ fr: 'Carte du jour', en: 'Daily map' })}</button>
        {seed !== daily && (
          <button type="button" role="tab" aria-selected={tab === 'map'} className={`pc-tab${tab === 'map' ? ' is-on' : ''}`} onClick={() => setTab('map')}>{t({ fr: 'Entraînement', en: 'Practice' })} · <code>{seed}</code></button>
        )}
      </div>
      {st.rows.length ? (
        <ol className="pc-rows pc-class">
          <li className="pc-rows-head" aria-hidden="true"><span>#</span><span>{t({ fr: 'Nom', en: 'Name' })}</span><span>{t({ fr: 'Points', en: 'Points' })}</span><span>{t({ fr: 'Nuits', en: 'Nights' })}</span><span>{t({ fr: 'Or', en: 'Gold' })}</span><span>{t({ fr: 'Temps', en: 'Time' })}</span></li>
          {st.rows.map(row)}
          {st.rank >= 10 && <li className="pc-rows-gap" aria-hidden="true">…</li>}
          {st.rank >= 10 && row(st.mine, st.rank)}
        </ol>
      ) : <p className="gf-simplified">{t({ fr: 'Aucun score sur cet appareil pour cette carte.', en: 'No scores on this device for this map.' })}</p>}
      {st.best && (
        <p className="pc-best">{t({ fr: 'Votre record', en: 'Your best' })} ({st.best.name}){t({ fr: ' : ', en: ': ' })}{fmtPts(st.best.points || 0)} {t(PL.points)}, {st.best.nights}/{NIGHTS} {t({ fr: 'nuits', en: 'nights' })} · {t({ fr: 'rang', en: 'rank' })} {st.bestRank + 1}/{st.total}</p>
      )}
    </div>
  );
}

/* ── the game ─────────────────────────────────────────────────── */
export default function Percee() {
  const t = useT();
  const { lang } = useLang();
  const stageRef = useRef(null);
  const surfaceRef = useRef(null);
  const canvasRef = useRef(null);
  const mmRef = useRef(null);
  const worldRef = useRef(null);
  const inputRef = useRef(null);
  const fpRef = useRef(null);
  const audioRef = useRef(null);
  const dom = useRef({});               // HUD nodes written every frame without React
  const run = useRef({ time: 0, riders: 0, medals: [], tries: 0, pts: [] });   // pts: points of each escaped night
  const tut = useRef({ step: 9, t: 0, moved: 0 });
  const hook = useRef({ until: -1, x: 0, y: 0, gallop: false });
  const dirty = useRef(true);
  const toastTimer = useRef(0);
  const coolTimer = useRef(0);
  const noteTimer = useRef(0);
  const lastKind = useRef(null);         // the pointer of the event being handled right now (state lags one render)
  const fullAt = useRef(-1e9);          // last full-screen request or change (a blur right after it is ignored)
  const coolUntil = useRef(0);          // Resume is refused until then (set synchronously: a stray Esc keydown can follow the unlock in the same tick)

  const [phase, setPhaseS] = useState('menu');   // menu | play | between | caught | over
  const [mode, setModeS] = useState('ready');    // ready | run | paused   (only meaningful in 'play')
  const phaseRef = useRef('menu'); const modeRef = useRef('ready');
  const setPhase = (p) => { phaseRef.current = p; setPhaseS(p); markDirty(); };
  const setMode = (m) => { modeRef.current = m; setModeS(m); markDirty(); };

  const [seed, setSeed] = useState(() => readUrlSeed() || todaySeed());
  const [night, setNight] = useState(1);
  const [hud, setHud] = useState({ riders: 0, stones: TUNE.stones, status: 'calm', hidden: false, town: true, noisy: false, winded: false, secs: 180, weather: 'clear', hint: null });
  const [toast, setToast] = useState(null);
  const [nightStats, setNightStats] = useState(null);
  const [caught, setCaught] = useState('seen');
  const [result, setResult] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [kind, setKind] = useState(() => (window.matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse'));
  const [cooldown, setCooldown] = useState(false);
  const [lockNote, setLockNote] = useState(false);
  const [confirm, setConfirm] = useState('');     // pause menu: 'new' | 'quit' once the button has been pressed a first time
  const [copied, setCopied] = useState('');
  const [no3d, setNo3d] = useState(false);
  const [muted, setMuted] = usePersist('percee-muted', false);
  const [horror, setHorror] = usePersist('percee-horror', true);
  const [view, setView] = usePersist('percee-view2', '3d');
  const [settings, setSettings] = usePersist('percee-settings', { sens: 1, invertY: false });
  const [name, setName] = usePersist('percee-name', '');
  const [send, setSend] = useState({ state: 'idle' });   // idle | sending | saved {rank,total,improved,best} | error {why}
  const [boardKey, setBoardKey] = useState(0);           // bumped after a save: the class board reloads at once
  const [board, setBoard] = useState(loadBoard);
  const [bigPref, setBigPref] = usePersist('percee-big', 'auto');        // auto | on | off
  const [bigSize, setBigSize] = usePersist('percee-bigsize', 1);         // console size, 0.8× to 1.6×
  const [bigPos, setBigPos] = usePersist('percee-bigpos', { x: 0.5, y: 1 }); // console bottom-centre, fractions of the screen
  const [bigUrl, setBigUrl] = useState(urlBig);                          // ?bigscreen wins until the setting is changed
  const [bigAutoOn, setBigAutoOn] = useState(bigAuto);
  const big = bigUrl !== null ? bigUrl : bigPref === 'on' ? true : bigPref === 'off' ? false : bigAutoOn;
  const [mm, setMm] = useState(() => mmUnit(bigSize));
  const [gfxLost, setGfxLost] = useState(null);                          // null | 'lost' | 'stuck' (the GPU dropped the 3D view)
  const live = useRef({});
  live.current = { settings, muted, horror, view, kind, cooldown, seed, big, mm };
  useEffect(() => {
    const on = () => { setBigAutoOn(bigAuto()); setMm(mmUnit(bigSize)); };
    on(); window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [bigSize]);
  const wakeRef = useRef(null);
  const markDirty = () => { dirty.current = true; wakeRef.current?.(); };

  const active = phase !== 'menu';
  // finger or mouse? Decided by the last pointer used, from the very first tap on the menu
  // (a touch monitor with a mouse plugged in switches back and forth freely).
  useEffect(() => {
    const onDown = (e) => { const k = e.pointerType === 'mouse' ? 'mouse' : 'touch'; lastKind.current = k; setKind(k); };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, []);
  const audio = () => { if (!audioRef.current) { audioRef.current = makeAudio(); audioRef.current.setMuted(live.current.muted); } return audioRef.current; };
  useEffect(() => { audioRef.current?.setMuted(muted); }, [muted]);
  useEffect(() => () => { audioRef.current?.close(); clearTimeout(toastTimer.current); clearTimeout(coolTimer.current); clearTimeout(noteTimer.current); }, []);

  const say = useCallback((msg, ms = 6500) => {
    setToast(msg); clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }, []);

  /* On a phone or tablet the game takes the whole screen as soon as it starts. Browsers only allow
     this from a tap, so it is asked on "Ride into the night" and again on "Tap to ride" (in case
     the player left full screen in between). iPhone Safari has no such API: there the stage simply
     fills the viewport, and the installed web app is already full screen. */
  const goFull = () => {
    if ((lastKind.current || live.current.kind) !== 'touch' || document.fullscreenElement || document.webkitFullscreenElement) return;
    const el = document.documentElement;
    fullAt.current = performance.now();
    try {
      const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen?.();
      p?.catch?.(() => {});
    } catch { /* refused or unsupported: the game still works */ }
  };

  /* ── run / night flow ── */
  const startNight = (n, s = seed) => {
    const w = generate(s, n);
    worldRef.current = w;
    tut.current = { step: n === 1 ? 0 : 9, t: 0, moved: 0 };
    hook.current.until = -1;
    setNight(n); setToast(null); setLockNote(false);
    setHud((h) => ({ ...h, riders: 0, stones: w.stones, status: 'calm', hidden: false, town: true, noisy: false, winded: false, secs: w.limit, weather: w.weather, hint: null }));
    setPhase('play'); setMode('ready');
    haptic('tick');
  };
  const newRun = (s = seed) => {
    run.current = { time: 0, riders: 0, medals: [], tries: 0, pts: [] };
    setResult(null); setSavedId(null); setCopied(''); setSend({ state: 'idle' });
    goFull();
    startNight(1, s);
  };
  const finishRun = (won) => {
    const r = run.current;
    audioRef.current?.stopLoops();
    setResult({ nights: r.medals.length, riders: r.riders, time: r.time, medals: r.medals.slice(), tries: r.tries, pts: r.pts.slice(), points: scoreRun(r.pts, r.tries), won, seed });
    setPhase('over');
  };
  const quit = () => {
    inputRef.current?.exitLock();
    audioRef.current?.stopLoops();
    try { if (document.fullscreenElement) document.exitFullscreen?.()?.catch?.(() => {}); else if (document.webkitFullscreenElement) document.webkitExitFullscreen?.(); } catch { /* ignore */ }
    setPhase('menu'); setMode('ready');
  };

  /* ── pause / resume ── */
  const begin = (e) => {
    if (gfxLost) return;
    goFull();
    const a = audio(); a.unlock(); a.stopLoops(); a.ambience(worldRef.current.weather, horror);
    const mouse = e ? (e.nativeEvent?.pointerType ? e.nativeEvent.pointerType === 'mouse' : live.current.kind === 'mouse') : false;
    setMode('run');
    if (mouse && view === '3d') inputRef.current?.requestLock();
    canvasRef.current?.focus({ preventScroll: true });
  };
  const pause = (why) => {
    if (phaseRef.current !== 'play' || modeRef.current !== 'run') return;
    const inp = inputRef.current;
    setMode('paused'); setConfirm('');
    inp?.release(); audioRef.current?.suspend();
    if (why === 'lock') {
      // Chrome refuses a new lock for 1.25 s after Esc: keep "Resume" disabled a little longer than that
      setCooldown(true); clearTimeout(coolTimer.current); coolUntil.current = performance.now() + 1300;
      coolTimer.current = setTimeout(() => setCooldown(false), 1300);
    } else inp?.exitLock();
  };
  const resume = (e) => {
    if (phaseRef.current !== 'play' || modeRef.current !== 'paused' || performance.now() < coolUntil.current || gfxLost) return;
    audioRef.current?.resume();
    setMode('run');
    const mouse = e?.nativeEvent?.pointerType ? e.nativeEvent.pointerType === 'mouse' : live.current.kind === 'mouse';
    if (mouse && live.current.view === '3d') inputRef.current?.requestLock();
    canvasRef.current?.focus({ preventScroll: true });
  };
  const doThrow = () => {
    const w = worldRef.current; const inp = inputRef.current;
    if (!w || !inp || modeRef.current !== 'run' || phaseRef.current !== 'play') return;
    const is3d = live.current.view === '3d';
    const a = is3d ? inp.state.yaw : w.player.face;
    const d = is3d ? 165 + inp.state.pitch * 230 : 170;
    if (throwStone(w, a, d)) { audioRef.current?.throwS(); haptic('light'); if (tut.current.step === 4) tut.current.t = 99; }
    else if (w.stones <= 0) say(t({ fr: 'Plus de pierres pour cette nuit.', en: 'No stones left tonight.' }), 2200);
  };

  /* ── what happened this frame ── */
  const onEvents = (ev, w) => {
    const a = audioRef.current; const fp = fpRef.current;
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      if (e.type === 'trap') { haptic('miss'); a?.trap(); fp?.kick(0.5); say(t({ fr: 'Un « lis » ! Le cheval trébuche, et le bruit porte.', en: 'A “lily” pit! The horse stumbles, and the noise carries.' }), 3200); }
      else if (e.type === 'rally') {
        haptic('success'); a?.chime();
        const fact = FACTS[((w.night - 1) * 3 + e.index) % FACTS.length];
        say(`${t({ fr: 'Cavalier rallié', en: 'Rider rallied' })} (${e.count}/3). ${t(fact)}`, 9000);
      } else if (e.type === 'thunder') a?.thunder();
      else if (e.type === 'suspect') { a?.cue(); haptic('miss'); fp?.kick(0.35); }
      else if (e.type === 'lost') a?.relief();
      else if (e.type === 'stone') a?.thud();
      else if (e.type === 'caught') {
        a?.sting(); haptic('miss'); a?.stopLoops();
        run.current.time += w.time; run.current.tries += 1;
        inputRef.current?.exitLock(); inputRef.current?.release();
        setCaught(e.reason); setPhase('caught');
      } else if (e.type === 'escaped') {
        haptic('success'); a?.fanfare(); a?.stopLoops();
        const medal = medalFor(w);
        const clean = w.stats.suspected === 0;
        const sc = scoreNight({ medal, riders: w.rallied, clean, stonesLeft: w.stones, secsLeft: w.limit - w.time });
        run.current.time += w.time; run.current.riders += w.rallied; run.current.medals.push(medal); run.current.pts.push(sc.total);
        inputRef.current?.exitLock(); inputRef.current?.release();
        setNightStats({ time: w.time, riders: w.rallied, medal, clean, traps: w.stats.traps, score: sc, run: scoreRun(run.current.pts, run.current.tries), tries: run.current.tries });
        if (w.night >= NIGHTS) finishRun(true); else setPhase('between');
      }
    }
  };
  const fns = useRef({});
  fns.current = { pause, resume, doThrow, onEvents, say };

  /* ── the frame loop: lives as long as the stage is on screen (and is rebuilt when the view changes) ── */
  useEffect(() => {
    if (!active) return undefined;
    const canvas = canvasRef.current; const surface = surfaceRef.current;
    const colors = cssColors(surface);
    const is3d = view === '3d';
    let fp = null; let ctx = null;
    if (is3d) {
      try { fp = createFP(canvas); } catch (err) { console.warn('[percee] 3D view unavailable, using the 2D map', err); setNo3d(true); setView('2d'); return undefined; }
    } else ctx = canvas.getContext('2d');
    fpRef.current = fp;
    const still = reducedMotion();
    const d = dom.current;
    const stepIn = { x: 0, y: 0, sprint: false, face: undefined };
    const viewOut = { yaw: 0, pitch: 0, still };
    let loaded = null; let mini = null; let raf = 0; let last = performance.now(); let frameN = 0; let hudT = 0;
    let lastBeat = 0; let lastHoof = 0; let nextHorn = 10; let lastWhisper = 0; let compW = 0; let lastFear = -1;

    const inp = createInput({
      surface, canvas, kind: live.current.kind,
      mode: () => (is3d ? '3d' : '2d'),
      settings: () => live.current.settings,
      active: () => modeRef.current === 'run' && phaseRef.current === 'play',
      onKind: (k) => setKind(k === 'pad' ? 'mouse' : k),
      onLock: (locked, expected) => { if (locked) setLockNote(false); else if (!expected) fns.current.pause('lock'); },
      // the note sits over the view: show it for a few seconds only (drag-to-look keeps working meanwhile)
      onLockError: () => { setLockNote(true); clearTimeout(noteTimer.current); noteTimer.current = setTimeout(() => setLockNote(false), 6000); },
      onThrow: () => fns.current.doThrow(),
      onEscape: () => {
        if (phaseRef.current !== 'play') return false;
        if (modeRef.current === 'run') fns.current.pause('key');
        else if (modeRef.current === 'paused') fns.current.resume();
        return true;
      },
      big: () => live.current.big,
      mm: () => live.current.mm,
      onBigJoy: (on, dx, dy, gallop) => {
        if (!d.bsKnob) return;
        d.bsKnob.style.transform = on ? `translate(${dx}px, ${dy}px)` : '';
        d.bsStick?.classList.toggle('is-gallop', on && gallop);
        d.bsStick?.classList.toggle('is-held', on);
      },
      onJoy: (on, x, y, dx, dy) => {
        const j = d.joy; if (!j) return;
        j.style.display = on ? 'block' : 'none';
        if (on) { j.style.left = `${x}px`; j.style.top = `${y}px`; d.knob.style.transform = `translate(${dx}px, ${dy}px)`; }
      },
    });
    inputRef.current = inp;

    // a new size clears the canvas: the frame is drawn again right away (inside the ResizeObserver
    // callback, before the browser paints), so a resize never shows a black frame
    let drawNow = null;
    const resize = () => {
      compW = d.comp ? d.comp.clientWidth : 0;
      if (fp) fp.resize();
      else {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const bw = Math.round(canvas.clientWidth * dpr); const bh = Math.round(canvas.clientHeight * dpr);
        if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      if (drawNow) drawNow(); else markDirty();
    };
    const ro = new ResizeObserver(resize); ro.observe(canvas);
    resize();

    const place = (el, ang, yaw) => {
      // compass: ±100° of bearing across the strip, clamped at the ends
      if (!el) return;
      const rel = angDiff(ang, yaw); const k = Math.max(-1, Math.min(1, rel / 1.75));
      el.style.transform = `translateX(${(k * compW) / 2}px)`;
      el.classList.toggle('is-edge', Math.abs(rel) > 1.75);
    };

    const tick = (dt, running, now) => {
      const w = worldRef.current; if (!w) return;
      if (w !== loaded) {
        loaded = w;
        if (fp) fp.load(w, { horror: live.current.horror });
        mini = mmRef.current ? createMinimap(mmRef.current, w, colors) : null;
        const g = nextGap(w);
        // a fresh night faces the next gap; switching 3D / 2D mid-night keeps the rider's heading
        inp.reset(w.time > 0 ? w.player.face : Math.atan2(g.y - w.player.y, g.x - w.player.x));
        w.player.face = inp.state.yaw;
        nextHorn = 10; hudT = 0;
      }
      const s = inp.state; const p = w.player;
      if (running) {
        inp.frame(dt);
        let mx = s.moveX; let my = s.moveY; let gal = s.gallop;
        const hk = hook.current;
        if (hk.until > w.time) { mx = hk.x; my = hk.y; gal = hk.gallop; }
        if (is3d) {
          const c = Math.cos(s.yaw); const sn = Math.sin(s.yaw);
          stepIn.x = c * my - sn * mx; stepIn.y = sn * my + c * mx; stepIn.face = s.yaw;
        } else { stepIn.x = mx; stepIn.y = -my; stepIn.face = undefined; }
        stepIn.sprint = gal;
        const px = p.x; const py = p.y;
        const ev = step(w, stepIn, dt);
        const tu = tut.current;
        if (tu.step < 6) {
          tu.t += dt; tu.moved += Math.hypot(p.x - px, p.y - py);
          if ((tu.step === 0 && tu.moved > 70) || (tu.step === 1 && !w.inTown && tu.t > 6) || (tu.step === 2 && (w.rallied > 0 || tu.t > 40))
            || (tu.step === 3 && (tu.t > 8 || p.galloping && tu.t > 2.5)) || (tu.step === 4 && tu.t > 9) || (tu.step === 5 && tu.t > 10)) { tu.step++; tu.t = 0; }
        }
        if (ev.length) fns.current.onEvents(ev, w);

        // sound that follows the simulation
        const a = audioRef.current; const sec = now / 1000;
        if (a && !live.current.muted) {
          if (w.alarm > 25 && sec - lastBeat > 1.1 - (w.alarm / 100) * 0.75) { lastBeat = sec; a.beat(w.alarm / 100); }
          if (p.speed > 40 && sec - lastHoof > (p.galloping ? 0.17 : 0.36)) { lastHoof = sec; a.hoof(p.galloping, w.weather === 'rain'); }
          if (live.current.horror) {
            if (w.time > nextHorn) { a.carnyx(); nextHorn = w.time + 22 + Math.random() * 20; }
            if (w.nearest < 150 && sec - lastWhisper > 1.1 + Math.random()) { lastWhisper = sec; a.whisper(1 - w.nearest / 150); }
          }
        }
      }

      // draw
      if (fp) { viewOut.yaw = s.yaw; viewOut.pitch = s.pitch; fp.render(dt, viewOut); }
      else {
        const cw = canvas.clientWidth; const ch = canvas.clientHeight;
        render(ctx, w, { width: cw, height: ch, scale: Math.max(cw / 760, ch / 560, 0.62) }, colors, { horror: live.current.horror, still });
      }
      if (mini && (frameN++ % 3 === 0 || !running)) mini(is3d ? s.yaw : null);

      // HUD written straight to the DOM (bars, compass)
      if (d.alarm) d.alarm.style.transform = `scaleX(${w.alarm / 100})`;
      if (d.stam) d.stam.style.transform = `scaleX(${p.stam / 100})`;
      // the red edge of fear is an opacity change only (no repaint of a full-screen gradient every frame)
      const fearK = Math.round(w.alarm) / 100;
      if (d.fear && fearK !== lastFear) { lastFear = fearK; d.fear.style.opacity = String(fearK); }
      if (is3d && compW) {
        for (let i = 0; i < 3; i++) {
          const r = w.riders[i]; const el = d[`r${i}`]; if (!el) continue;
          if (r.rallied) el.style.display = 'none'; else { el.style.display = ''; place(el, Math.atan2(r.y - p.y, r.x - p.x), s.yaw); }
        }
        const g = nextGap(w); place(d.gap, Math.atan2(g.y - p.y, g.x - p.x), s.yaw);
        place(d.north, -Math.PI / 2, s.yaw);
        if (d.dist) { const m = Math.round(Math.hypot(g.x - p.x, g.y - p.y) * 0.06); if (d.dist.textContent !== `${m} m`) d.dist.textContent = `${m} m`; }
      }
      // slower things go through React, a few times a second
      hudT -= dt;
      if (hudT <= 0 || !running) {
        hudT = 0.2;
        const tu = tut.current;
        const hint = tu.step < 6 && w.state === 'play' ? ['move', 'light', 'rider', 'gallop', 'stone', 'gap'][tu.step] : null;
        const status = w.suspect ? 'suspect' : w.seen ? 'seen' : 'calm';
        const secs = Math.max(0, Math.ceil(w.limit - w.time));
        setHud((h) => (h.riders === w.rallied && h.stones === w.stones && h.status === status && h.hidden === w.hidden && h.town === w.inTown && h.noisy === (w.noisy && !!w.heard)
          && h.winded === p.winded && h.secs === secs && h.weather === w.weather && h.hint === hint ? h
          : { riders: w.rallied, stones: w.stones, status, hidden: w.hidden, town: w.inTown, noisy: w.noisy && !!w.heard, winded: p.winded, secs, weather: w.weather, hint }));
      }
    };

    // the loop stops completely while paused, on an overlay, or in a hidden tab, and is woken by markDirty()
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const running = modeRef.current === 'run' && phaseRef.current === 'play' && !document.hidden && !lostNow;
      if (!running && !dirty.current) { raf = 0; return; }
      raf = requestAnimationFrame(frame);
      dirty.current = false;
      tick(running ? dt : 0, running, now);
    };
    let lostNow = false;
    const wake = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    wakeRef.current = wake;
    drawNow = () => { if (!lostNow) tick(0, false, performance.now()); };
    raf = requestAnimationFrame(frame);

    const onHide = () => { if (document.hidden) fns.current.pause('blur'); };
    // entering or leaving full screen can blur the window for a moment on some browsers: not a reason to pause
    const onFull = () => { fullAt.current = performance.now(); };
    const onBlur = () => { if (performance.now() - fullAt.current > 500) fns.current.pause('blur'); };
    // the GPU can drop the 3D context (driver reset, memory pressure on a weak GPU at 4K): pause behind the
    // menu, wait for it to come back, never draw into a dead context; a second loss starts one step lighter
    let stuckT = 0;
    const onLost = (e) => {
      e.preventDefault(); lostNow = true;
      fns.current.pause('gfx'); setGfxLost('lost');
      clearTimeout(stuckT); stuckT = setTimeout(() => setGfxLost((g) => (g ? 'stuck' : g)), 5000);
    };
    const onRestored = () => {
      lostNow = false; clearTimeout(stuckT); setGfxLost(null);
      fp?.restored(); if (worldRef.current && fp) fp.load(worldRef.current, { horror: live.current.horror });
      markDirty();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFull);
    document.addEventListener('webkitfullscreenchange', onFull);
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);

    if (import.meta.env.DEV) {
      // test hook, dev only — see the handoff notes for examples
      window.__percee = {
        get current() { return worldRef.current; },
        get world() { return worldRef.current; },
        TUNE,
        input: inp,
        state() {
          const w = worldRef.current; const s = inp.state;
          return {
            phase: phaseRef.current, mode: modeRef.current, night: w.night, seed: w.seed, view: is3d ? '3d' : '2d', kind: s.kind, locked: s.locked,
            alarm: Math.round(w.alarm * 10) / 10, status: w.suspect ? 'suspect' : w.seen ? 'seen' : 'calm', worldState: w.state, time: Math.round(w.time * 10) / 10, limit: w.limit,
            player: { x: Math.round(w.player.x), y: Math.round(w.player.y), yaw: s.yaw, pitch: s.pitch, stam: Math.round(w.player.stam), speed: Math.round(w.player.speed), galloping: w.player.galloping },
            rallied: w.rallied, stones: w.stones, hidden: w.hidden, inTown: w.inTown, weather: w.weather, tutorial: tut.current.step,
            run: { ...run.current }, gfx: fp ? fp.stats() : null,
          };
        },
        /** advance the simulation by n frames right now (works in a background tab) */
        tick(n = 1, dt = 1 / 60) { const was = modeRef.current; for (let i = 0; i < n && phaseRef.current === 'play'; i++) tick(dt, was === 'run', performance.now()); return this.state(); },
        begin() { if (modeRef.current === 'ready') { modeRef.current = 'run'; setModeS('run'); } },
        pause() { fns.current.pause('key'); }, resume() { fns.current.resume(); },
        teleport(x, y) { const p = worldRef.current.player; p.x = x; p.y = y; p.vx = p.vy = 0; markDirty(); },
        setYaw(a) { inp.state.yaw = a; markDirty(); }, setPitch(a) { inp.state.pitch = a; markDirty(); },
        lookAt(x, y) { const p = worldRef.current.player; inp.state.yaw = Math.atan2(y - p.y, x - p.x); markDirty(); },
        /** hold a direction for `secs` of game time: x = right, y = forward (3D) / x = east, y = north (2D) */
        move(x, y, gallop = false, secs = 1) { hook.current = { x, y, gallop, until: worldRef.current.time + secs }; },
        detect(v) { worldRef.current.alarm = v; },
        rally(i = 0) { const w = worldRef.current; const r = w.riders[i]; this.teleport(r.hx, r.hy); },
        gap() { return nextGap(worldRef.current); },
        throwStone() { fns.current.doThrow(); },
        /** dev: force a resolution step, or simulate a lost / restored GPU context */
        resStep(i) { fp?.setStep(i); markDirty(); },
        loseContext() { this.lc = this.lc || canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context'); this.lc?.loseContext(); return !!this.lc; },
        restoreContext() { this.lc?.restoreContext(); },
        /** escape the night at once */
        finish() { const w = worldRef.current; const g = w.outer.gapPts[0]; const a = Math.atan2(g.y - w.cy, g.x - w.cx); this.teleport(Math.max(12, Math.min(WORLD.w - 12, g.x + Math.cos(a) * 90)), Math.max(12, Math.min(WORLD.h - 12, g.y + Math.sin(a) * 90))); },
        fail(reason = 'seen') { const w = worldRef.current; if (reason === 'dawn') w.time = w.limit; else w.alarm = 100; },
      };
    }

    return () => {
      cancelAnimationFrame(raf); raf = 0; ro.disconnect();
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFull);
      document.removeEventListener('webkitfullscreenchange', onFull);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      clearTimeout(stuckT); wakeRef.current = null; setGfxLost(null);
      inp.dispose(); inputRef.current = null;
      fp?.dispose(); fpRef.current = null;
      if (import.meta.env.DEV) delete window.__percee;
    };
  }, [active, view, setView]);

  // while the stage is up, the page behind must not scroll
  useEffect(() => {
    if (!active) return undefined;
    const el = document.documentElement; const prev = el.style.overflow;
    el.style.overflow = 'hidden';
    return () => { el.style.overflow = prev; };
  }, [active]);

  /* ── leaderboard ── */
  /* The run goes to the class board (/api/board). It is also kept on this device: at once if the
     class board cannot be reached (and sent again later), otherwise once the server has accepted it. */
  const keepLocal = () => {
    if (savedId) return;
    const id = `r-${Date.now().toString(36)}`;
    const entry = { id, name: tidyName(name), points: result.points, nights: result.nights, riders: result.riders, time: Math.round(result.time), medals: result.medals, at: Date.now(), src: 'local' };
    const b = addEntry(board, result.seed, entry);
    setBoard(b); saveBoard(b); setSavedId(id);
  };
  const saveScore = async () => {
    if (!result || send.state === 'sending' || send.state === 'saved') return;
    const why = nameProblem(name);
    if (why) { setSend({ state: 'error', why }); return; }
    const payload = { name: tidyName(name), points: result.points, nights: result.nights, gold: golds(result), riders: result.riders, time: Math.round(result.time), seed: result.seed };
    setName(payload.name);
    setSend({ state: 'sending' });
    const r = await submitClassScore(payload);
    if (r.ok) {
      keepLocal(); haptic('success');
      const p = loadPending(); if (p && p.name === payload.name && p.points <= payload.points) savePending(null);
      setSend({ state: 'saved', rank: r.rank, total: r.total, improved: r.improved, best: r.best });
      setBoardKey((k) => k + 1);
    } else {
      if (r.error === 'offline' || r.error === 'rate') {
        keepLocal();
        const p = loadPending(); if (!p || p.points <= payload.points || p.name !== payload.name) savePending(payload);
      }
      haptic('miss');
      setSend({ state: 'error', why: r.error });
    }
  };
  // a score that could not be sent earlier goes out quietly the next time the game opens
  useEffect(() => {
    const p = loadPending(); if (!p) return;
    submitClassScore(p).then((r) => { if (r.ok || r.error === 'name' || r.error === 'profanity' || r.error === 'invalid') { savePending(null); if (r.ok) setBoardKey((k) => k + 1); } });
  }, []);
  const copy = async (what, text) => {
    try { await navigator.clipboard.writeText(text); setCopied(what); haptic('light'); } catch { setCopied(`${what}-fail`); }
  };
  const shareLink = async () => {
    const url = new URL(window.location.href); url.searchParams.set('g', 'percee'); url.searchParams.set('seed', seed);
    try {
      if (navigator.share && kind === 'touch') { await navigator.share({ title: 'La Percée — Alésia', url: url.toString() }); haptic('light'); } else await copy('link', url.toString());
    } catch { /* cancelled */ }
  };
  const toggleFull = () => {
    fullAt.current = performance.now();
    try {
      if (document.fullscreenElement) document.exitFullscreen()?.catch?.(() => {});
      else if (document.webkitFullscreenElement) document.webkitExitFullscreen?.();
      else { const el = document.documentElement; (el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen?.())?.catch?.(() => {}); }
    } catch { /* not supported (iPhone): the stage already fills the viewport */ }
  };

  const touch = kind === 'touch';
  const is3d = view === '3d';
  const hintText = (() => {
    if (!hud.hint) return null;
    const h = HINTS[hud.hint];
    if (h.fr) return t(h);
    if (!is3d && h.d) return t(h.d);
    if (touch && big && h.b) return t(h.b);
    return t(touch ? h.t : h.m);
  })();
  const statusText = hud.status === 'suspect' ? t({ fr: 'Soupçon !', en: 'Suspected!' })
    : hud.status === 'seen' ? t({ fr: 'On vous voit', en: 'Seen' })
      : hud.town ? t({ fr: 'En sûreté', en: 'Safe' })
        : hud.hidden ? t({ fr: 'Caché', en: 'Hidden' }) : t({ fr: 'Invisible', en: 'Unseen' });
  const setRef = (k) => (el) => { dom.current[k] = el; };
  const d0 = () => dom.current;

  const SettingsRow = (
    <div className="pc-settings">
      <label className="pc-range">
        <span>{t({ fr: 'Sensibilité du regard', en: 'Look sensitivity' })}</span>
        <input type="range" min="0.4" max="2.2" step="0.1" value={settings.sens} onChange={(e) => setSettings((s) => ({ ...s, sens: Number(e.target.value) }))} />
        <output>{Number(settings.sens).toFixed(1)}×</output>
      </label>
      <label className="pc-toggle"><input type="checkbox" checked={!!settings.invertY} onChange={(e) => setSettings((s) => ({ ...s, invertY: e.target.checked }))} /><span>{t({ fr: 'Inverser l’axe vertical', en: 'Invert vertical look' })}</span></label>
      <label className="pc-toggle"><input type="checkbox" checked={!muted} onChange={(e) => setMuted(!e.target.checked)} /><span>{t({ fr: 'Son', en: 'Sound' })}</span></label>
      {(touchCapable() || big) && (
        <div className="pc-bigset" role="group" aria-label={t({ fr: 'Commandes grand écran', en: 'Big-screen controls' })}>
          <span>{t({ fr: 'Commandes grand écran', en: 'Big-screen controls' })}</span>
          {[['auto', { fr: 'Auto', en: 'Auto' }], ['on', { fr: 'Oui', en: 'On' }], ['off', { fr: 'Non', en: 'Off' }]].map(([v, l]) => {
            const on = bigUrl === null ? bigPref === v : v === (bigUrl ? 'on' : 'off');
            return <button key={v} type="button" className={`gf-btn${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => { setBigUrl(null); setBigPref(v); }}>{t(l)}</button>;
          })}
        </div>
      )}
      {big && (
        <label className="pc-range">
          <span>{t({ fr: 'Taille de la console', en: 'Console size' })}</span>
          <input type="range" min="0.8" max="1.6" step="0.1" value={bigSize} onChange={(e) => setBigSize(Number(e.target.value))} />
          <output>{Number(bigSize).toFixed(1)}×</output>
        </label>
      )}
    </div>
  );

  const Controls = (
    <ul className="pc-keys">
      {touch && big ? (
        BIG_CONTROLS.map((l, i) => <li key={i}>{t(l)}</li>)
      ) : touch ? (
        <>
          <li>{t({ fr: 'Pouce gauche : avancer', en: 'Left thumb: ride' })}</li>
          <li>{t({ fr: 'Pouce droit : regarder', en: 'Right thumb: look' })}</li>
          <li>{t({ fr: 'Éclair : galop · Rond : pierre', en: 'Lightning: gallop · Circle: stone' })}</li>
        </>
      ) : (
        <>
          <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / <kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> {t({ fr: 'avancer', en: 'ride' })}</li>
          <li>{is3d ? t({ fr: 'Souris : regarder (ou ← →)', en: 'Mouse: look (or ← →)' }) : t({ fr: 'Flèches : avancer', en: 'Arrows: ride' })}</li>
          <li><kbd>{t({ fr: 'Maj', en: 'Shift' })}</kbd> {t({ fr: 'galop', en: 'gallop' })} · <kbd>E</kbd> {t({ fr: 'pierre', en: 'stone' })} · <kbd>{t({ fr: 'Échap', en: 'Esc' })}</kbd> {t({ fr: 'pause', en: 'pause' })}</li>
        </>
      )}
    </ul>
  );

  const stage = active && createPortal(
    <div className={`pc-stage${horror ? ' is-horror' : ''}`} ref={stageRef} data-input={kind} data-view={view} data-mode={phase === 'play' ? mode : phase}
      data-big={big ? '1' : undefined} style={big ? { '--mm': `${mm}px`, '--bs-x': bigPos.x, '--bs-y': bigPos.y } : undefined}>
      <div className="pc-surface" ref={surfaceRef}>
        <canvas key={view} ref={canvasRef} className="pc-canvas" tabIndex={0} role="application"
          aria-label={t({ fr: 'Vue de nuit : chevauchez hors d’Alésia sans être vu', en: 'Night view: ride out of Alésia unseen' })} />
        <span className="pc-fx" ref={setRef('fx')} aria-hidden="true"><span className="pc-fear" ref={setRef('fear')} /></span>
        {is3d && <span className="pc-cross" aria-hidden="true" />}

        <div className="pc-hud">
          <div className="pc-hud-l">
            <p className="pc-night">
              <span>{t({ fr: 'Nuit', en: 'Night' })} {night}/{NIGHTS}</span>
              <span className="pc-wx">{hud.weather === 'rain' ? t({ fr: 'pluie', en: 'rain' }) : hud.weather === 'fog' ? t({ fr: 'brouillard', en: 'fog' }) : t({ fr: 'ciel clair', en: 'clear sky' })}</span>
            </p>
            <div className={`pc-eye is-${hud.status}`}>
              {hud.status === 'calm' ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              <span className="pc-bar"><span ref={setRef('alarm')} /></span>
              <span className="pc-eye-txt">{statusText}</span>
            </div>
            <div className={`pc-stam${hud.winded ? ' is-winded' : ''}`}>
              <Zap size={18} aria-hidden="true" />
              <span className="pc-bar"><span ref={setRef('stam')} /></span>
              <span className="pc-eye-txt">{hud.winded ? t({ fr: 'Essoufflé', en: 'Winded' }) : hud.noisy ? t({ fr: 'Entendu !', en: 'Heard!' }) : t({ fr: 'Souffle', en: 'Breath' })}</span>
            </div>
            <p className="pc-counts">
              <span title={t({ fr: 'Cavaliers ralliés', en: 'Riders rallied' })}><i className="pc-dot is-gaul" aria-hidden="true" />{hud.riders}/3<span className="pc-sr"> {t({ fr: 'cavaliers ralliés', en: 'riders rallied' })}</span></span>
              <span title={t({ fr: 'Pierres', en: 'Stones' })}><i className="pc-dot is-stone" aria-hidden="true" />{hud.stones}<span className="pc-sr"> {t({ fr: 'pierres', en: 'stones' })}</span>{!touch && <kbd>E</kbd>}</span>
            </p>
          </div>

          {is3d && (
            <div className="pc-compass" ref={setRef('comp')} aria-hidden="true">
              <span className="pc-mk is-north" ref={setRef('north')}>N</span>
              <span className="pc-mk is-rider" ref={setRef('r0')} />
              <span className="pc-mk is-rider" ref={setRef('r1')} />
              <span className="pc-mk is-rider" ref={setRef('r2')} />
              <span className="pc-mk is-gap" ref={setRef('gap')}><b ref={setRef('dist')} /></span>
            </div>
          )}

          <div className="pc-hud-r">
            <div className="pc-hud-r-top">
              <p className={`pc-dawn${hud.secs <= TUNE.dawnWarn ? ' is-late' : ''}`}><span>{t({ fr: 'Aube dans', en: 'Dawn in' })}</span> {fmtTime(hud.secs)}</p>
              <button type="button" className="pc-hbtn" onClick={() => pause('key')} aria-label={t({ fr: 'Pause', en: 'Pause' })}><Pause size={20} aria-hidden="true" /></button>
            </div>
            <canvas ref={mmRef} className="pc-mm" width="300" height="207" aria-hidden="true" />
          </div>
        </div>

        <p className="pc-sr" aria-live="polite">{phase === 'play' && mode === 'run' ? statusText : ''}</p>
        {(toast || hintText) && phase === 'play' && mode === 'run' && (
          <p className={`pc-toast${toast ? ' is-fact' : ''}`} aria-live="polite">{toast || hintText}</p>
        )}

        <span className="pc-joy" ref={setRef('joy')} aria-hidden="true"><span className="pc-joy-knob" ref={setRef('knob')} /></span>
        {phase === 'play' && mode === 'run' && (
          <div className="pc-touch">
            <button type="button" className="pc-tbtn is-stone" disabled={hud.stones <= 0}
              onPointerDown={(e) => { e.preventDefault(); doThrow(); }} aria-label={t({ fr: 'Lancer une pierre', en: 'Throw a stone' })}>
              <Circle size={20} aria-hidden="true" /><small>{hud.stones}</small>
            </button>
            <button type="button" className="pc-tbtn is-gallop"
              onPointerDown={(e) => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic */ } e.currentTarget.dataset.x = e.clientX; e.currentTarget.dataset.y = e.clientY; inputRef.current?.setGallop(true); haptic('light'); }}
              onPointerMove={(e) => { const b = e.currentTarget; if (b.dataset.x === undefined || e.pointerType === 'mouse') return; inputRef.current?.lookBy(e.clientX - b.dataset.x, e.clientY - b.dataset.y); b.dataset.x = e.clientX; b.dataset.y = e.clientY; }}
              onPointerUp={(e) => { delete e.currentTarget.dataset.x; inputRef.current?.setGallop(false); }}
              onPointerCancel={(e) => { delete e.currentTarget.dataset.x; inputRef.current?.setGallop(false); }}
              onLostPointerCapture={() => inputRef.current?.setGallop(false)}
              aria-label={t({ fr: 'Galop (maintenir)', en: 'Gallop (hold)' })}>
              <Zap size={26} aria-hidden="true" />
            </button>
          </div>
        )}
        {big && phase === 'play' && mode === 'run' && (
          <div className="pc-bs" ref={setRef('bs')}>
            <button type="button" className="pc-bs-grip" aria-label={t(BIG_LABELS.move)} title={t(BIG_LABELS.move)}
              onPointerDown={(e) => {
                e.preventDefault(); const b = e.currentTarget; try { b.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
                const box = d0().bs?.getBoundingClientRect(); if (!box) return;
                b.dataset.ox = e.clientX - (box.left + box.width / 2); b.dataset.oy = e.clientY - box.bottom;
              }}
              onPointerMove={(e) => {
                const b = e.currentTarget; if (b.dataset.ox === undefined) return;
                const sr = surfaceRef.current.getBoundingClientRect();
                const x = (e.clientX - Number(b.dataset.ox) - sr.left) / sr.width; const y = (e.clientY - Number(b.dataset.oy) - sr.top) / sr.height;
                const st = stageRef.current.style; st.setProperty('--bs-x', Math.max(0, Math.min(1, x))); st.setProperty('--bs-y', Math.max(0.3, Math.min(1, y)));
              }}
              onPointerUp={(e) => {
                const b = e.currentTarget; if (b.dataset.ox === undefined) return; delete b.dataset.ox; delete b.dataset.oy;
                const st = stageRef.current.style; setBigPos({ x: Number(st.getPropertyValue('--bs-x')) || 0.5, y: Number(st.getPropertyValue('--bs-y')) || 1 });
              }}
              onPointerCancel={(e) => { delete e.currentTarget.dataset.ox; delete e.currentTarget.dataset.oy; }}>
              <GripHorizontal size={18} aria-hidden="true" />
            </button>
            <div className="pc-bs-row">
              <div className="pc-bs-ctl">
                <div className="pc-bs-stick" data-bs="stick" ref={setRef('bsStick')} role="img" aria-label={`${t(BIG_LABELS.stick)}, ${t(BIG_LABELS.ring)}`}>
                  <span className="pc-bs-base"><span className="pc-bs-knob" ref={setRef('bsKnob')} /></span>
                </div>
                <span className="pc-bs-lbl">{t(BIG_LABELS.stick)} <small>· {t(BIG_LABELS.ring)}</small></span>
              </div>
              <div className="pc-bs-mid">
                <button type="button" className="pc-bs-btn is-gallop"
                  onPointerDown={(e) => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic */ } inputRef.current?.setGallop(true); haptic('light'); }}
                  onPointerUp={() => inputRef.current?.setGallop(false)} onPointerCancel={() => inputRef.current?.setGallop(false)}
                  onLostPointerCapture={() => inputRef.current?.setGallop(false)}
                  aria-label={t({ fr: 'Galop (maintenir)', en: 'Gallop (hold)' })}><Zap size={22} aria-hidden="true" /></button>
                <button type="button" className="pc-bs-btn is-stone" disabled={hud.stones <= 0}
                  onPointerDown={(e) => { e.preventDefault(); doThrow(); }} aria-label={t({ fr: 'Lancer une pierre', en: 'Throw a stone' })}>
                  <Circle size={18} aria-hidden="true" /><small>{hud.stones}</small></button>
                <button type="button" className="pc-bs-btn is-pause" onClick={() => pause('key')} aria-label={t({ fr: 'Pause', en: 'Pause' })}><Pause size={16} aria-hidden="true" /></button>
              </div>
              {is3d && (
                <div className="pc-bs-ctl">
                  <div className="pc-bs-look" data-bs="look" role="img" aria-label={t(BIG_LABELS.look)}><MoveHorizontal size={28} aria-hidden="true" /></div>
                  <span className="pc-bs-lbl">{t(BIG_LABELS.look)}</span>
                </div>
              )}
            </div>
          </div>
        )}
        {lockNote && phase === 'play' && mode === 'run' && !touch && is3d && (
          <p className="pc-locknote">{t({ fr: 'Cliquez dans la vue pour capturer la souris, ou maintenez le clic et glissez pour regarder.', en: 'Click the view to capture the mouse, or hold the button and drag to look.' })}</p>
        )}
      </div>

      {/* ── overlays (outside the play surface, so they scroll and click normally) ── */}
      {phase === 'play' && mode === 'ready' && (
        <div className="pc-overlay is-intro" data-ui>
          <div className="pc-intro" key={night}>
            <p className="pc-intro-line" style={{ animationDelay: '0.15s' }}>{t({ fr: `Nuit ${night}. Août 52 av. J.-C.`, en: `Night ${night}. August 52 BC.` })}</p>
            <p className="pc-intro-line" style={{ animationDelay: '0.9s' }}>{t(NIGHT_LINES[night - 1])}</p>
            <p className="pc-intro-line" style={{ animationDelay: '1.65s' }}>{t({ fr: 'Ralliez trois cavaliers. Sortez avant l’aube.', en: 'Rally three riders. Get out before dawn.' })}</p>
            <button type="button" className="btn-primary pc-go" onClick={begin} autoFocus>
              {touch ? t({ fr: 'Toucher pour partir', en: 'Tap to ride' }) : is3d ? t({ fr: 'Cliquer pour partir', en: 'Click to ride' }) : t({ fr: 'Partir', en: 'Ride' })}
            </button>
            {Controls}
            {is3d && <p className="pc-rotate">{t({ fr: 'Astuce : tenez le téléphone à l’horizontale pour voir plus large.', en: 'Tip: hold the phone sideways for a wider view.' })}</p>}
          </div>
        </div>
      )}

      {phase === 'play' && mode === 'paused' && (
        <div className="pc-overlay" data-ui>
          <div className="gf-card pc-menu" role="dialog" aria-modal="true" aria-label={t({ fr: 'Pause', en: 'Paused' })}>
            <p className="gf-card-title">{t({ fr: 'Pause', en: 'Paused' })}</p>
            <p className="pc-menu-sub">{t({ fr: `Nuit ${night}/${NIGHTS} · aube dans ${fmtTime(hud.secs)}`, en: `Night ${night}/${NIGHTS} · dawn in ${fmtTime(hud.secs)}` })}</p>
            <div className="pc-menu-btns">
              <button type="button" className="btn-primary" onClick={resume} disabled={cooldown || !!gfxLost} autoFocus><Play size={18} aria-hidden="true" /> {t({ fr: 'Reprendre', en: 'Resume' })}</button>
              <button type="button" className="gf-btn" onClick={() => { run.current.time += worldRef.current.time; run.current.tries += 1; startNight(night); }}><RotateCcw size={16} aria-hidden="true" /> {t({ fr: 'Recommencer cette nuit', en: 'Restart this night' })}</button>
              <button type="button" className={`gf-btn${confirm === 'new' ? ' is-on' : ''}`} onClick={() => (confirm === 'new' ? newRun() : setConfirm('new'))}>
                {confirm === 'new' ? t({ fr: 'Confirmer : nouvelle partie', en: 'Confirm: new game' }) : t({ fr: 'Nouvelle partie', en: 'New game' })}</button>
              <button type="button" className={`gf-btn${confirm === 'quit' ? ' is-on' : ''}`} onClick={() => (confirm === 'quit' ? quit() : setConfirm('quit'))}><LogOut size={16} aria-hidden="true" />
                {confirm === 'quit' ? t({ fr: 'Confirmer : quitter', en: 'Confirm: quit' }) : t({ fr: 'Quitter le jeu', en: 'Quit the game' })}</button>
            </div>
            {gfxLost && (
              <p className="pc-menu-sub pc-gfxnote" role="status">
                {t({ fr: 'L’affichage 3D a été interrompu par la carte graphique. Il revient tout seul dans un instant ; la partie est en pause, rien n’est perdu.', en: 'The graphics card interrupted the 3D view. It comes back by itself in a moment; the game is paused and nothing is lost.' })}
                {gfxLost === 'stuck' && <> <button type="button" className="gf-btn" onClick={() => setView('2d')}>{t({ fr: 'Continuer sur la carte 2D', en: 'Continue on the 2D map' })}</button></>}
              </p>
            )}
            <p className="pc-menu-sub" aria-live="polite">{confirm ? t({ fr: 'La partie en cours sera perdue. Appuyez encore une fois pour confirmer.', en: 'The current run will be lost. Press once more to confirm.' }) : t({ fr: 'Votre partie attend. Rien ne bouge pendant la pause.', en: 'Your run is waiting. Nothing moves while paused.' })}</p>
            {SettingsRow}
            <div className="gf-row">
              <div className="pc-view" role="group" aria-label={t({ fr: 'Vue', en: 'View' })}>
                <button type="button" className={`gf-btn${is3d ? ' is-on' : ''}`} aria-pressed={is3d} onClick={() => setView('3d')}>{t({ fr: '3D', en: '3D' })}</button>
                <button type="button" className={`gf-btn${!is3d ? ' is-on' : ''}`} aria-pressed={!is3d} onClick={() => setView('2d')}>{t({ fr: 'Carte 2D', en: '2D map' })}</button>
              </div>
              <button type="button" className="gf-btn" onClick={toggleFull}><Maximize size={16} aria-hidden="true" /> {t({ fr: 'Plein écran', en: 'Full screen' })}</button>
            </div>
            {Controls}
            <p className="pc-legend">
              <span><i className="pc-dot is-gaul" aria-hidden="true" />{t({ fr: 'cavalier à rallier', en: 'rider to rally' })}</span>
              <span><i className="pc-dot is-gold" aria-hidden="true" />{t({ fr: 'brèche', en: 'gap' })}</span>
              <span><i className="pc-dot is-rome" aria-hidden="true" />{t({ fr: 'sentinelle romaine', en: 'Roman sentry' })}</span>
            </p>
          </div>
        </div>
      )}

      {phase === 'between' && nightStats && (
        <div className="pc-overlay" data-ui>
          <Card tone="is-win" title={{ fr: `Nuit ${night} : passé !`, en: `Night ${night}: through!` }}
            action={{ fr: `Nuit ${night + 1}`, en: `Night ${night + 1}` }} onAction={() => startNight(night + 1)}>
            <p className="pc-stats">
              <Medal level={nightStats.medal} t={t} />
              <span>{fmtTime(nightStats.time)}</span>
              <span><i className="pc-dot is-gaul" aria-hidden="true" />{nightStats.riders}/3 {t({ fr: 'cavaliers', en: 'riders' })}</span>
              <span>{nightStats.clean ? t({ fr: 'jamais soupçonné', en: 'never suspected' }) : t({ fr: 'soupçonné', en: 'suspected' })}</span>
            </p>
            <Breakdown t={t} total={nightStats.score.total} totalLabel={PL.nightTotal}
              lines={nightStats.score.parts.map((x) => ({ label: PL[x.k], n: x.n, pts: x.pts }))} />
            <p className="pc-pts-run">{t(PL.runSoFar)}{t({ fr: ' : ', en: ': ' })}<b>{fmtPts(nightStats.run)}</b> {t(PL.pts)}
              {nightStats.tries > 0 && <> ({t(PL.retry).toLowerCase()} ×{nightStats.tries}{t({ fr: ' : ', en: ': ' })}−{fmtPts(nightStats.tries * POINTS.retry)})</>}</p>
            <p className="gf-simplified">{t({ fr: 'Or : trois cavaliers sans jamais éveiller de soupçon. Argent : deux cavaliers, ou aucun soupçon.', en: 'Gold: three riders and never suspected. Silver: two riders, or never suspected.' })}</p>
            <p>{t({ fr: 'Chaque jour, les Romains bouchent des brèches et ajoutent des tours. La nuit suivante sera plus dure, et l’aube viendra plus tôt.', en: 'Every day the Romans close gaps and add towers. The next night will be harder, and dawn will come sooner.' })}</p>
          </Card>
        </div>
      )}

      {phase === 'caught' && (
        <div className="pc-overlay" data-ui>
          <Card title={caught === 'dawn' ? { fr: 'L’aube se lève', en: 'Dawn breaks' } : { fr: 'Repéré', en: 'Spotted' }}
            action={{ fr: `Réessayer la nuit ${night}`, en: `Retry night ${night}` }} onAction={() => startNight(night)}>
            <p>{caught === 'dawn'
              ? t({ fr: 'Le jour se lève : plus moyen de passer sans être vu. Il fallait franchir les deux lignes avant l’aube.', en: 'Day is breaking: there is no slipping through now. You had to cross both lines before dawn.' })
              : t({ fr: 'Les sentinelles donnent l’alerte. Vous tournez bride vers Alésia.', en: 'The sentries raise the alarm. You turn back to Alésia.' })}</p>
            <p className="gf-simplified">{t({ fr: 'Le temps de cet essai est ajouté à votre total.', en: 'The time of this attempt is added to your total.' })} {t(PL.caught)}</p>
            <div className="gf-row">
              <button type="button" className="gf-btn" onClick={() => finishRun(false)}>{t({ fr: 'Terminer et enregistrer le score', en: 'End the run and save the score' })}</button>
              <button type="button" className="gf-btn" onClick={quit}>{t({ fr: 'Quitter', en: 'Quit' })}</button>
            </div>
          </Card>
        </div>
      )}

      {phase === 'over' && result && (
        <div className="pc-overlay" data-ui>
          <Card tone={result.won ? 'is-win' : ''}
            title={result.won ? { fr: 'Le secours est en route', en: 'Help is on its way' } : { fr: 'Fin de la chevauchée', en: 'End of the ride' }}
            action={{ fr: 'Rejouer', en: 'Play again' }} onAction={() => newRun()}>
            <p>{result.won
              ? t({ fr: 'Cinq nuits, cinq percées. Historiquement, la cavalerie gauloise a bien franchi les lignes avant qu’elles ne se ferment, et l’armée de secours est venue.', en: 'Five nights, five breakouts. Historically the Gallic cavalry did slip out before the lines closed, and the relief army came.' })
              : t({ fr: `Nuits réussies : ${result.nights}/${NIGHTS}. Chaque cavalier rallié portera l’appel plus loin.`, en: `Nights completed: ${result.nights}/${NIGHTS}. Every rider you rallied will carry the call further.` })}</p>
            <dl className="pc-sum">
              <div className="is-points"><dt>{t({ fr: 'Points', en: 'Points' })}</dt><dd><CountUp value={result.points} ms={1400} /></dd></div>
              <div><dt>{t({ fr: 'Nuits', en: 'Nights' })}</dt><dd>{result.nights}/{NIGHTS}</dd></div>
              <div><dt>{t({ fr: 'Temps total', en: 'Total time' })}</dt><dd>{fmtTime(result.time)}</dd></div>
              <div><dt>{t({ fr: 'Essais manqués', en: 'Failed tries' })}</dt><dd>{result.tries}</dd></div>
            </dl>
            {result.medals.length > 0 && (
              <ol className="pc-medals" aria-label={t({ fr: 'Médailles par nuit', en: 'Medals per night' })}>
                {result.medals.map((m, i) => <li key={i}><span>{t({ fr: 'Nuit', en: 'Night' })} {i + 1}</span><Medal level={m} t={t} /></li>)}
              </ol>
            )}
            {(result.pts.length > 0 || result.tries > 0) && (
              <Breakdown t={t} total={result.points} totalLabel={PL.total}
                lines={[
                  ...result.pts.map((x, i) => ({ label: { fr: `${PL.night.fr} ${i + 1}`, en: `${PL.night.en} ${i + 1}` }, n: 1, pts: x })),
                  { label: PL.retry, n: result.tries, pts: -result.tries * POINTS.retry },
                ]} />
            )}
            <form className="pc-save" onSubmit={(e) => { e.preventDefault(); saveScore(); }}>
              <label className="pc-label" htmlFor="pc-name">{t({ fr: 'Votre nom (prénom et nom)', en: 'Your name (first and last)' })}</label>
              <input id="pc-name" className="pc-name" value={name} maxLength={24} autoComplete="name" spellCheck="false" enterKeyHint="send"
                placeholder={t({ fr: 'ex. Camille Martin', en: 'e.g. Camille Martin' })} disabled={send.state === 'sending' || send.state === 'saved'}
                aria-invalid={send.state === 'error' && ['empty', 'long', 'chars', 'name', 'profanity'].includes(send.why) ? 'true' : undefined} aria-describedby="pc-send-msg"
                onChange={(e) => { setName(e.target.value.slice(0, 24)); if (send.state === 'error') setSend({ state: 'idle' }); }} />
              {send.state !== 'saved' && (
                <button type="submit" className="gf-btn is-on" disabled={send.state === 'sending' || !tidyName(name)}>
                  <Send size={16} aria-hidden="true" /> {send.state === 'sending' ? t({ fr: 'Envoi…', en: 'Sending…' })
                    : send.state === 'error' && (send.why === 'offline' || send.why === 'rate') ? t({ fr: 'Réessayer', en: 'Try again' })
                      : t({ fr: 'Enregistrer au classement', en: 'Save to the class board' })}
                </button>
              )}
              <p id="pc-send-msg" className={`pc-send is-${send.state}`} role="status" aria-live="polite">
                {send.state === 'idle' && t({ fr: 'Votre score apparaîtra tout de suite au classement de la classe. Un nom = une ligne : seul votre meilleur score reste.', en: 'Your score shows up right away on the class board. One name = one row: only your best score stays.' })}
                {send.state === 'sending' && t({ fr: 'Envoi au classement de la classe…', en: 'Sending to the class board…' })}
                {send.state === 'saved' && <><Check size={16} aria-hidden="true" /> {send.improved
                  ? t({ fr: `Enregistré ! Vous êtes ${send.rank}${send.rank === 1 ? 'er' : 'e'} sur ${send.total}.`, en: `Saved! You are number ${send.rank} of ${send.total}.` })
                  : t({ fr: `Enregistré, mais votre record (${fmtPts(send.best?.points || 0)} pts) reste au classement : ${send.rank}${send.rank === 1 ? 'er' : 'e'} sur ${send.total}.`, en: `Saved, but your best (${fmtPts(send.best?.points || 0)} pts) stays on the board: number ${send.rank} of ${send.total}.` })}</>}
                {send.state === 'error' && send.why === 'empty' && t({ fr: 'Écrivez votre nom pour enregistrer le score.', en: 'Type your name to save the score.' })}
                {send.state === 'error' && send.why === 'long' && t({ fr: 'Nom trop long : 24 caractères au plus.', en: 'Name too long: 24 characters at most.' })}
                {send.state === 'error' && (send.why === 'chars' || send.why === 'name') && t({ fr: 'Lettres, chiffres, espaces, tirets et apostrophes seulement.', en: 'Letters, numbers, spaces, hyphens and apostrophes only.' })}
                {send.state === 'error' && send.why === 'profanity' && t({ fr: 'Ce nom n’est pas accepté. Utilisez votre vrai nom.', en: 'That name is not accepted. Please use your real name.' })}
                {send.state === 'error' && send.why === 'invalid' && t({ fr: 'Le classement a refusé ce score.', en: 'The class board refused this score.' })}
                {send.state === 'error' && send.why === 'rate' && <><WifiOff size={16} aria-hidden="true" /> {t({ fr: 'Trop d’envois d’un coup. Score gardé sur cet appareil : réessayez dans une minute.', en: 'Too many saves at once. Score kept on this device: try again in a minute.' })}</>}
                {send.state === 'error' && send.why === 'offline' && <><WifiOff size={16} aria-hidden="true" /> {t({ fr: 'Classement injoignable. Score gardé sur cet appareil : réessayez, ou il partira tout seul à la prochaine ouverture du jeu.', en: 'The class board cannot be reached. Score kept on this device: try again, or it will be sent by itself next time the game opens.' })}</>}
              </p>
            </form>
            <div className="gf-row">
              <button type="button" className="gf-btn" onClick={shareLink}><Share2 size={16} aria-hidden="true" /> {copied === 'link' ? t({ fr: 'Lien copié', en: 'Link copied' }) : t({ fr: 'Défier un ami sur cette carte', en: 'Challenge a friend on this map' })}</button>
              <button type="button" className="gf-btn" onClick={quit}>{t({ fr: 'Retour au menu', en: 'Back to the menu' })}</button>
            </div>
            {copied.endsWith('-fail') && <p className="gf-simplified">{t({ fr: 'Copie impossible ici : recopiez le texte à la main.', en: 'Copying is not available here: please copy the text by hand.' })}</p>}
            <ClassBoard me={send.state === 'saved' ? name : null} t={t} lang={lang} refreshKey={boardKey}
              fallback={<LocalBoard board={board} seed={result.seed} name={name} highlight={savedId} t={t} />} />
            <Debrief
              source={{ fr: 'César, Guerre des Gaules VII.71 : avant l’achèvement des travaux, Vercingétorix renvoie sa cavalerie de nuit, par les intervalles laissés dans nos lignes.', en: 'Caesar, Gallic War VII.71: before the works were complete, Vercingétorix sent his cavalry away by night through gaps left in our lines.' }}
              simplified={{ fr: 'les cartes sont générées au hasard ; les tours n’avaient pas de « projecteurs » (les faisceaux rendent visible le regard des sentinelles) ; la sortie s’est faite en une seule nuit, pas cinq ; et rien ne dit que des cavaliers attendaient cachés dans les bois.', en: 'the maps are random; towers had no “searchlights” (the beams make the sentries’ gaze visible); the breakout happened in one night, not five; and nothing says riders were waiting hidden in the woods.' }}
            />
          </Card>
        </div>
      )}
    </div>,
    document.body,
  );

  return (
    <GameFrame
      className="pc"
      kicker={{ fr: 'Projet principal · infiltration en vue subjective, 5 nuits', en: 'Main project · first-person stealth, 5 nights' }}
      title={{ fr: 'La Percée', en: 'The Breakout' }}
      status={(
        <button type="button" className="gf-icon" onClick={() => setMuted((m) => !m)} aria-pressed={!muted}
          aria-label={muted ? t({ fr: 'Activer le son', en: 'Sound on' }) : t({ fr: 'Couper le son', en: 'Mute' })}>
          {muted ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
        </button>
      )}
    >
      <div className="pc-home">
        <Card title={{ fr: 'Nuit d’août 52 av. J.-C.', en: 'An August night, 52 BC' }} action={{ fr: 'Partir dans la nuit', en: 'Ride into the night' }} onAction={() => newRun()}>
          <p>{t({ fr: 'Les Romains n’ont pas fini leurs murs. Vercingétorix vous envoie, à cheval, chercher du secours dans toute la Gaule. Sortez d’Alésia, ralliez trois cavaliers cachés dans les bois et franchissez les deux lignes par une brèche avant l’aube, sans vous faire voir.', en: 'The Romans have not finished their walls. Vercingétorix sends you, on horseback, to raise all of Gaul. Leave Alésia, rally three riders hidden in the woods and slip through a gap in both lines before dawn, without being seen.' })}</p>
          <ul className="pc-rules">
            <li><i className="pc-dot is-gold" aria-hidden="true" />{t(POINT_RULE)}</li>
            <li><i className="pc-dot is-rome" aria-hidden="true" />{t({ fr: 'Tours et patrouilles : restez hors de leurs faisceaux. L’œil se remplit peu à peu ; plein, vous êtes pris.', en: 'Towers and patrols: stay out of their beams. The eye fills little by little; when full, you are caught.' })}</li>
            <li><i className="pc-dot is-gaul" aria-hidden="true" />{t({ fr: 'Colonnes vertes : les cavaliers à rallier. Chacun vous apprend quelque chose sur le siège.', en: 'Green columns: riders to rally. Each one tells you something about the siege.' })}</li>
            <li><i className="pc-dot is-gold" aria-hidden="true" />{t({ fr: 'Colonnes dorées : les brèches. Chaque nuit il y en a moins, et l’aube vient plus tôt.', en: 'Gold columns: the gaps. Each night there are fewer, and dawn comes sooner.' })}</li>
            <li><i className="pc-dot is-stone" aria-hidden="true" />{t({ fr: 'Les bois vous cachent, les rivières vous ralentissent, le galop s’entend, les « lis » vous font trébucher. Deux pierres par nuit pour détourner les regards.', en: 'Woods hide you, rivers slow you, a gallop is heard, “lily” pits trip you. Two stones a night to draw eyes away.' })}</li>
          </ul>
          <div className="pc-seed">
            <label htmlFor="pc-seed">{t({ fr: 'Code de la carte', en: 'Map seed' })}</label>
            <input id="pc-seed" value={seed} maxLength={24} onChange={(e) => setSeed(e.target.value.trim() || todaySeed())} spellCheck="false" autoComplete="off" />
            <button type="button" className={`gf-btn${seed === todaySeed() ? ' is-on' : ''}`} onClick={() => setSeed(todaySeed())}>{t({ fr: 'Carte du jour', en: 'Daily map' })}</button>
            <button type="button" className="gf-btn" onClick={() => setSeed(randomSeed())}>{t({ fr: 'Au hasard', en: 'Random' })}</button>
            <button type="button" className="gf-btn" onClick={shareLink}><Share2 size={16} aria-hidden="true" /> {copied === 'link' ? t({ fr: 'Lien copié', en: 'Link copied' }) : t({ fr: 'Partager', en: 'Share' })}</button>
          </div>
          <p className="pc-note">{seed === todaySeed()
            ? t({ fr: 'Carte du jour : la même pour toute la classe.', en: 'Daily map: the same for the whole class.' })
            : t({ fr: 'Carte d’entraînement : une autre carte, même classement.', en: 'Practice map: a different map, same class board.' })}</p>
          <div className="pc-view" role="group" aria-label={t({ fr: 'Vue', en: 'View' })}>
            <button type="button" className={`gf-btn${is3d ? ' is-on' : ''}`} aria-pressed={is3d} onClick={() => { setNo3d(false); setView('3d'); }}>{t({ fr: 'Vue subjective 3D', en: 'First-person 3D' })}</button>
            <button type="button" className={`gf-btn${!is3d ? ' is-on' : ''}`} aria-pressed={!is3d} onClick={() => setView('2d')}>{t({ fr: 'Carte 2D (plus simple)', en: '2D map (simpler)' })}</button>
          </div>
          {no3d && <p className="pc-note">{t({ fr: 'La 3D n’est pas disponible sur cet appareil : la carte 2D est utilisée.', en: '3D is not available on this device: the 2D map is used.' })}</p>}
          <label className="pc-toggle">
            <input type="checkbox" checked={horror} onChange={(e) => setHorror(e.target.checked)} />
            <span>{t({ fr: 'Mode « Effroi » : nuit plus noire, lanterne, grain, chuchotements, cœur qui bat (déconseillé aux plus sensibles)', en: '“Dread” mode: darker night, lantern, grain, whispers, heartbeat (not for the faint-hearted)' })}</span>
          </label>
          {SettingsRow}
          <ClassBoard me={name} t={t} lang={lang} refreshKey={boardKey} paused={active} onScreenHref="?g=percee&board"
            fallback={<LocalBoard board={board} seed={seed} name={name} highlight={null} t={t} />} />
        </Card>
      </div>
      {stage}
    </GameFrame>
  );
}
