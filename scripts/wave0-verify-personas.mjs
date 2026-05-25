// W0-T9 + T15 verification — per-persona engine snapshot
import { loadPersona } from '../src/lib/data-source.js';
import { rippleEffect } from '../src/engine/ripple.js';

const personas = ['mrT-core', 'persona-a', 'persona-b', 'persona-c', 'persona-d', 'persona-e', 'persona-g'];

function hasBadValue(obj, depth = 0) {
  if (depth > 6 || obj == null) return null;
  if (typeof obj === 'number') {
    if (Number.isNaN(obj)) return 'NaN';
    if (!Number.isFinite(obj)) return 'Infinity';
    return null;
  }
  if (typeof obj !== 'object') return null;
  for (const k in obj) {
    const r = hasBadValue(obj[k], depth + 1);
    if (r) return `${k}:${r}`;
  }
  return null;
}

for (const p of personas) {
  try {
    const e = await loadPersona(p);
    if (!e) { console.log(`${p}: LOAD_FAIL`); continue; }
    const out = rippleEffect(e);
    const fq = out.scores?.fq?.score ?? '?';
    const risk = out.scores?.risk?.score ?? '?';
    const nw = out.balance_sheet?.netWorth ?? '?';
    const surplusObj = out.cashflow?.monthlySurplus;
    const surplus = (surplusObj && typeof surplusObj === 'object')
      ? (surplusObj.amount ?? surplusObj.value ?? surplusObj.surplus ?? JSON.stringify(surplusObj).slice(0,40))
      : surplusObj;
    const nwR = typeof nw === 'number' ? Math.round(nw) : nw;
    const sR = typeof surplus === 'number' ? Math.round(surplus) : surplus;
    const bad = hasBadValue(out.scores) || hasBadValue(out.balance_sheet);
    console.log(`${p}: NW=${nwR} FQ=${fq} Risk=${risk} Surplus=${sR}${bad ? ' BAD=' + bad : ''}`);
  } catch (err) {
    console.log(`${p}: ERR ${err.message}`);
  }
}
