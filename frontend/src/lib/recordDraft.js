import {useEffect, useRef, useState, useCallback} from "react";
import {get, set, del} from "idb-keyval";

// Writes and deletion share the same chain: an old autosave cannot resurrect a
// successfully submitted draft. Account and route are part of every key.
const writes = new Map();
function enqueue(key, action) {
  const next = (writes.get(key) || Promise.resolve()).catch(() => {}).then(action);
  writes.set(key, next);
  return next;
}
export function useRecordDraft(key, record, baseRevision) {
  const [state, update] = useState({key: "", loaded: false, value: null, error: null});
  const cleared = useRef(null);
  useEffect(() => {
    let active = true;
    cleared.current = null;
    update({key, loaded: false, value: null, error: null});
    (writes.get(key) || Promise.resolve()).catch(() => {}).then(() => get(key)).then(value => {
      if (active) update({key, loaded: true, value: value || null, error: null});
    }).catch(() => {if (active) update({key, loaded: false, value: null, error: "Koncept nelze načíst z telefonu. Údaje se nepřepisují; zkontrolujte dostupnost úložiště a obnovte stránku."});});
    return () => {active = false;};
  }, [key]);
  useEffect(() => {
    if (!record || state.key !== key || !state.loaded || cleared.current === record.id) return;
    const value = {record: JSON.parse(JSON.stringify(record)), baseRevision, savedAt: new Date().toISOString()};
    let active = true;
    update(s => ({...s, saving: true}));
    enqueue(key, () => set(key, value)).then(() => {if (active) update(s => ({...s, saving: false, savedAt: value.savedAt, error: null}));})
      .catch(() => {if (active) update(s => ({...s, saving: false, error: "Koncept se nepodařilo uložit v telefonu. Nezavírejte stránku."}));});
    return () => {active = false;};
  }, [key, record, baseRevision, state.key, state.loaded]);
  const clear = useCallback(async () => {
    cleared.current = record?.id;
    await enqueue(key, () => del(key));
  }, [key, record?.id]);
  return {...state, loaded: state.key === key && state.loaded, clear};
}
