/*
 * The 12-beat talk track — Alesia-Research-Brief-and-Team-Split.md
 * One beat = one date, one French sentence to say, one scroll / key-press.
 *
 * RULE (from the brief): every number shown here must appear in the brief's
 * "Key dates & numbers" table or its part notes, so the site and the talk never disagree.
 * Caesar's figures are always labelled "selon César".
 *
 * Every string is { fr, en, say? }.  {{key}} = vocabulary tooltip (data/vocab.js), *x* = italic.
 */

/* Presenters — replace the teammate letters with real first names. */
export const PRESENTERS = {
  aryan: 'Aryan',
  A: 'Équipier A',
  B: 'Équipier B',
  C: 'Équipier C',
};

export const PARTS = {
  1: { fr: 'Introduction — Pourquoi la guerre ?', en: 'Introduction — Why the war?', presenter: 'aryan' },
  2: { fr: 'La conquête (58–53 av. J.-C.)', en: 'The conquest (58–53 BC)', presenter: 'A' },
  3: { fr: 'Le grand soulèvement de 52', en: 'The great revolt of 52', presenter: 'B' },
  4: { fr: "Le siège d'Alésia", en: 'The siege of Alésia', presenter: 'C' },
  5: { fr: 'Conclusion — Et après ?', en: 'Conclusion — What came after?', presenter: 'aryan' },
};

