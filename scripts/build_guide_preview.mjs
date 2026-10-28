#!/usr/bin/env node
// Builds an isolated read-only copy from the real React components.
// No production entrypoint, authentication or backend is included.
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const frontend = path.join(root, "frontend");
const require = createRequire(path.join(frontend, "package.json"));
const webpack = require("webpack");
const postcss = require("postcss");
const tailwindcss = require("tailwindcss");
const mockRoot = path.join(root, "scripts/guide-preview");
const output = path.join(frontend, "public/help/preview");
await fs.mkdir(output, { recursive: true });
const alias = { "@": path.join(frontend, "src") };
for (const name of ["auth", "api", "data", "sync", "recordDraft"]) alias[`@/lib/${name}$`] = path.join(mockRoot, `${name}.js`);
alias["@/components/DiaryAssistant$"] = path.join(mockRoot, "DiaryAssistant.jsx");
// Webpack resolves specific aliases before the broad source alias.
const aliases = Object.fromEntries([...Object.entries(alias).filter(([key]) => key !== "@"), ["@", alias["@"]]]);
await new Promise((resolve, reject) => webpack({
  mode: "production", context: frontend, entry: path.join(mockRoot, "entry.jsx"),
  output: { path: output, filename: "bundle.js", publicPath: "./", clean: false },
  devtool: false, resolve: { extensions: [".js", ".jsx", ".json"], alias: aliases, modules: [path.join(frontend, "node_modules"), "node_modules"] },
  module: { rules: [{ test: /\.jsx?$/, exclude: /node_modules/, use: { loader: require.resolve("babel-loader"), options: { babelrc: false, configFile: false, presets: [[require.resolve("@babel/preset-env"), { targets: { esmodules: true } }], [require.resolve("@babel/preset-react"), { runtime: "automatic" }]] } } }] },
  plugins: [new webpack.DefinePlugin({ "process.env.NODE_ENV": JSON.stringify("production"), "process.env.REACT_APP_BACKEND_URL": JSON.stringify("") })],
  performance: { hints: false },
}, (error, stats) => {
  if (error || stats.hasErrors()) return reject(error || new Error(stats.toString({ all: false, errors: true })));
  const forbidden = ["auth.jsx", "api.js", "data.js", "sync.js", "recordDraft.js"].map(name => path.join(frontend, "src/lib", name));
  const inspectModule = module => {
    if (module.resource && forbidden.includes(module.resource)) throw new Error(`Live data module in preview: ${module.resource}`);
    for (const child of module.modules || []) inspectModule(child);
  };
  try { for (const module of stats.compilation.modules) inspectModule(module); } catch (failure) { reject(failure); return; }
  console.log(stats.toString({ all: false, assets: true })); resolve();
}));
const config = require(path.join(frontend, "tailwind.config.js"));
config.content = [path.join(frontend, "src/**/*.{js,jsx}"), path.join(mockRoot, "*.{js,jsx}")];
const css = await fs.readFile(path.join(frontend, "src/index.css"), "utf8");
const compiled = await postcss([tailwindcss(config), require("autoprefixer")]).process(css, { from: path.join(frontend, "src/index.css") });
await fs.writeFile(path.join(output, "styles.css"), compiled.css + `\n.demo-banner{position:relative;z-index:60;background:#ffd200;color:#0f172a;padding:10px 16px;font:13px/1.4 system-ui;display:flex;flex-wrap:wrap;gap:4px 16px}.demo-navigation{display:flex;flex-wrap:wrap;gap:12px;padding:8px 16px;background:#fff;border-bottom:1px solid #cbd5e1;font:12px system-ui}.demo-navigation a{padding:4px;color:#334155;text-decoration:underline}.demo-navigation a[aria-current]{font-weight:700;color:#0f172a}.demo-banner strong{letter-spacing:.05em}\n`);
await fs.writeFile(path.join(output, "screen.html"), `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'"><title>DEMSTAV · dokumentační DEMO</title><link rel="stylesheet" href="./styles.css"></head><body><div id="root"></div><script src="./bundle.js" defer></script></body></html>`);
// An iframe establishes a true mobile CSS viewport even on a desktop screen.
// The frame is a documentation surface, not a fake screenshot or device mockup.
await fs.writeFile(path.join(output, "index.html"), `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DEMSTAV · mobilní dokumentační DEMO</title><style>html,body{margin:0;min-height:100%;background:#e2e8f0}iframe{display:block;width:min(420px,100vw);height:100vh;min-height:720px;margin:0 auto;border:0;background:#fff}</style></head><body><iframe id="demo" title="Skutečné obrazovky DEMSTAV s fiktivními daty" src="./screen.html"></iframe><script>const screen=new URLSearchParams(location.search).get('screen');if(['today','record','records','attendance','guide','login'].includes(screen))document.getElementById('demo').src='./screen.html?screen='+screen;</script></body></html>`);
console.log("Read-only documentation preview:", output);
