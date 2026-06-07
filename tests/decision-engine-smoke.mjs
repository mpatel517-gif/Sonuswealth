// Smoke test: every decision (DE-01..DE-40) × every path must return FINITE
// deltas and must not throw. Catches the NaN / wrong-key / runtime-crash class
// across the calc-audit corrections at once (build-green does NOT catch these).
// Does NOT validate magnitudes — that is the professional calc-audit's job.
import { simulateAction, enumeratePaths, generateRecommendation } from '../src/engine/decision-engine.js'

// Synthetic director-ish entity that exercises income-tax, rental, director-loan,
// pension, CGT and IHT paths. Sparse fields fall back to each case's defaults.
const entity = {
  age: 45,
  income: { salary: 100000, gross_salary: 100000, rental: 18000, dividends: 20000, interest: 1200 },
  employment: { gross_salary: 100000 },
  assets: {
    sipp: { total: 400000 }, isa: { total: 80000 }, gia: { total: 120000, unrealisedGain: 30000 },
    cash: { total: 60000 }, property: { residence: { value: 700000 }, total: 700000 },
  },
  liabilities: { mortgage: { interest: 6000, balance: 250000 }, directorLoan: { balance: 50000 } },
}

const CODES = Array.from({ length: 40 }, (_, i) => `DE-${String(i + 1).padStart(2, '0')}`)
const isNum = (v) => v === undefined || v === null || Number.isFinite(v) // null/undefined allowed (absent metric); NaN/Infinity not
const fails = []

for (const code of CODES) {
  let paths
  try { paths = enumeratePaths(entity, code) || [] }
  catch (e) { fails.push(`${code} enumeratePaths THREW: ${e.message}`); continue }
  if (!paths.length) { fails.push(`${code} enumeratePaths returned 0 paths`); continue }
  for (const p of paths) {
    try {
      const sim = simulateAction(entity, code, { pathId: p.id, riskLevel: p.riskLevel })
      const d = sim?.delta || {}
      for (const k of ['nw', 'iht', 'fq', 'income']) {
        if (!isNum(d[k])) fails.push(`${code}/${p.id} delta.${k} = ${d[k]} (not finite)`)
      }
    } catch (e) { fails.push(`${code}/${p.id} simulateAction THREW: ${e.message}`) }
    try {
      const rec = generateRecommendation(entity, code, p)
      if (rec && rec.impact) {
        for (const k of ['nwGain', 'fqGain', 'ihtSave']) {
          if (!isNum(rec.impact[k])) fails.push(`${code}/${p.id} rec.impact.${k} = ${rec.impact[k]} (not finite)`)
        }
      }
      // methodology must render (rulesForDecision must not throw / NaN the values)
      const ruleVals = (rec?.methodology?.rules || []).map(r => r.value).join(' ')
      if (/NaN|undefined/.test(ruleVals)) fails.push(`${code}/${p.id} methodology rule value NaN/undefined: ${ruleVals}`)
    } catch (e) { fails.push(`${code}/${p.id} generateRecommendation THREW: ${e.message}`) }
  }
}

if (fails.length) {
  console.error(`DECISION-ENGINE SMOKE FAILED — ${fails.length} issue(s):`)
  fails.forEach(f => console.error('  ✗ ' + f))
  process.exit(1)
}
console.log(`✓ decision-engine smoke passed: ${CODES.length} decisions, all paths finite, no throws, no NaN methodology values.`)
