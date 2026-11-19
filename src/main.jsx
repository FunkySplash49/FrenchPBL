import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/global.css';
import './styles/viz-tv.css';
import App from './App';
import { installVizTv } from './lib/vizTv';

/* Touch screens — phones, tablets and the classroom's Samsung touch monitor (which may
   also report a mouse, so CSS hover/pointer queries alone aren't reliable):
   html.is-touch switches on bigger targets, prev/next buttons and touch hints.
   ?touch / ?touch=0 forces it on/off for testing. */
const q = new URLSearchParams(window.location.search).get('touch');
const touch = q != null ? q !== '0'
  : (navigator.maxTouchPoints > 0 || window.matchMedia('(any-pointer: coarse)').matches);
document.documentElement.classList.toggle('is-touch', touch);

installVizTv(); // old-TV filters for the diagram boxes

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/* After the page has loaded, keep a copy on this device: repeat visits open faster and the
   presentation still works without internet. See tools/make-sw.mjs. */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    (window.requestIdleCallback || setTimeout)(() => {
      navigator.serviceWorker.register('./sw.js')
        .then(() => navigator.serviceWorker.ready)
        .then((reg) => reg.active?.postMessage('precache'))
        .catch(() => {});
    }, { timeout: 2000 });
  });
}
