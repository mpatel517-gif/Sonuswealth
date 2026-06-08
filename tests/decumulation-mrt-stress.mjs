// tests/decumulation-mrt-stress.mjs
// Engine P1 — stress case. mrT-decum-complex is the spec's nominated fixture for
// exercising every classification branch (DB floor, state pension, GIA embedded
// gain, BPR-AIM relief-lock, multi-account cash). It also uses the typed-array
// asset schema (assets.pensions[]/investments[]/bank[] with balance/cost_base),
// which the normaliser must read — this fixture caught that it previously didn't.
import assert from 'node:assert'
import { normaliseHoldings } from '../src/engine/decumulation-holdings.js'
import { evaluateHoldings, classify, DRAW_CLASS as D } from '../src/engine/decumulation-classify.js'
import dc from '../src/rules/personas/mrT-decum-complex.json' with { type: 'json' }
import bruce from '../src/rules/personas/persona-a.json' with { type: 'json' }
import core from '../src/rules/personas/mrT-core.json' with { type: 'json' }

let pass = 0, fail = 0
function t(name, fn) { try { fn(); pass++; console.log('✓', name) } catch (e) { fail++; console.log('✗', name, '\n   ', e.message) } }

const H = normaliseHoldings(dc)
const byId = id => H.filter(h => h.taxonomyId === id)
const ev = evaluateHoldings(H)

// ── typed-array schema is read at all ───────────────────────────────────────
t('typed-array pensions[] read: SIPP £2.4M is a pot', () => {
  const sipp = byId('SIPP')[0]
  assert.ok(sipp && sipp.isPot && sipp.currentValue === 2400000, `got ${sipp?.currentValue}`)
  assert.equal(sipp.amc, 0.003, 'charges_percent → amc')
})
t('typed-array investments[] read: ISA + GIA + BPR-AIM present', () => {
  assert.ok(byId('ISA_SS')[0]?.currentValue === 385000, 'ISA £385k')
  assert.ok(byId('GIA')[0]?.currentValue === 210000, 'GIA £210k')
  assert.ok(byId('BPR_AIM')[0]?.currentValue === 185000, 'BPR-AIM £185k')
})
t('typed-array bank[] read: current + savings + premium bonds', () => {
  assert.ok(byId('CURRENT')[0], 'current account')
  assert.ok(byId('SAVINGS')[0], 'savings')
  assert.ok(byId('PREMIUM_BONDS')[0], 'premium bonds')
})

// ── secure-income floor (the root-bug guard) ────────────────────────────────
t('floor = state £11,502 + DB £28,000 = £39,502 (never a pot)', () => {
  assert.equal(ev.grossFloorIncome, 39502, `got ${ev.grossFloorIncome}`)
  const types = ev.secureIncome.map(s => s.streamType).sort()
  assert.ok(types.includes('state') && types.includes('DB'), `streams ${types}`)
  // none of the floor sources are in the sequenceable draw set
  assert.ok(!ev.sequenceable.some(h => h.taxonomyId === 'DB' || h.taxonomyId === 'STATE'), 'floor not sequenced')
})

// ── per-holding signal preserved ────────────────────────────────────────────
t('GIA embedded gain derived from cost_base/unrealised_gain (~29.5%)', () => {
  const gia = byId('GIA')[0]
  assert.ok(Math.abs(gia.embeddedGainPct - 62000 / 210000) < 0.01, `got ${gia.embeddedGainPct}`)
})
t('BPR-AIM is relief-locked (IHT shelter), excluded from the draw set', () => {
  const bpr = byId('BPR_AIM')[0]
  assert.equal(classify(bpr), D.RELIEF_LOCKED, 'classified relief-locked even with no clock')
  assert.ok(!ev.sequenceable.some(h => h.taxonomyId === 'BPR_AIM'), 'not sequenceable')
  assert.ok(ev.excluded.some(x => x.holding.taxonomyId === 'BPR_AIM'), 'shown as excluded')
})
t('residence excluded; SIPP/ISA/GIA sequenceable', () => {
  assert.ok(ev.excluded.some(x => x.holding.taxonomyId === 'RESIDENCE'), 'residence excluded')
  const seq = ev.sequenceable.map(h => h.taxonomyId)
  assert.ok(seq.includes('SIPP') && seq.includes('ISA_SS') && seq.includes('GIA'), `seq ${seq}`)
})
t('current account → emergency buffer, not the draw set', () => {
  assert.ok(ev.reserve.emergency.some(h => h.taxonomyId === 'CURRENT'), 'current = buffer')
  assert.ok(!ev.sequenceable.some(h => h.taxonomyId === 'CURRENT'), 'not sequenceable')
})

