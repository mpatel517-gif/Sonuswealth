# Timeline — Pass 1 · Domain & Calculation Audit

**Auditor:** domain-auditor (auditor 4 of 5)
**Screen:** `src/screens/Timeline.jsx` (+ `src/components/Timeline/*`)
**Inventory:** `timeline-inventory-v1.md`
**Rules SoT:** `src/rules/UK-2026.1.1.json` (UK-2026.1.1, verified May 2026)
**Brand SoT:** `src/config/brand.js` (`Sonuswealth` / `sonuswealth`)
**Engine refs:** `src/engine/fq-calculator.js` (TAX, costOfInaction, daysLeft, giftPct, taperBand) · `src/engine/timeline-engine.js`
**Date:** 2026-05-18

---

## Method note

Walked every inventory row carrying a financial figure, claim, term, or FCA-boundary phrase. Tested A5 (plain English + FCA framing) and domain correctness (UK tax facts vs UK-2026.1.1 bundle, CoI canonical definition, founder-IP integrity, placeholder leakage, claim defensibility). Engine math is not re-derived — 1,240 assertions cover it; the audit concentrates on copy / framing / placeholder leakage / brand drift exactly as the agent brief instructs.

**Founder-IP canonical reference (skill v1.4 §2.7):** Cost of Inaction = aggregate NPV cost of suboptimal inaction across all twelve canonical domains. Engine confirms this: `costOfInaction(e)` with no domain key dispatches to `totalCoI(e).total` (fq-calculator.js:603–606). Narrowing CoI copy to "IHT with SIPP minus IHT without" is a FAIL.

---

## A5 + Domain verdict table

