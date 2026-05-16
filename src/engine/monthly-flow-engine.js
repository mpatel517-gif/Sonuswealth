// ─────────────────────────────────────────────────────────────────────────────
// CAELIXA MONTHLY FLOW ENGINE — A3 · s02a
// Pure functions only. No side effects. No global state.
// entity.drawdown is annual. entity.targetIncome is annual spending proxy.
// ─────────────────────────────────────────────────────────────────────────────

// ── PRIVATE HELPERS ──────────────────────────────────────────────────────────

function _spInPayment(entity) {
  const sp = entity.income?.statePension ?? {};
  if (sp.inPayment === true) return true;
  return (entity.age ?? 0) >= (sp.startAge ?? 67);
}

function _monthlyDebt(entity) {
  const liab = entity.liabilities ?? {};
  return (liab.mortgage?.monthlyPayment ?? 0)
    + (liab.otherLoans ?? []).reduce((s, l) => s + (l.monthlyPayment ?? 0), 0);
}

function _cashHeld(entity) {
  const a = entity.assets ?? {};
  return a.cash?.own ?? a.cash?.total ?? 0;
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────

/**
 * Compute monthly cash flow from entity income sources and spending proxy.
 *
 * Income: employment + dividends + rentalIncome + drawdown (annual) + state pension (if in payment).
 * Expenses: entity.expenses.monthly if explicit; else entity.targetIncome / 12.
 *
 * @param {object} entity
 * @returns {{
 *   monthlyIncome: number,
 *   monthlyExpenses: number,
 *   surplus: number,
 *   surplusAnnual: number,
 *   components: { employment: number, dividends: number, rental: number, drawdown: number, statePension: number },
 *   statePensionInPayment: boolean,
 *   allocationPressure: { debtServiceRatio: number, commitRatio: number, liquidMonths: number|null },
 *   confidence: 'HIGH'|'MEDIUM'|'LOW',
 *   rulesVersion: string,
 * }}
 */
export function monthlyFlow(entity) {
  const inc = entity.income ?? {};

  const annualEmployment = inc.employment   ?? 0;
  const annualDividends  = inc.dividends    ?? 0;
  const annualRental     = inc.rentalIncome ?? 0;
  const annualDrawdown   = entity.drawdown  ?? 0;
  const spInPayment      = _spInPayment(entity);
  const annualStateP     = spInPayment ? (inc.statePension?.annual ?? 0) : 0;

  const annualIncome  = annualEmployment + annualDividends + annualRental
                      + annualDrawdown + annualStateP;
  const monthlyIncome = Math.round(annualIncome / 12);

  const monthlyExpenses = entity.expenses?.monthly != null
    ? Math.round(entity.expenses.monthly)
    : Math.round((entity.targetIncome ?? 0) / 12);

  const surplus       = monthlyIncome - monthlyExpenses;
  const surplusAnnual = surplus * 12;

  const debtSvc          = _monthlyDebt(entity);
  const debtServiceRatio = monthlyIncome > 0 ? Math.min(1, debtSvc / monthlyIncome) : 0;
  const commitRatio      = monthlyIncome > 0 ? Math.min(1, monthlyExpenses / monthlyIncome) : 1;
  const cash             = _cashHeld(entity);
  const liquidMonths     = monthlyExpenses > 0 ? Math.round(cash / monthlyExpenses) : null;

  const hasRealIncome   = annualEmployment > 0 || annualDividends > 0
                        || annualDrawdown  > 0 || annualRental    > 0;
  const hasRealExpenses = entity.expenses?.monthly != null;
  const confidence      = hasRealIncome && hasRealExpenses ? 'HIGH'
                        : hasRealIncome                     ? 'MEDIUM'
                        : 'LOW';

  return {
    monthlyIncome,
    monthlyExpenses,
    surplus,
    surplusAnnual,
    components: {
      employment:   Math.round(annualEmployment / 12),
      dividends:    Math.round(annualDividends  / 12),
      rental:       Math.round(annualRental     / 12),
      drawdown:     Math.round(annualDrawdown   / 12),
      statePension: Math.round(annualStateP     / 12),
    },
    statePensionInPayment: spInPayment,
    allocationPressure: {
      debtServiceRatio,
      commitRatio,
      liquidMonths,
    },
    confidence,
    rulesVersion: entity.rulesVersion ?? 'UK-2026.1',
  };
}

/**
 * Convenience wrapper returning only the allocationPressure block.
 * @param {object} entity
 * @returns {{ debtServiceRatio: number, commitRatio: number, liquidMonths: number|null }}
 */
export function allocationPressure(entity) {
  return monthlyFlow(entity).allocationPressure;
}
