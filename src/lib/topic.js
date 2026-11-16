import { useEffect, useState } from 'react';

/*
 * Topic pages live at #/sujet/<id> so the browser Back button closes them
 * and a topic can be linked directly. `origin` (where the word was clicked)
 * is where the camera dives in.
 */
const PREFIX = '#/sujet/';

/** the topic page chunk — one shared promise, so prefetch and render reuse it */
let topicChunk = null;
export const loadTopicView = () => (topicChunk ??= import('../components/topic/TopicView'));
let origin = null;

export const topicFromHash = () =>
  (window.location.hash.startsWith(PREFIX) ? decodeURIComponent(window.location.hash.slice(PREFIX.length)) : null);

export function openTopic(id, rect) {
  origin = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
  if (topicFromHash() === id) return;
  window.location.hash = `${PREFIX}${encodeURIComponent(id)}`;
}

export function closeTopic() {
  if (!topicFromHash()) return;
  // came from inside the story → step back; opened from a shared link → just clear the hash
  if (window.history.state?.topicOpenedHere) window.history.back();
  else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export const takeOrigin = () => { const o = origin; origin = null; return o; };

export function useTopicRoute() {
  const [id, setId] = useState(topicFromHash);
  useEffect(() => {
    const on = () => {
      const next = topicFromHash();
      if (next && origin && !window.history.state?.topicOpenedHere) {
        window.history.replaceState({ topicOpenedHere: true }, '');
      }
      setId(next);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return id;
}
