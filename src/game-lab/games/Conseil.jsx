import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { GameFrame, Card, Meter, Debrief, useT, haptic, clamp } from '../kit';
import './Conseil.css';

/*
 * Reigns → "Le conseil de Vercingétorix" (52 BC).
 * Swipe a card left/right (or use the buttons / ← →). Four meters; any meter at 0 or 100 ends your reign.
 * After each choice: what actually happened (historical note).
 * Effects order: [vivres, moral, allies, armee]
 */
const METERS = [
  { k: 0, fr: 'Vivres', en: 'Food' },
  { k: 1, fr: 'Moral', en: 'Morale' },
  { k: 2, fr: 'Alliés', en: 'Allies' },
  { k: 3, fr: 'Armée', en: 'Army' },
];

const CARDS = [
  { who: { fr: 'Un druide', en: 'A druid' }, side: 'gaul',
    q: { fr: 'Les anciens t’ont chassé de Gergovie. Que fais-tu ?', en: 'The elders threw you out of Gergovie. What now?' },
    L: { fr: 'Attendre leur pardon', en: 'Wait for their pardon', e: [0, -12, -5, 0] },
    R: { fr: 'Lever une armée de pauvres', en: 'Raise an army of the poor', e: [-5, 10, -8, 15] },
    hist: { fr: 'Il lève une armée, reprend Gergovie et se fait proclamer roi.', en: 'He raised an army, retook Gergovie and was hailed king.' } },
  { who: { fr: 'Le conseil de Bibracte', en: 'The council at Bibracte' }, side: 'gaul',
    q: { fr: 'Les peuples veulent un chef suprême.', en: 'The peoples want one supreme commander.' },
    L: { fr: 'Partager le commandement', en: 'Share the command', e: [0, -5, 12, -10] },
    R: { fr: 'Exiger le commandement', en: 'Demand the command', e: [0, 8, -8, 10] },
    hist: { fr: 'Il est confirmé chef suprême à Bibracte.', en: 'He was confirmed supreme commander at Bibracte.' } },
  { who: { fr: 'Un éclaireur', en: 'A scout' }, side: 'gaul',
    q: { fr: 'César est en Italie, ses légions bloquées dans leurs camps d’hiver.', en: 'Caesar is in Italy, his legions stuck in winter camps.' },
    L: { fr: 'Attendre le printemps', en: 'Wait for spring', e: [5, -12, -5, 5] },
    R: { fr: 'Frapper maintenant', en: 'Strike now', e: [-10, 15, 5, -5] },
    hist: { fr: 'Il frappe en plein hiver, avant le retour de César.', en: 'He struck in midwinter, before Caesar could return.' } },
  { who: { fr: 'Un chef biturige', en: 'A Bituriges chief' }, side: 'gaul',
    q: { fr: 'Brûler nos propres villages pour affamer les Romains ?', en: 'Burn our own villages to starve the Romans?' },
    L: { fr: 'Épargner les villages', en: 'Spare the villages', e: [10, 5, 8, -10] },
    R: { fr: 'La terre brûlée', en: 'Scorched earth', e: [-18, -8, -10, 12] },
    hist: { fr: 'Il impose la terre brûlée : une vingtaine de villes bituriges brûlent.', en: 'He imposed scorched earth: some twenty Bituriges towns burned.' } },
  { who: { fr: 'Les Bituriges', en: 'The Bituriges' }, side: 'gaul',
    q: { fr: '« Épargne Avaricum, la plus belle ville de Gaule ! »', en: '“Spare Avaricum, the finest town in Gaul!”' },
    L: { fr: 'Refuser : la brûler aussi', en: 'Refuse: burn it too', e: [-5, -10, -15, 5] },
    R: { fr: 'Accepter de la défendre', en: 'Agree to defend it', e: [0, 5, 12, -22] },
    hist: { fr: 'Il cède, contre son avis. Les Romains prennent Avaricum : environ 800 survivants sur 40 000, selon César.', en: 'He gave in against his judgement. The Romans took Avaricum: about 800 survivors of 40,000, per Caesar.' } },
  { who: { fr: 'Un chef de cavalerie', en: 'A cavalry chief' }, side: 'gaul',
    q: { fr: 'Les légions avancent. Bataille rangée ?', en: 'The legions advance. Pitched battle?' },
    L: { fr: 'Bataille rangée', en: 'Pitched battle', e: [0, 8, 0, -22] },
    R: { fr: 'Harceler leurs fourrageurs', en: 'Harass their foragers', e: [8, 4, 0, -4] },
    hist: { fr: 'Il évite les batailles rangées et attaque les convois de vivres.', en: 'He avoided pitched battles and attacked supply parties.' } },
  { who: { fr: 'Gergovie', en: 'Gergovie' }, side: 'rome',
    q: { fr: 'César assiège Gergovie, ta capitale.', en: 'Caesar besieges Gergovie, your capital.' },
    L: { fr: 'Tenir les hauteurs', en: 'Hold the heights', e: [-5, 18, 10, -5] },
    R: { fr: 'Descendre combattre en plaine', en: 'Fight down on the plain', e: [0, -5, 0, -20] },
    hist: { fr: 'Il tient les hauteurs : l’assaut romain échoue. César perd 46 centurions.', en: 'He held the heights: the Roman assault failed. Caesar lost 46 centurions.' } },
  { who: { fr: 'Un envoyé éduen', en: 'An Éduen envoy' }, side: 'gaul',
    q: { fr: 'Les Éduens quittent Rome… mais veulent le commandement.', en: 'The Éduens are leaving Rome… but want the command.' },
    L: { fr: 'Refuser', en: 'Refuse', e: [0, 5, -18, 0] },
    R: { fr: 'Les accueillir sans céder', en: 'Welcome them, don’t yield', e: [5, 0, 12, 5] },
    hist: { fr: 'Les Éduens rejoignent la révolte, mais l’assemblée garde Vercingétorix comme chef.', en: 'The Éduens joined the revolt, but the assembly kept Vercingétorix in command.' } },
  { who: { fr: 'Tes chefs', en: 'Your chiefs' }, side: 'rome',
    q: { fr: 'La colonne romaine marche vers le sud. L’attaquer ?', en: 'The Roman column marches south. Attack it?' },
    L: { fr: 'La laisser passer', en: 'Let it pass', e: [0, -10, -8, 0] },
    R: { fr: 'Attaquer avec la cavalerie', en: 'Attack with the cavalry', e: [0, -12, -5, -20] },
    hist: { fr: 'Il attaque. La cavalerie germanique de César met ses cavaliers en déroute.', en: 'He attacked. Caesar’s Germanic cavalry routed his horsemen.' } },
  { who: { fr: 'Tes chefs', en: 'Your chiefs' }, side: 'gaul',
    q: { fr: 'Où se replier ?', en: 'Where do we fall back?' },
    L: { fr: 'Disperser l’armée', en: 'Scatter the army', e: [5, -15, -10, -10] },
    R: { fr: 'S’enfermer à Alésia', en: 'Shut ourselves in Alésia', e: [-10, 5, 0, 5] },
    hist: { fr: 'Il s’enferme dans l’oppidum d’Alésia, chez les Mandubiens.', en: 'He shut himself in the hill-fort of Alésia, among the Mandubii.' } },
  { who: { fr: 'Ta cavalerie', en: 'Your cavalry' }, side: 'gaul',
    q: { fr: 'Les Romains commencent à creuser. Renvoyer la cavalerie chercher du secours ?', en: 'The Romans start digging. Send the cavalry away for help?' },
    L: { fr: 'La garder ici', en: 'Keep it here', e: [-15, 5, -5, 8] },
    R: { fr: 'La renvoyer soulever la Gaule', en: 'Send it to raise Gaul', e: [10, 0, 15, -10] },
    hist: { fr: 'Il renvoie sa cavalerie avant que l’anneau ne se ferme.', en: 'He sent his cavalry away before the ring closed.' } },
  { who: { fr: 'L’intendant', en: 'The quartermaster' }, side: 'gaul',
    q: { fr: 'Environ 30 jours de vivres. Rationner ?', en: 'About 30 days of food. Ration it?' },
    L: { fr: 'Rations normales', en: 'Normal rations', e: [-22, 8, 0, 5] },
    R: { fr: 'Rationner sévèrement', en: 'Ration strictly', e: [10, -12, 0, -5] },
    hist: { fr: 'Il rationne le blé ; les vivres s’épuisent malgré tout.', en: 'He rationed the grain; the food ran out anyway.' } },
];

