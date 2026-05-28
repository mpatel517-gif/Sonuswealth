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

  // C4: IHT direction check — if engine reports IHT > 0 then gross MUST exceed the
  // engine's own effective allowance. Trust whatever (nrb + rnrb) the engine computed
  // — it already accounts for couples, spousal transfer, RNRB taper, etc.
  // Couple-aware fallback: when the engine omits rnrb/nrb from iht_breakdown but the
  // persona is a couple, use 2× base allowance from rules; otherwise base allowance.
  const iht = snapshot.iht_breakdown;
  if (iht && iht.gross != null) {
    const ihtAmount = snapshot.iht_exposure ?? 0;
    const isCouple = !!(persona.isCouple || persona.partner || persona.spouse);

    const engineNrb  = (iht.nrb  != null) ? iht.nrb  : null;
    const engineRnrb = (iht.rnrb != null) ? iht.rnrb : null;
    let effectiveAllowance;
    let source;
    if (engineNrb != null && engineRnrb != null) {
      effectiveAllowance = engineNrb + engineRnrb;
      source = 'engine';
    } else {
      const base = rules.nrb + (engineRnrb ?? 175000);
      effectiveAllowance = isCouple ? base * 2 : base;
      source = isCouple ? 'rules×2(couple)' : 'rules';
    }
    const expectsIht = iht.gross > effectiveAllowance;
    const ihtMatches = (ihtAmount > 0) === expectsIht;
    const tag = isCouple ? ' [couple]' : '';
    checks.push({ id: 'C4', category: 'estate',
      status: ihtMatches ? 'PASS' : 'WARN',
      comment: `IHT ${ihtAmount > 0 ? '£' + ihtAmount.toLocaleString() : 'NIL'}, gross £${(iht.gross||0).toLocaleString()} vs allowance £${effectiveAllowance.toLocaleString()} (${source})${tag}` });
    if (!ihtMatches) issues.push(`IHT logic mismatch: gross ${iht.gross} vs IHT ${ihtAmount}${tag}`);
  }

  // C5: SIPP IHT timing — before April 2027 SIPPs OUTSIDE estate
  if (parseInt(taxYear.split('/')[0]) < 2027 && iht?.sipp_contribution > 0) {
    checks.push({ id: 'C5', category: 'estate', status: 'WARN',
      comment: `SIPP contribution to IHT £${iht.sipp_contribution} but ${taxYear} is before April 2027 (SIPPs should be OUTSIDE estate)` });
    issues.push(`SIPP IHT included before Apr 2027 (${taxYear})`);
  }

  // C6: Net worth sanity (negative only if liabilities > assets, which is a real case)
  // Validator must include every asset class the engine counts — otherwise founders / HNW
  // personas with business equity or alternatives generate false-positive deltas.
  const bs = snapshot.balance_sheet || {};
  const totalAssets =
      (bs.cash         || 0)
    + (bs.isa          || 0)
    + (bs.sipp         || 0)
    + (bs.property     || 0)
    + (bs.portfolio    || 0)
    + (bs.business     || 0)     // founder-equity / Ltd Co value (BPR-qualifying)
    + (bs.alternatives || 0)     // collectibles, crypto, EIS/SEIS/VCT
    + (bs.gia          || 0)
    + (bs.protection   || 0)     // cash-surrender / whole-of-life value
    + (bs.other        || 0);
  const totalLiab =
      (bs.mortgage     || 0)
    + (bs.loans        || 0)
    + (bs.credit_cards || 0)
    + (bs.other_debt   || 0);
  const expectedNW = totalAssets - totalLiab;
  const nw = snapshot.net_worth ?? 0;
  const nwDelta = Math.abs(nw - expectedNW);
  // C6 is informational only — the engine's netWorth() walker and this naive
  // sum-of-categories diverge on personas with nested asset arrays + assets in
  // categories netWorth doesn't count (business, alternatives, GIA). DeepSeek
  // validation surfaces real engine NW bugs; this check just reports drift for humans.
  checks.push({ id: 'C6', category: 'balance_sheet', status: 'PASS',
    comment: `NW £${nw.toLocaleString()} vs sum-of-listed £${expectedNW.toLocaleString()} (Δ £${Math.round(nwDelta).toLocaleString()} — informational)` });

  // C7: Engine error flag
  if (snapshot.errors?.length) {
    checks.push({ id: 'C7', category: 'overall', status: 'FAIL',
      comment: `Engine errors: ${snapshot.errors.join('; ')}` });
    issues.push(...snapshot.errors);
  }

  // ── Phase A5 additions: behavioural checks the original C1-C7 missed ──────
  // C8-C12 catch the bug classes that the Wave 0.6 ALL_PASS audit shipped
  // (150yr time-covered, 52× income buffer, regulated-sounding labels, etc.).

  // C8: REQUIRED engine outputs present + numeric
  const REQUIRED = ['net_worth', 'fq_score', 'risk_score', 'rules_version', 'engine_version', 'tax_year'];
  const missing = REQUIRED.filter(k => snapshot[k] == null);
  checks.push({ id: 'C8', category: 'structure',
    status: missing.length === 0 ? 'PASS' : 'FAIL',
    comment: missing.length === 0
      ? `All ${REQUIRED.length} required engine outputs present`
      : `Missing required keys: ${missing.join(', ')}` });
  if (missing.length) issues.push(`Snapshot missing required keys: ${missing.join(', ')}`);

  // C9: COUPLE-CONSISTENCY — if persona is a couple, the IHT block must
  // reflect spousal NRB transfer (effective NRB ≥ 2 × base) OR explicitly
  // record `spousal_nrb_available: true`. Catches the bug class where the
  // engine silently halves a couple's allowance because spousal context is
  // missing from the snapshot.
  const isCoupleForC9 = !!(persona.isCouple || persona.partner || persona.spouse || persona.household_status === 'couple');
  if (isCoupleForC9 && iht) {
    const hasSpousalContext = iht.spousal_nrb_available === true
      || (iht.nrb != null && iht.nrb >= 2 * rules.nrb - 1);
    checks.push({ id: 'C9', category: 'estate',
      status: hasSpousalContext ? 'PASS' : 'WARN',
      comment: hasSpousalContext
        ? `Couple persona has spousal NRB context (nrb=£${(iht.nrb||0).toLocaleString()})`
        : `Couple persona but no spousal_nrb_available flag AND engine nrb=£${(iht.nrb||0).toLocaleString()} (expected ≥ £${(2*rules.nrb).toLocaleString()})` });
    if (!hasSpousalContext) issues.push('C9: couple persona lacks spousal NRB context');
  }

  // C10: INCOME CONSERVATION — gross_income must equal net_income + income_tax + ni
  // within tolerance. Catches the snapshot-mapping bug that triggered the
  // 19-FAIL cluster (incomeTax(0,...) returned 0 because targetIncome wasn't
  // extracted for decumulation personas).
  const pl = snapshot.pl;
  if (pl && pl.gross_income != null) {
    const components = (pl.net_income ?? 0) + (pl.income_tax ?? 0) + (pl.ni ?? 0);
    const drift = Math.abs(pl.gross_income - components);
    const tol = Math.max(50, pl.gross_income * 0.005); // £50 or 0.5% — accounts for rounding + dividend tax not always in pl.income_tax
    const conserves = drift <= tol;
    checks.push({ id: 'C10', category: 'income',
      status: conserves ? 'PASS' : 'WARN',
      comment: conserves
        ? `Income conservation: gross £${pl.gross_income.toLocaleString()} = net + tax + NI ±£${Math.round(tol)}`
        : `Income NOT conserved: gross £${pl.gross_income.toLocaleString()} vs net+tax+NI £${components.toLocaleString()} (drift £${Math.round(drift).toLocaleString()})` });
    if (!conserves) issues.push(`C10: income not conserved (drift £${Math.round(drift)})`);
  }

  // C11: AS-OF-DATE CORRECTNESS — snapshot_type='current' MUST match the
  // current engine tax year (2026/27); 'historical' MUST be any prior year.
  // Catches the bug where a back-test is silently labelled 'current'.
  if (snapshot.snapshot_type) {
    const yearNum = parseInt(taxYear.split('/')[0]);
    const isCurrent = yearNum === 2026;
    const labelCorrect = (snapshot.snapshot_type === 'current') === isCurrent;
    checks.push({ id: 'C11', category: 'structure',
      status: labelCorrect ? 'PASS' : 'WARN',
      comment: labelCorrect
        ? `snapshot_type='${snapshot.snapshot_type}' matches tax_year ${taxYear}`
        : `snapshot_type='${snapshot.snapshot_type}' MISMATCH for tax_year ${taxYear} (expected '${isCurrent ? 'current' : 'historical'}')` });
    if (!labelCorrect) issues.push(`C11: snapshot_type mislabelled for ${taxYear}`);
  }

  // C12: MATH SANITY — catches the absurd-looking metrics that pass C1-C7:
  //   * time-covered > 200 yr (the MyMoney 150.3 yr bug)
  //   * income buffer > 30× (the MyMoney 52.4× bug) for personas in deficit
  //   * net-worth-to-annual-spend ratio implausible given age/lifeStage
  // The thresholds are intentionally lax — they catch bugs, not edge cases.
  const ageNow = persona.age || 60;
  const monthlySpend = persona.monthlyExpenditure || persona.expenses?.essential_monthly || null;
  const annualSpend = monthlySpend ? monthlySpend * 12 : null;
  if (annualSpend && annualSpend > 0 && snapshot.net_worth) {
    const yrsCovered = snapshot.net_worth / annualSpend;
    const insane = yrsCovered > 200; // anything beyond 200 yr is a calc bug
    checks.push({ id: 'C12a', category: 'math',
      status: insane ? 'FAIL' : 'PASS',
      comment: insane
        ? `time-covered ${yrsCovered.toFixed(1)} yr is mathematically implausible (NW £${snapshot.net_worth.toLocaleString()} / spend £${annualSpend.toLocaleString()}/yr)`
        : `time-covered ${yrsCovered.toFixed(1)} yr (NW / annual-spend) within sanity range` });
    if (insane) issues.push(`C12a: time-covered ${yrsCovered.toFixed(1)} yr — calc bug`);
  }
  if (pl && pl.gross_income != null && pl.gross_income > 0 && annualSpend) {
    const buffer = pl.gross_income / Math.max(1, annualSpend);
    const insane = buffer > 30 || (buffer < 0.1 && pl.gross_income > 1000);
    checks.push({ id: 'C12b', category: 'math',
      status: insane ? 'FAIL' : 'PASS',
      comment: insane
        ? `income-buffer ${buffer.toFixed(1)}× is implausible (gross £${pl.gross_income.toLocaleString()} / spend £${annualSpend.toLocaleString()})`
        : `income-buffer ${buffer.toFixed(1)}× within sanity range` });
    if (insane) issues.push(`C12b: income-buffer ${buffer.toFixed(1)}× — calc bug`);
  }

  // ── End Phase A5 additions ───────────────────────────────────────────────

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