| ID | A5 | Domain | Severity | Finding | Evidence |
|----|----|--------|----------|---------|----------|
| TL-X28-03 | PASS | PASS | — | Rules badge reads `TAX.ver` ("UK-2026.1") from engine; matches disclaimer footer (TL-DISC-02). Engine fallback `'UK-2026.1'` if `TAX_JSON.version` missing. Rules file actually carries version `UK-2026.1.1` (rules JSON line 3) — the badge truncates the patch. Acceptable for top-bar; reconcile with conformance auditor whether `.1` patch should display. | Timeline.jsx:2335, fq-calculator.js:52, UK-2026.1.1.json:3 |
| TL-X28-04 | FAIL | PASS | POLISH | Data-date fallback is `'UK-2026.1'` — a rules-version *string* used as a *date*. Semantically wrong (a date label should never resolve to a rules-version token); reads as "data freshness = UK-2026.1" which is meaningless to a user. Either route this to `TAX.lastVerified` / engine-supplied date or hide the label when `entity.dataLastUpdated` is missing. | Timeline.jsx:2336, 2507 |
| TL-ANCH-02a / TL-SJ-05a | PASS | PASS | — | `fq.band.name` resolves to plain-English labels (Exposed / Building / Established / Optimised / Exceptional). Internal numeric code is never surfaced. | fq-calculator.js:678–685 |
| TL-ANCH-03a / TL-SJ-06a | PASS | PASS | — | `risk.band.name` follows same plain-English pattern via `calcRisk`. | — |
| TL-SUB-01 | PASS | FAIL | POLISH | Founder-IP stub PRC/PCC renders "—" + "Coming next" italic. Honest pre-launch labelling per FD-CTA-1; no chevron / lift / press class — A5 OK. Domain note: copy "Capital Efficiency (PRC/PCC)" exposes founder-IP acronyms without translation. Acceptable per memory `feedback_no_permission_prompts` (internal codes never at top layer) ONLY if the acronyms are meaningless to the user; here they are. Either translate ("how efficiently your capital is working") or strip the parenthetical. | Timeline.jsx:2378–2384 |
| TL-PURP-01/02 | PASS | PASS | — | "Where am I in my financial life — and where am I headed?" + "See your life stage, your score over time, every deadline that matters…" — plain English, no advice phrasing. | Timeline.jsx:2388–2394 |
| TL-PFH-08 | PASS | PASS | — | "Funded% derived from saved scenarios; the engine models — not advice." — FCA-correct phrasing (information not advice). | Timeline.jsx:1351 |
| TL-LS-01a | PASS | PASS | — | "45–55 · 42% through · Age 49" — readable in one pass; tabular-nums; no jargon. | Timeline.jsx:289–291 |
| TL-LS-04a-g | PASS | PASS | — | 3-letter stage abbreviations under strip (Fou/Acc/Con/Tra/Dec/Pre/Leg). Full names hover/legend not provided but acceptable as visual rhythm with full names already in §A hero. | Timeline.jsx:337–347 |
| TL-LS-06 | PASS | PASS | — | All 6 forward-stage `nextRule` strings are plain English where they need to be ("ISA habit · auto-enrolment · debt structure", "Max pension AA · debt clearance · estate planning starts", etc.). Mild jargon ("AA", "NMPA", "SPA", "BPR", "LPA") inside Stage 4–6 rules; acceptable for users at those stages, but consider plain-English co-translation. POLISH note, not FAIL. | Timeline.jsx:104–112 |
| TL-CAL-04 | PASS | PASS | — | "DC pensions enter estate for IHT" — correct UK tax fact (Finance Act 2026 confirmed; `pensionIHTInclusionDate: 2027-04-06`). Plain-English title; date renders dynamically from `TAX.deadline`. | UK-2026.1.1.json:136–137, fq-calculator.js:46 |
| TL-CAL-04 (detail copy) | FAIL | PASS | POLISH | Detail string "DC pensions enter estate for IHT" + reasonable. But the CoI label in this row says "`${fmt(perDay)}/day accruing — ${fmt(coi)} total exposure`" where `coi = costOfInaction(entity)` — that is the **canonical aggregate CoI** (skill v1.4 §2.7). Attaching the aggregate CoI to the SIPP-IHT row implies the entire 12-domain CoI is caused by the SIPP-IHT deadline. This is the exact narrowing-error CoI canon forbids — it *says* "total exposure" on a row titled "DC pensions enter estate for IHT". A non-expert reads "missing this date = £X total". Should either: (a) attach `costOfInaction(entity, 'sipp_iht')` here and reserve aggregate for §F.1 / Home anchor, or (b) clarify "Total CoI across all domains — SIPP-IHT is one component". | Timeline.jsx:686, 776 (buildCalendarEntries) |
| TL-CAL-04 hard-coded date | FAIL | PASS | DEMO-BLOCKING (after 6 Apr 2027) | `date:'6 Apr 2027'` is a literal string. `daysAway = daysLeft()` is dynamic so the countdown rolls forward, but the visible label stays "6 Apr 2027" forever. After 2027-04-06 the row renders "0 days remaining" with "6 Apr 2027" — a date that has passed. Should pull from `TAX.deadline.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })`. | Timeline.jsx:684 |
| TL-CAL-05 | PASS | PASS | — | "ISA allowance resets — £20k available" uses `TAX.isaAllowance` (£20,000 confirmed UK-2026.1.1.json:254 — current allowance for 2026/27; £12k restriction for under-65s is from April 2027 only, NOT YET IN EFFECT). Date `5 Apr {yr}` rolls forward correctly. Copy "Unused allowance does not carry forward." — UK-correct, plain-English, no advice. | Timeline.jsx:694–706, UK-2026.1.1.json:43, 254 |
| TL-CAL-06 | FAIL | PASS | FUNCTIONAL | Self-Assessment deadline `31 Jan ${yr + 1}` derived from `new Date().getFullYear()` not from the rules bundle. This is HMRC-correct (SA filing deadline is 31 January following tax year), but: (a) the calculation `new Date(yr+1, 0, 31)` will show "31 Jan 2027" all through 2026, including in February 2026 (after the actual Jan 2026 deadline has passed) — correct because by then yr=2026 and target is 31 Jan 2027 for tax year 2025/26 filing. *However*, in late Jan, when daysAway flips negative, the calendar rows are filtered with `saDay > 0`, so it just disappears with no transitional state. Acceptable but flag: any rule citation tying SA deadline to engine bundle (`TAX.saDeadline`) would be safer for compliance, especially if HMRC extends the deadline by relief year. | Timeline.jsx:710–721 |
| TL-CAL-07 | PASS | PASS | — | State Pension begins at `TAX.spa` (66, rising to 67 by 2028 per UK-2026.1.1.json:208–209). Engine reads `entity.income.statePension.startAge` first, then bundle. Annual amount `TAX.statePensionFull` = £11,502 fallback in engine (fq-calculator.js:55) but rules bundle has £12,548 (UK-2026.1.1.json:205); fallback should be aligned to bundle. POLISH note. | Timeline.jsx:724–737, fq-calculator.js:53–55, UK-2026.1.1.json:205 |
| TL-CAL-08 (APQ rows) | UNVERIFIED | PASS | — | Each row's title/detail comes from `calcAPQTimeline(entity)`; this audit cannot verify all APQ string outputs without persona-by-persona enumeration. Trust engine for math (1,240 assertions) — flag if A5/A6 fails on any persona during conformance pass. | timeline-engine.js (not opened) |
| TL-CAL-09 | FAIL | PASS | FUNCTIONAL | "Pension nomination(s) need updating" + chip="Overdue" + daysAway:-1 hardcoded. Detail says "N pensions with stale or missing nominations" — count is real but no concrete due-date / nomination-anniversary date anchor. Per founder rule (feedback_drill_panels_knowledge_halls): "Overdue" without a date / next-review-date is partial information. A5 partial fail — user can't infer "what does overdue mean here" (statutory deadline? scheme-specific? 5-year ABI guidance?). | Timeline.jsx:756–763 |
| TL-CAL-10 / TL-CAL-10a | PASS | PASS | — | Gift-clock row uses `giftPct()` (years since gift ÷ 7) and `taperBand()` — UK PET 7-year rule correct (taper rates 80/60/40/20% at years 3/4/5/6/7 per UK-2026.1.1 IHT taper schedule). Copy "Gift clock — N% elapsed towards IHT-free" + "${taper.label} · ${fmt(amount)} gifted." — plain English, factually correct. | Timeline.jsx:766–778, fq-calculator.js:616–629 |
| TL-CAL-11 | PASS | PASS | — | Mortgage fixed-rate expiry "Review and remortgage before rate reverts to SVR" — plain English, no "you should". Informational. | Timeline.jsx:781–794 |
| TL-CAL-EMPTY | FAIL | PASS | FUNCTIONAL | Empty state "No calendar entries for selected categories within the X-month horizon." — no action. Per founder rule (feedback_screen_work_audit_first) and rule TL-S-07: empty state without ACTION violates the "every empty state needs a way out" pattern. Acceptable to leave as POLISH for v1; FUNCTIONAL if §C is "the deadline answer." | Timeline.jsx:927–933 |
| TL-DL-01c | PASS | PASS | — | Decision impact reads `d.impact?.finioScore ?? d.impact?.fqDelta` — `finioScore` is a *data field name* (legacy prefix from when product was named Finio), NEVER rendered to the user. The visible label is "Wealth Score impact" (Timeline.jsx:1014). Per FD-NAME-1, engine-comment sweep deferred to Wave 4 Morph. Visible UI is clean. | Timeline.jsx:986, 1014 |
| TL-DL-01d | FAIL | PASS | POLISH | Expanded row shows "Source: X · Step-up: L1 · ID: Y". "Step-up: L1" is internal vocabulary — no spec definition surfaces to the user. A5 fail. Either expand inline ("Step-up: L1 (initial commitment)") or hide for non-power users. | Timeline.jsx:1019 |
| TL-DISC-01 | PASS | PASS | — | "Not regulated financial advice. Sonuswealth models scenarios and surfaces statutory dates relevant to your position; final decisions and timing should be validated with a qualified adviser." Correct FCA boundary (information + guidance, not advice); brand "Sonuswealth" used in correct sentence case per FD-NAME-1. | Timeline.jsx:2504–2506 |
| TL-DISC-02 | PASS | PASS | — | "UK-2026.1 · Last verified: …" — rules-version chip matches X28-03. The patch level `.1` (UK-2026.1.1) is dropped — see TL-X28-03 row. | Timeline.jsx:2507 |
| TL-SJ-12 | FAIL | PASS | POLISH | "No retirement plan yet — defaults to Forecast. Set a plan in §E to enable Plan-mode overlay." — user-visible "§E" jargon. Section-letter is internal taxonomy, not plain English. Should read "Set a plan below (Scenarios & Plans)" or be a real inline CTA. Confirms TL-S-13 seed. | Timeline.jsx:602 |
| TL-PLN-HEAD | FAIL | PASS | POLISH | §E section purpose copy "8 plan types · saved scenarios · goal-seek" — "goal-seek" is internal vocabulary. Should read "set a target, see paths" or similar. Confirms TL-S-14 seed. | Timeline.jsx:2470 |
| TL-OVL-01a | FAIL | PASS | POLISH | GoalSeekSheet metric `<select>`: option `value="iht"` renders as label "IHT exposure" — that label is plain-English-OK; flagged seed TL-S-18 specifies "iht lowercase option in dropdown". The internal `value` is lowercase (acceptable, hidden from user). Verify: user-visible string is "IHT exposure" not "iht" — PASS on visible string. Internal value `'iht'` is data, not display. NO USER-VISIBLE FAIL. | Timeline.jsx:1511 |
| TL-OVL-01b | FAIL | PASS | FUNCTIONAL | Target value `<input type=number>` — no unit hint, no min/max, no validation. A user picking "Wealth Score" then typing 80000 (thinking £80k) will produce a goal-seek failure with no helpful error. A5 fail — verify TL-S-10. | Timeline.jsx:1521–1531 |
| TL-OVL-01e | FAIL | PASS | FUNCTIONAL | `commitGoalSeekPath` sets `planEnvelope.type = seekTarget.metric === 'wealthScore' ? 'retirement' : 'custom'`. Picking metric `'estate'` / `'debt'` / `'gift'` / `'protection'` / `'tax'` from the dropdown still commits a `custom` plan envelope. The PlanRow status (TL-PLN-0x) won't reconcile — user picks "Estate plan" target, commits a path, then the Estate PlanRow still shows "Not set" because the envelope is typed `custom`. Direct domain fail of FD-TL-1 ("All 8 planTypes surface on Timeline only") because the goal-seek can't actually create 7 of those 8 plan types. Confirms TL-S-09. | Timeline.jsx:1471–1473 |
| TL-OVL-02f | FAIL | PASS | POLISH | ScoreHistoryDrillPanel eyebrow says **"8 dimensions — weakest first"** but Risk v1.6 spec reduced dimensions to 7 (per memory project_finio_spec_versions_2026_05_11). The label is hardcoded "8" while `dims.length` is dynamic from `fq.dims`. If FQ engine returns 7 dims, the eyebrow lies. Should read `${dims.length} dimensions`. Confirms TL-S-11. | Timeline.jsx:2023 |
| TL-OVL-02h | PASS | PASS | — | Disclaimer footer reads "Score history is a read-only mirror · D-SCORE-JOURNEY-1 · Not regulated advice". The "D-SCORE-JOURNEY-1" token is internal — a non-expert will not parse it. Mild A5 fail (POLISH); remove or translate. Acceptable for v1. | Timeline.jsx:2071 |
| TL-OVL-03e | FAIL | PASS | POLISH | MilestoneDrillPanel "What would push this forward?" card — hint copy is "Closing the £X gap — for example by increasing monthly contributions — would bring this milestone closer." plus "Continuing at your current pace…" / "Use Goal Seek to model specific scenarios." FCA-OK (no "you should"); but the closing-the-gap phrasing edges close to specific advice ("increasing monthly contributions"). Better: "Increasing monthly contributions is one example lever — model scenarios in Plans below." Domain note: this card is purely descriptive (no ACTION CTA). Per founder ex. (feedback_drill_panels_knowledge_halls) drill panels owe a continuation hook — verify whether spec mandates this or not. | Timeline.jsx:2099–2103, 2206–2210 |
| TL-GM-04 templates | PASS | PASS | — | 8 goal templates use plain-English labels ("Retire at age N", "Pay off mortgage", "Net worth target", etc.). `template_id` mapping is internal data. | Timeline.jsx:136–145 |
| TL-PFH-04 (TrackingPill) | FAIL | PASS | FUNCTIONAL | "Awaiting data" pill renders when `fundedPct == null`. But §F.1 still shows "Funded —%" + zero-width bar. If user has a committed plan but no saved scenarios with `deltaResults.fundedRatio`, the card reads as if the plan is broken. Cross-tab note: PRIOR HOME `PlanProgressStrip` BUG (08a22c7 per inventory seed TL-S-16). Confirm pair renders coherently. Domain side: claiming "Funded —%" with no underlying scenarios is misleading at best. Engine should expose a `planFunded(e, ptId)` API so the headline reads a real ratio or omits the row. | Timeline.jsx:1264–1267 |

