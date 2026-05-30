// tests/l3-2-flexi-drawdown.mjs
//
// L3 flexi-drawdown panel contract test — full CMA engine
// (probabilityOfSuccess) + today's-money / future-pounds toggle.
// Run via: node tests/l3-2-flexi-drawdown.mjs

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { buildDrawdownSnapshot } from '../src/components/MyMoney/L3/L3Sections/FlexiDrawdownPanel.data.js'
import { investable } from '../src/engine/fq-calculator.js'
import {
  annualDrawPayload, posPayload, typicalPotPayload,
} from '../src/components/MyMoney/L3/L3Sections/FlexiDrawdownPayloads.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const personasDir = join(__dirname, '..', 'src', 'rules', 'personas')

let fails = 0
let passes = 0
const log = (ok, msg) => {
  if (ok) { passes += 1; console.log(`✓ ${msg}`) }
  else    { fails  += 1; console.log(`✗ ${msg}`) }
}
const loadPersona = async (f) => JSON.parse(await readFile(join(personasDir, f), 'utf8'))

// ── Case 1 — output shape ──────────────────────────────────────────────────
console.log('\n── Case 1 — output shape ──')
{
  const e = await loadPersona('persona-a.json')
  const s = buildDrawdownSnapshot(e)
  const required = ['pot', 'annualDraw', 'drawSource', 'pos', 'horizonYears',
    'terminalAge', 'startAge', 'inflation', 'runs', 'statePensionFrom',
    'nominal', 'real', 'insufficient']
  for (const k of required) log(s[k] !== undefined, `field '${k}' present`)
  for (const k of ['pot', 'annualDraw', 'pos', 'terminalAge', 'startAge', 'inflation', 'runs']) {
    log(Number.isFinite(s[k]), `'${k}'=${s[k]} finite`)
  }
  for (const band of ['nominal', 'real']) {
    for (const p of ['p10', 'p50', 'p90']) {
      log(Number.isFinite(s[band][p]), `${band}.${p}=${s[band][p]} finite`)
    }
  }
}

// ── Case 2 — pos in [0,100] ────────────────────────────────────────────────
console.log('\n── Case 2 — pos in [0,100] ──')
{
  for (const file of ['persona-a.json', 'persona-c.json', 'persona-e.json']) {
    const e = await loadPersona(file)
    const s = buildDrawdownSnapshot(e)
    log(s.pos >= 0 && s.pos <= 100, `${file} → pos=${s.pos}%`)
  }
}

// ── Case 3 — bands ordered p10 ≤ p50 ≤ p90 (both views) ────────────────────
console.log('\n── Case 3 — bands ordered ──')
{
  const e = await loadPersona('persona-c.json')
  const s = buildDrawdownSnapshot(e)
  log(s.nominal.p10 <= s.nominal.p50 && s.nominal.p50 <= s.nominal.p90,
    `nominal ${s.nominal.p10} ≤ ${s.nominal.p50} ≤ ${s.nominal.p90}`)
  log(s.real.p10 <= s.real.p50 && s.real.p50 <= s.real.p90,
    `real ${s.real.p10} ≤ ${s.real.p50} ≤ ${s.real.p90}`)
}

// ── Case 4 — today's money ≤ future pounds (inflation deflation) ───────────
console.log('\n── Case 4 — real ≤ nominal (when horizon > 0) ──')
{
  const e = await loadPersona('persona-c.json')
  const s = buildDrawdownSnapshot(e)
  if (s.horizonYears > 0 && s.nominal.p50 > 0) {
    log(s.real.p50 <= s.nominal.p50, `real p50 (${s.real.p50}) ≤ nominal p50 (${s.nominal.p50})`)
    log(s.real.p90 <= s.nominal.p90, `real p90 (${s.real.p90}) ≤ nominal p90 (${s.nominal.p90})`)
  } else {
    log(true, `horizon ${s.horizonYears} — deflation not applicable (skipped)`)
  }
}

// ── Case 5 — insufficient/empty entity → pos 0, insufficient true ─────────
console.log('\n── Case 5 — empty entity → insufficient ──')
{
  const s = buildDrawdownSnapshot({ age: 50 })
  log(s.pot === 0, `empty pot=0`)
  log(s.pos === 0, `pos=0 (got ${s.pos})`)
  log(s.insufficient === true, `insufficient=true`)
}

