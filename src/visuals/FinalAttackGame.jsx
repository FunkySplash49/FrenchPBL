import { useLayoutEffect, useRef, useState } from 'react';
import { Check, Undo2, RotateCcw } from 'lucide-react';
import AlesiaPlan, { WEAK_CAMP } from './AlesiaPlan';
import Phrase from '../components/Phrase';
import { useLang, pick } from '../lib/lang';
import { gsap, DUR, EASE, prefersReduced } from '../lib/motion';

/*
 * Beat 11 — "Imaginez : vous êtes César."
 * One reserve, three threatened sectors. The right answer is Mont Réa (the weak north-west camp).
 * Feedback uses gold (right) and muted + icon (wrong) — never Roman red / Gallic green.
 */
const OPTIONS = [
  { id: 'plaine', label: { fr: 'La plaine, à l’ouest', en: 'The plain, to the west' } },
  { id: 'rea',    label: { fr: 'Le camp du Mont Réa, au nord-ouest', en: 'The Mont Réa camp, north-west' } },
  { id: 'sud',    label: { fr: 'Les collines du sud', en: 'The southern hills' } },
];

const RIGHT = {
  fr: "Bonne décision ! C'est là que Vercassivellaunos frappe avec 60 000 hommes. César y mène lui-même les réserves, et sa {{cavalerie}} prend les assaillants à revers. L'armée de secours se disperse.",
  en: 'Good call! That is where Vercassivellaunos strikes with 60,000 men. Caesar leads the reserves there himself, and his {{cavalerie}} hits the attackers from behind. The relief army breaks and scatters.',
};
const WRONG = {
  fr: "Pas tout à fait. Le danger est au nord-ouest : le camp mal placé du Mont Réa, où Vercassivellaunos attaque avec 60 000 hommes. César y mène lui-même les réserves, et sa {{cavalerie}} prend les Gaulois à revers.",
  en: 'Not quite. The danger is in the north-west: the badly placed Mont Réa camp, where Vercassivellaunos attacks with 60,000 men. Caesar leads the reserves there himself, and his {{cavalerie}} hits the Gauls from behind.',
};
const WHY = {
  fr: "Pourquoi César gagne : les ingénieurs et les lignes intérieures. Il déplace ses réserves par l'intérieur de l'anneau plus vite que les Gaulois ne se coordonnent à l'extérieur.",
  en: 'Why Caesar won: engineering plus internal lines. He moves reserves across the inside of his ring faster than the Gauls can coordinate around the outside.',
};
const AFTER = {
  fr: "Le lendemain, Vercingétorix {{rendre}} pour sauver ses hommes. Les captifs sont donnés aux soldats comme esclaves — sauf les Éduens et les Arvernes, épargnés par calcul politique.",
  en: 'The next day Vercingétorix {{rendre}} to save his men. The captives are handed to Roman soldiers as slaves — except the Éduens and Arvernes, spared for political reasons.',
};

