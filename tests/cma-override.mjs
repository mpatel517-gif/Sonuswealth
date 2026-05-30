// tests/cma-override.mjs
//
// Active-CMA layer contract test (src/engine/cma.js).
// THE point of this test is the baseline-preservation property: opening the
// editor / reading active CMA with no edits must return the published baseline
// EXACTLY (growth 0.058, inflation 0.027) — and a per-class edit must move the
// scalar growth by the weighted delta, never recompute it from scratch.
// Run via: node tests/cma-override.mjs

import {
  getActiveCMA, getBaselineCMA, getCMAOverride, isCMAModified,
  setCMAOverride, patchCMA, resetCMA, resetCMAField, onCMAChange,
} from '../src/engine/cma.js'

let fails = 0, passes = 0
const log = (ok, msg) => { ok ? (passes++, console.log(`✓ ${msg}`)) : (fails++, console.log(`✗ ${msg}`)) }
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps

const BASE = getBaselineCMA()

// ── Case 1 — baseline preserved with no override ─────────────────────────────
console.log('\n── Case 1 — baseline preserved (no edits) ──')
{
  resetCMA()
  const c = getActiveCMA()
  log(near(c.growth, 0.058), `growth === 0.058 baseline (got ${c.growth})`)
  log(near(c.inflation, 0.027), `inflation === 0.027 baseline (got ${c.inflation})`)
  log(getCMAOverride() === null, `override null at baseline`)
  log(isCMAModified() === false, `isCMAModified false at baseline`)
  log(getActiveCMA() === BASE, `active === BASELINE reference when unmodified`)
}

// ── Case 2 — inflation override is a direct scalar ───────────────────────────
console.log('\n── Case 2 — inflation override ──')
{
  setCMAOverride({ inflation: 0.04 })
  const c = getActiveCMA()
  log(near(c.inflation, 0.04), `inflation now 0.04 (got ${c.inflation})`)
  log(near(c.growth, 0.058), `growth UNCHANGED by inflation edit (got ${c.growth})`)
  log(isCMAModified() === true, `isCMAModified true`)
  log(getActiveCMA() !== BASE, `active is a copy, BASELINE not mutated`)
  log(near(BASE.inflation, 0.027), `BASELINE.inflation still 0.027 (not mutated)`)
  resetCMA()
}

// ── Case 3 — per-class return edit moves growth by WEIGHTED delta ─────────────
console.log('\n── Case 3 — per-class edit → weighted-delta growth ──')
{
  // global_equity baseline 0.076, balanced weight 0.30. +1% return → +0.30*0.01
  // = +0.003 on growth → 0.061.
  setCMAOverride({ assetClasses: { global_equity: { expectedReturn: 0.086 } } })
  const c = getActiveCMA()
  log(near(c.assetClasses.global_equity.expectedReturn, 0.086), `global_equity return set 0.086`)
  log(near(c.growth, 0.061, 1e-6), `growth = 0.058 + 0.30×0.01 = 0.061 (got ${c.growth})`)
  log(near(c.inflation, 0.027), `inflation untouched (got ${c.inflation})`)
  resetCMA()
}

// ── Case 4 — zero-weight class (em_equity) does NOT move growth ───────────────
console.log('\n── Case 4 — zero-weight class edit leaves growth at baseline ──')
{
  // em_equity has weight 0 in the 'balanced' profile → editing it must not move
  // the blended growth scalar.
  setCMAOverride({ assetClasses: { em_equity: { expectedReturn: 0.15 } } })
  const c = getActiveCMA()
  log(near(c.growth, 0.058, 1e-6), `growth still 0.058 (em_equity weight 0) (got ${c.growth})`)
  resetCMA()
}

// ── Case 5 — patchCMA merges, doesn't clobber ────────────────────────────────
console.log('\n── Case 5 — patchCMA merges ──')
{
  patchCMA({ inflation: 0.03 })
  patchCMA({ assetClasses: { uk_equity: { expectedReturn: 0.08 } } })
  const ov = getCMAOverride()
  log(near(ov.inflation, 0.03), `inflation kept after second patch (got ${ov.inflation})`)
  log(near(ov.assetClasses.uk_equity.expectedReturn, 0.08), `uk_equity added without dropping inflation`)
  resetCMA()
}

// ── Case 6 — resetCMAField removes one field, keeps the rest ─────────────────
console.log('\n── Case 6 — resetCMAField ──')
{
  setCMAOverride({ assetClasses: { uk_equity: { expectedReturn: 0.09, volatility: 0.20 } } })
  resetCMAField('uk_equity', 'volatility')
  const ov = getCMAOverride()
  log(near(ov.assetClasses.uk_equity.expectedReturn, 0.09), `return kept after vol reset`)
  log(ov.assetClasses.uk_equity.volatility === undefined, `volatility removed`)
  resetCMA()
}

// ── Case 7 — reset returns to exact baseline reference ───────────────────────
console.log('\n── Case 7 — reset → baseline ──')
{
  setCMAOverride({ inflation: 0.05, assetClasses: { uk_equity: { expectedReturn: 0.1 } } })
  resetCMA()
  log(getActiveCMA() === BASE, `active === BASELINE after reset`)
  log(getCMAOverride() === null, `override cleared`)
  log(near(getActiveCMA().growth, 0.058), `growth back to 0.058`)
}

// ── Case 8 — subscribers fire on change ──────────────────────────────────────
console.log('\n── Case 8 — onCMAChange fires ──')
{
  let hits = 0
  const off = onCMAChange(() => { hits++ })
  setCMAOverride({ inflation: 0.035 })
  patchCMA({ inflation: 0.036 })
  resetCMA()
  off()
  setCMAOverride({ inflation: 0.04 }) // after unsubscribe — must NOT increment
  resetCMA()
  log(hits === 3, `subscriber fired 3× while subscribed, not after (got ${hits})`)
}

// ── Case 9 — higher volatility → deeper worst-decile loss ────────────────────
console.log('\n── Case 9 — volatility edit moves worstDecile ──')
{
  const baseWD = BASE.worstDecile.annual_equiv
  setCMAOverride({ assetClasses: { global_equity: { volatility: 0.30 } } }) // up from 0.155
  const c = getActiveCMA()
  log(c.worstDecile.annual_equiv < baseWD, `worst-decile deeper than baseline (${c.worstDecile.annual_equiv} < ${baseWD})`)
  resetCMA()
  log(near(getActiveCMA().worstDecile.annual_equiv, baseWD), `worstDecile restored on reset`)
}

const total = passes + fails
console.log(`\n${'─'.repeat(67)}`)
console.log(`Active-CMA layer — pass=${passes} fail=${fails} total=${total}`)
console.log('═'.repeat(67))
process.exit(fails === 0 ? 0 : 1)
