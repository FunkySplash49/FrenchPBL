import { useId } from 'react';
import { VOCAB } from '../data/vocab';

/** A French vocabulary word with a hover / focus tooltip (English + pronunciation). */
export default function Term({ id, display }) {
  const tipId = useId();
  const v = VOCAB[id];
  if (!v) return <>{display ?? id}</>;
  return (
    <span className="term" tabIndex={0} aria-describedby={tipId} lang="fr">
      {display ?? v.fr}
      <span role="tooltip" id={tipId} className="term-tip" lang="en">
        <span className="term-tip-en">{v.en}</span>
        <span className="term-tip-say">« {v.say} »</span>
      </span>
    </span>
  );
}
