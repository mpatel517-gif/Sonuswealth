// ─────────────────────────────────────────────────────────────────────────────
// Eligibility smoke test — verifies the 15 v0 rules behave correctly across
// canonical and boundary personas.
//
// Test format: each rule has at least 2 cases:
//   - YES persona (qualifies cleanly)
//   - NO/PARTIAL persona (boundary or fails)
//
// Run: node tests/eligibility-smoke.mjs
// ─────────────────────────────────────────────────────────────────────────────

import { evaluate, getRule, listRules } from '../src/engine/eligibility.js';

const fmt = (n) => typeof n === 'number' ? '£' + Math.round(n).toLocaleString('en-GB') : String(n);

const cases = [
  // ── NI QUALIFYING YEARS ────────────────────────────────────────────────────
  { rule: 'NI-QUAL-YEARS', label: 'Full NI record', persona: { ni: { qualifying_years: 35 } }, expect: 'YES' },
  { rule: 'NI-QUAL-YEARS', label: 'Partial NI (22/35)', persona: { ni: { qualifying_years: 22 } }, expect: 'PARTIAL' },
  { rule: 'NI-QUAL-YEARS', label: 'No NI record (5 yrs)', persona: { ni: { qualifying_years: 5 } }, expect: 'NO' },

  // ── PA TAPER ───────────────────────────────────────────────────────────────
  { rule: 'PA-TAPER', label: 'Below £100k (not applicable)', persona: { targetIncome: 95000 }, expect: 'NA' },
  { rule: 'PA-TAPER', label: 'In taper £115k', persona: { targetIncome: 115000 }, expect: 'PARTIAL' },
  { rule: 'PA-TAPER', label: 'Above taper £130k', persona: { targetIncome: 130000 }, expect: 'NO' },

  // ── HICBC ──────────────────────────────────────────────────────────────────
  { rule: 'HICBC', label: 'Below £60k, 2 kids', persona: { targetIncome: 55000, dependants: 2 }, expect: 'YES' },
  { rule: 'HICBC', label: 'In taper £70k, 2 kids', persona: { targetIncome: 70000, dependants: 2 }, expect: 'PARTIAL' },
  { rule: 'HICBC', label: 'Above £80k, 2 kids', persona: { targetIncome: 85000, dependants: 2 }, expect: 'NO' },

  // ── RNRB descendant ────────────────────────────────────────────────────────
  { rule: 'RNRB-DESCENDANT', label: 'Property + children', persona: { assets: { residence: { value: 500000 } }, dependants: 2 }, expect: 'YES' },
  { rule: 'RNRB-DESCENDANT', label: 'Property + no children', persona: { assets: { residence: { value: 500000 } }, dependants: 0, hasDirectDescendants: false }, expect: 'NO' },

  // ── RNRB taper ─────────────────────────────────────────────────────────────
  { rule: 'RNRB-TAPER', label: 'Estate £1.5M (no taper)', persona: { assets: { residence: { value: 1500000 } } }, expect: 'NA' },
  { rule: 'RNRB-TAPER', label: 'Estate £2.2M', persona: { assets: { residence: { value: 1000000 }, sipp: { total: 1200000 } } }, expect: 'PARTIAL' },
  { rule: 'RNRB-TAPER', label: 'Estate £2.5M', persona: { assets: { residence: { value: 1500000 }, sipp: { total: 1000000 } } }, expect: 'NO' },

  // ── 7-year PET ─────────────────────────────────────────────────────────────
  { rule: 'PET-7YR-CLOCK', label: 'Gift 8 yrs ago', persona: { gifts: [{ amount: 100000, date: '2018-01-01' }] }, expect: 'YES' },
  { rule: 'PET-7YR-CLOCK', label: 'Gift 2 yrs ago', persona: { gifts: [{ amount: 100000, date: '2024-06-01' }] }, expect: 'PARTIAL' },

  // ── MPAA ───────────────────────────────────────────────────────────────────
  { rule: 'MPAA', label: 'Not triggered', persona: { assets: { sipp: { total: 500000 } }, pension: { mpaa_triggered: false } }, expect: 'YES' },
  { rule: 'MPAA', label: 'Triggered', persona: { assets: { sipp: { total: 500000 } }, pension: { mpaa_triggered: true } }, expect: 'NO' },

  // ── Marriage Allowance ────────────────────────────────────────────────────
  { rule: 'MARRIAGE-ALLOWANCE', label: 'Eligible (low spouse + BR)', persona: { isCouple: true, targetIncome: 45000, spouse: { income: { salary: 8000 } } }, expect: 'YES' },
  { rule: 'MARRIAGE-ALLOWANCE', label: 'Both above PA', persona: { isCouple: true, targetIncome: 40000, spouse: { income: { salary: 35000 } } }, expect: 'NO' },
  { rule: 'MARRIAGE-ALLOWANCE', label: 'Higher spouse is HR', persona: { isCouple: true, targetIncome: 60000, spouse: { income: { salary: 5000 } } }, expect: 'NO' },

  // ── SDLT FTB ───────────────────────────────────────────────────────────────
  { rule: 'SDLT-FTB', label: 'FTB intending £450k', persona: { first_time_buyer: true, intended_property_purchase: { price: 450000 }, lifeStage: 1 }, expect: 'YES' },
  { rule: 'SDLT-FTB', label: 'FTB intending £550k (over)', persona: { first_time_buyer: true, intended_property_purchase: { price: 550000 }, lifeStage: 1 }, expect: 'NO' },

  // ── BPR 2-yr ───────────────────────────────────────────────────────────────
  { rule: 'BPR-2YR-HOLDING', label: 'AIM held 3 yrs', persona: { assets: { aim_portfolio: { value: 100000, acquired_date: '2022-01-01' } } }, expect: 'YES' },
  { rule: 'BPR-2YR-HOLDING', label: 'AIM held 1 yr', persona: { assets: { aim_portfolio: { value: 100000, acquired_date: '2025-01-01' } } }, expect: 'NO' },

  // ── Charity 10% ────────────────────────────────────────────────────────────
  { rule: 'CHARITY-10-PCT', label: 'Charity 10% on big estate', persona: { assets: { residence: { value: 800000 }, sipp: { total: 1500000 } }, will: { charity_bequest: 200000 }, isCouple: true, dependants: 2 }, expect: 'YES' },
  { rule: 'CHARITY-10-PCT', label: 'Charity <10% on big estate (strategy not beneficial)', persona: { assets: { residence: { value: 800000 }, sipp: { total: 1500000 } }, will: { charity_bequest: 50000 }, isCouple: true, dependants: 2 }, expect: 'NA' },

  // ── SRT ────────────────────────────────────────────────────────────────────
  { rule: 'SRT-RESIDENCE', label: 'UK 200 days', persona: { uk_days_in_year: 200, jurisdictionContext: { secondary: 'IN' } }, expect: 'YES' },
  { rule: 'SRT-RESIDENCE', label: 'UK 10 days prior resident', persona: { uk_days_in_year: 10, srt: { previously_resident: true }, jurisdictionContext: { secondary: 'IN' } }, expect: 'NO' },

  // ── PPR ────────────────────────────────────────────────────────────────────
  { rule: 'PPR', label: 'Main residence full', persona: { assets: { residence: { value: 600000, occupancy_status: 'main_residence' } } }, expect: 'YES' },
  { rule: 'PPR', label: 'BTL — no PPR', persona: { assets: { residence: { value: 400000, occupancy_status: 'btl', unrealised_gain: 100000 } } }, expect: 'NO' },

  // ── Carry-forward AA ───────────────────────────────────────────────────────
  { rule: 'CARRY-FORWARD-AA', label: 'Member 3 yrs with unused AA', persona: { pension: { scheme_member_in: [2023, 2024, 2025], contribution_history: [{ tax_year: '2023/24', contributed: 30000, aa: 60000 }, { tax_year: '2024/25', contributed: 20000, aa: 60000 }] } }, expect: 'YES' },
  { rule: 'CARRY-FORWARD-AA', label: 'Never a scheme member', persona: { pension: { scheme_member_in: [], contribution_history: [] } }, expect: 'NO' },

  // ── UK Domicile ────────────────────────────────────────────────────────────
  { rule: 'UK-DOMICILE', label: 'UK origin', persona: { domicile: { status: 'uk-origin' } }, expect: 'YES' },
  { rule: 'UK-DOMICILE', label: 'Non-dom <15yrs', persona: { domicile: { status: 'non-dom', uk_years: 8 } }, expect: 'NO' },
  { rule: 'UK-DOMICILE', label: 'Non-dom 17yrs (auto deemed)', persona: { domicile: { status: 'non-dom', uk_years: 17 } }, expect: 'YES' },
];

