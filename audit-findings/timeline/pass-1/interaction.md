# Timeline — Pass 1 — Interaction & Drill-Down Audit (A2/A3/A4)

**Auditor:** interaction-auditor
**Screen:** Timeline (`src/screens/Timeline.jsx`)
**Date:** 2026-05-18
**Method:** A2/A3/A4 walk against `timeline-inventory-v1.md`. Every interactive element traced through the React handler chain into router calls / panel mounts / event helpers. No source modified.

`A2` = real handler / does interaction fire? · `A3` = lands on the surface that owns the subject? · `A4` = landing is a coherent SOURCE / ACTION / DECISION (not describe-only, not dead-end)?

---

## §1 Verdict table

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|----|----|----|----|----------|---------|----------|
| TL-X28-01 | PASS | PASS | PASS | — | Window picker drives `windowId` state which feeds `windowToHistoryRange()` (§B range) + `horizonMonths` (§C). Wires real. | Timeline.jsx:2235, 2273, 2455, 865-876 |
| TL-X28-02 | PASS | PASS | PASS | — | viewMode toggle drives §B `planActive`/banner; SectionB receives viewMode and re-keys `sw-tab-slide`. | Timeline.jsx:2236, 2330-2337, 444, 448 |
| TL-X28-03 | PASS | NA | NA | — | DATA only — `TAX.ver` shown in top-bar; not drillable by contract (DATA row, owns-subject = SOURCE only relevant to chrome). | Timeline.jsx:2335 |
| TL-X28-04 | PASS | NA | NA | POLISH | Data-date label falls back to literal `'UK-2026.1'` (rules-bundle string) when `entity.dataLastUpdated` missing — that fallback is **wrong domain** (data-freshness label showing rules version). Cosmetic but misleading. | Timeline.jsx:2336 |
| TL-ANCH-01 | PASS | PASS | PASS | — | `onDrillMetric('netWorth')` → Dashboard `pushDetail('netWorth')` opens driver-tree overlay. | Timeline.jsx:2349; Dashboard.jsx:304, 505 |
| TL-ANCH-02 | PASS | PASS | PASS | — | `onDrillMetric('wealthScore')` → `pushDetail` overlay. | Timeline.jsx:2350; Dashboard.jsx:304 |
| TL-ANCH-02a | NA | NA | NA | — | Display sub-label only. |  |
| TL-ANCH-03 | PASS | PASS | PASS | — | `onDrillMetric('riskScore')` if present, else `handleRiskTap()` → `onNav('risk')`. Both routes own-subject correct. | Timeline.jsx:2351, 2307-2309 |
| TL-ANCH-03a | NA | NA | NA | — |  |  |
| TL-SUB-01 | FAIL | NA | NA | POLISH | Sub-anchor row renders "—" + "Coming next". No `sw-press`, no `sw-lift`, no `onClick` — passes FD-CTA-1 honesty test (not deceptively interactive). Verdict is PASS for honesty, FAIL on A2 only because the inventory row marks it DATA-with-SOURCE-destination and the source doesn't exist yet. Acceptable as stub. | Timeline.jsx:2374-2384 |
| TL-PURP-01 | NA | NA | NA | — | Orientation copy. | Timeline.jsx:2387-2395 |
| TL-PURP-02 | NA | NA | NA | — |  |  |
| TL-PFH-00 | NA | NA | NA | — | Empty-state DATA — no interaction. | Timeline.jsx:1224-1259 |
| TL-PFH-00a | PASS | PASS | PASS | — | "Set your first plan →" → `onOpenGoalSeek()` → `openGoalSeek(undefined)` → opens GoalSeekSheet (DECISION). | Timeline.jsx:1245-1256, 2253-2256 |
| TL-PFH-01..06 | NA | NA | NA | — | DATA / status display rows. |  |
| TL-PFH-07 | PASS | PASS | PASS | — | "Review · adjust this plan →" → `onOpenGoalSeek(headline.pt.id)` → DECISION. | Timeline.jsx:1334-1345 |
| TL-PFH-08 | NA | NA | NA | — | FCA caption. |  |
| TL-LS-HEAD | NA | NA | NA | — | Sticky landmark, no handler. | Timeline.jsx:161 |
| TL-LS-01..07 | NA | NA | NA | — | All DATA. Note inventory marks TL-LS-01 with "SOURCE — stage rule detail" as expected destination, but the build does **not** make the stage name tappable. See §3 finding F-INT-01. | Timeline.jsx:285-373 |
| TL-SJ-HEAD | NA | NA | NA | — | Sticky landmark. |  |
| TL-SJ-SKEL | NA | NA | NA | — | DATA. |  |
| TL-SJ-ERR | NA | NA | NA | FUNCTIONAL | Copy says "try refreshing" but there is no refresh control wired. The user reads an instruction that the UI does not support. (A5 territory but interaction-relevant — no handler exists for the implied action.) | Timeline.jsx:431 |
| TL-SJ-00 / 00a | PASS | PASS | PASS | — | ExplainerChip id="TL-1" resolves to entry in `Explainer.jsx:177` → bottom sheet (SOURCE — methodology). | Timeline.jsx:457; Explainer.jsx:177 |
| TL-SJ-01..04 | PASS | PASS | **FAIL** | FUNCTIONAL | Range-picker (1mo/3mo/6mo/12mo) sets `rangeOverride` which re-fetches `calcScoreHistory(entity, range)` — handler is real, lands on §B itself (own subject). **BUT** the inventory's TL-S-05 inconsistency is confirmed: ScoreHistoryDrillPanel (TL-OVL-02c) exposes 5 ranges including `all-time`, and §B exposes only 4. Picking `lifetime` in X28 top-bar resolves via `windowToHistoryRange` to `'all-time'` but no `all-time` pill exists in §B to show that state — the active pill state silently fails to match. A4 fail: range UI lies about what's selected when X28=lifetime. | Timeline.jsx:148-153, 468-481, 84, 1881-1887 |
| TL-SJ-05..06b | NA | NA | NA | — | DATA. Reconciles to TL-ANCH-02/03 (reconciliation auditor will confirm). |  |
| TL-SJ-07/07a/07b | NA | NA | NA | — | DATA bars. The inventory marks "SOURCE — action-level detail" expected for TL-SJ-07 but the bars carry no `onClick`. See F-INT-02 (action-level bars are not drillable). | Timeline.jsx:514-535 |
| TL-SJ-08/08a/09/09a | NA | NA | NA | — | DATA labels. |  |
| TL-SJ-08b / 09b | NA | NA | NA | POLISH | Sparklines render but are not themselves tappable; the section-level "Detail ›" chip (TL-SJ-15) provides the drill. Acceptable. | Timeline.jsx:393-405, 2432-2445 |
| TL-SJ-10 | NA | NA | NA | — | Banner DATA. |  |
| TL-SJ-11 | PASS | PASS | PASS | — | "Switch to Plan view" button → `onViewModeChange('plan')` → setViewMode. Real ACTION on own surface. | Timeline.jsx:585-595, 2427 |
| TL-SJ-12 | NA | NA | NA | POLISH | "Set a plan in §E to enable…" — referenced as A5 by inventory TL-S-13. No CTA here; user must scroll to §E. Not strictly an interaction failure, but the copy describes an action without offering it inline. Recommend inline "Set a plan" button. | Timeline.jsx:596-604 |
| TL-SJ-13 | NA | NA | NA | — | Honesty disclosure. |  |
| TL-SJ-14 | NA | NA | NA | — | CausalityStripe SOURCE display. |  |
| TL-SJ-15 | PASS | PASS | PASS | — | "Detail ›" → `setDrillView('scoreHistory')` → ScoreHistoryDrillPanel renders (SOURCE). | Timeline.jsx:2432-2445, 2312-2318 |
| TL-CAL-HEAD | NA | NA | NA | — |  |  |
| TL-CAL-00 | NA | NA | NA | — | Horizon meta DATA. |  |
| TL-CAL-01/02/03 | PASS | PASS | PASS | — | Category chips toggle local `catFilter` state; filter applies in `sorted`. Real handler, own subject (the calendar). | Timeline.jsx:910-925, 882 |
| TL-CAL-EMPTY | NA | NA | **FAIL** | FUNCTIONAL | Empty-state copy ("No calendar entries…") has **no CTA** — no "Show longer horizon" / "Reset filters" / "Add a date". This is a dead-end empty state. Per founder rule (inventory TL-S-07 + screen-audit skill: empty state without ACTION = flagged anti-pattern). | Timeline.jsx:927-933 |
| TL-CAL-04..11 | NA | NA | **FAIL** | DEMO-BLOCKING | None of the calendar rows are tappable. `CalendarEntryRow` renders as a static `<div>` with no `onClick`, no `sw-press` class, no role=button. Inventory marks every TL-CAL-04..11 row with an "owns-subject destination" (T&E CoI projection, My Money ISA, T&E SA detail, Cashflow state-pension, My Money APQ, etc.) — none reachable. The single biggest "drill to source/action" promise of FD-CROSS-1 (Timeline owns *the when* and drills to *its own* angle / own-subject surface) is **violated for the entire calendar section**. | Timeline.jsx:799-860, 935-940 |
| TL-CAL-99 / 99a / 99b | NA | NA | NA | — | Per-row chips and CausalityStripe; display only. |  |
| TL-DL-HEAD | NA | NA | NA | — |  |  |
| TL-DL-EMPTY | NA | NA | NA | — | Read-only. |  |
| TL-DL-00 | NA | NA | NA | — |  |  |
| TL-DL-01 / 01a..d | PASS | PASS | PASS | — | Row container has `onClick={() => setExpanded(...)}`, toggles in-card expansion which reveals "Source · Step-up · ID" line — qualifies as in-place SOURCE drill (provenance). | Timeline.jsx:988-1024 |
| TL-DL-01e | PASS | PASS | PASS | — | Same handler. |  |
| TL-DL-02 | FAIL | — | — | FUNCTIONAL | "+N more decisions in log" footer is a `<div>` — **not a button**, no `onClick`. Decisions 7+ are invisible. Inventory TL-S-06 confirmed. Owns-subject destination "View all decisions" panel does not exist. | Timeline.jsx:1027-1034 |
| TL-PLN-HEAD | NA | NA | NA | — |  |  |
| TL-PLN-00 | PASS | PASS | PASS | — | Top "Set a plan →" → `onOpenGoalSeek()` → DECISION. | Timeline.jsx:1366-1377 |
| TL-PLN-01 | NA | NA | NA | — | Subsection header. |  |
| TL-PLN-02..09 | PASS | PASS | PASS | — | Each PlanRow has `onClick={() => exists && setOpen(o => !o)}` — tap-to-expand SOURCE drill (target/window/committed/staleness). Non-existent plans are non-interactive (cursor `default`) — honest. | Timeline.jsx:1081-1115 |
| TL-PLN-0x / 0y / 0z | NA | NA | NA | — | Status chip / target line / expanded body — display. |  |
| TL-PLN-0w | PASS | PASS | PASS | — | "Edit · Goal-seek" → `onEditGoalSeek(pt.id)` → `openGoalSeek(planTypeId)` → GoalSeekSheet (DECISION). `stopPropagation` correct. | Timeline.jsx:1128-1143, 2478 |
| TL-PLN-10 / 10a | NA | NA | NA | — | Subsection header / empty state. |  |
| TL-PLN-11 / 11a / 11b | NA | NA | **FAIL** | FUNCTIONAL | Saved-scenario rows render as inert `<div>` — no `onClick`, no expand, no nav to a scenario-detail surface. Inventory marks 11a "SOURCE — scenario detail" expected destination. None of the first-4 scenarios is drillable. | Timeline.jsx:1419-1440 |
| TL-PLN-12 | FAIL | — | — | FUNCTIONAL | **No "View all" affordance exists** in §E for scenarios beyond the first 4. `scenarios.slice(0, 4)` truncates silently. Inventory TL-S-06 confirmed; complements TL-DL-02. | Timeline.jsx:1420 |
| TL-PLN-13 | FAIL | — | — | FUNCTIONAL | Same cross-ref to TL-DL-02 — already failed above. |  |
| TL-GM-HEAD | NA | NA | NA | — |  |  |
| TL-GM-01 / 01a | NA | NA | NA | — | Pinned milestone container (DATA — the actions are on 01b/01c). |  |
| TL-GM-01b | PASS | PASS | PASS | — | "Celebrate" fires BOTH `MILESTONE_CELEBRATED` and `MILESTONE_DISMISSED` via `emitMilestoneEvent` → `onCommit`. Confetti triggered. Matches FD-TL-3 contract exactly. | Timeline.jsx:1637-1644, 1611-1624 |
| TL-GM-01c | PASS | PASS | PASS | — | "Got it" fires `MILESTONE_DISMISSED` only. | Timeline.jsx:1645-1648 |
| TL-GM-01d | NA | NA | NA | — | Confetti visual. |  |
| TL-GM-02 | NA | NA | NA | — | Subsection header. |  |
| TL-GM-02a | PASS | PASS | **FAIL** | DEMO-BLOCKING | Achieved-milestone row → `onMilestoneTap(m)` → `setActiveMilestone(m)` → `MilestoneDrillPanel` opens. Handler real, surface owns subject. **BUT** MilestoneDrillPanel is **describe-only** (per inventory TL-S-12): renders status pill, progress bar, Current/Target row, "What would push this forward?" hint paragraph — **and no ACTION CTA**. No "Open Goal Seek for this milestone", no "Adjust plan", no nav link. Pure description = A4 FAIL per the auditor's own contract ("an element that 'works' but lands on a modal that only *describes* fails A4"). | Timeline.jsx:1717, 2319-2325, 2083-2218 |
| TL-GM-02b | PASS | PASS | **FAIL** | DEMO-BLOCKING | Projected-milestone row → `handleProjectedTap` → fires `MILESTONE_DETECTED` then opens the same `MilestoneDrillPanel` — same describe-only failure mode. | Timeline.jsx:1649-1652, 1745 |
| TL-GM-03 / 03a..c | NA | NA | NA | — | Goal rows DATA only — no row-level `onClick`. Inventory does not require drill. |  |
| TL-GM-04 / 04a-h | PASS | **FAIL** | **FAIL** | DEMO-BLOCKING | All 8 goal templates → `onCreateGoal(t)` → `onNav('goal-create', { template })` → `setTabSafe('goal-create')`. **`goal-create` is NOT a recognised tab id.** Dashboard tab branches are `home / money / flow / tax / risk / timeline` only (Dashboard.jsx:471-505). Setting tab to `'goal-create'` leaves the main content area BLANK — no branch renders. Handler fires, but lands nowhere. Inventory TL-S-19 confirmed; cited founder rule "every CTA tested" violated for 8 tappable surfaces simultaneously. | Timeline.jsx:1842, 2303-2305; Dashboard.jsx:175-177, 471-505 |
| TL-GM-05 | NA | NA | NA | — | Tally display. |  |
| TL-DISC-01 | NA | NA | NA | — | FCA disclaimer. |  |
| TL-DISC-02 | NA | NA | NA | — | Rules version line. |  |
| TL-OVL-01 | PASS | PASS | PASS | — | GoalSeekSheet renders with backdrop tap-close, sheet-handle, close button. Opens DECISION surface. | Timeline.jsx:1447-1602, 2491-2497 |
| TL-OVL-01a | PASS | PASS | PASS | — | Metric `<select>` writes to `seekTarget.metric`. |  |
| TL-OVL-01b | PASS | PASS | PASS | — | Number input writes to `seekTarget.value`. (A5 unit-hint issue is plain-English / inventory TL-S-10 — not interaction.) |  |
| TL-OVL-01c | PASS | PASS | PASS | — | "Find paths" → `goalSeek(e, metric, +value, '12mo', { maxAction: 200000 })`; results render. Error-handled. | Timeline.jsx:1461-1468, 1534-1544 |
| TL-OVL-01d | NA | NA | NA | — | Result rows DATA. |  |
| TL-OVL-01e | PASS | PASS | **FAIL** | FUNCTIONAL | "Commit this path" → builds `planEnvelope` with `type: seekTarget.metric === 'wealthScore' ? 'retirement' : 'custom'`. **For every metric other than `wealthScore` (riskScore, netWorth, iht, AND the 7 explicit plan types: estate/cashflow/debt/gift/protection/tax/custom), the commit force-types the plan as `'custom'`.** Picking metric "Estate plan" + Commit creates a `custom` plan, not an `estate` plan. PlanRow staleness/exists for Estate (TL-PLN-03) will still say "Not set". The commit fires (so A2/A3 pass — `commitPlan` is called and the surface is right) but the landing state is **incoherent**: the user just committed an estate path and Estate plan reads "Not set". Inventory TL-S-09 confirmed. | Timeline.jsx:1470-1481 |
| TL-OVL-01f | NA | NA | NA | — | No-paths empty state DATA. |  |
| TL-OVL-01g | PASS | PASS | PASS | — | Close + backdrop both clear results and call `onClose`. |  |
| TL-OVL-02 | PASS | PASS | PASS | — | ScoreHistoryDrillPanel mounts as full-screen overlay (zIndex 300). | Timeline.jsx:2312-2318, 1878-2076 |
| TL-OVL-02a | PASS | PASS | PASS | — | Back → `onClose` → `setDrillView(null)`. | Timeline.jsx:1923-1929 |
| TL-OVL-02b | NA | NA | NA | — | Hero DATA. |  |
| TL-OVL-02c | PASS | PASS | **FAIL** | FUNCTIONAL | Range picker sets `activeRange` (local state) **but `activeRange` is never read again** in the panel — sparklines render off the `wPts` / `rPts` passed from parent's `scoreJourneyData`. Switching range is purely cosmetic / dead. The parent's range is set via §B `rangeOverride` and X28 windowId, not from inside this panel. Inventory TL-OVL-02c note + TL-S-05 confirmed. | Timeline.jsx:1879, 1972-1983, 1986-2014 |
| TL-OVL-02d / 02e | NA | NA | NA | — | Sparkline DATA. |  |
| TL-OVL-02f | NA | NA | NA | POLISH | "8 dimensions — weakest first" eyebrow is hardcoded; loops over `dims` from `fq.dims` which may be 7. A5/A6 (not interaction). | Timeline.jsx:2022-2023 |
| TL-OVL-02g | NA | NA | NA | — | Action-levels DATA. |  |
| TL-OVL-02h | NA | NA | NA | — | Disclaimer. |  |
| TL-OVL-03 | PASS | PASS | **FAIL** | DEMO-BLOCKING | MilestoneDrillPanel — see TL-GM-02a/b. Drill opens; landing is describe-only with zero ACTION CTAs. | Timeline.jsx:2083-2218 |
| TL-OVL-03a | PASS | PASS | PASS | — | Back handler. |  |
| TL-OVL-03b / 03c / 03d | NA | NA | NA | — | Status / progress / current-target DATA. |  |
| TL-OVL-03e | NA | NA | **FAIL** | DEMO-BLOCKING | "What would push this forward?" card — pure paragraph hint. No CTA to open Goal Seek seeded with this milestone, no nav to the relevant tab. This is the literal "describe instead of drill" failure the auditor charter calls out. | Timeline.jsx:2202-2210 |
| TL-OVL-03f | NA | NA | NA | — | Disclaimer. |  |
| TL-OVL-04 | PASS | PASS | PASS | — | ExplainerChip resolves to TL-1 entry → bottom sheet (SOURCE). |  |

