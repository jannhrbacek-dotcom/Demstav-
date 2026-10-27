// Offline-first store + sync engine. Data is kept per account in IndexedDB; nothing is deleted on session expiry.
import { get, set, del } from "idb-keyval";
import { useEffect, useState } from "react";
import { http, getToken, errText } from "./api";
import { newId } from "./format";

const PRIORITY = { attachment: 0, record: 1, event: 2, request: 3, production: 1 };
let uid = null;
let state = { queue: [], records: {}, serverRecords: [], online: typeof navigator !== "undefined" ? navigator.onLine : true, syncing: false, needsLogin: false, lastSync: null, lastError: null, ready: false };
const listeners = new Set();
const emit = () => listeners.forEach((l) => l(state));
const k = (name) => `u:${uid}:${name}`;
const patch = (p) => { state = { ...state, ...p }; emit(); };

async function persist() {
  if (!uid) return;
  await set(k("queue"), state.queue);
  await set(k("records"), state.records);
}

export async function initSync(userId) {
  if (uid === userId && state.ready) return;
  uid = userId;
  const [queue, records, serverRecords] = await Promise.all([get(k("queue")), get(k("records")), get(k("serverRecords"))]);
  patch({ queue: queue || [], records: records || {}, serverRecords: serverRecords || [], ready: true, needsLogin: false });
  syncNow();
}
export function resetSync() { uid = null; state = { ...state, queue: [], records: {}, serverRecords: [], ready: false }; emit(); }
export const getState = () => state;
export function setNeedsLogin(v) { patch({ needsLogin: v }); }

export function useSync() {
  const [s, setS] = useState(state);
  useEffect(() => { listeners.add(setS); setS(state); return () => listeners.delete(setS); }, []);
  return s;
}

// ---------------- records ----------------
export async function cacheServerRecords(list) {
  patch({ serverRecords: list });
  if (uid) await set(k("serverRecords"), list);
  // server copy confirms local entries that are already accepted
  const recs = { ...state.records };
  let changed = false;
  for (const r of list) {
    const loc = recs[r.id];
    if (loc && (loc.localState === "received" || loc.localState === "confirmed") && r.revision >= (loc.serverRevision || 0)) { delete recs[r.id]; changed = true; }
  }
  if (changed) { patch({ records: recs }); await persist(); }
}

export async function saveRecordLocal(record, { confirm = false, correctionReason = "", baseRevision }) {
  const now = new Date().toISOString();
  const prev = state.records[record.id];
  const base = baseRevision ?? prev?.serverRevision ?? record.revision ?? 0;
  const entry = { record: { ...record, updatedAt: now }, serverRevision: base, localState: "queued", confirm, correctionReason, savedAt: now, error: null };
  const queue = state.queue.filter((op) => !(op.type === "record" && op.refId === record.id && op.state !== "sending"));
  queue.push({ opId: newId(), type: "record", refId: record.id, createdAt: now, attempts: 0, state: "queued", error: null,
    payload: { confirm, correctionReason, baseRevision: base, deviceSavedAt: now } });
  patch({ records: { ...state.records, [record.id]: entry }, queue });
  await persist();
  syncNow();
}

export async function discardLocalRecord(id) {
  const recs = { ...state.records }; delete recs[id];
  patch({ records: recs, queue: state.queue.filter((op) => !(op.type === "record" && op.refId === id)) });
  await persist();
}

export async function resolveConflict(id, choice, correctionReason = "") {
  const loc = state.records[id];
  if (!loc) return;
  if (choice === "server") { await discardLocalRecord(id); return; }
  const server = loc.serverRecord;
  await saveRecordLocal(loc.record, { confirm: server?.status === "confirmed" ? true : loc.confirm, correctionReason: correctionReason || loc.correctionReason, baseRevision: server?.revision || 0 });
}

// Shared crew reports use the same durable account-specific queue as daily records.
export async function saveProduction(report, submit = false) {
  const now = new Date().toISOString();
  const previous = state.queue.find((op) => op.type === "production" && op.refId === report.id);
  const payload = { report, submit, baseRevision: previous?.payload.baseRevision ?? report.revision ?? 0 };
  const op = { opId: newId(), type: "production", refId: report.id, createdAt: now, attempts: 0, state: "queued", error: null, payload };
  patch({ queue: [...state.queue.filter((q) => !(q.type === "production" && q.refId === report.id)), op] });
  await persist();
  syncNow();
}

// ---------------- attachments ----------------
export async function addAttachment(file, meta) {
  const id = newId();
  await set(k("blob:" + id), file);
  const att = { id, name: file.name, type: file.type || "application/octet-stream", size: file.size, kind: meta.kind || "other", km: meta.km || "", section: meta.section || "general" };
  const now = new Date().toISOString();
  patch({ queue: [...state.queue, { opId: newId(), type: "attachment", refId: id, createdAt: now, attempts: 0, state: "queued", error: null, payload: { ...att, recordId: meta.recordId } }] });
  await persist();
  syncNow();
  return att;
}
export async function localBlob(id) { return uid ? get(k("blob:" + id)) : null; }