const ENDINGS = {
  '0-0': { fr: 'Les greniers sont vides. L’armée se disperse pour manger.', en: 'The granaries are empty. The army scatters to find food.' },
  '0-1': { fr: 'Trop de vivres gardés pour ton armée : les peuples t’accusent de les affamer.', en: 'Too much food hoarded for your army: the peoples say you are starving them.' },
  '1-0': { fr: 'Plus personne ne croit en la victoire. Les guerriers rentrent chez eux.', en: 'Nobody believes in victory any more. The warriors go home.' },
  '1-1': { fr: 'Ivres de confiance, tes chefs attaquent sans ordre et se font écraser.', en: 'Drunk on confidence, your chiefs attack without orders and are crushed.' },
  '2-0': { fr: 'Abandonné de tous, tu n’es plus qu’un chef arverne parmi d’autres.', en: 'Abandoned by all, you are just one Arverne chief among many.' },
  '2-1': { fr: 'Trop de chefs, trop d’avis : le conseil te retire le commandement.', en: 'Too many chiefs, too many opinions: the council takes your command away.' },
  '3-0': { fr: 'Ton armée est détruite avant même Alésia.', en: 'Your army is destroyed before Alésia.' },
  '3-1': { fr: 'Ton armée est si grande qu’on ne peut plus la nourrir.', en: 'Your army is so large it can no longer be fed.' },
};

