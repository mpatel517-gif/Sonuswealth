# Risk Screen — Stage B Pass-1 SUMMARY
**Date:** 2026-05-18 | **Coverage:** 100%

## Counts

| Severity | Count |
|----------|-------|
| DEMO-BLOCKING | 12 |
| FUNCTIONAL | ~28 |
| POLISH | ~14 |

## All DEMO-BLOCKING findings

| # | Element ID | Finding | File:line |
|---|-----------|---------|-----------|
| DB-1 | RK-Z10-D3a..c/D6a..c | `onAddProtection` not passed to `<RiskBody>` — all 6 universal-add tiles dead | Risk.jsx:1633–1638 |
| DB-2 | RK-Z12-N1 | "Start a protection plan →" navigates to tab `'plan'` which no longer exists (migrated to `'timeline'`). Dashboard has no `sonus:navigate` listener. Dead no-op. | Risk.jsx:1148–1163 |
| DB-3 | RiskOverlay `<RiskBody>` | Overlay passes only `entity` — drops `onDrillMetric`, `onCommit`, `onAddProtection`, `suppressPrimaryRing`. Every drill/add/commit action silently fails in overlay. | RiskOverlay.jsx:157 |
| DB-4 | RK-ANCH-01/OVL-03/H-ANCH-03 | Risk Score format drift: full-page = bare `78`, overlay header = `78/100`, Home = `78/100`. Same engine fn, three formats. | Risk.jsx:160–163; RiskOverlay.jsx:80–86 |
| DB-5 | RK-ANCH-05/OVL-04/H-ANCH-02 | Wealth Score labelled "Health score" on Risk full-page. "Wealth" on overlay. "Wealth Score" on Home. FD-NAME-1 violation. | Risk.jsx:1535 |
| DB-6 | RK-ANCH-01c/05 | Three labels for two metrics: "Safety score · primary" + "Risk Score" + "Health score". Neither "Safety score" nor "Health score" is in brand.js. FD-NAME-1 violation. | Risk.jsx:1513, 172, 1535 |
| DB-7 | RK-Z5-01..05 | All 5 shock cards are single-snapshot point estimates — no month-by-month trajectory, no drawdown survival path. FD-CROSS-1 names Risk as owning drawdown survival under sequence risk. | risk-engine.js:31–139 |
| DB-8 | RK-Z5-01..05 | Each shock dead-ends at description + AskChip. FD-CROSS-1 requires handoff to owning surface. No such button on any shock card. | Risk.jsx:891–898 |
| DB-9 | RK-Z11-01 | Five mitigation rows per shock. Zero `onClick` handlers. FD-CROSS-1 requires handoff to owning surface. Read-only describe-only. | Risk.jsx:1063–1084 |
| DB-10 | Z5 + Z11 | No inline FCA boundary on any shock card or mitigation. Pound figures + action prescriptions without "estimate · not advice" framing. | Risk.jsx:858–901, 1055–1093 |
| DB-11 | RK-Z7-banner | `lifeEventPaths` stub returns `[]` for all personas — Z7 banner permanently absent. Entire documented feature dead. | fq-calculator.js:1812–1815 |
| DB-12 | RK-Z4 ProtectionGap | Protection Gap card shows £ gap with zero `onClick` — no path from "you have a gap" to action. | ProtectionGap.jsx (entire file) |

## Top 3 fix priorities

**P1 — Wire `onAddProtection` + `sonus:navigate` listener (fixes DB-1, DB-2, DB-3)**
- `Risk.jsx:1633–1638` → add `onAddProtection={onAddProtection}` to `<RiskBody>`
- `RiskOverlay.jsx:157` → thread all 4 missing props
- `Dashboard.jsx` → add `sonus:navigate` listener; pass `onAddProtection` down

**P2 — Score name + format consistency (fixes DB-4, DB-5, DB-6)**
- `Risk.jsx:1513` → "Safety score · primary" → "Risk Score"
- `Risk.jsx:1535` → `label="Health score"` → `label="Wealth Score"`
- `Risk.jsx:153–173` → add `/100` format parity
- `RiskOverlay.jsx:157` → `suppressPrimaryRing={true}`

**P3 — Inline FCA boundary + shock action handoffs (fixes DB-8, DB-10)**
Each shock card needs: (a) "est · not advice" inline chip, (b) button routing to owning surface — job_loss/market_fall/illness → MyMoney; rate_rise → Cashflow; death → T&E
