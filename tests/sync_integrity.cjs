// Regression for AUD-11 using the real sync engine with isolated storage/HTTP.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
let source = fs.readFileSync(path.join(__dirname, '../frontend/src/lib/sync.js'), 'utf8')
  .replace(/^import .*;\n/gm, '').replace(/^export /gm, '');
source += '\nthis.engine = {initSync, saveRecordLocal, syncNow, getState, resetSync};';
const storage = new Map();
let n = 0, revision = 0, release, entered;
const started = new Promise(resolve => { entered = resolve; });
const calls = [];
const context = {
  structuredClone,
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
  assert.deepEqual(calls, ['first edit', 'second edit']);
  assert.equal(pendingBefore, 1);
  assert.equal(e.getState().queue.length, 0);
  assert.equal(e.getState().records['test-record'].record.work, 'second edit');
  console.log('AUD-11 FIX VERIFIED: both immutable edits sent in order, latest edit retained.');
  let releaseOld, enteredOld;
  const oldStarted = new Promise(resolve => { enteredOld = resolve; });
  context.http.put = async (_, body) => {
    enteredOld();
    await new Promise(resolve => { releaseOld = resolve; });
    return {data: {record: {...body.record, revision: 3, status: 'draft'}}};
  };
  await e.saveRecordLocal({id: 'test-record', work: 'account A pending'}, {});
  await oldStarted;
  const oldRun = e.syncNow();
  e.resetSync();
  await e.initSync('account-B');
  releaseOld();
  await oldRun;
  await e.syncNow();
  assert.equal(Object.keys(e.getState().records).length, 0);
  assert.equal(e.getState().queue.length, 0);
  assert.equal(storage.get('u:test-user:sync-v2').queue.length, 1);
  console.log('Account switch verified: old response cannot modify account B; account A queue retained.');

})().catch(error => { console.error(error); process.exitCode = 1; });
