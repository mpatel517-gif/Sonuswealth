# Scenario Audit · Reports · Pass 1
**Date:** 2026-05-18
**Auditor:** Scenario
**Source:** `src/screens/Reports.jsx` (201 lines)

---

## Scope

Audit any scenario/comparison features in Reports screen — period comparisons, what-if in reports, scenario matrix, stress scenarios.

---

## Finding: NA

Reports.jsx contains **no scenario or comparison features** in the current stub.

Specific checks:
- Period comparison (e.g. "Tax year 2025/26 vs 2024/25"): Not present. Period selector exists (`PERIOD_OPTIONS`) but is a single-period picker, not a comparison tool.
- What-if in reports: Not present. No what-if, scenario, or stress variant rows in REPORT_TYPES or JSX.
- Scenario matrix: Not present.
- Cashflow stress scenarios: Body copy for Cashflow tile mentions "stress scenarios" (line 40) but no scenario picker, no multi-scenario comparison — descriptive copy only.

---

## Phase 2 concerns

The Cashflow projection tile body promises "plus stress scenarios" (line 40). When Phase 2 wires:
- Stress scenario selection must be a distinct layout per FD-CROSS-1 (not a generic list)
- Stress scenario figures must trace to `cashflowHealth` / `trajectoryData` engine functions
- Scenario outputs must reconcile with Cashflow screen's scenario matrix values

These are Phase 2 pre-ship gates, not current defects.

---

## Verdict

**NA — no scenario/comparison features present in stub phase.**
Phase 2 "stress scenarios" promise in Cashflow tile body is descriptive copy; no implementation path yet.