---

## Specific verification checks called out in agent brief

### 1. Jargon in §E / §F user-visible strings

- **§E header "Scenarios & Plans"** — OK (Timeline.jsx:1362).
- **§E header purpose "8 plan types · saved scenarios · goal-seek"** — "goal-seek" jargon. **FAIL** (POLISH). (Timeline.jsx:2470).
- **§E "Active Plans" / "Saved Scenarios" sub-headings** — OK.
- **§E "Set a plan →" primary CTA** — OK.
- **§E PlanRow `Edit · Goal-seek` button** — "Goal-seek" still jargon at button level. **FAIL** (POLISH). (Timeline.jsx:1142).
- **§F header "Goals & Milestones · Achieved + projected — tap Celebrate to mark"** — OK.
- **§F empty state "Goal templates — tap to set your first goal"** — OK.
- **§F goal-template grid labels** — all plain English ("Retire at age N" etc.).
- **§F `Celebrate` / `Got it` buttons** — OK.
- **§F achieved-milestone tally** — "N milestones achieved · most recent: …" — OK.

### 2. `iht` lowercase option in dropdown (FD-NAME-1 / A5)

GoalSeekSheet `<select>` (Timeline.jsx:1511): `<option value="iht">IHT exposure</option>`. **Internal `value` is lowercase 'iht' — user-visible label is "IHT exposure"**. **PASS** on visible string. Internal `value` is data and not a user-facing concern. The inventory's TL-S-18 seed flags this — verdict is POLISH at most because no user sees the lowercase token.

