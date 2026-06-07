// ─────────────────────────────────────────────────────────────────────────────
// debtMath — BACK-COMPAT RE-EXPORT.
//
// The canonical amortisation model moved to the engine layer on 2026-06-07
// (src/engine/modules/debt-amortise.js) so the engine — not a component — owns
// the single source of debt truth used by Timeline's forecast, MyMoney's hero
// strip, and the Decision Engine. This file re-exports it unchanged so the
// existing component imports (DebtLeaf · DebtDecisions · LiabilitiesDrillDown ·
// MyMoney hero) keep working without churn.
//
// New code should import from '../../engine/modules/debt-amortise.js'.
// ─────────────────────────────────────────────────────────────────────────────

export {
  amortise,
  payoffLabel,
  clearsYear,
  enumerateDebts,
  liabilitiesAtHorizon,
} from '../../engine/modules/debt-amortise.js'
