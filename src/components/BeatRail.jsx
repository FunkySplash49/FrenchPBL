import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BEATS, PARTS } from '../data/beats';
import { useLang, pick } from '../lib/lang';
import { haptic } from '../lib/haptics';

/* Bottom navigation: 12 steps grouped by part (desktop), prev / counter / next (phones). */
export default function BeatRail({ active, onJump }) {
  const { lang } = useLang();
  const en = lang === 'en';
  const current = BEATS.find((b) => b.n === active);

  return (
    <nav className="rail" aria-label={en ? 'Story steps' : 'Étapes du récit'}>
      {/* touch screens without a keyboard (classroom monitor): big prev / next beside the steps */}
      <button type="button" className="rail-arrow rail-edge" onClick={() => { haptic('tick'); onJump(Math.max(0, active - 1)); }}
        aria-label={en ? 'Previous step' : 'Étape précédente'} disabled={active <= 0}>
        <ChevronLeft size={26} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <ol className="rail-steps">
        {BEATS.map((b, i) => {
          const newPart = i > 0 && BEATS[i - 1].part !== b.part;
          return (
            <li key={b.n} className={newPart ? 'rail-gap' : undefined}>
              <button
                type="button"
                className={`rail-step${b.n === active ? ' is-active' : ''}${b.n < active ? ' is-past' : ''}`}
                aria-current={b.n === active ? 'step' : undefined}
                aria-label={`${en ? 'Step' : 'Étape'} ${b.n} : ${pick(b.date, lang)} — ${pick(b.title, lang)}`}
                onClick={() => onJump(b.n)}
              >
                <span className="rail-dot" aria-hidden="true">{b.n}</span>
                <span className="rail-tip" aria-hidden="true">
                  <span className="rail-tip-part">{pick(PARTS[b.part], lang)}</span>
                  {pick(b.title, lang)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <button type="button" className="rail-arrow rail-edge" onClick={() => { haptic('tick'); onJump(Math.min(13, active + 1)); }}
        aria-label={en ? 'Next step' : 'Étape suivante'} disabled={active >= 13}>
        <ChevronRight size={26} strokeWidth={1.75} aria-hidden="true" />
      </button>

      <div className="rail-compact">
        <button type="button" className="rail-arrow" onClick={() => { haptic('tick'); onJump(Math.max(0, active - 1)); }}
          aria-label={en ? 'Previous step' : 'Étape précédente'} disabled={active <= 0}>
          <ChevronLeft size={22} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <span className="rail-count" aria-live="polite">
          {active > 0 ? <>{String(active).padStart(2, '0')} / 12 · {pick(current?.date, lang)}</> : (en ? 'Start' : 'Début')}
        </span>
        <button type="button" className="rail-arrow" onClick={() => { haptic('tick'); onJump(Math.min(13, active + 1)); }}
          aria-label={en ? 'Next step' : 'Étape suivante'} disabled={active >= 13}>
          <ChevronRight size={22} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
