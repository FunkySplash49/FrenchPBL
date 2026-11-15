/*
 * Picture previews for key words — used as [[id]] or [[id|shown text]] in story strings.
 * Images: Wikimedia Commons thumbnails (330px), loaded only on first hover/tap.
 * `file` is the Commons file page, linked from the card for attribution.
 */
const T = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/';
const C = 'https://commons.wikimedia.org/wiki/File:';
const W = 'https://fr.wikipedia.org/wiki/';

export const PREVIEWS = {
  cesar: {
    url: `${W}Jules_C%C3%A9sar`,
    img: `${T}6/62/Retrato_de_Julio_C%C3%A9sar_%2826724093101%29_%28cropped%29.jpg/330px-Retrato_de_Julio_C%C3%A9sar_%2826724093101%29_%28cropped%29.jpg`,
    file: `${C}Retrato_de_Julio_C%C3%A9sar_(26724093101)_(cropped).jpg`,
    pos: 'center 25%',
    caption: { fr: 'Jules César (100–44 av. J.-C.), général et homme politique romain.', en: 'Julius Caesar (100–44 BC), Roman general and politician.' },
  },
  vercingetorix: {
    url: `${W}Vercing%C3%A9torix`,
    img: `${T}3/3c/Vercing%C3%A9torix_stat%C3%A8re_Gallica_avers.jpg/330px-Vercing%C3%A9torix_stat%C3%A8re_Gallica_avers.jpg`,
    file: `${C}Vercing%C3%A9torix_stat%C3%A8re_Gallica_avers.jpg`,
    pos: 'center',
    caption: { fr: 'Statère d’or arverne au nom de Vercingétorix.', en: 'Arverni gold stater bearing Vercingétorix’s name.' },
  },
  plutarque: {
    url: `${W}Plutarque`,
    img: `${T}3/34/Plutarch_of_Chaeronea-03.jpg/330px-Plutarch_of_Chaeronea-03.jpg`,
    file: `${C}Plutarch_of_Chaeronea-03.jpg`,
    pos: 'center 25%',
    caption: { fr: 'Plutarque, auteur grec, écrit environ 150 ans après Alésia.', en: 'Plutarch, a Greek writer, about 150 years after Alésia.' },
  },
  alesia: {
    url: `${W}Si%C3%A8ge_d%27Al%C3%A9sia`,
    img: `${T}c/c8/Alise-Sainte-Reine_-_Vue_depuis_la_rue_des_Braux.jpg/330px-Alise-Sainte-Reine_-_Vue_depuis_la_rue_des_Braux.jpg`,
    file: `${C}Alise-Sainte-Reine_-_Vue_depuis_la_rue_des_Braux.jpg`,
    pos: 'center',
    caption: { fr: 'Alise-Sainte-Reine (Côte-d’Or), au pied du Mont-Auxois.', en: 'Alise-Sainte-Reine (Côte-d’Or), below Mont-Auxois.' },
  },
  gergovie: {
    url: `${W}Si%C3%A8ge_de_Gergovie`,
    img: `${T}0/05/Monument_gergovie_fr.jpg/330px-Monument_gergovie_fr.jpg`,
    file: `${C}Monument_gergovie_fr.jpg`,
    pos: 'center',
    caption: { fr: 'Le monument de Gergovie, près de Clermont-Ferrand.', en: 'The Gergovie monument, near Clermont-Ferrand.' },
  },
  avaricum: {
    url: `${W}Si%C3%A8ge_d%27Avaricum`,
    img: `${T}6/68/Avaricum_westpoint_july_2006.jpg/330px-Avaricum_westpoint_july_2006.jpg`,
    file: `${C}Avaricum_westpoint_july_2006.jpg`,
    pos: 'center',
    caption: { fr: 'Le site d’Avaricum, aujourd’hui Bourges.', en: 'The site of Avaricum, today Bourges.' },
  },
  bibracte: {
    url: `${W}Bibracte`,
    img: `${T}1/18/F08.Bibracte._Murus_Gallicus.0001.jpg/330px-F08.Bibracte._Murus_Gallicus.0001.jpg`,
    file: `${C}F08.Bibracte._Murus_Gallicus.0001.jpg`,
    pos: 'center',
    caption: { fr: 'Un rempart gaulois (murus gallicus) reconstitué à Bibracte.', en: 'A rebuilt Gallic rampart (murus gallicus) at Bibracte.' },
  },
  bello: {
    url: `${W}Commentaires_sur_la_guerre_des_Gaules`,
    img: `${T}0/02/Commentarii_de_Bello_Gallico.jpg/330px-Commentarii_de_Bello_Gallico.jpg`,
    file: `${C}Commentarii_de_Bello_Gallico.jpg`,
    pos: 'center top',
    italic: true,
    caption: { fr: 'Une édition des *Commentaires* de César : sa version des faits.', en: 'An edition of Caesar’s *Commentaries*: his version of events.' },
  },
  royer: {
    url: `${C}Lionel_Royer_-_Vercingetorix_Throwing_down_His_Weapons_at_the_feet_of_Julius_Caesar.jpg`,
    img: `${T}a/ae/Lionel_Royer_-_Vercingetorix_Throwing_down_His_Weapons_at_the_feet_of_Julius_Caesar.jpg/330px-Lionel_Royer_-_Vercingetorix_Throwing_down_His_Weapons_at_the_feet_of_Julius_Caesar.jpg`,
    file: `${C}Lionel_Royer_-_Vercingetorix_Throwing_down_His_Weapons_at_the_feet_of_Julius_Caesar.jpg`,
    pos: 'center',
    caption: { fr: 'Lionel Royer, *Vercingétorix jette ses armes aux pieds de Jules César* (1899).', en: 'Lionel Royer, *Vercingétorix Throws Down His Arms at Caesar’s Feet* (1899).' },
  },
  statue: {
    url: `${C}Alise-Sainte-Reine_statue_Vercingetorix_par_Millet.jpg`,
    img: `${T}4/46/Alise-Sainte-Reine_statue_Vercingetorix_par_Millet.jpg/330px-Alise-Sainte-Reine_statue_Vercingetorix_par_Millet.jpg`,
    file: `${C}Alise-Sainte-Reine_statue_Vercingetorix_par_Millet.jpg`,
    pos: 'center 20%',
    caption: { fr: 'Le Vercingétorix d’Aimé Millet (1865), voulu par Napoléon III.', en: 'Aimé Millet’s Vercingétorix (1865), commissioned by Napoléon III.' },
  },
  museoparc: {
    url: `${W}Mus%C3%A9oParc_Al%C3%A9sia`,
    img: `${T}4/4a/Mus%C3%A9oParc_Al%C3%A9sia_%C2%A9_S%C3%A9bastien_PITOIZET.jpg/330px-Mus%C3%A9oParc_Al%C3%A9sia_%C2%A9_S%C3%A9bastien_PITOIZET.jpg`,
    file: `${C}Mus%C3%A9oParc_Al%C3%A9sia_%C2%A9_S%C3%A9bastien_PITOIZET.jpg`,
    pos: 'center',
    caption: { fr: 'Le MuséoParc Alésia (2012) : un bâtiment rond, comme l’encerclement romain.', en: 'MuséoParc Alésia (2012): a round building, like the Roman ring.' },
  },
};
