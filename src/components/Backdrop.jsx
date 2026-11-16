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
  gold:      { front: '#EE8A45', lift: 1.0,  horizon: 0.34 }, // --ember-400
  amber:     { front: '#E27236', lift: 0.92, horizon: 0.3 },
  ember:     { front: '#D9652A', lift: 0.84, horizon: 0.26 }, // --ember-500
  dusk:      { front: '#B04A1F', lift: 0.74, horizon: 0.21 },
  night:     { front: '#7A3416', lift: 0.62, horizon: 0.15 }, // --clay-600
  afterglow: { front: '#D9652A', lift: 0.8,  horizon: 0.22 },
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
