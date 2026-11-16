import { animate } from 'framer-motion';

/*
 * The "camera" move between the story and a topic page.
 *  diveIn:  pull back a little (winding up), then plunge into the clicked word —
 *           the story scales past the camera, blurs and fades out.
 *  diveOut: the reverse — the story comes back from behind the camera and settles.
 * Works on the live story DOM; every inline style is cleared when the story is back.
 */
const WIND = 0.6;   // s, pull back
const PLUNGE = 0.7; // s, dive

const layers = () => ({
  story: document.querySelector('.story'),
  sky: document.querySelector('.backdrop'),
  // top bar, step rail and any open picture preview (portaled outside the story)
  chrome: [document.querySelector('.topbar'), document.querySelector('.rail'),
    ...document.querySelectorAll('[data-radix-popper-content-wrapper]')].filter(Boolean),
});

let saved = null;

export function diveIn(origin, onPlunge) {
  const { story, sky, chrome } = layers();
  if (!story) { onPlunge?.(); return Promise.resolve(); }
  const o = origin ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  // origin in the story's own coordinates (it scrolls with the page)
  const r = story.getBoundingClientRect();
  saved = { ox: o.x - r.left, oy: o.y - r.top, sx: o.x, sy: o.y };
  story.style.transformOrigin = `${saved.ox}px ${saved.oy}px`;
  story.style.willChange = 'transform, opacity, filter';
  if (sky) sky.style.transformOrigin = `${o.x}px ${o.y}px`;

  const wind = [
    animate(story, { scale: 0.9, filter: 'blur(0px)' }, { duration: WIND, ease: [0.33, 1, 0.68, 1] }),
    sky && animate(sky, { scale: 0.96 }, { duration: WIND, ease: [0.33, 1, 0.68, 1] }),
    ...chrome.map((el) => animate(el, { opacity: 0 }, { duration: WIND * 0.6 })),
  ].filter(Boolean);

  return Promise.all(wind.map((a) => a.finished)).then(() => {
    onPlunge?.();
    const dive = [
      animate(story, { scale: 7, opacity: 0, filter: 'blur(10px)' }, { duration: PLUNGE, ease: [0.7, 0, 0.84, 0] }),
      sky && animate(sky, { scale: 1.6, opacity: 0 }, { duration: PLUNGE, ease: [0.7, 0, 0.84, 0] }),
    ].filter(Boolean);
    return Promise.all(dive.map((a) => a.finished));
  }).then(() => { story.style.visibility = 'hidden'; });
}

export function diveOut(reduce) {
  const { story, sky, chrome } = layers();
  if (!story) return;
  const clear = () => {
    for (const el of [story, sky, ...chrome]) {
      if (!el) continue;
      el.style.transform = ''; el.style.opacity = ''; el.style.filter = '';
      el.style.transformOrigin = ''; el.style.willChange = ''; el.style.visibility = '';
    }
  };
  if (reduce || !story.style.transform) { clear(); return; }
  story.style.visibility = '';
  const ease = [0.16, 1, 0.3, 1];
  Promise.all([
    animate(story, { scale: [2.4, 1], opacity: [0, 1], filter: ['blur(8px)', 'blur(0px)'] }, { duration: 0.8, ease }).finished,
    sky && animate(sky, { scale: [1.25, 1], opacity: [0, 1] }, { duration: 0.8, ease }).finished,
    ...chrome.map((el) => animate(el, { opacity: 1 }, { duration: 0.4, delay: 0.4 }).finished),
  ]).then(clear);
}