export default function FinalAttackGame() {
  const { lang } = useLang();
  const en = lang === 'en';
  const [choice, setChoice] = useState(null);
  const planRef = useRef(null);
  const resultRef = useRef(null);
  const correct = choice === 'rea';

  useLayoutEffect(() => {
    if (!choice || prefersReduced() || !planRef.current) return undefined;
    const q = gsap.utils.selector(planRef.current);
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: EASE.out } });
      tl.from(q('.atk-relief'), { strokeDashoffset: 1, duration: DUR.slow, ease: EASE.cinematic })
        .from(q('.atk-sortie'), { strokeDashoffset: 1, duration: DUR.slow, ease: EASE.cinematic }, '<0.15')
        // Rome: methodical, along the inside of the ring
        .from(q('.atk-reserve'), { strokeDashoffset: 1, duration: DUR.cinematic, ease: 'none' })
        .from(q('.atk-cavalry'), { strokeDashoffset: 1, duration: DUR.slow, ease: 'none' }, '-=0.4')
        .from(q('.relief-unit'), { x: 0, opacity: 1, duration: DUR.slow, stagger: { each: 0.03, from: 'random' } }, '-=0.1')
        .from(q('.atk-x'), { scale: 0, opacity: 0, transformOrigin: '50% 50%', duration: DUR.fast });
      if (resultRef.current) tl.from(resultRef.current, { opacity: 0, y: 12, duration: DUR.base }, 0.2);
    }, planRef.current);
    return () => ctx.revert();
  }, [choice]);

  const [rx, ry] = WEAK_CAMP;

  return (
    <div className="viz viz-plan game">
      <p className="game-prompt" id="game-q">
        {en
          ? 'You have one reserve. The Gauls attack everywhere at once. Where do you send it?'
          : "Vous n'avez qu'une réserve. Les Gaulois attaquent partout à la fois. Où l'envoyez-vous ?"}
      </p>

      <AlesiaPlan ref={planRef} mode="attack" highlight={choice} routed={!!choice}>
        {choice && (
          <g aria-hidden="true">
            <defs>
              <marker id="atk-g" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M0,0 L10,5 L0,10 z" className="arrowhead-gaul" />
              </marker>
              <marker id="atk-r" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M0,0 L10,5 L0,10 z" className="arrowhead-rome" />
              </marker>
            </defs>
            <path d={`M24,40 C60,70 92,104 ${rx - 16},${ry - 12}`} pathLength="1" className="route route-gaul atk atk-relief" markerEnd="url(#atk-g)" />
            <path d={`M282,200 C250,184 214,172 ${rx + 30},${ry + 8}`} pathLength="1" className="route route-gaul route-dash atk atk-sortie" markerEnd="url(#atk-g)" />
            <path d={`M470,340 C380,372 250,360 196,290 C168,250 160,212 ${rx + 4},${ry + 18}`} pathLength="1" className="route route-rome atk atk-reserve" markerEnd="url(#atk-r)" />
            <path d="M70,392 C20,320 4,200 22,96" pathLength="1" className="route route-rome atk atk-cavalry" markerEnd="url(#atk-r)" />
            <g className="atk-x" transform={`translate(${rx - 40} ${ry - 50})`}>
              <path d="M-7,-7 L7,7 M7,-7 L-7,7" className="x-mark" />
            </g>
          </g>
        )}
      </AlesiaPlan>

      <div className="choices" role="group" aria-labelledby="game-q">
        {OPTIONS.map((o) => {
          const picked = choice === o.id;
          return (
            <button
              key={o.id}
              type="button"
              className={`choice${picked ? ' is-picked' : ''}${choice && o.id === 'rea' ? ' is-answer' : ''}`}
              aria-pressed={picked}
              disabled={!!choice && !picked}
              onClick={() => setChoice(o.id)}
            >
              {pick(o.label, lang)}
            </button>
          );
        })}
      </div>

      <div aria-live="polite" className="game-result-wrap">
        {choice && (
          <div ref={resultRef} className={`game-result ${correct ? 'is-right' : 'is-wrong'}`}>
            <p className="stamp">
              {correct ? <Check size={20} strokeWidth={1.75} aria-hidden="true" /> : <Undo2 size={20} strokeWidth={1.75} aria-hidden="true" />}
              {correct ? (en ? 'Good call' : 'Bonne décision') : (en ? 'Think again' : 'À revoir')}
            </p>
            <Phrase as="p" text={correct ? RIGHT : WRONG} />
            <Phrase as="p" text={WHY} className="game-why" />
            <Phrase as="p" text={AFTER} className="game-after" />
            <button type="button" className="btn-ghost" onClick={() => setChoice(null)}>
              <RotateCcw size={18} strokeWidth={1.75} aria-hidden="true" />
              {en ? 'Play again' : 'Rejouer'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
