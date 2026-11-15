import { Fragment } from 'react';
import { useLang, frTypo } from '../lib/lang';
import Term from './Term';

/*
 * The only way story text is rendered.
 * text = { fr, en, say? }. In "frp" mode the French is shown with `say` as a pronunciation hint.
 * Inline markup inside strings:
 *   {{key}} or {{key|shown text}}  → vocabulary <Term>
 *   *words*                        → <em>
 */
const TOKEN = /(\{\{[a-z-]+(?:\|[^}]+)?\}\}|\*[^*]+\*)/g;

function rich(str) {
  return str.split(TOKEN).map((part, i) => {
    if (part.startsWith('{{')) {
      const [id, display] = part.slice(2, -2).split('|');
      return <Term key={i} id={id} display={display} />;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export default function Phrase({ text, as: Tag = 'span', className, id }) {
  const { lang } = useLang();
  if (!text) return null;
  if (typeof text === 'string') return <Tag className={className} id={id}>{rich(text)}</Tag>;

  const useEn = lang === 'en' && text.en;
  const str = useEn ? text.en : frTypo(text.fr);

  return (
    <Tag className={className} id={id} lang={useEn ? 'en' : 'fr'}>
      {rich(str)}
      {lang === 'frp' && text.say && (
        <span className="pron" aria-hidden="true">{text.say}</span>
      )}
    </Tag>
  );
}
