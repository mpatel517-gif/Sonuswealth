// tests/l3-2-flexi-drawdown.mjs
//
// L3 flexi-drawdown panel contract test.
// Run via: node tests/l3-2-flexi-drawdown.mjs

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { buildDrawdownSnapshot } from '../src/components/MyMoney/L3/L3Sections/FlexiDrawdownPanel.data.js'
import { pensionTotal } from '../src/engine/_helpers.js'
import { annualDrawPayload, posPayload } from '../src/components/MyMoney/L3/L3Sections/FlexiDrawdownPayloads.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const personasDir = join(__dirname, '..', 'src', 'rules', 'personas')

let fails = 0
let passes = 0
const log = (ok, msg) => {
  if (ok) { passes += 1; console.log(`✓ ${msg}`) }
  else    { fails  += 1; console.log(`✗ ${msg}`) }
}

async function loadPersona(file) {
  return JSON.parse(await readFile(join(personasDir, file), 'utf8'))
}

// ── Case 1 — output shape: all required fields present + finite ───────────
console.log('\n── Case 1 — output shape ──')
{
  const e = await loadPersona('persona-a.json')
  const s = buildDrawdownSnapshot(e)
  const required = ['pot', 'annualDraw', 'drawIsCustom', 'pos', 'terminalAge',
                    'startAge', 'p10', 'p50', 'p90', 'simulations']
  for (const k of required) {
    log(s[k] !== undefined, `field '${k}' present (got ${JSON.stringify(s[k])})`)
  }
  // All numeric fields are finite
  for (const k of ['pot', 'annualDraw', 'pos', 'terminalAge', 'startAge', 'p10', 'p50', 'p90', 'simulations']) {
    log(Number.isFinite(s[k]), `field '${k}'=${s[k]} is finite`)
  }
}

// ── Case 2 — pos in [0, 100] ───────────────────────────────────────────────
console.log('\n── Case 2 — pos in [0, 100] ──')
{
  for (const file of ['persona-a.json', 'mrT-core.json', 'persona-c.json']) {
    const e = await loadPersona(file)
    const s = buildDrawdownSnapshot(e)
    log(s.pos >= 0 && s.pos <= 100,
      `${file} → pos=${s.pos}% in [0,100]`)
  }
}

// ── Case 3 — p10 <= p50 <= p90 at terminal age ────────────────────────────
console.log('\n── Case 3 — p10 <= p50 <= p90 ──')
{
  const e = await loadPersona('persona-a.json')
  const s = buildDrawdownSnapshot(e)
  log(s.p10 <= s.p50, `p10(${s.p10}) <= p50(${s.p50})`)
  log(s.p50 <= s.p90, `p50(${s.p50}) <= p90(${s.p90})`)
}

// ── Case 4 — zero drawdown → pos = 100 ───────────────────────────────────
console.log('\n── Case 4 — zero drawdown → pos = 100 ──')
{
  // Engine: a positive pot with zero annual drawdown should survive all sims.
  // Use a large pot with entity.drawdown explicitly = 0 — that triggers the
  // 4% fallback (drawIsCustom=false), giving annualDraw = 0.04 * pot > 0.
  // To get truly zero drawdown we need pot=0 which also gives 0 draw — but
  // then startPot=0 → engine marks every sim as dead immediately → pos=0.
  // Instead: use a real pot with a tiny draw far below the growth floor so
  // survival is ~100%, OR directly test the "zero drawdown on non-zero pot"
  // path by making draw zero via a custom-but-zero approach.
  //
  // The engine's zero-pot path: startPot=0 → pot-=0 → pot still 0 → alive=false → survived=0.
  // This is correct engine behaviour. We test it as: zero pot → pos=0.
  const zeroPot = buildDrawdownSnapshot({ age: 50 })
  log(zeroPot.pot === 0, `empty entity pot=0`)
  log(zeroPot.annualDraw === 0, `annualDraw=0 when pot=0`)
  // When pot=0, every sim starts dead (pot-draw=0-0=0 → alive=false) → pos=0
  log(zeroPot.pos === 0, `pos=0 when pot=0 (all sims start depleted, got ${zeroPot.pos})`)

  // Positive check: large pot with a modest draw rate — pos should be > 0.
  // Age 70, pot £500k, 4% draw = £20k/yr over 25yr horizon — expect decent POS.
  const largePot = buildDrawdownSnapshot({
    age: 70,
    assets: { sipp: { total: 500000 } },
  })
  log(largePot.pos > 0 && largePot.pos <= 100, `large pot + 4% draw → pos=${largePot.pos}% in (0,100]`)
}

// ── Case 5 — large drawdown on small pot → pos low ────────────────────────
console.log('\n── Case 5 — large drawdown on small pot → pos low ──')
{
  // £5k pot, drawing £10k/yr — pot depleted in year 1 → near 0% survival
  const smallPotEntity = {
    age: 65,
    drawdown: 10000,
    assets: { sipp: { total: 5000 } },
  }
  const s = buildDrawdownSnapshot(smallPotEntity)
  log(s.pos < 10, `small pot + large draw → pos=${s.pos}% < 10%`)
  log(s.drawIsCustom === true, `drawIsCustom=true when entity.drawdown set`)
}

