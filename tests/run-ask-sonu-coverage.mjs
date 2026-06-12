// ─────────────────────────────────────────────────────────────────────────────
// ASK SONU — Coverage runner
//
// Runs every query in tests/ask-sonu-scenarios.json through the deterministic
// engine (LLM not callable from Node — needs browser). For each, captures:
//   - lead title + saving + source + state
//   - whether off-ontology
//   - lens consultation
// Writes raw JSON results to tests/reports/COVERAGE-RAW-{date}.json
// and a markdown summary to tests/reports/COVERAGE-{date}.md
//
// Usage: node tests/run-ask-sonu-coverage.mjs
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// Load scenarios + import engine (Windows: needs file:// URL)
const scenarios = JSON.parse(readFileSync(resolve(ROOT, 'tests/ask-sonu-scenarios.json'), 'utf-8'))
const { askSonu } = await import(pathToFileURL(resolve(ROOT, 'src/engine/ask-sonu/index.js')).href)

// Two test personas — partly-used and ISA-FULL
const personaPartial = {
  name: 'Bruce Wayne',
  age: 62,
  maritalStatus: 'married',
  work_status: 'employed',
  assets: {
    sipp: 850000, isa: 420000, gia: 200000, property: 450000, cash: 180000,
    investments: [{ type: 'isa', contribution_current_tax_year: 15000 }],
  },
  income: { annual: 110000, savings: 4500 },
  dependents: [{ age: 16 }, { age: 19 }],
}
const personaISAFull = {
  ...personaPartial,
  assets: {
    ...personaPartial.assets,
    investments: [{ type: 'isa', contribution_current_tax_year: 20000 }],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Score one query
// ─────────────────────────────────────────────────────────────────────────────
async function scoreQuery(s, persona) {
  const r = await askSonu(s.query, persona, { useLLM: false })
  const a = r.answer
  const lead = a?.lead

  // Heuristic scoring (deterministic-only — LLM path tested in browser)
  let status = 'PASS'
  let notes = []

  if (s.domain === 'off_scope') {
    if (a?.off_ontology || !lead) {
      status = 'PASS'   // off-scope correctly refused
    } else {
      status = 'FAIL'
      notes.push('should have routed to off-scope')
    }
  } else {
    if (!a || a.off_ontology) {
      status = 'FAIL'
      notes.push('off-ontology — no lead found')
    } else if (!lead) {
      status = 'FAIL'
      notes.push('no lead')
    } else {
      // Theme match check (loose — title or category should contain a related word)
      const theme = (s.expected_theme || '').toLowerCase()
      const title = (lead.title || '').toLowerCase()
      const id    = (lead.id || '').toLowerCase()
      const category = (lead.category || '').toLowerCase()

      // Map common themes to title/id keywords
      const themeKeywords = themeKeywordMap(theme)
      const matched = themeKeywords.some(kw => title.includes(kw) || id.includes(kw) || category.includes(kw))

      if (matched) {
        status = 'PASS'
      } else if (lead.id === '__freeform') {
        status = 'WEAK'
        notes.push('freeform — no exact play match')
      } else {
        status = 'WRONG_LEAD'
        notes.push(`expected theme "${theme}", got "${lead.id}" / "${lead.title}"`)
      }
    }
  }

  return {
    id: s.id,
    domain: s.domain,
    query: s.query,
    expected: s.expected_theme,
    state_aware: s.state_aware,
    status,
    lead_id: lead?.id || null,
    lead_title: lead?.title || null,
    gbp_saved: lead?.impact?.gbp_saved ?? null,
    source: r.source,
    advisors: lead?.advisors || [],
    isa_remaining: a?.taxYearState?.isa?.remaining ?? null,
    aa_remaining: a?.taxYearState?.pension_aa?.remaining ?? null,
    notes: notes.join('; '),
  }
}

// Coarse theme → keyword mapping (heuristic — the report flags WRONG_LEAD
// for the human to look at, doesn't fail-stop the run)
function themeKeywordMap(theme) {
  const t = theme
  if (t.includes('phase_tfc') || t.includes('tfc') || t.includes('phased_drawdown')) return ['phase', 'tfc', 'drawdown']
  if (t.includes('split_isa') || t.includes('split_with_spouse')) return ['split', 'spouse']
  if (t.includes('defer_state_pension')) return ['defer', 'state pension']
  if (t.includes('preserve_pension') || t.includes('pre_2027')) return ['preserve', 'sipp', '2027']
  if (t.includes('mpaa')) return ['mpaa']
  if (t.includes('surplus_income') || t.includes('gift') || t.includes('pet_')) return ['surplus', 'gift', 'gifting', '7-year', 'normal expenditure']
  if (t.includes('aim_bpr') || t.includes('bpr')) return ['aim', 'bpr', 'business property']
  if (t.includes('charity')) return ['charity', '10%']
  if (t.includes('lasting_poa') || t.includes('lpa')) return ['lasting', 'lpa', 'power of attorney']
  if (t.includes('srt') || t.includes('day_count')) return ['srt', 'residence', 'day-count', 'day counting']
  if (t.includes('fig_window') || t.includes('fig_regime')) return ['fig']
  if (t.includes('cohab')) return ['cohab', 'cohabit']
  if (t.includes('pension_sharing') || t.includes('divorce')) return ['pension sharing', 'divorce', 'wrpa']
  if (t.includes('marriage_allowance')) return ['marriage allowance']
  if (t.includes('bed_and_isa')) return ['bed-and-isa', 'bed and isa']
  if (t.includes('taper_pension') || t.includes('taper_trap') || t.includes('taper_pension_relief')) return ['taper', '100k', 'bonus → pension']
  if (t.includes('deploy_cash_isa') || t.includes('isa_first')) return ['cash into', 'isa first', 'unused isa']
  if (t.includes('psa_optimisation') || t.includes('psa')) return ['psa', 'personal savings', 'savings allowance']
  if (t.includes('emergency_fund')) return ['emergency', 'liquid']
  if (t.includes('gilt_ladder')) return ['gilt']
  if (t.includes('care_fee') || t.includes('care_cap')) return ['care']
  if (t.includes('income_protection') || t.includes('ip_cover')) return ['income protection', 'ip']
  if (t.includes('iht_tail') || t.includes('10yr')) return ['iht', '10 years', 'departure']
  if (t.includes('rnrb') || t.includes('nrb')) return ['rnrb', 'nrb', 'nil-rate', 'nil rate']
  if (t.includes('off_scope')) return ['off-scope', 'outside']
  // Mortgage / debt domain (W6) — every correct lead has category 'mortgage',
  // plus a sub-intent keyword distinguishing the four plays.
  if (t.includes('payoff') || t.includes('rate_vs_expected') || t.includes('mortgage_payoff')) return ['mortgage', 'overpay', 'invest']
  if (t.includes('fixed_vs_tracker') || t.includes('interest_only') || t.includes('lti_affordability') || t.includes('btl_leverage')) return ['mortgage', 'remortgage', 'fixed', 'tracker', 'borrow']
  if (t.includes('offset')) return ['mortgage', 'offset']
  if (t.includes('equity_release')) return ['mortgage', 'equity release', 'equity_release', 'equity']
  // Cash domain new sub-intents (W6)
  if (t.includes('mmf_vs_cash_isa')) return ['money market', 'mmf', 'cash isa', 'where to hold cash']
  if (t.includes('isa_full')) return ['isa is full', 'next pound', 'next steps', 'spouse', 'pension', 'gia']
  if (t.includes('bed_and_sipp')) return ['bed-and-sipp', 'bed and sipp', 'sipp']
  if (t.includes('cash_yield_drop') || t.includes('yield_drop')) return ['rates have dropped', 'savings rates', 'where your cash sits', 'cash sits']
  // Investment / portfolio domain (W6)
  if (t.includes('allocation_age') || t === 'allocation') return ['allocation', 'asset', 'portfolio']
  if (t.includes('ter') || t.includes('fee')) return ['fee', 'ter', 'cost', 'charge', 'what your funds cost']
  if (t.includes('passive_vs_active') || t.includes('passive')) return ['passive', 'active', 'index']
  if (t.includes('concentration')) return ['concentration', 'single holding', 'single-stock', 'single stock']
  if (t.includes('cash_allocation')) return ['cash', 'liquid', 'emergency', 'allocation']
  if (t.includes('rebalanc')) return ['rebalanc', 'rebalance', 'on track', 'keeping your mix']
  if (t.includes('em_allocation') || t.includes('emerging')) return ['emerging market', 'emerging markets', 'emerging']
  if (t.includes('esg')) return ['esg', 'sustainable', 'ethical']
  // Business exit domain (W6)
  if (t.includes('asset_vs_share') || t.includes('share_sale')) return ['share sale', 'asset sale', 'selling up']
  if (t.includes('badr_eligibility') || t === 'badr') return ['badr', 'business asset disposal']
  if (t.includes('exit_sequencing')) return ['exit', 'gradually', 'all at once', 'staged']
  if (t.includes('earnout')) return ['earn-out', 'earnout', 'deferred', 'lump sum']
  if (t.includes('eot')) return ['eot', 'employee ownership']
  if (t.includes('mvl')) return ['mvl', 'winding down', 'liquidation', 'capital treatment']
  if (t.includes('dividend_vs_capital') || t.includes('dividend')) return ['dividend', 'sell the shares', 'capital']
  if (t.includes('investors_relief')) return ['investors', 'investor', 'relief']
  // Property domain (W6)
  if (t.includes('downsize')) return ['downsiz', 'downsizing']
  if (t.includes('upsize')) return ['bigger home', 'upsize', 'buying a bigger']
  if (t.includes('btl_personal_vs_ltd') || t.includes('btl_s24') || t.includes('s24')) return ['s24', 'section 24', 'still profitable', 'after section']
  if (t.includes('btl_incorporation') || t.includes('incorporat')) return ['incorporat', 'limited company', 'portfolio']
  if (t.includes('fhl')) return ['holiday let', 'fhl', 'furnished holiday']
  if (t.includes('ftb')) return ['first-time buyer', 'ftb', 'first time']
  if (t.includes('second_home')) return ['second home', 'surcharge']
  if (t.includes('btl_disposal')) return ['selling a buy-to-let', 'sell', 'btl', 'disposal']
  if (t.includes('btl_cgt') || t.includes('cgt_residential')) return ['cgt', 'capital gains', 'when you sell']
  if (t.includes('btl_s24_sdlt_yield') || (t.includes('btl') && t.includes('yield'))) return ['buy-to-let', 'btl', 'numbers that decide']
  // Fallback — split underscores
  return t.split('_').filter(w => w.length >= 4)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
console.log(`Running ${scenarios.length} scenarios against deterministic engine…\n`)

const results = []
for (let i = 0; i < scenarios.length; i++) {
  const s = scenarios[i]
  // Use ISA-full persona for ISA-related state-aware tests
  const persona = (s.id === 'CASH-06' || s.id === 'CASH-07') ? personaISAFull : personaPartial
  const r = await scoreQuery(s, persona)
  results.push(r)
  process.stdout.write(`  ${i + 1}/${scenarios.length} ${r.status === 'PASS' ? '✓' : r.status === 'WEAK' ? '~' : '✗'} ${s.id} ${s.query.slice(0, 50)}…\r`)
}
console.log('\n')

// ─────────────────────────────────────────────────────────────────────────────
// Aggregate + write reports
// ─────────────────────────────────────────────────────────────────────────────
const now = new Date().toISOString().slice(0, 10)
mkdirSync(resolve(ROOT, 'tests/reports'), { recursive: true })

writeFileSync(
  resolve(ROOT, `tests/reports/COVERAGE-RAW-${now}.json`),
  JSON.stringify(results, null, 2),
)

// Domain summary
const byDomain = {}
for (const r of results) {
  byDomain[r.domain] = byDomain[r.domain] || { total: 0, pass: 0, weak: 0, wrong: 0, fail: 0 }
  byDomain[r.domain].total++
  if      (r.status === 'PASS')       byDomain[r.domain].pass++
  else if (r.status === 'WEAK')       byDomain[r.domain].weak++
  else if (r.status === 'WRONG_LEAD') byDomain[r.domain].wrong++
  else                                 byDomain[r.domain].fail++
}

const passTotal = results.filter(r => r.status === 'PASS').length
const weakTotal = results.filter(r => r.status === 'WEAK').length
const wrongTotal = results.filter(r => r.status === 'WRONG_LEAD').length
const failTotal = results.filter(r => r.status === 'FAIL').length

const md = []
md.push(`# Ask Sonu Coverage Report — ${now}`)
md.push('')
md.push(`**Total scenarios:** ${scenarios.length}`)
md.push(`**Engine path:** deterministic (LLM path requires browser test)`)
md.push('')
md.push(`## Overall`)
md.push('')
md.push(`| Status | Count | % |`)
md.push(`|---|---|---|`)
md.push(`| ✅ PASS | ${passTotal} | ${Math.round(passTotal/scenarios.length*100)}% |`)
md.push(`| ⚠ WEAK (freeform) | ${weakTotal} | ${Math.round(weakTotal/scenarios.length*100)}% |`)
md.push(`| ⚠ WRONG_LEAD | ${wrongTotal} | ${Math.round(wrongTotal/scenarios.length*100)}% |`)
md.push(`| ❌ FAIL | ${failTotal} | ${Math.round(failTotal/scenarios.length*100)}% |`)
md.push('')

md.push(`## By Domain`)
md.push('')
md.push(`| Domain | Total | Pass | Weak | Wrong-lead | Fail | Pass-rate |`)
md.push(`|---|---|---|---|---|---|---|`)
for (const [d, st] of Object.entries(byDomain).sort()) {
  const pct = Math.round((st.pass / st.total) * 100)
  md.push(`| ${d} | ${st.total} | ${st.pass} | ${st.weak} | ${st.wrong} | ${st.fail} | ${pct}% |`)
}
md.push('')

md.push(`## All scenarios (sorted by domain)`)
md.push('')
md.push(`| ID | Domain | Status | Query | Lead | Saving | Notes |`)
md.push(`|---|---|---|---|---|---|---|`)
const sorted = [...results].sort((a, b) => a.domain.localeCompare(b.domain) || a.id.localeCompare(b.id))
for (const r of sorted) {
  const icon = r.status === 'PASS' ? '✅' : r.status === 'WEAK' ? '⚠' : r.status === 'WRONG_LEAD' ? '⚠' : '❌'
  const savings = r.gbp_saved ? `£${(r.gbp_saved/1000).toFixed(0)}k` : '-'
  md.push(`| ${r.id} | ${r.domain} | ${icon} ${r.status} | ${r.query.slice(0, 50)} | ${r.lead_title || '-'} | ${savings} | ${r.notes || ''} |`)
}
md.push('')

md.push(`## Worst-performing domains (priority for KG expansion)`)
md.push('')
const ranked = Object.entries(byDomain)
  .map(([d, st]) => ({ d, ...st, passrate: st.pass / st.total }))
  .filter(x => x.d !== 'off_scope')
  .sort((a, b) => a.passrate - b.passrate)
md.push(`| Rank | Domain | Pass-rate | Failures | Notes |`)
md.push(`|---|---|---|---|---|`)
ranked.slice(0, 8).forEach((x, i) => {
  md.push(`| ${i+1} | ${x.d} | ${Math.round(x.passrate*100)}% | ${x.weak + x.wrong + x.fail}/${x.total} | needs plays |`)
})
md.push('')

md.push(`## Off-scope behaviour (should refuse cleanly)`)
md.push('')
md.push(`| ID | Query | Refused? |`)
md.push(`|---|---|---|`)
for (const r of results.filter(r => r.domain === 'off_scope')) {
  md.push(`| ${r.id} | ${r.query} | ${r.status === 'PASS' ? '✅ yes' : '❌ no — picked: ' + r.lead_title} |`)
}
md.push('')

writeFileSync(resolve(ROOT, `tests/reports/COVERAGE-${now}.md`), md.join('\n'))

console.log(`✅ COVERAGE-${now}.md written`)
console.log(`✅ COVERAGE-RAW-${now}.json written`)
console.log()
console.log(`Overall: ${passTotal}/${scenarios.length} (${Math.round(passTotal/scenarios.length*100)}%) PASS`)
console.log(`         ${weakTotal} WEAK · ${wrongTotal} WRONG_LEAD · ${failTotal} FAIL`)
console.log()
console.log(`Worst 5 domains:`)
ranked.slice(0, 5).forEach(x => console.log(`  ${x.d.padEnd(15)} ${Math.round(x.passrate*100)}% pass (${x.weak + x.wrong + x.fail}/${x.total} failures)`))
