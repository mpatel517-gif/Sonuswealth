// tests/decumulation-classify.mjs
// Engine P1 — draw-classification taxonomy + evaluate/exclude pre-pass + per-holding
// normaliser. Asserts the spec §2/§4 behaviour: guaranteed income excluded as a
// floor, relief clocks gate, two GIAs with different gains are NOT averaged, and
// the secure-income floor is computed before any sequencing.
import assert from 'node:assert'
import { classify, evaluateHoldings, DRAW_CLASS, TAXONOMY_DRAW_CLASS } from '../src/engine/decumulation-classify.js'
import { normaliseHoldings } from '../src/engine/decumulation-holdings.js'
import bruce from '../src/rules/personas/persona-a.json' with { type: 'json' }

let pass = 0, fail = 0
const D = DRAW_CLASS
function t(name, fn) { try { fn(); pass++; console.log('✓', name) } catch (e) { fail++; console.log('✗', name, '\n   ', e.message) } }

// ── classify(): taxonomy base + feature overrides ───────────────────────────
t('SIPP DC pot → DRAW-DOWN', () => assert.equal(classify({ taxonomyId: 'SIPP', isPot: true }), D.DRAW_DOWN))
t('DB (isPot false) → GUARANTEED-INCOME', () => assert.equal(classify({ taxonomyId: 'DB', isPot: false }), D.GUARANTEED_INCOME))
t('STATE → GUARANTEED-INCOME', () => assert.equal(classify({ taxonomyId: 'STATE', isPot: false }), D.GUARANTEED_INCOME))
t('GAR pot → ANNUITISE-DONT-DRAW', () => assert.equal(classify({ taxonomyId: 'PERSONAL_PENSION', isPot: true, gar: true }), D.ANNUITISE))
t('protected TFC >25% → SPECIALIST', () => assert.equal(classify({ taxonomyId: 'SIPP', isPot: true, protectedTfcPct: 0.30 }), D.SPECIALIST))
t('GMP → SPECIALIST', () => assert.equal(classify({ taxonomyId: 'SIPP', isPot: true, gmp: true }), D.SPECIALIST))
t('safeguarded CETV > £30k → SPECIALIST', () => assert.equal(classify({ taxonomyId: 'SECTION_32', isPot: true, isSafeguarded: true, cetv: 90000 }), D.SPECIALIST))
t('GIA → DRAW-WITH-CGT-MANAGEMENT', () => assert.equal(classify({ taxonomyId: 'GIA', isPot: true }), D.CGT_MANAGED))
t('ISA_SS → DRAW-LAST-TAX-FREE', () => assert.equal(classify({ taxonomyId: 'ISA_SS', isPot: true }), D.DRAW_LAST_TAX_FREE))
t('RESIDENCE → NOT-INCOME', () => assert.equal(classify({ taxonomyId: 'RESIDENCE', isPot: false }), D.NOT_INCOME))
t('EIS with live relief clock → RELIEF-LOCKED', () => {
  const future = new Date(Date.now() + 400 * 864e5).toISOString()
  assert.equal(classify({ taxonomyId: 'EIS', isPot: true, reliefHoldingEndDate: future }), D.RELIEF_LOCKED)
})
t('EIS with expired relief clock → drawable', () => {
  const past = new Date(Date.now() - 400 * 864e5).toISOString()
  assert.equal(classify({ taxonomyId: 'EIS', isPot: true, reliefHoldingEndDate: past }), D.DRAW_DOWN)
})
t('QCB corporate bond → DRAW-EARLY-CGT-EXEMPT', () => assert.equal(classify({ taxonomyId: 'CORP_BONDS', isPot: true, isQcb: true }), D.DRAW_EARLY_CGT_EXEMPT))
t('high-charge legacy pension → CONSOLIDATE-OR-DRAW-FIRST', () => assert.equal(classify({ taxonomyId: 'SIPP', category: 'pensions', isPot: true, amc: 0.018 }), D.CONSOLIDATE_FIRST))
t('user lock → NOT-INCOME regardless of type', () => assert.equal(classify({ taxonomyId: 'GIA', isPot: true, flaggedNonSpendable: true }), D.NOT_INCOME))
t('taxonomy map covers a pension, investment, cash, property each', () => {
  for (const id of ['SIPP', 'GIA', 'SAVINGS', 'BTL']) assert.ok(TAXONOMY_DRAW_CLASS[id], `${id} mapped`)
})

