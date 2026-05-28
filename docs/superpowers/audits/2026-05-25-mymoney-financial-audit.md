# MyMoney — Sonus Financial Analyst audit (2026-05-25)

**Auditor:** Sonus Financial Analyst (IFA + CA + FCA, combined)
**Scope:** `src/screens/MyMoney.jsx` (L2 + inline PensionDrillDown) + 5 drill panels (`PropertyDrillDown`, `BusinessDrillDown`, `ProtectionDrillDown`, `LiabilitiesDrillDown`, `InvestmentsDrillDown`) + `TaxTreatmentBlock` + `PivotView` + `src/engine/fq-calculator.js` + rules bundle `src/rules/UK-2026.1.1.json`.
**Personas verified against:** `mrT-core` (35, director, all-domain) and `persona-a` Bruce Wayne (62, decumulation, £850k SIPP / £420k ISA / £1.8m residence).

---

## RATE VERIFICATION

Verified live against gov.uk/HMRC + Finance Act 2026 (May 2026 search):

| Rule | UI shows | gov.uk 2026/27 | Verdict |
|---|---|---|---|
| Personal Allowance | £12,570 (UK-2026.1.1.json + PivotView) | £12,570 | OK |
| Higher rate threshold | £50,270 | £50,270 | OK |
| Additional rate threshold | £125,140 | £125,140 | OK |
| ISA annual allowance | £20,000 | £20,000 | OK |
| Pension AA | £60,000 (PensionDrillDown via TAX.pensionAA) | £60,000 | OK |
| MPAA | £10,000 (PensionDrillDown line 1938) | £10,000 | OK |
| Lump Sum Allowance | £268,275 (PensionDrillDown line 1950) | £268,275 | OK |
| CGT AEA | £3,000 (PropertyDrillDown / UK-2026.1.1.json) | £3,000 | OK |
| CGT main rate (non-residential) | 18% / 24% (engine) | 18% / 24% from 30 Oct 2024 | OK |
| Dividend Allowance | £500 (PivotView line 115) | £500 | OK |
| Dividend basic rate | **8.75% (PivotView L115, decision-engine L771/849, fq-calculator L2143 comment)** | **10.75% from 6 Apr 2026 (Autumn Budget 2025)** | **MISMATCH** |
| Dividend higher rate | **33.75% (same files)** | **35.75% from 6 Apr 2026** | **MISMATCH** |
| Dividend additional rate | 39.35% | 39.35% | OK |
| IHT NRB | £325,000 | £325,000 | OK |
| IHT RNRB | £175,000 | £175,000 | OK |
| Pension IHT | ENACTED FA 2026 — pensions enter estate 6 Apr 2027 (engine has `pensionIHTInclusionDate: 2027-04-06`) | ENACTED — Royal Assent 18 Mar 2026, effective 6 Apr 2027 | OK |
| BPR/APR cap | **£1,000,000 (BusinessDrillDown L107, L139; eligibility.js L515)** | **£2,500,000 per individual (£5m couple) from 6 Apr 2026, Finance Act 2026 s65 sch12** | **MISMATCH — 2.5× under-stated** |
| AIM BPR rate | 50% (BusinessDrillDown L136 wording correct; UK-2026.1.1.json `aimBPRRate: 0.5`) | 50% from 6 Apr 2026 | OK |
| Personal Savings Allowance | £1,000 / £500 / £0 (engine fallback) | £1,000 / £500 / £0 | OK |

**Status: RATE MISMATCH — three live errors. Two affect every director persona (dividend rates), one affects every business-owning persona (BPR cap).**

---

## TOP 3 HIGHEST-IMPACT FINDINGS

