// W1-G temp scan — glyph-only buttons missing aria-label + small touch targets
const fs = require('fs'), path = require('path');
const out = [], small = [];
function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f); const s = fs.statSync(p);
    if (s.isDirectory()) walk(p);
    else if (/\.jsx$/.test(f)) scan(p);
  }
}
function scan(p) {
  const src = fs.readFileSync(p, 'utf8');
  const re = /<button\b([\s\S]*?)>([\s\S]*?)<\/button>/g; let m;
  while ((m = re.exec(src))) {
    const attrs = m[1], body = m[2];
    const line = src.slice(0, m.index).split('\n').length;
    const text = body.replace(/\{[\s\S]*?\}/g, '').replace(/<[^>]*>/g, '').trim();
    if (!/aria-label/.test(attrs) && text.length <= 2 && /[✕×⌂☾☀⚙⋯◀▶‹›←→+−↑↓]/.test(text)) {
      out.push(p + ':' + line + ' glyph=[' + text + ']');
    }
    const wm = attrs.match(/width:\s*(\d+)/), hm = attrs.match(/height:\s*(\d+)/);
    if (wm && hm && (+wm[1] < 44 || +hm[1] < 44)) small.push(p + ':' + line + ' ' + wm[1] + 'x' + hm[1]);
  }
}
walk('src');
console.log('--- glyph-only buttons w/o aria-label:', out.length);
console.log(out.slice(0, 25).join('\n'));
console.log('--- buttons with explicit w/h < 44px:', small.length);
console.log(small.slice(0, 20).join('\n'));
