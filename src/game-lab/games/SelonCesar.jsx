import { useState } from 'react';
import { BookOpen, CalendarClock, Swords, Check, HelpCircle, Sparkles } from 'lucide-react';
import { GameFrame, Card, Debrief, useT, haptic, shuffle } from '../kit';
import './SelonCesar.css';

/*
 * Papers, Please → "Selon César ?" — source criticism at the inspector's desk.
 * Each document: a claim + a file (author, when written, which side). Inspect the file, then stamp:
 *   FIABLE (confirmed by an independent check) · DOUTEUX (can't be checked / interested party) · LÉGENDE (later embellishment or fiction)
 * No timer, no speed points (research/03-edu-design.md).
 */
const DOCS = [
  { id: 'relief', claim: { fr: '« L’armée de secours comptait 250 000 fantassins et 8 000 cavaliers. »', en: '“The relief army numbered 250,000 infantry and 8,000 cavalry.”' },
    who: { fr: 'Jules César', en: 'Julius Caesar' }, when: { fr: 'Écrit en 52–51 av. J.-C., juste après', en: 'Written 52–51 BC, right after' }, side: { fr: 'Le vainqueur, qui écrit pour Rome', en: 'The winner, writing for Rome' },
    answer: 'doubt', why: { fr: 'César a intérêt à grossir l’ennemi. Les historiens pensent plutôt 50 000 à 100 000 hommes.', en: 'Caesar gains from inflating the enemy. Historians think 50,000–100,000 is more likely.' } },
  { id: 'ditches', claim: { fr: '« On a retrouvé les fossés romains autour du Mont-Auxois, à Alise-Sainte-Reine. »', en: '“Roman ditches have been found around Mont-Auxois, at Alise-Sainte-Reine.”' },
    who: { fr: 'Fouilles franco-allemandes', en: 'Franco-German excavations' }, when: { fr: '1991–1997', en: '1991–1997' }, side: { fr: 'Archéologues : aucun camp', en: 'Archaeologists: no side' },
    answer: 'ok', why: { fr: 'Une preuve indépendante, dans le sol. Elle confirme en grande partie la description de César.', en: 'Independent evidence, in the ground. It largely confirms Caesar’s description.' } },
  { id: 'plutarch', claim: { fr: '« Vercingétorix sortit à cheval dans sa plus belle armure, fit le tour de César, puis s’assit en silence à ses pieds. »', en: '“Vercingétorix rode out in his finest armour, circled Caesar, then sat in silence at his feet.”' },
    who: { fr: 'Plutarque', en: 'Plutarch' }, when: { fr: 'Environ 150 ans plus tard', en: 'About 150 years later' }, side: { fr: 'Auteur grec qui aime les scènes dramatiques', en: 'A Greek writer fond of dramatic scenes' },
    answer: 'legend', why: { fr: 'César, témoin direct, raconte une reddition sèche. La scène de Plutarque est sans doute embellie.', en: 'Caesar, an eyewitness, describes a plain surrender. Plutarch’s scene is probably embellished.' } },
  { id: 'lines', claim: { fr: '« Une ligne intérieure d’environ 16 km face à la ville, une ligne extérieure d’environ 21 km face au secours. »', en: '“An inner line of about 16 km facing the town, an outer line of about 21 km facing the relief.”' },
    who: { fr: 'Jules César', en: 'Julius Caesar' }, when: { fr: '52–51 av. J.-C.', en: '52–51 BC' }, side: { fr: 'Le vainqueur', en: 'The winner' },
    answer: 'ok', why: { fr: 'Même si César est partial, l’archéologie a retrouvé les deux lignes : ici, son récit est vérifié.', en: 'Caesar is biased, but archaeology found both lines: here his account is checked.' } },
  { id: 'million', claim: { fr: '« César a tué un million de Gaulois et en a réduit un million en esclavage. »', en: '“Caesar killed one million Gauls and enslaved one million more.”' },
    who: { fr: 'Plutarque et Appien', en: 'Plutarch and Appian' }, when: { fr: '150 à 200 ans plus tard', en: '150–200 years later' }, side: { fr: 'Auteurs grecs sous l’Empire romain', en: 'Greek writers under the Roman Empire' },
    answer: 'doubt', why: { fr: 'Des chiffres ronds, impossibles à vérifier, sans doute exagérés. Mais la dévastation était bien réelle.', en: 'Round numbers, impossible to check, probably inflated. But the devastation was real.' } },
  { id: 'ancestors', claim: { fr: '« Nos ancêtres les Gaulois. Vercingétorix fut le premier héros de la France. »', en: '“Our ancestors the Gauls. Vercingétorix was France’s first hero.”' },
    who: { fr: 'Manuel scolaire français', en: 'French schoolbook' }, when: { fr: 'Après 1870', en: 'After 1870' }, side: { fr: 'La France, battue par la Prusse, cherche des héros', en: 'France, beaten by Prussia, looks for heroes' },
    answer: 'legend', why: { fr: 'La « France » n’existait pas en 52 av. J.-C. C’est un mythe national du XIXe siècle.', en: '“France” did not exist in 52 BC. This is a 19th-century national myth.' } },
  { id: 'gergovie', claim: { fr: '« À Gergovie, nous avons perdu 46 centurions et un peu moins de 700 soldats. »', en: '“At Gergovie we lost 46 centurions and just under 700 soldiers.”' },
    who: { fr: 'Jules César', en: 'Julius Caesar' }, when: { fr: '52–51 av. J.-C.', en: '52–51 BC' }, side: { fr: 'Le général battu ce jour-là', en: 'The general beaten that day' },
    answer: 'doubt', why: { fr: 'César a intérêt à réduire ses pertes. Les historiens pensent qu’elles étaient plus lourdes.', en: 'Caesar gains from shrinking his losses. Historians think they were heavier.' } },
  { id: 'asterix', claim: { fr: '« Alésia ? Connais pas ! Personne ne sait où est Alésia ! »', en: '“Alésia? Never heard of it! Nobody knows where Alésia is!”' },
    who: { fr: 'Abraracourcix, chef gaulois', en: 'Vitalstatistix, Gaulish chief' }, when: { fr: 'Bande dessinée, 1968', en: 'Comic book, 1968' }, side: { fr: 'Fiction humoristique', en: 'Comic fiction' },
    answer: 'legend', why: { fr: 'Une blague d’Astérix (Le Bouclier arverne). Le lieu a longtemps été discuté, mais les fouilles ont tranché : Alise-Sainte-Reine.', en: 'An Astérix joke (Asterix and the Chieftain’s Shield). The site was long debated, but excavations settled it: Alise-Sainte-Reine.' } },
  { id: 'triumph', claim: { fr: '« Vercingétorix fut montré au triomphe de César, puis mis à mort. »', en: '“Vercingétorix was paraded in Caesar’s triumph, then put to death.”' },
    who: { fr: 'Dion Cassius', en: 'Cassius Dio' }, when: { fr: 'Environ 250 ans plus tard', en: 'About 250 years later' }, side: { fr: 'Historien romain d’origine grecque', en: 'Roman historian of Greek origin' },
    answer: 'ok', why: { fr: 'Tardif, mais cohérent avec l’usage romain du triomphe (46 av. J.-C.) ; les historiens l’acceptent.', en: 'Late, but consistent with Roman triumph custom (46 BC); historians accept it.' } },
];