// ── regression: object-shape fixtures unchanged by the array readers ─────────
t('Bruce (object shape) unchanged: SIPP £420k, floor £31,173', () => {
  const bh = normaliseHoldings(bruce)
  assert.equal(bh.find(h => h.taxonomyId === 'SIPP' && h.isPot)?.currentValue, 420000)
  assert.equal(evaluateHoldings(bh).grossFloorIncome, 31173)
})
t('mrT-core (BOTH shapes) uses objects — no double-count', () => {
  const ch = normaliseHoldings(core)
  // 4 DC pensions from sipp.pensions, not the duplicate a.pensions/a.investments arrays
  assert.equal(ch.filter(h => h.category === 'pensions' && h.isPot).length, 4, 'exactly 4 DC pots')
  assert.ok(ch.filter(h => h.taxonomyId === 'ISA_SS').length === 1, 'one ISA, not duplicated')
})

// ── GAR + protected-TFC branches (normaliser reads the fields → evaluate routes)
// Inline typed-array entity rather than mutating the shared decum-complex fixture
// (baselined by 6 l3-2 tests) — same coverage, zero blast radius.
const safeguardedEntity = {
  assets: {
    pensions: [
      { id: 'pp-gar', type: 'personal-pension', balance: 180000, gar: true, garRate: 0.105, charges_percent: 0.009 },
      { id: 's32', type: 'section-32-buyout', balance: 95000, protected_tfc_pct: 0.40, isSafeguarded: true, cash_equivalent_transfer_value: 95000 },
      { id: 'sipp', type: 'SIPP', balance: 300000 },
    ],
  },
  individual: { state_pension_annual_gross: 11502 },
}
const SE = normaliseHoldings(safeguardedEntity)
const seEv = evaluateHoldings(SE)

t('normaliser carries GAR + protected-TFC fields from typed-array pensions', () => {
  const gar = SE.find(h => h.id === 'pp-gar')
  const s32 = SE.find(h => h.id === 's32')
  assert.ok(gar?.gar === true && gar.garRate === 0.105, 'GAR fields carried')
  assert.ok(s32?.protectedTfcPct === 0.40 && s32.cetv === 95000, 'protected-TFC + CETV carried')
})
t('GAR pension → ANNUITISE-DONT-DRAW, never in the draw set', () => {
  const gar = SE.find(h => h.id === 'pp-gar')
  assert.equal(classify(gar), D.ANNUITISE)
  assert.ok(!seEv.sequenceable.some(h => h.id === 'pp-gar'), 'GAR not sequenced')
})
t('protected-TFC >25% safeguarded → SPECIALIST, flagged not drawn', () => {
  const s32 = SE.find(h => h.id === 's32')
  assert.equal(classify(s32), D.SPECIALIST)
  assert.ok(seEv.specialist.some(h => h.id === 's32'), 'routed to specialist advice')
  assert.ok(!seEv.sequenceable.some(h => h.id === 's32'), 'not sequenced')
})
t('the plain SIPP alongside them stays drawable', () => {
  assert.ok(seEv.sequenceable.some(h => h.id === 'sipp'), 'SIPP sequenceable')
})

console.log(`\ndecumulation-mrt-stress — pass=${pass} fail=${fail}`)
if (fail) process.exit(1)
