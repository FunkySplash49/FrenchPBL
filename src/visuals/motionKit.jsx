import { useEffect, useId, useState } from 'react';
import { REDUCED_QUERY } from '../lib/motion';
import { haptic } from '../lib/haptics';

/*
 * Army motion vocabulary, borrowed from ink-orbit-features and re-cut for Alésia:
 *   Packet   — a unit travelling along a path (Rome = square, Gaul = circle)
 *   Flow     — a dashed route that streams; brightens when "on"
 *   UnitTip  — a unit you can hover / focus / tap to name it
 *   Brackets — corner brackets that spread on hover around a diagram
 * Packets only exist while their diagram is on screen, and never under reduced motion.
 */

/** true while `ref` is on screen and the reader has not asked for reduced motion */
export function useLive(ref, threshold = 0.15) {
  const [onScreen, setOnScreen] = useState(false);
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(REDUCED_QUERY).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(REDUCED_QUERY);
    const sync = () => setReduced(mq.matches);
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver !== 'function') return undefined;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold]);

  return onScreen && !reduced;
}

/** A unit moving along `d`. shape: 'square' (Rome) | 'circle' (Gaul). fade: vanish part-way (starving supply). */
export function Packet({ d, shape = 'circle', dur = 2.4, begin = 0, size = 3.2, fade = false, className = '' }) {
  const timing = { dur: `${dur}s`, begin: `${begin}s`, repeatCount: 'indefinite' };
  const motion = <animateMotion path={d} {...timing} />;
  const fader = fade
    ? <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.45;0.7;1" {...timing} />
    : null;
  return shape === 'square' ? (
    <rect x={-size} y={-size} width={size * 2} height={size * 2} className={`pkt pkt-rome ${className}`}>
      {motion}{fader}
    </rect>
  ) : (
    <circle r={size} className={`pkt pkt-gaul ${className}`}>
      {motion}{fader}
    </circle>
  );
}

/** A route line. side colours it, on brightens it, dashed makes it stream. */
export function Flow({ d, side = 'neutral', on = false, dashed = true }) {
  return <path d={d} className={`flow flow-${side}${on ? ' is-on' : ''}${dashed ? ' is-dashed' : ''}`} />;
}

/**
 * Wrap a unit (camp, army, hub) so it can be named: hover/focus on desktop, tap on phones.
 * label is plain text; (x, y) is where the tip sits (above the unit).
 */
export function UnitTip({ label, x, y, children, className = '' }) {
  const [on, setOn] = useState(false);
  const id = useId();
  const w = Math.max(48, label.length * 6.6 + 16);
  return (
    <g
      className={`unit${on ? ' is-on' : ''} ${className}`}
      tabIndex={0}
      role="img"
      aria-label={label}
      onClick={() => { setOn((v) => !v); haptic('light'); }}
      onBlur={() => setOn(false)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setOn((v) => !v); } }}
      aria-describedby={id}
    >
      <g className="unit-body">{children}</g>
      <g className="unit-tip" id={id} transform={`translate(${x} ${y})`} aria-hidden="true">
        <rect x={-w / 2} y="-15" width={w} height="20" rx="3" />
        <text x="0" y="-1" textAnchor="middle">{label}</text>
      </g>
    </g>
  );
}

export function Brackets() {
  return (
    <>
      <span className="brk brk-tl" aria-hidden="true" />
      <span className="brk brk-tr" aria-hidden="true" />
      <span className="brk brk-bl" aria-hidden="true" />
      <span className="brk brk-br" aria-hidden="true" />
    </>
  );
}

/** cycle 0..n-1 every `ms` while live (the "sync one at a time" rhythm) */
export function useCycle(n, ms, live) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!live) return undefined;
    const t = setInterval(() => setI((v) => (v + 1) % n), ms);
    return () => clearInterval(t);
  }, [n, ms, live]);
  return i;
}

/** closed ellipse as a path (for packets travelling round a wall) */
export const ellipsePath = ({ cx, cy, rx, ry }) =>
  `M${cx - rx},${cy} a${rx},${ry} 0 1,0 ${rx * 2},0 a${rx},${ry} 0 1,0 ${-rx * 2},0`;

/** gentle curve from a hub to a point */
export const curve = ([x1, y1], [x2, y2], bend = 0.18) => {
  const mx = (x1 + x2) / 2 - (y2 - y1) * bend;
  const my = (y1 + y2) / 2 + (x2 - x1) * bend;
  return `M${x1},${y1} Q${mx},${my} ${x2},${y2}`;
};