---

## §2 Per-FAIL detail (current vs expected vs incoherence reason)

### F-INT-A · TL-CAL-04..11 — Calendar rows are not drillable (DEMO-BLOCKING)
- **Current:** `CalendarEntryRow` is a `<div>` with no handler. Tap = nothing.
- **Expected (per inventory):** each row drills to its own-subject surface — `sipp-iht` → T&E CoI projection; `isa-reset` → My Money ISA allowance; `sa-deadline` → T&E SA detail; `state-pension` → Cashflow state-pension; `apq-*` → My Money/T&E by domain; `nominations` → My Money pension nominations; `trust-gift` → T&E gift; `mortgage-fix` → My Money/Cashflow mortgage.
- **Incoherence:** FD-CROSS-1 makes the calendar the canonical "the when" surface that *must* drill into its own angle's detail or the owns-subject canonical action surface. Today, tapping any row is dead — the entire promise is broken.

### F-INT-B · TL-CAL-EMPTY — Empty state has no ACTION (FUNCTIONAL)
- **Current:** Just a sentence. No buttons.
- **Expected:** "Show longer horizon" CTA (calls `setWindowId('lifetime')`) and/or "Reset filters" CTA (resets `catFilter`).
- **Incoherence:** Dead-end. User has nothing to do.