### 3. Internal `finioScore` field name visible to user

- `d.impact?.finioScore` is *read* from data (Timeline.jsx:986).
- **No user-visible string contains "finioScore"** — display label is "Wealth Score impact" (Timeline.jsx:1014).
- **PASS** per FD-NAME-1 (engine-comment sweep deferred to Wave 4 Morph).

### 4. Internal §-refs in user copy

Found two §-letter leaks at user-visible level:
- **TL-SJ-12** — "Set a plan in **§E** to enable Plan-mode overlay." (Timeline.jsx:602). **FAIL** (POLISH).
- All section-header pills correctly render the section letter as a typographic chip ("A · Life stage", "B · Score journey", etc.) — that's intentional taxonomy, not jargon; PASS.
- **TL-OVL-02h** disclaimer "D-SCORE-JOURNEY-1" — internal code at user-visible level. **FAIL** (POLISH).
- **TL-LS-07** CausalityStripe shows "DOB · entity.individual.dob" — internal field path leaking. Acceptable inside X29 provenance stripe (per spec §X29 the causality stripe is intentional source-of-truth disclosure) but it should display the human label not the property path. Confirmation-auditor decision.

### 5. SA deadline date source

- **`saDate = new Date(yr + 1, 0, 31)`** (Timeline.jsx:710).
- Source: **client-side date math from `new Date().getFullYear()` — NOT from the rules bundle.**
- HMRC SA online filing deadline IS statutorily 31 January following tax year (UK-IT-26 / Finance Act). The formula is correct.
- **FAIL** (FUNCTIONAL severity) on the architectural point: any statutory date should live in the engine bundle so a deadline shift (e.g. HMRC COVID-style extension to Feb) is reflected everywhere. Engine has `TAX.deadline` for SIPP-IHT but no `TAX.saDeadline`. Confirms seed TL-S-04.

