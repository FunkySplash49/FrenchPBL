/*
 * La Percée — sound, all synthesised with WebAudio (no files). Quiet by design, and only after a
 * user gesture. One master gain: mute / unmute never rebuilds anything.
 */
export function makeAudio() {
  let ctx = null; let master = null; let muted = false;
  const loops = [];
  const ac = () => {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
    }
    return ctx;
  };
  const safe = (fn) => (...a) => { try { return fn(...a); } catch { return undefined; } };
  const noiseBuf = (len, fn) => {
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate); const d = buf.getChannelData(0);
    fn(d); return buf;
  };
  const tone = (type, f0, f1, t0, dur, peak, attack = 0.02) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
  };
  const loop = (buf, filterType, freq, gain) => {
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(master); src.start();
    loops.push(src);
  };
  return {
    /** call from a click / tap */
    unlock: safe(() => { ac(); if (ctx.state === 'suspended') ctx.resume(); }),
    setMuted: safe((m) => { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.03); }),
    suspend: safe(() => { if (ctx && ctx.state === 'running') ctx.suspend(); }),
    resume: safe(() => { if (ctx && ctx.state === 'suspended') ctx.resume(); }),
    /** night ambience: wind always, rain when it rains. Returns nothing; stop with stopLoops(). */
    ambience: safe((weather, horror) => {
      ac();
      const wind = noiseBuf(2, (d) => { let last = 0; for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; } });
      loop(wind, 'lowpass', 380, horror ? 0.08 : 0.045);
      if (weather === 'rain') {
        const rain = noiseBuf(1.5, (d) => { for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.5; });
        loop(rain, 'highpass', 2600, 0.035);
      }
    }),
    stopLoops: safe(() => { while (loops.length) { try { loops.pop().stop(); } catch { /* already stopped */ } } }),
    beat: safe((k) => { ac(); const t0 = ctx.currentTime; tone('sine', 58, 58, t0, 0.18, 0.12 + k * 0.25); tone('sine', 48, 48, t0 + 0.16, 0.18, 0.12 + k * 0.25); }),
    carnyx: safe(() => {
      ac(); const t0 = ctx.currentTime; const o = ctx.createOscillator(); const f = ctx.createBiquadFilter(); const g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(98, t0); o.frequency.linearRampToValueAtTime(91, t0 + 2.4);
      f.type = 'lowpass'; f.frequency.value = 700;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.6);
      o.connect(f).connect(g).connect(master); o.start(t0); o.stop(t0 + 2.7);
    }),
    whisper: safe((k) => {
      ac(); const buf = noiseBuf(0.5, (d) => { for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((i / d.length) * Math.PI); });
      const src = ctx.createBufferSource(); src.buffer = buf;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400 + Math.random() * 900; bp.Q.value = 5;
      const g = ctx.createGain(); g.gain.value = 0.05 + k * 0.1;
      if (ctx.createStereoPanner) { const pan = ctx.createStereoPanner(); pan.pan.value = Math.random() * 2 - 1; src.connect(bp).connect(g).connect(pan).connect(master); }
      else src.connect(bp).connect(g).connect(master);
      src.start();
    }),
    thunder: safe(() => {
      ac(); const sr = ctx.sampleRate;
      const buf = noiseBuf(2.6, (d) => { let last = 0; for (let i = 0; i < d.length; i++) { last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.04; d[i] = last * 6 * Math.exp(-i / (sr * 0.9)); } });
      const src = ctx.createBufferSource(); src.buffer = buf;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
      const g = ctx.createGain(); g.gain.value = 0.5;
      src.connect(lp).connect(g).connect(master); src.start(ctx.currentTime + 0.25);
    }),
    hoof: safe((gallop, soft) => { ac(); const k = soft ? 0.5 : 1; tone('triangle', gallop ? 150 : 120, 60, ctx.currentTime, 0.08, (gallop ? 0.09 : 0.05) * k, 0.004); }),
    chime: safe(() => { ac(); const t0 = ctx.currentTime; tone('sine', 392, 392, t0, 0.5, 0.1); tone('sine', 523, 523, t0 + 0.12, 0.5, 0.1); }),
    /** a sentry grows suspicious: two low, dry notes */
    cue: safe(() => { ac(); const t0 = ctx.currentTime; tone('square', 196, 196, t0, 0.12, 0.05, 0.005); tone('square', 185, 185, t0 + 0.16, 0.2, 0.05, 0.005); }),
    /** they lost you */
    relief: safe(() => { ac(); tone('sine', 330, 262, ctx.currentTime, 0.4, 0.05); }),
    throwS: safe(() => { ac(); tone('sine', 520, 260, ctx.currentTime, 0.16, 0.03, 0.01); }),
    thud: safe(() => { ac(); const t0 = ctx.currentTime; tone('triangle', 180, 50, t0, 0.14, 0.14, 0.004); tone('triangle', 240, 90, t0 + 0.11, 0.1, 0.06, 0.004); }),
    trap: safe(() => { ac(); tone('sawtooth', 300, 80, ctx.currentTime, 0.25, 0.1, 0.005); }),
    sting: safe(() => { ac(); tone('sawtooth', 220, 70, ctx.currentTime, 0.7, 0.15, 0.01); }),
    fanfare: safe(() => { ac(); const t0 = ctx.currentTime; [262, 330, 392, 523].forEach((f, i) => tone('triangle', f, f, t0 + i * 0.13, 0.5, 0.08)); }),
    close: safe(() => { if (ctx) { ctx.close(); ctx = null; master = null; } }),
  };
}