export const BEATS = [
  /* ── Partie 1 · Aryan ─────────────────────────────────────── */
  {
    n: 1, part: 1, sky: 'gold',
    date: { fr: '58 av. J.-C.', en: '58 BC' },
    title: { fr: 'La Gaule avant César', en: 'Gaul before Caesar' },
    line: {
      fr: 'La Gaule : 60 peuples, riches, mais divisés.',
      en: 'Gaul: 60 peoples, rich, but divided.',
      say: 'lah gohl : swah-sahnt puh-pluh, reesh, mai dee-vee-zay',
    },
    body: [
      {
        fr: "Entre le Rhin, les Alpes et l'océan vivent environ 60 {{peuple|peuples gaulois}} indépendants : Arvernes, Éduens, Séquanes, Helvètes, Belges… Ils cultivent, frappent des monnaies et habitent des villes fortifiées sur les hauteurs, les {{oppidum|oppida}}.",
        en: 'Between the Rhine, the Alps and the ocean live about 60 independent {{peuple|peuples gaulois}}: Arvernes, Éduens, Séquanes, Helvètes, Belges… They farm, mint coins and live in fortified hill-towns, the {{oppidum|oppida}}.',
      },
      {
        fr: "Mais ils ne forment pas une nation : des tribus rivales s'allient même avec l'étranger contre leurs voisins. Au sud, Rome tient déjà « la Province » depuis 121 av. J.-C.",
        en: 'But they are not one nation: rival tribes even ally with outsiders against their neighbours. In the south, Rome has held "the Province" since 121 BC.',
      },
    ],
    visual: { kind: 'map', mode: 'tribes' },
  },
  {
    n: 2, part: 1, sky: 'gold',
    date: { fr: '58 av. J.-C.', en: '58 BC' },
    title: { fr: 'César, un proconsul endetté', en: 'Caesar, a proconsul in debt' },
    line: {
      fr: "César a des dettes et de l'ambition. Il lui faut une guerre.",
      en: 'Caesar has debts and ambition. He needs a war.',
      say: "say-zar ah day det ay duh lahm-bee-syon. eel lwee foh tewn gair",
    },
    body: [
      {
        fr: "Son consulat de 59 av. J.-C. l'a ruiné : à Rome, les élections se gagnent à coups de pots-de-vin. Allié à Pompée et Crassus, deux grands généraux, il lui faut sa propre gloire militaire — et une armée fidèle.",
        en: 'His consulship of 59 BC left him heavily in debt: Roman elections ran on bribery. Allied with Pompey and Crassus, two famous generals, he needs military glory of his own — and a loyal army.',
      },
      {
        fr: "Devenu {{proconsul}} des Gaules, il ne peut plus être poursuivi en justice. La raison officielle de la guerre ? Protéger Rome. Pour la plupart des historiens, c'est la justification, pas la cause.",
        en: 'As {{proconsul}} of Gaul he cannot be prosecuted. The official reason for the war? Protecting Rome. Most historians see that as the justification, not the cause.',
      },
    ],
    visual: { kind: 'caesar' },
  },
  {
    n: 3, part: 1, sky: 'gold',
    date: { fr: '58 av. J.-C.', en: '58 BC' },
    title: { fr: 'Le prétexte : les Helvètes', en: 'The pretext: the Helvetii' },
    line: {
      fr: "Les Helvètes migrent : c'est le prétexte.",
      en: 'The Helvetii migrate: that is the pretext.',
      say: 'lay zel-vet mee-gruh : say luh pray-text',
    },
    body: [
      {
        fr: "Poussés par les peuples germaniques, les Helvètes (la Suisse actuelle) veulent partir vers l'ouest en traversant la Province. César les bloque sur le Rhône.",
        en: "Pressed by Germanic peoples, the Helvetii (today's Switzerland) plan to migrate west through the Roman Province. Caesar blocks them at the Rhône.",
      },
      {
        fr: "Ils passent alors par le pays des Éduens, alliés de Rome, qui appellent César à l'aide. Il a son invitation : la guerre commence pour « protéger des alliés »… et finira par tout conquérir.",
        en: 'They take another route through the land of the Éduens, Rome\'s allies, who call Caesar for help. He has his invitation: the war starts as "protecting allies"… and ends up conquering everything.',
      },
    ],
    handover: {
      fr: 'César a son prétexte. La conquête commence.',
      en: 'Caesar has his pretext. The conquest begins.',
      say: 'say-zar ah sohn pray-text. lah kon-kait koh-mahns',
    },
    visual: { kind: 'map', mode: 'helvetii' },
  },

  /* ── Partie 2 · Équipier A ────────────────────────────────── */
  {
    n: 4, part: 2, sky: 'amber',
    date: { fr: '57–56 av. J.-C.', en: '57–56 BC' },
    title: { fr: 'Diviser pour régner', en: 'Divide and rule' },
    line: {
      fr: 'César bat les peuples un par un.',
      en: 'Caesar defeats the peoples one by one.',
      say: 'say-zar bah lay puh-pluh uhn par uhn',
    },
    body: [
      {
        fr: "58 : les Helvètes, puis le roi germain Arioviste. 57 : les Belges — les Nerviens manquent de détruire son armée. 56 : victoire navale sur les Vénètes, puis l'Aquitaine.",
        en: '58: the Helvetii, then the Germanic king Ariovistus. 57: the Belgae — the Nervii nearly destroy his army. 56: a naval victory over the Veneti, then Aquitaine.',
      },
      {
        fr: "Les Éduens et les Rèmes se rangent du côté de Rome, et César utilise la {{cavalerie}} gauloise contre d'autres Gaulois. Ses atouts : des {{legion|légions}} professionnelles, des ingénieurs et des marches rapides.",
        en: 'The Éduens and the Rèmes side with Rome, and Caesar uses Gallic {{cavalerie}} against other Gauls. His strengths: professional {{legion|légions}}, engineers and fast marches.',
      },
    ],
    visual: { kind: 'map', mode: 'conquest' },
  },
  {
    n: 5, part: 2, sky: 'amber',
    date: { fr: '55–54 av. J.-C.', en: '55–54 BC' },
    title: { fr: 'Le Rhin et la Bretagne', en: 'The Rhine and Britain' },
    line: {
      fr: 'Il traverse le Rhin et va en Bretagne, pour impressionner Rome.',
      en: 'He crosses the Rhine and goes to Britain, to impress Rome.',
      say: 'eel trah-vairs luh ran ay vah ahn bruh-tah-nyuh, poor an-pray-syo-nay rom',
    },
    body: [
      {
        fr: "En 55, ses ingénieurs jettent un pont sur le Rhin en 10 jours ; la même année, il débarque en Bretagne (la Grande-Bretagne), et y retourne en 54. Peu de terres gagnées — mais Rome est éblouie.",
        en: 'In 55 his engineers bridge the Rhine in 10 days; the same year he lands in Britain, and goes back in 54. Little land is gained — but Rome is amazed.',
      },
      {
        fr: "Chaque hiver, César envoie ses rapports à Rome. Ils deviendront son livre, *La Guerre des Gaules* : sa propre publicité. Mais à l'hiver 54, Ambiorix détruit une légion et demie. Les Gaulois peuvent battre Rome.",
        en: 'Every winter Caesar sends his reports to Rome. They become his book, *The Gallic War*: his own PR. But in winter 54, Ambiorix destroys a legion and a half. Gauls can beat Rome.',
      },
    ],
    handover: {
      fr: 'Mais en 52, toute la Gaule se soulève.',
      en: 'But in 52, all of Gaul rises up.',
      say: 'mai ahn sank-ahnt-duh, toot lah gohl suh soo-lev',
    },
    visual: { kind: 'rhine' },
  },

  /* ── Partie 3 · Équipier B ────────────────────────────────── */
  {
    n: 6, part: 3, sky: 'ember',
    date: { fr: '52 av. J.-C.', en: '52 BC' },
    title: { fr: 'Un chef pour toute la Gaule', en: 'One leader for all Gaul' },
    line: {
      fr: 'Vercingétorix unit la Gaule.',
      en: 'Vercingétorix unites Gaul.',
      say: 'vair-san-zhay-toh-reeks ew-nee lah gohl',
    },
    body: [
      {
        fr: "Jeune noble arverne, né vers 82 av. J.-C. Chassé de Gergovie par les anciens, il lève une armée de pauvres, reprend la ville et se fait proclamer roi. À Bibracte, un conseil en fait le chef suprême.",
        en: 'A young Arverne noble, born around 82 BC. Expelled from Gergovie by cautious elders, he raises an army of the poor, retakes the town and is hailed as king. At Bibracte a council makes him supreme commander.',
      },
      {
        fr: "Il frappe au bon moment : César est en Italie du Nord, et ses légions sont coupées dans leurs camps d'hiver. Pour la première fois, presque toute la Gaule se bat derrière un seul chef.",
        en: 'He strikes at the right moment: Caesar is in northern Italy and his legions are cut off in their winter camps. For the first time, most of Gaul fights behind one leader.',
      },
    ],
    visual: { kind: 'map', mode: 'revolt', card: 'vercingetorix' },
  },
  {
    n: 7, part: 3, sky: 'ember',
    date: { fr: 'Printemps 52 av. J.-C.', en: 'Spring 52 BC' },
    title: { fr: 'La terre brûlée', en: 'Scorched earth' },
    line: {
      fr: "La terre brûlée, puis le massacre d'Avaricum.",
      en: 'Scorched earth, then the massacre of Avaricum.',
      say: "lah tair brew-lay, pwee luh mah-sah-kruh dah-vah-ree-kom",
    },
    body: [
      {
        fr: "Pas de grande bataille contre les légions : la cavalerie harcèle les Romains qui cherchent des vivres, et l'on brûle villages, récoltes et villes. C'est la {{terre}} : affamer une armée qui vit sur le pays.",
        en: 'No pitched battles against the legions: cavalry harass Roman foraging parties, and villages, crops and towns are burned. This is {{terre}}: starve an army that lives off the land.',
      },
      {
        fr: "Mais les Bituriges le supplient d'épargner leur belle ville, Avaricum (Bourges). Il cède, contre son avis. Après environ 25 jours de siège, les Romains la prennent : selon César, environ 800 personnes sur quelque 40 000 s'échappent.",
        en: 'But the Bituriges beg him to spare their beautiful town, Avaricum (Bourges). He gives in, against his own judgement. After about 25 days of siege the Romans storm it: according to Caesar, only around 800 of some 40,000 people escape.',
      },
    ],
    facts: [
      { value: '~40 000', label: { fr: 'habitants (selon César)', en: 'inhabitants (per Caesar)' } },
      { value: '~800', label: { fr: 'survivants', en: 'escape' } },
    ],
    visual: { kind: 'map', mode: 'burn' },
  },
  {
    n: 8, part: 3, sky: 'ember',
    date: { fr: 'Début de l’été 52 av. J.-C.', en: 'Early summer 52 BC' },
    title: { fr: 'Gergovie : César battu', en: 'Gergovie: Caesar beaten' },
    line: {
      fr: 'À Gergovie, César perd !',
      en: 'At Gergovie, Caesar loses!',
      say: 'ah zhair-goh-vee, say-zar pair !',
    },
    body: [
      {
        fr: "César attaque la capitale arverne, près de Clermont-Ferrand. L'assaut échoue : il avoue lui-même avoir perdu 46 centurions et environ 700 hommes — les historiens pensent que c'est davantage. C'est sa seule grande défaite en Gaule. Même les Éduens, les plus vieux alliés de Rome, changent de camp.",
        en: "Caesar attacks the Arverne capital, near Clermont-Ferrand. The assault fails: he himself admits losing 46 centurions and about 700 men — modern estimates are higher. It is his only major defeat in Gaul. Even the Éduens, Rome's oldest allies, switch sides.",
      },
      {
        fr: "Puis l'erreur : en juillet, Vercingétorix attaque la colonne romaine en marche. La cavalerie germanique de César met ses cavaliers en déroute. Plutôt que de risquer une bataille, il se replie sur un {{oppidum}} : Alésia.",
        en: "Then the mistake: in July Vercingétorix attacks Caesar's marching column. Caesar's Germanic cavalry rout the Gallic horsemen. Rather than risk a battle, he falls back to an {{oppidum}}: Alésia.",
      },
    ],
    handover: {
      fr: "Vercingétorix se réfugie à Alésia. C'est là que tout va se jouer.",
      en: 'Vercingétorix takes refuge in Alésia. That is where everything will be decided.',
      say: "vair-san-zhay-toh-reeks suh ray-few-zhee ah ah-lay-zyah. say lah kuh toot vah suh zhoo-ay",
    },
    visual: { kind: 'gergovie' },
  },

  /* ── Partie 4 · Équipier C ────────────────────────────────── */
  {
    n: 9, part: 4, sky: 'dusk',
    date: { fr: 'Août 52 av. J.-C.', en: 'August 52 BC' },
    title: { fr: 'Deux murs autour d’Alésia', en: 'Two walls around Alésia' },
    line: {
      fr: "Vercingétorix s'enferme à Alésia. César construit deux murs.",
      en: 'Vercingétorix shuts himself inside Alésia. Caesar builds two walls.',
      say: 'vair-san-zhay-toh-reeks sahn-fairm ah ah-lay-zyah. say-zar kon-strwee duh mewr',
    },
    body: [
      {
        fr: "Sur le Mont-Auxois, entre l'Ose et l'Oserain : environ 80 000 hommes selon César. Avant que l'anneau ne se ferme, Vercingétorix envoie sa cavalerie soulever toute la Gaule. César, avec 10 à 11 légions, ne donne pas l'assaut — Gergovie a prouvé que c'est perdu d'avance. Il va les affamer.",
        en: 'On Mont-Auxois, between the Ose and the Oserain: about 80,000 men according to Caesar. Before the ring closes, Vercingétorix sends his cavalry away to raise all of Gaul. Caesar, with 10–11 legions, does not attack — Gergovie proved that fails. He will starve them out.',
      },
      {
        fr: "Une {{ligne-int}} d'environ 16 km face à la ville, avec 23 forts. Puis une {{ligne-ext}} d'environ 21 km face à l'{{secours}}. Devant : {{fosse|fossés}}, {{rempart}}, {{tour|tours}}, et des pièges que les soldats surnomment les « lis ».",
        en: 'A {{ligne-int}} of about 16 km facing the town, with 23 forts. Then a {{ligne-ext}} of about 21 km facing the {{secours}}. In front: {{fosse|fossés}}, a {{rempart}}, {{tour|tours}}, and traps the soldiers nicknamed "lilies".',
      },
    ],
    facts: [
      { value: '16 km', label: { fr: 'ligne intérieure · 23 forts', en: 'inner line · 23 forts' } },
      { value: '21 km', label: { fr: 'ligne extérieure', en: 'outer line' } },
      { value: '10–11', label: { fr: 'légions romaines', en: 'Roman legions' } },
    ],
    visual: { kind: 'alesia', mode: 'build' },
  },
  {
    n: 10, part: 4, sky: 'dusk',
    date: { fr: 'Septembre 52 av. J.-C.', en: 'September 52 BC' },
    title: { fr: 'La faim dedans, le secours dehors', en: 'Hunger inside, help outside' },
    line: {
      fr: "La famine à l'intérieur, l'armée de secours à l'extérieur.",
      en: 'Famine inside, the relief army outside.',
      say: "lah fah-meen ah lan-tay-ryur, lar-may duh suh-koor ah lex-tay-ryur",
    },
    body: [
      {
        fr: "Les vivres — environ 30 jours — s'épuisent. Les Mandubiens chassent de la ville leurs vieillards, leurs malades, leurs femmes et leurs enfants. César refuse de les laisser passer : ils meurent de faim entre les lignes.",
        en: 'The food — about 30 days\' supply — runs out. The Mandubii push their own old, sick, women and children out of the town. Caesar refuses to let them through: they starve between the lines.',
      },
      {
        fr: "Puis l'{{secours}} arrive : 250 000 fantassins et 8 000 cavaliers selon César ; les historiens pensent plutôt 50 000 à 100 000. Une bataille de cavalerie, puis une attaque de nuit sur les deux murs : les deux échouent.",
        en: 'Then the {{secours}} arrives: 250,000 infantry and 8,000 cavalry according to Caesar; historians think 50,000–100,000 is more realistic. A cavalry battle, then a night attack on both walls: both fail.',
      },
    ],
    facts: [
      { value: '250 000', label: { fr: 'selon César', en: 'per Caesar' } },
      { value: '50–100 000', label: { fr: 'selon les historiens', en: 'per historians' } },
    ],
    visual: { kind: 'alesia', mode: 'famine' },
  },
  {
    n: 11, part: 4, sky: 'night',
    date: { fr: 'Septembre 52 av. J.-C.', en: 'September 52 BC' },
    title: { fr: 'La dernière attaque', en: 'The final attack' },
    line: {
      fr: 'La dernière attaque échoue. Vercingétorix se rend.',
      en: 'The final attack fails. Vercingétorix surrenders.',
      say: 'lah dair-nyair ah-tahk ay-shoo. vair-san-zhay-toh-reeks suh rahn',
    },
    body: [
      {
        fr: "Vercassivellaunos, cousin de Vercingétorix, mène 60 000 hommes d'élite contre le point faible : un camp mal placé sur la colline nord-ouest, le Mont Réa. Au même moment, Vercingétorix attaque de l'intérieur.",
        en: "Vercassivellaunos, Vercingétorix's cousin, leads 60,000 picked men against the weak spot: a badly placed camp on the north-west hill, Mont Réa. At the same moment, Vercingétorix attacks from inside.",
      },
      {
        fr: "Imaginez : vous êtes César. À vous de jouer.",
        en: 'Imagine: you are Caesar. Your move.',
      },
    ],
    handover: {
      fr: 'Le lendemain, Vercingétorix se rend. Mais que s’est-il vraiment passé ?',
      en: 'The next day, Vercingétorix surrenders. But what really happened?',
      say: 'luh lahn-duh-man, vair-san-zhay-toh-reeks suh rahn. mai kuh set-eel vrai-mahn pah-say ?',
    },
    visual: { kind: 'game' },
  },

  /* ── Partie 5 · Aryan ─────────────────────────────────────── */
  {
    n: 12, part: 5, sky: 'afterglow',
    date: { fr: '46 av. J.-C. → aujourd’hui', en: '46 BC → today' },
    title: { fr: 'Et après ?', en: 'What came after?' },
    line: {
      fr: 'La Gaule devient romaine. Et la France fait de Vercingétorix un héros.',
      en: 'Gaul becomes Roman. And France turns Vercingétorix into a hero.',
      say: 'lah gohl duh-vyan roh-men. ay lah frahns feh duh vair-san-zhay-toh-reeks uhn ay-roh',
    },
    body: [
      {
        fr: "Vercingétorix passe environ six ans en prison à Rome. Il est exhibé au {{triomphe}} de César en 46 av. J.-C., puis exécuté. Selon Plutarque et Appien, un million de Gaulois tués et un million réduits en esclavage : sans doute exagéré, mais la dévastation est réelle.",
        en: "Vercingétorix spends about six years in prison in Rome. He is paraded in Caesar's {{triomphe}} in 46 BC, then executed. Plutarch and Appian claim one million Gauls killed and one million enslaved: probably inflated, but the devastation was real.",
      },
      {
        fr: "Riche et suivi d'une armée fidèle, César franchit le Rubicon en 49 et devient dictateur. La Gaule devient provinces romaines en 27 av. J.-C. : c'est la {{romanisation}}. En 1865, Napoléon III fait dresser une statue géante de Vercingétorix à Alise-Sainte-Reine.",
        en: 'Rich and backed by a loyal army, Caesar crosses the Rubicon in 49 and becomes dictator. Gaul becomes Roman provinces in 27 BC: {{romanisation}}. In 1865 Napoléon III puts up a giant statue of Vercingétorix at Alise-Sainte-Reine.',
      },
    ],
    visual: { kind: 'legacy' },
  },
];
