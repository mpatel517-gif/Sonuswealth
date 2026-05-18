# Timeline — Scenario Auditor — Pass 1

**Screen:** Timeline (`src/screens/Timeline.jsx` · 2512 lines)
**Scope:** §E Scenarios & Plans · §B Score Journey (ScoreHistoryDrillPanel) · §F.1 Plan-Funded Headline · GoalSeekSheet · MilestoneDrillPanel
**Auditor:** scenario-auditor (5 of 5)
**Method:** seven scenario assertions (present · expandable · multi-option · actionable · finances-bound · time-projected · FCA-framed)
**Date:** 2026-05-18

---

## Verdict table

| ID | Time-projected | Actionable | Engine-bound | Severity | Finding | Evidence |
|----|---------------|------------|--------------|----------|---------|----------|
| TL-OVL-01e (commitGoalSeekPath plan-type mismatch) | N/A (commit, not scenario) | FAIL | FAIL | **DEMO-BLOCKING** | Hardcoded `type: seekTarget.metric === 'wealthScore' ? 'retirement' : 'custom'` — every metric except `wealthScore` commits a `custom` plan. Picking `estate` / `debt` / `gift` / `protection` / `tax` / `retirement` / `cashflow` / `custom` in TL-OVL-01a writes plan-type `custom`, which `planFor()` aliases back to `retirement` (`PLAN_TYPE_ALIASES`). The 8 PlanRows in §E will never reflect a committed typed plan. Demo break: founder selects "Estate plan" target 1m → commits → PlanRow `estate` still reads "Not set". | `Timeline.jsx:1470–1481` (`commitGoalSeekPath` envelope); `fq-calculator.js:1463` (`PLAN_TYPE_ALIASES`) |
| TL-OVL-01a + engine `goalSeek` (metric space mismatch) | FAIL | FAIL | FAIL | **DEMO-BLOCKING** | `<select>` lists 12 options but `goalSeek` engine only handles 4 (`wealthScore` / `riskScore` / `netWorth` / `iht`). All 8 plan-type options fall into `default: achieves = sim.scoreDelta` — they return a raw score delta as "achieves" with no relationship to the target value the user entered. "Retirement plan target=65" computes a path where the result reads `achieves: <some scoreDelta>` against `gap: |65 - scoreDelta|`. Nonsense for the user. The 8 extra options are dead UI. | `Timeline.jsx:1500–1520` (12-option select); `fq-calculator.js:1779–1785` (4-metric switch with `default: achieves = sim.scoreDelta`) |
| TL-OVL-01b (target input — no unit, no validation) | FAIL | PARTIAL | N/A | FUNCTIONAL | `<input type=number>` reuses the same field for "wealth score (0–100)", "net worth (£)", "IHT exposure (£)", and "age 65". No placeholder, no unit hint, no metric-specific range. Default value `80` is silently a wealth-score number. Switching to `netWorth` → "Find paths" runs against `targetValue=80` literal pence/pounds, returning whatever gap the engine computes against £80. Bound to current finances only via the engine call; the user cannot tell that 80 ≠ 80,000 ≠ age 80. | `Timeline.jsx:1521–1531` |
| TL-OVL-01 (no FCA framing inside sheet) | N/A | N/A | N/A | FUNCTIONAL | GoalSeekSheet body has no "estimate · not financial advice" line. The result rows ("achieves N · gap M") look like deterministic answers. The screen-level disclaimer at bottom (`Timeline.jsx:2500–2507`) is below the fold while the sheet is open and is the wrong scope (page-level, not scenario-level). Assertion 7 (FCA framing per scenario result) fails. | `Timeline.jsx:1483–1601` (full GoalSeekSheet — no disclaimer text inside the sheet) |
| TL-OVL-01d (result rows — no time path) | **FAIL** | N/A | PASS | FUNCTIONAL | Scenario assertion 6 requires "projects the user's position *across that horizon* — the path from today to the target — not a single static snapshot." `goalSeek` is called with `'12mo'` window but the returned `paths` carry only `{action, achieves, gap}` — one number. The result rows ("drawdown · £X — achieves N · gap M") are static end-state snapshots, no per-period trajectory, no per-year projection chart. For a 12mo window this is borderline acceptable; for the `'retirement'` option that the founder may interpret as "by retirement age", showing only a static `achieves` is a horizon-blind FAIL. | `Timeline.jsx:1546–1577` (result rendering); `fq-calculator.js:1766–1799` (engine returns single `achieves` / `gap` per path) |
| TL-PLN-12 (saved scenarios — no "View all") | N/A | FAIL | N/A | FUNCTIONAL | §E renders `scenarios.slice(0, 4)` with no "View all (N)" affordance. If `entity.scenarios.length > 4`, the remainder are invisible. Grep across `Timeline.jsx`: zero matches for `View all` / `See all`. Inventory seed TL-S-06 confirmed. Per audit brief: "Scenarios must show >5 with 'View all'." | `Timeline.jsx:1420` (`scenarios.slice(0, 4)`); `Timeline.jsx:1438` (close of map — no overflow CTA) |
| TL-SJ-04 ↔ TL-OVL-02c (range picker inconsistency + cosmetic) | PASS (per-range data is engine) | FAIL | PASS | FUNCTIONAL | §B SectionB exposes 4 ranges (`1mo/3mo/6mo/12mo`); ScoreHistoryDrillPanel exposes 5 (incl. `all-time`). Worse: drill-panel's `activeRange` is local state only — sparklines render `wPts = hist?.points` from parent-passed `scoreJourneyData`. Tapping `1m` / `3m` / `6m` / `All` in the drill changes the active-chip styling but does NOT refetch `calcScoreHistory(entity, range)`. The chart is the same `12mo` series (or whatever was in `rangeOverride`). Drillable element with dead handler = A2 FAIL per inventory taxonomy. | `Timeline.jsx:1879–1893` (local `activeRange`); `Timeline.jsx:1972–1983` (range picker only sets `activeRange`); `Timeline.jsx:1986–2014` (sparklines use parent `wPts`/`rPts`, not refiltered by `activeRange`) |
| TL-OVL-02f (8-dimension breakdown — hardcoded label) | N/A | N/A | FAIL | POLISH | Eyebrow string `"8 dimensions — weakest first"` is hardcoded. `dims` comes from `fq?.dims` which per Risk v1.6 returns 7. If `dims.length === 7`, copy lies; if 8, copy matches by coincidence. Engine-bound label would be `${dims.length} dimensions — weakest first`. | `Timeline.jsx:2022–2023` |
| TL-OVL-03e (MilestoneDrillPanel — no ACTION CTA) | N/A | **FAIL** | N/A | FUNCTIONAL | "What would push this forward?" hint card is descriptive paragraph only. Generic copy ("Use Goal Seek to model specific scenarios") references the GoalSeek sheet but there is no button to open it. Drill is read-only. Per founder rule (inventory §"Drill destination taxonomy"): drillable element must resolve to SOURCE / ACTION / DECISION. This drill resolves to neither ACTION nor DECISION — describe-only. Spec may intend read-only (FD-CROSS-1 reads MilestoneDrillPanel as detail surface, not action), but the hint copy *invites* an action and provides no way to take it. Self-contradicting. | `Timeline.jsx:2202–2210` (hint card); `Timeline.jsx:2099–2103` (hint text mentioning Goal Seek with no CTA wired) |
| TL-PFH-07 (headline → Goal Seek wiring) | N/A | PASS (sheet opens) | FAIL | FUNCTIONAL | "Review · adjust this plan →" calls `onOpenGoalSeek?.(headline.pt.id)`. For retirement headline, metric becomes `'retirement'` — falls into the broken engine path (see TL-OVL-01a). User taps headline CTA, picks no new target, taps "Find paths" → results carry meaningless `achieves`/`gap` against the input value treated as a raw target. Same root cause as TL-OVL-01a; surfaced separately because this is the *default* CTA on the §F.1 hero card. | `Timeline.jsx:1334–1346`; chain into `Timeline.jsx:1463` (`goalSeek(entity, 'retirement', +value, '12mo', …)`) |
| TL-OVL-01g + sheet-overlay (close affordance) | N/A | PASS | N/A | PASS | Backdrop click + Close button both reset `setSeekResults(null)` and call `onClose`. Coherent. | `Timeline.jsx:1485` (backdrop), `Timeline.jsx:1590–1598` (Close) |
| TL-PLN-11b (saved scenario TrackingPill) | N/A | N/A | PASS | PASS | `TrackingPill fundedPct={sc.deltaResults.fundedRatio}` — bound to per-scenario `fundedRatio` written by whichever surface saved the scenario. Reads engine-driven percentage. | `Timeline.jsx:1429–1435` |
| TL-OVL-01f (no-paths empty state) | N/A | N/A | N/A | PASS | "No paths found within constraints — try a less aggressive target." — plain English, points to a corrective action. Acceptable. | `Timeline.jsx:1581–1588` |
| TL-OVL-01c (Find paths run) | PARTIAL | PASS | PASS | PARTIAL | Calls `goalSeek(entity, metric, +value, '12mo', { maxAction: 200000 })` — engine-bound, finances-bound (uses entity), windowed to 12mo. Time-projected only insofar as engine returns a 12mo-bounded answer; no per-period path in the output (see TL-OVL-01d). | `Timeline.jsx:1461–1468` |

