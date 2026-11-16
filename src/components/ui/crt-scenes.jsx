import { useEffect, useRef } from 'react';

/*
 * CrtScenes — full-screen story scenes (19th-century history paintings) seen through a
 * glowing old CRT, in WebGL1. Modelled on the 21st.dev ASCII-editor clip the team liked
 * (painted scene, saturated colour, highlights that bloom, soft tube, scanlines) — but
 * live, so the scene can follow the story.
 *
 * Look (three small passes + one full-screen pass):
 *   1. bright pass  — the graded picture, highlights only, at 1/4 resolution
 *   2. two blurs    — a tight one (bloom) and a wide one (halation)
 *   3. final        — picture (3 taps: lens softness + red/blue bleed) + bloom + halation,
 *                     then phosphor scanlines, aperture grille, rolling bar, grain.
 *
 * Switch: changing `index` dissolves to the next scene pixel by pixel, in random order,
 * with a thin band of sparkling static on the pixels that are mid-flip. The target is
 * debounced (fast scrolling across several steps = one switch), going back mid-switch
 * simply reverses it, and a new target mid-switch finishes the current one fast and
 * chains. A scene is never shown before its texture is ready (no black frames).
 *
 * Budget: the drawing buffer is capped (maxPixels) and CSS-upscaled — a 4K panel draws
 * ~2 MP (1.5 MP on touch hardware). The size is fixed — never changed live, because a
 * re-allocated buffer makes the picture visibly snap. 30 fps on touch hardware,
 * paused when the tab is hidden, small height-only resizes ignored (mobile address bar).
 * Reduced motion: plain crossfade, no drift / grain / roll, and no redraw while idle.
 * No WebGL (or context lost) → the scene as a dimmed CSS background.
 */
const VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';

const COMMON = `
precision mediump float;
uniform sampler2D uA;
uniform sampler2D uB;
uniform vec4 uFitA;   // image w, h, focus x, focus y
uniform vec4 uFitB;
uniform float uAspect; // screen w / h
uniform float uTime;
uniform float uMotion; // 0 with reduced motion
uniform float uExpA;
uniform float uExpB;
uniform float uDriftA; // drift phase belongs to the picture, not the slot,
uniform float uDriftB; // so nothing jumps when B becomes A after a switch
const vec3 LUM = vec3(0.299, 0.587, 0.114);

// "cover" fit around the picture's focus point + a slow drift (Ken Burns)
vec2 cover(vec2 uv, vec4 fit, float seed) {
  float ia = fit.x / fit.y;
  vec2 s = uAspect > ia ? vec2(1.0, ia / uAspect) : vec2(uAspect / ia, 1.0);
  float z = 1.07 + 0.025 * sin(uTime * 0.05 + seed) * uMotion;
  s /= z;
  vec2 room = (1.0 - s) * 0.5; // how far the window can move inside the picture
  vec2 c = 0.5 + clamp(fit.zw - 0.5, -room * 0.8, room * 0.8);
  vec2 drift = vec2(sin(uTime * 0.031 + seed), cos(uTime * 0.027 + seed * 2.0)) * min(room, vec2(0.012)) * uMotion;
  return (uv - 0.5) * s + c + drift;
}

// colour: richer, more contrast in the lit parts, cool shadows / warm (ember-gold) lights
vec3 grade(vec3 c, float expo) {
  float l = dot(c, LUM);
  c = max(mix(vec3(l), c, 1.4), 0.0);
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.65);
  l = dot(c, LUM);
  c *= mix(vec3(0.72, 0.92, 1.22), vec3(1.22, 0.98, 0.72), smoothstep(0.08, 0.62, l));
  return c * expo;
}
`;

// 1/4-res: graded picture, highlights only (soft knee) — source of bloom and halation
const FRAG_BRIGHT = `${COMMON}
uniform vec2 uRes;
uniform float uMix;
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  uv.y = 1.0 - uv.y;
  vec3 a = grade(texture2D(uA, cover(uv, uFitA, uDriftA)).rgb, uExpA);
  vec3 b = grade(texture2D(uB, cover(uv, uFitB, uDriftB)).rgb, uExpB);
  vec3 c = mix(a, b, uMix);
  float l = dot(c, LUM);
  gl_FragColor = vec4(c * (0.10 + 0.90 * smoothstep(0.22, 0.75, l)), 1.0);
}`;

