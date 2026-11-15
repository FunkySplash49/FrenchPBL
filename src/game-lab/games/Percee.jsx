import { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Share2, Zap } from 'lucide-react';
import { GameFrame, Card, Debrief, useT, haptic, usePersist } from '../kit';
import { generate, step, render, NIGHTS } from './percee/engine';
import './Percee.css';

/*
 * La Percée — the ultimate prototype.
 * Stealth (Metal Gear / Commandos vision cones) + night dread (Five Nights at Freddy's: darkness,
 * heartbeat, alarm) + seeded procedural worlds (Minecraft seeds) + obstacle hazards (Stumble Guys pits)
 * + 5 nights of rising difficulty + a per-device leaderboard and a shared daily seed.
 */

const todaySeed = () => {
  const d = new Date();
  return `alesia-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
};
const randomSeed = () => Math.random().toString(36).slice(2, 8);
const readUrlSeed = () => new URLSearchParams(window.location.search).get('seed');
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function cssColors(el) {
  const cs = getComputedStyle(el);
  const v = (n) => cs.getPropertyValue(n).trim();
  return {
    ground: v('--ink-800'), speck: 'rgba(205,183,154,0.10)', river: 'rgba(120,140,150,0.35)',
    forest: v('--ink-950'), forestDot: 'rgba(61,38,23,0.9)', plateau: 'rgba(47,107,58,0.30)',
    gaul: v('--gaul-400'), rome: v('--rome-600'), romeLight: v('--rome-400'), wall: v('--rome-400'),
    trap: v('--gold-400'), text: v('--parchment-50'),
    coneIn: 'rgba(245,178,107,0.42)', coneOut: 'rgba(245,178,107,0.0)', night: 'rgba(8,5,3,0.86)',
  };
}

/* WebAudio heartbeat (FNAF-style dread) — quiet, only after a user gesture */
function makeAudio() {
  let ctx = null;
  return {
    beat(intensity) {
      try {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        const t0 = ctx.currentTime;
        [0, 0.16].forEach((off, i) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.type = 'sine'; o.frequency.value = i ? 48 : 58;
          g.gain.setValueAtTime(0.0001, t0 + off);
          g.gain.exponentialRampToValueAtTime(0.12 + intensity * 0.25, t0 + off + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + 0.18);
          o.connect(g).connect(ctx.destination); o.start(t0 + off); o.stop(t0 + off + 0.2);
        });
      } catch { /* no audio */ }
    },
    ambient() {
      try {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const d = buf.getChannelData(0); let last = 0;
        for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
        const g = ctx.createGain(); g.gain.value = 0.07;
        const lfo = ctx.createOscillator(); const lg = ctx.createGain(); lfo.frequency.value = 0.08; lg.gain.value = 0.04;
        lfo.connect(lg).connect(g.gain); src.connect(lp).connect(g).connect(ctx.destination);
        src.start(); lfo.start();
        return () => { try { src.stop(); lfo.stop(); } catch { /* already stopped */ } };
      } catch { return () => {}; }
    },
    carnyx() {
      try {
        const t0 = ctx.currentTime; const o = ctx.createOscillator(); const f = ctx.createBiquadFilter(); const g = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(98, t0); o.frequency.linearRampToValueAtTime(91, t0 + 2.4);
        f.type = 'lowpass'; f.frequency.value = 700;
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.6);
        o.connect(f).connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + 2.7);
      } catch { /* no audio */ }
    },
    whisper(k) {
      try {
        const t0 = ctx.currentTime; const len = 0.5;
        const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate); const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((i / d.length) * Math.PI);
        const src = ctx.createBufferSource(); src.buffer = buf;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400 + Math.random() * 900; bp.Q.value = 5;
        const g = ctx.createGain(); g.gain.value = 0.05 + k * 0.1;
        const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        if (pan) { pan.pan.value = Math.random() * 2 - 1; src.connect(bp).connect(g).connect(pan).connect(ctx.destination); }
        else src.connect(bp).connect(g).connect(ctx.destination);
        src.start(t0);
      } catch { /* no audio */ }
    },
    sting() {
      try {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        const t0 = ctx.currentTime; const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(220, t0); o.frequency.exponentialRampToValueAtTime(70, t0 + 0.6);
        g.gain.setValueAtTime(0.15, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7);
        o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + 0.7);
      } catch { /* no audio */ }
    },
  };
}

export default function Percee() {
  const t = useT();
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const worldRef = useRef(null);
  const input = useRef({ x: 0, y: 0, sprint: false });
  const keys = useRef({});
  const joy = useRef(null);
  const audio = useRef(null);
  const lastBeat = useRef(0);
  const totalRef = useRef(0);
  const nextHorn = useRef(8);
  const lastWhisper = useRef(0);

  const [phase, setPhase] = useState('menu'); // menu | play | between | over
  const [seed, setSeed] = useState(() => readUrlSeed() || todaySeed());
  const [night, setNight] = useState(1);
  const [hud, setHud] = useState({ alarm: 0, stam: 100, time: 0, seen: false });
  const [totalTime, setTotalTime] = useState(0);
  const [result, setResult] = useState(null); // { nights, time, won }
  const [muted, setMuted] = usePersist('percee-muted', false);
  const [board, setBoard] = usePersist('percee-board', {});
  const [name, setName] = usePersist('percee-name', '');
  const [saved, setSaved] = useState(false);
  const [joyVis, setJoyVis] = useState(null);
  const [horror, setHorror] = usePersist('percee-horror', true);
  const [intro, setIntro] = useState(false);

  const startNight = useCallback((n) => {
    worldRef.current = generate(seed, n);
    setNight(n);
    setPhase('play');
    setIntro(true);
    haptic('tick');
  }, [seed]);

  const newRun = () => { totalRef.current = 0; setTotalTime(0); setResult(null); setSaved(false); startNight(1); };

  // ── game loop ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'play') return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const colors = cssColors(wrapRef.current);
    let raf = 0; let last = performance.now(); let visible = true;
    if (!audio.current) audio.current = makeAudio();
    const stopAmbient = horror && !muted ? audio.current.ambient() : () => {};
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(canvas);

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth; const h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!visible || document.hidden) return;
      const w = worldRef.current;
      // keyboard → input (joystick overrides when active)
      if (!joy.current) {
        const k = keys.current;
        input.current.x = (k.ArrowRight || k.d || k.D ? 1 : 0) - (k.ArrowLeft || k.a || k.A || k.q || k.Q ? 1 : 0);
        input.current.y = (k.ArrowDown || k.s || k.S ? 1 : 0) - (k.ArrowUp || k.w || k.W || k.z || k.Z ? 1 : 0);
        input.current.sprint = !!k.Shift || input.current.sprintBtn;
      }
      const events = step(w, input.current, dt);
      const cw = canvas.clientWidth; const ch = canvas.clientHeight;
      render(ctx, w, { width: cw, height: ch, scale: Math.max(cw / 720, ch / 520) }, colors, { horror, still });
      if (horror && !muted) {
        if (w.time > nextHorn.current) { audio.current.carnyx(); nextHorn.current = w.time + 22 + Math.random() * 20; }
        if (w.nearest < 150 && now / 1000 - lastWhisper.current > 1.1 + Math.random()) {
          lastWhisper.current = now / 1000; audio.current.whisper(1 - w.nearest / 150);
        }
      }

      // heartbeat speeds up with the alarm
      if (!muted && w.alarm > 25) {
        const interval = 1.1 - (w.alarm / 100) * 0.75;
        if (now / 1000 - lastBeat.current > interval) { lastBeat.current = now / 1000; audio.current.beat(w.alarm / 100); }
      }
      for (const e of events) {
        if (e.type === 'trap') haptic('miss');
        if (e.type === 'caught') {
          if (!muted) audio.current.sting();
          haptic('miss');
          totalRef.current += w.time;
          setTotalTime(totalRef.current);
          setResult({ nights: w.night - 1, time: totalRef.current, won: false });
          setPhase('over');
        }
        if (e.type === 'escaped') {
          haptic('success');
          totalRef.current += w.time;
          setTotalTime(totalRef.current);
          if (w.night >= NIGHTS) { setResult({ nights: NIGHTS, time: totalRef.current, won: true }); setPhase('over'); }
          else setPhase('between');
        }
      }
      setHud((h) => {
        const n = { alarm: w.alarm, stam: w.player.stam, time: w.time, seen: w.seen > 0 };
        return Math.abs(h.alarm - n.alarm) > 0.5 || Math.abs(h.stam - n.stam) > 1 || Math.floor(h.time) !== Math.floor(n.time) || h.seen !== n.seen ? n : h;
      });
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); stopAmbient(); };
  }, [phase, muted, horror]);

  // ── keyboard (only while the game area has focus; never leaks to the story's step keys) ──
  const onKeyDown = (e) => {
    if (phase !== 'play') return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Shift'].includes(e.key) || /^[wasdzqWASDZQ]$/.test(e.key)) {
      e.preventDefault(); e.stopPropagation();
    }
    keys.current[e.key] = true;
  };
  const onKeyUp = (e) => { keys.current[e.key] = false; };

  // ── touch joystick: press anywhere on the canvas, drag to steer ──
  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    canvasRef.current.focus({ preventScroll: true });
    if (e.pointerType === 'mouse') return; // mouse users steer with the keyboard
    e.currentTarget.setPointerCapture?.(e.pointerId);
    joy.current = { x: e.clientX, y: e.clientY };
    setJoyVis({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, dx: 0, dy: 0 });
  };
  const onPointerMove = (e) => {
    if (!joy.current) return;
    const dx = e.clientX - joy.current.x; const dy = e.clientY - joy.current.y;
    const r = 50;
    input.current.x = Math.max(-1, Math.min(1, dx / r));
    input.current.y = Math.max(-1, Math.min(1, dy / r));
    input.current.sprint = !!input.current.sprintBtn;
    setJoyVis((j) => j && { ...j, dx: Math.max(-r, Math.min(r, dx)), dy: Math.max(-r, Math.min(r, dy)) });
  };
  const onPointerUp = () => { joy.current = null; input.current.x = 0; input.current.y = 0; setJoyVis(null); };

  // ── leaderboard (per device, per seed) ──
  const rows = (board[seed] || []).slice().sort((a, b) => b.nights - a.nights || a.time - b.time).slice(0, 8);
  const saveScore = () => {
    const entry = { name: (name || 'Anonyme').slice(0, 14), nights: result.nights, time: Math.round(result.time), at: Date.now() };
    setBoard((b) => ({ ...b, [seed]: [...(b[seed] || []), entry] }));
    setSaved(true); haptic('success');
  };
  const shareSeed = async () => {
    const url = new URL(window.location.href); url.searchParams.set('seed', seed);
    try {
      if (navigator.share) await navigator.share({ title: 'La Percée — Alésia', url: url.toString() });
      else { await navigator.clipboard.writeText(url.toString()); }
      haptic('light');
    } catch { /* cancelled */ }
  };

  const Board = () => (
    <div className="pc-board">
      <p className="pc-board-title">{t({ fr: 'Classement de cet appareil', en: 'This device’s leaderboard' })} · <code>{seed}</code></p>
      {rows.length ? (
        <ol>
          {rows.map((r, i) => (
            <li key={r.at}><span>{i + 1}. {r.name}</span><span>{r.nights}/{NIGHTS} {t({ fr: 'nuits', en: 'nights' })} · {fmt(r.time)}</span></li>
          ))}
        </ol>
      ) : <p className="gf-simplified">{t({ fr: 'Aucun score pour ce code. Soyez le premier.', en: 'No scores for this seed yet. Be the first.' })}</p>}
    </div>
  );

  return (
    <GameFrame
      className="pc"
      kicker={{ fr: 'Projet principal · infiltration, 5 nuits', en: 'Main project · stealth, 5 nights' }}
      title={{ fr: 'La Percée', en: 'The Breakout' }}
      status={(
        <>
          {phase !== 'menu' && <span className="gf-pill">{t({ fr: 'Nuit', en: 'Night' })} {night}/{NIGHTS}</span>}
          <button type="button" className="gf-icon" onClick={() => setMuted((m) => !m)} aria-pressed={!muted}
            aria-label={muted ? t({ fr: 'Activer le son', en: 'Sound on' }) : t({ fr: 'Couper le son', en: 'Mute' })}>
            {muted ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
          </button>
        </>
      )}
      onRestart={phase === 'menu' ? undefined : newRun}
    >
      <div className="pc-stage" ref={wrapRef}>
        {phase === 'menu' && (
          <Card title={{ fr: 'Nuit d’août 52 av. J.-C.', en: 'An August night, 52 BC' }} action={{ fr: 'Partir dans la nuit', en: 'Ride into the night' }} onAction={newRun}>
            <p>{t({ fr: 'Les Romains n’ont pas fini leurs murs. Vercingétorix t’envoie, cavalier, chercher du secours dans toute la Gaule. Sors d’Alésia, franchis les deux lignes par une brèche, sans te faire voir.', en: 'The Romans have not finished their walls. Vercingétorix sends you, a rider, to raise all of Gaul. Leave Alésia and slip through a gap in both lines without being seen.' })}</p>
            <ul className="pc-rules">
              <li>{t({ fr: '■ Tours et patrouilles romaines : évitez leurs cônes de lumière.', en: '■ Roman towers and patrols: stay out of their torchlight.' })}</li>
              <li>{t({ fr: '⌇ Pièges cachés (« lis ») entre les lignes : ils vous immobilisent.', en: '⌇ Hidden traps (“lilies”) between the lines will stop you.' })}</li>
              <li>{t({ fr: 'Les forêts vous cachent, les rivières vous ralentissent, le galop fait du bruit.', en: 'Forests hide you, rivers slow you, galloping is loud.' })}</li>
              <li>{t({ fr: 'Clavier : flèches / ZQSD / WASD, Maj = galop. Tactile : glissez le doigt, bouton galop.', en: 'Keyboard: arrows / WASD, Shift = gallop. Touch: drag your finger, gallop button.' })}</li>
            </ul>
            <div className="pc-seed">
              <label htmlFor="pc-seed">{t({ fr: 'Code de la carte', en: 'Map seed' })}</label>
              <input id="pc-seed" value={seed} maxLength={24} onChange={(e) => setSeed(e.target.value.trim() || todaySeed())} spellCheck="false" autoComplete="off" />
              <button type="button" className="gf-btn" onClick={() => setSeed(todaySeed())}>{t({ fr: 'Carte du jour', en: 'Daily map' })}</button>
              <button type="button" className="gf-btn" onClick={() => setSeed(randomSeed())}>{t({ fr: 'Au hasard', en: 'Random' })}</button>
            </div>
            <label className="pc-toggle">
              <input type="checkbox" checked={horror} onChange={(e) => setHorror(e.target.checked)} />
              <span>{t({ fr: 'Mode « Effroi » : lanterne, grain, chuchotements, cœur qui bat (déconseillé aux plus sensibles)', en: '“Dread” mode: lantern, grain, whispers, heartbeat (not for the faint-hearted)' })}</span>
            </label>
            <Board />
          </Card>
        )}

        {phase !== 'menu' && (
          <div className="pc-play">
            <div className="pc-hud" aria-live="off">
              <div className={`pc-alarm${hud.seen ? ' is-seen' : ''}`}>
                <span>{t({ fr: 'Alerte', en: 'Alarm' })}</span>
                <span className="pc-bar"><span style={{ transform: `scaleX(${hud.alarm / 100})` }} /></span>
              </div>
              <div className="pc-stam">
                <span>{t({ fr: 'Souffle', en: 'Stamina' })}</span>
                <span className="pc-bar"><span style={{ transform: `scaleX(${hud.stam / 100})` }} /></span>
              </div>
              <span className="pc-time">{fmt(totalTime + (phase === 'play' ? hud.time : 0))}</span>
            </div>
            <div className="pc-canvas-wrap">
              <canvas
                ref={canvasRef}
                className="pc-canvas"
                tabIndex={0}
                role="application"
                aria-label={t({ fr: 'Carte de nuit : déplacez le cavalier avec les flèches', en: 'Night map: move the rider with the arrow keys' })}
                onKeyDown={onKeyDown}
                onKeyUp={onKeyUp}
                onBlur={() => { keys.current = {}; }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              />
              {joyVis && (
                <span className="pc-joy" style={{ left: joyVis.x, top: joyVis.y }} aria-hidden="true">
                  <span className="pc-joy-knob" style={{ transform: `translate(${joyVis.dx}px, ${joyVis.dy}px)` }} />
                </span>
              )}
              {phase === 'play' && (
                <button
                  type="button"
                  className="pc-gallop"
                  onPointerDown={() => { input.current.sprintBtn = true; input.current.sprint = true; haptic('light'); }}
                  onPointerUp={() => { input.current.sprintBtn = false; input.current.sprint = false; }}
                  onPointerLeave={() => { input.current.sprintBtn = false; input.current.sprint = false; }}
                  aria-label={t({ fr: 'Galop (maintenir)', en: 'Gallop (hold)' })}
                >
                  <Zap size={20} aria-hidden="true" />
                </button>
              )}
              {phase === 'play' && intro && (
                <button type="button" className={`pc-intro${horror ? ' is-horror' : ''}`} onClick={() => setIntro(false)}
                  onAnimationEnd={(e) => { if (e.animationName === 'pc-intro-out') setIntro(false); }}>
                  <span className="pc-intro-line" style={{ animationDelay: '0.2s' }}>{t({ fr: `Nuit ${night}. Août 52 av. J.-C.`, en: `Night ${night}. August 52 BC.` })}</span>
                  <span className="pc-intro-line" style={{ animationDelay: '1.1s' }}>{t([
                    { fr: 'Les murs ne sont pas finis.', en: 'The walls are not finished.' },
                    { fr: 'Ils ont bouché la brèche du nord.', en: 'They have closed the northern gap.' },
                    { fr: 'Les tours sont plus nombreuses.', en: 'There are more towers now.' },
                    { fr: 'On entend creuser, même la nuit.', en: 'You can hear digging, even at night.' },
                    { fr: 'Dernière brèche. Dernière chance.', en: 'Last gap. Last chance.' },
                  ][night - 1])}</span>
                  <span className="pc-intro-line" style={{ animationDelay: '2.1s' }}>{t({ fr: 'Ne fais pas de bruit.', en: 'Make no sound.' })}</span>
                  <span className="pc-intro-skip">{t({ fr: 'toucher pour commencer', en: 'tap to begin' })}</span>
                </button>
              )}
              {phase === 'between' && (
                <div className="pc-overlay">
                  <Card tone="is-win" title={{ fr: `Nuit ${night} : passé !`, en: `Night ${night}: through!` }}
                    action={{ fr: `Nuit ${night + 1}`, en: `Night ${night + 1}` }} onAction={() => startNight(night + 1)}>
                    <p>{t({ fr: 'Chaque jour, les Romains bouchent des brèches et ajoutent des tours. La nuit suivante sera plus dure.', en: 'Every day the Romans close gaps and add towers. The next night will be harder.' })}</p>
                  </Card>
                </div>
              )}
              {phase === 'over' && result && (
                <div className="pc-overlay">
                  <Card tone={result.won ? 'is-win' : ''}
                    title={result.won ? { fr: 'Le secours est en route', en: 'Help is on its way' } : { fr: 'Repéré', en: 'Spotted' }}
                    action={{ fr: 'Rejouer', en: 'Play again' }} onAction={newRun}>
                    <p>{result.won
                      ? t({ fr: `Cinq nuits, cinq percées, en ${fmt(result.time)}. Historiquement, la cavalerie gauloise a bien franchi les lignes avant qu’elles ne se ferment… et l’armée de secours est venue.`, en: `Five nights, five breakouts, in ${fmt(result.time)}. Historically the Gallic cavalry did slip out before the lines closed… and the relief army came.` })
                      : t({ fr: `Les sentinelles t’ont vu. Nuits réussies : ${result.nights}/${NIGHTS}.`, en: `The sentries saw you. Nights survived: ${result.nights}/${NIGHTS}.` })}</p>
                    {!saved ? (
                      <div className="pc-save">
                        <label htmlFor="pc-name">{t({ fr: 'Ton nom', en: 'Your name' })}</label>
                        <input id="pc-name" value={name} maxLength={14} onChange={(e) => setName(e.target.value)} autoComplete="nickname" />
                        <button type="button" className="gf-btn" onClick={saveScore}>{t({ fr: 'Enregistrer', en: 'Save' })}</button>
                      </div>
                    ) : <p className="gf-simplified">{t({ fr: 'Score enregistré.', en: 'Score saved.' })}</p>}
                    <div className="gf-row">
                      <button type="button" className="gf-btn" onClick={shareSeed}><Share2 size={16} aria-hidden="true" /> {t({ fr: 'Défier un ami sur cette carte', en: 'Challenge a friend on this map' })}</button>
                    </div>
                    <Board />
                    <Debrief
                      source={{ fr: 'César, *Guerre des Gaules* VII.71 : avant l’achèvement des travaux, Vercingétorix renvoie sa cavalerie de nuit, par les intervalles laissés dans nos lignes.', en: 'Caesar, *Gallic War* VII.71: before the works were complete, Vercingétorix sent his cavalry away by night through gaps left in our lines.' }}
                      simplified={{ fr: 'les cartes sont générées au hasard, les tours n’avaient pas de « projecteurs », et la sortie s’est faite en une seule nuit, pas cinq.', en: 'the maps are random, towers had no “searchlights”, and the breakout happened in one night, not five.' }}
                    />
                  </Card>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </GameFrame>
  );
}
