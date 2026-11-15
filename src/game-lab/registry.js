import { lazy } from 'react';

/*
 * Game registry. Each entry is a self-contained component (lazy-loaded → its own chunk).
 * (games/Rempart.jsx — Into the Breach — was parked unfinished and is not listed.)
 * To put a game in the story:  import { GAMES } from '../game-lab/registry'
 * and render <Suspense><Game /></Suspense> as a beat's visual (see README in this folder).
 */
export const GAMES = [
  {
    id: 'wordle',
    title: { fr: 'Le mot gaulois', en: 'The Gaulish word' },
    inspired: 'Wordle',
    depth: 'simple',
    minutes: 2,
    pitch: { fr: 'Devinez un mot français venu du gaulois, en 6 essais.', en: 'Guess a French word that comes from Gaulish, in 6 tries.' },
    component: lazy(() => import('./games/MotGaulois')),
  },
  {
    id: 'tafl',
    title: { fr: 'Tafl d’Alésia', en: 'Alésia Tafl' },
    inspired: 'Hnefatafl (Viking siege board game) · low-poly 3D',
    depth: 'complex',
    minutes: 5,
    pitch: { fr: 'Jeu de plateau asymétrique : Vercingétorix doit percer l’encerclement romain.', en: 'Asymmetric board game: Vercingétorix must break the Roman ring.' },
    component: lazy(() => import('./games/Tafl')),
  },
  {
    id: 'reigns',
    title: { fr: 'Le conseil de Vercingétorix', en: 'Vercingétorix’s council' },
    inspired: 'Reigns',
    depth: 'simple',
    minutes: 3,
    pitch: { fr: 'Glissez à gauche ou à droite : chaque décision pèse sur les vivres, le moral, les alliés et l’armée.', en: 'Swipe left or right: every decision weighs on food, morale, allies and army.' },
    component: lazy(() => import('./games/Conseil')),
  },
  {
    id: 'papers',
    title: { fr: 'Selon César ?', en: 'According to Caesar?' },
    inspired: 'Papers, Please',
    depth: 'simple',
    minutes: 3,
    pitch: { fr: 'Inspectez les témoignages et tamponnez : fiable, exagéré ou légende.', en: 'Inspect the testimonies and stamp them: reliable, exaggerated or legend.' },
    component: lazy(() => import('./games/SelonCesar')),
  },
  {
    id: 'percee',
    title: { fr: 'La Percée', en: 'The Breakout' },
    inspired: 'Metal Gear / Commandos stealth + Five Nights at Freddy’s dread + Minecraft seeds',
    depth: 'ultimate',
    minutes: 8,
    pitch: { fr: 'Projet principal : cartes générées à partir d’un code, 5 nuits, infiltration à travers les lignes romaines, classement.', en: 'Main project: maps generated from a seed, 5 nights, sneaking through the Roman lines, leaderboard.' },
    component: lazy(() => import('./games/Percee')),
  },
];
