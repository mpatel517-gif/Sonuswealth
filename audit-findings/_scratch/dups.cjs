const fs = require('fs');
const txt = fs.readFileSync(process.argv[2], 'utf8');
const map = {};
for (const line of txt.split(/\r?\n/)) {
  const m = line.match(/engine[\\/](.+?):(\d+):export (?:function|const) (\w+)/);
  if (!m) continue;
  const [, f, ln, name] = m;
  (map[name] = map[name] || []).push(f + ':' + ln);
}
const dups = Object.entries(map).filter(([k, v]) => v.length > 1);
console.log('DUPLICATE EXPORT NAMES:');
for (const [k, v] of dups) console.log(k, '=>', v.join(' | '));
console.log('TOTAL exports:', Object.keys(map).length);
