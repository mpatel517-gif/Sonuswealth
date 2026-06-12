// W1-E job 4 v2 — phantom sweep against LIVE TAX object + bundle sections
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TAX } from '../../src/engine/_bundle.js';

const ROOT = 'C:/Users/Powernet/Desktop/finio/src';
const bundle = JSON.parse(readFileSync(ROOT + '/rules/UK-2026.1.1.json', 'utf8'));

const SECTIONS = {
  TAX: new Set(Object.keys(TAX)),
  INC: new Set(Object.keys(bundle.income || {})),
  CGT: new Set(Object.keys(bundle.capitalGains || {})),
  IHT: new Set(Object.keys(bundle.inheritanceTax || {})),
  PEN: new Set(Object.keys(bundle.pension || {})),
  ISA: new Set(Object.keys(bundle.isa || {})),
  NIC: new Set(Object.keys(bundle.nationalInsurance || {})),
};

function* walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    const st = statSync(p);
    if (st.isDirectory()) { if (!/node_modules|graphify-out/.test(f)) yield* walk(p); }
    else if (/\.(js|jsx|mjs)$/.test(f)) yield p;
  }
}

const phantom = {};
for (const file of walk(ROOT)) {
  const rel = file.replace(/\\/g, '/').replace(ROOT + '/', '');
  const src = readFileSync(file, 'utf8');
  // Only flag INC/CGT/IHT/PEN/ISA/NIC inside tax-estate-engine + files that destructure bundle sections the same way
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/\b(TAX|INC|CGT|IHT|PEN|ISA|NIC)\.(\w+)/g)) {
      const [, sec, key] = m;
      if (sec !== 'TAX' && !/tax-estate-engine|sa-computation|carry-forward/.test(rel)) continue; // local-scope sections
      if (!SECTIONS[sec].has(key)) {
        phantom[sec] = phantom[sec] || {};
        (phantom[sec][key] = phantom[sec][key] || []).push(rel + ':' + (i + 1));
      }
    }
    for (const m of line.matchAll(/\bTAX_JSON\.(\w+)\??\.(\w+)/g)) {
      const [, sec, key] = m;
      const obj = bundle[sec];
      const tag = !obj ? sec + '.[NO-SECTION].' + key : (!(key in obj) ? sec + '.' + key : null);
      if (tag) {
        phantom['TAX_JSON'] = phantom['TAX_JSON'] || {};
        (phantom['TAX_JSON'][tag] = phantom['TAX_JSON'][tag] || []).push(rel + ':' + (i + 1));
      }
    }
  });
}

for (const [sec, keys] of Object.entries(phantom)) {
  console.log(`### PHANTOM ${sec}:`);
  for (const [k, locs] of Object.entries(keys)) console.log(`  ${k} (${locs.length}) ${locs.slice(0, 5).join(' ; ')}`);
}
console.log('\nPEN bundle keys:', Object.keys(bundle.pension).join(','));
console.log('ISA bundle keys:', Object.keys(bundle.isa).join(','));
