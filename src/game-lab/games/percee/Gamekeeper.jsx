import { useEffect, useRef, useState } from 'react';
import { KeyRound, Lock, Trash2, X } from 'lucide-react';
import { adminBoard } from './classApi';

/*
 * La Percée — the gamekeeper (teacher) panel on the full-screen class board. Only rendered with
 * ?g=percee&board&admin; students never see it. The key is checked against the server
 * (DELETE /api/board?check=1, which changes nothing), kept in memory, and in sessionStorage only
 * if asked (this tab, until it is closed). It is never written to localStorage or the URL.
 */

const STORE = 'percee-gamekeeper';
const readKey = () => { try { return sessionStorage.getItem(STORE) || ''; } catch { return ''; } };
const writeKey = (k) => { try { if (k) sessionStorage.setItem(STORE, k); else sessionStorage.removeItem(STORE); } catch { /* blocked */ } };

export const GK = {
  title: { fr: 'Gardien du jeu', en: 'Gamekeeper' },
  key: { fr: 'Clé du gardien', en: 'Gamekeeper key' },
  remember: { fr: 'Retenir dans cet onglet (jusqu’à sa fermeture)', en: 'Remember in this tab (until it is closed)' },
  unlock: { fr: 'Déverrouiller', en: 'Unlock' },
  checking: { fr: 'Vérification…', en: 'Checking…' },
  lock: { fr: 'Verrouiller', en: 'Lock' },
  open: { fr: 'Déverrouillé : vous pouvez retirer une ligne (×) ou tout effacer.', en: 'Unlocked: you can remove one row (×) or clear everything.' },
  resetAll: { fr: 'Réinitialiser tout le classement', en: 'Reset the whole board' },
  cancel: { fr: 'Annuler', en: 'Cancel' },
  remove: { fr: 'Retirer', en: 'Remove' },
  removeQ: { fr: 'Retirer ?', en: 'Remove?' },
  forbidden: { fr: 'Clé refusée (403). Vérifiez la clé.', en: 'Key refused (403). Check the key.' },
  disabled: { fr: 'La remise à zéro n’est pas activée sur le serveur (ADMIN_KEY absent).', en: 'Resetting is not enabled on the server (ADMIN_KEY missing).' },
  offline: { fr: 'Serveur injoignable. Rien n’a été modifié.', en: 'The server cannot be reached. Nothing was changed.' },
  empty: { fr: 'Le classement est déjà vide.', en: 'The board is already empty.' },
};
const confirmAll = (n) => ({
  fr: `Supprimer ${n} ligne${n === 1 ? '' : 's'} pour toute la classe ? C’est définitif.`,
  en: `Delete ${n} row${n === 1 ? '' : 's'} for the whole class? This cannot be undone.`,
});
const confirmBtn = (n) => ({ fr: `Oui, supprimer ${n} ligne${n === 1 ? '' : 's'}`, en: `Yes, delete ${n} row${n === 1 ? '' : 's'}` });
const doneAll = (n) => ({ fr: `Classement remis à zéro : ${n} ligne${n === 1 ? '' : 's'} supprimée${n === 1 ? '' : 's'}.`, en: `Board reset: ${n} row${n === 1 ? '' : 's'} deleted.` });
const doneOne = (name, n) => (n ? { fr: `« ${name} » a été retiré du classement.`, en: `“${name}” was removed from the board.` }
  : { fr: `« ${name} » n’était plus au classement.`, en: `“${name}” was no longer on the board.` });

/**
 * useGamekeeper({ rows, refresh, t }) → { panel, rowAction }
 * `rowAction` is passed to <ClassRows> (null while locked, so the rows look as usual).
 */
