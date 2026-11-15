# Game lab — Alésia mini-games

Open: `npm run dev` → http://localhost:5173/game-lab.html (`?g=<id>` opens one game, `?seed=` sets La Percée's map).

| id | Game | Borrowed from | Depth |
|---|---|---|---|
| `percee` | **La Percée** — sneak a rider through the unfinished Roman lines over 5 nights | Metal Gear / Commandos stealth, Five Nights at Freddy’s, Cry of Fear (“Effroi” mode), Minecraft seeds | ★ main project |
| `tafl` | **Tafl d’Alésia** — the siege as a low-poly 3D board game, AI or 2 players | Hnefatafl | complex (three.js) |
| `wordle` | **Le mot gaulois** — guess a French word of Gaulish origin | Wordle | simple |
| `reigns` | **Le conseil de Vercingétorix** — 12 swipe decisions of 52 BC | Reigns | simple |
| `papers` | **Selon César ?** — stamp testimonies reliable / doubtful / legend | Papers, Please | simple |
| `breach` | **Tenir le rempart** — telegraphed Gallic attacks on 7 wall sections; pilum, shield, push into the lilies | Into the Breach | complex |


## Putting a game in the story

Every game is a self-contained component rendered in the same `.viz` panel as the story diagrams.
In `src/components/Beat.jsx`, add a visual kind, e.g.:

```jsx
import { Suspense } from 'react';
import { GAMES } from '../game-lab/registry';
const Percee = GAMES.find((g) => g.id === 'percee').component;
// …
case 'game-percee': return <Suspense fallback={null}><Percee /></Suspense>;
```

and set `visual: { kind: 'game-percee' }` on a beat in `src/data/beats.js`. Games are lazy-loaded, so they cost nothing until the step is reached.
Games stop arrow/space keys from reaching the story’s step navigation while they have focus.

## Design rules followed (from `research/`)

- One visible source + a “what this game simplifies” card at the end of every game (`Debrief`).
- No points or speed scores attached to suffering; no timers on the history-judgement game.
- Rome = squares / red, Gaul = circles / green — never used for right/wrong (gold and ember instead).
- 44px touch targets, haptics on phones, reduced-motion respected (no shake, instant moves).
- Leaderboard (La Percée) is per device (localStorage) with shareable seeds; a shared online board would need a small backend.
