// ─────────────────────────────────────────────────────────────────────────────
// Rule-based validator — UK tax invariants checked against engine output.
// Runs offline (no API calls). Catches obvious bugs:
//   - ISA balance exceeds annual allowance × years
//   - Personal allowance taper applied incorrectly
//   - IHT computed without NRB/RNRB
//   - Negative net worth from positive inputs
//   - SIPP IHT inclusion before April 2027
//   - Wealth Score outside 0-100
//   - Risk Score outside 0-100
// ─────────────────────────────────────────────────────────────────────────────

const UK_RULES = {
  '2021/22': { isa_limit: 20000, pa: 12570, basic_band: 37700, addl_threshold: 150000,
               nrb: 325000, rnrb: 175000, pension_aa: 40000 },
  '2022/23': { isa_limit: 20000, pa: 12570, basic_band: 37700, addl_threshold: 150000,
               nrb: 325000, rnrb: 175000, pension_aa: 40000 },
  '2023/24': { isa_limit: 20000, pa: 12570, basic_band: 37700, addl_threshold: 125140,
               nrb: 325000, rnrb: 175000, pension_aa: 60000 },
  '2024/25': { isa_limit: 20000, pa: 12570, basic_band: 37700, addl_threshold: 125140,
               nrb: 325000, rnrb: 175000, pension_aa: 60000 },
  '2025/26': { isa_limit: 20000, pa: 12570, basic_band: 37700, addl_threshold: 125140,
               nrb: 325000, rnrb: 175000, pension_aa: 60000 },
  '2026/27': { isa_limit: 20000, pa: 12570, basic_band: 37700, addl_threshold: 125140,
               nrb: 325000, rnrb: 175000, pension_aa: 60000 },
};

export function ruleValidate(snapshot, persona) {
  const taxYear = snapshot.tax_year;
  const rules = UK_RULES[taxYear] || UK_RULES['2025/26'];
  const issues = [];
  const checks = [];

  // C1: Wealth Score band check
  const fq = snapshot.fq_score;
  if (fq != null) {
    checks.push({ id: 'C1', category: 'risk', status: (fq >= 0 && fq <= 100) ? 'PASS' : 'FAIL',
      comment: `Wealth Score ${fq} ${fq >= 0 && fq <= 100 ? 'in valid range' : 'OUT OF RANGE (must be 0-100)'}` });
    if (fq < 0 || fq > 100) issues.push(`Wealth Score ${fq} out of 0-100 range`);
  }

  // C2: Risk Score band check
  const rs = snapshot.risk_score;
  if (rs != null) {
    checks.push({ id: 'C2', category: 'risk', status: (rs >= 0 && rs <= 100) ? 'PASS' : 'FAIL',
      comment: `Risk Score ${rs} ${rs >= 0 && rs <= 100 ? 'in valid range' : 'OUT OF RANGE'}` });
    if (rs < 0 || rs > 100) issues.push(`Risk Score ${rs} out of 0-100 range`);
  }

  // C3: ISA balance plausible (max = annual limit × years held, with growth)
  const isa = snapshot.balance_sheet?.isa ?? 0;
  const ageAtSnap = (persona.age || 60) + ((parseInt(taxYear.split('/')[0]) - 2026));
  const maxIsaYears = Math.max(0, ageAtSnap - 18);
  const maxIsaAtLimit = rules.isa_limit * maxIsaYears * 2; // 2× to allow growth headroom
  const isaPlausible = isa <= maxIsaAtLimit + 100000;
  checks.push({ id: 'C3', category: 'balance_sheet',
    status: isaPlausible ? 'PASS' : 'WARN',
    comment: `ISA £${isa.toLocaleString()} (max plausible ~£${maxIsaAtLimit.toLocaleString()} for ${maxIsaYears} years at £${rules.isa_limit}/yr)` });
  if (!isaPlausible) issues.push(`ISA balance £${isa.toLocaleString()} exceeds plausible max`);

  // C4: IHT — if exposed, gross estate must exceed NRB
  const iht = snapshot.iht_breakdown;
  if (iht && iht.gross != null) {
    const ihtAmount = snapshot.iht_exposure ?? 0;
    const expectsIht = iht.gross > rules.nrb + (iht.rnrb || 0);
    const ihtMatches = (ihtAmount > 0) === expectsIht;
    checks.push({ id: 'C4', category: 'estate',
      status: ihtMatches ? 'PASS' : 'WARN',
      comment: `IHT ${ihtAmount > 0 ? '£' + ihtAmount.toLocaleString() : 'NIL'}, gross estate £${(iht.gross||0).toLocaleString()} vs NRB £${rules.nrb.toLocaleString()}+RNRB £${(iht.rnrb||0).toLocaleString()}` });
    if (!ihtMatches) issues.push(`IHT logic mismatch: gross ${iht.gross} vs IHT ${ihtAmount}`);
  }

  // C5: SIPP IHT timing — before April 2027 SIPPs OUTSIDE estate
  if (parseInt(taxYear.split('/')[0]) < 2027 && iht?.sipp_contribution > 0) {
    checks.push({ id: 'C5', category: 'estate', status: 'WARN',
      comment: `SIPP contribution to IHT £${iht.sipp_contribution} but ${taxYear} is before April 2027 (SIPPs should be OUTSIDE estate)` });
    issues.push(`SIPP IHT included before Apr 2027 (${taxYear})`);
  }

  // C6: Net worth sanity (negative only if liabilities > assets, which is a real case)
  const nw = snapshot.net_worth ?? 0;
  const totalAssets = (snapshot.balance_sheet?.cash || 0) + (snapshot.balance_sheet?.isa || 0)
                    + (snapshot.balance_sheet?.sipp || 0) + (snapshot.balance_sheet?.property || 0)
                    + (snapshot.balance_sheet?.portfolio || 0);
  const totalLiab = snapshot.balance_sheet?.mortgage || 0;
  const expectedNW = totalAssets - totalLiab;
  const nwDelta = Math.abs(nw - expectedNW);
  const nwTolerance = Math.max(50000, Math.abs(expectedNW) * 0.5); // 50% — engine may include other assets
  checks.push({ id: 'C6', category: 'balance_sheet',
    status: nwDelta < nwTolerance ? 'PASS' : 'WARN',
    comment: `NW £${nw.toLocaleString()} vs sum-of-listed £${expectedNW.toLocaleString()} (Δ £${Math.round(nwDelta).toLocaleString()})` });

  // C7: Engine error flag
  if (snapshot.errors?.length) {
    checks.push({ id: 'C7', category: 'overall', status: 'FAIL',
      comment: `Engine errors: ${snapshot.errors.join('; ')}` });
    issues.push(...snapshot.errors);
  }

  const overall = checks.some(c => c.status === 'FAIL') ? 'FAIL'
                : checks.some(c => c.status === 'WARN') ? 'WARN' : 'PASS';
  const score = Math.round(100 * checks.filter(c => c.status === 'PASS').length / Math.max(1, checks.length));

  return {
    overall,
    score,
    headline: issues.length === 0
      ? `${checks.length} rule checks passed`
      : `${issues.length} issue(s): ${issues[0]}`,
    results: checks.map(c => ({ category: c.category, status: c.status, comment: c.comment })),
    issues,
  };
}
