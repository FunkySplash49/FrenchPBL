import { useCallback, useEffect, useRef, useState } from 'react';
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
import { AnimatePresence } from 'framer-motion';
import { useTopicRoute } from './lib/topic';
import TopicView from './components/topic/TopicView';

const LAST = 13; // 0 = title, 1–12 = beats, 13 = sources

/* Keys that should not be hijacked when the reader is inside a control. */
function isInteractive(el) {
  return !!el?.closest?.('button, a, input, textarea, select, [role="tab"], [role="slider"], .term, .unit');
}

export default function App() {
  const [active, setActive] = useState(0);
  const topic = useTopicRoute();
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

  return (
    <LangProvider>
      <a href="#beat-1" className="skip-link">Aller au récit</a>
      <Backdrop step={active} />
      <TopBar onHome={() => goTo(0)} />
      <main className="story" ref={storyRef}>
        <Hero onActive={onActive} onStart={() => goTo(1)} />
        {BEATS.map((b) => <Beat key={b.n} beat={b} onActive={onActive} />)}
        <Outro onActive={onActive} onTop={() => goTo(0)} />
      </main>
      <BeatRail active={active} onJump={goTo} />
      <AnimatePresence>{topic && <TopicView key={topic} id={topic} />}</AnimatePresence>
    </LangProvider>
  );
}
