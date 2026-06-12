// W1-E job 4 — phantom constant-key sweep
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'C:/Users/Powernet/Desktop/finio/src';
const bundle = JSON.parse(readFileSync('C:/Users/Powernet/Desktop/finio/src/rules/UK-2026.1.1.json', 'utf8'));

// Reconstruct TAX exactly as _bundle.js _buildTAX does — list its keys.
const TAX_KEYS = new Set([
  'pa','brl','brt','br','hr','ar','art','nrb','rnrb','rnrbTaper','ihtRate','cgaAllowance',
  'isaAllowance','jisaAllowance','pensionAA','mpaa','taperedAAAdj','taperedAAFloor','swr',
  'deadline','giftExemption','psaBasic','psaHigher','psaAdditional','hicbcTaperWidth','lsa',
  'lsdba','spa','ver','taxYear','statePensionFull','statePensionQualYears',
]);
// _buildTAX may define more keys after line 80 — append from source parse:
const bundleSrc = readFileSync('C:/Users/Powernet/Desktop/finio/src/engine/_bundle.js', 'utf8');
const buildBody = bundleSrc.slice(bundleSrc.indexOf('function _buildTAX'), bundleSrc.indexOf('// ── '), );
for (const m of buildBody.matchAll(/^\s{4}(\w+):/gm)) TAX_KEYS.add(m[1]);

const SECTIONS = {
  TAX: TAX_KEYS,
  INC: new Set(Object.keys(bundle.income || {})),
  CGT: new Set(Object.keys(bundle.capitalGains || {})),
  IHT: new Set(Object.keys(bundle.inheritanceTax || {})),
  PEN: new Set(Object.keys(bundle.pension || {})),
  ISA: new Set(Object.keys(bundle.isa || {})),
  NIC: new Set(Object.keys(bundle.nationalInsurance || {})),
  TR:  new Set(Object.keys(bundle.trusts || {})),
};

function* walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    const st = statSync(p);
    if (st.isDirectory()) { if (!/node_modules|graphify-out/.test(f)) yield* walk(p); }
    else if (/\.(js|jsx|mjs)$/.test(f)) yield p;
  }
}

const phantom = {};   // section -> key -> [file:line]
const counts = {};
for (const file of walk(ROOT)) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/\b(TAX|INC|CGT|IHT|PEN|ISA|NIC|TR)\.(\w+)/g)) {
      const [_, sec, key] = m;
      // skip obvious non-constant contexts (e.g. TAX_JSON handled separately; ISA. on strings rare)
      if (sec === 'TR' && !/tax-estate/.test(file)) continue;
      counts[sec] = (counts[sec] || 0) + 1;
      if (!SECTIONS[sec].has(key)) {
        phantom[sec] = phantom[sec] || {};
        (phantom[sec][key] = phantom[sec][key] || []).push(file.replace(/\\/g, '/').replace(ROOT + '/', '') + ':' + (i + 1));
      }
    }
    // TAX_JSON.section.key reads — verify section exists
    for (const m of line.matchAll(/\bTAX_JSON\.(\w+)(?:\??\.(\w+))?/g)) {
      const [, sec, key] = m;
      if (!key) continue;
      const obj = bundle[sec];
      if (!obj) {
        phantom['TAX_JSON'] = phantom['TAX_JSON'] || {};
        (phantom['TAX_JSON'][sec + '.*MISSING-SECTION*'] = phantom['TAX_JSON'][sec + '.*MISSING-SECTION*'] || []).push(file.replace(/\\/g, '/').replace(ROOT + '/', '') + ':' + (i + 1));
      } else if (!(key in obj)) {
        phantom['TAX_JSON'] = phantom['TAX_JSON'] || {};
        (phantom['TAX_JSON'][sec + '.' + key] = phantom['TAX_JSON'][sec + '.' + key] || []).push(file.replace(/\\/g, '/').replace(ROOT + '/', '') + ':' + (i + 1));
      }
    }
  });
}

console.log('READ COUNTS:', JSON.stringify(counts));
console.log('TAX keys known:', [...TAX_KEYS].join(','));
for (const [sec, keys] of Object.entries(phantom)) {
  console.log(`\n### PHANTOM ${sec} keys:`);
  for (const [k, locs] of Object.entries(keys)) {
    console.log(`  ${k}  (${locs.length} reads)  e.g. ${locs.slice(0, 4).join(' ; ')}`);
  }
}
