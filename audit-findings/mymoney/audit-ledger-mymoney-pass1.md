# Audit Ledger — MyMoney pass-1
**Date:** 2026-05-18
**Pass:** 1 of N (stopping rule: 2 consecutive clean passes at 100% coverage)
**Auditors run:** conformance · interaction · reconciliation · domain · scenario
**Source files:** `audit-findings/mymoney/pass-1/*.md`

---

## Coverage

| Auditor | Rows checked | Total rows | Coverage |
|---------|-------------|-----------|---------|
| Conformance (A1) | 150 | 150 | 100% |
| Interaction (A2/A3/A4) | ~130 | ~150 | 87% |
| Reconciliation (A6) | 62 numeric | 62 numeric | 100% |
| Domain (A5) | all financial rows | all financial rows | 100% |
| Scenario | 12 scenario surfaces | 12 scenario surfaces | 100% |

**Overall coverage: ~95%.** Gap: interaction auditor did not reach all rows due to PivotView components in separate file. Re-dispatch for MM-BS-07/MM-BS-08 interaction rows in pass-2 after fixes.

---

## DEMO-BLOCKING findings (must fix before May 31)

| # | Element ID | Finding | File:line | Auditor |
|---|-----------|---------|-----------|---------|
| DB-01 | MM-BS-06 | Cash tile tap silently inert — `onView` switch has no `'cash'` case | MyMoney.jsx:3187 | conformance + interaction |
| DB-02 | MM-BS-08 | Income tile tap silently inert — no case in `onView` switch | MyMoney.jsx:3187 | interaction |
| DB-03 | MM-BS-09 | Alternatives tile silently inert — no case in `onView` switch | MyMoney.jsx:3187 | conformance + interaction |
| DB-04 | MM-BS-10 | Obligations tile silently inert — no case in `onView` switch | MyMoney.jsx:3187 | conformance + interaction |
| DB-05 | MM-PRI-01..05 | All 5 Priority cards expand to `t.action` string only — no `onNav`, no `setDrillPension`, no `openBucket`. Classic describe-only A4 fail — "Act now" card with nowhere to act | MyMoney.jsx:2354 | interaction |
| DB-06 | MM-COI-02 | Top-4 CoI rows are bare `<div>` with no `onClick` — pension action that routes to `PensionDrillDown` on Home is dead here. FD-CROSS-1 violation. | MyMoney.jsx:2891–2908 | interaction + scenario |
| DB-07 | MM-DEC-06 | "Set up your drawdown plan →" is a `<span>` with zero `onClick` | MyMoney.jsx:2393 | conformance + interaction + scenario |
| DB-08 | MM-X28-02 | "What if" pill renders with zero content behind it — mode switch changes only animation/badge, no scenario library, no option list. Pre-launch CTA-honesty violation. | MyMoney.jsx (X28 section) | scenario |
| DB-09 | varianceFor | `varianceFor()` only handles `mode2 === 'plan'`; for forecast/scenario modes returns variance=0 → VarianceBadge renders nothing — mode switch is visually inert | fq-calculator.js:1659 | scenario |
| DB-10 | MM-PRI-domain (FAIL-4) | Priority card action bodies contain personal FCA-prohibited recommendations: "Max pension contributions — Highest-return action available." and "Nominate pension…" are directive copy (FCA COBS 9A violation) | MyMoney.jsx:2263, 2271–2272 | domain |
| DB-11 | MM-CLF-02 (FAIL-5) | Cliff-edge copy names a specific amount + specific action: "A £X pension contribution pulls/keeps you below it" without adviser caveat — FCA COBS 9A | MyMoney.jsx:996–997 | domain |
| DB-12 | F-03 | LSA `268275` hardcoded AND used inside a live `Math.min()` computation — directly caps displayed PCLS entitlement with wrong number if legislation changes. `TAX.lsa` is SoT | MyMoney.jsx:2003, 2005 | reconciliation + conformance |

**DEMO-BLOCKING count: 12**

---

## FUNCTIONAL findings (fix before May 31 if time; else triage)

