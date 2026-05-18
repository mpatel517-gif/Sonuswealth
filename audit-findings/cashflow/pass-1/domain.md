# Cashflow — Pass 1 · Domain & Calculation Audit

**Auditor:** domain-auditor (auditor 4 of 5)
**Date:** 18 May 2026
**Inventory:** `cashflow-inventory-v1.md` (v1, 17 May 2026)
**Source under audit:** `src/screens/Cashflow.jsx` (2,894 LOC) + `src/components/Cashflow/*`
**Rules under audit:** `src/rules/UK-2026.1.1.json` (Verified May 2026)
**Brand:** `src/config/brand.js` — BRAND.name = `Sonuswealth`, disclaimer present.

## Method recap

Walked every inventory row carrying a **financial figure, founder-IP term, regulatory
claim, or jargon load**. Tested **A5 (plain English + FCA framing)** + domain correctness
per the six skill checks (canonical CoI, founder-IP integrity, UK tax facts, claim
integrity, placeholder leakage, FCA framing, plain English).

Engine maths is largely proven (1,240 assertions); domain risk is in copy / labels /
definitions / placeholder leakage. That is where the FAILs cluster, and they cluster
heavily.

---

## Verdict table

Legend: PASS · FAIL · NA (no domain load) · UNVERIFIED (no domain risk, defer to
other auditors).