export function useGamekeeper({ rows, refresh, t }) {
  const [key, setKey] = useState('');
  const [draft, setDraft] = useState(readKey);
  const [remember, setRemember] = useState(() => !!readKey());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);           // { tone: 'ok' | 'err', text }
  const [armAll, setArmAll] = useState(false);
  const [armRow, setArmRow] = useState(null);      // name armed for removal
  const armTimer = useRef(0);
  useEffect(() => () => clearTimeout(armTimer.current), []);

  const fail = (error) => {
    setMsg({ tone: 'err', text: t(GK[error] || GK.offline) });
    if (error === 'forbidden' || error === 'disabled') { setKey(''); writeKey(''); setArmAll(false); setArmRow(null); }
  };

  // a key remembered in this tab is checked again on load, so a changed key does not look unlocked
  const tryKey = async (k, quiet = false) => {
    if (!k) return;
    setBusy(true);
    const r = await adminBoard(k, { check: true });
    setBusy(false);
    if (r.ok) { setKey(k); setMsg(quiet ? null : { tone: 'ok', text: t(GK.open) }); } else if (!quiet || r.error !== 'offline') fail(r.error);
  };
  useEffect(() => { const k = readKey(); if (k) tryKey(k, true); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const unlock = (e) => {
    e.preventDefault();
    const k = draft.trim(); if (!k) return;
    writeKey(remember ? k : '');
    tryKey(k);
  };
  const lock = () => { setKey(''); setDraft(''); writeKey(''); setArmAll(false); setArmRow(null); setMsg(null); };

  const n = rows ? rows.length : 0;
  const nLabel = n >= 100 ? '100+' : n;
  const resetAll = async () => {
    if (!armAll) { setArmAll(true); setMsg(null); return; }
    setBusy(true);
    const r = await adminBoard(key, { all: true });
    setBusy(false); setArmAll(false);
    if (r.ok) { setMsg({ tone: 'ok', text: t(doneAll(Number(r.removed) || 0)) }); refresh(); } else fail(r.error);
  };
  const removeRow = async (name) => {
    clearTimeout(armTimer.current);
    if (armRow !== name) { setArmRow(name); armTimer.current = setTimeout(() => setArmRow(null), 5000); return; }
    setArmRow(null); setBusy(true);
    const r = await adminBoard(key, { name });
    setBusy(false);
    if (r.ok) { setMsg({ tone: 'ok', text: t(doneOne(name, r.removed)) }); refresh(); } else fail(r.error);
  };

  const rowAction = key ? (row) => (
    <button type="button" className={`pcb-x${armRow === row.name ? ' is-armed' : ''}`} disabled={busy}
      onClick={() => removeRow(row.name)} aria-label={`${t(GK.remove)} ${row.name}`}>
      {armRow === row.name ? t(GK.removeQ) : <X size="1em" aria-hidden="true" />}
    </button>
  ) : null;

  const panel = (
    <section className="pcb-gk" aria-label={t(GK.title)}>
      <p className="pcb-gk-title"><KeyRound size="1em" aria-hidden="true" /> {t(GK.title)}</p>
      {!key ? (
        <form className="pcb-gk-row" onSubmit={unlock}>
          <label className="pcb-gk-field">
            <span className="pc-sr">{t(GK.key)}</span>
            <input type="password" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t(GK.key)}
              autoComplete="off" spellCheck="false" autoCapitalize="off" />
          </label>
          <label className="pcb-gk-check">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> <span>{t(GK.remember)}</span>
          </label>
          <button type="submit" className="gf-btn" disabled={busy || !draft.trim()}>{busy ? t(GK.checking) : t(GK.unlock)}</button>
        </form>
      ) : (
        <div className="pcb-gk-row">
          {!armAll ? (
            <button type="button" className="gf-btn pcb-gk-danger" disabled={busy || !n} onClick={resetAll}>
              <Trash2 size="1em" aria-hidden="true" /> {t(GK.resetAll)}
            </button>
          ) : (
            <>
              <span className="pcb-gk-warn" role="alert">{t(confirmAll(nLabel))}</span>
              <button type="button" className="gf-btn pcb-gk-danger is-armed" disabled={busy} onClick={resetAll}>{t(confirmBtn(nLabel))}</button>
              <button type="button" className="gf-btn" disabled={busy} onClick={() => setArmAll(false)}>{t(GK.cancel)}</button>
            </>
          )}
          {!n && !armAll && <span className="pcb-gk-note">{t(GK.empty)}</span>}
          <button type="button" className="gf-btn" onClick={lock}><Lock size="1em" aria-hidden="true" /> {t(GK.lock)}</button>
        </div>
      )}
      <p className={`pcb-gk-msg${msg ? ` is-${msg.tone}` : ''}`} role="status" aria-live="polite">{msg ? msg.text : ''}</p>
    </section>
  );
  return { panel, rowAction };
}
