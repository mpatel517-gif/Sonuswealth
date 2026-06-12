// W1-E Section 4 — wrong-key sweep: TAX./PEN./ISA./CGT./INC. reads vs _buildTAX canon
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TAX } from '../src/engine/_bundle.js';

const CANON = new Set(Object.keys(TAX));
const ROOT = join(import.meta.dirname, '..', 'src');

const files = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    const st = statSync(p);
    if (st.isDirectory()) { if (n !== 'node_modules') walk(p); }
    else if (/\.(js|jsx|mjs)$/.test(n)) files.push(p);
  }
})(ROOT);

const RE = /\b(TAX|PEN|ISA|CGT|INC)\s*[.?]+\s*([A-Za-z_$][\w$]*)/g;
const hits = {};   // prefix -> key -> [file:line]
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    // skip comment-only lines
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
    let m;
    RE.lastIndex = 0;
    while ((m = RE.exec(line))) {
      const [, pfx, key] = m;
      if (key === 'lastIndex') continue;
      hits[pfx] ??= {};
      hits[pfx][key] ??= [];
      hits[pfx][key].push(`${f.replace(ROOT, 'src').replace(/\\/g, '/')}:${i + 1}`);
    }
  });
}

// report
console.log('=== CANON TAX keys (' + CANON.size + ') ===');
console.log([...CANON].sort().join(', '));
console.log('\n=== TAX.* reads NOT in canon (phantom) ===');
for (const [key, locs] of Object.entries(hits.TAX || {}).sort()) {
  if (!CANON.has(key)) console.log(`TAX.${key} -> ${TAX[key] === undefined ? 'undefined' : JSON.stringify(TAX[key])} | ${locs.length} reads | ${locs.slice(0, 6).join(' ')}`);
}
console.log('\n=== TAX.* valid-key read counts ===');
const valid = Object.entries(hits.TAX || {}).filter(([k]) => CANON.has(k));
console.log(valid.map(([k, l]) => `${k}:${l.length}`).sort().join(', '));
console.log('\n=== Other prefixes (PEN/ISA/CGT/INC object reads) ===');
for (const pfx of ['PEN', 'ISA', 'CGT', 'INC']) {
  for (const [key, locs] of Object.entries(hits[pfx] || {}).sort()) {
    console.log(`${pfx}.${key} | ${locs.length} | ${locs.slice(0, 4).join(' ')}`);
  }
}