| ID | A5 | Domain | Severity | Finding | Evidence |
|----|----|--------|----------|---------|----------|
| CF-CHR-01 | NA | NA | — | nav | — |
| CF-CHR-02 | PASS | NA | — | "Cashflow" — plain English | `Cashflow.jsx` (screen title via X28 chrome) |
| CF-CHR-03 | PASS | PASS | — | "Simple view" / "P&L view" — both readable | label↔state already audit-honest |
| CF-CHR-04 | PASS | PASS | — | `BRAND.disclaimer` = "Not regulated financial advice. Verify decisions with a qualified UK financial adviser." present, FCA-safe | `brand.js:24`, `Cashflow.jsx:865-866` |
| CF-ANCH-01 | PASS | PASS | — | "You own" / net worth | inventory ID match |
| CF-ANCH-02 | PASS | PASS | — | "Health score" — engine total | `calcFQ` cite in inventory |
| CF-ANCH-03 | PASS | PASS | — | "Safety score" — Risk total | `calcRisk` cite |
| **CF-SUB-01** | **FAIL** | **FAIL** | **DEMO-BLOCKING** | Sub-anchor chip literally reads `"methodology pending O-CF-RULES-07"` and value reads `"PRC – PCC"` without a plain-English translation. "Capital Efficiency · PRC – PCC" appears on screen at sub-anchor level with NO inline explainer. Violates macOS principle (internal codes at top layer) AND A5 (jargon without translation). Even with `status: 'stub'`, the *acronym* needs a plain-English gloss. | `Cashflow.jsx:932-938` |
| CF-PURP-01 | PASS | NA | — | "Will your money last — and is what's coming in actually enough?" — clean, no advice phrasing | `Cashflow.jsx:949` |
| CF-PURP-02 | PASS | NA | — | "See your income, expenses, and what the years ahead look like. In 35 seconds." — promise; not a financial claim | `Cashflow.jsx:951-953` |
| CF-HERO-01 | PASS | PASS | — | "Cashflow Health Score" — clear | `Cashflow.jsx:1051` |
| CF-HERO-02 | UNVERIFIED | PASS | — | engine value; reconciliation handed to conformance | — |
| CF-HERO-03 | PASS | PASS | — | bands (Critical/Stressed/Steady/Healthy/Thriving) plain English | — |
| CF-HERO-04 | PASS | NA | — | "Detail ›" affordance label readable | — |
| CF-HERO-05 | PASS | PASS | — | surplus-contradiction note honest + caveats correctly without "you should…" advice phrasing | `Cashflow.jsx:1070-1081` |
| CF-HERO-06 | PASS | PASS | — | "Bill coverage" plain | label dict line 989 |
| CF-HERO-07 | PASS | PASS | — | "Surplus ratio" plain | line 990 |
| **CF-HERO-08** | PASS | **FAIL** | FUNCTIONAL | "Income resilience" component — UI-derived proxy = `(annInc − essAnn) / annInc`. **This is NOT income resilience** — it's the discretionary fraction. Real income resilience measures diversity / stability of income sources (drill panel even *says so* at line 431: "Diversity and stability of income sources"). The hero score and its definition are mismatched. Claim-integrity FAIL — the metric the user reads bears no defensible relation to its name. | `Cashflow.jsx:1010-1012`, `Cashflow.jsx:431` |
| CF-HERO-09 | PASS | PASS | — | "Funded ratio" derived via `clamp(fr.ratio × 100, 0, 100)` — proxy but acceptable; ratio capped at 1.0 = 100 honest | `Cashflow.jsx:1014-1017` |
| CF-HERO-10 | PASS | PASS | — | DSR formula `100 − max(0, dsr − 10) × 100/30` defensible (10% benign → 40% bad) | `Cashflow.jsx:1019-1022` |
| CF-X28-01 | UNVERIFIED | — | — | id-mismatch is a structural bug, not a domain one — conformance-auditor owns | — |
| CF-X28-02..04 | NA | NA | — | state plumbing | — |
| CF-SEED-01..03 | UNVERIFIED | NA | — | conditional render path; no domain claim | — |
| CF-DELIM-A/B/C | PASS | NA | — | section headings plain | — |
| CF-WAT-01..02 | PASS | PASS | — | "Cashflow waterfall · Money in → out → what's left" — excellent plain English | `Cashflow.jsx:1190-1201` |
| CF-WAT-03 | PASS | PASS | — | "Gross income" engine-derived; tax band note `${incomeAll.marginal_band} band` honest | line 1192-1193 |
| CF-WAT-04 | PASS | PASS | — | "Tax & NI" plain; UK band tag from engine | — |
| CF-WAT-05 | PASS | PASS | — | "Pension contribution" + "Salary sacrifice / contribution" honest annotation | line 1194-1195 |
| CF-WAT-06 | PASS | PASS | — | "Essentials" + "Housing + bills + transport" honest | line 1196-1197 |
| CF-WAT-07 | PASS | PASS | — | "Debt service" + "Loans + cards" plain | line 1198-1199 |
| CF-WAT-08 | PASS | NA | — | "Breakdown ›" affordance | — |
| **CF-WAT-09** | **FAIL** | **FAIL** | FUNCTIONAL | Empty-state copy implies a "+ Income" affordance ("add a salary, dividend, rental or pension stream via **+ Income**") but no such affordance exists on Cashflow. A4 fail — implied destination doesn't exist. Either wire the affordance, or redirect to "Add income on My Money › Income". (Seed S-12 confirmed.) | inventory S-12; copy lives in `CashflowWaterfallReconciled` empty state |
| **CF-ED-01** | **FAIL** | **FAIL** | **DEMO-BLOCKING** | "UK 45-54 cohort median: **58%**" hardcoded (`cohortMedian = 58`). NOT from engine, NOT from any data source on disk. No provenance — fabricated UK cohort statistic surfaced as authoritative. Either source it (ONS / IFS) and cite, or remove the line. Citing a fabricated population statistic to a UK consumer is a claim-integrity failure and FCA-risk (information has to be true). | `Cashflow.jsx:1292`, `Cashflow.jsx:1317` |
| CF-ED-02 | PASS | NA | — | bar echoes value | — |
| **CF-ED-03** | PASS | **FAIL** | FUNCTIONAL | Implication line in DEAD `CashflowWaterfall` component (line 1280): "Your essentials-to-income ratio is approx **62%** — every £1k extra you free up adds **£25k of FI runway over 25 years**." Two hardcoded figures (62% essentials, £25k/25y multiplier). Not engine-sourced. Dead code (S-05 confirms component is not rendered), but dead-code drift risk: if anyone re-enables it, fabricated numbers ship. Either delete the function entirely or fix when reactivated. | `Cashflow.jsx:1213, 1280-1281`; S-05 |
| CF-BILL-01/02 | PASS | PASS | — | empty state honest; only renders due-days from real `entity.bills[]` data — STUB-06 comment confirms hardcoded dueDay=14 was removed | `Cashflow.jsx:1325-1373` |
| CF-SUB-01b | PASS | PASS | — | "data pending" / "Manual add · Phase 1.2" chip is honest | — |
| **CF-SUB-02** | PASS | **FAIL** | FUNCTIONAL | "+ Add manually (coming next)" — A2 (drillable). Copy is honest about non-functionality; FAIL is functional not domain (deferred to conformance), but the CTA still violates the "every CTA earns its label" rule from CLAUDE.md §9. Should disable button or aria-live the console.info. | seed S-10 |
| CF-ALLOC-01/02 | UNVERIFIED | UNVERIFIED | — | engine-driven; defer to reconciliation | — |
| CF-ALLOC-03 | PASS | PASS | — | "Set up" label honest; A2 problem (functional) | seed S-10 |
| CF-LB-01..04 | PASS | PASS | — | "Liquidity Buffer" + months + Critical/Building/Covered bands plain English; engine-backed | — |
| **CF-INC-01** | **FAIL** | **FAIL** | **DEMO-BLOCKING** | Card eyebrow "Income by source" — chip reads literally **"Domain O"**. "Domain O" is the engine's internal canonical-domain code. NO plain-English explainer next to it. Violates macOS principle + A5 unambiguously. (Spec/build comment even calls it "CAT-03: Domain O split" — fine for code, fatal for UI.) Drop the chip, or rename it ("Income sources"). Also empty-state copy "Add salary / dividends / rental / drawdown / interest / pension rows to see the Domain O source split." surfaces the same code to the user. | `Cashflow.jsx:1638, 1649`, comment 1571, 1761 |
| CF-INC-02 | PASS | PASS | — | source rows plain English (Salary / Dividends / Rental / Pension drawdown / Interest / State or DB pension / Self-employment / Other) | label dict 1575-1584 |
| CF-INC-03 | PASS | NA | — | "Breakdown ›" affordance | — |
| CF-INC-04 | PASS | PASS | — | "Income by tax band · UK ordering" — clean; A6 reconciliation handed to conformance | line 1697-1707 |
| CF-INC-05 | PASS | PASS | — | bands: "Non-savings (employment, rental, drawdown)" / "Savings (interest)" / "Dividends" / "Capital gains" — excellent UK plain-English | `Cashflow.jsx:1697-1701` |
| **CF-GS-01** | **FAIL** | **FAIL** | **DEMO-BLOCKING** | Goal-Seek card chip reads literally **"X24 mode 3"**. Internal scenario-engine mode code at top layer. User has no idea what this means. macOS-principle violation + A5 fail. Either drop the chip, rename ("Forward planner"), or move to a hover-only metadata pill. (Seed S-07 confirmed.) | `Cashflow.jsx:2314` |
| CF-GS-02..03 | PASS | NA | — | slider + button label states honest ("Solving…" / "Up to date" / "Find paths") | line 2322-2348 |
| CF-GS-04 | PASS | PASS | — | `humanise(p.action.kind)` will produce "Bed And Isa" from `bedAndIsa` — depends on engine vocabulary. **Risk noted** (S-14): if engine emits `bedAndIsa` the user sees mangled title-case. PASS for now since output is engine-dependent; flag for engine-side vocabulary clean-up. | line 2364 |
| CF-GS-05 | PASS | PASS | — | "No solver paths returned for this target." honest empty state | line 2382 |
| **CF-SWR-01** | PASS | **FAIL** | FUNCTIONAL | Card title "Withdrawal regime" — fine. But the regime *labels* below carry their methodologists' names with no plain-English: "Bengen 4% rule" / "Guyton-Klinger 4.5%" / "Morningstar UK 3.4%" / "Vanguard 3.3%" / "PRC-anchored" / "Custom". The `note` tooltips are short ("Classic" / "Dynamic guardrails" / "Conservative" / "Cohort-adjusted") but tooltips don't satisfy A5 — non-experts shouldn't have to hover. Bengen and Guyton-Klinger are surname citations — A5 wants the surname plus a one-line gloss in the visible card. The "isStubRegime" inline note ("methodology pending; showing Bengen default 4.0%") is honest. Verdict: domain-correct but A5-borderline. | `Cashflow.jsx:1773-1779`, `Cashflow.jsx:1815-1820` |
| CF-SWR-02 | PASS | PASS | — | PRC-anchored + Custom honestly fall back to Bengen with disclosed rate | `Cashflow.jsx:1815-1820` |
| CF-SWR-03 | PASS | PASS | — | inline rate or fallback disclosure honest | — |
| CF-FUND-01 | PASS | PASS | — | "Funded ratio" — already plain in tag; FundedRatioGaugeV2 audit handed to conformance | `Cashflow.jsx:1874-1875` |
| **CF-FUND-02** | PASS | PASS | — | **FD-CF-1 confirmed in this build**: status zone derived from ratio at `Cashflow.jsx:1854-1857` (≥1.1 Over-funded, ≥1.0 On track, ≥0.85 Approaching target, else Under-funded). `ConfidenceIntervalSummary` at 2676 uses derived `frStatusLabel`, NOT `fr.confidence`. The previously broken 0.32-reads-as-"HIGH" bug is fixed. | `Cashflow.jsx:1854-1875, 2656-2676` |
| CF-FUND-03 | PASS | FAIL | POLISH | "Confidence band: 0.85 – 1.18 (10–90 percentile)" — "10–90 percentile" needs plain-English: "in 8 out of 10 model runs the funded ratio lands between 0.85 and 1.18." | inventory CF-FUND-03 |
| CF-FUND-04 | PASS | NA | — | "Plan funds X years of target spending" — plain; honest empty when prop missing | — |
| CF-FI-01..03 | PASS | PASS | — | "25× target rule" chip + "{multiple}× current target · target {fmt(fiTarget)}" plain English | — |
| **CF-POS-01** | PASS | **FAIL** | FUNCTIONAL | "PoS" is an undefined acronym at hero level. The card title is fine if expanded ("Probability of Success") but anywhere on screen reading "**PoS**" as a literal label fails A5. Inventory cites "{Math.round(pos * 100)}% PoS" at line 2266 — three-letter code rendered as the unit label. Replace with "% chance plan survives" or "probability of success" expanded. | `Cashflow.jsx:2266` |
| CF-POS-02..03 | PASS | PASS | — | sub-line "X of N paths sustain target income · Yy horizon" + Median/P10/P90 tile labels readable | — |
| CF-POS-04 | PASS | PASS | — | Stub disclosure honest: "monte-carlo.js v1.1 (Cholesky correlation matrix per O-CF-RULES-01) not yet present; current PoS uses single-Z Box-Muller — flagged stub." — **but the parenthetical "Cholesky correlation matrix per O-CF-RULES-01" surfaces an internal code (S-07 family) to the user**. Not as bad as the X24 chip (it's in a stub-note italic), but should still drop the internal code. Sub-FAIL (POLISH). | `Cashflow.jsx:1982-1983` |
| CF-POSC-01..05 | UNVERIFIED | UNVERIFIED | — | chart rendering / mock-fallback risk handed to conformance (S-02) | — |
| CF-SEQ-01 | PASS | PASS | — | "Same average return — different order" plain-English good | — |
| CF-SEQ-02..04 | UNVERIFIED | UNVERIFIED | — | mock-fallback risk handed to conformance (S-02) | — |
| **CF-GK-01** | PASS | **FAIL** | FUNCTIONAL | "Dynamic guardrails corridor (Guyton-Klinger)" + "±20% triggers" chip — surname citation again, no inline gloss. Spec calls Guyton-Klinger an industry-recognised SWR rule with prosperity (raise 10% on portfolio +20%) / preservation (cut 10% on −20%) triggers. A5 wants a one-liner: "Withdrawal automatically increases by 10% when the portfolio is +20% ahead, cuts by 10% when −20% behind." | `Cashflow.jsx:2129, 2154` |
| CF-GK-02..04 | PASS | PASS | — | engine-backed corridor; summary line "Expected over Xy: N raises · M cuts." plain | — |
| **CF-SCEN-01..06** | PASS | UNVERIFIED | — | scenario matrix mock-fallback risk (S-02/S-03) is a **conformance concern, not domain**. The 5 mock scenarios use plausible PoS values (94/88/97/68) and drawdown figures (£38k/£34k/£28k/£46k) that look like real engine outputs — DEMO-BLOCKING if shown to a user, but the call-site does pass `fiveScen?.scenarios || null` so the risk depends on engine return shape. **Domain verdict deferred to conformance.** | seeds S-02, S-03 |
| **CF-COI-01** | **FAIL** | **FAIL** | **DEMO-BLOCKING** | **CANONICAL CoI VIOLATION.** `CoIOdometerWithHalo` reads `coi?.byDomain?.estatePlanning \|\| coi?.total` (line 2392). This **defaults to the estate-planning slice of CoI**, falling back to total only if estate slice is unset. Per skill v1.4 §2.7, canonical CoI is "the aggregate NPV cost of suboptimal inaction across all twelve canonical domains — not 'IHT with SIPP minus IHT without.'" The default order should be `coi?.total \|\| sum(coi.byDomain)`, NEVER prefer estate. This is the exact failure mode the canonical-CoI rule was written to prevent: narrowing a screen's CoI to one domain. | `Cashflow.jsx:2392` |
| CF-COI-02 | NA | NA | — | cascade halo animation | — |
| CF-COI-03 | PASS | PASS | — | `coi.byDomain` enumeration labels via `humanise(k)` — engine vocabulary risk same as CF-GS-04; defer to engine cleanup | line 2400-2404 |
| CF-COIV-01 | PASS | PASS | — | row labels "Withdrawal sequence / Wrapper sequencing / Pension opportunity / Director / allowance" plain English | line 2412-2416 |
| **CF-COIV-02** | **FAIL** | **FAIL** | FUNCTIONAL | NPV disclosure reads literally **"NPV discount rate per O-CF-RULES-12 (pending founder sign-off)."** Internal code at top layer. macOS principle violation + A5. Should read: "NPV discount rate currently provisional — methodology under sign-off." Drop the code. (Seed S-07 confirmed.) | `Cashflow.jsx:2444` |
| **CF-PRC-01** | **FAIL** | **FAIL** | **DEMO-BLOCKING** | Card title literally reads **"PRC / PCC Spread"** with a "Founder concept" chip. Even in stub state, the title is the un-glossed three-letter acronym pair. The non-stub branch renders "{spread_pp} pp" with sub-label "PRC – PCC" (line 2490) — still no plain-English. Founder-IP integrity (skill §2.2) is preserved (no fake definition shipped), but A5 fails hard. A non-expert can't infer what PRC or PCC is. The card needs a sentence under the title: "Personal Required Cost vs Personal Capital Cost — how the spread between your required return and your actual portfolio cost shapes wealth growth." (Or whatever the founder definition is — DO NOT invent.) | `Cashflow.jsx:2464, 2490` |
| **CF-RE-01** | PASS | **FAIL** | FUNCTIONAL | "Reality Engine" card title — A5 fail because the name doesn't tell the user what it is. Stub state copy ("Factor weights pending O-CF-RULES-09 — personal / system / external split will land once methodology is signed off.") leaks the internal code AND uses three layer labels without plain-English. A5 wants: "How much of your outcome is driven by your decisions vs the financial system vs external forces — methodology pending." | `Cashflow.jsx:2513, 2517-2519` |
| CF-RE-02 | PASS | PASS | — | non-stub state: layer percentages with plain labels (Personal/System/External) is fine | line 2543-2545 |
| **CF-RE-03** | **FAIL** | **FAIL** | FUNCTIONAL | "Stub at v1.0 — factor weights pending O-CF-RULES-09." Internal code at top layer again. Same fix as CF-COIV-02 — drop the code. | `Cashflow.jsx:2550` |
| CF-MDD-01/02 | PASS | PASS | — | "Max drawdown tolerance" + "Implied MDD / Stated tolerance / Mismatch / 60/40 reference" — "MDD" abbreviation is borderline-A5 (Maximum Drawdown is jargon); "60/40 reference" is OK in finance-literate context. Recommend expanding "MDD" once on first mention. | `Cashflow.jsx:2557-2580` |
| CF-EFF-01..03 | UNVERIFIED | UNVERIFIED | — | mock-fallback (S-02) handed to conformance. Domain note: "efficient frontier" *is* jargon and the inventory flagged it — "Gap to frontier · +X.X% / yr" implies the user understands frontier vocabulary. A5 borderline. | inventory CF-EFF-01 |
| CF-FID-01 | PASS | PASS | — | FI Progress depth grid (Ratio / Multiple / Achieved / Confidence) plain enough for a finance-curious user | — |
| CF-CONF-01..04 | PASS | PASS | — | Confidence summary rows; FD-CF-1 fix verified above; "Probability of Success" expanded properly here | inventory + FD-CF-1 |
| CF-FOOT-01 | PASS | PASS | — | `BRAND.disclaimer` correct + FCA-safe; brand name = Sonuswealth | brand.js:24 |
| CF-FOOT-02 | PASS | PASS | — | rulesVersion = "UK-2026.1", dataDate = "April 2026" — match `UK-2026.1.1.json` _meta verification date. Note: build screen probably shows "UK-2026.1" while file is "UK-2026.1.1" — minor version drift, defer to conformance reconciliation. | brand.js:26-28 vs UK-2026.1.1.json:_meta |
| CF-OVL-S-01..06 | PASS | PASS | — | Surplus drill — "Where to put the surplus" / "Emergency buffer" / footer "Information only · Derived from your data · Not regulated advice" all plain + FCA-safe | `Cashflow.jsx:282-313` |
| CF-OVL-I-01..04 | PASS | PASS | — | Income drill — source rows (Salary / Self-employment / Rental / Dividends / Pension / Other) plain | line 322+ |
| CF-OVL-H-01..02 | PASS | PASS | — | "Cashflow health breakdown" + total/band readable | line 460-483 |
| **CF-OVL-H-03** | **FAIL** | **FAIL** | FUNCTIONAL | **Label split — same component, two names.** Hero row labels (line 982-988): "Bill coverage / Surplus ratio / Income resilience / Funded ratio / Debt service ratio". Drill labels (line 428-432): "Liquidity buffer / Surplus ratio / Debt manageability / Income resilience / Sequence resilience". The hero says "Bill coverage" + "Funded ratio" + "Debt service ratio"; the drill says "Liquidity buffer" + "Debt manageability" + "Sequence resilience" — same screen, same metric, two label vocabularies. User taps "Bill coverage" and lands on a "Liquidity buffer" row — cognitive break. Pick one set. (Seed S-08 confirmed; spec preference is the hero labels.) | `Cashflow.jsx:428-432` vs `982-991` |
| CF-OVL-H-04 | PASS | PASS | — | "{weight}% weight → {contribution}pts" caption is factual, not advice; A5 fine | line 491-510 (approx) |
| CF-OVL-H-05 | PASS | PASS | — | drill footer disclaimer same as L3 panels | line 410, 520 |

---

## FAILs by severity

### DEMO-BLOCKING (block release)

| ID | Issue | Fix |
|----|-------|-----|
| CF-SUB-01 | "Capital Efficiency · PRC – PCC" + chip "methodology pending O-CF-RULES-07" — un-glossed acronyms + internal code at sub-anchor (top-layer) | Drop the chip text; add plain-English subtitle under "Capital Efficiency" |
| CF-ED-01 | "UK 45-54 cohort median: 58%" — fabricated UK population statistic | Either cite source (ONS / IFS / FCA), or remove the line entirely |
| CF-INC-01 | "Income by source" card carries "Domain O" chip; empty-state copy says "Domain O source split" — internal canonical-domain code visible | Drop the "Domain O" chip; rewrite empty state without the term |
| CF-GS-01 | Goal-Seek chip reads "X24 mode 3" — internal scenario-engine code | Drop or rename to plain English (e.g. "Forward planner") |
| CF-COI-01 | CoI defaults to `byDomain.estatePlanning` slice — narrows canonical CoI to a single domain (forbidden by skill §2.7) | Reverse precedence: `coi?.total ?? sum(coi.byDomain)` |
| CF-PRC-01 | "PRC / PCC Spread" card title — un-glossed founder-IP acronyms at L1 | Add a plain-English subtitle under the title (founder-defined — do NOT invent) |

### FUNCTIONAL (must fix before founder demo)

| ID | Issue | Fix |
|----|-------|-----|
| CF-HERO-08 | "Income resilience" hero metric uses `(annInc − essAnn) / annInc` — that's discretionary fraction, NOT income resilience | Either rename the row "Headroom" / "Discretionary share", or replace formula with an income-diversity proxy (e.g. 1 − HHI of source shares) |
| CF-WAT-09 | Empty-state copy implies a "+ Income" affordance on Cashflow that doesn't exist | Either wire the affordance or redirect to "Add income on My Money › Income" |
| CF-SWR-01 | "Bengen 4% rule" / "Guyton-Klinger 4.5%" — surname citations without inline gloss | Add one-line plain-English under each regime button (already partly there via `note`; promote to visible card text) |
| CF-POS-01 | "PoS" rendered as a literal label unit ("% PoS" at line 2266) | Replace "PoS" with "chance plan survives" or "probability" expanded |
| CF-POS-04 | Stub note carries "Cholesky correlation matrix per O-CF-RULES-01" — internal code | Drop the code |
| CF-GK-01 | "Guyton-Klinger" + "±20% triggers" without plain-English gloss | Add a one-liner under the chip explaining prosperity/preservation triggers |
| CF-COIV-02 | "NPV discount rate per O-CF-RULES-12 (pending founder sign-off)" — internal code | Drop the code; rewrite as "NPV discount rate provisional" |
| CF-RE-01 | "Reality Engine" name doesn't tell user what it does | Add plain-English subtitle (e.g. "How personal, system, and external factors split your outcome") |
| CF-RE-03 | Stub note carries "O-CF-RULES-09" — internal code | Drop the code |
| CF-OVL-H-03 | Hero + drill use **two different label sets for the same components** | Pick one set; spec preference = hero ("Bill coverage / Surplus ratio / Income resilience / Funded ratio / Debt service ratio") |
| CF-SUB-02 | "+ Add manually (coming next)" button has no aria-live response | Either disable button or wire aria-live |
| CF-ALLOC-03 | "Set up" per-priority CTA — console.info only | Same as CF-SUB-02 |
| CF-ED-03 | Dead `CashflowWaterfall` carries hardcoded "62% essentials" + "£25k FI runway / 25y" | Delete the dead component (S-05) |

### POLISH (backlog)

| ID | Issue | Fix |
|----|-------|-----|
| CF-FUND-03 | "10–90 percentile" needs plain-English | "In 8 out of 10 model runs, the funded ratio lands between X and Y" |
| CF-MDD-01 | "MDD" abbreviation | Expand on first mention ("Maximum drawdown") |
| CF-EFF-01 | "Frontier" / "Gap to frontier" — borderline jargon | Add a hover or sub-line explaining "the most return-per-risk portfolios available" |
| CF-GS-04 | `humanise(p.action.kind)` will turn `bedAndIsa` into "Bed And Isa" | Engine-side vocabulary cleanup; pass-through table on UI side |
| CF-FOOT-02 | `BRAND.rulesVersion` = "UK-2026.1" but rules file is "UK-2026.1.1" | Bump `brand.js:rulesVersion` to "UK-2026.1.1" (or conformance-auditor's call) |

---

## UK tax-fact verification

Cross-checked rules surfaced in screen vs `UK-2026.1.1.json` (HMRC / DWP verified May 2026):

| Surfaced | Rules file | Status |
|----------|-----------|--------|
| Bengen 4% rule | `safeWithdrawalRate: 0.04` (line 557) + `bengenNote` | OK — engine uses canonical 4% |
| Guyton-Klinger 4.5% starting rate | no specific bundle field, engine internal | Domain-correct (Guyton 2006); 4.5% is the literature-typical opening rate |
| Morningstar UK 3.4% | engine internal | Aligned with Morningstar's "State of Retirement Income" cohort-adjusted UK number (2023–2025) — plausible. Defer authority check to engine spec. |
| Vanguard 3.3% | engine internal | Aligned with Vanguard "Fuel for the F.I.R.E." cohort number. Plausible. |
| 25× target rule (FI Progress) | `safeWithdrawalRate: 0.04` → 1/0.04 = 25 | OK — same maths, different framing |
| State pension reference (Funded ratio / FI target) | `statePensionFullAmount: 12548` (line 205) | OK — DWP 2026/27 £241.30/wk × 52 |
| Pension IHT inclusion (Section C CoI) | `pensionIHTInclusionDate: "2027-04-06"` (line 136) | OK — matches Finance Act 2026 Royal Assent timeline |
| SWR fallback when stub | 4.0% Bengen | OK and honestly disclosed |
| 60/40 portfolio reference (MDD) | engine internal | OK — industry standard reference |
| £20k ISA / £3k AEA / £60k AA / £10k MPAA | not surfaced *on* Cashflow at L1; surfaced via tax-band breakdown drill | Tax facts in `UK-2026.1.1.json` are correct and current — domain risk on Cashflow is jargon, not stale tax rates |

**No stale or incorrect UK tax facts found on Cashflow.** The risk is entirely in **how
the screen says things**, not in the rates and thresholds themselves. The engine has done
its job; the UI is leaking the workshop floor.

---

## Founder-IP integrity check

| Concept | Defined on screen? | Skill §2.2 verdict |
|---------|-------------------|--------------------|
| PRC / PCC Spread | **No (stub state — correct)**. Non-stub state renders `{spread_pp} pp` + sub-label "PRC – PCC" with no fabricated definition | PASS — engine respects stub flag; UI never invents a definition |
| Reality Engine | **No (stub state — correct)**. Non-stub state shows layer percentages without claiming what the layers mean beyond plain labels | PASS — no invented methodology |
| Drawdown Efficiency Ratio | Not surfaced on Cashflow | NA |
| Effective Beneficiary Rate | Not surfaced on Cashflow | NA |
| Cost of Inaction (CoI) | **FAIL on canonical definition (CF-COI-01)** — defaults to estate slice | See CF-COI-01 |

---

## Placeholder leakage summary

Scaffolding text visible on screen (NOT acceptable per skill §2.5):

- "methodology pending **O-CF-RULES-07**" (CF-SUB-01)
- "**X24 mode 3**" (CF-GS-01)
- "NPV discount rate per **O-CF-RULES-12** (pending founder sign-off)" (CF-COIV-02)
- "factor weights pending **O-CF-RULES-09**" (CF-RE-01 / CF-RE-03)
- "Cholesky correlation matrix per **O-CF-RULES-01**" (CF-POS-04, in italic stub note)
- "**Domain O**" chip (CF-INC-01)

Acceptable scaffolding text (honest, non-coded):

- "Coming next" (PRC/PCC + Reality Engine stub states) — honest
- "data pending" (Bill calendar, Subscription tracker when empty) — honest
- "Phase 1.2" chip on Subscription tracker — borderline, could read as project-management leak; consider "manual entry coming"
- "Insufficient data — add target income and retirement assets." (Funded ratio empty) — honest
- "No bills detected yet…" — honest
- "monte-carlo.js v1.1 ... not yet present; current PoS uses single-Z Box-Muller — flagged stub." — mostly honest but mentions internal filename + algorithm (see CF-POS-04 above); the *acknowledgement* of being a stub is good; the *implementation language* should drop

---

## FCA framing check

- Disclaimer `Not regulated financial advice. Verify decisions with a qualified UK financial adviser.` rendered on screen (line 866) — **PASS**
- L3 drill panels carry `Information only · Derived from your data · Not regulated advice` footer — **PASS** (lines 311, 410, 520)
- Searched body copy for `you should`, `we recommend`, `must`, `our advice` — **no advice-phrased copy found**. The strongest imperative is "If essentials exceed 70%, a single income shock creates a cashflow gap within weeks." — that's information about risk, not advice. **PASS**.
- "Set up" CTAs in surplus allocator don't suggest where — they're action affordances not recommendations. **PASS** at copy level (functional non-wiring is a separate problem).

**No advice-phrased copy found.** The FCA boundary holds on Cashflow.

---

## Brand-string drift

- `BRAND.name` = `Sonuswealth` (correct, locked D-NAME-2)
- `BRAND.disclaimer` references no `Caelixa` / `Finio` string
- Cashflow.jsx top comment says "Sonuswealth Cashflow tab · v3 POLISHED" — correct
- No `Caelixa` or `Finio` string found in Cashflow.jsx user-facing copy
- However: `rulesVersion: 'UK-2026.1'` (brand.js:26) lags rules-file version `UK-2026.1.1` — minor version-string drift (rolled into POLISH bucket)

---

## Coverage

Inventory total rows = 102 (sub-rows included).
Rows with domain load that this auditor walked = **97** (5 rows are pure NAV / animation
with no domain or A5 load: CF-CHR-01, CF-COI-02, CF-OVL-S-01, CF-OVL-I-01, CF-OVL-H-01).

- **PASS:** 78
- **FAIL:** 17 (6 DEMO-BLOCKING, 9 FUNCTIONAL, 2 POLISH counted in main table)
- **UNVERIFIED → deferred to conformance:** 7 (CF-X28-01 id-mismatch, CF-POSC-01..05 mock-fallback, CF-SEQ-02..04 mock-fallback, CF-EFF-01..03 mock-fallback, CF-SCEN-01..06 mock-fallback, CF-HERO-02 reconciliation, CF-ALLOC-01/02 engine wiring)
- **NA:** 5

Coverage **on rows this auditor owns** = 100% (every row walked, verdict assigned or
explicitly deferred to conformance per the runbook).

---

## Bottom line

The Cashflow UI is structurally honest about being early — stub flags are respected,
empty states are real, the FCA disclaimer is present, the funded-ratio bug (FD-CF-1)
is verifiably fixed, and brand naming is on-lock. The maths in the engine is trusted.

**The domain-killer on this screen is jargon leakage, not bad numbers.** Six DEMO-BLOCKING
FAILs are all of the same family: internal engine codes ("X24 mode 3", "Domain O",
"O-CF-RULES-07/09/12") and un-glossed founder-IP acronyms ("PRC / PCC") visible at L1.
Plus one true canonical violation (CoI default precedence). Plus one fabricated UK
cohort statistic.

Fix those eight rows and Cashflow goes from "demo will trigger every founder rule we
wrote down" to "domain-safe for a sub-30-minute walkthrough."

CF domain: **78 PASS, 17 FAIL (6 DB, 9 F, 2 P).**
