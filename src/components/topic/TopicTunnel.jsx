import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

/*
 * Perspective tunnel, adapted from the 21st.dev "PerspectiveTunnelHero"
 * (golden-angle card layout + framer-motion z-travel + pointer parallax)
 * for this Vite/JS site: no Tailwind, DESIGN.md tokens, sized to its container.
 *
 * `progress` is one continuous stream driven by the parent (fast during the
 * intro, then slowing into an ambient drift): card i is "born" at the far end
 * when progress reaches its stagger point, then cycles forever — one tunnel
 * length per unit of progress — so the flight never stops or restarts.
 */
const SPRING = { stiffness: 60, damping: 25, mass: 0.5 };
const STAGGER = 0.7; // births spread over the first 0.7 of progress

function useBox(ref) {
  const [box, setBox] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setBox({ width: e.contentRect.width, height: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return box;
}

function usePointer(enabled) {
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const x = useSpring(rx, SPRING);
  const y = useSpring(ry, SPRING);
  useEffect(() => {
    if (!enabled) return undefined;
    const on = (e) => {
      if (e.pointerType !== 'mouse') return;
      rx.set((e.clientX / window.innerWidth - 0.5) * 2);
      ry.set((e.clientY / window.innerHeight - 0.5) * 2);
    };
    window.addEventListener('pointermove', on, { passive: true });
    return () => window.removeEventListener('pointermove', on);
  }, [enabled, rx, ry]);
  return { x, y };
}

function Card({ img, i, total, progress, pointer, box, onPick }) {
  const golden = i * 137.5 * (Math.PI / 180);
  const rfx = 0.28 + (i % 3) * 0.08;
  const rfy = 0.26 + (i % 2) * 0.09;
  const rot = (i % 2 === 0 ? 1 : -1) * (3 + (i % 5) * 2);
  const mobile = box.width < 768;
  const born = (i / total) * STAGGER;

  const phase = useTransform(progress, (p) => (p < born ? -1 : (p - born) % 1));
  const z = useTransform(phase, (ph) => {
    const [far, near] = mobile ? [-1200, 350] : [-1700, 500];
    return far + Math.max(0, ph) * (near - far);
  });
  const opacity = useTransform(phase, (ph) => {
    if (ph < 0) return 0;
    if (ph < 0.15) return ph / 0.15;
    if (ph > 0.82) return Math.max(0, 1 - (ph - 0.82) / 0.16);
    return 1;
  });

  const w = mobile ? Math.max(120, Math.min(170, box.width * 0.38)) : Math.max(170, Math.min(260, box.width * 0.18));
  const bx = Math.cos(golden) * box.width * rfx;
  const by = Math.sin(golden) * box.height * rfy;
  const pan = mobile ? 20 : 45;

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

export default function TopicTunnel({ images, progress, reduce, onPick }) {
  const ref = useRef(null);
  const box = useBox(ref);
  const pointer = usePointer(!reduce);

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
    <div className="tt-stage" ref={ref} style={{ perspective: box.width < 768 ? '900px' : '1200px' }}>
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