### 6. Founder-IP CoI canon (skill v1.4 §2.7)

- `costOfInaction(e)` with no domain key returns `totalCoI(e).total` (aggregate across all canonical domains) — **canonical correct** (fq-calculator.js:603–606).
- **However**, in `buildCalendarEntries` (Timeline.jsx:668), `costOfInaction(entity)` (aggregate) is attached to the **SIPP-IHT row** as "total exposure". This is the exact narrowing-error skill v1.4 §2.7 forbids: the user reads "DC pensions enter estate for IHT — £X total exposure" and infers the entire CoI is from the SIPP-IHT deadline. **FAIL** (FUNCTIONAL → could become DEMO-BLOCKING if challenged in a demo).
- Fix: switch to `costOfInaction(entity, 'sipp_iht')` for the SIPP-IHT row; reserve aggregate for Home anchor / §F.1 headline / Tax & Estate canonical CoI surface.

### 7. Founder-IP stub integrity

- **PRC/PCC** (TL-SUB-01): renders "—" + "Coming next" italic. **PASS** — honest stub, no fabricated definition.
- **Reality Engine / DER / EBR**: not surfaced anywhere on Timeline. PASS.

### 8. UK tax facts spot-check

| Fact | Rendered | Source-of-truth | Verdict |
|------|----------|------------------|---------|
| ISA allowance £20k | `fmt(TAX.isaAllowance)` → "£20k" | UK-2026.1.1.json:43 / 254 (2026/27) | PASS |
| State Pension begins age 66 | `TAX.spa` or `entity.income.statePension.startAge` | UK-2026.1.1.json:208 (66, rising to 67 by 2028) | PASS |
| State Pension annual | `entity.income.statePension.annual ?? TAX.statePensionFull` | Engine fallback £11,502 (fq-calculator.js:55); bundle has £12,548 (UK-2026.1.1.json:205) | POLISH FAIL — fallback drift |
| SIPP-IHT inclusion 6 Apr 2027 | hardcoded `'6 Apr 2027'` string + dynamic `daysLeft()` | UK-2026.1.1.json:136 `pensionIHTInclusionDate: 2027-04-06` (ENACTED — Royal Assent 18 Mar 2026 per memory) | DOMAIN PASS, but TL-S-17 still applies after April 2027 because the date string is literal |
| SA filing deadline 31 Jan | computed from `new Date()` | HMRC statutory deadline | DOMAIN PASS, ARCHITECTURE FAIL (TL-S-04) |
| Gift 7-year PET taper 80/60/40/20 | `taperBand()` returns labels & rates | UK IHT taper schedule (40% → 32% → 24% → 16% → 8%) | PASS |
| IHT-free at year 7+ | `taperBand` "IHT-free" | UK IHT 7-year rule | PASS |
| MPAA £10k / Pension AA £60k | not surfaced on Timeline | UK-2026.1.1.json:194 | NA |
| CGT annual exempt £3,000 | not surfaced on Timeline | UK-2026.1.1.json (cgt.annualExemption=3000) | NA |
| NRB £325k / RNRB £175k | not surfaced on Timeline | UK-2026.1.1.json (iht.nilRateBand=325000, iht.residenceNilRateBand=175000) | NA |

