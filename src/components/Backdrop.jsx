import { CrtScenes } from './ui/crt-scenes';
import { SCENES } from '../data/scenes';
import { TOPIC_SCENES } from '../data/topicScenes';

// story steps 0–13, then one scene per topic page (#/sujet/<id>)
const TOPIC_IDS = Object.keys(TOPIC_SCENES);
const ALL_SCENES = [...SCENES, ...TOPIC_IDS.map((id) => TOPIC_SCENES[id])];

/*
 * Fixed backdrop behind the whole story (z-backdrop): one 19th-century history painting
 * per step, seen through a glowing old CRT (components/ui/crt-scenes) — saturated colour,
 * blooming highlights, scanlines. Moving to another step dissolves to its scene pixel by
 * pixel through a sparkle of static. The text cards are liquid glass (the shader bends and
 * frosts the picture behind them, with a haze so text stays readable); the title has its
 * own local scrim (.hero-inner).
 */
export default function Backdrop({ step = 0, topic = null, switchMs = 1000 }) {
  // a key word's page shows its own picture: the backdrop switches to it with the same
  // pixel-by-pixel old-TV transition as scrolling between steps (and back on close)
  const t = topic ? TOPIC_IDS.indexOf(topic) : -1;
  const index = t >= 0 ? SCENES.length + t : step;
  return (
    <div className="backdrop" aria-hidden="true">
      <CrtScenes
        scenes={ALL_SCENES}
        index={index}
        warmCount={SCENES.length}
        switchMs={switchMs}
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
