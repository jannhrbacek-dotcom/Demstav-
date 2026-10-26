import { useCallback, useEffect, useState } from "react";
import { get, set } from "idb-keyval";
import { http } from "./api";
import { getState, onAccepted } from "./sync";

/** GET with offline fallback to the last copy stored for this account. */
export function useCached(path, { deps = [], enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    if (!enabled || !path) { setLoading(false); return; }
    const uid = JSON.parse(localStorage.getItem("demstav:user") || "{}").id;
    const key = `u:${uid}:cache:${path}`;
    try {
      const { data: d } = await http.get(path);
      setData(d); setFromCache(false); setError(null);
      set(key, d).catch(() => {});
    } catch (e) {
      const c = await get(key).catch(() => null);
      if (c !== undefined && c !== null) { setData(c); setFromCache(true); } else setError(e);
    } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled, ...deps]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => onAccepted(() => load()), [load]);
  return { data, loading, fromCache, error, reload: load, setData };
}

export function mergedRecords(serverList, localMap) {
  const map = new Map();
  for (const r of serverList || []) map.set(r.id, { record: r, state: r.status === "confirmed" ? "confirmed" : "draft", server: r });
  for (const [id, loc] of Object.entries(localMap || {})) {
    const srv = map.get(id)?.server;
    if ((loc.localState === "received" || loc.localState === "confirmed") && srv && srv.revision >= loc.serverRevision) continue;
    map.set(id, { record: loc.record, state: loc.localState === "received" ? "draft" : loc.localState, server: srv, local: loc });
  }
  return [...map.values()].sort((a, b) => (b.record.date || "").localeCompare(a.record.date || "") || (b.record.updatedAt || "").localeCompare(a.record.updatedAt || ""));
}

export const currentLocal = () => getState();
