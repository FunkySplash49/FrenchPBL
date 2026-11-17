import { lazy } from 'react';

/*
 * Game registry. The lab now holds a single game, La Percée (lazy-loaded → its own chunk).
 * To put it in the story:  import { GAMES } from '../game-lab/registry'
 * and render <Suspense><Game /></Suspense> as a beat's visual (see README in this folder).
 */
export const GAMES = [
  {
    id: 'percee',
    title: { fr: 'La Percée', en: 'The Breakout' },
    pitch: { fr: 'Cartes générées à partir d’un code, 5 nuits, infiltration à travers les lignes romaines, classement.', en: 'Maps generated from a seed, 5 nights, sneaking through the Roman lines, leaderboard.' },
    component: lazy(() => import('./games/Percee')),
  },
];
