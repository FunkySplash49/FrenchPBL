import { CrtScenes } from './ui/crt-scenes';
import { SCENES } from '../data/scenes';

/*
 * Fixed backdrop behind the whole story (z-backdrop): one 19th-century history painting
 * per step, seen through a glowing old CRT (components/ui/crt-scenes) — saturated colour,
 * blooming highlights, scanlines. Moving to another step dissolves to its scene pixel by
 * pixel through a sparkle of static. Text never sits on the raw picture: cards are opaque
 * and the title has its own local scrim (.hero-inner).
 */
export default function Backdrop({ step = 0 }) {
  return (
    <div className="backdrop" aria-hidden="true">
      <CrtScenes scenes={SCENES} index={step} className="backdrop-crt" />
      <div className="vignette" />
    </div>
  );
}
