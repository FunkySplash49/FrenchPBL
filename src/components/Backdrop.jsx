import { CrtScenes } from './ui/crt-scenes';
import { SCENES } from '../data/scenes';

/*
 * Fixed backdrop behind the whole story (z-backdrop): one 19th-century history painting
 * per step, seen through a glowing old CRT (components/ui/crt-scenes) — saturated colour,
 * blooming highlights, scanlines. Moving to another step dissolves to its scene pixel by
 * pixel through a sparkle of static. The text cards are liquid glass (the shader bends and
 * frosts the picture behind them, with a haze so text stays readable); the title has its
 * own local scrim (.hero-inner).
 */
export default function Backdrop({ step = 0 }) {
  return (
    <div className="backdrop" aria-hidden="true">
      <CrtScenes
        scenes={SCENES}
        index={step}
        className="backdrop-crt"
        /* left text cards become liquid glass (refraction + haze drawn by the shader);
           the right-side boxes damp the picture around them and bleed their light into it */
        glassSelector=".story > section:not(.is-offscreen) .beat-copy.panel"
        glowSelector=".story > section:not(.is-offscreen) .beat-visual .viz:not(.is-zoomed)"
      />
      <div className="vignette" />
    </div>
  );
}