const STAMPS = {
  ok: { fr: 'Fiable', en: 'Reliable', Icon: Check, hint: { fr: 'confirmé par une preuve indépendante', en: 'confirmed by independent evidence' } },
  doubt: { fr: 'Douteux', en: 'Doubtful', Icon: HelpCircle, hint: { fr: 'invérifiable, ou l’auteur y a intérêt', en: 'unverifiable, or the author has a stake' } },
  legend: { fr: 'Légende', en: 'Legend', Icon: Sparkles, hint: { fr: 'embelli plus tard, ou fiction', en: 'embellished later, or fiction' } },
};
const TABS = [
  { k: 'who', Icon: BookOpen, fr: 'Auteur', en: 'Author' },
  { k: 'when', Icon: CalendarClock, fr: 'Quand', en: 'When' },
  { k: 'side', Icon: Swords, fr: 'Camp', en: 'Side' },
];
const ROUND = 6;

export default function SelonCesar() {
  const t = useT();
  const [deck, setDeck] = useState(() => shuffle(DOCS).slice(0, ROUND));
  const [i, setI] = useState(0);
  const [open, setOpen] = useState({});
  const [stamp, setStamp] = useState(null);
  const [log, setLog] = useState([]);
  const [started, setStarted] = useState(false);

  const doc = deck[i];
  const done = i >= deck.length;
  const inspected = Object.keys(open).length;

  const restart = () => { setDeck(shuffle(DOCS).slice(0, ROUND)); setI(0); setOpen({}); setStamp(null); setLog([]); setStarted(true); };
  const press = (k) => {
    if (stamp) return;
    setStamp(k);
    const right = k === doc.answer;
    haptic(right ? 'success' : 'miss');
    setLog((l) => [...l, { id: doc.id, right, inspected }]);
  };
  const next = () => { setI(i + 1); setOpen({}); setStamp(null); haptic('tick'); };
  const score = log.filter((l) => l.right).length;

  return (
    <GameFrame
      kicker={{ fr: 'Critique des sources · inspiré de Papers, Please', en: 'Source criticism · after Papers, Please' }}
      title={{ fr: 'Selon César ?', en: 'According to Caesar?' }}
      status={started && <span className="gf-pill">{Math.min(i + 1, deck.length)}/{deck.length}</span>}
      onRestart={restart}
    >
      {!started ? (
        <Card title={{ fr: 'Bureau de l’inspecteur des sources', en: 'The source inspector’s desk' }} action={{ fr: 'Ouvrir le premier dossier', en: 'Open the first file' }} onAction={() => setStarted(true)}>
          <p>{t({ fr: 'Presque tout ce que nous savons d’Alésia vient… du vainqueur. Pour chaque témoignage, ouvrez la fiche (auteur, date, camp), puis tamponnez.', en: 'Almost everything we know about Alésia comes… from the winner. For each testimony, open the file (author, date, side), then stamp it.' })}</p>
          <ul className="sc-keylist">
            {Object.entries(STAMPS).map(([k, s]) => (
              <li key={k}><span className={`sc-mini sc-${k}`}><s.Icon size={14} aria-hidden="true" /> {t(s)}</span> {t(s.hint)}</li>
            ))}
          </ul>
        </Card>
      ) : done ? (
        <Card tone={score >= deck.length - 1 ? 'is-win' : ''} title={{ fr: `${score} / ${deck.length} bien classés`, en: `${score} / ${deck.length} correctly stamped` }}
          action={{ fr: 'Nouveaux dossiers', en: 'New files' }} onAction={restart}>
          <p>{t({ fr: `Vous avez ouvert en moyenne ${(log.reduce((a, l) => a + l.inspected, 0) / log.length).toFixed(1)} fiches sur 3 par document. Les bons historiens ouvrent toujours les trois.`, en: `On average you opened ${(log.reduce((a, l) => a + l.inspected, 0) / log.length).toFixed(1)} of 3 file tabs per document. Good historians always open all three.` })}</p>
          <Debrief
            source={{ fr: 'Règle d’or : « Selon César…, mais les historiens pensent que… »', en: 'Golden rule: “According to Caesar…, but historians think…”' }}
            simplified={{ fr: 'trois tampons, c’est réducteur : en vrai, un même texte peut être fiable sur un point et exagéré sur un autre.', en: 'three stamps is reductive: a single text can be reliable on one point and inflated on another.' }}
          />
        </Card>
      ) : (
        <div className="sc-desk">
          <article className={`sc-doc${stamp ? ' is-stamped' : ''}`}>
            <p className="sc-doc-kicker">{t({ fr: 'Témoignage', en: 'Testimony' })} n° {i + 1}</p>
            <p className="sc-claim" lang={t({ fr: 'fr', en: 'en' })}>{t(doc.claim)}</p>
            <div className="sc-tabs" role="group" aria-label={t({ fr: 'Fiche de la source', en: 'Source file' })}>
              {TABS.map(({ k, Icon, ...lab }) => (
                <button key={k} type="button" className={`sc-tab${open[k] ? ' is-open' : ''}`} aria-expanded={!!open[k]}
                  onClick={() => { haptic('light'); setOpen((o) => ({ ...o, [k]: true })); }}>
                  <Icon size={16} aria-hidden="true" /> <span className="sc-tab-k">{t(lab)}</span>
                  <span className="sc-tab-v">{open[k] ? t(doc[k]) : '· · ·'}</span>
                </button>
              ))}
            </div>
            {stamp && (
              <span className={`sc-stamp sc-${stamp}`} aria-hidden="true">{t(STAMPS[stamp])}</span>
            )}
          </article>

          {!stamp ? (
            <div className="sc-stamps">
              {Object.entries(STAMPS).map(([k, s]) => (
                <button key={k} type="button" className={`sc-btn sc-${k}`} onClick={() => press(k)}>
                  <s.Icon size={18} aria-hidden="true" /> {t(s)}
                </button>
              ))}
            </div>
          ) : (
            <div className={`sc-verdict ${stamp === doc.answer ? 'is-right' : 'is-wrong'}`} aria-live="polite">
              <p><strong>{stamp === doc.answer ? t({ fr: 'Bien vu.', en: 'Well spotted.' }) : t({ fr: `Plutôt « ${t(STAMPS[doc.answer])} ».`, en: `Rather “${t(STAMPS[doc.answer])}”.` })}</strong> {t(doc.why)}</p>
              <button type="button" className="btn-primary" onClick={next}>{t({ fr: 'Dossier suivant', en: 'Next file' })}</button>
            </div>
          )}
        </div>
      )}
    </GameFrame>
  );
}