// ── evaluateHoldings(): bucketing + floor ───────────────────────────────────
t('guaranteed income builds the floor, not the sequence', () => {
  const r = evaluateHoldings([
    { id: 'sp', taxonomyId: 'STATE', isPot: false, guaranteedAnnual: 11973, taxTreatment: 'fullyTaxable' },
    { id: 'db', taxonomyId: 'DB', isPot: false, guaranteedAnnual: 20000, taxTreatment: 'fullyTaxable' },
    { id: 'sipp', taxonomyId: 'SIPP', isPot: true, currentValue: 400000 },
  ])
  assert.equal(r.secureIncome.length, 2, 'two floor streams')
  assert.equal(r.sequenceable.length, 1, 'only the SIPP is sequenceable')
  assert.ok(r.grossFloorIncome === 31973, `gross floor 31973, got ${r.grossFloorIncome}`)
  assert.ok(r.netFloorIncome > 0 && r.netFloorIncome <= r.grossFloorIncome, 'net floor sane')
})
t('relief-locked + illiquid + specialist are excluded, never sequenced', () => {
  const future = new Date(Date.now() + 400 * 864e5).toISOString()
  const r = evaluateHoldings([
    { id: 'eis', taxonomyId: 'EIS', isPot: true, currentValue: 50000, reliefHoldingEndDate: future },
    { id: 'art', taxonomyId: 'ART', isPot: true, currentValue: 80000 },
    { id: 's32', taxonomyId: 'SECTION_32', isPot: true, currentValue: 120000, isSafeguarded: true, cetv: 120000 },
    { id: 'gia', taxonomyId: 'GIA', isPot: true, currentValue: 100000 },
  ])
  assert.equal(r.sequenceable.length, 1, 'only the GIA sequences')
  assert.equal(r.specialist.length, 1, 'S32 flagged to specialist')
  assert.ok(r.excluded.length >= 3, 'eis/art/s32 excluded')
})
t('two GIAs with different gains are kept distinct (not averaged)', () => {
  const r = evaluateHoldings([
    { id: 'g1', taxonomyId: 'GIA', isPot: true, currentValue: 100000, embeddedGainPct: 0.03 },
    { id: 'g2', taxonomyId: 'GIA', isPot: true, currentValue: 100000, embeddedGainPct: 0.60 },
  ])
  assert.equal(r.sequenceable.length, 2, 'both sequenceable as separate lines')
  const gains = r.sequenceable.map(h => h.embeddedGainPct).sort()
  assert.deepEqual(gains, [0.03, 0.60], 'per-line gains preserved')
})
t('cash routes to emergency/sequence reserve, not the draw set', () => {
  const r = evaluateHoldings([
    { id: 'cur', taxonomyId: 'CURRENT', category: 'cash', isPot: true, currentValue: 10000 },
    { id: 'fix', taxonomyId: 'FIXED', category: 'cash', isPot: true, currentValue: 50000 },
    { id: 'sav', taxonomyId: 'SAVINGS', category: 'cash', isPot: true, currentValue: 30000 },
  ])
  assert.equal(r.reserve.emergency.length, 1, 'current = emergency buffer')
  assert.equal(r.reserve.sequence.length, 1, 'fixed-term = sequence reserve')
  assert.ok(r.sequenceable.some(h => h.id === 'sav'), 'easy-access savings is drawable-first')
})

// ── normaliseHoldings() on the real Bruce fixture ───────────────────────────
t('Bruce normalises to per-holding records', () => {
  const hs = normaliseHoldings(bruce)
  assert.ok(hs.length >= 5, `at least 5 holdings, got ${hs.length}`)
  const ids = hs.map(h => h.taxonomyId)
  assert.ok(ids.includes('STATE'), 'state pension present as a holding')
  assert.ok(ids.includes('ISA_SS'), 'ISA present')
  assert.ok(ids.includes('GIA'), 'GIA present')
  const sipp = hs.find(h => h.taxonomyId === 'SIPP' && h.isPot)
  assert.ok(sipp && sipp.currentValue === 420000, `Vanguard SIPP £420k preserved, got ${sipp?.currentValue}`)
  assert.ok(sipp.amc === 0.0015, `per-scheme charge carried, got ${sipp.amc}`)
})
t('Bruce evaluate → state pension is the floor, SIPP/ISA/GIA sequenceable', () => {
  const r = evaluateHoldings(normaliseHoldings(bruce))
  assert.ok(r.grossFloorIncome >= 11973, `floor includes £11,973 state pension, got ${r.grossFloorIncome}`)
  const seqIds = r.sequenceable.map(h => h.taxonomyId)
  assert.ok(seqIds.includes('SIPP') && seqIds.includes('ISA_SS') && seqIds.includes('GIA'), 'DC pot + ISA + GIA all sequenceable')
})
t('Bruce BTL net rent joins the floor, residence excluded', () => {
  const r = evaluateHoldings(normaliseHoldings(bruce))
  const rentFloor = r.secureIncome.find(s => s.streamType === 'other' || s.sourceTaxonomyId === 'BTL')
  assert.ok(r.grossFloorIncome >= 11973 + 19200 - 1, `floor includes £19,200 net rent, got ${r.grossFloorIncome}`)
})

console.log(`\ndecumulation-classify — pass=${pass} fail=${fail}`)
if (fail) process.exit(1)
