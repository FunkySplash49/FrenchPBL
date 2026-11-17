/*
 * Old-TV look for the diagram boxes (.viz) — the SVG half. CSS lives in styles/viz-tv.css,
 * the overlay layers in visuals/TvScreen.jsx.
 *
 * Installs, once, a hidden <svg> with two static filters:
 *   #tv-crt    on each diagram: a gentle CRT fisheye (the middle is slightly magnified,
 *              the edges slightly squeezed and pinned in place, so nothing is cropped).
 *              Nothing in it animates; it is re-run only when the diagram repaints.
 *   #tv-shift  the rolling tracking band (Chromium backdrop-filter only): the content under
 *              the band is nudged sideways, lifted, and its light parts
 *              leave an ember ghost to the left.
 * …and tags <html> with what this browser can do:
 *   tv-svgfx  SVG filters on HTML-level <svg> elements render reliably (not WebKit/iOS)
 *   tv-bdurl  backdrop-filter: url(#…) works (Chromium, incl. Samsung Internet / Edge)
 */

const NS = 'http://www.w3.org/2000/svg';

// pinned bulge profile on 0..1: 0 at the ends and the middle, max ±1 at ~0.21 / ~0.79,
// positive above the middle, so pixels are sampled from nearer the centre (= magnified)
const bulge = (t) => {
  const u = t - 0.5;
  return (-u * (1 - 4 * u * u)) / 0.19245;
};
const band = (t) => Math.sin(Math.PI * t) ** 2; // 0 at top/bottom, 1 across the middle
const byte = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255);
const STOPS = Array.from({ length: 17 }, (_, i) => i / 16);

function stops(fn) {
  return STOPS.map((t) => {
    const [c, o = 1] = fn(t);
    return `<stop offset="${t}" stop-color="${c}" stop-opacity="${o.toFixed(3)}"/>`;
  }).join('');
}
const svgUrl = (body) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="${NS}" viewBox="0 0 64 64" preserveAspectRatio="none" width="64" height="64">${body}</svg>`,
  )}`;

// A soft fisheye: each axis is magnified most through the middle of the box and the effect
// fades (but never quite vanishes) toward the other axis's edges, like a curved tube face.
const lens = (t) => 0.35 + 0.65 * band(t);
// red = horizontal displacement, faded toward top/bottom; green stays neutral
const MAP_X = svgUrl(
  `<defs><linearGradient id="x">${stops((t) => [`rgb(${byte(0.5 + 0.5 * bulge(t))},128,0)`])}</linearGradient>`
  + `<linearGradient id="n" x2="0" y2="1">${stops((t) => ['rgb(128,128,0)', 1 - lens(t)])}</linearGradient></defs>`
  + '<rect width="64" height="64" fill="url(#x)"/><rect width="64" height="64" fill="url(#n)"/>',
);
// green = vertical displacement, faded toward left/right; red stays neutral
const MAP_Y = svgUrl(
  `<defs><linearGradient id="y" x2="0" y2="1">${stops((t) => [`rgb(128,${byte(0.5 + 0.5 * bulge(t))},0)`])}</linearGradient>`
  + `<linearGradient id="n">${stops((t) => ['rgb(128,128,0)', 1 - lens(t)])}</linearGradient></defs>`
  + '<rect width="64" height="64" fill="url(#y)"/><rect width="64" height="64" fill="url(#n)"/>',
);

/*
 * The same map, baked once into a small bitmap (PERFORMANCE — same picture).
 * An <feImage> pointing at an SVG document is re-rasterised every time the filter runs, at
 * the filter's full device size. Chrome re-runs the filter on every frame in which anything
 * near the diagram repaints, so on a 4K screen (page zoom 2) this one filter dropped the whole
 * page to ~8 fps (measured: 117 ms frames → 16.7 ms with the bitmap; 33 → 16.7 ms at 1080p).
 * A bitmap <feImage> is decoded once and only scaled. Pixel for pixel it is the composite the
 * old chain produced (MAP_X red + MAP_Y green − 0.5): the two gradients are evaluated at
 * each texel centre exactly as the SVG gradients are (linear between the 17 stops), so the
 * bilinear upscale reproduces the same piecewise-linear surface. Measured against the old
 * chain: no bias, mean 0.47/255, max 3/255 (≤ 0.3 CSS px of displacement on the largest
 * box) — the old SVG gradients are dithered by the rasteriser, which is this ±1 noise.
 */
