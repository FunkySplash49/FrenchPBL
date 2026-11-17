import { Suspense, lazy, memo, useCallback, useEffect, useRef, useState } from 'react';
import { LangProvider } from './lib/lang';
import { BEATS } from './data/beats';
import { ScrollTrigger, prefersReduced } from './lib/motion';
import Backdrop from './components/Backdrop';
import TopBar from './components/TopBar';
import Hero from './components/Hero';
import Beat from './components/Beat';
import Outro from './components/Outro';
import BeatRail from './components/BeatRail';
import { haptic } from './lib/haptics';
// LazyMotion + `m` components: the main page loads framer-motion's small core + DOM-animation
// features only; the topic page (lazy chunk) brings the rest when it is needed.
import { AnimatePresence, LazyMotion, domAnimation } from 'framer-motion';
import { useTopicRoute } from './lib/topic';
import { loadTopicView } from './lib/topic';

// Topic pages (component + researched text) load in their own chunk: fetched when the
// browser is idle after first paint, and again on the first hover / touch of a key word,
// so the dive never waits — but the first load of the story is lighter.
const TopicView = lazy(loadTopicView);

// The story's sections don't depend on the active step: memoised, so a step change while
// scrolling (each one passed in a fast fling) re-renders only the backdrop and the rail —
// not all 14 sections and their diagrams (15–27 ms per step change in a dev build on a
// laptop before this and lib/lang's stable context value; 0 ms after).
const StoryHero = memo(Hero);
const StoryBeat = memo(Beat);
const StoryOutro = memo(Outro);
const StoryTopBar = memo(TopBar);

const LAST = 13; // 0 = title, 1–12 = beats, 13 = sources

/* Keys that should not be hijacked when the reader is inside a control. */
function isInteractive(el) {
  return !!el?.closest?.('button, a, input, textarea, select, [role="tab"], [role="slider"], .term, .unit');
}

export default function App() {
  const [active, setActive] = useState(0);
  const topic = useTopicRoute();
  // the backdrop switches to a topic's picture a beat after the click — while the page's
  // text is popping in — and topic switches (in and back out) run at 0.8× speed
  const [bgTopic, setBgTopic] = useState(null);
  const [slowSwitch, setSlowSwitch] = useState(false);
  useEffect(() => {
    if (topic) {
      setSlowSwitch(true);
      const t = setTimeout(() => setBgTopic(topic), 1150);
      return () => clearTimeout(t);
    }
    setBgTopic(null);
    const t = setTimeout(() => setSlowSwitch(false), 2200); // until the switch back has played
    return () => clearTimeout(t);
  }, [topic]);
  const activeRef = useRef(0);
  activeRef.current = active;

  const onActive = useCallback((i) => setActive(i), []);

  const goTo = useCallback((i) => {
    const target = Math.max(0, Math.min(LAST, i));
    const el = document.getElementById(`beat-${target}`);
    if (!el) return;
    el.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'start' });
    el.focus({ preventScroll: true });
    setActive(target);
  }, []);
  const toStart = useCallback(() => goTo(0), [goTo]);
  const toFirst = useCallback(() => goTo(1), [goTo]);

  // Presenter keys (brief: "one scroll or key-press (→ / Space)")
  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const inside = isInteractive(e.target);
      if (e.key === 'ArrowRight' && !inside) { e.preventDefault(); goTo(activeRef.current + 1); }
      else if (e.key === 'ArrowLeft' && !inside) { e.preventDefault(); goTo(activeRef.current - 1); }
      else if (e.key === ' ' && !inside) { e.preventDefault(); goTo(activeRef.current + (e.shiftKey ? -1 : 1)); }
      else if (e.key === 'Home' && !inside) { e.preventDefault(); goTo(0); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo]);

  // Phones: swipe left / right to change step. Vertical scrolling stays native.
  useEffect(() => {
    let start = null;
    const onStart = (e) => {
      const t = e.touches[0];
      const blocked = e.touches.length > 1
        || e.target.closest?.('.tv, .is-zoomed, .tabs, .choices, .rail, .fx-chart, input, textarea');
      start = blocked ? null : { x: t.clientX, y: t.clientY, at: Date.now() };
    };
    const onEnd = (e) => {
      if (!start) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const quick = Date.now() - start.at < 700;
      start = null;
      if (quick && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) {
        haptic('tick');
        goTo(activeRef.current + (dx < 0 ? 1 : -1));
      }
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchend', onEnd);
    };
  }, [goTo]);

  // Re-measure scroll scenes whenever the story's height changes
  // (web fonts settling, language switch, the game result opening…).
  const storyRef = useRef(null);
  useEffect(() => {
    let t;
    const refresh = () => { clearTimeout(t); t = setTimeout(() => ScrollTrigger.refresh(), 150); };
    document.fonts?.ready.then(refresh);
    const ro = new ResizeObserver(refresh);
    if (storyRef.current) ro.observe(storyRef.current);
    return () => { clearTimeout(t); ro.disconnect(); };
  }, []);

  useEffect(() => {
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1500));
    const h = idle(() => loadTopicView(), { timeout: 4000 });
    return () => (window.cancelIdleCallback || clearTimeout)(h);
  }, []);

  // Off-screen steps: pause their looping CSS animations (flows, flickers, pulses).
  // Only what you can't see stops, so nothing looks different — it just stops costing.
  // Half a screen of margin: on a phone the compositor scrolls a frame or two ahead of this
  // observer, so a fling can't bring a step on screen before it is marked as on screen.
  useEffect(() => {
    const root = storyRef.current;
    if (!root || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => e.target.classList.toggle('is-offscreen', !e.isIntersecting));
    }, { rootMargin: '50% 0px' });
    root.querySelectorAll(':scope > section').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <LazyMotion features={domAnimation}>
    <LangProvider>
      <a href="#beat-1" className="skip-link">Aller au récit</a>
      <Backdrop step={active} topic={bgTopic} switchMs={slowSwitch ? 1250 : 1000} />
      <StoryTopBar onHome={toStart} />
      <main className="story" ref={storyRef}>
        <StoryHero onActive={onActive} onStart={toFirst} />
        {BEATS.map((b) => <StoryBeat key={b.n} beat={b} onActive={onActive} />)}
        <StoryOutro onActive={onActive} onTop={toStart} />
      </main>
      <BeatRail active={active} onJump={goTo} />
      <Suspense fallback={null}><AnimatePresence>{topic && <TopicView key={topic} id={topic} />}</AnimatePresence></Suspense>
    </LangProvider>
    </LazyMotion>
  );
}
