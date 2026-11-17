import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Volume2, VolumeX, Share2, Zap, Pause, Play, Eye, EyeOff, Copy, Maximize, RotateCcw, LogOut, ChevronUp, ChevronDown, Circle } from 'lucide-react';
import { GameFrame, Card, Debrief, useT, haptic, usePersist } from '../kit';
import { generate, step, render, createMinimap, throwStone, medalFor, nextGap, angDiff, NIGHTS, TUNE, WORLD } from './percee/engine';
import { createFP } from './percee/fp3d';
import { createInput } from './percee/input';
import { makeAudio } from './percee/audio';
import { loadBoard, saveBoard, addEntry, standings, encodeScore, decodeScore, matchSeed, todaySeed, randomSeed, cleanInitials, fmtTime } from './percee/board';
import { NIGHT_LINES, FACTS, HINTS, MEDALS } from './percee/text';
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

/** three-letter arcade initials: works with a finger (▲ ▼) and with a keyboard (letters, arrows) */
function Initials({ value, onChange, t }) {
  const refs = useRef([]);
  const set = (i, ch) => onChange(value.slice(0, i) + ch + value.slice(i + 1));
  const bump = (i, d) => { haptic('light'); set(i, String.fromCharCode(65 + ((value.charCodeAt(i) - 65 + d + 26) % 26))); };
  const onKey = (i) => (e) => {
    if (/^[a-zA-Z]$/.test(e.key)) { e.preventDefault(); set(i, e.key.toUpperCase()); refs.current[Math.min(2, i + 1)]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); bump(i, 1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); bump(i, -1); }
    else if (e.key === 'ArrowLeft' || e.key === 'Backspace') { e.preventDefault(); refs.current[Math.max(0, i - 1)]?.focus(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); refs.current[Math.min(2, i + 1)]?.focus(); }
  };
  return (
    <div className="pc-ini" role="group" aria-label={t({ fr: 'Vos initiales', en: 'Your initials' })}>
      {[0, 1, 2].map((i) => (
        <div className="pc-ini-slot" key={i}>
          <button type="button" className="pc-ini-btn" onClick={() => bump(i, 1)} aria-label={t({ fr: `Lettre ${i + 1} suivante`, en: `Next letter ${i + 1}` })}><ChevronUp size={20} aria-hidden="true" /></button>
          <span className="pc-ini-letter" tabIndex={0} role="spinbutton" aria-valuetext={value[i]} aria-valuenow={value.charCodeAt(i) - 64} aria-valuemin={1} aria-valuemax={26}
            aria-label={t({ fr: `Lettre ${i + 1}`, en: `Letter ${i + 1}` })} ref={(el) => { refs.current[i] = el; }} onKeyDown={onKey(i)}>{value[i]}</span>
          <button type="button" className="pc-ini-btn" onClick={() => bump(i, -1)} aria-label={t({ fr: `Lettre ${i + 1} précédente`, en: `Previous letter ${i + 1}` })}><ChevronDown size={20} aria-hidden="true" /></button>
        </div>
      ))}
    </div>
  );
}

const golds = (r) => (r.medals || []).filter((m) => m === 3).length;

