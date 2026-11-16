import { DitheringShader } from './ui/dithering-shader';

/*
 * Fixed backdrop behind the whole story (z-backdrop): a dithered ember wave
 * (components/ui/dithering-shader) instead of a painted battlefield.
 * Light follows the story (DESIGN.md §4.2.3): beat by beat the glow sinks, cools and
 * dims — darkest at the surrender — by easing the shader's colours, never repainting.
 * The top of the screen always stays dark so text over it keeps its contrast.
 */
export const SKIES = ['gold', 'amber', 'ember', 'dusk', 'night', 'afterglow'];

/* front colour · how much of the field is lit · height of the glowing line */
const LIGHT = {
  gold:      { front: '#C9612A', lift: 0.7,  horizon: 0.2 },
  amber:     { front: '#B9552A', lift: 0.64, horizon: 0.18 },
  ember:     { front: '#A84A22', lift: 0.58, horizon: 0.16 },
  dusk:      { front: '#8E3E1B', lift: 0.5,  horizon: 0.13 },
  night:     { front: '#7A3416', lift: 0.42, horizon: 0.1 },  // --clay-600
  afterglow: { front: '#A84A22', lift: 0.55, horizon: 0.14 },
};

export default function Backdrop({ sky = 'gold' }) {
  const l = LIGHT[sky] ?? LIGHT.gold;
  return (
    <div className="backdrop" aria-hidden="true">
      <DitheringShader
        shape="wave"
        type="8x8"
        colorBack="#120A06" /* --ink-950 */
        colorFront={l.front}
        pxSize={3}
        speed={0.6}
        lift={l.lift}
        horizon={l.horizon}
        className="backdrop-dither"
      />
      <div className="vignette" />
    </div>
  );
}
