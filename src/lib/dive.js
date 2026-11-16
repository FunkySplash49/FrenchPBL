/*
 * The "camera" move between the story and a topic page.
 *  diveIn:  pull back a little (winding up), then plunge into the clicked word —
 *           the story scales past the camera, blurs and fades out. The painted backdrop stays:
 *           it switches to the topic's picture with its own old-TV transition (Backdrop).
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
let diving = null;   // the dive in progress (promise), so a repeat call reuses it
let pendingOut = 0;  // a deferred dive-out, cancelled if the dive restarts right away

export function diveIn(origin, onPlunge) {
  // a dive-out scheduled a moment ago (React re-mounting the page in development) is cancelled,
  // and the dive already under way simply continues
  if (pendingOut) { clearTimeout(pendingOut); pendingOut = 0; if (diving) return diving; } // its onPlunge still fires on time
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
  // off-screen sections aren't painted during the dive: the blur only processes what is visible
  // (the story is ~14 000 px tall)
  document.documentElement.classList.add('is-diving');
  if (sky) sky.style.transformOrigin = `${o.x / z}px ${o.y / z}px`;

  const wind = [
    run(story, [{ transform: 'scale(1)', filter: 'blur(0px)' }, { transform: 'scale(0.9)', filter: 'blur(0px)' }], { duration: WIND, easing: EASE_WIND }),
    ...chrome.map((el) => run(el, [{ opacity: getComputedStyle(el).opacity }, { opacity: 0 }], { duration: WIND * 0.6 })),
  ].filter(Boolean);

  diving = Promise.all(wind).then(() => {
    document.documentElement.classList.add('is-plunging'); // glass cards off (crt-scenes)
    onPlunge?.();
    const dive = [
      run(story, [{ transform: 'scale(0.9)', opacity: 1, filter: 'blur(0px)' }, { transform: 'scale(7)', opacity: 0, filter: 'blur(10px)' }], { duration: PLUNGE, easing: EASE_PLUNGE }),
    ].filter(Boolean);
    return Promise.all(dive);
  }).then(() => { story.style.visibility = 'hidden'; });
  return diving;
}

export function diveOut(reduce) {
  // deferred one tick: if the page is re-mounted at once (dev double-mount), diveIn cancels this
  clearTimeout(pendingOut);
  pendingOut = setTimeout(() => { pendingOut = 0; diving = null; doDiveOut(reduce); }, 0);
}

function doDiveOut(reduce) {
  // another topic page is already open (topic → topic: the old page's exit finishes after the
  // new one mounted) — the story stays hidden
  if (window.location.hash.startsWith('#/sujet/')) return;
  const { story, sky, chrome } = layers();
  if (!story) return;
  const clear = () => {
    for (const el of [story, sky, ...chrome]) {
      if (!el) continue;
      el.getAnimations().forEach((a) => a.cancel());
      el.style.transform = ''; el.style.opacity = ''; el.style.filter = '';
      el.style.transformOrigin = ''; el.style.willChange = ''; el.style.visibility = '';
    }
    document.documentElement.classList.remove('is-diving', 'is-plunging');
  };
  if (reduce || !story.style.transform) { clear(); return; }
  story.style.visibility = '';
  document.documentElement.classList.remove('is-plunging');
  Promise.all([
    run(story, [{ transform: 'scale(2.4)', opacity: 0, filter: 'blur(8px)' }, { transform: 'scale(1)', opacity: 1, filter: 'blur(0px)' }], { duration: 800, easing: EASE_BACK }),
    ...chrome.map((el) => run(el, [{ opacity: getComputedStyle(el).opacity }, { opacity: 1 }], { duration: 400, delay: 400 })),
  ]).then(clear);
}

/* opened without the dive (a shared link, or reduced motion): hide the story at once, the way
   the dive would have, so it never shows through the topic page's light shade. diveOut()
   restores everything on close. */
export function hideStoryNow() {
  // a page replacing another (topic → topic): cancel the previous page's pending restore
  if (pendingOut) { clearTimeout(pendingOut); pendingOut = 0; }
  const { story, chrome } = layers();
  if (!story) return;
  story.style.visibility = 'hidden';
  chrome.forEach((el) => { el.style.opacity = '0'; });
}
