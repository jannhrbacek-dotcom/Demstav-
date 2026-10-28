// Deterministic reproduction of AUD-11. Uses the real sync engine with in-memory
// IndexedDB/HTTP adapters; no browser, credentials or network. This confirms the
// defect exists; it is deliberately NOT a regression acceptance test or a fix.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
let source = fs.readFileSync(path.join(__dirname, '../frontend/src/lib/sync.js'), 'utf8')
  .replace(/^import .*;\n/gm, '').replace(/^export /gm, '');
source += '\nthis.engine = {initSync, saveRecordLocal, syncNow, getState};';
const storage = new Map();
let n = 0, revision = 0, release, entered;
const started = new Promise(resolve => { entered = resolve; });
const calls = [];
const context = {
  navigator: {onLine: true}, Date, console, FormData,
  get: async key => structuredClone(storage.get(key)),
  set: async (key, val) => { storage.set(key, structuredClone(val)); },
  del: async key => storage.delete(key),
  getToken: () => 'test-only', newId: () => `op-${++n}`, errText: e => e.message,
  http: {
    get: async () => ({data: {}}),
    put: async (_, body) => {
      const sent = structuredClone(body.record);
      calls.push(sent.work);
      if (calls.length === 1) {
        entered();
        await new Promise(resolve => { release = resolve; });
      }
      return {data: {record: {...sent, status: 'draft', revision: ++revision}}};
    }
  }
};
vm.createContext(context);
vm.runInContext(source, context);
(async () => {
  const e = context.engine;
  await e.initSync('test-user');
  await e.syncNow();
  await e.saveRecordLocal({id: 'test-record', work: 'first edit'}, {});
  await started;
  await e.saveRecordLocal({id: 'test-record', work: 'second edit'}, {});
  release();
  await e.syncNow();
  const pendingBefore = e.getState().queue.length;
  await e.syncNow();
  assert.deepEqual(calls, ['first edit', 'first edit']);
  assert.equal(pendingBefore, 1);
  assert.equal(e.getState().queue.length, 0);
  assert.equal(e.getState().records['test-record'].record.work, 'first edit');
  console.log('AUD-11 REPRODUCED: second edit was replaced by first response; next sync sent first edit again; queue is empty.');
})().catch(error => { console.error(error); process.exitCode = 1; });