// ---------------- attendance ----------------
export async function addAttendanceEvent(ev) {
  const now = new Date().toISOString();
  const op = { opId: newId(), type: "event", refId: ev.id, createdAt: now, attempts: 0, state: "queued", error: null, payload: ev };
  patch({ queue: [...state.queue, op] });
  await persist();
  await syncNow();
  return state.queue.find((o) => o.opId === op.opId) || null; // null = accepted by server
}
export async function addAttendanceRequest(req) {
  const now = new Date().toISOString();
  patch({ queue: [...state.queue, { opId: newId(), type: "request", refId: req.id, createdAt: now, attempts: 0, state: "queued", error: null, payload: req }] });
  await persist();
  syncNow();
}
export async function updateOp(opId, payloadPatch) {
  patch({ queue: state.queue.map((o) => (o.opId === opId ? { ...o, state: "queued", error: null, payload: { ...o.payload, ...payloadPatch } } : o)) });
  await persist();
  return syncNow();
}
export async function removeOp(opId) {
  const op = state.queue.find((o) => o.opId === opId);
  if (op?.type === "attachment") await del(k("blob:" + op.refId));
  patch({ queue: state.queue.filter((o) => o.opId !== opId) });
  await persist();
}

// ---------------- engine ----------------
let running = null;
const listenersAccepted = new Set();
export const onAccepted = (fn) => { listenersAccepted.add(fn); return () => listenersAccepted.delete(fn); };

async function sendOp(op) {
  if (op.type === "attachment") {
    const blob = await get(k("blob:" + op.refId));
    if (!blob) throw Object.assign(new Error("Soubor p\u0159\u00edlohy u\u017e v telefonu nen\u00ed."), { permanent: true });
    const fd = new FormData();
    fd.append("file", blob, op.payload.name);
    fd.append("id", op.refId); fd.append("kind", op.payload.kind); fd.append("km", op.payload.km || ""); fd.append("record_id", op.payload.recordId || ""); fd.append("section", op.payload.section || "general");
    await http.post("/attachments", fd, { timeout: 120000 });
    await del(k("blob:" + op.refId));
    return;
  }
  if (op.type === "record") {
    const loc = state.records[op.refId];
    if (!loc) return;
    const { data } = await http.put(`/records/${op.refId}`, { opId: op.opId, record: loc.record, ...op.payload });
    const rec = data.record;
    patch({ records: { ...state.records, [op.refId]: { ...loc, localState: rec.status === "confirmed" ? "confirmed" : "received", serverRevision: rec.revision, record: rec, error: null } } });
    return;
  }
  if (op.type === "production") {
    await http.put(`/production/${op.refId}`, { ...op.payload, opId: op.opId });
    return;
  }
  if (op.type === "event") { await http.post("/attendance/events", op.payload); return; }
  if (op.type === "request") { await http.post("/attendance/requests", op.payload); return; }
}

export function syncNow() {
  if (running) return running;
  running = (async () => {
    if (!uid) return;
    if (!getToken()) { patch({ needsLogin: true }); return; }
    patch({ syncing: true, lastError: null });
    const order = [...state.queue].filter((o) => o.state === "queued" || o.state === "retry").sort((a, b) => PRIORITY[a.type] - PRIORITY[b.type] || a.createdAt.localeCompare(b.createdAt));
    let accepted = 0;
    for (const op0 of order) {
      const op = state.queue.find((o) => o.opId === op0.opId);
      if (!op) continue;
      try {
        await sendOp(op);
        accepted++;
        patch({ queue: state.queue.filter((o) => o.opId !== op.opId) });
        await persist();
      } catch (e) {
        const st = e?.response?.status;
        const detail = e?.response?.data?.detail;
        if (!e.response && !e.permanent) {
          // network failure: keep everything, mark events as recorded offline
          patch({ online: false, queue: state.queue.map((o) => (o.type === "event" && (o.state === "queued" || o.state === "retry") ? { ...o, payload: { ...o.payload, offline: true } } : o)) });
          await persist();
          break;
        }
        if (st === 401) { patch({ needsLogin: true }); break; }
        let upd = { attempts: (op.attempts || 0) + 1, error: e.permanent ? e.message : errText(e), state: "error" };
        if (st === 409 && op.type === "record" && detail?.code === "conflict") {
          upd.state = "conflict";
          const loc = state.records[op.refId];
          patch({ records: { ...state.records, [op.refId]: { ...loc, localState: "conflict", serverRecord: detail.server } } });
        } else if (st === 422 && op.type === "event" && detail?.code === "exception_reason_required") {
          upd.state = "needs_reason"; upd.reasons = detail.reasons;
        } else if (st === 422 && detail?.code === "attachments_missing") {
          upd.state = "retry";
        } else if (st >= 500) {
          upd.state = "retry";
        }
        if (op.type === "record" && upd.state === "error") {
          const loc = state.records[op.refId];
          if (loc) patch({ records: { ...state.records, [op.refId]: { ...loc, localState: "error", error: upd.error } } });
        }
        patch({ queue: state.queue.map((o) => (o.opId === op.opId ? { ...o, ...upd } : o)), lastError: upd.error });
        await persist();
        if (st >= 500) break;
      }
    }
    patch({ syncing: false, lastSync: new Date().toISOString(), online: navigator.onLine && state.online !== false ? true : state.online });
    if (accepted) listenersAccepted.forEach((fn) => fn());
  })().finally(() => { running = null; });
  return running;
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { patch({ online: true }); syncNow(); });
  window.addEventListener("offline", () => patch({ online: false }));
  setInterval(() => { if (uid && state.queue.some((o) => o.state === "queued" || o.state === "retry")) { patch({ online: true }); syncNow(); } }, 30000);
}

export const pendingCount = (s) => s.queue.length;