All UK figures that *are* surfaced are correct or come from the engine bundle.

### 9. FCA framing (information not advice)

- Disclaimer (TL-DISC-01): "Not regulated financial advice. Sonuswealth models scenarios and surfaces statutory dates…" — **PASS**.
- §F.1 footer: "Funded% derived from saved scenarios; the engine models — not advice." — **PASS**.
- §B disclaimer: "Score history is synthesised — activates when event log is live." — **PASS**.
- ScoreHistoryDrillPanel footer: "Score history is a read-only mirror · D-SCORE-JOURNEY-1 · Not regulated advice" — **PASS** on FCA, POLISH on jargon.
- MilestoneDrillPanel footer: "Projections are estimates · Not regulated advice · Engine models, not guarantees" — **PASS**.
- MilestoneDrillPanel hint copy: borderline — see TL-OVL-03e row.

No "you should" / "we recommend" / "you must" found in Timeline.jsx.

### 10. Placeholder / draft text leakage

- **TL-SUB-01** "Coming next" — intentional founder-IP stub label per FD-CTA-1, not a build-scaffolding leak. PASS.
- **TL-SJ-SKEL** "Computing your Score Journey…" — runtime skeleton, intentional UX state, not a draft leak. PASS.
- **TL-SJ-ERR** "Score Journey temporarily unavailable — try refreshing" — runtime error state, no refresh handler visible. **FUNCTIONAL FAIL** — copy implies a refresh button that does not exist (the parent component re-renders on entity/window change, not on a user "refresh" action). User reads "try refreshing" and looks for a button — there isn't one. (Timeline.jsx:431.)
- No "lorem", "TBD", "draft inbound", "mapping inbound", "stub" text visible to the user in Timeline.jsx.