| # | Element ID | Finding | File:line | Auditor |
|---|-----------|---------|-----------|---------|
| F-01 | MM-OVL-03e | AA cap `60000` hardcoded in 5 JSX places — `TAX.pensionAA` from `tax-2026.json` is SoT | MyMoney.jsx:1983, 3012, 3208, 3210, 3344 | conformance + reconciliation |
| F-02 | MM-OVL-03e | MPAA `10000` hardcoded — `TAX.mpaa` is SoT | MyMoney.jsx:1984 | conformance + reconciliation |
| F-03 | MM-OVL-03f | LSDBA `1073100` hardcoded in sub-label — `TAX.lsdba` is SoT | MyMoney.jsx:2005 | conformance + reconciliation |
| F-04 | MM-S-06 | `surplus > 0` instead of `>= 0` causes `−£0` display when cash flow is exactly balanced | MyMoney.jsx:1136 | reconciliation |
| F-05 | MM-COI-01 | CoI per-row sort uses regex extraction of first £ figure from `coiForDomain()` prose — mismatch with Home's `totalCoI().byDomain` numeric values. Most likely cause of £412k vs £340k discrepancy. | MyMoney.jsx:2853–2861 | reconciliation |
| F-06 | MM-SCR-04 | SWR `0.04` hardcoded in DecumulationPanel footer — `TAX.swr` or engine constant is SoT | MyMoney.jsx:1816 area | reconciliation + scenario |
| F-07 | MM-SCR-05 | ISA allowance `20000` in room calculation — `TAX.isaCap` is SoT | MyMoney.jsx (ISA section) | reconciliation |
| F-08 | MM-SCR-06 | Sparklines use `CAT_MONTHLY_DRIFT` constants (e.g. `pensions: 0.0058`), not engine-derived. Personas with identical balances show identical sparklines. | MyMoney.jsx:3126–3153 | reconciliation + domain |
| F-09 | MM-SCR-05 | Per-tile changePct uses portfolio-wide NW delta as proxy for all category cards | MyMoney.jsx | reconciliation |
| F-10 | domain FAIL-1 | CoI aggregates 9 domains, not 12 canonical; `propertyDecisions` hardcoded `0` — systematic under-reporting of cost | fq-calculator.js:1984 | domain |
| F-11 | MM-COI-03 (FAIL-2) | CoI "Cost of waiting" sub-tab label implies pension/wrapper scope only — misleads on what CoI covers | MyMoney.jsx:1467 | domain |
| F-12 | MM-OVL-02 (FAIL-3) | "Estate efficiency 64p/£" — `p/£` unexplained jargon; no ExplainerChip | MyMoney.jsx:2268 | domain |
| F-13 | domain FAIL-7 | Drawdown Efficiency Ratio, PRC/PCC, EBR have live engine formulas in `canonical-metrics.js` — founder-IP sign-off needed before shipping | canonical-metrics.js:155–274 | domain |
| F-14 | MM-OVL-India (FAIL-8) | "India bundle loading — DTAA computations pending" visible to NRI users — placeholder leakage | MyMoney.jsx:3397 | domain |
| F-15 | domain FAIL-9 | Protection copy: "placing the policy in trust fixes it" — advice framing | canonical-metrics.js:323 | domain |
| F-16 | MM-BAN-01/03 | SurplusTile hero and CashFlowSankey have no tap handler — no Cashflow handoff | MyMoney.jsx | interaction |
| F-17 | MM-BND-NCP | 11 dashed "+ X" pills are inert `<span>` — CTA-honesty violation | MyMoney.jsx | interaction |
| F-18 | MM-DEC-04 | Decumulation sequencing pension row has no link to `PensionDrillDown` — FD-CROSS-1 by omission | MyMoney.jsx | interaction |
| F-19 | scenario | DecumulationPanel shows single prescribed order — no scenario comparison, no horizon projection | MyMoney.jsx | scenario |
| F-20 | scenario | 5-method drawdown cards inert — only 4 of 5 reachable as presets in `PensionDrillDown` | MyMoney.jsx | scenario |
| F-21 | scenario | DrawdownMatrix read-only — no "select row → seed schedule" handoff | MyMoney.jsx | scenario |
| F-22 | scenario | X28 future-mode only wires hero NW tile; scores, surplus, sparklines ignore window (MM-S-21) | MyMoney.jsx | scenario |
| F-23 | scenario | Two add-paths conflict: `WrapperCompositionBar "Add details"` → `AssetCaptureSheet` (legacy); FAB + per-tile Add → `AddItemSheet` | MyMoney.jsx | interaction |

