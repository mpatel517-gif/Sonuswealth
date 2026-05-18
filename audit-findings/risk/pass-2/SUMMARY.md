# Risk — Stage B Pass-2 SUMMARY
**Date:** 2026-05-18

## DB fixes verification
| # | Finding | Status | Evidence |
|---|---------|--------|---------|
| DB-1 | `onAddProtection` threading to RiskBody | FIXED | Risk.jsx:1412,1475,1714,1523 |
| DB-2 | "Start protection plan" → tab 'plan' | FIXED | Dead nav removed; no 'plan' tab reference remains |
| DB-3 | RiskOverlay dropped 4 props | PARTIAL → FIXED | 4 props added in Wave 4; `onNav` missed → fixed in pass-2 (RiskOverlay.jsx:24,162) |
| DB-4 | Risk Score format drift | FIXED | Risk.jsx:161–162 ring renders `/100` suffix |
| DB-5 | Wealth Score labelled "Health score" | FIXED | RiskPrimaryAnchor:1612 `label="Wealth Score"` |
| DB-6 | Three labels for two metrics | FIXED | Only "Risk Score" (SVG :173) and "Wealth Score" (:1612) remain |
| DB-7 | Shock cards single-snapshot | DEFERRED | Point-in-time deltas correct; trajectory engine deferred |
| DB-8 | Shock card no handoff button | FIXED | SHOCK_HANDOFF map :852; onClick wired :925 |
| DB-9 | Mitigation rows zero onClick | FIXED | mitigationRoute() :1065; onClick wired :1131 |
| DB-10 | No FCA boundary on shock/mitigations | PARTIAL | Shock cards: "est · not advice" pill :897 FIXED. Mitigation rows: still missing — see N-1 |
| DB-11 | `lifeEventPaths` stub returned [] | FIXED | fq-calculator.js:1838–1894 full implementation |
| DB-12 | ProtectionGap zero onClick | FIXED | ProtectionGap.jsx:29–37 `sw-press` + onAction |

## Regressions found
- **R-1 (FIXED in pass-2):** `onNav` was not threaded through RiskOverlay → RiskBody. All shock handoff buttons + mitigation nav were silent no-ops in overlay context. Fixed: RiskOverlay.jsx:24 + :162.

## New findings
- **N-1 (MEDIUM/FCA):** Mitigation rows (Risk.jsx:1119–1172) recommend specific actions (pension top-up, life insurance, emergency fund) with zero FCA "est · not advice" tag. Shock cards have the tag at :897. Parity needed.
- **N-2 (LOW):** SHOCK_HANDOFF['illness'] label says "Review protection 🛡️" but handleAct calls `onAddProtection?.('life-cover')` — label implies navigation, action opens UniversalAdd sheet. Minor ambiguity.

## Verdict
**NEEDS-WORK — 1 item:** N-1 (FCA tag on mitigation rows). R-1 fixed inline. DB-10 partial resolved to N-1.