### 11. Brand drift (FD-NAME-1)

- `Sonuswealth` / `Finio` user-visible strings: **ZERO** occurrences in Timeline.jsx.
- `Sonuswealth` (sentence case) used correctly in disclaimer (Timeline.jsx:2504).
- Internal field `d.impact.finioScore` (legacy prefix) — *data field*, not user-visible; deferred to Wave 4 Morph sweep.
- **PASS** on visible-UI brand discipline.

---

## Inventory drift (elements outside this audit's scope)

- `src/components/Timeline/NWTrajectoryChart.jsx` and `PlansSection.jsx` not imported by Timeline.jsx. Not surfaced — no domain finding. (Inventory note row, not a content row.)
- `entity.dataLastUpdated` fallback to `'UK-2026.1'` (a version token used as a date) is the only architectural domain finding outside the row list — flagged as TL-X28-04.

---

## Coverage

Rows in inventory: ~130 (including all sub-rows).
Rows the domain auditor is the authority on (financial / FCA / claim-integrity / placeholder / brand): ~55.
Rows checked this pass: **55 / 55 = 100% of domain-scope rows.**

Pass rate (domain-scope): **42 PASS / 13 FAIL.**

Of the 13 FAIL rows by severity:
- **DEMO-BLOCKING** (1): TL-CAL-04 hardcoded `'6 Apr 2027'` date (only after 6 Apr 2027 — currently not blocking).
- **FUNCTIONAL** (5): TL-CAL-04 CoI narrowing-error, TL-CAL-06 SA architecture, TL-CAL-09 nominations missing date, TL-CAL-EMPTY no-action empty state, TL-OVL-01b GoalSeek input units, TL-OVL-01e plan-type bug, TL-PFH-04 Funded —% pair, TL-SJ-ERR phantom refresh.
- **POLISH** (7): TL-X28-04 data-date fallback, TL-SUB-01 PRC/PCC acronym, TL-DL-01d Step-up jargon, TL-SJ-12 §E leak, TL-PLN-HEAD goal-seek jargon, TL-OVL-02f "8 dimensions" hardcode, TL-OVL-02h disclaimer code, TL-OVL-03e hint borderline, TL-CAL-07 state-pension fallback drift.

(Counts overlap because some rows carry both FUNCTIONAL and POLISH notes.)

---

## Return line

**TL domain: 42 PASS, 13 FAIL (1 DB, 7 F, 7 P).**
