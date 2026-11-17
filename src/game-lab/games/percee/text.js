/* La Percée — bilingual copy that is not layout: night lines, tutorial hints, the facts a rallied rider tells you. */

export const NIGHT_LINES = [
  { fr: 'Les murs ne sont pas finis.', en: 'The walls are not finished.' },
  { fr: 'Ils ont bouché une brèche.', en: 'They have closed a gap.' },
  { fr: 'Les tours sont plus nombreuses.', en: 'There are more towers now.' },
  { fr: 'On entend creuser, même la nuit.', en: 'You can hear digging, even at night.' },
  { fr: 'Dernière brèche. Dernière chance.', en: 'Last gap. Last chance.' },
];

/* One fact per rallied rider. Sources: Caesar, Gallic War VII.69–76; archaeology where stated. */
export const FACTS = [
  { fr: 'César (VII.71) : avant la fin des travaux, Vercingétorix renvoie toute sa cavalerie, de nuit, chercher du secours dans chaque peuple.', en: 'Caesar (VII.71): before the works were finished, Vercingétorix sent all his cavalry away by night to fetch help from every nation.' },
  { fr: 'Selon César (VII.71), il restait du blé pour trente jours à peine dans Alésia.', en: 'According to Caesar (VII.71), Alésia had grain for barely thirty days.' },
  { fr: 'Les « lis » (VII.73) : des trous en quinconce, un pieu pointu au fond, cachés sous des branchages.', en: 'The “lilies” (VII.73): pits in a quincunx, a sharpened stake at the bottom, hidden under brushwood.' },
  { fr: 'César (VII.72) fait dresser des tours tous les 80 pieds, soit environ 24 mètres.', en: 'Caesar (VII.72) had towers raised every 80 feet, about 24 metres.' },
  { fr: 'Deux lignes : une vers la ville (environ 16 km), une vers l’extérieur (environ 21 km) contre l’armée de secours.', en: 'Two lines: one facing the town (about 16 km), one facing outward (about 21 km) against the relief army.' },
  { fr: 'Deux rivières, l’Ose et l’Oserain, coulent au pied du plateau d’Alésia.', en: 'Two rivers, the Ose and the Oserain, run at the foot of the Alésia plateau.' },
  { fr: 'Alésia était l’oppidum des Mandubiens, un peuple gaulois voisin des Éduens.', en: 'Alésia was the oppidum of the Mandubii, a Gallic people neighbouring the Aedui.' },
  { fr: 'César (VII.72) fait creuser deux fossés de 15 pieds de large ; l’un est rempli d’eau détournée de la rivière.', en: 'Caesar (VII.72) had two ditches dug, each 15 feet wide; one was filled with water diverted from the river.' },
  { fr: 'César (VII.76) chiffre l’armée de secours à 250 000 fantassins et 8 000 cavaliers : un nombre sans doute gonflé.', en: 'Caesar (VII.76) puts the relief army at 250,000 foot and 8,000 horse: a figure that is probably inflated.' },
  { fr: 'Le carnyx, trompe de guerre gauloise à tête d’animal : on en a retrouvé à Tintignac (Corrèze) en 2004.', en: 'The carnyx, a Gallic war horn with an animal head: several were found at Tintignac (Corrèze) in 2004.' },
  { fr: 'Devant les fossés, César décrit aussi des « cippes » (branches taillées en pointe) et des « aiguillons » de fer (VII.73).', en: 'In front of the ditches Caesar also describes “cippi” (sharpened branches) and iron “goads” (VII.73).' },
  { fr: 'Nous ne connaissons ce siège que par César lui-même : aucun récit gaulois ne nous est parvenu.', en: 'We know this siege only through Caesar himself: no Gallic account has survived.' },
  { fr: 'César (VII.69) installe son armée dans des camps reliés par 23 fortins autour de la ville.', en: 'Caesar (VII.69) placed his army in camps linked by 23 redoubts around the town.' },
  { fr: 'Le site d’Alésia est identifié à Alise-Sainte-Reine (Côte-d’Or) depuis les fouilles lancées sous Napoléon III.', en: 'Alésia is identified with Alise-Sainte-Reine (Côte-d’Or) since the excavations begun under Napoleon III.' },
  { fr: 'Les cavaliers partis devaient lever « tous ceux en âge de porter les armes » (VII.71).', en: 'The riders who left were to raise “all those of an age to bear arms” (VII.71).' },
];