function Board({ board, seed, ini, highlight, onImport, t }) {
  const daily = todaySeed();
  const [tab, setTab] = useState(seed === daily ? 'daily' : 'map');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState(null);
  const shown = tab === 'daily' ? daily : seed;
  const st = standings(board, shown, { top: 10, id: highlight, ini });
  const submit = (e) => {
    e.preventDefault();
    const r = onImport(code);
    setMsg(r);
    if (r === 'ok') setCode('');
  };
  const row = (r, i) => (
    <li key={r.id} className={r.id === highlight ? 'is-me' : undefined}>
      <span className="pc-rank">{i + 1}</span>
      <span className="pc-who">{r.ini}{golds(r) > 0 && <small className="pc-gold" title={t({ fr: 'Nuits en or', en: 'Gold nights' })}> ★{golds(r)}<span className="pc-sr"> {t({ fr: 'nuits en or', en: 'gold nights' })}</span></small>}{r.src === 'code' && <small> · {t({ fr: 'code', en: 'code' })}</small>}</span>
      <span>{r.nights}/{NIGHTS}</span>
      <span>{r.riders || 0}</span>
      <span>{fmtTime(r.time)}</span>
    </li>
  );
  return (
    <div className="pc-board">
      <div className="pc-tabs" role="tablist" aria-label={t({ fr: 'Classement', en: 'Leaderboard' })}>
        <button type="button" role="tab" aria-selected={tab === 'daily'} className={`pc-tab${tab === 'daily' ? ' is-on' : ''}`} onClick={() => setTab('daily')}>{t({ fr: 'Carte du jour', en: 'Daily map' })}</button>
        {seed !== daily && (
          <button type="button" role="tab" aria-selected={tab === 'map'} className={`pc-tab${tab === 'map' ? ' is-on' : ''}`} onClick={() => setTab('map')}>{t({ fr: 'Entraînement', en: 'Practice' })} · <code>{seed}</code></button>
        )}
      </div>
      {st.rows.length ? (
        <ol className="pc-rows">
          <li className="pc-rows-head" aria-hidden="true"><span>#</span><span>{t({ fr: 'Nom', en: 'Name' })}</span><span>{t({ fr: 'Nuits', en: 'Nights' })}</span><span>{t({ fr: 'Cavaliers', en: 'Riders' })}</span><span>{t({ fr: 'Temps', en: 'Time' })}</span></li>
          {st.rows.map(row)}
          {st.rank >= 10 && <li className="pc-rows-gap" aria-hidden="true">…</li>}
          {st.rank >= 10 && row(st.mine, st.rank)}
        </ol>
      ) : <p className="gf-simplified">{t({ fr: 'Aucun score sur cette carte pour l’instant. Soyez le premier.', en: 'No scores on this map yet. Be the first.' })}</p>}
      {st.best && (
        <p className="pc-best">{t({ fr: 'Votre record', en: 'Your best' })} ({st.best.ini}) : {st.best.nights}/{NIGHTS} {t({ fr: 'nuits', en: 'nights' })}, {st.best.riders || 0} {t({ fr: 'cavaliers', en: 'riders' })}, {fmtTime(st.best.time)} · {t({ fr: 'rang', en: 'rank' })} {st.bestRank + 1}/{st.total}</p>
      )}
      <form className="pc-import" onSubmit={submit}>
        <label htmlFor="pc-code">{t({ fr: 'Ajouter le score d’un camarade (code)', en: 'Add a classmate’s score (code)' })}</label>
        <input id="pc-code" value={code} onChange={(e) => { setCode(e.target.value); setMsg(null); }} placeholder="XXXX-XXXX-XXXX" maxLength={16} spellCheck="false" autoComplete="off" autoCapitalize="characters" />
        <button type="submit" className="gf-btn" disabled={code.replace(/[\s-]/g, '').length < 12}>{t({ fr: 'Ajouter', en: 'Add' })}</button>
        <p className="pc-import-msg" aria-live="polite">
          {msg === 'ok' && t({ fr: 'Score ajouté au classement.', en: 'Score added to the board.' })}
          {msg === 'format' && t({ fr: 'Ce code n’a pas la bonne forme (12 caractères).', en: 'That code does not have the right shape (12 characters).' })}
          {msg === 'check' && t({ fr: 'Code refusé : une lettre est sans doute mal recopiée.', en: 'Code rejected: a character was probably mistyped.' })}
          {msg === 'seed' && t({ fr: 'Ce code vient d’une autre carte que celles affichées ici.', en: 'That code is for a different map than the ones shown here.' })}
        </p>
      </form>
      <p className="pc-note">{t({ fr: 'Le classement est enregistré sur cet appareil. Échangez vos codes pour comparer vos scores.', en: 'The board is stored on this device. Swap codes to compare scores.' })}</p>
    </div>
  );
}