console.log('═══════════════════════════════════════════════════════════════');
console.log('  SONUSWEALTH ELIGIBILITY RULES — SMOKE TEST');
console.log(`  Total rules registered: ${listRules().length}`);
console.log(`  Total test cases: ${cases.length}`);
console.log('═══════════════════════════════════════════════════════════════\n');

let pass = 0, fail = 0;
const failures = [];

for (const c of cases) {
  const rule = getRule(c.rule);
  if (!rule) {
    console.log(`✗ MISSING RULE: ${c.rule} (case: ${c.label})`);
    fail++;
    failures.push(c);
    continue;
  }
  let result;
  try {
    if (rule.applicability && !rule.applicability(c.persona)) {
      result = { qualifies: 'NA', reason: 'Rule not applicable to persona' };
    } else {
      result = rule.predicate(c.persona, new Date('2025-12-01'));
    }
  } catch (e) {
    result = { qualifies: 'ERROR', reason: e.message };
  }
  const ok = result.qualifies === c.expect;
  if (ok) pass++; else { fail++; failures.push({ ...c, got: result.qualifies, reason: result.reason }); }
  const symbol = ok ? '✓' : '✗';
  const detail = `${result.qualifies}${result.grade != null ? ' (' + (result.grade*100).toFixed(0) + '%)' : ''}`;
  console.log(`${symbol} [${c.rule}] ${c.label} → expected ${c.expect}, got ${detail}`);
  if (!ok) console.log(`    reason: ${result.reason}`);
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`  RESULT: ${pass}/${cases.length} pass, ${fail} fail`);
console.log('═══════════════════════════════════════════════════════════════');

if (fail > 0) {
  console.log('\nFAILURES:');
  for (const f of failures) {
    console.log(`  ${f.rule} / ${f.label}: expected ${f.expect}, got ${f.got}`);
  }
  process.exit(1);
}
process.exit(0);
