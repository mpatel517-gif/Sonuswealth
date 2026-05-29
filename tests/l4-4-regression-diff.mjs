// ─────────────────────────────────────────────────────────────────────────────
// L4-4 — regression-diff decision logic test
//
// Locks down the diff math so the nightly cron can't silently regress to
// "always green" — the failure mode where every cell passes because the
// tolerance is too loose or the cell key collides.
//
// Cases:
//   1. Identical baseline + fresh → all matched, no drift
//   2. NW shift within tolerance → matched
//   3. NW shift beyond tolerance → drifted with reason mentioning %
//   4. FQ shift beyond absolute tolerance → drifted
//   5. Risk shift beyond absolute tolerance → drifted
//   6. Snapshot hash drift (hero numbers unchanged) → drifted
//   7. requireHashMatch:false → hash drift alone doesn't drift
//   8. Baseline cell missing from fresh → missingInFresh
//   9. New cell in fresh → newInFresh (informational, not drift)
//  10. hashSnapshot is deterministic + key-order stable
//  11. formatAlert truncates at 8 lines + footer
//
// Run: node tests/l4-4-regression-diff.mjs
// ─────────────────────────────────────────────────────────────────────────────

import {
  diffCells,
  hashSnapshot,
  formatAlert,
  DEFAULT_TOLERANCE,
} from './harness/regression-diff.mjs'

let fails = 0
function check(label, cond, detail) {
  if (cond) console.log(`✓ ${label}`)
  else { console.log(`✗ ${label} — ${detail || ''}`); fails++ }
}

const ROW = (id, year, fq, risk, nw, hash) => ({
  personaId: id, taxYear: year, fq, risk, netWorth: nw, snapshotHash: hash,
})

// ── Case 1 — identical baseline + fresh ────────────────────────────────────
{
  const base = [ROW('a','2026/27',60,40,500000,'aaaa1111'), ROW('b','2026/27',70,50,1000000,'bbbb2222')]
  const fresh = [...base]
  const r = diffCells(base, fresh)
  check(
    'Case 1 — identical sets match completely',
    r.summary.drifted === 0 && r.summary.matched === 2 && r.summary.anyDrift === false,
    JSON.stringify(r.summary)
  )
}

// ── Case 2 — NW shift within tolerance ─────────────────────────────────────
{
  const base = [ROW('a','2026/27',60,40,500000,'aaaa1111')]
  const fresh = [ROW('a','2026/27',60,40,501000,'aaaa1111')]  // +£1k = 0.2%
  const r = diffCells(base, fresh, { ...DEFAULT_TOLERANCE, requireHashMatch: false })
  check(
    'Case 2 — NW +0.2% within 0.5% tolerance → matched',
    r.summary.drifted === 0 && r.summary.matched === 1,
    JSON.stringify(r.summary)
  )
}

// ── Case 3 — NW shift beyond tolerance ─────────────────────────────────────
{
  const base = [ROW('a','2026/27',60,40,500000,'aaaa1111')]
  const fresh = [ROW('a','2026/27',60,40,510000,'aaaa1111')]  // +£10k = 2%
  const r = diffCells(base, fresh, { ...DEFAULT_TOLERANCE, requireHashMatch: false })
  check(
    'Case 3 — NW +2% beyond 0.5% tolerance → drifted',
    r.summary.drifted === 1 && r.drifted[0].reasons.some(s => /netWorth/.test(s)),
    JSON.stringify(r.drifted[0])
  )
}

// ── Case 4 — FQ shift beyond absolute tolerance ────────────────────────────
{
  const base = [ROW('a','2026/27',60,40,500000,'aaaa1111')]
  const fresh = [ROW('a','2026/27',63,40,500000,'aaaa1111')]  // +3 FQ
  const r = diffCells(base, fresh, { ...DEFAULT_TOLERANCE, requireHashMatch: false })
  check(
    'Case 4 — FQ +3 beyond 1-point tolerance → drifted',
    r.summary.drifted === 1 && r.drifted[0].reasons.some(s => /fq/.test(s)),
    JSON.stringify(r.drifted[0])
  )
}

// ── Case 5 — Risk shift ────────────────────────────────────────────────────
{
  const base = [ROW('a','2026/27',60,40,500000,'aaaa1111')]
  const fresh = [ROW('a','2026/27',60,45,500000,'aaaa1111')]  // +5 risk
  const r = diffCells(base, fresh, { ...DEFAULT_TOLERANCE, requireHashMatch: false })
  check(
    'Case 5 — risk +5 beyond 1-point tolerance → drifted',
    r.summary.drifted === 1 && r.drifted[0].reasons.some(s => /risk/.test(s)),
    JSON.stringify(r.drifted[0])
  )
}

