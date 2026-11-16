import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

/*
 * Perspective tunnel, adapted from the 21st.dev "PerspectiveTunnelHero"
 * (golden-angle card layout + framer-motion z-travel + pointer parallax)
 * for this Vite/JS site: no Tailwind, DESIGN.md tokens, sized to its container.
 *
 * `progress` is driven by the parent:
 *   0 → 1   intro flight: cards leave the far end one after another and fly past the camera
 *   1 → 3   ambient loop (repeats): cards keep drifting by behind the page title;
 *           `ambient` (0 → 1) fades them back in after the intro
 */
const SPRING = { stiffness: 60, damping: 25, mass: 0.5 };
const SPAN = 0.5;

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

function Card({ img, i, total, progress, ambient, pointer, box, onPick }) {
  const golden = i * 137.5 * (Math.PI / 180);
  const rfx = 0.28 + (i % 3) * 0.08;
  const rfy = 0.26 + (i % 2) * 0.09;
  const rot = (i % 2 === 0 ? 1 : -1) * (3 + (i % 5) * 2);
  const mobile = box.width < 768;
  const start = (i / total) * (1 - SPAN);

  const phase = useTransform(progress, (p) => (p <= 1
    ? Math.min(1, Math.max(0, (p - start) / SPAN))
    : ((p - 1) * 0.5 + i / total) % 1));
  const z = useTransform(phase, [0, 1], mobile ? [-1200, 350] : [-1700, 500]);
  const opacity = useTransform([phase, progress, ambient], ([ph, p, a]) => {
    const base = ph < 0.15 ? ph / 0.15 : ph > 0.82 ? Math.max(0, 1 - (ph - 0.82) / 0.16) : 1;
    return p <= 1 ? base : base * a;
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

export default function TopicTunnel({ images, progress, ambient, reduce, onPick }) {
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
          <Card key={img.thumb} img={img} i={i} total={images.length} progress={progress} ambient={ambient} pointer={pointer} box={box} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}
