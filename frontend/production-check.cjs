/* Run with node production-check.cjs after installing frontend dependencies. */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('node:assert/strict');
const roots = [process.env.DEMSTAV_CHECK_MODULES || __dirname, __dirname];
const dep = (name) => require(require.resolve(name, { paths: roots }));
const babel = dep('@babel/core');
const parser = dep('@babel/parser');
const commonjs = require.resolve('@babel/plugin-transform-modules-commonjs', { paths: roots });
const jsx = require.resolve('@babel/plugin-transform-react-jsx', { paths: roots });
let parsed = 0;
function parse(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, e.name);
    if (e.isDirectory()) parse(file);
    else if (/\.(js|jsx)$/.test(file)) { parser.parse(fs.readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['jsx'] }); parsed++; }
  }
}
parse(path.join(__dirname, 'src'));
function compile(file) { return babel.transformSync(fs.readFileSync(file, 'utf8'), { babelrc: false, configFile: false, plugins: [[jsx, { runtime: 'classic' }], commonjs] }).code; }
function load(file, mocks, extras = {}) {
  const mod = { exports: {} };
  const sandbox = { module: mod, exports: mod.exports, require: (name) => {
    if (name in mocks) return mocks[name];
    throw new Error('Unexpected dependency: ' + name);
  }, ...extras };
  vm.runInNewContext(compile(file), sandbox, { filename: file });
  return mod.exports;
}
(async () => {
  const stored = new Map();
  let available = false;
  const sent = [];
  let nextId = 0;
  const sync = load(path.join(__dirname, 'src/lib/sync.js'), {
    'idb-keyval': { get: async (k) => stored.get(k), set: async (k, v) => stored.set(k, structuredClone(v)), del: async (k) => stored.delete(k) },
    react: { useEffect() {}, useState() {} },
    './format': { newId: () => 'op-' + (++nextId) },
    './api': { getToken: () => 'test-token', errText: () => 'error', http: {
      async put(url, body) { if (!available) throw new Error('offline'); sent.push({ url, body }); return { data: {} }; },
      async post() { throw new Error('unused'); }
    } }
  }, { navigator: { onLine: false }, setInterval() {} });
  await sync.initSync('marcel'); await sync.syncNow();
  await sync.saveProduction({ id: 'report-123', date: '2026-10-26', revision: 0 }, true);
  await sync.syncNow();
  assert.equal(sync.getState().queue.length, 1);
  assert.equal(stored.get('u:marcel:queue')[0].type, 'production');
  available = true;
  await sync.syncNow();
  assert.equal(sync.getState().queue.length, 0);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, '/production/report-123');
  assert.equal(sent[0].body.submit, true);
  assert.equal(sent[0].body.baseRevision, 0);
  assert.ok(sent[0].body.opId);
  // Render a recovered offline draft and exercise the submit control.
  const React = dep('react');
  const Renderer = dep('react-test-renderer');
  const draft = { id: 'report-456', date: '2026-10-26', customer: 'JEKAER a.s.', site: 'Struskárna', crew: 'Schmidt, Hynčicová', machines: 'L566/3', work: 'Třídění strusky', start: '16:30', end: '18:00', tonnes: '31,35', tickets: [{ attachment_id: 'ticket-123', name: 'listek.jpg', tonnes: '31,35' }], revision: 0 };
  const saved = [];
  let tree;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const Page = load(path.join(__dirname, 'src/pages/Production.jsx'), {
    react: React,
    'idb-keyval': { get: async () => draft, set: async () => {}, del: async () => {} },
    sonner: { toast: { success() {}, error(message) { throw new Error(message); } } },
    '@/components/ui/button': { Button: (props) => React.createElement('button', props, props.children) },
    '@/components/Section': { PageHeader: (props) => React.createElement('h1', null, props.title) },
    '@/lib/auth': { useAuth: () => ({ user: { id: 'marcel', name: 'Marcel Schmidt', role: 'employee' } }), atLeast: () => false },
    '@/lib/data': { useCached: (url) => ({ data: url.includes('settings') ? { responsible_ids: ['marcel'], people: [] } : [], reload() {} }) },
    '@/lib/api': { http: {}, errText: (e) => e.message, downloadFile: async () => {} },
    '@/lib/sync': { useSync: () => ({ queue: [] }), addAttachment: async () => {}, saveProduction: async (...args) => saved.push(args), localBlob: async () => null, removeOp: async () => {} },
    '@/lib/format': { newId: () => 'new-id-123', pragueDate: () => '2026-10-26' }
  }, { setTimeout, window: { confirm: () => true } }).default;
  await Renderer.act(async () => { tree = Renderer.create(React.createElement(Page)); });
  assert.ok(tree.root.findAllByType('input').some((i) => i.props.capture === 'environment'));
  const submit = tree.root.findAllByType('button').find((b) => b.props.children === 'Odevzdat s lístky');
  await Renderer.act(async () => { await submit.props.onClick(); });
  assert.equal(saved.length, 1);
  assert.equal(saved[0][0].crew, draft.crew);
  assert.equal(saved[0][1], true);
  await Renderer.act(async () => tree.unmount());
  console.log(`PASS: ${parsed} parsed JS/JSX files, durable offline queue, server submission, recovered draft form and camera input.`);
})().catch((e) => { console.error(e); process.exitCode = 1; });