const FRAG_BLUR = `
precision mediump float;
uniform sampler2D uTex;
uniform vec2 uDir; // one texel step along the blur axis
uniform vec2 uInv; // 1 / target size
void main() {
  vec2 uv = gl_FragCoord.xy * uInv;
  vec3 c = texture2D(uTex, uv).rgb * 0.2270;
  c += (texture2D(uTex, uv + uDir * 1.3846).rgb + texture2D(uTex, uv - uDir * 1.3846).rgb) * 0.3162;
  c += (texture2D(uTex, uv + uDir * 3.2308).rgb + texture2D(uTex, uv - uDir * 3.2308).rgb) * 0.0703;
  gl_FragColor = vec4(c, 1.0);
}`;

const FRAG_FINAL = `${COMMON}
uniform vec2 uRes;
uniform sampler2D uNoise;  // 256² random bytes
uniform sampler2D uBloom;  // tight blur of the highlights
uniform sampler2D uHalo;   // wide blur of the highlights
uniform float uMix;        // 0 → A, 1 → B
uniform vec2 uSeed;        // new random offset ~24×/s (static, grain)
uniform float uFade;       // first appearance
uniform float uLine;       // scanline period, buffer px

vec3 tube(sampler2D t, vec2 uv) {
  // lens softness + chromatic bleed: red leans left, blue leans right
  vec2 d = vec2(1.6 / uRes.x, 0.0);
  vec3 l = texture2D(t, uv - d).rgb;
  vec3 c = texture2D(t, uv).rgb;
  vec3 r = texture2D(t, uv + d).rgb;
  return vec3(0.62 * l.r + 0.38 * c.r, 0.22 * l.g + 0.56 * c.g + 0.22 * r.g, 0.62 * r.b + 0.38 * c.b);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 suv = frag / uRes;
  vec2 uv = vec2(suv.x, 1.0 - suv.y);

  vec4 rnd = texture2D(uNoise, (floor(frag) + 0.5) / 256.0);
  vec4 live = texture2D(uNoise, (floor(frag) + 0.5) / 256.0 + uSeed);

  vec3 col;
  float spark = 0.0;
  if (uMix <= 0.0) {
    col = grade(tube(uA, cover(uv, uFitA, uDriftA)), uExpA);
  } else if (uMotion < 0.5) {
    col = mix(grade(tube(uA, cover(uv, uFitA, uDriftA)), uExpA), grade(tube(uB, cover(uv, uFitB, uDriftB)), uExpB), uMix);
  } else {
    // every pixel has its own moment to flip (random, with a slight top-to-bottom lean)
    float h = (rnd.r + rnd.g / 256.0) * 0.86 + uv.y * 0.14;
    const float band = 0.07;
    float edge = uMix * (1.0 + band);
    if (h > edge) {
      col = grade(tube(uA, cover(uv, uFitA, uDriftA)), uExpA);
    } else {
      col = grade(tube(uB, cover(uv, uFitB, uDriftB)), uExpB);
      // just flipped: sparkling static that dies out
      if (h > edge - band) spark = step(0.45, live.b) * (1.0 - (edge - h) / band);
    }
  }

  // glow: bloom keeps the colour of the light, halation spreads wider and warmer
  vec3 bloom = texture2D(uBloom, suv).rgb;
  vec3 halo = texture2D(uHalo, suv).rgb;
  col += bloom * 0.55 + halo * vec3(0.80, 0.52, 0.34);
  col += spark * vec3(1.0, 0.86, 0.62) * 0.75;

  // phosphor scanlines: dark gaps between lines, thinner where the picture is bright
  float l = clamp(dot(col, LUM), 0.0, 1.0);
  float scan = 0.5 + 0.5 * cos(frag.y * 6.28318 / uLine);
  col *= 1.0 - (0.34 - 0.20 * l) * (1.0 - scan);
  col *= 1.10;
  // aperture grille (RGB stripes)
  float m = mod(floor(frag.x), 3.0);
  col *= vec3(m < 0.5 ? 1.07 : 0.965, (m > 0.5 && m < 1.5) ? 1.07 : 0.965, m > 1.5 ? 1.07 : 0.965);
  // slow rolling bar + grain
  float bar = fract(uTime * 0.06);
  col *= 1.0 + 0.06 * smoothstep(0.09, 0.0, abs(uv.y - bar)) * uMotion;
  col += (live.a - 0.5) * 0.05 * uMotion;

  // tube vignette; the very top stays calmer for the top bar
  vec2 v = suv - 0.5;
  col *= 1.0 - dot(v, v) * 0.85;
  col *= mix(0.72, 1.0, smoothstep(0.0, 0.22, uv.y));

  // soft shoulder so the glow rolls off instead of clipping
  col = 1.0 - exp(-col * 1.25);
  gl_FragColor = vec4(col * uFade, 1.0);
}`;

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

