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
// boxes over the backdrop, buffer px, top-left origin: kind 0 = glass card (refracts),
// kind 1 = lit box (dims its surroundings and bleeds its light into the picture)
uniform vec4 uBox[8];
uniform float uBoxKind[8];
uniform vec3 uBoxCol[8];
uniform int uBoxN;
uniform float uBoxR;       // corner radius, buffer px
uniform float uPx;         // buffer px per CSS px

float sdBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

vec3 tube(sampler2D t, vec2 uv) {
  // lens softness + chromatic bleed: red leans left, blue leans right
  vec2 d = vec2(1.6 / uRes.x, 0.0);
  vec3 l = texture2D(t, uv - d).rgb;
  vec3 c = texture2D(t, uv).rgb;
  vec3 r = texture2D(t, uv + d).rgb;
  return vec3(0.62 * l.r + 0.38 * c.r, 0.22 * l.g + 0.56 * c.g + 0.22 * r.g, 0.62 * r.b + 0.38 * c.b);
}

// which: 0 = scene A, 1 = scene B, in between = crossfade (reduced motion)
vec3 scene(vec2 uv, float which) {
  vec3 a = which < 0.999 ? grade(tube(uA, cover(uv, uFitA, uDriftA)), uExpA) : vec3(0.0);
  vec3 b = which > 0.001 ? grade(tube(uB, cover(uv, uFitB, uDriftB)), uExpB) : vec3(0.0);
  return mix(a, b, which);
}
vec3 soft(vec2 uv, float which) {
  vec3 a = which < 0.999 ? texture2D(uA, cover(uv, uFitA, uDriftA)).rgb : vec3(0.0);
  vec3 b = which > 0.001 ? texture2D(uB, cover(uv, uFitB, uDriftB)).rgb : vec3(0.0);
  return grade(mix(a, b, which), mix(uExpA, uExpB, which));
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 suv = frag / uRes;
  vec2 uv = vec2(suv.x, 1.0 - suv.y);
  vec2 px = vec2(frag.x, uRes.y - frag.y); // top-left buffer px, like the DOM

  vec4 rnd = texture2D(uNoise, (floor(frag) + 0.5) / 256.0);
  vec4 live = texture2D(uNoise, (floor(frag) + 0.5) / 256.0 + uSeed);

  // which scene this pixel shows
  float which = 0.0;
  float spark = 0.0;
  if (uMix > 0.0 && uMotion < 0.5) {
    which = uMix;
  } else if (uMix > 0.0) {
    // every pixel has its own moment to flip (random, with a slight top-to-bottom lean)
    float h = (rnd.r + rnd.g / 256.0) * 0.86 + uv.y * 0.14;
    const float band = 0.07;
    float edge = uMix * (1.0 + band);
    if (h <= edge) {
      which = 1.0;
      // just flipped: sparkling static that dies out
      if (h > edge - band) spark = step(0.45, live.b) * (1.0 - (edge - h) / band);
    }
  }

  // boxes: glass cards bend the picture; lit boxes dim around themselves and glow
  float glass = 0.0; float rim = 0.0; vec2 guv = uv; vec2 gdisp = vec2(0.0); float gx = 1.0;
  float dim = 0.0; vec3 glow = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    if (i >= uBoxN) break;
    vec4 r = uBox[i];
    vec2 b = r.zw * 0.5;
    vec2 q = px - (r.xy + b);
    float d = sdBox(q, b, uBoxR);
    if (uBoxKind[i] < 0.5) {
      if (d < 0.0) {
        // Liquid-glass lens (community recreations of Apple's look, e.g. kube.io / liquidGL):
        // a convex SQUIRCLE edge profile y = (1-(1-x)^4)^(1/4) over a bevel ~15% of the
        // card's shorter side; the light bends by the profile's slope (Snell, n≈1.5), so the
        // picture is pulled in from just outside the edge; the middle stays flat.
        float bevel = clamp(0.15 * 2.0 * min(b.x, b.y), 18.0 * uPx, 64.0 * uPx);
        float x = clamp(-d / bevel, 0.0, 1.0);           // 0 at the edge → 1 on the flat
        float o = 1.0 - x;
        float slope = min(o * o * o * pow(max(1.0 - o * o * o * o, 1e-3), -0.75), 6.0);
        float bend = slope / sqrt(1.0 + slope * slope);  // sin of the surface tilt
        // outward normal of the rounded rect
        vec2 qq = abs(q) - b + uBoxR;
        vec2 nrm = (qq.x > 0.0 && qq.y > 0.0) ? normalize(qq) : (qq.x > qq.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0));
        nrm *= sign(q + 1e-4);
        gdisp = nrm * bend * bevel * 0.55;
        guv = (px + gdisp) / uRes;
        gx = x;
        glass = smoothstep(0.0, 1.5 * uPx, -d);
        // specular rim: lit from the top-left, a fainter catch-light on the opposite edge
        vec2 L = normalize(vec2(-0.55, -0.83));
        float lit = max(dot(nrm, L), 0.0); float back = max(dot(nrm, -L), 0.0);
        float edge = pow(o, 7.0);
        rim = edge * (0.25 + 0.95 * lit * lit + 0.35 * back * back);
      }
    } else if (d > 0.0) {
      dim = max(dim, exp(-d / (240.0 * uPx)));
      glow += uBoxCol[i] * (exp(-d / (26.0 * uPx)) * 0.6 + exp(-d / (120.0 * uPx)) * 0.2);
    }
  }

  vec3 col = scene(uv, which);
  if (glass > 0.0) {
    // frost: a soft blur of the bent picture under a little of the sharp one
    vec2 e = vec2(9.0 * uPx) / uRes;
    vec3 blurred = (soft(guv + e, which) + soft(guv - e, which)
                  + soft(guv + vec2(e.x, -e.y), which) + soft(guv + vec2(-e.x, e.y), which)
                  + soft(guv + vec2(e.x * 1.8, 0.0), which) + soft(guv - vec2(e.x * 1.8, 0.0), which)) / 6.0;
    vec3 sharp = scene(guv, which);
    // chromatic dispersion only on the bevel (≈1–2 px of R/B split), none on the flat
    if (gx < 0.999) {
      vec2 split = gdisp * 0.07 + normalize(gdisp + 1e-4) * (1.0 - gx) * 1.2 * uPx;
      sharp.r = soft((px + gdisp + split) / uRes, which).r;
      sharp.b = soft((px + gdisp - split) / uRes, which).b;
    }
    vec3 inGlass = mix(sharp, blurred, 0.72);
    // a little extra saturation behind glass (Apple's lit-through look)
    inGlass = mix(vec3(dot(inGlass, LUM)), inGlass, 1.22);
    col = mix(col, inGlass, glass);
  }

  // glow: bloom keeps the colour of the light, halation spreads wider and warmer
  vec3 bloom = texture2D(uBloom, suv).rgb;
  vec3 halo = texture2D(uHalo, suv).rgb;
  col += bloom * 0.55 + halo * vec3(0.80, 0.52, 0.34);
  col += spark * vec3(1.0, 0.86, 0.62) * 0.75;

  // phosphor scanlines: dark gaps between lines, thinner where the picture is bright
  // (softer behind glass — the frost smooths them)
  float l = clamp(dot(col, LUM), 0.0, 1.0);
  float scan = 0.5 + 0.5 * cos(frag.y * 6.28318 / uLine);
  col *= 1.0 - (0.34 - 0.20 * l) * (1.0 - scan) * (1.0 - 0.6 * glass);
  col *= 1.10;
  // aperture grille (RGB stripes)
  float m = mod(floor(frag.x), 3.0);
  col *= vec3(m < 0.5 ? 1.07 : 0.965, (m > 0.5 && m < 1.5) ? 1.07 : 0.965, m > 1.5 ? 1.07 : 0.965);
  // slow rolling bar + grain
  float bar = fract(uTime * 0.06);
  col *= 1.0 + 0.06 * smoothstep(0.09, 0.0, abs(uv.y - bar)) * uMotion;
  col += (live.a - 0.5) * 0.05 * uMotion;

  // lit boxes: the picture is damped around them, and their light bleeds into it (neon)
  col *= 1.0 - 0.5 * dim;
  col += glow * (0.6 + 0.4 * l);
  // glass: a light haze (readable text, never fully clear) + a bright rim
  // (thicker over bright parts of the painting, so text contrast holds everywhere)
  float lg = clamp(dot(col, LUM), 0.0, 1.0);
  col = mix(col, col * 0.5 + vec3(0.050, 0.034, 0.024), (0.5 + 0.38 * lg) * glass);
  col += rim * glass * vec3(0.42, 0.34, 0.25);

  // tube vignette; the very top stays calmer for the top bar
  vec2 v = suv - 0.5;
  col *= 1.0 - dot(v, v) * 0.85;
  col *= mix(0.72, 1.0, smoothstep(0.0, 0.22, uv.y));

  // soft shoulder so the glow rolls off instead of clipping
  col = 1.0 - exp(-col * 1.25);
  gl_FragColor = vec4(col * uFade, 1.0);
}`;

/*
 * Fetch + decode a scene OFF the main thread (createImageBitmap), already scaled to the
 * GPU size limit, so a 1920px painting never stalls scrolling or a switch while it
 * decodes. The upload that follows is then a plain copy. Falls back to <img> + decode().
 * Same pixels either way: same orientation / colour conversion as an <img> upload.
 */
async function loadImage(src, maxSide) {
  if (typeof createImageBitmap === 'function') {
    try {
      const blob = await (await fetch(src)).blob();
      let bmp = await createImageBitmap(blob);
      const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
      if (k < 1) {
        const w = Math.round(bmp.width * k); const h = Math.round(bmp.height * k);
        const big = bmp;
        bmp = await createImageBitmap(big, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
        big.close();
      }
      return { source: bmp, w: bmp.width, h: bmp.height, bitmap: true };
    } catch { /* fall through to <img> */ }
  }
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  await img.decode();
  let source = img; const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  if (k < 1) {
    source = document.createElement('canvas');
    source.width = Math.round(img.naturalWidth * k); source.height = Math.round(img.naturalHeight * k);
    source.getContext('2d').drawImage(img, 0, 0, source.width, source.height);
  }
  return { source, w: source.width || img.naturalWidth, h: source.height || img.naturalHeight };
}

const srcOf = (s) => (typeof s === 'string' ? s : s.src);

/**
 * scenes: [{ src, focus?: [x, y] (0–1, what to keep in view when cropped), exposure? }] or [src]
 */
export function CrtScenes({ scenes, index = 0, switchMs = 1000, settleMs = 140, maxPixels = 2.2e6, glassSelector = '', glowSelector = '', className = '' }) {
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
      document.documentElement.classList.remove('has-glass'); // CSS cards stay solid
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
      final = program(FRAG_FINAL, [...shared, 'uNoise', 'uBloom', 'uHalo', 'uSeed', 'uFade', 'uLine', 'uBox', 'uBoxKind', 'uBoxCol', 'uBoxN', 'uBoxR', 'uPx']);
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[crt] falling back:', err);
      fallback();
      return () => stopFallback?.();
    }
    canvas.classList.remove('is-fallback');
    // the CSS side of the glass cards switches on only when the shader draws them
    if (glassSelector) document.documentElement.classList.add('has-glass');

    // boxes over the backdrop: read from the DOM each frame (a handful of rects, no
    // layout thrash — scrolling doesn't invalidate layout), redraw at once when they move
    const boxData = new Float32Array(32); const boxKind = new Float32Array(8); const boxCol = new Float32Array(24);
    let boxN = 0; let boxKey = ''; let boxR = 14;
    const glowCache = new WeakMap();
    const DEFAULT_GLOW = [238 / 255, 138 / 255, 69 / 255]; // --ember-400
    const glowOf = (el) => {
      let c = glowCache.get(el);
      if (!c) {
        const v = getComputedStyle(el).getPropertyValue('--viz-glow').trim();
        const m = v.match(/^#([0-9a-f]{6})$/i);
        c = m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255) : DEFAULT_GLOW;
        glowCache.set(el, c);
      }
      return c;
    };
    const readBoxes = () => {
      if (!glassSelector && !glowSelector) return false;
      const cw = canvas.clientWidth; const ch = canvas.clientHeight;
      if (!cw || !ch) return false;
      const kx = canvas.width / cw; const ky = canvas.height / ch;
      let n = 0; let key = '';
      const add = (el, kind) => {
        if (n >= 8) return;
        const b = el.getBoundingClientRect();
        if (b.width < 2 || b.bottom < -300 || b.top > ch + 300) return;
        boxData[n * 4] = b.left * kx; boxData[n * 4 + 1] = b.top * ky;
        boxData[n * 4 + 2] = b.width * kx; boxData[n * 4 + 3] = b.height * ky;
        boxKind[n] = kind;
        boxCol.set(kind ? glowOf(el) : [0, 0, 0], n * 3);
        key += `${kind}:${Math.round(b.left)},${Math.round(b.top)},${Math.round(b.width)},${Math.round(b.height)};`;
        if (kind === 0 && n === 0) boxR = (parseFloat(getComputedStyle(el).borderTopLeftRadius) || 14) * kx;
        n += 1;
      };
      if (glassSelector) document.querySelectorAll(glassSelector).forEach((el) => add(el, 0));
      if (glowSelector) document.querySelectorAll(glowSelector).forEach((el) => add(el, 1));
      boxN = n;
      if (key === boxKey) return false;
      boxKey = key;
      return true;
    };

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
      loadImage(srcOf(scenes[i]), maxTex).then(({ source, w, h, bitmap }) => {
        if (dead || gl.isContextLost()) { if (bitmap) source.close(); return; }
        const t = mkTex(gl.LINEAR, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source);
        if (bitmap) source.close();
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
    let seed = [0, 0]; let seedAt = 0; let drawnAt = 0;
    const IDLE_MS = 32;

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
      if (readBoxes()) dirty = true; // a card or box moved (scroll, resize): draw now

      // hidden behind a topic page (lib/dive.js fades the backdrop out): draw nothing
      const host = canvas.parentElement;
      if (host && (host.style.opacity === '0' || host.style.visibility === 'hidden')) { dirty = true; return; }
      // idle (no switch, no fade-in): the grain only changes every 40 ms and the drift is
      // well under a pixel per frame, so ~30 draws/s look identical to 60 — half the GPU.
      if (!reduce && !switching && fade >= 1 && !dirty && now - drawnAt < IDLE_MS) return;
      if (reduce && !dirty) return; // nothing moves: keep the last frame
      dirty = false;
      drawnAt = now;

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
      gl.uniform4fv(final.u.uBox, boxData);
      gl.uniform1fv(final.u.uBoxKind, boxKind);
      gl.uniform3fv(final.u.uBoxCol, boxCol);
      gl.uniform1i(final.u.uBoxN, boxN);
      gl.uniform1f(final.u.uBoxR, boxR);
      gl.uniform1f(final.u.uPx, canvas.width / Math.max(1, canvas.clientWidth));
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
      document.documentElement.classList.remove('has-glass');
      cancelAnimationFrame(raf); ro.disconnect(); stopFallback?.();
      document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('webglcontextlost', onLost);
      tex.forEach((e) => gl.deleteTexture(e.t));
      targets.forEach((g) => { gl.deleteTexture(g.t); gl.deleteFramebuffer(g.f); });
      gl.deleteTexture(noise); gl.deleteTexture(blank); gl.deleteBuffer(buf);
      [bright, blur, final].forEach((pr) => gl.deleteProgram(pr.p));
    };
  }, [scenes, switchMs, settleMs, maxPixels, glassSelector, glowSelector]);

  return <canvas ref={ref} className={`crt ${className}`} aria-hidden="true" />;
}

export default CrtScenes;