### 1. BPR cap hardcoded at £1m — should be £2.5m (CRITICAL tax error)
**File:** `src/components/MyMoney/BusinessDrillDown.jsx:107,136,139` + `src/engine/eligibility.js:515`
The Business drilldown for any director/business owner tells them their first £1m of qualifying assets get 100% IHT relief, with 50% above. The actual law (Finance Act 2026, in force since 6 April 2026) gives 100% relief on the first **£2.5m** per individual, transferable to spouse. For Mr T's company shares (or any small-business client), this **over-states IHT exposure by up to £1.5m × 40% × 50% = £300,000 per individual**. The bundle JSON (UK-2026.1.1.json L174) holds the correct £2.5m — the UI just isn't reading it. A client looking at this screen would believe a far worse IHT picture than reality, potentially driving unnecessary AIM-BPR purchases or insurance decisions.

### 2. Dividend tax rates two years out of date (HIGH tax error)
**File:** `src/components/MyMoney/PivotView.jsx:115` + `src/engine/decision-engine.js:771,849` + `src/engine/fq-calculator.js:2143` (comment)
Income pivot tells every director "dividends taxed at 8.75% / 33.75% / 39.35%". Correct 2026/27 rates are **10.75% / 35.75% / 39.35%** (announced Autumn Budget 2025, effective 6 April 2026). The new engine module `uk-tax-2026-1-1.js:389` knows the right rate; TaxEstate.jsx:696-697 displays the right rate; but the canonical MyMoney income pivot and the decision-engine still display the old rates. For a director taking £100k in dividends, this under-states their dividend tax bill by **2% × £99,500 = £1,990/yr** — and points them at the wrong optimal salary/dividend split.

### 3. PensionDrillDown does NOT surface SIPP-IHT April 2027 inside the drill (HIGH IFA + compliance gap)
**File:** `src/screens/MyMoney.jsx:1749-2098` (inline `PensionDrillDown`)
The pension drilldown shows scheme list, AA/MPAA/carry-forward, LSA, drawdown editor, projected impact. The IHT impact tile (L2069-2070) computes "Inheritance tax with this plan / Inheritance tax saved" via `ihtDynamic()` — but nowhere in the drill does it tell the user *why* the IHT bar moves: that from 6 April 2027 unused DC pension funds enter their estate. The TaxTreatmentBlock at L1814 calls a tax-treatment summary that does include "In your estate from April 2027" — but this is buried in a generic three-row block at the top, not flagged as a regulatory countdown. Bruce Wayne is 62 with £850k SIPP — the single biggest planning trigger in his life is the 2027 cliff, and the screen he goes to *to plan his SIPP drawdown* does not foreground it. Home and TaxEstate both have ENACTED · FA 2026 countdown chips; MyMoney's owning surface does not.

---

## Engine Accuracy

| Sev | Finding | Fix | File:line |
|---|---|---|---|
| CRITICAL | `bprCap = 1_000_000` hardcoded, should read from `TAX_JSON.inheritanceTax.aprBprCombinedAllowance` (= 2_500_000) | Replace const with `TAX.aprBprCap ?? TAX_JSON?.inheritanceTax?.aprBprCombinedAllowance ?? 2_500_000`; update copy "£1m combined cap" → "£2.5m combined cap"; update sub-text "100% relief on first £1m" → "£2.5m" | `src/components/MyMoney/BusinessDrillDown.jsx:107,136,139` |
| HIGH | Dividend rates hardcoded as 8.75/33.75 in income pivot | Read from `TAX_JSON.income.dividendBasicRate` / `dividendHigherRate` (already in bundle at 0.1075/0.3575) | `src/components/MyMoney/PivotView.jsx:115` |
| HIGH | Dividend rate comment + S455 copy uses 8.75/33.75 | Update comments + copy strings to current rates | `src/engine/fq-calculator.js:2143`; `src/engine/decision-engine.js:771,849` |
| HIGH | `eligibility.js:515` BPR description: "£1M combined APR/BPR allowance" | Change to "£2.5M combined APR/BPR allowance" | `src/engine/eligibility.js:515` |
| MEDIUM | `PensionDrillDown` IHT projection uses `ihtDynamic(entity, true)` — silently swallows engine error (`catch { }`) at L1784. If engine throws on real entity, screen silently shows £0 IHT delta with no warning. | Log to console and render "IHT projection unavailable" chip rather than silent zero | `src/screens/MyMoney.jsx:1779-1784` |
| MEDIUM | `PensionDrillDown` "Stay in basic-rate band · £37,700/yr" preset (L1770) uses raw £37,700 — that's the basic-rate BAND not the higher-rate threshold. A user with state pension on top would tip into higher rate at £37,700 of drawdown + £12,548 state pension = £50,248 — already in 40% band. Label is misleading. | Either compute as `max(0, TAX.brt - statePension - otherIncome)` per persona, or change label to "Take £37,700/yr of taxable income" with a sub-note | `src/screens/MyMoney.jsx:1770` |
| MEDIUM | PropertyDrillDown displays "+5% SDLT surcharge" chip (L200) — correct (raised from 3% on 31 Oct 2024) — but no caveat that this is a one-off acquisition charge, not annual. Cosmetic context risk. | Add `sub="On purchase"` or chip title | `src/components/MyMoney/PropertyDrillDown.jsx:200` |
| LOW | `ihtSippDelta` not surfaced in PensionDrillDown despite being imported into MyMoney.jsx — engine computes the SIPP-specific IHT delta but nothing renders it in the pension overlay | Add a dedicated "April 2027 IHT exposure" tile inside PensionDrillDown using `ihtSippDelta(entity)` | `src/screens/MyMoney.jsx:27,1779-1784` |

