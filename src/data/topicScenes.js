/*
 * One backdrop scene per topic page (#/sujet/<id>): the topic's lead picture (Wikimedia Commons,
 * already licence-checked in data/topics.js). Shown through the CRT backdrop when a key word's
 * page opens — the same pixel-by-pixel channel switch as the story's steps. Kept separate and
 * tiny so the main page doesn't load the topics' text.
 */
export const TOPIC_SCENES = {
  "cesar": {
    "src": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8f/Julius_Caesar_Bust.jpg/960px-Julius_Caesar_Bust.jpg",
    "focus": [
      0.5,
      0.42
    ]
  },
  "vercingetorix": {
    "src": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f3/Vercing%C3%A9torix_Al%C3%A9sia.jpg/960px-Vercing%C3%A9torix_Al%C3%A9sia.jpg",
    "focus": [
      0.5,
      0.42
    ]
  },
  "plutarque": {
    "src": "https://upload.wikimedia.org/wikipedia/commons/3/34/Plutarch_of_Chaeronea-03.jpg",
    "focus": [
      0.5,
      0.42
    ]
  },
  "bello": {
    "src": "https://upload.wikimedia.org/wikipedia/commons/0/02/Commentarii_de_Bello_Gallico.jpg",
    "focus": [
      0.5,
      0.42
    ]
  },
  "alesia": {
    "src": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/de/Alise-Sainte-Reine_statue_Vercingetorix_par_Millet_large.jpg/960px-Alise-Sainte-Reine_statue_Vercingetorix_par_Millet_large.jpg",
    "focus": [
      0.5,
      0.42
    ]
  },
  "gergovie": {
    "src": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c8/Plateau_of_Gergovia.jpg/960px-Plateau_of_Gergovia.jpg",
    "focus": [
      0.5,
      0.42
    ]
  },
  "avaricum": {
    "src": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/84/Bender_-_Avaricum_Siege_Works.JPG/960px-Bender_-_Avaricum_Siege_Works.JPG",
    "focus": [
      0.5,
      0.42
    ]
  },
  "bibracte": {
    "src": "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/15/Bibracte_%28Mont_Beuvray%29_02.jpg/960px-Bibracte_%28Mont_Beuvray%29_02.jpg",
    "focus": [
      0.5,
      0.42
    ]
  },
  "royer": {
    "src": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ae/Lionel_Royer_-_Vercingetorix_Throwing_down_His_Weapons_at_the_feet_of_Julius_Caesar.jpg/960px-Lionel_Royer_-_Vercingetorix_Throwing_down_His_Weapons_at_the_feet_of_Julius_Caesar.jpg",
    "focus": [
      0.5,
      0.42
    ]
  },
  "statue": {
    "src": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/de/Alise-Sainte-Reine_statue_Vercingetorix_par_Millet_large.jpg/960px-Alise-Sainte-Reine_statue_Vercingetorix_par_Millet_large.jpg",
    "focus": [
      0.5,
      0.42
    ]
  },
  "museoparc": {
    "src": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a8/Mus%C3%A9oParc_Al%C3%A9sia_01.jpg/960px-Mus%C3%A9oParc_Al%C3%A9sia_01.jpg",
    "focus": [
      0.5,
      0.42
    ]
  }
};
