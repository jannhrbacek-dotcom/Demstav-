const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function worker() {
  const handlers = {}, shown = [], opened = [];
  const self = {
    location: { origin: 'https://demstav.example' },
    addEventListener: (name, fn) => { handlers[name] = fn; },
    registration: { showNotification: async (...args) => shown.push(args) },
    clients: { matchAll: async () => [], openWindow: async (url) => opened.push(url) },
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../frontend/public/sw.js'), 'utf8'), { self, URL });
  return { handlers, shown, opened };
}

test('push displays a notification without an open app window', async () => {
  const { handlers, shown } = worker();
  let done;
  handlers.push({ data: { json: () => ({ title: 'Nová směna', body: 'Změna', url: '/nepritomnost' }) }, waitUntil: (p) => done = p });
  await done;
  assert.equal(shown[0][0], 'Nová směna');
  assert.equal(shown[0][1].data.url, 'https://demstav.example/nepritomnost');
});

test('malformed payload still displays a generic notification', async () => {
  const { handlers, shown } = worker();
  let done;
  handlers.push({ data: { json: () => { throw new Error('bad JSON'); } }, waitUntil: (p) => done = p });
  await done;
  assert.equal(shown[0][0], 'DEMSTAV OPERATIONS');
});

test('notification click cannot navigate outside the application', async () => {
  const { handlers, opened } = worker();
  let done;
  handlers.notificationclick({ notification: { close() {}, data: { url: 'https://evil.example/' } }, waitUntil: (p) => done = p });
  await done;
  assert.equal(opened[0], 'https://demstav.example/dnes');
});