---

## IFA Findings

| Sev | Finding | Why it matters | File:line |
|---|---|---|---|
| HIGH | **No SIPP-IHT 2027 countdown inside PensionDrillDown.** Bruce Wayne is 62 with £850k SIPP. The single biggest decumulation decision is "draw or preserve before 2027?" The screen he goes to for drawdown planning doesn't flag the cliff. | Clinical mis-step. Standard IFA workflow for a 60-something with DC pension is: phased TFC + spend ISA/GIA first + preserve SIPP until 2027 if estate-focused, or accelerate drawdown if income-focused. Without the date visible, the planning question never gets framed. | `src/screens/MyMoney.jsx:1749-2098` |
| HIGH | **No concentration warning on residence for Bruce.** Bruce holds £1.8m residence / £3.07m gross assets = **59% in one illiquid asset**. PropertyDrillDown shows the figure but no concentration chip flags this. By contrast BusinessDrillDown (L239) shows "Concentration risk" on share schemes. | A 62-year-old in decumulation with 60% of NW in primary residence has a liquidity problem and a sequence-of-returns problem (can't drawdown from a house). The Risk screen surfaces concentration via D5; MyMoney's PropertyDrillDown is silent. The owning surface should at minimum render the concentration % when residence > 40% of NW. | `src/components/MyMoney/PropertyDrillDown.jsx` (no concentration metric rendered) |
| HIGH | **Drawdown preset "Safe withdrawal rate · £X/yr" uses `guardrail()` = `investable × TAX.swr` (0.04)** (`fq-calculator.js:177-178`). This is Bengen 4% applied to investable (which excludes residence). For Bruce: investable ≈ £1.27m × 4% = £50,800/yr. **But Bengen is 30-year horizon with 60/40 equity/bond — Bruce is 62, target income £120k, so already a mismatch** (£50k SWR vs £120k target). The preset label suggests safety without context. | A user clicking "Safe withdrawal rate" expects a number they can live on. £50k vs target £120k means either the SWR preset is wrong for this persona or the target is unrealistic — but the UI presents the number neutrally. An IFA would frame this as "SWR sustains £50k for 30 years; your stated target of £120k requires either a £3m pension at 4%, or pulling forward inheritance, or capital depletion." | `src/screens/MyMoney.jsx:1771`; `src/engine/fq-calculator.js:177-178` |
| MEDIUM | **No director optimal salary/dividend computation surfaces in MyMoney L2.** Director Intelligence Layer at MyMoney.jsx:3261+ flags "salary too high" but doesn't show the *optimal* mix (e.g. £12,570 salary + dividends to BR top). | A director persona (Mr T) glances at MyMoney and sees the gate fires but no concrete number. The decision-engine knows the answer (DE-25 at decision-engine.js:849). Surface it on MyMoney rather than only inside the Decision Engine drill. | `src/screens/MyMoney.jsx:3261-3340` |
| MEDIUM | **Nomination staleness logic** (PensionDrillDown L1888-1921) categorises >5y as "stale" — but the UI gives only `Mark reviewed` button, no path to actually update the nomination form with the provider. Bruce's "Wayne Enterprises DC (legacy)" pension nomination dates from 2019-06-01 — currently ~7 years stale — and the affordance just records the user clicked a button without actually doing anything. | Affordance-honesty risk. The CTA implies action; the action is decorative. Either label "Mark reviewed" → "Mark reviewed (offline)" or wire it to a real provider-portal hand-off task. | `src/screens/MyMoney.jsx:1908-1918` |
| MEDIUM | **Protection drill shows pillars covered (life/CI/IP/PMI) but no gap quantification on the L2 MyMoney surface.** Risk screen has `protectionGapCard()` per coverage type; MyMoney protection panel doesn't surface the £ gap. | A user looking at MyMoney for "how much insurance do I have" gets the answer; the implicit follow-up "how much should I have" requires cross-screen jump to Risk. Decumulation-stage personas (Bruce) have low protection need so this is mild; accumulation-stage with dependants (mrT-couple, family personas) it is material. | `src/components/MyMoney/ProtectionDrillDown.jsx:148-152` |
| LOW | **No SIPP cost rationality flag.** Bruce has 3 SIPPs with charges 0.15% / 0.45% / 0.65% (Aviva legacy). Aggregated effective TER on £850k = ~£3.4k/yr; consolidating to lowest = ~£1.3k. Drilldown shows nothing about charge optimisation. | Mildly. Direct cost saving of £2k/yr × 20 years compounding = real money. Worth a chip. | persona-a.json `charge` fields rendered but no comparison |

---

## Tax Findings

| Sev | Finding | HMRC ref | File:line |
|---|---|---|---|
| CRITICAL | BPR cap £1m → £2.5m (covered in Top 3 + Engine Accuracy) | Finance Act 2026 s65 sch12 | BusinessDrillDown.jsx:107 |
| HIGH | Dividend rate 8.75/33.75 → 10.75/35.75 (covered in Top 3 + Engine Accuracy) | Autumn Budget 2025; ITA 2007 s8 | PivotView.jsx:115 etc. |
| HIGH | **ANI cliff-edge warning at line 982 uses bare £100,000 constant** (`const cliff = 100_000`) instead of reading from bundle. Same value, but inconsistent with the wrapper-first principle of "never hardcode in UI". | s35 ITA 2007 — PA taper £1 per £2 over £100k | `src/screens/MyMoney.jsx:982-983` |
| MEDIUM | **PivotView income pivot "personal allowance taper" math (L179)** computes `pa = max(0, 12570 - max(0, ani-100000)/2)` — correct formula, but uses raw `12570` hardcoded instead of `TAX.pa ?? 12570` (it does use TAX.brt and TAX.art for the other thresholds — inconsistent). | s35 ITA 2007 | `src/components/MyMoney/PivotView.jsx:179` |
| MEDIUM | **S24 BTL chip** (PropertyDrillDown.jsx:175 / 196) correctly flags "only 20% basic-rate credit since April 2020" — but the per-property tile doesn't show the actual £ impact (mortgage interest × 20% = credit; full deduction lost). For a HR landlord with £20k interest, that's £4k vs £8k credit = £4k bigger tax bill. | ITTOIA 2005 s274A; FA 2017 s40 | PropertyDrillDown.jsx:175-196 |
| MEDIUM | **CGT residential rate post-Oct 2024** correctly shows 18%/24% — but PropertyDrillDown does NOT distinguish residential (18/24) from non-residential (now also 18/24 from 30 Oct 2024 — same rate, but distinction matters for carried interest at 28%). Cosmetic but a CA would flag. | TCGA 1992 s1H; FA 2025 | PropertyDrillDown.jsx (CGT section) |
| LOW | **Carry-forward AA tile** (PensionDrillDown L1940) reads `entity.carryForward3yr` — if absent or stale, shows £0 silently. Carry-forward calculation is non-trivial (need 3 years of unused AA, must be member of pension in each year). No "data missing" state. | s228A FA 2004 | PensionDrillDown.jsx:1940 |
| LOW | **MPAA status** correctly reads `entity.mpaaTriggered` (PensionDrillDown L1938) — but no logic to AUTO-TRIGGER MPAA when the user commits a `DRAWDOWN_SCHEDULE_SET` that includes flexi-access drawdown amount > 0 (it should). Currently relies on persona JSON to pre-set the flag. | s227G FA 2004 | PensionDrillDown.jsx:1938 |
| LOW | **State Pension full amount £12,548** — engine knows this (UK-2026.1.1.json corrected from £11,502). Bruce persona doesn't yet draw state pension (age 62, SPA 66) so not visible on his screen; verify on aged-out personas. | DWP 2026/27 rates | not visible MyMoney |

---

## FCA Boundary

**Verdict: MOSTLY CLEAR with two FLAGS.**

| Status | Finding | Why it matters | File:line |
|---|---|---|---|
| PASS | MyMoney L2 has `BRAND.disclaimer` rendered at footer L3442-3443. PensionDrillDown has `BRAND.disclaimer` at L2094. | Page-level boundary met. | MyMoney.jsx:3442, 1749:2094 |
| FLAG | **Drilldowns OTHER than PensionDrillDown do not render a per-drill FCA boundary line.** PropertyDrillDown, BusinessDrillDown, ProtectionDrillDown, LiabilitiesDrillDown, InvestmentsDrillDown — none have a footer disclaimer. Per Cashflow audit precedent ("L3 drill panels carry `Information only · Derived from your data · Not regulated advice` footer — PASS"), drill panels should each carry the boundary. | A user lands directly on the Business drill via Home priority action → sees concrete numbers ("£500k above cap × 50% relief = £200k IHT to pay") with no scoped boundary. Page-level disclaimer is up at MyMoney L3442, two screens removed from the user's eyeline. | All 5 component files in `src/components/MyMoney/*DrillDown.jsx` |
| FLAG | **PivotView income pivot subtitle copy at L143** "salary first, then interest, then dividends. Each layer fills its rate band before the next." This is information; it's fine. BUT the surplus banner copy at L745 in PivotView reads "Priority order: (1) top up your ISA — £20k/yr tax-free growth, (2) pension contributions — 40–47% tax relief at your rate, (3) overpay debt if mortgage rate > expected investment returns." — this is a **prioritised recommendation** ("Priority order: (1)..."). That's advice-phrased. | "Priority order" + numbered actions is the textbook FCA pattern for crossing from guidance into advice. Compare with safe phrasing: "Three common moves with surplus include ISA top-up, pension contribution, or debt reduction — the right order depends on your tax rate and time horizon." Same information, no recommendation. | PivotView.jsx:745 |
| PASS | Income tile copy "Marginal rate · What every extra £1 is taxed at" — information, not advice. OK. | | PivotView.jsx:139 |
| PASS | PensionDrillDown drawdown presets are descriptively labelled ("Take nothing", "Stay in basic-rate band", "Safe withdrawal rate", "Smooth withdrawals"). Each is computation, not recommendation. OK. | | MyMoney.jsx:1768-1773 |
| PASS | TaxTreatmentBlock copy is consistently descriptive: "Income and growth tax-free inside the ISA" / "Outside your estate today. In your estate from April 2027." — pure tax-treatment statements, not "you should X". OK. | | src/engine/tax-treatment.js |
| FLAG (mild) | "Mark reviewed" CTA on stale nominations (PensionDrillDown L1908-1918) commits an event but does nothing actually material (provider portal not opened). This crosses into the "labels must match what's behind them" rule rather than pure FCA — but a user clicking and believing they've updated their beneficiary is a real harm vector. | Per `feedback_cta_honesty_pre_launch.md` memory: "CTA labels must match what's behind them pre-launch." | MyMoney.jsx:1909-1917 |

---

## What's solid

- **TaxTreatmentBlock + tax-treatment.js engine** is well-designed. Three-row IT/CGT/IHT split per wrapper, plain English, explainer hooks, pre-2027 vs from-2027 SIPP IHT framing baked in. This is the quiet hero of the screen. (`src/engine/tax-treatment.js:1-80`)
- **PensionDrillDown LSA cap math** at line 1959 correctly caps tax-free cash at `min(sipp × 25%, TAX.lsa)` — exactly right per s636A FA 2004 post-LTA-abolition rules. Many other apps still display 25% uncapped. (`MyMoney.jsx:1959`)
- **ANI 6-step display + £100k cliff-edge bar** (MyMoney.jsx:973-1015, 1364-1365) is genuinely useful — visualises the marginal-rate cliff between £100k–£125,140 where effective rate hits 60%. The kind of explainer most calculators bury in fine print. The cliff bar fires at the right threshold.
- **Rules bundle `UK-2026.1.1.json`** is meticulous — correction log lists every change from prior version with source citation. Engine has the right numbers; the gaps are all UI components not reading from the bundle.

---

## Client-ready summary

If Bruce Wayne (62, £850k SIPP, £420k ISA, £1.8m residence, target £120k income, deceased spouse, hasTrust) sat in front of MyMoney today, the **wrapper-first taxonomy, ANI display, LSA cap, and three-row tax-treatment block would all serve him well** — these are correct, current, and well-presented. The numbers in his pension drilldown are right, the projected IHT delta computes against the right bundle, the safe-withdrawal preset uses the right `TAX.swr`. A planner could hand him this screen with confidence on those pieces.

**But he would not be told three things he urgently needs to know:**

1. His SIPP enters his estate in **328 days** (6 April 2027). The pension drill — the place he goes to *plan* his drawdown — does not display this countdown. The screen surfaces "IHT saved by this plan" in £ but never explains *why* the IHT moves. The home screen and Tax & Estate both have an enacted-2026 countdown chip; the owning surface for pension drawdown does not.

2. He has **59% of his net worth in one illiquid asset** (his £1.8m residence). The property drilldown shows the value, the equity, the RNRB position, the PPR status — all correct — but does not flag the concentration. The Risk screen catches this via D5; the owning balance-sheet surface is silent.

3. The **safe-withdrawal-rate preset (£50.8k/yr) cannot fund his stated target of £120k**. The preset presents the number neutrally; an IFA would frame the £69k gap explicitly and walk through the options (capital depletion, residence equity release, target reduction).

If Mr T (35, director, £60k target, business assets) sat in front of MyMoney, **he would see his BPR cap as £1m instead of £2.5m** — a 2.5× under-statement of relief, potentially driving him to over-purchase AIM-BPR shares or insurance to cover an IHT exposure that doesn't exist at the stated level. He would also see his **dividend tax rate as 8.75% / 33.75%** when the actual 2026/27 rates have been 10.75% / 35.75% for 49 days. The director-intelligence layer correctly flags "salary too high" but reasons against stale rates.

**Bottom line for the planner:** The engine is mostly right; the UI surface in three specific places (BusinessDrillDown BPR cap, PivotView dividend rates, PensionDrillDown missing SIPP-IHT countdown) carries stale or absent information that would mislead a real client. The FCA boundary holds at page level but breaks at drill level (4 of 5 drill panels lack scoped disclaimers) and once in PivotView surplus banner ("Priority order: (1)..."). Fix the £1m → £2.5m hardcode and the dividend strings, add a SIPP-IHT chip to PensionDrillDown, and add per-drill FCA footers, and the screen is client-ready.