const srcOf = (s) => (typeof s === 'string' ? s : s.src);

/**
 * scenes: [{ src, focus?: [x, y] (0–1, what to keep in view when cropped), exposure? }] or [src]
 */
export function CrtScenes({ scenes, index = 0, switchMs = 1000, settleMs = 140, maxPixels = 2.2e6, className = '' }) {
  const ref = useRef(null);
  const want = useRef(index);
  want.current = Math.max(0, Math.min(scenes.length - 1, index));

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    let stopFallback = null;
    const fallback = () => {
      canvas.classList.add('is-fallback');
      const paint = () => { canvas.style.backgroundImage = `url("${srcOf(scenes[want.current])}")`; };
      paint();
      const t = setInterval(paint, 400);
      stopFallback = () => clearInterval(t);
    };
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' });
    if (!gl || gl.isContextLost()) { fallback(); return () => stopFallback?.(); }

    const sh = (kind, src) => {
      const s = gl.createShader(kind); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const program = (frag, names) => {
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(p, sh(gl.FRAGMENT_SHADER, frag));
      gl.bindAttribLocation(p, 0, 'p');
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      return { p, u: Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(p, n)])) };
    };
    const shared = ['uA', 'uB', 'uFitA', 'uFitB', 'uAspect', 'uTime', 'uMotion', 'uExpA', 'uExpB', 'uDriftA', 'uDriftB', 'uRes', 'uMix'];
    let bright; let blur; let final;
    try {
      bright = program(FRAG_BRIGHT, shared);
      blur = program(FRAG_BLUR, ['uTex', 'uDir', 'uInv']);
      final = program(FRAG_FINAL, [...shared, 'uNoise', 'uBloom', 'uHalo', 'uSeed', 'uFade', 'uLine']);
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[crt] falling back:', err);
      fallback();
      return () => stopFallback?.();
    }
    canvas.classList.remove('is-fallback');

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const mkTex = (filter, wrap) => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      return t;
    };

    // random bytes: per-pixel flip order, static and grain (no sin() hashes — they band on phones)
    const noise = mkTex(gl.NEAREST, gl.REPEAT);
    const bytes = new Uint8Array(256 * 256 * 4);
    for (let i = 0; i < bytes.length; i += 65536) crypto.getRandomValues(bytes.subarray(i, i + 65536));
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);

    const blank = mkTex(gl.LINEAR, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([18, 10, 6, 255]));

    // small render targets for the glow
    const targets = [0, 1, 2].map(() => ({ t: mkTex(gl.LINEAR, gl.CLAMP_TO_EDGE), f: gl.createFramebuffer(), w: 0, h: 0 }));
    const sizeTargets = (w, h) => {
      for (const g of targets) {
        if (g.w === w && g.h === h) continue;
        g.w = w; g.h = h;
        gl.bindTexture(gl.TEXTURE_2D, g.t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, g.f);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, g.t, 0);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    };

    // scene textures: uploaded on demand, a handful kept on the GPU (TV / phone memory)
    const KEEP = coarse ? 5 : 7;
    const maxTex = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048, coarse ? 1600 : 2048);
    const tex = new Map(); // i -> { t, w, h }
    const loading = new Set();
    let dead = false;
    let a = want.current; let b = a; // shown scene, scene being switched to
    const ensure = (i) => {
      if (i < 0 || i >= scenes.length || tex.has(i) || loading.has(i)) return;
      loading.add(i);
      loadImage(srcOf(scenes[i])).then((img) => {
        if (dead || gl.isContextLost()) return;
        let source = img; const w = img.naturalWidth; const h = img.naturalHeight;
        const k = Math.min(1, maxTex / Math.max(w, h));
        if (k < 1) {
          source = document.createElement('canvas');
          source.width = Math.round(w * k); source.height = Math.round(h * k);
          source.getContext('2d').drawImage(img, 0, 0, source.width, source.height);
        }
        const t = mkTex(gl.LINEAR, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source);
        tex.set(i, { t, w, h });
        if (tex.size > KEEP) {
          const far = [...tex.keys()].filter((j) => j !== a && j !== b && j !== want.current)
            .sort((x, y) => Math.abs(y - want.current) - Math.abs(x - want.current))[0];
          if (far != null && Math.abs(far - want.current) > 1) { gl.deleteTexture(tex.get(far).t); tex.delete(far); }
        }
        dirty = true;
      }).catch(() => {}).finally(() => loading.delete(i));
    };
    // warm the browser cache with every scene once the first one is on screen
    let warmed = false;
    const warm = () => {
      if (warmed) return; warmed = true;
      let i = 0;
      const next = () => {
        if (dead || i >= scenes.length) return;
        const img = new Image();
        img.onload = img.onerror = () => setTimeout(next, 60);
        img.src = srcOf(scenes[i++]);
      };
      setTimeout(next, 400);
    };

    // drawing buffer: capped once (CSS-upscaled), never changed live
    const cap = coarse ? Math.min(maxPixels, 1.5e6) : maxPixels;
    let dirty = true;
    const resize = (force) => {
      const cw = canvas.clientWidth; const ch = canvas.clientHeight;
      if (!cw || !ch) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const k = Math.min(dpr, Math.sqrt(cap / (cw * ch)));
      const w = Math.max(2, Math.round(cw * k)); const h = Math.max(2, Math.round(ch * k));
      // mobile address bar: ignore small height-only changes (no flicker mid-scroll)
      const small = !force && canvas.width === w && Math.abs(canvas.height - h) < 160 * k;
      if (!small && (canvas.width !== w || canvas.height !== h)) { canvas.width = w; canvas.height = h; }
      sizeTargets(Math.max(2, Math.round(canvas.width / 4)), Math.max(2, Math.round(canvas.height / 4)));
      dirty = true;
    };
    const ro = new ResizeObserver(() => resize(false));
    ro.observe(canvas);
    resize(true);

    let mix = 0; let switching = false; let fade = 0;
    let settled = a; let seen = a; let seenAt = performance.now();
    let t = 0; let last = performance.now(); let raf = 0;
    let seed = [0, 0]; let seedAt = 0;

    const fit = (i) => {
      const e = tex.get(i); const s = scenes[i];
      const f = (typeof s === 'object' && s.focus) || [0.5, 0.5];
      return [e ? e.w : 16, e ? e.h : 9, f[0], f[1]];
    };
    const expo = (i) => { const s = scenes[i]; return (typeof s === 'object' && s.exposure) || 1; };
    const sceneUniforms = (pr, k) => {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex.get(a)?.t ?? blank);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex.get(switching ? b : a)?.t ?? blank);
      gl.uniform1i(pr.u.uA, 0); gl.uniform1i(pr.u.uB, 1);
      gl.uniform4fv(pr.u.uFitA, fit(a)); gl.uniform4fv(pr.u.uFitB, fit(switching ? b : a));
      gl.uniform1f(pr.u.uExpA, expo(a)); gl.uniform1f(pr.u.uExpB, expo(switching ? b : a));
      gl.uniform1f(pr.u.uDriftA, 1.0 + a * 1.7); gl.uniform1f(pr.u.uDriftB, 1.0 + (switching ? b : a) * 1.7);
      gl.uniform1f(pr.u.uAspect, canvas.width / canvas.height);
      gl.uniform1f(pr.u.uTime, reduce ? 0 : t);
      gl.uniform1f(pr.u.uMotion, reduce ? 0 : 1);
      gl.uniform1f(pr.u.uMix, k);
    };
    const blurPass = (from, to, dx, dy) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, to.f);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, from.t);
      gl.uniform1i(blur.u.uTex, 0);
      gl.uniform2f(blur.u.uInv, 1 / to.w, 1 / to.h);
      gl.uniform2f(blur.u.uDir, dx / to.w, dy / to.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const gap = now - last;
      if (coarse && gap < 30) return;
      last = now;
      const dt = Math.min(0.05, gap / 1000);
      t += dt;

      // No live resolution changes: re-allocating the buffer while a picture is on screen
      // makes it visibly snap (grain, scanlines, glow all re-scale). The size is fixed by
      // the caps above, decided once.

      // debounce the target: scrolling fast across several steps is one switch
      const w = want.current;
      if (w !== seen) { seen = w; seenAt = now; }
      if (settled !== seen && (now - seenAt >= settleMs || !tex.has(a))) settled = seen;
      ensure(settled); ensure(w); ensure(w + 1); ensure(w - 1);
      if (!tex.has(a) && tex.has(settled)) { a = settled; b = a; } // very first picture
      if (tex.has(a)) warm();

      if (!switching && settled !== a && tex.has(settled) && tex.has(a)) { b = settled; mix = 0; switching = true; }
      if (switching) {
        const step = dt / ((reduce ? 320 : switchMs) / 1000);
        if (settled === b) mix += step;
        else if (settled === a) mix -= step;      // went back: run it backwards
        else mix += step * 2.5;                    // somewhere else: finish fast, then chain
        if (mix >= 1) { a = b; mix = 0; switching = false; }
        else if (mix <= 0) { b = a; mix = 0; switching = false; }
        dirty = true;
      }
      if (tex.has(a) && fade < 1) { fade = Math.min(1, fade + dt / 0.7); dirty = true; }
      if (reduce && !dirty) return; // nothing moves: keep the last frame
      dirty = false;

      const k = switching ? mix * mix * (3 - 2 * mix) : 0;
      if (now - seedAt > 40) { seedAt = now; seed = [Math.floor(Math.random() * 256) / 256, Math.floor(Math.random() * 256) / 256]; }

      // 1. highlights → target 0 (1/4 res)
      const [g0, g1, g2] = targets;
      gl.viewport(0, 0, g0.w, g0.h);
      gl.useProgram(bright.p);
      gl.bindFramebuffer(gl.FRAMEBUFFER, g0.f);
      sceneUniforms(bright, k);
      gl.uniform2f(bright.u.uRes, g0.w, g0.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // 2. tight blur (0 → 1 → 0), then wide blur of that (0 → 1 → 2)
      gl.useProgram(blur.p);
      blurPass(g0, g1, 1, 0); blurPass(g1, g0, 0, 1);
      blurPass(g0, g1, 3.2, 0); blurPass(g1, g2, 0, 3.2);
      // 3. the screen
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(final.p);
      sceneUniforms(final, k);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, noise); gl.uniform1i(final.u.uNoise, 2);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, g0.t); gl.uniform1i(final.u.uBloom, 3);
      gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, g2.t); gl.uniform1i(final.u.uHalo, 4);
      gl.uniform2f(final.u.uRes, canvas.width, canvas.height);
      gl.uniform2f(final.u.uSeed, seed[0], seed[1]);
      gl.uniform1f(final.u.uFade, fade);
      gl.uniform1f(final.u.uLine, Math.max(3, Math.round(canvas.height / 300)));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    raf = requestAnimationFrame(frame);

    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !dead) { last = performance.now(); dirty = true; raf = requestAnimationFrame(frame); }
    };
    document.addEventListener('visibilitychange', onVis);
    const onLost = (e) => { e.preventDefault(); cancelAnimationFrame(raf); dead = true; fallback(); };
    canvas.addEventListener('webglcontextlost', onLost);

    if (import.meta.env.DEV) {
      canvas.__crt = { get state() { return { a, b, mix, switching, settled, cap, w: canvas.width, h: canvas.height, tex: [...tex.keys()] }; } };
    }

    return () => {
      dead = true;
      cancelAnimationFrame(raf); ro.disconnect(); stopFallback?.();
      document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('webglcontextlost', onLost);
      tex.forEach((e) => gl.deleteTexture(e.t));
      targets.forEach((g) => { gl.deleteTexture(g.t); gl.deleteFramebuffer(g.f); });
      gl.deleteTexture(noise); gl.deleteTexture(blank); gl.deleteBuffer(buf);
      [bright, blur, final].forEach((pr) => gl.deleteProgram(pr.p));
    };
  }, [scenes, switchMs, settleMs, maxPixels]);

  return <canvas ref={ref} className={`crt ${className}`} aria-hidden="true" />;
}

export default CrtScenes;
