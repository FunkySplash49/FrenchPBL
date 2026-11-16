/*
 * The "camera" move between the story and a topic page.
 *  diveIn:  pull back a little (winding up), then plunge into the clicked word —
 *           the story scales past the camera, blurs and fades out.
 *  diveOut: the reverse — the story comes back from behind the camera and settles.
 * Works on the live story DOM with the browser's own Web Animations (no animation library
 * on the first load); end states are committed as inline styles, and every inline style is
 * cleared when the story is back.
 */
const WIND = 600;   // ms, pull back
const PLUNGE = 700; // ms, dive
const EASE_WIND = 'cubic-bezier(0.33, 1, 0.68, 1)';
const EASE_PLUNGE = 'cubic-bezier(0.7, 0, 0.84, 0)';
const EASE_BACK = 'cubic-bezier(0.16, 1, 0.3, 1)';

const layers = () => ({
  story: document.querySelector('.story'),
  sky: document.querySelector('.backdrop'),
  // top bar, step rail and any open picture preview (portaled outside the story)
  chrome: [document.querySelector('.topbar'), document.querySelector('.rail'),
    ...document.querySelectorAll('[data-radix-popper-content-wrapper]')].filter(Boolean),
});

// run a WAAPI animation and keep its end state as inline style (like a tweening library would)
function run(el, frames, opts) {
  const a = el.animate(frames, { ...opts, fill: 'forwards' });
  return a.finished.then(() => {
    try { a.commitStyles(); } catch { /* element gone */ }
    a.cancel();
  }, () => {});
}

let saved = null;

export function diveIn(origin, onPlunge) {
  const { story, sky, chrome } = layers();
  if (!story) { onPlunge?.(); return Promise.resolve(); }
  const o = origin ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  // on-screen px → the elements' own CSS px (the page is CSS-zoomed on 4K screens)
  const z = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
  // origin in the story's own coordinates (it scrolls with the page)
  const r = story.getBoundingClientRect();
  saved = { ox: (o.x - r.left) / z, oy: (o.y - r.top) / z, sx: o.x, sy: o.y };
  story.style.transformOrigin = `${saved.ox}px ${saved.oy}px`;
  story.style.willChange = 'transform, opacity, filter';
  story.style.transform = 'scale(1)'; // marks "moving" for the backdrop's glass tracking
  if (sky) sky.style.transformOrigin = `${o.x / z}px ${o.y / z}px`;

  const wind = [
    run(story, [{ transform: 'scale(1)', filter: 'blur(0px)' }, { transform: 'scale(0.9)', filter: 'blur(0px)' }], { duration: WIND, easing: EASE_WIND }),
    sky && run(sky, [{ transform: 'scale(1)' }, { transform: 'scale(0.96)' }], { duration: WIND, easing: EASE_WIND }),
    ...chrome.map((el) => run(el, [{ opacity: getComputedStyle(el).opacity }, { opacity: 0 }], { duration: WIND * 0.6 })),
  ].filter(Boolean);

  return Promise.all(wind).then(() => {
    onPlunge?.();
    const dive = [
      run(story, [{ transform: 'scale(0.9)', opacity: 1, filter: 'blur(0px)' }, { transform: 'scale(7)', opacity: 0, filter: 'blur(10px)' }], { duration: PLUNGE, easing: EASE_PLUNGE }),
      sky && run(sky, [{ transform: 'scale(0.96)', opacity: 1 }, { transform: 'scale(1.6)', opacity: 0 }], { duration: PLUNGE, easing: EASE_PLUNGE }),
    ].filter(Boolean);
    return Promise.all(dive);
  }).then(() => { story.style.visibility = 'hidden'; });
}

export function diveOut(reduce) {
  const { story, sky, chrome } = layers();
  if (!story) return;
  const clear = () => {
    for (const el of [story, sky, ...chrome]) {
      if (!el) continue;
      el.getAnimations().forEach((a) => a.cancel());
      el.style.transform = ''; el.style.opacity = ''; el.style.filter = '';
      el.style.transformOrigin = ''; el.style.willChange = ''; el.style.visibility = '';
    }
  };
  if (reduce || !story.style.transform) { clear(); return; }
  story.style.visibility = '';
  Promise.all([
    run(story, [{ transform: 'scale(2.4)', opacity: 0, filter: 'blur(8px)' }, { transform: 'scale(1)', opacity: 1, filter: 'blur(0px)' }], { duration: 800, easing: EASE_BACK }),
    sky && run(sky, [{ transform: 'scale(1.25)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 800, easing: EASE_BACK }),
    ...chrome.map((el) => run(el, [{ opacity: getComputedStyle(el).opacity }, { opacity: 1 }], { duration: 400, delay: 400 })),
  ]).then(clear);
}