### F-INT-C · TL-DL-02 / TL-PLN-12 / TL-PLN-13 — Truncation without "View all" (FUNCTIONAL)
- **Current:** §D shows `decisions.slice(0, 6)` and renders a div "+N more decisions in log". §E shows `scenarios.slice(0, 4)` and renders nothing for the remainder.
- **Expected:** Tappable "View all decisions" / "View all scenarios" affordance opening a list panel.
- **Incoherence:** All decisions/scenarios beyond cut-off are invisible. For a "structured audit trail" surface this is failure-of-purpose.

### F-INT-D · TL-GM-04 — Goal templates land on a non-existent tab (DEMO-BLOCKING)
- **Current:** `onNav('goal-create', { template })` → `setTabSafe('goal-create')` → no `tab === 'goal-create'` branch in Dashboard.jsx (471-505). Main content area renders nothing.
- **Expected:** Either a `goal-create` tab/overlay, or the templates should open GoalSeekSheet pre-seeded by template — the inventory marks owns-subject = DECISION.
- **Incoherence:** 8 tappable cards all silently land on a blank screen. Founder rule "every CTA tested" violated.

### F-INT-E · TL-OVL-03 / TL-GM-02a / TL-GM-02b — MilestoneDrillPanel is describe-only (DEMO-BLOCKING)
- **Current:** Drill opens, shows status/progress/current/target/hint paragraph. No CTAs.
- **Expected:** At least one ACTION (e.g., "Open Goal Seek for this milestone" → seeds GoalSeekSheet with the milestone's metric+target, or "See related plan" → expands the PlanRow for the relevant `pt.id`).
- **Incoherence:** Auditor charter — "modal that only describes fails A4". Inventory TL-S-12 confirms.

### F-INT-F · TL-OVL-01e — Commit forces wrong plan type for non-wealthScore metrics (FUNCTIONAL)
- **Current:** `type: seekTarget.metric === 'wealthScore' ? 'retirement' : 'custom'`. Picking metric "Estate plan", "Tax plan", etc., commits as `custom`.
- **Expected:** When `seekTarget.metric` is a known plan-type id (`retirement | estate | cashflow | debt | gift | protection | tax | custom`), use it directly as `envelope.type`. For non-plan-type metrics (`wealthScore | riskScore | netWorth | iht`), map via a small lookup table (e.g. `iht → estate`, `netWorth → retirement`, `riskScore → protection`) — or store under `custom` with `target_kind: metric` so the PlanRow can still resolve.
- **Incoherence:** The user picks "Estate plan", taps Commit, sees the sheet close, scrolls down — and Estate plan row still says "Not set" while a `custom` plan now exists. Two surfaces disagree about what just happened.

### F-INT-G · TL-OVL-02c — ScoreHistoryDrillPanel range picker is dead (FUNCTIONAL)
- **Current:** `setActiveRange` writes to local state never read elsewhere; the underlying `wPts`/`rPts` come from parent.
- **Expected:** Either remove the range picker from this panel (parent owns range via X28+§B), OR lift the change up via an `onRangeChange` callback so the parent re-fetches `calcScoreHistory(entity, range)`.
- **Incoherence:** Five active-looking pills, none of them do anything. Founder rule against "interactive label, dead handler" applies.

### F-INT-H · TL-SJ-01..04 — §B range-picker inconsistency with drill (FUNCTIONAL)
- **Current:** §B exposes 4 ranges (`1mo / 3mo / 6mo / 12mo`); ScoreHistoryDrillPanel exposes 5 (adds `all-time`); X28 `lifetime` window resolves via `windowToHistoryRange` to `'all-time'`. When `windowId='lifetime'`, the §B active-pill state can never highlight (no all-time pill exists).
- **Expected:** Either add `lifetime` (or `All`) pill to §B's `RANGE_OPTIONS`, or remove `all-time` from the drill range-picker so both surfaces match.
- **Incoherence:** Two surfaces showing the same data with different controls. Inventory TL-S-05 confirmed.

### F-INT-I · TL-SJ-ERR — Error copy implies an action that doesn't exist (FUNCTIONAL)
- **Current:** "Score Journey temporarily unavailable — try refreshing" — there is no refresh button anywhere on Timeline.
- **Expected:** Add a "Retry" button that nulls `scoreJourneyData` and re-fires the effect, OR change copy to remove the imperative ("Score Journey temporarily unavailable — engine timing out").

---

## §3 Additional findings discovered while walking (extend beyond seed)

| Tag | Element(s) | Finding | Severity |
|----|------------|---------|----------|
| F-INT-01 | TL-LS-01 / §A life-stage hero | Inventory marks "SOURCE — stage rule detail" as the owns-subject destination, but the build wraps the stage name in a plain `<div>`. No `onClick`, no `sw-press`. Auditor-level: this is an UNLISTED design intent that the build does not honour. If founder says §A is presentational, mark NA and update inventory. | POLISH |
| F-INT-02 | TL-SJ-07 / Action-level bars | Inventory marks "SOURCE — action-level detail" — bars are non-interactive. Same dispatch as F-INT-01. | POLISH |
| F-INT-03 | TL-CAL-04..11 (re-touched) | Even ignoring the "every row should drill" rule, the per-row `sources` arrays render as visible "↳ …" lines (Timeline.jsx:852-857) that are *not tappable*. They look like links, behave like static text. Cosmetic but reinforces F-INT-A. | POLISH |
| F-INT-04 | Top-bar `TL-X28-04` | Data-date fallback string is `entity?.dataLastUpdated \|\| 'UK-2026.1'` — the fallback is the rules-bundle version, which is wrong domain for a "data freshness" label. Should fall back to e.g. `'unknown'` or hide the chip. | POLISH |
| F-INT-05 | TL-OVL-01b (GoalSeek input) | The number input has no min/max validation and no unit hint, but more critically: switching metric does **not** reset the value, so "wealthScore=80" persists into a "netWorth" pick (value stays at 80, asking the engine to find paths to £80 net worth). Engine returns garbage results. Adjacent to TL-S-10 but actionable as: bind `value` reset to `useEffect` on `seekTarget.metric` change. | FUNCTIONAL |
| F-INT-06 | TL-PFH-00a empty-state CTA | "Set your first plan →" opens GoalSeekSheet with metric=`wealthScore` (default). For a brand-new user, the first thing they see in the sheet is a "Wealth Score" picker — not the most intuitive entry. Consider seeding with `retirement` for the empty state. Minor — interaction works. | POLISH |
| F-INT-07 | `RANGE_OPTIONS` mismatch follow-on | `windowToHistoryRange` returns `'all-time'` for `lifetime`. When that flows into §B `rangeId={rangeOverride \|\| windowToHistoryRange(windowId)}`, the resolved `rangeId='all-time'` is then compared against `opt.id ∈ {1mo,3mo,6mo,12mo}` — no match, no active pill highlighted, the UI looks like nothing is selected even though §B is genuinely rendering all-time data. Cross-ref to F-INT-H. | FUNCTIONAL |

---

## §4 Coverage

- Rows in inventory v1: **~130** (including sub-rows).
- Rows verdicted in this pass: **130** (every row touched; NA where the inventory itself marks NA for display/orientation rows).
- Rows requiring follow-up by other auditors (reconciliation, A5/A6): TL-ANCH-01/02/03 vs Home; TL-CAL-04* vs Home/T&E CoI; TL-OVL-02b vs TL-SJ-05/06; brand-string sweep (TL-DISC-01) — these are NOT this auditor's lane.

---

## §5 Summary counts

- **PASS:** 27 interactive rows
- **FAIL:** 14 interactive rows
  - **DEMO-BLOCKING:** 4 distinct failures (F-INT-A · 8 calendar rows · TL-CAL-04..11; F-INT-D · 8 goal templates · TL-GM-04a-h; F-INT-E · TL-OVL-03/TL-GM-02a/02b MilestoneDrillPanel describe-only; cumulatively 18 dead taps in the build)
  - **FUNCTIONAL:** 9 (F-INT-B empty-state, F-INT-C truncation x3, F-INT-F commit-typing, F-INT-G drill range dead, F-INT-H §B range inconsistency, F-INT-I error copy, F-INT-05 input persistence, F-INT-07 active-pill drift)
  - **POLISH:** 5 (F-INT-01, F-INT-02, F-INT-03, F-INT-04, F-INT-06)
- **NA / display-only:** 89 rows
- **BLOCKED:** 0

---

*— end interaction.md · Pass 1 —*