---

## Per-scenario detail

### GoalSeekSheet (TL-OVL-01 family) — the single biggest scenario surface on Timeline

- **Options count:** 12 in the select, 4 actually wired in the engine.
- **Actionable:** the "Commit this path" CTA fires `commitPlan` correctly — but the envelope it builds is wrong (`type: 'custom'` for 8 of 12 metrics).
- **Finances-bound:** YES — `goalSeek(entity, …)` reads the persona for 4 supported metrics. NO for the 8 plan-type options (they return `sim.scoreDelta`, a delta not a position).
- **Time-projected:** NO. The 12mo window is hardcoded; the result is a single `achieves` figure per path. No per-period trajectory shown to the user.
- **FCA framing:** NO inside the sheet. Screen-level disclaimer only.

### ScoreHistoryDrillPanel range picker (TL-OVL-02c) — cosmetic-only what-if

- The drill panel offers a range picker (`1m/3m/6m/12m/All`) but it does not re-fetch data. `setActiveRange('all-time')` only changes the active-chip styling. Sparklines stay locked to the parent-passed `hist.points`. This is a what-if affordance that pretends to project but doesn't.

### MilestoneDrillPanel (TL-OVL-03e) — describe-only

- "What would push this forward?" is a single paragraph. The copy says "Use Goal Seek to model specific scenarios" but no Goal Seek CTA is wired into the drill. The user reaches a dead-end suggestion.

### Saved Scenarios list (TL-PLN-12) — capped at 4

- `scenarios.slice(0, 4)` with no "View all (N)" CTA. Audit brief explicitly required this: "Scenarios must show >5 with 'View all'."

---

## Coverage line

**Scenario rows checked: 13 of 13 scenario-bearing elements** (GoalSeekSheet 7 sub-elements · ScoreHistoryDrillPanel range picker · MilestoneDrillPanel forward-hint · §E saved-scenario list slice · §F.1 headline goal-seek CTA · PFH empty-state CTA · PlanRow Edit CTA).

**Verdict mix:** 3 PASS · 1 PARTIAL · 9 FAIL.
**Severity mix:** 2 DEMO-BLOCKING · 6 FUNCTIONAL · 1 POLISH · (3 PASS, 1 PARTIAL not counted).

---

## Return string

TL scenario: 3 PASS, 9 FAIL (2 DB, 6 F, 1 P).
