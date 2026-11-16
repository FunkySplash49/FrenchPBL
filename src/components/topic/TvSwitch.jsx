import { useEffect, useRef } from 'react';

/*
 * TvSwitch — the old-TV channel change from the CRT backdrop, as a page transition.
 * A full-screen overlay where every pixel flips, in random order, from transparent
 * (the story still visible) to the topic page's dark "inside", through a thin band of
 * sparkling static — the same look as the backdrop's scene switch.
 * Plays once (`delay`, `duration` in s), then calls onDone; the CSS void takes over.
 * No WebGL → onDone straight away (the CSS fade covers it).
 */
const VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uMix;
uniform float uSeed;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 f = floor(gl_FragCoord.xy);
  vec2 uv = gl_FragCoord.xy / uRes;
  // same flip order idea as the backdrop: random per pixel, slight top-to-bottom lean
  float h = hash(f) * 0.86 + (1.0 - uv.y) * 0.14;
  const float band = 0.08;
  float edge = uMix * (1.0 + band);
  // the topic page's void: --ink-800 centre to --ink-950 edges
  vec2 v = uv - 0.5;
  vec3 voidCol = mix(vec3(0.165, 0.102, 0.063), vec3(0.071, 0.039, 0.024), clamp(length(v) * 1.6, 0.0, 1.0));
  if (h > edge) { gl_FragColor = vec4(0.0); return; }          // not flipped yet: story shows
  float s = 0.0;
  if (h > edge - band) s = step(0.5, hash(f + uSeed)) * (1.0 - (edge - h) / band);
  vec3 c = voidCol + s * vec3(1.0, 0.86, 0.62) * 0.8;          // just flipped: static sparkle
  gl_FragColor = vec4(c, 1.0);
}`;

export default function TvSwitch({ delay = 0, duration = 0.9, onDone }) {
  const ref = useRef(null);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas?.getContext('webgl', { antialias: false, premultipliedAlpha: true, alpha: true });
    if (!gl) { done.current?.(); return undefined; }
    const sh = (k, src) => { const s = gl.createShader(k); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.bindAttribLocation(p, 0, 'p');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { done.current?.(); return undefined; }
    gl.useProgram(p);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(p, 'uRes');
    const uMix = gl.getUniformLocation(p, 'uMix');
    const uSeed = gl.getUniformLocation(p, 'uSeed');

    // per-pixel at the screen's own resolution (capped like the backdrop: ~2.2 MP)
    const cw = canvas.clientWidth; const ch = canvas.clientHeight;
    const k = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(2.2e6 / Math.max(1, cw * ch)));
    canvas.width = Math.round(cw * k); canvas.height = Math.round(ch * k);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);

    let raf = 0; let start = 0; let finished = false;
    const frame = (now) => {
      if (!start) start = now;
      const t = (now - start) / 1000 - delay;
      const m = Math.max(0, Math.min(1, t / duration));
      const e = m * m * (3 - 2 * m);
      gl.uniform1f(uMix, e);
      gl.uniform1f(uSeed, Math.floor(now / 40) % 97);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (m >= 1) { if (!finished) { finished = true; done.current?.(); } return; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      gl.deleteProgram(p); gl.deleteBuffer(buf);
    };
  }, [delay, duration]);

  return <canvas ref={ref} className="tv-switch" aria-hidden="true" />;
}
