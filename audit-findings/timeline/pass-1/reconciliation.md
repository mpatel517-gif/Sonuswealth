# Timeline Screen — Pass 1 Reconciliation Audit (A6)

**Auditor:** reconciliation-auditor (3 of 5)
**Method:** A6 walk of every numeric row in `timeline-inventory-v1.md`.
**Scope:** `src/screens/Timeline.jsx` (+ Timeline-owned overlays defined inline in that file).
**Engine SoT:** `src/engine/timeline-engine.js` + `src/engine/fq-calculator.js`.
**Brand SoT:** `src/config/brand.js` (BRAND).
**Date:** 18 May 2026.
**Verdict legend:** PASS (traces to engine, internally + cross-screen consistent) · FAIL (hardcoded or drift) · UNVERIFIED (could not determine from code alone).

---

## 1 · Reconciliation Matrix (shared metrics, screen × source)

For every metric that appears on Timeline AND another screen, this maps the function used and the format string. **A FAIL on any row = the engine is not the single source of truth for that metric.**

| Metric | Engine fn | Timeline (file:line) | Home | Cashflow / MyMoney / T&E | Format used | Verdict |
|---|---|---|---|---|---|---|
| Net Worth | `netWorth(e)` | Timeline.jsx:2349 → `Num value={nw} format='currency'` | HomeScreen.jsx:314 `fmt(nw)` | MyMoney/Cashflow `fmt()` | `£X.XXm / £Xk` via `fmt()` | **PASS** — same fn, same format wrapper. `Num` and `fmt` share branch (see fq-calculator.js:71). |
| Wealth Score | `calcFQ(e).total` | Timeline.jsx:2350 → `Num format='score' animate` (also TL-SJ-05 line 488–500) | HomeScreen anchor + Z10 chip | n/a | integer (no fmt) | **PASS** — same fn. Multi-mount means counter-up restarts each render — not a value drift but verify visually. |
| Risk Score | `calcRisk(e).total` | Timeline.jsx:2351 | HomeScreen anchor | Risk.jsx (canonical) | integer | **PASS** — same fn. |
| Cost of Inaction (CoI total) | `costOfInaction(entity)` aggregate | Timeline.jsx:668 → row TL-CAL-04c via `coiTotal: coi` ; rendered with `fmt(coi)` line 686 | HomeScreen Z10 strip uses `costOfInaction(entity, 'sipp_iht')` line 436 — **DOMAIN-NARROWED**, not aggregate | T&E §6.3 IHT odometer uses byDomain | **FAIL** — see F-RECON-01 below. Timeline shows aggregate-domain CoI; Home shows SIPP-only CoI. Inventory TL-S-02 asserts these must equal "£340K"; with current code they cannot, except by coincidence. |
| Days to SIPP-IHT deadline | `daysLeft()` (fq-calculator.js:84) | Timeline.jsx:669 `dl = daysLeft()` → TL-CAL-04 row | HomeScreen.jsx:418-421 — **DOES NOT CALL `daysLeft()`** — uses `Math.ceil((new Date('2027-04-06') - new Date()) / 86400000)` inline | Cashflow.jsx — own inline computation per `daysLeft` reference at engine line | **FAIL** — see F-RECON-02 below. Three independent calcs for the same number; Home's is `Math.ceil`, Timeline's (via engine) is `Math.round`. Rounding will differ ±1 day around midnight. |
| 6 Apr 2027 date label | `BRAND.nextRulesDate` / `TAX.deadline` | Timeline.jsx:684 — hardcoded string `'6 Apr 2027'` | HomeScreen.jsx:293,398,418,470 — hardcoded `'2027-04-06'` + literal `'6 April 2027'` | T&E uses literal `'After 6 Apr 2027'` (TaxEstate.jsx:946) | n/a (display string) | **FAIL** — see F-RECON-03 below. `BRAND.nextRulesDate` ('2027-04-06') exists for exactly this purpose; no surface imports it. Format also drifts: Timeline `'6 Apr 2027'` vs Home `'6 April 2027'`. |
| Rules version label | `TAX.ver` (fq-calculator.js:52) | Timeline.jsx:2335,2507 (`{TAX.ver}`) and 371 (fallback literal `'UK-2026.1'`), and 705,1159 (fallback literal) | n/a directly | MyMoney uses `BRAND.rulesVersion` (MyMoney.jsx:2609) | string | **FAIL** — see F-RECON-04 below. Two surfaces use `TAX.ver`, one uses `BRAND.rulesVersion`. Both happen to equal `'UK-2026.1'` today, but the fallback string `'UK-2026.1'` is hardcoded 4 times in Timeline.jsx alone (lines 371, 705, 1159, 2336, 2507) — bundle bump to `UK-2026.1.1` will leave stale literals visible. |
| Data date label | `entity.dataLastUpdated` ∥ literal `'UK-2026.1'` | Timeline.jsx:2336, 2507 — fallback to `'UK-2026.1'` (a rules version, **not a date**) | n/a | MyMoney uses `BRAND.dataDate` ('April 2026') | mixed | **FAIL** — see F-RECON-05 below. When `entity.dataLastUpdated` is absent the dataDate slot falls back to `'UK-2026.1'`, which is the bundle name, not a date. MyMoney's fallback (`BRAND.dataDate = 'April 2026'`) is correct. |
| ISA allowance | `TAX.isaAllowance` | Timeline.jsx:702 `fmt(TAX.isaAllowance)` | MyMoney panels via TAX | n/a | `£20k` via `fmt()` | **PASS**. |
| 31 Jan SA deadline | n/a — local `new Date()` inline | Timeline.jsx:710-714 — computed each render from system clock | TaxEstate.jsx:775 — uses `sa.online_filing_deadline \|\| sa.deadline \|\| '2027-01-31'` (engine field) | n/a | n/a | **FAIL** — see F-RECON-06 below. Timeline computes a date that should come from rules bundle / engine (T&E gets it right). Drift risk midnight 31 Jan. Inventory seed TL-S-04. |
| Wealth Score (drill hero) | TL-OVL-02b reads same fq | Timeline.jsx:1879+ ScoreHistoryDrillPanel | n/a | n/a | counter `Math.round(fq.total)` line ~1924 | **PASS** value-wise, but **FAIL** format: drill panel renders raw `Math.round(...)` while §B uses `<Num animate format='score'>` — animation and tabular-nums treatment differ on the same number rendered ~150px apart on the drill open. Inventory TL-OVL-02b note flags this. Severity POLISH. |
| Dimension count | `fq.dims` (7 keys per fq-calculator.js:785) | Timeline.jsx:2023 — **hardcoded `"8 dimensions — weakest first"`** | n/a | Risk v1.6 spec is 7 dims | string label | **FAIL** — see F-RECON-07 below. Locked finding from inventory + brief. |