const START = [50, 50, 50, 50];
const THRESH = 80;

export default function Conseil() {
  const t = useT();
  const [m, setM] = useState(START);
  const [i, setI] = useState(0);
  const [dx, setDx] = useState(0);
  const [note, setNote] = useState(null);
  const [ending, setEnding] = useState(null);
  const [started, setStarted] = useState(false);
  const drag = useRef(null);

  const card = CARDS[i];
  const done = !ending && i >= CARDS.length;

  const choose = (dir) => {
    if (ending || done || !card) return;
    const opt = dir < 0 ? card.L : card.R;
    const next = m.map((v, k) => clamp(v + opt.e[k], 0, 100));
    setM(next);
    setNote(card.hist);
    setDx(0);
    haptic('tick');
    const dead = next.findIndex((v) => v <= 0 || v >= 100);
    if (dead >= 0) { setEnding({ k: dead, hi: next[dead] >= 100 ? 1 : 0 }); haptic('miss'); }
    else setI(i + 1);
  };

  const restart = () => { setM(START); setI(0); setNote(null); setEnding(null); setDx(0); setStarted(true); };

  const onDown = (e) => { drag.current = { x: e.clientX }; e.currentTarget.setPointerCapture?.(e.pointerId); };
  const onMove = (e) => { if (drag.current) setDx(e.clientX - drag.current.x); };
  const onUp = () => {
    if (!drag.current) return;
    drag.current = null;
    if (Math.abs(dx) > THRESH) choose(Math.sign(dx)); else setDx(0);
  };
  const onKey = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); choose(e.key === 'ArrowLeft' ? -1 : 1); }
  };

  const leaning = Math.abs(dx) > 20 ? (dx < 0 ? card?.L : card?.R) : null;

  return (
    <GameFrame
      kicker={{ fr: 'Décisions · inspiré de Reigns', en: 'Decisions · after Reigns' }}
      title={{ fr: 'Le conseil de Vercingétorix', en: 'Vercingétorix’s council' }}
      status={<span className="gf-pill">{Math.min(i + 1, CARDS.length)}/{CARDS.length}</span>}
      onRestart={restart}
    >
      <div className="cs-meters">
        {METERS.map((mt) => (
          <div key={mt.k} className="cs-meter">
            <Meter label={t(mt)} value={m[mt.k]} side="gaul" />
            <span className={`cs-dot${leaning && leaning.e[mt.k] ? ' is-on' : ''}`}
              style={{ transform: `scale(${leaning ? Math.min(1.6, Math.abs(leaning.e[mt.k]) / 10) : 0})` }} aria-hidden="true" />
          </div>
        ))}
      </div>

      {!started ? (
        <Card title={{ fr: 'Tu es Vercingétorix, 52 av. J.-C.', en: 'You are Vercingétorix, 52 BC' }}
          action={{ fr: 'Prendre le commandement', en: 'Take command' }} onAction={() => setStarted(true)}>
          <p>{t({ fr: 'Chaque carte est une décision. Glissez à gauche ou à droite (ou ← →). Si une jauge tombe à 0 ou atteint 100, ton règne s’arrête. Tiendras-tu jusqu’à Alésia ?', en: 'Each card is a decision. Swipe left or right (or ← →). If a meter hits 0 or 100, your reign ends. Can you last until Alésia?' })}</p>
        </Card>
      ) : ending ? (
        <Card title={{ fr: 'Fin du règne', en: 'Your reign ends' }} action={{ fr: 'Rejouer', en: 'Play again' }} onAction={restart}>
          <p>{t(ENDINGS[`${ending.k}-${ending.hi}`])}</p>
          <p>{t({ fr: `Tu as tenu ${i} décisions sur ${CARDS.length}.`, en: `You lasted ${i} of ${CARDS.length} decisions.` })}</p>
          <Debrief source={{ fr: 'Selon César, *La Guerre des Gaules*, livre VII.', en: 'Per Caesar, *The Gallic War*, book VII.' }}
            simplified={{ fr: 'les jauges et leurs chiffres sont inventés ; les situations et les « historiquement » suivent César.', en: 'the meters and their numbers are invented; the situations and “what happened” notes follow Caesar.' }} />
        </Card>
      ) : done ? (
        <Card tone="is-win" title={{ fr: 'Tu as tenu jusqu’à Alésia', en: 'You lasted until Alésia' }} action={{ fr: 'Rejouer', en: 'Play again' }} onAction={restart}>
          <p>{t({ fr: 'Comme Vercingétorix. Mais l’histoire, elle, ne change pas : enfermé à Alésia, il se rendra en septembre 52.', en: 'Just like Vercingétorix. But history does not change: shut in Alésia, he surrendered in September 52.' })}</p>
          <Debrief source={{ fr: 'Selon César, *La Guerre des Gaules*, livre VII.', en: 'Per Caesar, *The Gallic War*, book VII.' }}
            simplified={{ fr: 'un vrai chef ne décide pas seul en deux choix : les conseils gaulois débattaient longuement.', en: 'a real leader does not decide alone between two choices: Gallic councils debated at length.' }} />
        </Card>
      ) : (
        <div className="cs-stage" tabIndex={0} onKeyDown={onKey} aria-label={t({ fr: 'Carte de décision : ← ou →', en: 'Decision card: ← or →' })}>
          <div
            className={`cs-card cs-${card.side}`}
            style={{ transform: `translateX(${dx}px) rotate(${dx / 18}deg)` }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            <span className="cs-hint cs-hint-l" style={{ opacity: clamp(-dx / THRESH, 0, 1) }}>{t(card.L)}</span>
            <span className="cs-hint cs-hint-r" style={{ opacity: clamp(dx / THRESH, 0, 1) }}>{t(card.R)}</span>
            <span className={`cs-badge ${card.side === 'rome' ? 'is-rome' : 'is-gaul'}`} aria-hidden="true" />
            <p className="cs-who">{t(card.who)}</p>
            <p className="cs-q">{t(card.q)}</p>
          </div>
          <div className="cs-buttons">
            <button type="button" className="gf-btn" onClick={() => choose(-1)}><ArrowLeft size={16} aria-hidden="true" /> {t(card.L)}</button>
            <button type="button" className="gf-btn" onClick={() => choose(1)}>{t(card.R)} <ArrowRight size={16} aria-hidden="true" /></button>
          </div>
        </div>
      )}
      <p className="gf-toast cs-note" aria-live="polite">
        {note && <><strong>{t({ fr: 'Historiquement : ', en: 'What happened: ' })}</strong>{t(note)}</>}
      </p>
    </GameFrame>
  );
}
