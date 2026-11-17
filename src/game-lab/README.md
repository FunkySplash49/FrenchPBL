# Game lab — La Percée

The lab now holds a single game, **La Percée** (sneak a rider through the unfinished Roman lines
over 5 nights; borrowed from Metal Gear / Commandos stealth, Five Nights at Freddy’s, Cry of Fear
for the “Effroi” mode, and Minecraft seeds). The other prototypes (Tafl d’Alésia, Le mot gaulois,
Le conseil de Vercingétorix, Selon César ?, Tenir le rempart) were removed; they are in the git
history if ever needed.

Open: `npm run dev` → http://localhost:5173/game-lab.html. There is no picker: the page opens
straight into La Percée.

| URL | Opens |
|---|---|
| `/` (deployed) or `game-lab.html` | La Percée |
| `?g=percee` | the same (kept so old links work) |
| `?seed=…` | La Percée on that map (24 characters max) |
| `?bigscreen` / `?bigscreen=0` | force the big-screen console on / off |
| `?g=percee&board` | the class board alone, full screen (classroom screen) |

Files: `games/Percee.jsx` + `Percee.css` (React shell), `games/percee/*` (engine, three.js view,
input, audio, boards), `games/PerceeBoard.jsx` (the full-screen board), `kit.jsx` (frame, cards,
`useT`, `usePersist`).

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

## Design rules followed (from `research/`)

- One visible source + a “what this game simplifies” card at the end of every game (`Debrief`).
- Rome = squares / red, Gaul = circles / green — never used for right/wrong (gold and ember instead).
- 44px touch targets, haptics on phones, reduced-motion respected (no shake, instant moves).
- Leaderboard: per device (localStorage) with shareable seeds, plus the online class board below.

## La Percée class board (online)

Players type their name at the end of a run; the score goes to `/api/board` and the shared
"Classement de la classe" updates live (one row per name, best score kept). The full-screen board
for the classroom screen is `?g=percee&board` (refreshes every 15 s).

- Function source: `game-lab-api/board.mjs` (Vercel Node function, Upstash Redis over REST, no npm deps).
- Env on the `alesia-game-lab` Vercel project: `KV_REST_API_URL` + `KV_REST_API_TOKEN`
  (or `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`). Optional `ADMIN_KEY` enables reset.
- Local: `npm run dev` serves a mock `/api/board` (in memory; `/api/__dev/down` and `/api/__dev/up`
  simulate an outage). `npm run test:api` runs the handler tests.
- Deploy: `npm run deploy:lab` (builds, stages `.deploy/alesia-game-lab` with `api/board.mjs`,
  then `vercel deploy --prod`). `bash tools/deploy-lab.sh --dry-run` stages without uploading.
- Reset (needs `ADMIN_KEY` set on the project):
  `curl -X DELETE -H "x-admin-key: $ADMIN_KEY" https://alesia-game-lab.vercel.app/api/board`
  (add `?name=Some%20Name` to remove one row only).
