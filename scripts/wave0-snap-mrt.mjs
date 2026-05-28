// One-off W0-T2 baseline snapshot: Mr T @ 2026/27
// Writes JSON to docs/superpowers/plans/wave0-baseline-snap.json
import fs from 'fs';
import path from 'path';
import { generateSnapshot } from '../tests/harness/snapshot.mjs';

const out = path.resolve('docs/superpowers/plans/wave0-baseline-snap.json');
const snap = await generateSnapshot('mrT-core', '2026/27');
fs.writeFileSync(out, JSON.stringify(snap, null, 2));
console.log('OK', out);
console.log('NW:', snap.net_worth, 'FQ:', snap.fq_score, 'Risk:', snap.risk_score, 'IHT:', snap.iht_exposure);