/* night-1 tutorial: one idea at a time. `m` = mouse / keyboard, `t` = touch, `b` = big-screen console. */
export const HINTS = {
  move: {
    m: { fr: 'Bougez la souris pour regarder. W / Z ou ↑ pour avancer.', en: 'Move the mouse to look. W or ↑ to ride forward.' },
    t: { fr: 'Pouce gauche : avancer. Pouce droit : regarder autour.', en: 'Left thumb: ride. Right thumb: look around.' },
    b: { fr: 'Main gauche sur le manche pour avancer. Main droite : glissez sur le pavé pour regarder.', en: 'Left hand on the stick to ride. Right hand: slide on the pad to look around.' },
    d: { fr: 'Flèches ou ZQSD / WASD pour avancer sur la carte.', en: 'Arrow keys or WASD to ride across the map.' },
  },
  light: { fr: 'Restez hors des faisceaux. L’œil se remplit quand une sentinelle vous voit.', en: 'Stay out of the beams. The eye fills while a sentry can see you.' },
  rider: { fr: 'Colonne verte : un cavalier caché. Allez le rallier.', en: 'Green column: a hidden rider. Go and rally them.' },
  gallop: {
    m: { fr: 'Maj ou Espace : galop. Plus rapide, mais on vous entend.', en: 'Shift or Space: gallop. Faster, but they hear you.' },
    t: { fr: 'Bouton éclair : galop. Plus rapide, mais on vous entend.', en: 'Lightning button: gallop. Faster, but they hear you.' },
    b: { fr: 'Poussez le manche jusqu’à l’anneau doré (ou tenez l’éclair) : galop. Plus rapide, mais on vous entend.', en: 'Push the stick out to the gold ring (or hold the lightning button): gallop. Faster, but they hear you.' },
  },
  stone: {
    m: { fr: 'E (ou clic droit) : lancer une pierre. Les sentinelles regardent où elle tombe.', en: 'E (or right click): throw a stone. Sentries look where it lands.' },
    t: { fr: 'Bouton pierre : les sentinelles regardent où elle tombe.', en: 'Stone button: sentries look where it lands.' },
    b: { fr: 'Bouton pierre, au centre de la console : les sentinelles regardent où elle tombe.', en: 'Stone button, in the middle of the console: sentries look where it lands.' },
  },
  gap: { fr: 'Colonne dorée : une brèche. Franchissez les deux lignes avant l’aube.', en: 'Gold column: a gap. Cross both lines before dawn.' },
};

/* "how to play" on the intro and pause screens, big-screen console */
export const BIG_CONTROLS = [
  { fr: 'Tout se joue sur la console en bas de l’écran. Faites-la glisser par sa poignée pour l’avoir devant vous.', en: 'Everything is on the console at the bottom of the screen. Slide it by its handle so it sits in front of you.' },
  { fr: 'Main gauche : le manche pour avancer. Poussez jusqu’à l’anneau doré pour galoper.', en: 'Left hand: the stick to ride. Push it out to the gold ring to gallop.' },
  { fr: 'Main droite : glissez sur le pavé pour regarder (ou n’importe où sur l’image).', en: 'Right hand: slide on the pad to look around (or anywhere on the picture).' },
  { fr: 'Au milieu : galop, pierre, pause.', en: 'In the middle: gallop, stone, pause.' },
];

/* console labels */
export const BIG_LABELS = {
  stick: { fr: 'Avancer', en: 'Ride' },
  ring: { fr: 'anneau : galop', en: 'ring: gallop' },
  look: { fr: 'Regarder', en: 'Look' },
  move: { fr: 'Déplacer la console', en: 'Move the console' },
};

export const MEDALS = [
  null,
  { fr: 'Bronze', en: 'Bronze' },
  { fr: 'Argent', en: 'Silver' },
  { fr: 'Or', en: 'Gold' },
];