/* ── the game ─────────────────────────────────────────────────── */
export default function Percee() {
  const t = useT();
  const stageRef = useRef(null);
  const surfaceRef = useRef(null);
  const canvasRef = useRef(null);
  const mmRef = useRef(null);
  const worldRef = useRef(null);
  const inputRef = useRef(null);
  const fpRef = useRef(null);
  const audioRef = useRef(null);
  const dom = useRef({});               // HUD nodes written every frame without React
  const run = useRef({ time: 0, riders: 0, medals: [], tries: 0 });
  const tut = useRef({ step: 9, t: 0, moved: 0 });
  const hook = useRef({ until: -1, x: 0, y: 0, gallop: false });
  const dirty = useRef(true);
  const toastTimer = useRef(0);
  const coolTimer = useRef(0);

  const [phase, setPhaseS] = useState('menu');   // menu | play | between | caught | over
  const [mode, setModeS] = useState('ready');    // ready | run | paused   (only meaningful in 'play')
  const phaseRef = useRef('menu'); const modeRef = useRef('ready');
  const setPhase = (p) => { phaseRef.current = p; setPhaseS(p); dirty.current = true; };
  const setMode = (m) => { modeRef.current = m; setModeS(m); dirty.current = true; };

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
  const [iniRaw, setIni] = usePersist('percee-ini', 'AAA');
  const ini = cleanInitials(iniRaw);
  const [board, setBoard] = useState(loadBoard);
  const live = useRef({});
  live.current = { settings, muted, horror, view, kind, cooldown, seed };

  const active = phase !== 'menu';
  // finger or mouse? Decided by the last pointer used, from the very first tap on the menu
  // (a touch monitor with a mouse plugged in switches back and forth freely).
  useEffect(() => {
    const onDown = (e) => setKind(e.pointerType === 'mouse' ? 'mouse' : 'touch');
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, []);
  const audio = () => { if (!audioRef.current) { audioRef.current = makeAudio(); audioRef.current.setMuted(live.current.muted); } return audioRef.current; };
  useEffect(() => { audioRef.current?.setMuted(muted); }, [muted]);
  useEffect(() => () => { audioRef.current?.close(); clearTimeout(toastTimer.current); clearTimeout(coolTimer.current); }, []);

  const say = useCallback((msg, ms = 6500) => {
    setToast(msg); clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }, []);

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
    run.current = { time: 0, riders: 0, medals: [], tries: 0 };
    setResult(null); setSavedId(null); setCopied('');
    startNight(1, s);
  };
  const finishRun = (won) => {
    const r = run.current;
    audioRef.current?.stopLoops();
    setResult({ nights: r.medals.length, riders: r.riders, time: r.time, medals: r.medals.slice(), tries: r.tries, won, seed });
    setPhase('over');
  };
  const quit = () => {
    inputRef.current?.exitLock();
    audioRef.current?.stopLoops();
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    setPhase('menu'); setMode('ready');
  };

  /* ── pause / resume ── */
  const begin = (e) => {
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
      setCooldown(true); clearTimeout(coolTimer.current);
      coolTimer.current = setTimeout(() => setCooldown(false), 1300);
    } else inp?.exitLock();
  };
  const resume = (e) => {
    if (phaseRef.current !== 'play' || modeRef.current !== 'paused' || live.current.cooldown) return;
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
        run.current.time += w.time; run.current.riders += w.rallied; run.current.medals.push(medal);
        inputRef.current?.exitLock(); inputRef.current?.release();
        setNightStats({ time: w.time, riders: w.rallied, medal, clean: w.stats.suspected === 0, traps: w.stats.traps });
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
    let lastBeat = 0; let lastHoof = 0; let nextHorn = 10; let lastWhisper = 0; let compW = 0;

    const inp = createInput({
      surface, canvas, kind: live.current.kind,
      mode: () => (is3d ? '3d' : '2d'),
      settings: () => live.current.settings,
      active: () => modeRef.current === 'run' && phaseRef.current === 'play',
      onKind: (k) => setKind(k === 'pad' ? 'mouse' : k),
      onLock: (locked, expected) => { if (locked) setLockNote(false); else if (!expected) fns.current.pause('lock'); },
      onLockError: () => setLockNote(true),
      onThrow: () => fns.current.doThrow(),
      onEscape: () => {
        if (phaseRef.current !== 'play') return false;
        if (modeRef.current === 'run') fns.current.pause('key');
        else if (modeRef.current === 'paused') fns.current.resume();
        return true;
      },
      onJoy: (on, x, y, dx, dy) => {
        const j = d.joy; if (!j) return;
        j.style.display = on ? 'block' : 'none';
        if (on) { j.style.left = `${x}px`; j.style.top = `${y}px`; d.knob.style.transform = `translate(${dx}px, ${dy}px)`; }
      },
    });
    inputRef.current = inp;

    const resize = () => {
      dirty.current = true;
      compW = d.comp ? d.comp.clientWidth : 0;
      if (fp) { fp.resize(); return; }
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(canvas.clientWidth * dpr); canvas.height = Math.round(canvas.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
        inp.reset(Math.atan2(g.y - w.player.y, g.x - w.player.x));
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
      if (d.fx) d.fx.style.setProperty('--fear', (w.alarm / 100).toFixed(2));
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

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const running = modeRef.current === 'run' && phaseRef.current === 'play' && !document.hidden;
      if (!running && !dirty.current) return;   // paused: nothing is simulated or drawn
      dirty.current = false;
      tick(running ? dt : 0, running, now);
    };
    raf = requestAnimationFrame(frame);

    const onHide = () => { if (document.hidden) fns.current.pause('blur'); };
    const onBlur = () => fns.current.pause('blur');
    const onLost = (e) => { e.preventDefault(); fns.current.pause('blur'); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('blur', onBlur);
    canvas.addEventListener('webglcontextlost', onLost);

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
        teleport(x, y) { const p = worldRef.current.player; p.x = x; p.y = y; p.vx = p.vy = 0; dirty.current = true; },
        setYaw(a) { inp.state.yaw = a; dirty.current = true; }, setPitch(a) { inp.state.pitch = a; dirty.current = true; },
        lookAt(x, y) { const p = worldRef.current.player; inp.state.yaw = Math.atan2(y - p.y, x - p.x); dirty.current = true; },
        /** hold a direction for `secs` of game time: x = right, y = forward (3D) / x = east, y = north (2D) */
        move(x, y, gallop = false, secs = 1) { hook.current = { x, y, gallop, until: worldRef.current.time + secs }; },
        detect(v) { worldRef.current.alarm = v; },
        rally(i = 0) { const w = worldRef.current; const r = w.riders[i]; this.teleport(r.hx, r.hy); },
        gap() { return nextGap(worldRef.current); },
        throwStone() { fns.current.doThrow(); },
        /** escape the night at once */
        finish() { const w = worldRef.current; const g = w.outer.gapPts[0]; const a = Math.atan2(g.y - w.cy, g.x - w.cx); this.teleport(Math.max(12, Math.min(WORLD.w - 12, g.x + Math.cos(a) * 90)), Math.max(12, Math.min(WORLD.h - 12, g.y + Math.sin(a) * 90))); },
        fail(reason = 'seen') { const w = worldRef.current; if (reason === 'dawn') w.time = w.limit; else w.alarm = 100; },
      };
    }

    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('webglcontextlost', onLost);
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
  const saveScore = () => {
    if (!result || savedId) return;
    const id = `r-${Date.now().toString(36)}`;
    const entry = { id, ini, nights: result.nights, riders: result.riders, time: Math.round(result.time), medals: result.medals, at: Date.now(), src: 'local' };
    const b = addEntry(board, result.seed, entry);
    setBoard(b); saveBoard(b); setSavedId(id); haptic('success');
  };
  const importCode = (text) => {
    const r = decodeScore(text);
    if (!r.ok) return r.why;
    const target = matchSeed(r.tag, [seed, todaySeed()]);
    if (!target) return 'seed';
    const b = addEntry(board, target, r.entry);
    setBoard(b); saveBoard(b);
    return 'ok';
  };
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
    const el = stageRef.current;
    try {
      if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen?.()?.catch?.(() => {});
    } catch { /* not supported (iPhone): the stage already fills the viewport */ }
  };

  const touch = kind === 'touch';
  const is3d = view === '3d';
  const hintText = (() => {
    if (!hud.hint) return null;
    const h = HINTS[hud.hint];
    if (h.fr) return t(h);
    if (!is3d && h.d) return t(h.d);
    return t(touch ? h.t : h.m);
  })();
  const statusText = hud.status === 'suspect' ? t({ fr: 'Soupçon !', en: 'Suspected!' })
    : hud.status === 'seen' ? t({ fr: 'On vous voit', en: 'Seen' })
      : hud.town ? t({ fr: 'En sûreté', en: 'Safe' })
        : hud.hidden ? t({ fr: 'Caché', en: 'Hidden' }) : t({ fr: 'Invisible', en: 'Unseen' });
  const code = result && savedId ? encodeScore(result.seed, { ini, nights: result.nights, riders: result.riders, time: result.time, medals: result.medals }) : '';
  const setRef = (k) => (el) => { dom.current[k] = el; };

  const SettingsRow = (
    <div className="pc-settings">
      <label className="pc-range">
        <span>{t({ fr: 'Sensibilité du regard', en: 'Look sensitivity' })}</span>
        <input type="range" min="0.4" max="2.2" step="0.1" value={settings.sens} onChange={(e) => setSettings((s) => ({ ...s, sens: Number(e.target.value) }))} />
        <output>{Number(settings.sens).toFixed(1)}×</output>
      </label>
      <label className="pc-toggle"><input type="checkbox" checked={!!settings.invertY} onChange={(e) => setSettings((s) => ({ ...s, invertY: e.target.checked }))} /><span>{t({ fr: 'Inverser l’axe vertical', en: 'Invert vertical look' })}</span></label>
      <label className="pc-toggle"><input type="checkbox" checked={!muted} onChange={(e) => setMuted(!e.target.checked)} /><span>{t({ fr: 'Son', en: 'Sound' })}</span></label>
    </div>
  );

  const Controls = (
    <ul className="pc-keys">
      {touch ? (
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
    <div className={`pc-stage${horror ? ' is-horror' : ''}`} ref={stageRef} data-input={kind} data-view={view} data-mode={phase === 'play' ? mode : phase}>
      <div className="pc-surface" ref={surfaceRef}>
        <canvas key={view} ref={canvasRef} className="pc-canvas" tabIndex={0} role="application"
          aria-label={t({ fr: 'Vue de nuit : chevauchez hors d’Alésia sans être vu', en: 'Night view: ride out of Alésia unseen' })} />
        <span className="pc-fx" ref={setRef('fx')} aria-hidden="true" />
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
              <button type="button" className="btn-primary" onClick={resume} disabled={cooldown} autoFocus><Play size={18} aria-hidden="true" /> {t({ fr: 'Reprendre', en: 'Resume' })}</button>
              <button type="button" className="gf-btn" onClick={() => { run.current.time += worldRef.current.time; run.current.tries += 1; startNight(night); }}><RotateCcw size={16} aria-hidden="true" /> {t({ fr: 'Recommencer cette nuit', en: 'Restart this night' })}</button>
              <button type="button" className={`gf-btn${confirm === 'new' ? ' is-on' : ''}`} onClick={() => (confirm === 'new' ? newRun() : setConfirm('new'))}>
                {confirm === 'new' ? t({ fr: 'Confirmer : nouvelle partie', en: 'Confirm: new game' }) : t({ fr: 'Nouvelle partie', en: 'New game' })}</button>
              <button type="button" className={`gf-btn${confirm === 'quit' ? ' is-on' : ''}`} onClick={() => (confirm === 'quit' ? quit() : setConfirm('quit'))}><LogOut size={16} aria-hidden="true" />
                {confirm === 'quit' ? t({ fr: 'Confirmer : quitter', en: 'Confirm: quit' }) : t({ fr: 'Quitter le jeu', en: 'Quit the game' })}</button>
            </div>
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
            <p className="gf-simplified">{t({ fr: 'Le temps de cet essai est ajouté à votre total.', en: 'The time of this attempt is added to your total.' })}</p>
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
              <div><dt>{t({ fr: 'Nuits', en: 'Nights' })}</dt><dd>{result.nights}/{NIGHTS}</dd></div>
              <div><dt>{t({ fr: 'Cavaliers', en: 'Riders' })}</dt><dd>{result.riders}</dd></div>
              <div><dt>{t({ fr: 'Temps total', en: 'Total time' })}</dt><dd>{fmtTime(result.time)}</dd></div>
              <div><dt>{t({ fr: 'Essais manqués', en: 'Failed tries' })}</dt><dd>{result.tries}</dd></div>
            </dl>
            {result.medals.length > 0 && (
              <ol className="pc-medals" aria-label={t({ fr: 'Médailles par nuit', en: 'Medals per night' })}>
                {result.medals.map((m, i) => <li key={i}><span>{t({ fr: 'Nuit', en: 'Night' })} {i + 1}</span><Medal level={m} t={t} /></li>)}
              </ol>
            )}
            {!savedId ? (
              <div className="pc-save">
                <p className="pc-label">{t({ fr: 'Vos initiales', en: 'Your initials' })}</p>
                <Initials value={ini} onChange={setIni} t={t} />
                <button type="button" className="gf-btn is-on" onClick={saveScore}>{t({ fr: 'Enregistrer le score', en: 'Save the score' })}</button>
              </div>
            ) : (
              <div className="pc-save">
                <p className="pc-label">{t({ fr: 'Score enregistré. Votre code à partager :', en: 'Score saved. Your code to share:' })}</p>
                <code className="pc-code">{code}</code>
                <button type="button" className="gf-btn" onClick={() => copy('code', code)}><Copy size={16} aria-hidden="true" /> {copied === 'code' ? t({ fr: 'Copié', en: 'Copied' }) : t({ fr: 'Copier le code', en: 'Copy the code' })}</button>
              </div>
            )}
            <div className="gf-row">
              <button type="button" className="gf-btn" onClick={shareLink}><Share2 size={16} aria-hidden="true" /> {copied === 'link' ? t({ fr: 'Lien copié', en: 'Link copied' }) : t({ fr: 'Défier un ami sur cette carte', en: 'Challenge a friend on this map' })}</button>
              <button type="button" className="gf-btn" onClick={quit}>{t({ fr: 'Retour au menu', en: 'Back to the menu' })}</button>
            </div>
            {copied.endsWith('-fail') && <p className="gf-simplified">{t({ fr: 'Copie impossible ici : recopiez le texte à la main.', en: 'Copying is not available here: please copy the text by hand.' })}</p>}
            <Board board={board} seed={result.seed} ini={ini} highlight={savedId} onImport={importCode} t={t} />
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
            ? t({ fr: 'Carte du jour : la même pour toute la classe, avec son classement.', en: 'Daily map: the same for the whole class, with its own board.' })
            : t({ fr: 'Carte d’entraînement : classée à part.', en: 'Practice map: ranked separately.' })}</p>
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
          <Board board={board} seed={seed} ini={ini} highlight={null} onImport={importCode} t={t} />
        </Card>
      </div>
      {stage}
    </GameFrame>
  );
}