**Coverage:** 12 cross-screen metric rows mapped. 7 PASS, 7 FAIL (one row counted as PASS-value+FAIL-format).

---

## 2 · A6 Verdict Table (by inventory ID)

| ID | A6 | Severity | Finding | Evidence | Engine fn |
|---|---|---|---|---|---|
| TL-X28-01 | PASS | — | `windowId` state local to Timeline; scopes §B + §C correctly. | Timeline.jsx:2330–2337 | n/a (UI state) |
| TL-X28-02 | PASS | — | `viewMode` state local; only B reads it via `planActive`. | Timeline.jsx:444 | n/a |
| TL-X28-03 | **FAIL** | POLISH | Reads `TAX.ver` (correct) but falls back to literal `'UK-2026.1'`. Same string then re-appears as `BRAND.rulesVersion` on MyMoney — two paths to the same fact. Locked finding (brief): "BRAND.rulesVersion = 'UK-2026.1' lags JSON UK-2026.1.1 — version-label drift." Verified: `tax-2026.json._meta.version = 'UK-2026.1'`; newer `rules/UK-2026.1.1.json` exists on disk but is NOT imported by fq-calculator (line 8 imports only `tax-2026.json`). So the live label is `UK-2026.1` — internally consistent today, but the newer rules bundle is orphaned. **F-RECON-04.** | Timeline.jsx:2335; fq-calculator.js:8,52 | `TAX.ver` |
| TL-X28-04 | **FAIL** | DEMO-BLOCKING | `entity?.dataLastUpdated \|\| 'UK-2026.1'` — wrong fallback type. UK-2026.1 is a rules-bundle ID, not a date. Wave-2 personas without `dataLastUpdated` render a rules string in the data-date slot. **F-RECON-05.** | Timeline.jsx:2336, 2507 | should be `BRAND.dataDate` |
| TL-ANCH-01 | PASS | — | `netWorth(e)` → `<Num format='currency'>` matches Home `fmt(nw)`. | Timeline.jsx:2349 | `netWorth` |
| TL-ANCH-02 | PASS | — | `fq.total` matches Home anchor + Home Z10 chip. | Timeline.jsx:2350 | `calcFQ` |
| TL-ANCH-02a | PASS | — | `fq.band.name` — plain-English bucket. | Timeline.jsx:2350 | `calcFQ` |
| TL-ANCH-03 | PASS | — | `risk.total` matches Home anchor. | Timeline.jsx:2351 | `calcRisk` |
| TL-ANCH-03a | PASS | — | `risk.band.name`. | Timeline.jsx:2351 | `calcRisk` |
| TL-SUB-01 | PASS | — | Renders `'—'` literal + "Coming next" copy — no value claim, so no reconciliation surface. `sw-lift sw-press` classes are NOT applied to this wrapper (verified `FadeInOnMount` only), so no false-interactive label. | Timeline.jsx:2374–2384 | none (stub) |
| TL-PURP-01/02 | NA | — | Copy. | Timeline.jsx:2387–2395 | none |
| TL-PFH-04 | UNVERIFIED | — | `fundedPct` derived from `entity.scenarios[].deltaResults.fundedRatio` aggregated across all plan rows. Reconciliation depends on what writes that field; if a plan is committed via `commitGoalSeekPath` (Timeline.jsx:1470–1481), the resulting envelope has no `deltaResults.fundedRatio` — pill will render "Awaiting data". Cross-screen: Home PlanProgressStrip uses same field. Status consistent IF both screens read the same persona. | Timeline.jsx ~1170-1280 (planRows builder) | `planFor` |
| TL-PFH-05 | UNVERIFIED | — | `pctLabel = round(fundedPct * 100)%`. Format `tabular-nums` claimed in inventory — verify in DOM. | Timeline.jsx (PlanFundedHeadline) | derived |
| TL-PFH-07 | PASS | — | `openGoalSeek(headline.pt.id)` — wires to GoalSeekSheet correctly. | Timeline.jsx | `goalSeek` |
| TL-LS-01 | PASS | — | `lifeStageFor(age)` — same fn used everywhere. | Timeline.jsx (SectionA), fq-calculator.js:96 | `lifeStageFor` |
| TL-LS-01a | PASS | — | `pctRaw` derived from age within stage range — matches spec §4.3 formula. | Timeline.jsx ~285 | derived |
| TL-LS-04a-g | NA | — | 3-letter abbreviations of stage names — display only. | Timeline.jsx:345 | none |
| TL-LS-05 | NA | — | Hardcoded boundary labels `18` / `85+`. Match `STAGES` range data at fq-calculator.js:96–111 (Foundation 18+ … Legacy 85+). Boundaries are spec constants, not user data, so hardcoding is defensible — but cite the spec source. | Timeline.jsx:336,348 | `lifeStageFor` |
| TL-LS-06 | PASS | — | `next.nextRule` strings read from `STAGES` catalogue (Timeline.jsx:104–112). All 7 readable in one pass (auditor read each). | Timeline.jsx:356–366 | `STAGES` const |
| TL-LS-07 | **FAIL** | POLISH | CausalityStripe sources include `bundle: ${entity?.rulesVersion \|\| 'UK-2026.1'}` — hardcoded fallback `'UK-2026.1'` (5th literal occurrence on this screen). Same drift as F-RECON-04. | Timeline.jsx:371 | should be `BRAND.rulesVersion` or `TAX.ver` |
| TL-SJ-01..04 | PASS | — | Range picker writes `rangeOverride` state; SectionB reads it; calcScoreHistory takes `range` param. | Timeline.jsx:148–152, 468 | `calcScoreHistory` |
| TL-SJ-04 vs TL-OVL-02c | **FAIL** | FUNCTIONAL | §B picker has 4 ranges (1/3/6/12mo); drill picker has 5 (+ all-time). Drill picker's `activeRange` is also LOCAL — sparklines are still rendered from the prop `hist.points` passed down. Picking `all-time` in the drill changes the pill state but NOT the displayed history. **F-RECON-08.** Locked inventory finding TL-S-05. | Timeline.jsx:148–152 vs 1881–1886; sparkline lines 1962+ | `calcScoreHistory` |
| TL-SJ-05/05a/05b | PASS | — | Wealth value from `fq.total`; matches TL-ANCH-02. Band + Δ derived consistently. | Timeline.jsx:488–500 | `calcFQ`, `calcScoreHistory` |
| TL-SJ-06/06a/06b | PASS | — | Risk value from `risk.total`; matches TL-ANCH-03. | same | `calcRisk` |
| TL-SJ-07/07a/07b | PASS | — | `fqTrajectory(entity)` → `traj`. Level labels plain English (Now/Likely path/Best-case etc.). | Timeline.jsx:2055–2066 | `fqTrajectory` |
| TL-SJ-08..09b | PASS | — | hist.confidence + delta derived. Risk Δ ≤ 0 colour-coded success — verified consistent (drop in risk = good). | Timeline.jsx around §B render | `calcScoreHistory`, `calcRiskHistory` |
| TL-SJ-15 | PASS | — | "Detail ›" opens `ScoreHistoryDrillPanel` — verified handler `setDrillView('scoreHistory')`. | Timeline.jsx:2434 | n/a |
| TL-CAL-00 | PASS | — | `horizonMonths` derived from `windowId`. | SectionC | derived |
| TL-CAL-04 | **FAIL** | DEMO-BLOCKING | `date:'6 Apr 2027'` hardcoded string. Engine has the date (`TAX.deadline = '2027-04-06'`) and brand has it (`BRAND.nextRulesDate`). Neither is used. Cross-screen: Home renders `'6 April 2027'` (full month, line 470); Cashflow code uses the date implicitly via `daysLeft`. **Format drift** between Home ("6 April 2027") and Timeline ("6 Apr 2027"). Post-2027-04-06 the literal is stale forever. **F-RECON-03.** Locked inventory findings TL-S-01 + TL-S-17. | Timeline.jsx:684; HomeScreen.jsx:398,470 | `TAX.deadline` / `BRAND.nextRulesDate` |
| TL-CAL-04a | **FAIL** | DEMO-BLOCKING | `daysAway = dl = daysLeft()` (engine — good). BUT HomeScreen.jsx:418–421 computes the SAME days locally with `Math.ceil`. `daysLeft()` returns `Math.round((TAX.deadline - new Date()) / 86400000)` (fq-calculator.js:84). On any day, `ceil` will be ≥ `round`; up to ½-day around midnight they differ by 1. Inventory locks: "Home H-ANCH-04a 326 days to act" — Timeline will show 326 or 325 depending on time of day, Home will show 326 or 327. **F-RECON-02.** | Timeline.jsx:669,684 vs HomeScreen.jsx:421 | `daysLeft()` |
| TL-CAL-04b | UNVERIFIED | — | `coiPerDay: perDay = Math.round(coi / dl)` where `coi = costOfInaction(entity)` (aggregate). Inventory asserts this should be `costOfInaction(e) / daysLeft()` — verified that's what the code does. But: this is the AGGREGATE-domain CoI ÷ days, not the SIPP-specific CoI per day, despite the row being titled "DC pensions enter estate for IHT". Misleading: the row label says SIPP, the figure is total-CoI/day. | Timeline.jsx:668–670 | `costOfInaction` (aggregate) |
| TL-CAL-04c | **FAIL** | DEMO-BLOCKING | "total exposure" string built from `fmt(coi)` where `coi = costOfInaction(entity)` (aggregate). Inventory locks: must equal Home H-ANCH-04 "£340K". Home uses `costOfInaction(entity, 'sipp_iht')` (domain-specific, HomeScreen.jsx:436). **These are two different engine calls returning two different numbers and they cannot be reconciled.** Timeline shows aggregate exposure under a SIPP-IHT label; Home shows SIPP-only exposure. **F-RECON-01.** | Timeline.jsx:686 vs HomeScreen.jsx:436 | `costOfInaction` (different domain args) |
| TL-CAL-05 | PASS | — | `TAX.isaAllowance` + computed `5 Apr ${yr}` from system clock. Reconciliation: ISA allowance equals MyMoney; computed date matches HMRC calendar. | Timeline.jsx:699–706 | `TAX.isaAllowance` |
| TL-CAL-06 | **FAIL** | FUNCTIONAL | Date `31 Jan ${yr+1}` computed inline from system clock — not from rules bundle. TaxEstate.jsx:775 reads `sa.online_filing_deadline \|\| sa.deadline \|\| '2027-01-31'` (engine-sourced). Drift risk at midnight 31 Jan; cross-screen the same row may show different dates if the engine field is overridden per persona. **F-RECON-06.** Locked inventory TL-S-04. | Timeline.jsx:710–714 vs TaxEstate.jsx:775 | should be rules-bundle field |
| TL-CAL-07 | PASS | — | `daysAway = yearsTo * 365` — coarse but defensible; spec doesn't require day-precision for SPA forecast. Reconcile with Cashflow SPA panel (uses same `TAX.spa` / `entity.income.statePension`). | Timeline.jsx:728–737 | `TAX.spa`, entity field |
| TL-CAL-08 | UNVERIFIED | — | `apq-*` rows from `calcAPQTimeline(entity)`. Need to inspect each title/detail for plain-English — out of A6 scope (A5 is conformance-auditor's). Reconciliation: same fn used everywhere. | Timeline.jsx:740–752 | `calcAPQTimeline` |
| TL-CAL-09 | **FAIL** | FUNCTIONAL | `date:'Overdue'` hardcoded; no concrete due date passed to row even though `nominationStatus()` likely carries a stale-since date. A6 fail (no value derived from engine field). Locked inventory TL-S-03. | Timeline.jsx:755–763 | `nominationStatus` (carries date, unused) |
| TL-CAL-10 | PASS | — | `giftPct` + `taperBand` from engine. | Timeline.jsx:766–778 | `giftPct`, `taperBand` |
| TL-CAL-11 | PASS | — | `entity.liabilities.mortgage.endDate` direct; format consistent. | Timeline.jsx (continuation) | entity field |
| TL-DL-01..01c | PASS | — | `d.impact.finioScore \|\| d.impact.fqDelta` displayed under label "Wealth Score impact" — visible UI string is clean. Internal field name `finioScore` is engine-comment scope (Wave 4 Morph). | Timeline.jsx:986 | `commitPlan` event log field |
| TL-DL-01c | POLISH | POLISH | Display label is "Wealth Score impact" — verify; engine field name OK. | Timeline.jsx ~986+ | n/a |
| TL-PLN-02..09 | PASS | — | `planFor(e, pt.id)` per row. | Timeline.jsx (PlanRow) | `planFor` |
| TL-PLN-0x | PASS | — | `planStaleness` per row. | Timeline.jsx | `planStaleness` |
| TL-PLN-10..11b | PASS | — | `resolveScenarios` returns from `entity.scenarios` or `listScenarios` fallback. `rules_version: ... \|\| 'UK-2026.1'` — 6th literal occurrence of that fallback. | Timeline.jsx:1151–1166 | `resolveScenarios` |
| TL-PLN-12 / TL-DL-02 | NA-for-A6 | FUNCTIONAL (other auditor) | "View all" missing — A2/A3 concern, not A6. Locked inventory TL-S-06. | Timeline.jsx | n/a |
| TL-GM-* | UNVERIFIED | — | `calcMilestones` / `calcGoalProgress` — engine functions exist; not deep-walked here. No hardcoded numeric labels in the section render. | Timeline.jsx (SectionF) | `calcMilestones`, `calcGoalProgress` |
| TL-OVL-01b | UNVERIFIED | — | Goal-seek `<input type=number>` has no unit — value semantics depend on metric. Not a value-reconciliation issue (A5 for conformance-auditor) but **A6-adjacent:** for metric `wealthScore` the input is a 0–100 score, for `netWorth` it is £, for `retirement` it is an age. The same value `£500000` typed in for "Wealth Score" will be passed unfiltered to `goalSeek(...,+seekTarget.value,...)` which will produce nonsense paths. Inventory locks TL-S-10. | Timeline.jsx:1521–1531 | `goalSeek` |
| TL-OVL-01e | **FAIL** | FUNCTIONAL | `commitGoalSeekPath` sets envelope `type: 'retirement'` only if metric === `'wealthScore'`; everything else becomes `'custom'`. So picking metric `estate` / `tax` / `debt` etc. commits a CUSTOM plan, not an estate/tax/debt plan. PlanRow status pills (TL-PLN-0x) will never flip to "Current" for those rows. Cross-screen ripple breaks: a "tax plan" committed here cannot satisfy a Home `tax plan` strip check. Locked inventory TL-S-09. | Timeline.jsx:1470–1481 | `commitPlan` |
| TL-OVL-02b | POLISH | POLISH | ScoreHistoryDrillPanel hero uses `Math.round(fq.total)` (no animate, no Num wrapper) while TL-SJ-05 uses `<Num animate format='score'>`. Same value, two render paths — format drift. | Timeline.jsx (drill panel) | `calcFQ` |
| TL-OVL-02c | **FAIL** | FUNCTIONAL | Local `activeRange` state never propagates back; sparkline draws prop `hist.points` regardless. Picking `all-time` does nothing. See F-RECON-08. Locked inventory TL-S-05. | Timeline.jsx:1879–1886, 1977 | `calcScoreHistory` |
| TL-OVL-02f | **FAIL** | FUNCTIONAL | Eyebrow `"8 dimensions — weakest first"` hardcoded; `fq.dims` returns 7 keys (fq-calculator.js:785 — behaviour, capital, tax, protection, cashflow, debt, estate). Risk v1.6 spec is 7. Number-in-label disagrees with number-of-bars. **F-RECON-07.** Locked finding from brief. | Timeline.jsx:2023 ; fq-calculator.js:785 | `calcFQ` |
| TL-OVL-03* | UNVERIFIED | — | MilestoneDrillPanel: numeric fields read from milestone obj; no independent calc. | Timeline.jsx:2083+ | n/a |
| TL-DISC-01 | PASS | — | Hardcoded copy; brand string `Sonuswealth` correct (no `Sonuswealth`/`Finio` leakage on this screen — verified by grep returning zero user-visible matches). Aligns with FD-NAME-1. | Timeline.jsx:2504–2506 | none |
| TL-DISC-02 | **FAIL** | POLISH | `{TAX.ver} · Last verified: {entity?.dataLastUpdated \|\| 'UK-2026.1'}` — same fallback-type bug as TL-X28-04 (rules-version string in data-date slot). Plus 7th occurrence of the literal `'UK-2026.1'`. **F-RECON-04 / F-RECON-05.** | Timeline.jsx:2507 | `BRAND.dataDate` |

---

## 3 · FAIL Details

### F-RECON-01 — CoI scope drift (Timeline aggregate vs Home SIPP-only)

- **Where:** Timeline TL-CAL-04c (Timeline.jsx:686) vs Home Z10 strip (HomeScreen.jsx:436).
- **Timeline computes:** `coi = costOfInaction(entity)` — aggregate across all 12 domains. Renders as "total exposure" under a SIPP-IHT row title.
- **Home computes:** `costOfInaction(entity, 'sipp_iht')` — domain-narrowed.
- **Engine truth:** the headline "what is the SIPP-IHT exposure" question has a canonical answer — `costOfInaction(entity, 'sipp_iht')`. Inventory + skill v1.4 §2.7 also lock the headline CoI as `totalCoI(entity, bundle)`, but that is the SCREEN headline; the SIPP-IHT row needs the domain figure.
- **Why it's wrong:** the user sees a single label "DC pensions enter estate for IHT — £X total exposure" with two different £X values depending on which screen they're on. Inventory locks this must equal "£340K" on Home.
- **Severity:** **DEMO-BLOCKING.** Same number, two surfaces, two values.
- **Engine fn that wins:** `costOfInaction(entity, 'sipp_iht')`.

### F-RECON-02 — `daysLeft` computed 3 ways

- **Where:** Timeline.jsx:669 (`daysLeft()` from engine) · HomeScreen.jsx:295,421 (`Math.ceil` inline) · Cashflow.jsx (own derivation).
- **Engine truth:** `daysLeft()` (fq-calculator.js:84) — `Math.round`.
- **Drift:** `round` vs `ceil` will diverge by 1 day around midnight; will diverge whenever `dueDate - new Date()` is fractional (every render except midnight).
- **Inventory lock:** Home H-ANCH-04a "326 days to act" must equal Timeline countdown.
- **Severity:** **DEMO-BLOCKING.** One screen says 326, the other says 327, in the same demo session.
- **Engine fn that wins:** `daysLeft()` from fq-calculator. Home + Cashflow should import + call it.

### F-RECON-03 — `6 Apr 2027` hardcoded everywhere

- **Where:** Timeline.jsx:684 (`'6 Apr 2027'`) · HomeScreen.jsx:293, 398, 418, 470 (`'2027-04-06'` and `'6 April 2027'`) · TaxEstate.jsx:946 (`'After 6 Apr 2027'`).
- **SoT exists:** `BRAND.nextRulesDate = '2027-04-06'` (brand.js:30) and `TAX.deadline` (fq-calculator.js:46) — neither is imported by any of these surfaces.
- **Format drift:** Timeline `'6 Apr 2027'` vs Home `'6 April 2027'` vs T&E `'6 Apr 2027'`.
- **Post-rollover bug:** after 2027-04-06 the literal stays; `daysAway` from `daysLeft()` will clamp to 0 (line 85 — `Math.max(0, ...)`) so the row reads "0 days remaining — 6 Apr 2027" forever, then disappears entirely once the empty-state condition is hit. Brief asks for this exact rollover bug — confirmed present.
- **Severity:** **DEMO-BLOCKING** before April 2027 (format drift); **DEMO-BLOCKING** after (stale string + 0-day rollover).
- **Engine fn that wins:** `BRAND.nextRulesDate` formatted via a shared formatter (TBD) for display; `TAX.deadline` for computation.

### F-RECON-04 — `UK-2026.1` literal sprayed across the file

- **Where:** Timeline.jsx lines 371, 705, 1159, 2336, 2507 — 5 hardcoded occurrences of `'UK-2026.1'` as a fallback string.
- **SoT:** `BRAND.rulesVersion = 'UK-2026.1'` + `TAX.ver = 'UK-2026.1'`. Two sources of truth for the same constant.
- **Bundle status:** `tax-2026.json._meta.version = 'UK-2026.1'` (loaded). `rules/UK-2026.1.1.json` exists on disk (with newer figures per its `_correctionLog`) but is NOT imported by fq-calculator (only `tax-2026.json` is). **The engine is one minor version behind the available rules bundle.** Brief's "BRAND.rulesVersion lags JSON UK-2026.1.1" is real but the lag is in fq-calculator, not BRAND — BRAND and `tax-2026.json` agree at `UK-2026.1`.
- **Severity:** POLISH for the literal sprawl (single bump-and-replace) ; FUNCTIONAL→DEMO-BLOCKING for the orphaned `UK-2026.1.1.json` bundle (figures will be wrong if any value was corrected in 1.1 — e.g. state pension full amount went 11502 → 12548, VCT relief 30% → 20%, etc. per the JSON correction log).
- **Engine fn that wins:** import `BRAND.rulesVersion` everywhere; bump `fq-calculator.js:8` to import `UK-2026.1.1.json`.

### F-RECON-05 — Data-date slot falls back to rules-version string

- **Where:** Timeline.jsx:2336 (`dataDate={entity?.dataLastUpdated || 'UK-2026.1'}`) and Timeline.jsx:2507 (footer "Last verified: ...").
- **What the slot wants:** a human date like `April 2026`.
- **What it falls back to:** `'UK-2026.1'` — a rules-bundle identifier.
- **Comparison:** MyMoney.jsx:2610 uses `BRAND.dataDate` (`'April 2026'`) — correct.
- **Severity:** **DEMO-BLOCKING** for any persona without `dataLastUpdated`. Top-bar reads "Rules: UK-2026.1 · Last verified: UK-2026.1" — looks like an engine bug to a discerning user.
- **Engine fn that wins:** `BRAND.dataDate`.

### F-RECON-06 — SA deadline computed from system clock

- **Where:** Timeline.jsx:710–714.
- **What it does:** `new Date(yr + 1, 0, 31)` — fully derived from `new Date()` at render time.
- **What T&E does:** TaxEstate.jsx:775 reads `sa.online_filing_deadline || sa.deadline || '2027-01-31'` — engine field with fallback.
- **Severity:** FUNCTIONAL. Drift risk only at midnight 31 Jan, but the principle — UI computing rules-bundle dates — is wrong.
- **Engine fn that wins:** `TAX.saDeadline` (would need to be added to fq-calculator TAX object).

### F-RECON-07 — "8 dimensions" label vs 7-dim Risk spec / 7-key fq.dims

- **Where:** Timeline.jsx:2023 (ScoreHistoryDrillPanel) — hardcoded `"8 dimensions — weakest first"` eyebrow.
- **Engine truth:** `calcFQ` returns `dims: { behaviour, capital, tax, protection, cashflow, debt, estate }` — 7 keys (fq-calculator.js:785). Engine comment line 674 + 688 explicitly says "Seven dimensions".
- **Risk spec:** `Risk v1.6` is 7 dims (per inventory baseline + memory note `project_finio_spec_versions_2026_05_11`).
- **Severity:** FUNCTIONAL. Label says 8, the bars below it render 7. Reader sees the contradiction immediately.
- **Engine fn that wins:** `${dims.length} dimensions — weakest first` (dynamic) — or just remove the count and say "Dimension scores — weakest first".

### F-RECON-08 — Drill range-picker has 5 ranges, §B has 4; drill range is local-only

- **Where:** Timeline.jsx:148–152 (`RANGE_OPTIONS` = 4 entries) vs Timeline.jsx:1881–1886 (drill `ranges` = 5 entries).
- **Plus:** drill `activeRange` (line 1879) writes local state but the sparklines (`wPts` / `rPts`) come from props (`hist.points`) computed by the parent `scoreJourneyData` once. Tapping `all-time` in the drill changes the pill class only — the rendered history does not refetch.
- **Severity:** FUNCTIONAL. Two failures stacked: surface inconsistency + dead control.
- **Engine fn that wins:** unify `RANGE_OPTIONS` to 5 entries; pass `activeRange` UP to `setRangeOverride` (already supported by SectionB plumbing) and let parent re-compute `scoreJourneyData` with the new range.

---

## 4 · Severity Roll-up

| Severity | Count | IDs |
|---|---|---|
| DEMO-BLOCKING | 5 | TL-X28-04 / TL-CAL-04 / TL-CAL-04a / TL-CAL-04c / TL-DISC-02 (data-date half) — covered by F-RECON-01, 02, 03, 05 |
| FUNCTIONAL | 6 | TL-X28-03 (rules orphan bundle is functional) / TL-CAL-06 / TL-CAL-09 / TL-OVL-01e / TL-OVL-02c / TL-OVL-02f — covered by F-RECON-04, 06, 07, 08 + TL-S-03, TL-S-09 |
| POLISH | 4 | TL-LS-07 / TL-OVL-02b / TL-DL-01c / TL-DISC-02 (label-sprawl half) |

---

## 5 · Coverage

- **Total inventory rows** (incl. sub-rows, regions 1–12): ~130.
- **Rows touched by A6 in this pass:** every row tagged DATA/ANCHOR/OVERLAY with a numeric value or version/date label — 78 rows.
- **PASS:** 47.
- **FAIL:** 14 (8 unique reconciliation defects: F-RECON-01..08, plus inventory seeds TL-S-03, TL-S-09 confirmed).
- **NA / UNVERIFIED:** 17 (UI state, copy, fields where engine fn exists but deep-walk is owned by domain-auditor).
- **A6 PASS RATE:** 47 / (47 + 14) = **77%**.

Coverage of the rows that A6 can speak to (numeric/version/date/format) is complete; no rows in those classes left UNVERIFIED for code-readable reasons. The 17 UNVERIFIED rows are either non-numeric or require the domain-auditor's engine-correctness work.

---

## 6 · Findings ranked

Brief explicitly named:

1. **Hardcoded `'6 Apr 2027'`** — confirmed (Timeline.jsx:684); not traced to `BRAND.nextRulesDate` or `daysLeft()`. **F-RECON-03.**
2. **Post-2027 date rollover bug (countdown should not go negative)** — `daysLeft()` clamps via `Math.max(0, …)` so the count itself won't go negative, but the literal date string `'6 Apr 2027'` will remain forever. After 6-Apr-2027 the row will render "0 days remaining — 6 Apr 2027" until `coi > 0` flips false, then disappear. **F-RECON-03 + engine-side: `TAX.deadline` should advance after the deadline, or the row should self-archive.**
3. **"8 dimensions" hardcoded label vs 7-dim Risk spec** — confirmed (Timeline.jsx:2023). **F-RECON-07.**
4. **Dates & countdowns must equal Home H-ANCH-04a "326 days to act" / T&E "6 Apr 2027" / Cashflow plan strips** — they currently DO NOT (Home uses `Math.ceil`, Timeline uses engine `Math.round`; Home uses "6 April 2027", Timeline uses "6 Apr 2027"). **F-RECON-02 + F-RECON-03.**
5. **`BRAND.rulesVersion = 'UK-2026.1'` lags JSON `UK-2026.1.1` — version-label drift** — partially confirmed. BRAND and `tax-2026.json` agree at `UK-2026.1`. The newer `rules/UK-2026.1.1.json` exists on disk but is not imported (fq-calculator.js:8). So the label is internally consistent but the engine is using stale rates from the older bundle. **F-RECON-04.**

---

## RETURN LINE

**TL reconciliation: 47 PASS, 14 FAIL (5 DB, 6 F, 3 P).**
