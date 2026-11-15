/*
 * Hand-drawn, simplified map of Gaul (viewBox 0 0 400 420).
 * Infographic precision only — not a survey map.
 */
export const LAND =
  'M40,172 L62,160 L84,152 L104,150 L118,128 L124,116 L140,120 L162,110 L178,96 L192,70 L202,52 ' +
  'L224,42 L258,30 L282,40 L300,62 L318,92 L330,124 L348,146 L372,160 L388,188 L384,220 L366,240 L358,262 L366,300 ' +
  'L370,334 L352,352 L326,362 L300,366 L280,374 L258,372 L236,378 L216,392 L196,402 L168,398 ' +
  'L140,394 L112,392 L96,384 L92,352 L98,318 L104,290 L100,262 L92,238 L78,214 L60,196 L44,186 Z';

export const BRITAIN = 'M108,0 L176,0 L182,18 L168,34 L140,40 L118,34 L104,18 Z';

/* Regions are drawn larger than the land and clipped to it. */
export const REGIONS = [
  { id: 'belgae',    name: { fr: 'Belges', en: 'Belgae' },     label: [236, 78],
    d: 'M90,0 L400,0 L400,140 L300,126 L220,116 L150,106 L90,100 Z', year: 57 },
  { id: 'armorica',  name: { fr: 'Vénètes', en: 'Veneti' },    label: [84, 186],
    d: 'M0,100 L150,106 L140,150 L122,212 L0,232 Z', year: 56 },
  { id: 'aquitania', name: { fr: 'Aquitains', en: 'Aquitani' }, label: [128, 338],
    d: 'M0,232 L122,212 L170,292 L200,332 L190,420 L0,420 Z', year: 56 },
  { id: 'arverni',   name: { fr: 'Arvernes', en: 'Arverni' },  label: [176, 252],
    d: 'M150,106 L220,116 L238,200 L232,292 L200,332 L170,292 L122,212 L140,150 Z', year: 53 },
  { id: 'aedui',     name: { fr: 'Éduens', en: 'Aedui' },      label: [272, 222],
    d: 'M220,116 L300,126 L318,200 L322,240 L262,262 L232,292 L238,200 Z', year: 58 },
  { id: 'helvetii',  name: { fr: 'Helvètes', en: 'Helvetii' }, label: [350, 184],
    d: 'M300,126 L330,124 L400,140 L400,248 L322,240 L318,200 Z', year: 58 },
];

export const PROVINCE = {
  id: 'province', name: { fr: 'Province romaine', en: 'Roman Province' }, label: [292, 334],
  d: 'M200,332 L232,292 L262,262 L322,240 L400,248 L400,420 L190,420 Z',
};

export const RIVERS = [
  { id: 'rhin',  d: 'M262,36 Q296,66 316,102 T336,168' },
  { id: 'rhone', d: 'M336,214 Q312,232 300,256 T288,312 T276,368' },
  { id: 'seine', d: 'M268,170 Q236,148 214,140 T164,112' },
  { id: 'loire', d: 'M222,300 Q214,250 214,206 T150,182 T96,176' },
  { id: 'garonne', d: 'M176,392 Q150,350 132,320 T104,296' },
];

export const PLACES = {
  alesia:   { x: 262, y: 168, name: 'Alésia' },
  bibracte: { x: 250, y: 206, name: 'Bibracte' },
  gergovie: { x: 196, y: 262, name: 'Gergovie' },
  avaricum: { x: 196, y: 192, name: 'Avaricum' },
  geneve:   { x: 330, y: 220, name: 'Genève' },
};

/* Oppida dots — "about 60 peoples" (decorative, light up in beat 1). */
export const OPPIDA = [
  [70,170],[96,160],[110,196],[130,140],[150,124],[172,108],[196,84],[214,58],[240,52],[262,70],
  [284,92],[300,110],[318,140],[326,180],[300,180],[280,150],[256,128],[232,138],[210,120],[184,140],
  [160,170],[140,196],[120,232],[110,270],[130,300],[150,330],[140,364],[170,360],[178,318],[200,290],
  [214,236],[230,190],[250,186],[276,200],[296,220],[316,206],[340,236],[204,166],[166,224],[188,214],
  [246,240],[222,270],[146,262],[100,226],[86,200],[262,108],[226,92],[300,154],[170,384],[120,380],
];

/* Villages burned in 52 (beat 7) — around Bituriges / central Gaul. */
export const FIRES = [[178,176],[210,178],[186,206],[222,198],[170,200],[204,218],[234,174],[160,186],[214,152]];
