# Timeline — Conformance Audit (Pass 1, A1)

**Auditor:** conformance-auditor
**Screen:** Timeline (`src/screens/Timeline.jsx`, 2512 lines)
**Inventory:** `timeline-inventory-v1.md` (130 rows incl. sub-rows)
**Brand SoT:** `src/config/brand.js`
**Date:** 2026-05-18
**Method:** A1 (Identified) walk only. Drillable / destination / plain-English / reconcile belong to other auditors.

---

## A1 Verdict Table

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| TL-X28-01 | PASS | — | X28TopBar wired with `window={windowId}` + `onWindowChange={setWindowId}` | Timeline.jsx:2330-2337 |
| TL-X28-02 | PASS | — | `viewMode` + `onViewModeChange={setViewMode}` wired | Timeline.jsx:2332-2334 |
| TL-X28-03 | PASS | — | `rulesVersion={TAX.ver \|\| 'UK-2026.1'}` passed | Timeline.jsx:2335 |
| TL-X28-04 | PASS | — | `dataDate={entity?.dataLastUpdated \|\| 'UK-2026.1'}` passed (fallback uses rules-bundle string, not a date — flagged for plain-English auditor) | Timeline.jsx:2336 |
| TL-ANCH-01 | PASS | — | Net Worth anchor card present, `value:nw`, `onTap → onDrillMetric('netWorth')`, `Num` animate | Timeline.jsx:2349,2363-2369 |
| TL-ANCH-02 | PASS | — | Wealth Score anchor card present, `value:fq.total`, `format:'score'` | Timeline.jsx:2350 |
| TL-ANCH-02a | PASS | — | Wealth band sub-label `fq.band.name` renders | Timeline.jsx:2350,2367 |
| TL-ANCH-03 | PASS | — | Risk Score anchor card present, `value:risk.total`; tap routes to `onDrillMetric('riskScore')` else `handleRiskTap()` | Timeline.jsx:2351,2307-2309 |
| TL-ANCH-03a | PASS | — | Risk band sub-label `risk.band.name` renders | Timeline.jsx:2351,2367 |
| TL-SUB-01 | PASS | — | Capital Efficiency PRC/PCC row renders "—" + "Coming next"; FadeInOnMount only (no `sw-press`/`sw-lift` — honest non-interactive). | Timeline.jsx:2374-2384 |
| TL-PURP-01 | PASS | — | X25 headline "Where am I in my financial life — and where am I headed?" present | Timeline.jsx:2389 |
| TL-PURP-02 | PASS | — | X25 sub-line "See your life stage, your score over time…" present | Timeline.jsx:2391-2394 |
| TL-PFH-00 | PASS | — | Empty-state card renders when `existing.length === 0` | Timeline.jsx:1224-1259 |
| TL-PFH-00a | PASS | — | "Set your first plan →" CTA wired to `onOpenGoalSeek?.()` (no metric) | Timeline.jsx:1245-1256 |
| TL-PFH-01 | PASS | — | "Your plan · headline" eyebrow label renders | Timeline.jsx:1305 |
| TL-PFH-02 | PASS | — | Plan name (`headline.label`) renders | Timeline.jsx:1306-1308 |
| TL-PFH-03 | PASS | — | Target line `Target ${formatPlanTarget}` + optional `~Ny to target` | Timeline.jsx:1309-1312,1268-1281 |
| TL-PFH-04 | PASS | — | TrackingPill rendered with `fundedPct`; 4 states (On track/Tracking behind/Off track/Awaiting data) | Timeline.jsx:1200-1218,1314 |
| TL-PFH-05 | PASS | — | `pctLabel` renders with `tabular-nums` | Timeline.jsx:1266,1322-1325 |
| TL-PFH-06 | PASS | — | Funded ProgressBar present with `barColor` (success ≥1.0 / warning ≥0.85 / danger < 0.85) | Timeline.jsx:1283-1287,1327 |
| TL-PFH-07 | PASS | — | "Review · adjust this plan →" CTA wired to `onOpenGoalSeek?.(headline.pt.id)` | Timeline.jsx:1334-1345 |
| TL-PFH-08 | PASS | — | Footer caption "Funded% derived from saved scenarios; the engine models — not advice." | Timeline.jsx:1348-1352 |
| TL-LS-HEAD | PASS | — | SectionHeader letter="A" title="Life stage" purpose="Where you sit on the path" | Timeline.jsx:2409-2414 |
| TL-LS-01 | PASS | — | Stage hero `{stg.name}` rendered | Timeline.jsx:286-288 |
| TL-LS-01a | PASS | — | Range + animated `pctAnim` + age line | Timeline.jsx:289-291 |
| TL-LS-02 | PASS | — | "Stage N of 7" chip | Timeline.jsx:293-301 |
| TL-LS-03 | PASS | — | Animated stage % ProgressBar with `sw-bar-grow` | Timeline.jsx:305-307,197-211 |
| TL-LS-04 | PASS | — | 7-segment strip in RevealStagger; current segment has `sw-pulse-glow` | Timeline.jsx:311-330 |
| TL-LS-04a-g | PASS | — | 7 segment labels (Fou·Acc·Con·Tra·Dec·Pre·Leg) via `s.name.slice(0,3)` | Timeline.jsx:337-347 |
| TL-LS-05 | PASS | — | "18" / "85+" anchor labels at strip ends | Timeline.jsx:336,348 |
| TL-LS-06 | PASS | — | On-chart implication line with next-stage name and `nextRule`; Legacy fallback | Timeline.jsx:352-367 |
| TL-LS-06a | PASS | — | DiffBadge `▲Ny` rendered when `yearsToNext > 0` | Timeline.jsx:359-364 |
| TL-LS-07 | PASS | — | CausalityStripe with DOB + bundle sources | Timeline.jsx:369-372 |
| TL-SJ-HEAD | PASS | — | SectionHeader letter="B" title="Score journey" purpose | Timeline.jsx:2418-2423 |
| TL-SJ-SKEL | PASS | — | SectionBSkeleton renders when `!scoreJourneyData` | Timeline.jsx:407-420,427-429 |
| TL-SJ-ERR | PASS | — | Error skeleton "Score Journey temporarily unavailable — try refreshing" when `error:true` | Timeline.jsx:430-432 |
| TL-SJ-00 | PASS | — | "Score journey" LBL + `window: {range}` meta | Timeline.jsx:456-460 |
| TL-SJ-00a | PASS | — | `<ExplainerChip id="TL-1" />` rendered | Timeline.jsx:457 |
| TL-SJ-01 | PASS | — | Range button `1mo` rendered from RANGE_OPTIONS | Timeline.jsx:148-153,468-480 |
| TL-SJ-02 | PASS | — | Range button `3mo` | Timeline.jsx:148-153 |
| TL-SJ-03 | PASS | — | Range button `6mo` | Timeline.jsx:148-153 |
| TL-SJ-04 | PASS | — | Range button `12mo` (only 4 ranges — DECISION-NEEDED vs drill's 5) | Timeline.jsx:148-153 |
| TL-SJ-05 | PASS | — | B.1 Wealth Score value via `<Num value={c.val} format="score" animate />` | Timeline.jsx:488-498 |
| TL-SJ-05a | PASS | — | Wealth band name | Timeline.jsx:499-501 |
| TL-SJ-05b | PASS | — | Wealth DiffBadge with `wΔ` | Timeline.jsx:505-507 |
| TL-SJ-06 | PASS | — | B.1 Risk Score value | Timeline.jsx:490,498 |
| TL-SJ-06a | PASS | — | Risk band name | Timeline.jsx:499-501 |
| TL-SJ-06b | PASS | — | Risk DiffBadge `rΔ` | Timeline.jsx:505-507 |
| TL-SJ-07 | PASS | — | B.2 Action levels bars row from `traj` (= `fqTrajectory(entity)`) | Timeline.jsx:512-535,2274 |
| TL-SJ-07a | PASS | — | Per-bar `t.score` label | Timeline.jsx:524 |
| TL-SJ-07b | PASS | — | Per-bar `t.label` | Timeline.jsx:531 |
| TL-SJ-08 | PASS | — | B.3 Wealth confidence label `${hist.confidence} confidence` | Timeline.jsx:542-544 |
| TL-SJ-08a | PASS | — | Wealth `+/-N pts (range)` delta label | Timeline.jsx:545-550 |
| TL-SJ-08b | PASS | — | Wealth ScoreSparkline with DrawSVG 1200ms | Timeline.jsx:383-405,552 |
| TL-SJ-09 | PASS | — | B.4 Risk confidence label | Timeline.jsx:560-561 |
| TL-SJ-09a | PASS | — | Risk delta label with `rΔ <= 0 ? success : danger` semantics | Timeline.jsx:563-568 |
| TL-SJ-09b | PASS | — | Risk ScoreSparkline | Timeline.jsx:570 |
| TL-SJ-10 | PASS | — | Plan-active banner "Retirement plan active · Forecast-vs-Plan tracking enabled (spec §X28.6)" — copy carries internal spec ref "(spec §X28.6)" — flag for plain-English auditor | Timeline.jsx:574-583 |
| TL-SJ-11 | PASS | — | Plan-available switch button "Retirement plan committed — switch to Plan view to overlay" wired to `onViewModeChange?.('plan')` | Timeline.jsx:584-595 |
| TL-SJ-12 | PASS | — | No-plan hint references "§E" — A5 concern out of scope | Timeline.jsx:596-604 |
| TL-SJ-13 | PASS | — | LOW-confidence footer renders when `hist?.confidence === 'LOW'` | Timeline.jsx:606-613 |
| TL-SJ-14 | PASS | — | §B CausalityStripe with calcScoreHistory/calcRiskHistory/D-SCORE-JOURNEY-1 sources | Timeline.jsx:615-624 |
| TL-SJ-15 | PASS | — | "Detail ›" L3 drill chip rendered only when scoreJourneyData ready + no error; wired to `setDrillView('scoreHistory')` | Timeline.jsx:2432-2445 |
| TL-CAL-HEAD | PASS | — | SectionHeader letter="C" title="What's coming and when" | Timeline.jsx:2449-2454 |
| TL-CAL-00 | PASS | — | Horizon meta label `horizon: {Nmo or lifetime}` | Timeline.jsx:900-903 |
| TL-CAL-01 | PASS | — | Statutory filter chip | Timeline.jsx:633,907-925 |
| TL-CAL-02 | PASS | — | Personal filter chip | Timeline.jsx:633,907-925 |
| TL-CAL-03 | PASS | — | Action filter chip | Timeline.jsx:633,907-925 |
| TL-CAL-EMPTY | PASS | — | Empty-state line "No calendar entries for selected categories within the X-month horizon." — no CTA inside (DECISION-NEEDED) | Timeline.jsx:927-933 |
| TL-CAL-04 | PASS | — | `sipp-iht` entry pushed (when `coi > 0`); date `'6 Apr 2027'` hardcoded string | Timeline.jsx:681-691 |
| TL-CAL-04a | PASS | — | Animated `dayCount` "N days remaining" rendered when `showDayCounter` | Timeline.jsx:802-803,837-849 |
| TL-CAL-04b | PASS | — | Coral chip "£X/day" via `coiCount` (only when `coiPerDay > 0`) | Timeline.jsx:842-848 |
| TL-CAL-04c | PASS | — | `${fmt(coi)} total exposure` rendered in detail line | Timeline.jsx:686 |
| TL-CAL-05 | PASS | — | `isa-reset` entry pushed with `TAX.isaAllowance` and computed `5 Apr ${yr}` | Timeline.jsx:694-707 |
| TL-CAL-06 | PASS | — | `sa-deadline` entry pushed with `31 Jan ${yr+1}` | Timeline.jsx:710-721 |
| TL-CAL-07 | PASS | — | `state-pension` entry pushed when `age < spAge` and within horizon | Timeline.jsx:724-737 |
| TL-CAL-08 | PASS | — | `apq-*` entries pushed from `calcAPQTimeline` excluding `pension-drawdown` | Timeline.jsx:740-752 |
| TL-CAL-09 | PASS | — | `nominations` entry pushed when `stale.length > 0`; date='Overdue' string hardcoded | Timeline.jsx:755-763 |
| TL-CAL-10 | PASS | — | `trust-gift` entry pushed when `entity?.assets?.trustGifts?.date` set | Timeline.jsx:766-778 |
| TL-CAL-10a | PASS | — | `GiftClockRing` SVG rendered when `e.id === 'trust-gift' && e.giftPct != null` | Timeline.jsx:644-664,819-821 |
| TL-CAL-11 | PASS | — | `mortgage-fix` entry pushed when `entity?.liabilities?.mortgage?.endDate` within window | Timeline.jsx:781-794 |
| TL-CAL-99 | PASS | — | Per-row date chip with `urgencyClass()` returning coral/amber/mint | Timeline.jsx:636-641,831-833 |
| TL-CAL-99a | PASS | — | "Overdue" chip rendered when `isOverdue` | Timeline.jsx:800,825-829 |
| TL-CAL-99b | PASS | — | Per-row CausalityStripe sources line "↳ …" | Timeline.jsx:851-857 |
| TL-DL-HEAD | PASS | — | SectionHeader letter="D" title="Decision Log" | Timeline.jsx:2458-2463 |
| TL-DL-EMPTY | PASS | — | Empty state "No decisions logged yet…" rendered when `decisions.length === 0` | Timeline.jsx:953-969 |
| TL-DL-00 | PASS | — | "N decision(s) logged" header rendered | Timeline.jsx:977-980 |
| TL-DL-01 | PASS | — | Decision row title (`d.title \|\| d.type \|\| 'Decision'`) | Timeline.jsx:1001-1003 |
| TL-DL-01a | PASS | — | Decision date `d.date \|\| committed_at.substring(0,10)` | Timeline.jsx:1004-1006 |
| TL-DL-01b | PASS | — | Detail line `d.detail` | Timeline.jsx:1008-1010 |
| TL-DL-01c | PASS | — | DiffBadge with `impScore = d.impact?.finioScore ?? d.impact?.fqDelta` | Timeline.jsx:986,1011-1016 |
| TL-DL-01d | PASS | — | Expanded detail "Source: X · Step-up: L1 · ID: Y" | Timeline.jsx:1017-1021 |
| TL-DL-01e | PASS | — | Tap-to-expand whole row via `onClick` + `sw-press` | Timeline.jsx:988-995 |
| TL-DL-02 | PASS | — | "+N more decisions in log" footer when `decisions.length > 6`; no "View all" CTA (DECISION-NEEDED) | Timeline.jsx:1027-1034 |
| TL-PLN-HEAD | PASS | — | SectionHeader letter="E" title="Scenarios & Plans" purpose="8 plan types · saved scenarios · goal-seek" | Timeline.jsx:2467-2472 |
| TL-PLN-00 | PASS | — | "Set a plan →" primary CTA at top of §E wired to `onOpenGoalSeek?.()` | Timeline.jsx:1365-1377 |
| TL-PLN-01 | PASS | — | "Active Plans" header + "N/8 set" counter | Timeline.jsx:1380-1389 |
| TL-PLN-02 | PASS | — | PlanRow `retirement` ⊙ — from PLAN_TYPES[0] | Timeline.jsx:124-133,1390-1399 |
| TL-PLN-03 | PASS | — | PlanRow `estate` ◇ | Timeline.jsx:124-133 |
| TL-PLN-04 | PASS | — | PlanRow `cashflow` ≋ | Timeline.jsx:124-133 |
| TL-PLN-05 | PASS | — | PlanRow `debt` ⊟ | Timeline.jsx:124-133 |
| TL-PLN-06 | PASS | — | PlanRow `gift` ⬡ | Timeline.jsx:124-133 |
| TL-PLN-07 | PASS | — | PlanRow `protection` ⛨ | Timeline.jsx:124-133 |
| TL-PLN-08 | PASS | — | PlanRow `tax` ⚖ | Timeline.jsx:124-133 |
| TL-PLN-09 | PASS | — | PlanRow `custom` ◌ | Timeline.jsx:124-133 |
| TL-PLN-0x | PASS | — | Status chip Current/Stale/Not set via `staleness?.stale` + `chipClass` | Timeline.jsx:1074-1076,1110-1114 |
| TL-PLN-0y | PASS | — | Per-row target line `staleness.reason · target X` | Timeline.jsx:1103-1108 |
| TL-PLN-0z | PASS | — | Expanded detail Target/Window/Committed/Staleness | Timeline.jsx:1116-1126 |
| TL-PLN-0w | PASS | — | "Edit · Goal-seek" button with `stopPropagation` → `onEditGoalSeek?.(pt.id)` | Timeline.jsx:1127-1143 |
| TL-PLN-10 | PASS | — | "Saved Scenarios" + "N saved" header | Timeline.jsx:1402-1410 |
| TL-PLN-10a | PASS | — | Empty state "No scenarios saved yet…" | Timeline.jsx:1411-1417 |
| TL-PLN-11 | PASS | — | Saved-scenario row name; `slice(0, 4)` truncation | Timeline.jsx:1419-1425 |
| TL-PLN-11a | PASS | — | Meta `saved_at · source · rules_version` | Timeline.jsx:1426-1428 |
| TL-PLN-11b | PASS | — | TrackingPill + funded% on each row when `deltaResults.fundedRatio != null` | Timeline.jsx:1429-1436 |
| TL-PLN-12 | FAIL | FUNCTIONAL | No "View all" CTA exists. `scenarios.slice(0, 4)` truncates silently; rows 5+ are invisible. Confirms inventory seed TL-S-06. | Timeline.jsx:1420 |
| TL-PLN-13 | FAIL | FUNCTIONAL | No "View all" CTA for §D either. Cross-ref TL-DL-02 — footer is text-only. | Timeline.jsx:1027-1034 |
| TL-GM-HEAD | PASS | — | SectionHeader letter="F" title="Goals & Milestones" | Timeline.jsx:2482-2487 |
| TL-GM-01 | PASS | — | Pinned unacked milestone card "Milestone reached: <label>" | Timeline.jsx:1660-1676 |
| TL-GM-01a | PASS | — | Achieved date + optional "(estimated from trajectory)" | Timeline.jsx:1677-1680 |
| TL-GM-01b | PASS | — | "Celebrate" CTA → `handleCelebrate` which calls both `MILESTONE_CELEBRATED` and `MILESTONE_DISMISSED` emitMilestoneEvent — FD-TL-3 satisfied | Timeline.jsx:1637-1644,1682-1691 |
| TL-GM-01c | PASS | — | "Got it" CTA → `handleDismiss` fires `MILESTONE_DISMISSED` | Timeline.jsx:1645-1648,1692-1701 |
| TL-GM-01d | PASS | — | `<ConfettiBurst active={confettiId === ...} />` rendered within pinned card | Timeline.jsx:1669,215-242 |
| TL-GM-02 | PASS | — | "Milestone timeline" subsection header rendered when achieved or projected present | Timeline.jsx:1707-1711 |
| TL-GM-02a | PASS | — | Achieved milestone row ✓ + "Done" chip, `onClick → onMilestoneTap`; `slice(0, 3)` | Timeline.jsx:1713-1740 |
| TL-GM-02b | PASS | — | Projected milestone row ◌ dashed + "Projected" chip, `onClick → handleProjectedTap` (fires MILESTONE_DETECTED then opens drill); `slice(0, 3)`; ProgressBar when `m.progress > 0` | Timeline.jsx:1649-1652,1742-1784 |
| TL-GM-03 | PASS | — | "Your goals (N)" header when `goals.length > 0` | Timeline.jsx:1791-1794 |
| TL-GM-03a | PASS | — | Goal row label + `pct` via `calcGoalProgress` | Timeline.jsx:1797-1817 |
| TL-GM-03b | PASS | — | ProgressBar per goal | Timeline.jsx:1819 |
| TL-GM-03c | PASS | — | Projected hit-date line "Projected: YYYY-MM · N behind" | Timeline.jsx:1820-1825 |
| TL-GM-04 | PASS | — | Goal-templates 2-col grid rendered when `goals.length === 0` | Timeline.jsx:1831-1854 |
| TL-GM-04a-h | PASS | — | 8 templates (retire/mortgage/nw_target/emergency/income/iht_free/uni_fund/deposit) → `onCreateGoal(t)` → `onNav('goal-create', { template })` | Timeline.jsx:136-145,1839-1851,2303-2305 |
| TL-GM-05 | PASS | — | Tally footer "N milestone(s) achieved · most recent: <label>" | Timeline.jsx:1858-1867 |
| TL-DISC-01 | PASS | — | Disclaimer block uses brand name "Sonuswealth" (FD-NAME-1 honoured) | Timeline.jsx:2504-2506 |
| TL-DISC-02 | PASS | — | `{TAX.ver} · Last verified: {entity?.dataLastUpdated \|\| 'UK-2026.1'}` | Timeline.jsx:2507 |
| TL-OVL-01 | PASS | — | GoalSeekSheet lifted; rendered at TimelineScreen root with `open={goalSeekOpen}` | Timeline.jsx:1447-1602,2491-2497 |
| TL-OVL-01a | PASS | — | 12-option `<select>` (wealthScore/riskScore/netWorth/iht + 8 plan-types) | Timeline.jsx:1500-1520 |
| TL-OVL-01b | PASS | — | `<input type="number">` for target value, no unit hint | Timeline.jsx:1521-1531 |
| TL-OVL-01c | PASS | — | "Find paths" CTA → `runGoalSeek` → `goalSeek(e, metric, +value, '12mo', { maxAction: 200000 })` | Timeline.jsx:1461-1468,1534-1544 |
| TL-OVL-01d | PASS | — | Result rows `${p.action.kind} · ${fmt(p.action.amount)}`; `slice(0, 4)` | Timeline.jsx:1550-1564 |
| TL-OVL-01e | PASS | — | "Commit this path" CTA → builds envelope (`type: metric==='wealthScore' ? 'retirement' : 'custom'`) + `commitPlan(...)` | Timeline.jsx:1470-1481,1566-1575 |
| TL-OVL-01f | PASS | — | No-paths empty state "No paths found within constraints…" | Timeline.jsx:1581-1588 |
| TL-OVL-01g | PASS | — | Close button + backdrop tap both clear results and close | Timeline.jsx:1485,1590-1598 |
| TL-OVL-02 | PASS | — | ScoreHistoryDrillPanel rendered when `drillView === 'scoreHistory'` | Timeline.jsx:1878-2076,2312-2318 |
| TL-OVL-02a | PASS | — | Back button → `onClose` → `setDrillView(null)` | Timeline.jsx:1922-1929,2316 |
| TL-OVL-02b | PASS | — | Hero twin-score (Wealth + Risk) using `fq.total`/`risk.total` (no animation in drill — different from §B) | Timeline.jsx:1937-1969 |
| TL-OVL-02c | PASS | — | 5-option range picker (1mo/3mo/6mo/12mo/all-time); local `activeRange` state only, not wired to data | Timeline.jsx:1879-1887,1971-1983 |
| TL-OVL-02d | PASS | — | Wealth sparkline card with LOW-confidence footnote when applicable | Timeline.jsx:1985-2001 |
| TL-OVL-02e | PASS | — | Risk sparkline card | Timeline.jsx:2003-2014 |
| TL-OVL-02f | PASS | — | 8-dimension breakdown bars; eyebrow hardcoded "8 dimensions" but `dims` is `Object.entries(fq.dims).length`-driven | Timeline.jsx:1896-1899,2017-2046 |
| TL-OVL-02g | PASS | — | Action levels bars from `traj` | Timeline.jsx:2049-2068 |
| TL-OVL-02h | PASS | — | Disclaimer footer "Score history is a read-only mirror · D-SCORE-JOURNEY-1 · Not regulated advice" | Timeline.jsx:2070-2072 |
| TL-OVL-03 | PASS | — | MilestoneDrillPanel rendered when `activeMilestone` set | Timeline.jsx:2083-2218,2319-2325 |
| TL-OVL-03a | PASS | — | Back button | Timeline.jsx:2125-2131 |
| TL-OVL-03b | PASS | — | Status pill Achieved/At risk/On track | Timeline.jsx:2086-2089,2147-2155 |
| TL-OVL-03c | PASS | — | Progress bar + `pctNum` | Timeline.jsx:2091-2092,2163-2178 |
| TL-OVL-03d | PASS | — | Current vs Target row when present | Timeline.jsx:2180-2200 |
| TL-OVL-03e | PASS | — | "What would push this forward?" hint card — descriptive only, no ACTION CTA (DECISION-NEEDED) | Timeline.jsx:2202-2210 |
| TL-OVL-03f | PASS | — | Disclaimer footer | Timeline.jsx:2212-2214 |
| TL-OVL-04 | PASS | — | `<ExplainerChip id="TL-1" />` invocation; content owned by shared component, not Timeline.jsx | Timeline.jsx:457 |

---

## UNLISTED

No UNLISTED elements found in `Timeline.jsx`. Every rendered interactive/data-bearing element traces to an inventory row. Layout primitives (X28TopBar, SectionHeader, FadeInOnMount, RevealStagger, DrawSVG, Num, DiffBadge, CausalityStripe, ExplainerChip) are framing/animation wrappers and not separately enumerable.

---

## UNUSED FILES (code hygiene)

| File | Status | Note |
|------|--------|------|
| `src/components/Timeline/NWTrajectoryChart.jsx` | UNUSED — FUNCTIONAL | Exists on disk; NOT imported by Timeline.jsx (grep confirms zero matches). Inventory header §"Note on unused panel files" explicitly excludes from audit but flags for founder decision. Either spec calls for it (then it's a missing element on Timeline.jsx) or it should be removed. Seed TL-S-21 confirmed. |
| `src/components/Timeline/PlansSection.jsx` | UNUSED — FUNCTIONAL | Same as above. Plan rendering lives inline in Timeline.jsx (`PlanRow`, `buildPlanRows`, `SectionE`, `PlanFundedHeadline`). |

---

## BRAND-DRIFT SWEEP (FD-NAME-1)

| Location | String | Status |
|----------|--------|--------|
| Timeline.jsx:986 | `d.impact?.finioScore` | OK in scope — internal engine field name, NOT user-visible. Display label adjacent (line 1014) reads "Wealth Score impact". Confirms inventory seed TL-S-15. Defer to Wave 4 Morph engine-comment sweep. |
| Timeline.jsx (user-visible strings) | `Sonuswealth` / `Finio` (capitalised) | ZERO matches — clean. |
| Timeline.jsx:2504 | "Not regulated financial advice. Sonuswealth models scenarios…" | PASS — brand name correct per FD-NAME-1 sentence case. |
| `src/config/brand.js` | `BRAND.name = 'Sonuswealth'` + locked tagline | Source-of-truth honoured. Note: `BRAND.finioScore` deprecated alias still in brand.js (resolves to `Sonuswealth Wealth Score`); not consumed by Timeline.jsx. |

**Verdict:** no user-visible `Sonuswealth` / `Finio` strings on Timeline. One engine-field reference (`finioScore`) is acceptable per FD-NAME-1 Wave 4 deferral.

---

## DECISION-NEEDED (for founder, not a bug)

1. **TL-PLN-12 / TL-PLN-13 / TL-DL-02 — Truncation without "View all".** `scenarios.slice(0, 4)`, `decisions.slice(0, 6)`, achieved/projected milestones `slice(0, 3)`. Plain text footer "+N more" exists for §D but no actual navigation surface. If user has > 4 scenarios or > 6 decisions, the rest are invisible. Decide: (a) add "View all" CTA per section, (b) accept truncation as a UI cap, (c) raise the cap.

2. **TL-CAL-EMPTY — Empty state without ACTION.** "No calendar entries for selected categories within the X-month horizon." has no "Reset filters" / "Show longer horizon" / "Add a date" CTA. Founder rule (§9.4 inventory + memory `feedback_screen_work_audit_first.md`) flags empty states without action. Decide: add a "Reset filters" or "Show longer horizon" affordance, or accept silence.

3. **TL-SJ-04 vs TL-OVL-02c — Range-picker asymmetry.** §B exposes 4 ranges (1mo/3mo/6mo/12mo) but ScoreHistoryDrillPanel exposes 5 (adds `all-time`). Drill's range-picker is also local state only — picking `all-time` does NOT refetch `scoreJourneyData` (per spec §5.10 D-SCORE-JOURNEY-1 read-only mirror); sparklines continue using the parent-passed window. Either add `all-time` to §B picker, remove it from drill, or wire drill picker to re-trigger the read-only mirror.

4. **TL-OVL-01b — GoalSeekSheet numeric input has no unit.** Single `<input type="number">` for all 12 metrics. `wealthScore` expects 0–100, `netWorth` expects £, `retirement` expects an age. Decide: dynamic placeholder/affix per metric, or accept.

5. **TL-OVL-01e — Plan envelope type mapping.** `type: seekTarget.metric === 'wealthScore' ? 'retirement' : 'custom'`. Picking metric `estate`/`debt`/`gift`/`protection`/`tax` commits as `custom` rather than the typed plan, breaking PlanRow status alignment for those types. Decide: map metric → planType 1:1 when metric matches a planType id, else fall back to custom.

6. **TL-OVL-03e — MilestoneDrillPanel "What would push this forward?" is descriptive only.** No ACTION CTA (e.g. "Open Goal Seek for this milestone"). May be intentional read-only per spec — founder confirms.

7. **TL-CAL-04 — `'6 Apr 2027'` hardcoded date.** Engine-bundle (`TAX.deadline` / `BRAND.nextRulesDate = '2027-04-06'`) is the SoT. After 6 Apr 2027 the label will not roll forward. Decide: read from `BRAND.nextRulesDate` or `TAX.deadline`, or accept hardcode until post-2027 sweep.

8. **TL-CAL-06 — `31 Jan ${yr+1}` computed from local `new Date()`, not bundle.** Drift risk if rules-bundle ever decouples HMRC SA deadline from calendar year. Decide: leave as is or move to bundle (`TAX.saDeadline`).

9. **TL-X28-04 — `dataDate` fallback is `'UK-2026.1'`.** That's a rules-bundle string, not a date. Verify fallback is intentional or change to `BRAND.dataDate` (`'April 2026'`).

10. **TL-SJ-10 / TL-SJ-12 / TL-PLN-HEAD — internal spec refs at user-visible level.** "(spec §X28.6)" in the plan-active banner; "§E" in the no-plan hint; "goal-seek" in §E header purpose. Out of scope for A1; logged for plain-English auditor.

11. **NWTrajectoryChart.jsx / PlansSection.jsx unused.** Confirmed not imported. Either wire them in (spec calls?) or remove to keep build target honest.

---

## COVERAGE

- Total inventory rows tested: **130 / 130** (100%).
- Verdicts: **128 PASS · 2 FAIL · 0 NA**.
- FAIL severity: **0 DEMO-BLOCKING · 2 FUNCTIONAL · 0 POLISH**.
- UNLISTED: **0**.
- Unused-files findings (out-of-table): 2 (NWTrajectoryChart.jsx, PlansSection.jsx) — both FUNCTIONAL code-hygiene per inventory header.

**TL conformance: 128 PASS, 2 FAIL (0 DB, 2 F, 0 P), 0 UNLISTED.**
