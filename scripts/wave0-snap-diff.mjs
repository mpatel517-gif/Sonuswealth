// W0-T9 snapshot diff — baseline vs post-migration
import fs from 'fs';

const baseline = JSON.parse(fs.readFileSync('./docs/superpowers/plans/wave0-baseline-snap.json', 'utf8'));
const post = JSON.parse(fs.readFileSync('./docs/superpowers/plans/wave0-post-migration-snap.json', 'utf8'));

function strip(o) {
  if (o && typeof o === 'object') {
    if ('computedAt' in o) delete o.computedAt;
    if ('computed_at' in o) delete o.computed_at;
    if ('elapsedMs' in o) delete o.elapsedMs;
    if ('timestamp' in o) delete o.timestamp;
    for (const k in o) strip(o[k]);
  }
  return o;
}

strip(baseline); strip(post);
const a = JSON.stringify(baseline);
const b = JSON.stringify(post);
console.log(a === b ? 'CLEAN' : 'DIFF DETECTED');
if (a !== b) {
  let i = 0;
  while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
  console.log('First diff at char', i);
  console.log('baseline:', a.slice(Math.max(0, i - 50), i + 200));
  console.log('post    :', b.slice(Math.max(0, i - 50), i + 200));
}
