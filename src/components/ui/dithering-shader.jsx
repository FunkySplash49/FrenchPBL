import { useEffect, useRef } from 'react';

/*
 * DitheringShader — two-colour ordered (Bayer) dithering of a moving pattern, in WebGL.
 * Written for this Vite/JS site to match the 21st.dev demo API
 * (shape="wave", type="8x8", colorBack, colorFront, pxSize, speed) — the pasted
 * snippet didn't include the shader itself.
 *
 * Cheap by design: the canvas is rendered at (CSS size / pxSize) and scaled up with
 * `image-rendering: pixelated`, so a full-screen backdrop is a few thousand pixels.
 * Extra props:
 *   lift    0–1   how much of the field is lit (the "light" of the scene); animatable
 *   horizon 0–1   height of the glowing wave line (0 = bottom)
 * Colours change smoothly (eased in the render loop), never repainted from scratch.
 * Pauses when the tab is hidden; with reduced motion it draws one still frame.
 */
const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = (type, shape) => `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uBack;
uniform vec3 uFront;
uniform float uLift;
uniform float uHorizon;

float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
#define bayer4(a) (bayer2(0.5 * (a)) * 0.25 + bayer2(a))
#define bayer8(a) (bayer4(0.5 * (a)) * 0.25 + bayer2(a))

float pattern(vec2 uv, float t) {
  float aspect = uRes.x / uRes.y;
  float x = uv.x * aspect;
  ${shape === 'wave' ? `
  // a slow rolling horizon line with a soft glow above and below it
  float line = uHorizon
    + 0.06 * sin(x * 2.3 + t * 0.55)
    + 0.035 * sin(x * 5.1 - t * 0.8 + 1.7)
    + 0.015 * sin(x * 11.0 + t * 1.3);
  float d = uv.y - line;
  float glow = d > 0.0 ? exp(-d * 4.2) : exp(d * 9.0) * 0.55;
  // faint bands rolling through the lit part, like heat over a field
  float bands = 0.5 + 0.5 * sin(uv.y * 26.0 - t * 1.1 + sin(x * 3.0 + t * 0.4) * 1.6);
  return clamp(glow * (0.78 + 0.22 * bands) * uLift, 0.0, 1.0);` : `
  return clamp((0.5 + 0.5 * sin(x * 8.0 + t)) * (1.0 - uv.y) * uLift, 0.0, 1.0);`}
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float v = pattern(uv, uTime);
  float threshold = ${type === '2x2' ? 'bayer2(gl_FragCoord.xy)' : type === '4x4' ? 'bayer4(gl_FragCoord.xy)' : 'bayer8(gl_FragCoord.xy)'};
  float on = step(threshold, v * 0.999);
  gl_FragColor = vec4(mix(uBack, uFront, on), 1.0);
}`;

const hex = (h) => {
  const n = parseInt(h.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export function DitheringShader({
  shape = 'wave', type = '8x8',
  colorBack = '#120A06', colorFront = '#EE8A45',
  pxSize = 3, speed = 0.6, lift = 1, horizon = 0.3,
  className = '', style,
}) {
  const ref = useRef(null);
  // live targets, read by the render loop (no re-init on change)
  const target = useRef({});
  target.current = { back: hex(colorBack), front: hex(colorFront), lift, horizon, speed };

  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas?.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false });
    const fallback = () => { canvas?.classList.add('is-fallback'); return undefined; };
    if (!gl || gl.isContextLost()) return fallback();

    const sh = (kind, src) => {
      const s = gl.createShader(kind);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    // a backdrop must never take the page down: any GL failure → plain gradient
    const prog = gl.createProgram();
    try {
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG(type, shape)));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[dither] falling back:', err);
      return fallback();
    }
    canvas.classList.remove('is-fallback');
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = Object.fromEntries(['uRes', 'uTime', 'uBack', 'uFront', 'uLift', 'uHorizon']
      .map((n) => [n, gl.getUniformLocation(prog, n)]));

    const resize = () => {
      const w = Math.max(1, Math.round(canvas.clientWidth / pxSize));
      const h = Math.max(1, Math.round(canvas.clientHeight / pxSize));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
      gl.uniform2f(u.uRes, w, h);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cur = { ...target.current, back: [...target.current.back], front: [...target.current.front] };
    let t = 0; let last = performance.now(); let raf = 0;

    const ease = (a, b, k) => a + (b - a) * k;
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const tg = target.current;
      const k = reduce ? 1 : 1 - Math.exp(-dt * 1.6); // ~1.5 s to settle on a new sky (instant if reduced)
      for (let i = 0; i < 3; i++) { cur.back[i] = ease(cur.back[i], tg.back[i], k); cur.front[i] = ease(cur.front[i], tg.front[i], k); }
      cur.lift = ease(cur.lift, tg.lift, k); cur.horizon = ease(cur.horizon, tg.horizon, k);
      t += dt * tg.speed;
      gl.uniform1f(u.uTime, t);
      gl.uniform3fv(u.uBack, cur.back); gl.uniform3fv(u.uFront, cur.front);
      gl.uniform1f(u.uLift, cur.lift); gl.uniform1f(u.uHorizon, cur.horizon);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); }
    };
    document.addEventListener('visibilitychange', onVis);
    // reduced motion: wake the (still) frame when the sky target changes
    const wake = setInterval(() => { if (reduce && !document.hidden) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); } }, 1000);

    return () => {
      cancelAnimationFrame(raf); clearInterval(wake); ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      gl.deleteProgram(prog); gl.deleteBuffer(buf);
    };
  }, [shape, type, pxSize]);

  return <canvas ref={ref} className={`dither ${className}`} style={style} aria-hidden="true" />;
}

export default DitheringShader;