**FUNCTIONAL count: 23**

---

## POLISH findings (post-demo backlog)

| # | Element ID | Finding | File:line |
|---|-----------|---------|-----------|
| P-01 | MM-CLF-03 | 60% marker absent on cliff bar — only cliff marker at 100% | MyMoney.jsx:1010 |

---

## UNLISTED elements (in build but not in inventory)

| Element | Status | Recommendation |
|---------|--------|---------------|
| `DrawdownFrameworkPanel` | Defined, not rendered in main screen | DECISION-NEEDED: Wave 7 or dead code? |
| `DrawdownMatrixPanel` | Dead code, never rendered | DECISION-NEEDED: Delete or Wave 7? |
| `IncomeSection` | Superseded by PivotView | Delete confirmed? |
| `TodayMoveCard` | Dead import after 2026-05-15 removal | Delete |

---

## DECISION-NEEDED (founder judgement required, not bugs)

| # | Question |
|---|----------|
| DN-01 | Do PivotView components (Income/CF/Insurance/Bonds views) need a pass-1b audit? They're in `PivotView.jsx` and cover ~30 inventory rows not fully traced. |
| DN-02 | `DrawdownMatrixPanel` — Wave 7+ feature or dead code to delete? |
| DN-03 | Founder-IP: DER, PRC/PCC, EBR have live engine formulas in `canonical-metrics.js`. Ship as-is or hold until sign-off? |
| DN-04 | Synthetic sparklines labelled "estimated" — acceptable pre-launch or remove until real history available? |

---

## Fix priority queue (severity-first)

### Batch 1 — DEMO-BLOCKING (fix immediately)

1. **DB-01–04** — Extend `onView` switch at `MyMoney.jsx:3187` to handle `'cash'`, `'income'`, `'alternatives'`, `'obligations'`
2. **DB-05** — Priority cards: replace `t.action` string expansion with real `onNav`/`openBucket` routing per card type
3. **DB-06** — CoI rows: add `onClick` to `<div>` rows at L2891–2908 → route to `PensionDrillDown` (or correct canonical surface per FD-CROSS-1)
4. **DB-07** — Swap `<span>` at L2393 → `<button onClick={() => setDrillPension(true)}>`
5. **DB-08** — "What if" pill: either wire a real scenario library or remove the pill until Wave 7 (CTA-honesty rule)
6. **DB-09** — Fix `varianceFor()` at `fq-calculator.js:1659` to handle forecast/scenario modes
7. **DB-10** — Reframe priority card copy from directives to options: "Options include: max pension contributions" + adviser caveat
8. **DB-11** — Add adviser caveat to cliff-edge copy: "…a pension contribution may help — verify with an adviser"
9. **DB-12** — Replace `268275` literal with `TAX.lsa` in `Math.min()` at L2003, 2005

### Batch 2 — FUNCTIONAL (fix if time before May 31)

Priority order:
1. F-01/F-02/F-03 (hardcoded AA/MPAA/LSA/LSDBA) — swap literals for `TAX.*` constants
2. F-04 (−£0 bug) — `surplus >= 0`
3. F-05 (CoI sort regex) — use `totalCoI().byDomain` numeric values
4. F-10 (CoI 9 vs 12 domains) — engine fix: add `propertyDecisions` domain
5. F-14 (India placeholder leakage) — gate on data-ready flag or remove
6. F-15 (protection advice framing) — soften to guidance
7. F-12 (estate efficiency jargon) — add ExplainerChip

### Batch 3 — POLISH
- P-01: 60% marker on cliff bar

---

## Summary

| Tier | Count |
|------|-------|
| DEMO-BLOCKING | 12 |
| FUNCTIONAL | 23 |
| POLISH | 1 |
| **Total findings** | **36** |

**Next step:** Fix Batch 1 (DB-01 through DB-12), then re-run Stage B pass-2 for MyMoney. Simultaneously dispatch pass-1 auditors for remaining 9 screens.
