// Run after compiling src/index.css with Tailwind; checks emitted CSS cascade.
const fs = require('fs');
const assert = require('assert');
const postcss = require('postcss');
const { JSDOM } = require('jsdom');
const sheet = postcss.parse(fs.readFileSync(process.argv[2], 'utf8'));
const families = ['amber','yellow','orange','emerald','green','red','rose','blue','sky','purple'];
const luminance = rgb => rgb.map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((s,x,i) => s + x * [.2126,.7152,.0722][i], 0);
const ratio = (a,b) => { const l=[a,b].map(x=>luminance(x.match(/[\d.]+/g).slice(0,3).map(Number))).sort((x,y)=>y-x);return (l[0]+.05)/(l[1]+.05); };
let checked = 0;
for (const dark of [false,true]) {
  const variables = {};
  sheet.walkRules(rule => {
    if (rule.selector === ':root' || (dark && rule.selector === 'html.dark')) rule.walkDecls(/^--/, d => variables[d.prop] = d.value);
  });
  let css = '';
  sheet.walkRules(rule => {
    // Theme/token and simple utility rules only: JSDOM does not implement all
    // Tailwind pseudo selectors. Hover states require a real browser separately.
    if (!rule.selector.includes('html.dark') && !/^\.(?:bg-|text-|btn-primary|shell-logo)/.test(rule.selector)) return;
    if (/:hover|:focus|::|:has\(/.test(rule.selector)) return;
    if (!dark && rule.selector.includes('html.dark')) return;
    css += rule.toString().replace(/var\((--[\w-]+)(?:,\s*[^)]+)?\)/g, (_,key)=>variables[key] || (key.startsWith('--tw-') ? '1' : 'initial')).replace(/rgb\((\d+)\s+(\d+)\s+(\d+)\s*\/\s*([\d.]+)\)/g, 'rgba($1,$2,$3,$4)');
  });
  const available = sel => { let found=false; sheet.walkRules(r=>{if(r.selector===sel)found=true});return found; };
  const markup = families.filter(f=>available(`.bg-${f}-100`) && available(`.text-${f}-900`)).map(f=>`<section class="bg-${f}-100"><span class="text-slate-900">Label</span><small class="text-slate-600">Description</small><b class="text-${f}-900">Status</b></section>`).join('') + '<section class="bg-[#FFD200]"><span class="text-slate-900">Action</span></section><section class="bg-white shell-logo"><svg></svg><span class="shell-logo-title">DEMSTAV</span></section>';
  const dom = new JSDOM(`<html class="${dark ? 'dark' : ''}"><head><style>${css}</style></head><body>${markup}</body></html>`);
  for(const section of dom.window.document.querySelectorAll('section')) {
    const bg = dom.window.getComputedStyle(section).backgroundColor;
    for(const el of section.children) {
      const fg = dom.window.getComputedStyle(el).color;
      assert(fg && bg, `Unresolved colour ${section.className} ${el.className}: ${fg}/${bg}`); const contrast = ratio(fg,bg);
      assert(contrast >= (el.tagName === 'svg' ? 3 : 4.5), `${dark?'dark':'light'} ${section.className} ${el.className}: ${contrast.toFixed(2)}`);
      checked++;
    }
  }
}
console.log(`${checked} compiled foreground/background combinations meet contrast thresholds (hover/browser layout not covered).`);
