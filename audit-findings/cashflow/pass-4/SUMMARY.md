# Cashflow — Pass-4 Audit SUMMARY (post-redesign)
**Date:** 2026-06-04 · **Auditor:** 4 parallel independent slices (structure-chrome · interactivity · dataviz-plainenglish-fca · reconciliation-domain)
**Build:** `src/screens/Cashflow.jsx` (~4661 lines), Bruce demo=a + Mr T demo=mrt-core
**Method:** six assertions (A1 identified · A2 drillable · A3 dest correct · A4 dest coherent · A5 plain-English · A6 reconciled)

---

## DEMO-BLOCKING

| ID | Finding | Evidence |
|----|---------|----------|
| P4-01 | **Future / Plan viewMode tabs are dead no-ops** — toggle but content never branches (just a "coming soon" chip). 2 of 4 primary nav modes do nothing. | Cashflow.jsx X28 viewMode branch |
| P4-02 | **SubscriptionTracker "+ Add manually" is a dead button** — only `console.info()`, no route/modal. | SubscriptionTracker |
| P4-03 | **Accumulator (Mr T) has ZERO multi-variable/back-solve surfaces** — the only two bar-meeting surfaces (drawdown, methods) gate on `decSolve.rankedPaths`, so an accumulator sees none. | CashflowTrajectoryTiles gating |

## HIGH (FUNCTIONAL, fix before "done")

| ID | Finding | Evidence |
|----|---------|----------|
| P4-04 | **All 7 tiles lack the balance-sheet viz grammar** (no sparkline / trajectory / composition) — plain text. `MiniSparkline` exists but was only wired into a drawer, never the tiles. Founder's "no sparklines/trends" confirmed exactly. | QuestionTile Cashflow.jsx:1932; MiniSparkline:3468 |
| P4-05 | **4 drawers are static reads** (Hero, "Am I OK right now?", "What if markets fall?", "What's it costing?") — no controls at all. | per interactivity audit |
| P4-06 | **"What if markets fall?" has no adjustable stress; GK corridor band is a fabricated hardcoded ±20%** (`*1.2`/`*0.8`), not engine uncertainty; axes unlabelled. | guytonKlinger render |
| P4-07 | **funded ratio vs FI use different asset bases** — `fundedRatio` reads only flat sipp/isa/investments (no cash, no arrays) and may return INSUFFICIENT for typed-array personas, while `fiRatio` uses `investable()`. IFA-credibility risk. *(Verify: Bruce renders 48%, so confirm which personas actually break.)* | fq-calculator.js:484 vs :169 |
| P4-08 | **SWR regime picker: 4 options, 2 (PRC-anchored, Custom) silently fall back to Bengen** — dead options. | SwrRegimePicker |

## MEDIUM / FUNCTIONAL

| ID | Finding | Evidence |
|----|---------|----------|
| P4-09 | **"What would change it most?" delivers a Wealth-Score goal-seek** — wrong subject for Cashflow (founder already flagged the "paths to Wealth Score 85 / gap 15" framing as confusing). | GoalSeekCard |
| P4-10 | **Hero "pots £65k" is a display reconstruction** (`target − grossSecure`), not the solver's net `floor.residualNeed` — ties cosmetically but isn't the engine value. | Cashflow.jsx:1625-1629 vs solver:582 |
| P4-11 | **Per-method "lasts to age X" is constant-return / sequence-blind** — reads as a guarantee with no inline caveat (MC fan is separate). | withdrawal-methods.js:6-7 |
| P4-12 | **BillCalendar + CashflowCalendarHeatmap orphaned dead code** (defined, never rendered) while spec §2.1 still lists bill calendar. | Cashflow.jsx |
| P4-13 | **Missing tiles** vs spec §1.7 + real tools: income timeline ("when things change"), tax-over-time, expense categories. | — |
| P4-14 | **funded gauge has no back-solve** ("what reaches 1.0×?"); single-variable regime picker only. | FundedRatioGaugeV2 |

## POLISH

| ID | Finding | Evidence |
|----|---------|----------|
| P4-15 | Borderline FCA: method "#1 / fits your priority" edges toward steering (carries disclaimer). | MethodsComparison |
| P4-16 | Unexplained-in-place jargon: funded ratio, sequence-of-returns, Guyton-Klinger/guardrail, SWR, Bengen/Morningstar/Vanguard, "vol". | multiple |

## Confirmed FIXED / strong (not regressions)
- Home −£391 vs Cashflow £0 surplus bug **reconciled** — one `cashflowFlow` source across NOW-tile · Sankey · waterfall · Home.
- No hardcoded headline numbers (prior £78k/£29k fallbacks removed).
- Methods per-method drawer (drawer-rows + 3 sliders + back-solve) and drawdown drawer **meet the multi-variable + back-solve bar**.
- PoS chart + money-flow Sankey correctly built/labelled; FCA disclaimers pervasive; no chart implies infinite growth.

## Needs live DOM verification (preview_eval)
- P4-07 fundedRatio INSUFFICIENT for typed-array personas (Bruce renders 48% — confirm scope).
- Method back-solve thumb liveness (already manually verified £73k→£220k; re-confirm no snap-back).
