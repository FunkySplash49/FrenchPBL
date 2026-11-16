/* French presenting vocabulary — from the research brief.
   French modes: the French word is shown, the tooltip gives English + pronunciation.
   English mode: the English `word` (or `forms[shownFrench]` for plurals) is shown,
   and the tooltip gives the reverse — the French word and how to say it. */
export const VOCAB = {
  guerre:      { fr: 'la guerre des Gaules', en: 'the Gallic War', say: 'lah gair day gohl', word: 'the Gallic War' },
  peuple:      { fr: 'peuple gaulois', en: 'a Gallic people / tribe', say: 'puh-pluh goh-lwah', word: 'Gallic people', forms: {'peuples gaulois': 'Gallic peoples' } },
  oppidum:     { fr: 'oppidum', en: 'a fortified hill-town (plural: oppida)', say: 'oh-pee-dom', word: 'fortified town', forms: {'oppida': 'fortified towns' } },
  proconsul:   { fr: 'proconsul', en: 'governor of a province, with an army', say: 'pro-kon-sul', word: 'governor' },
  legion:      { fr: 'légion', en: 'a legion', say: 'lay-zhyon', word: 'legion', forms: {'légions': 'legions' } },
  siege:       { fr: 'siège', en: 'the siege', say: 'syezh', word: 'siege' },
  'ligne-int': { fr: 'ligne intérieure', en: 'the inner line — faces the town', say: 'leen an-tay-ryur', word: 'inner line' },
  'ligne-ext': { fr: 'ligne extérieure', en: 'the outer line — faces the relief army', say: 'leen ex-tay-ryur', word: 'outer line' },
  fosse:       { fr: 'fossé', en: 'a ditch', say: 'foh-say', word: 'ditch', forms: {'fossés': 'ditches' } },
  rempart:     { fr: 'rempart', en: 'a rampart', say: 'rahm-par', word: 'rampart' },
  tour:        { fr: 'tour', en: 'a tower', say: 'toor', word: 'tower', forms: {'tours': 'towers' } },
  secours:     { fr: 'armée de secours', en: 'the relief army', say: 'lar-may duh suh-koor', word: 'relief army' },
  terre:       { fr: 'terre brûlée', en: 'scorched earth', say: 'lah tair brew-lay', word: 'scorched earth' },
  famine:      { fr: 'famine', en: 'famine', say: 'fah-meen', word: 'famine' },
  rendre:      { fr: 'se rend', en: 'surrenders (se rendre: to surrender)', say: 'suh rahn', word: 'surrenders' },
  cavalerie:   { fr: 'cavalerie', en: 'cavalry', say: 'kah-vahl-ree', word: 'cavalry' },
  triomphe:    { fr: 'triomphe', en: 'the triumph (victory parade)', say: 'tree-omf', word: 'triumph' },
  romanisation:{ fr: 'romanisation', en: 'romanisation', say: 'roh-mah-nee-zah-syon', word: 'romanisation' },
};
