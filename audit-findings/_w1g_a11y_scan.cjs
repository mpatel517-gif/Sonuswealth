const fs = require('fs'), path = require('path');
function walk(d, out = []) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); const s = fs.statSync(p); if (s.isDirectory()) walk(p, out); else if (/\.(jsx|js)$/.test(f)) out.push(p); } return out; }
const files = walk('src');
let iconBtn = [], divClick = [], imgNoAlt = [], tinyFont = {}, tinyFontEx = [];
const icons = /[⌂⚙☾⋯✕✖◀▶×←→‹›☰⋮]|&times;/;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');
  const rel = f.split(path.sep).join('/');
  lines.forEach((l, i) => {
    if (/<button/.test(l)) {
      const win = lines.slice(i, Math.min(i + 8, lines.length)).join(' ');
      if (icons.test(win) && !/aria-label/.test(win)) iconBtn.push(rel + ':' + (i + 1) + ' :: ' + win.replace(/\s+/g, ' ').slice(0, 100));
    }
    if (/<div[^>]*onClick/.test(l)) {
      const win = lines.slice(i, Math.min(i + 4, lines.length)).join(' ');
      if (!/role=|onKeyDown|tabIndex/.test(win)) divClick.push(rel + ':' + (i + 1));
    }
    if (/<img\b/.test(l)) {
      const win = lines.slice(i, Math.min(i + 4, lines.length)).join(' ');
      if (!/alt=/.test(win)) imgNoAlt.push(rel + ':' + (i + 1));
    }
    const fm = l.match(/fontSize:\s*'?(\d+)/);
    if (fm && +fm[1] < 11) { tinyFont[fm[1]] = (tinyFont[fm[1]] || 0) + 1; if (+fm[1] <= 9 && tinyFontEx.length < 12) tinyFontEx.push(rel + ':' + (i + 1) + ' fontSize ' + fm[1]); }
  });
}
console.log('ICON-ONLY BUTTONS no aria-label (' + iconBtn.length + '):');
console.log(iconBtn.slice(0, 25).join('\n'));
console.log('\nDIV onClick no role/key/tabIndex (' + divClick.length + '), first 35:');
console.log(divClick.slice(0, 35).join('\n'));
// per-file counts for div clicks
const byFile = {};
divClick.forEach(d => { const k = d.replace(/:\d+$/, ''); byFile[k] = (byFile[k] || 0) + 1; });
console.log('\nDIV onClick per-file top10:', JSON.stringify(Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 10)));
console.log('\nIMG no alt (' + imgNoAlt.length + '):');
console.log(imgNoAlt.slice(0, 10).join('\n'));
console.log('\nfontSize<11 counts:', JSON.stringify(tinyFont));
console.log('fontSize<=9 examples:', tinyFontEx.join(' | '));