const lerpStops = (f) => {
  const v = STOPS.map(f);
  return (t) => {
    const s = t * 16; const i = Math.min(15, Math.floor(s)); const k = s - i;
    return v[i] * (1 - k) + v[i + 1] * k;
  };
};
function bakedMap(n = 256) {
  try {
    const c = document.createElement('canvas');
    c.width = n; c.height = n;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    const ramp = lerpStops((t) => byte(0.5 + 0.5 * bulge(t)));   // gradient colour (0–255)
    const fade = lerpStops((t) => +(1 - lens(t)).toFixed(3));     // neutral overlay opacity
    const at = Array.from({ length: n }, (_, i) => (i + 0.5) / n); // texel centres
    const r = at.map(ramp); const a = at.map(fade);
    const img = ctx.createImageData(n, n);
    const d = img.data;
    for (let y = 0; y < n; y += 1) {
      for (let x = 0; x < n; x += 1) {
        const o = (y * n + x) * 4;
        // gradient under its neutral (128) overlay, then + the other map's neutral 128 − 0.5;
        // the extra +0.5 matches how the old chain rounded (measured mean bias: 0.00)
        d[o] = Math.round(r[x] * (1 - a[y]) + 128 * a[y] + 1);
        d[o + 1] = Math.round(r[y] * (1 - a[x]) + 128 * a[x] + 1);
        d[o + 2] = 0;
        d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const url = c.toDataURL('image/png');
    return url.startsWith('data:image/png') ? url : null;
  } catch {
    return null;
  }
}

// displacement map in bounding-box units; outside the box (focus outlines) it is neutral
const mapChain = (baked) => (baked
  ? `
  <feFlood flood-color="rgb(128,128,0)" result="neutral"/>
  <feImage href="${baked}" x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="m"/>`
  : `
  <feFlood flood-color="rgb(128,128,0)" result="neutral"/>
  <feImage href="${MAP_X}" x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="mx"/>
  <feImage href="${MAP_Y}" x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="my"/>
  <feComposite in="mx" in2="my" operator="arithmetic" k1="0" k2="1" k3="1" k4="-0.5" result="m"/>`)
  + `
  <feMerge result="map"><feMergeNode in="neutral"/><feMergeNode in="m"/></feMerge>
  <feDisplacementMap in="SourceGraphic" in2="map" scale="0.022" xChannelSelector="R" yChannelSelector="G" result="warp"/>`;

// The glow and colour fringe are CSS drop-shadows chained after this filter (viz-tv.css):
// an in-filter bloom (threshold + blur + composite) measured ~2x frame time in Chrome.
// colours below are the token --ember-400 (0.93 0.54 0.27)
const defs = (baked) => `
<filter id="tv-crt" x="-0.04" y="-0.04" width="1.08" height="1.08" primitiveUnits="objectBoundingBox" color-interpolation-filters="sRGB">
  ${mapChain(baked)}
</filter>
<filter id="tv-shift" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB">
  <feOffset in="SourceGraphic" dx="3" dy="0" result="o"/>
  <feColorMatrix in="o" type="matrix" result="lift"
    values="1.08 0 0 0 0.03  0 1.05 0 0 0.018  0 0 0.98 0 0.006  0 0 0 1 0"/>
  <feOffset in="SourceGraphic" dx="-4" dy="0" result="o2"/>
  <feColorMatrix in="o2" type="matrix" result="ghost"
    values="0 0 0 0 0.93  0 0 0 0 0.54  0 0 0 0 0.27  0.3 0.6 0.1 0 -0.45"/>
  <feMerge><feMergeNode in="lift"/><feMergeNode in="ghost"/></feMerge>
</filter>`;

function capabilities() {
  const ua = navigator.userAgent;
  const chromium = !!navigator.userAgentData?.brands?.some((b) => /Chromium/.test(b.brand))
    || (/Chrome\/|Chromium\/|CriOS\//.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua));
  const ios = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const webkit = ios || (/AppleWebKit/.test(ua) && !chromium);
  return { svgfx: !webkit, bdurl: chromium && !ios };
}

export function installVizTv() {
  if (typeof document === 'undefined' || document.getElementById('tv-defs')) return;
  const { svgfx, bdurl } = capabilities();
  const root = document.documentElement;
  root.classList.toggle('tv-svgfx', svgfx);
  root.classList.toggle('tv-bdurl', bdurl);

  const svg = document.createElementNS(NS, 'svg');
  svg.id = 'tv-defs';
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  svg.innerHTML = `<defs>${defs(svgfx ? bakedMap() : null)}</defs>`;
  document.body.prepend(svg);
}