// ── Case 6 — large draw on small pot → low chance ─────────────────────────
console.log('\n── Case 6 — small pot + large draw → low pos ──')
{
  const s = buildDrawdownSnapshot({ age: 67, drawdown: 30000, assets: { sipp: { total: 60000 } } })
  log(s.pos < 35, `small pot + big draw → pos=${s.pos}% < 35%`)
  log(s.drawSource === 'custom', `drawSource='custom' when entity.drawdown set (got '${s.drawSource}')`)
}

// ── Case 7 — pot reconciles with investable() ──────────────────────────────
console.log('\n── Case 7 — pot === investable() ──')
{
  for (const file of ['persona-a.json', 'persona-c.json']) {
    const e = await loadPersona(file)
    const s = buildDrawdownSnapshot(e)
    log(s.pot === investable(e), `${file} → pot=${s.pot.toLocaleString()} === investable`)
  }
}

// ── Case 8 — annualDraw editable path = 'drawdown' ────────────────────────
console.log('\n── Case 8 — editable.path = drawdown ──')
{
  const e = await loadPersona('persona-a.json')
  const s = buildDrawdownSnapshot(e)
  const pay = annualDrawPayload(s)
  log(pay.editable?.path === 'drawdown', `editable.path='drawdown' (got '${pay.editable?.path}')`)
  log(pay.editable?.unit === '£', `editable.unit='£'`)
  log(Number.isFinite(pay.editable?.currentValue), `editable.currentValue finite`)
}

// ── Case 9 — drawSource defaults to 4% when nothing set ───────────────────
console.log('\n── Case 9 — default draw = 4% of savings ──')
{
  const e = await loadPersona('persona-c.json')
  // strip any drawdown/targetIncome to force default path
  const stripped = { ...e, drawdown: undefined, targetIncome: undefined }
  const s = buildDrawdownSnapshot(stripped)
  log(s.drawSource === 'default', `drawSource='default' (got '${s.drawSource}')`)
  log(Math.abs(s.annualDraw - Math.round(s.pot * 0.04)) <= 1,
    `default draw ≈ 4% of pot (${s.annualDraw} vs ${Math.round(s.pot * 0.04)})`)
}

// ── Case 10 — posPayload shape + plain-English breakdown ──────────────────
console.log('\n── Case 10 — posPayload shape ──')
{
  const e = await loadPersona('persona-a.json')
  const s = buildDrawdownSnapshot(e)
  const pay = posPayload(s)
  log(typeof pay.formula === 'string' && pay.formula.length > 0, 'formula non-empty')
  log(['high', 'medium', 'low'].includes(pay.confidence), `confidence='${pay.confidence}'`)
  log(Array.isArray(pay.breakdown) && pay.breakdown.length > 0, `breakdown ${pay.breakdown?.length} rows`)
  // No raw "POS"/"p10" jargon in the labels
  const hasJargon = pay.breakdown.some(r => /\bPOS\b|\bp10\b|\bp90\b|stdev/i.test(r.label))
  log(!hasJargon, 'no POS/p10/p90/stdev jargon in breakdown labels')
}

// ── Case 11 — toggle payloads differ real vs nominal ──────────────────────
console.log('\n── Case 11 — toggle changes the value ──')
{
  const e = await loadPersona('persona-c.json')
  const s = buildDrawdownSnapshot(e)
  const real = typicalPotPayload(s, 'real')
  const nom  = typicalPotPayload(s, 'nominal')
  log(real.breakdown[3].value === "Today's money", `real view labelled "Today's money"`)
  log(nom.breakdown[3].value === 'Future pounds', `nominal view labelled 'Future pounds'`)
}

// ── Case 12 — runs = 2000 + perf < 3s ─────────────────────────────────────
console.log('\n── Case 12 — runs + perf ──')
{
  const t0 = Date.now()
  const e = await loadPersona('persona-a.json')
  const s = buildDrawdownSnapshot(e)
  const dt = Date.now() - t0
  log(s.runs === 2000, `runs=2000 (got ${s.runs})`)
  log(dt < 3000, `runs in ${dt}ms < 3000`)
  console.log(`  persona-a: pos=${s.pos}% · savings £${s.pot.toLocaleString()} · draw £${s.annualDraw.toLocaleString()}/yr · horizon to ${s.terminalAge}`)
}

// ── Summary ───────────────────────────────────────────────────────────────
const total = passes + fails
console.log(`\n${'─'.repeat(67)}`)
console.log(`L3 flexi-drawdown panel — pass=${passes} fail=${fails} total=${total}`)
console.log('═'.repeat(67))
process.exit(fails === 0 ? 0 : 1)
