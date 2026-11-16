import { useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

/*
 * Perspective tunnel, adapted from the 21st.dev "PerspectiveTunnelHero"
 * (golden-angle card layout + framer-motion z-travel + pointer parallax)
 * for this Vite/JS site: no Tailwind, DESIGN.md tokens, sized to its container
 * (it lives in the top of a pop-up card), and the flight loops on its own.
 * Wheel / drag over it scrubs the flight.
 */
const SPRING = { stiffness: 60, damping: 25, mass: 0.5 };
const LOOP_S = 16;

function useBox(ref) {
  const [box, setBox] = useState({ width: 640, height: 300 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setBox({ width: e.contentRect.width, height: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return box;
}

function usePointer(ref, enabled) {
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const x = useSpring(rx, SPRING);
  const y = useSpring(ry, SPRING);
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return undefined;
    const on = (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      rx.set(((e.clientX - r.left) / r.width - 0.5) * 2);
      ry.set(((e.clientY - r.top) / r.height - 0.5) * 2);
    };
    const off = () => { rx.set(0); ry.set(0); };
    el.addEventListener('pointermove', on, { passive: true });
    el.addEventListener('pointerleave', off);
    return () => { el.removeEventListener('pointermove', on); el.removeEventListener('pointerleave', off); };
  }, [ref, enabled, rx, ry]);
  return { x, y };
}

function Card({ img, i, total, progress, pointer, box, onPick }) {
  const golden = i * 137.5 * (Math.PI / 180);
  const rfx = 0.3 + (i % 3) * 0.06;
  const rfy = 0.24 + (i % 2) * 0.08;
  const rot = (i % 2 === 0 ? 1 : -1) * (3 + (i % 5) * 2);

  // each card enters at its own phase of the loop and wraps around
  const phase = useTransform(progress, (p) => (p + i / total) % 1);
  const z = useTransform(phase, [0, 1], [-1400, 380]);
  const opacity = useTransform(phase, [0, 0.15, 0.82, 0.97], [0, 1, 1, 0]);

  const w = Math.max(84, Math.min(150, box.width * 0.2));
  const bx = Math.cos(golden) * box.width * rfx;
  const by = Math.sin(golden) * box.height * rfy;
  const pan = 24;

  const transform = useTransform([z, pointer.x, pointer.y], ([cz, px, py]) =>
    `translate3d(calc(-50% + ${bx - px * pan}px), calc(-50% + ${by - py * pan}px), ${cz}px) rotateZ(${rot}deg)`);

  return (
    <motion.button
      type="button"
      className="tt-card"
      style={{ width: w, transform, opacity }}
      onClick={() => onPick(i)}
      tabIndex={-1}
      aria-hidden="true"
    >
      <img src={img.thumb} alt="" draggable={false} decoding="async" />
    </motion.button>
  );
}

export default function TopicTunnel({ images, reduce, onPick }) {
  const ref = useRef(null);
  const box = useBox(ref);
  const pointer = usePointer(ref, !reduce);
  const progress = useMotionValue(0);

  // endless slow flight; wheel / drag nudges it
  useEffect(() => {
    if (reduce) return undefined;
    let ctl;
    const run = () => {
      const from = progress.get() % 1;
      progress.jump(from);
      ctl = animate(progress, from + 1, { duration: LOOP_S, ease: 'linear', onComplete: run });
    };
    run();
    const el = ref.current;
    const nudge = (d) => { ctl?.stop(); progress.set(Math.max(0, progress.get() + d)); clearTimeout(nudge.t); nudge.t = setTimeout(run, 600); };
    const onWheel = (e) => { e.preventDefault(); nudge(e.deltaY * 0.0006); };
    let lastY = null;
    const onDown = (e) => { lastY = e.clientY; };
    const onMove = (e) => { if (lastY == null || e.pointerType === 'mouse') return; nudge((lastY - e.clientY) * 0.002); lastY = e.clientY; };
    const onUp = () => { lastY = null; };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      ctl?.stop(); clearTimeout(nudge.t);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [progress, reduce]);

  if (reduce) {
    return (
      <div className="tt-stage is-still" ref={ref}>
        {images.slice(0, 4).map((img, i) => (
          <button key={img.thumb} type="button" className="tt-still" onClick={() => onPick(i)} tabIndex={-1} aria-hidden="true">
            <img src={img.thumb} alt="" />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="tt-stage" ref={ref} style={{ perspective: '800px' }}>
      <div className="tt-grain" aria-hidden="true" />
      <div className="tt-ring tt-ring-a" aria-hidden="true" />
      <div className="tt-ring tt-ring-b" aria-hidden="true" />
      <div className="tt-space">
        {images.map((img, i) => (
          <Card key={img.thumb} img={img} i={i} total={images.length} progress={progress} pointer={pointer} box={box} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}