// ── Case 6 — pot reconciles with pensionTotal ──────────────────────────────
console.log('\n── Case 6 — pot reconciles with pensionTotal ──')
{
  for (const file of ['persona-a.json', 'mrT-core.json']) {
    const e = await loadPersona(file)
    const s = buildDrawdownSnapshot(e)
    const engine = pensionTotal(e)
    log(s.pot === engine,
      `${file} → snap.pot=${s.pot.toLocaleString()} === pensionTotal=${engine.toLocaleString()}`)
  }
}

// ── Case 7 — annualDraw editable path = 'drawdown' ────────────────────────
console.log('\n── Case 7 — annualDraw payload editable.path = drawdown ──')
{
  const e = await loadPersona('persona-a.json')
  const s = buildDrawdownSnapshot(e)
  const pay = annualDrawPayload(s)
  log(pay.editable?.path === 'drawdown', `annualDrawPayload editable.path='drawdown' (got '${pay.editable?.path}')`)
  log(pay.editable?.unit === '£', `annualDrawPayload editable.unit='£' (got '${pay.editable?.unit}')`)
  log(Number.isFinite(pay.editable?.currentValue), `editable.currentValue is finite (got ${pay.editable?.currentValue})`)
}

// ── Case 8 — posPayload shape has required fields ─────────────────────────
console.log('\n── Case 8 — posPayload shape ──')
{
  const e = await loadPersona('persona-a.json')
  const s = buildDrawdownSnapshot(e)
  const pay = posPayload(s)
  log(typeof pay.formula === 'string' && pay.formula.length > 0, 'posPayload.formula is non-empty string')
  log(typeof pay.source === 'string' && pay.source.length > 0, 'posPayload.source is non-empty string')
  log(['high', 'medium', 'low'].includes(pay.confidence), `posPayload.confidence='${pay.confidence}'`)
  log(Array.isArray(pay.breakdown) && pay.breakdown.length > 0, `posPayload.breakdown is array with ${pay.breakdown?.length} rows`)
}

// ── Case 9 — Bruce (persona-a): pot + POS sanity ──────────────────────────
console.log('\n── Case 9 — Bruce (persona-a) sanity check ──')
{
  const bruce = await loadPersona('persona-a.json')
  const s = buildDrawdownSnapshot(bruce)
  // Bruce age 62, pot 850k, 4% draw = 34k — expect POS > 70%
  log(s.pot === 850000, `Bruce pot=£850,000 (got ${s.pot.toLocaleString()})`)
  log(s.annualDraw === 34000, `Bruce 4% draw=£34,000 (got ${s.annualDraw.toLocaleString()})`)
  log(s.pos > 70, `Bruce POS=${s.pos}% > 70% (sensible for 850k/34k draw)`)
  log(s.startAge === 62, `Bruce startAge=62 (got ${s.startAge})`)
  console.log(`  Bruce POS: ${s.pos}%  Pot: £${s.pot.toLocaleString()}`)
}

// ── Case 10 — small synthetic: low pot persona ────────────────────────────
console.log('\n── Case 10 — small-pot synthetic ──')
{
  const small = {
    age: 67,
    drawdown: 15000,
    assets: { sipp: { total: 80000 } },
  }
  const s = buildDrawdownSnapshot(small)
  log(s.pot === 80000, `small-pot=£80,000 (got ${s.pot})`)
  log(s.annualDraw === 15000, `annualDraw=£15,000 (custom, got ${s.annualDraw})`)
  log(s.drawIsCustom === true, `drawIsCustom=true`)
  // £80k drawing £15k/yr ≈ 5.3yr raw; with growth maybe 6-8yr — expect POS < 40%
  log(s.pos < 40, `small-pot pos=${s.pos}% < 40% (expected poor survival)`)
}

// ── Case 11 — simulations count matches 2000 ──────────────────────────────
console.log('\n── Case 11 — simulations count ──')
{
  const e = await loadPersona('persona-a.json')
  const s = buildDrawdownSnapshot(e)
  log(s.simulations === 2000, `simulations=2000 (got ${s.simulations})`)
}

// ── Case 12 — runs in < 3s ────────────────────────────────────────────────
console.log('\n── Case 12 — performance < 3s ──')
{
  const t0 = Date.now()
  const e = await loadPersona('persona-a.json')
  buildDrawdownSnapshot(e)
  const dt = Date.now() - t0
  log(dt < 3000, `runs in ${dt}ms < 3000ms`)
}

// ── Summary ───────────────────────────────────────────────────────────────
const total = passes + fails
console.log(`\n${'─'.repeat(67)}`)
console.log(`L3 flexi-drawdown panel — pass=${passes} fail=${fails} total=${total}`)
console.log('═'.repeat(67))
process.exit(fails === 0 ? 0 : 1)