// ── Case 6 — hash drift surfaces sub-field changes ─────────────────────────
{
  // Hero numbers identical but hash changed — e.g. an allowance-tracker
  // sub-field moved. requireHashMatch (default true) should surface this.
  const base = [ROW('a','2026/27',60,40,500000,'aaaa1111')]
  const fresh = [ROW('a','2026/27',60,40,500000,'bbbb2222')]
  const r = diffCells(base, fresh)
  check(
    'Case 6 — hash drift with unchanged hero numbers → drifted (hash reason)',
    r.summary.drifted === 1 && r.drifted[0].reasons.some(s => /hash/.test(s)),
    JSON.stringify(r.drifted[0])
  )
}

// ── Case 7 — requireHashMatch:false → hash drift is silent ─────────────────
{
  const base = [ROW('a','2026/27',60,40,500000,'aaaa1111')]
  const fresh = [ROW('a','2026/27',60,40,500000,'bbbb2222')]
  const r = diffCells(base, fresh, { ...DEFAULT_TOLERANCE, requireHashMatch: false })
  check(
    'Case 7 — requireHashMatch:false silences hash drift',
    r.summary.drifted === 0 && r.summary.matched === 1,
    JSON.stringify(r.summary)
  )
}

// ── Case 8 — baseline cell missing from fresh ──────────────────────────────
{
  const base = [ROW('a','2026/27',60,40,500000,'aaaa1111'), ROW('b','2026/27',70,50,1000000,'bbbb2222')]
  const fresh = [ROW('a','2026/27',60,40,500000,'aaaa1111')]
  const r = diffCells(base, fresh)
  check(
    'Case 8 — missing cell surfaces in missingInFresh',
    r.summary.missingInFresh === 1 && r.missingInFresh[0] === 'b::2026/27' && r.summary.anyDrift === true,
    JSON.stringify(r.summary) + ' miss=' + JSON.stringify(r.missingInFresh)
  )
}

// ── Case 9 — new cell in fresh ─────────────────────────────────────────────
{
  const base = [ROW('a','2026/27',60,40,500000,'aaaa1111')]
  const fresh = [ROW('a','2026/27',60,40,500000,'aaaa1111'), ROW('c','2026/27',55,45,200000,'cccc3333')]
  const r = diffCells(base, fresh)
  check(
    'Case 9 — new cell tracked separately (not counted as drift)',
    r.summary.newInFresh === 1 && r.newInFresh[0] === 'c::2026/27' && r.summary.drifted === 0,
    JSON.stringify(r.summary)
  )
}

// ── Case 10 — hashSnapshot is deterministic + key-order stable ─────────────
{
  const a = { name: 'x', age: 30, assets: { isa: { value: 1000 } } }
  const b = { age: 30, assets: { isa: { value: 1000 } }, name: 'x' }  // different key order
  const h1 = hashSnapshot(a)
  const h2 = hashSnapshot(b)
  check(
    'Case 10a — hashSnapshot stable across key order',
    h1 === h2 && typeof h1 === 'string' && h1.length === 8,
    `h1=${h1} h2=${h2}`
  )
  const c = { ...a, age: 31 }
  const h3 = hashSnapshot(c)
  check(
    'Case 10b — hashSnapshot changes when sub-field changes',
    h3 !== h1,
    `h1=${h1} h3=${h3}`
  )
  check(
    'Case 10c — hashSnapshot null returns null (safe)',
    hashSnapshot(null) === null,
  )
}

// ── Case 11 — formatAlert truncation + summary line ────────────────────────
{
  const drifted = Array.from({ length: 15 }, (_, i) => ({
    key: `p${i}::2026/27`, personaId: `p${i}`, taxYear: '2026/27',
    baseline: {}, fresh: {},
    reasons: [`fq drift ${(i + 2).toFixed(1)} > 1`],
  }))
  const r = {
    matched: [], drifted, missingInFresh: [], newInFresh: [],
    summary: { baselineCount: 20, freshCount: 20, matched: 5, drifted: 15, missingInFresh: 0, newInFresh: 0, anyDrift: true },
  }
  const alert = formatAlert(r)
  const lines = alert.split('\n')
  check(
    'Case 11 — formatAlert truncates to 10 lines max (2 header + 8 drift)',
    lines.length === 11 && lines[lines.length - 1].includes('plus 7 more'),
    `lines=${lines.length}, last="${lines[lines.length - 1]}"`
  )
}

console.log(`\nL4-4 regression-diff test — fails=${fails}`)
if (fails > 0) process.exit(1)
