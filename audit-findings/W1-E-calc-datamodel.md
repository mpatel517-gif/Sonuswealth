# W1-E — Financial-Calculation Correctness + Data-Model Integrity

**Agent:** W1-E (relaunch) · **Date:** 2026-06-11 · **Method:** static + node-script, no UI
**Codebase:** C:\Users\Powernet\Desktop\finio
**Finding IDs:** F-500..F-599

Sections appended as completed:
1. Engine-duplication map
2. Golden-vector spot-checks
3. Canonical entity-field map
4. Wrong-key grep sweep

---

## SECTION 1 — ENGINE-DUPLICATION MAP

Method: grepped all parallel computations of the same financial concept in `src/engine/`; ran each pair via node on mrT-core, persona-a, persona-family (`audit-findings/w1e-dup-runner.mjs`). All figures below are actual engine outputs from this run (2026-06-11, bundle UK-2026.1.1).

### F-500 · CRITICAL — Monthly surplus: `monthlyFlow` vs `monthlySurplus` disagree on SIGN
- `src/engine/monthly-flow-engine.js:47 monthlyFlow` — no-tax, income = `income.employment + dividends + rentalIncome + drawdown + statePension`, expenses = `expenses.monthly ?? targetIncome/12`.
- `src/engine/fq-calculator.js:2784 monthlySurplus` → `cashflowFlow` (fq:2872) — tax-aware, income = `calcAllIncome`, essentials = `_currentEssentialsAnnual` (expenses else 60%-of-gross), plus committed pension/ISA + debt service.
- Measured: **mrT-core: monthlyFlow surplus +£464/mo vs monthlySurplus deficit −£900/mo** (sign flip). **persona-a: −£7,067/mo vs −£591/mo** (12x magnitude; monthlyFlow wrongly uses targetIncome £120k retirement target as current spend — exactly the bug cashflowFlow's comment says was fixed 2026-06-02, but fixed on only ONE of the two engines). persona-family: +£1,108 vs −£1,202 (sign flip again).
- Consumers: HomeScreen.jsx:1287/2065 uses `monthlySurplus` (fq); **`src/de/composer.js:71+82` uses BOTH** — `monthlySurplus` for the surplus number and `monthlyFlow` for `annualIncomeFmt` (line 111), so a single Ask-Sonu/DE card can state an income and a surplus that don't reconcile. `src/de/validator.js` exposes both to DE cases.

### F-501 · CRITICAL — Net worth: `netWorth` vs `calcNetWorth` differ by up to £1.8m
- `src/engine/fq-calculator.js:138 netWorth(e)` (flat+nested precedence contract) vs `fq-calculator.js:258 calcNetWorth(entity)` (nested-only with DB-CETV exclusions).
- Measured: mrT-core **£1,747,850 vs £1,024,850**; persona-a **£3,900,000 vs £2,100,000** (legacy-flat property/residence missed by calcNetWorth); persona-family agrees (£408,900).
- Consumers: screens (HomeScreen.jsx:52, Timeline.jsx:45, RadarAnchor) show `netWorth`; **`calcFQ` (fq-calculator.js:344) builds the Wealth Score from `calcNetWorth`**, and `src/de/composer.js:69` feeds `calcNetWorth.net` to every DE/Ask-Sonu summary. The header number and the score/DE number are different facts for the same user.

### F-502 · CRITICAL — IHT: `ihtDynamic` (fq:602) vs `ihtExposure` (tax-estate-engine.js:644)
- Different estate bases (fq gross mrT £2,134,540 vs te £1,929,040; persona-a £4,080,000 vs £3,230,000); te deducts funeral £5k + full APR/BPR/AIM relief tiers, fq applies only a flat BPR line.
- Measured IHT due: **mrT-core £429,940 (fq) vs £287,240 (te)** — £142,700 apart; **persona-a £1,428,000 vs £1,088,000** — £340,000 apart; family 0 vs 0.
- Consumers split: T&E `InheritanceStory.jsx:22` + MyMoney `L3Sections/IHTEstatePayloads.js` use te `ihtExposure`; **`src/de/composer.js:70` broadcasts fq `ihtDynamic` into Ask-Sonu prompts** (line 448 "IHT exposure: ..."). User sees £287k on the Tax tab and the assistant cites £430k.

### F-503 · HIGH — TWO `allowanceTracker` functions reading different entity fields
- `fq-calculator.js:3569` — ISA used from `assets.investments[].contribution_current_tax_year`; CGT used from `income.realisedGains`; NO pension AA.
- `tax-estate-engine.js:449` — ISA used from `assets.isa.usedThisYear`; CGT from `assets.cgt.realisedThisYear[]`; pension AA from `entity.pension.contributionsThisYear` (silent-zero on all personas — see F-510).
- Measured ISA used: mrT-core **£10,500 (fq) vs £0 (te)**; persona-family **£0 (fq) vs £11,000 (te)** — opposite blind spots, each tracker wrong on one persona.
- Consumers: TaxEstate.jsx:1338/3335/3617/3713/3779 + MyMoney.jsx:1666/3952 use fq version; TaxEstate.jsx:1345 uses te version for `pension_aa` only. Same screen, two trackers.

### F-504 · CRITICAL — NIC: `nicsDetail` reads `income.salary` ONLY → £0 NIC for employment-key personas
- `tax-estate-engine.js:309` `const salary = entity.income?.salary || 0` — single key. `cashflowFlow` (fq:2882) MAXes 4 salary aliases (its comment explicitly calls out nicsDetail's "single-field read").
- Measured persona-family (employment £68,500): **nicsDetail = £0 vs correct £3,381** (hand: (50,270−12,570)×8% + (68,500−50,270)×2% = £3,380.60).
- Blast radius: `taxThisYear` (te:210) → T&E tax summary under-reports total tax by £3,381 for this persona; MyMoney `TaxObligationsPanel.jsx:81/142` + `TaxObligationsPanel.data.js:30` show £0 NIC; DE validator `tax.nicsDetail`. Cashflow tab (cashflowFlow) shows the correct NI → cross-tab contradiction.

### F-505 · HIGH — `_grossIncome` (tax-estate-engine.js:133) returns £0 for ALL THREE personas
- Reads `income.salary/selfEmployed/rental/other + drawdown` — none of the modern persona keys (`employment`, `rentalIncome`, `dividends`). Measured £0 on mrT-core, persona-a, persona-family.
- Still live in: `taxDrag` (te:525-526) → **`drag_pct` = 0 early-return for every persona** (DE chartHints `taxDrag`, ontology.js:506/524); te `allowanceTracker` tapered-AA flag (te:497) can never fire.

### F-506 · HIGH — FOUR income aggregators still live (a fifth retired)
| Aggregator | mrT-core | persona-a | family |
|---|---|---|---|
| `calcAllIncome` (fq:3440) | 67,420 | 35,200 | 68,500 |
| `taxableIncomeBreakdown` (taxable-income.js:47) | 62,220 | 35,200 | 68,500 |
| `annualIncome` (_helpers.js:498) | 65,570 | 35,200 | 68,500 |
| `_grossIncome` (te:133) | 0 | 0 | 0 |
| `monthlyFlow` inline sum (monthly-flow-engine.js:57) | 65,570 basis | 35,200 | 68,500 |

mrT divergence: calcAllIncome uses gross rental (15,000) + interest; breakdown uses net rental (9,800); annualIncome omits interest. Tax path is consistent (good — calcIncomeTax/taxThisYear/incomeTaxDetail all delegate to taxableIncomeBreakdown since 2026-06-08), but Cashflow gross (calcAllIncome) vs Tax gross (breakdown) differ by £5,200 for mrT.

### F-507 · MEDIUM — Dividend-allowance "used" semantics differ between the two trackers
fq tracker `dividend.used` = full dividend income (mrT £38,000 against a £500 limit, pctUsed clamped 100); te tracker = `min(allowance, dividends)` = £500. Any UI showing "used/limit" from the fq one renders "£38,000 of £500".

### F-508 · MEDIUM — Age computed by 5 independent functions
`calcAge(dob)` fq:217 (dob-only — mis-handles persona-a/e which carry `age` but no dob); `_personAge` (_helpers); `ageAtTaxYear` (taxable-income.js:30, explicit-age-first — its comment documents calcAllIncome mis-gating state pension for persona-a/e via calcAge); `ageOf` x3 in ask-sonu (synthesizer.js:62, matcher.js:27, knowledge-graph.js:38). State-pension gating therefore differs by call path.

### F-509 · MEDIUM — Third banding implementation survives in tax-estate-engine
`_incomeTaxBands`/`_effectivePA`/`_marginalRate` (te:139-174) duplicate fq `calcPersonalAllowance`/band-walk; still reachable via `_savingsInterestTax` and the tapered-flag paths. Plus `welshIncomeTax`/`scottishIncomeTax` (fq:3925/3940) are separate band-walks not unified with `calcIncomeTax`.

### F-510 · HIGH (known, confirmed live) — pension AA "used" silent-zero
te allowanceTracker `pension_aa.current_year.used` = `entity.pension.contributionsThisYear` → 0 on all three personas even though mrT carries `assets.pensions[].contribution_monthly_personal` (fq cashflowFlow reads those for `committed`). TaxEstate.jsx:1345 renders this zero.

### Resolved/benign duplicates (verified agreeing)
- `netWorthAtYears` (fq:2656) vs `netWorthAtHorizon` (projection.js:114): identical values on all 3 personas (delegation in place).
- `incomeTaxDetail`/`taxThisYear` now delegate to `calcIncomeTax` — single tax base confirmed by run.
- `projectBTR` exists twice (risk-engine.js:509, modules/uk-risk-2026-1-1.js:1306) — module-mirror pattern; not value-tested here.
- Naming hazard: `PensionDrawdownPanel.jsx:13` names `ihtSippDelta` output "ihtExposure" — a different concept from either IHT engine (LOW).

---

## SECTION 2 — GOLDEN-VECTOR SPOT-CHECKS (engine vs hand-computed HMRC 2026/27)

All thresholds taken from `src/rules/UK-2026.1.1.json` (PA 12,570; bands 20/40/45; BRL 37,700; dividend 10.75/35.75/39.35 + £500 allowance; PSA 1,000/500/0; NIC 8%/2% over 12,570/50,270; CGT 18/24 + £3,000 AEA; IHT 40%, NRB 325,000, RNRB 175,000 tapering from £2m). Engine run via node on the live modules.

### Income tax — ALL THREE MATCH
**mrT-core** (NSND 22,370 = salary 12,570 + net rental 9,800; savings 1,850; dividends 38,000; total 62,220):
- NSND: 22,370 − 12,570 PA = 9,800 @ 20% = **£1,960**
- Savings: starting-rate band 5,000 fully displaced by NSND; PSA £500 (higher-rate, total > 50,270); (1,850 − 500) @ 20% = **£270**
- Dividends: 38,000 − 500 = 37,500; basic room 37,700 − (9,800+1,850+500) = 25,550 @ 10.75% = 2,746.63; 11,950 @ 35.75% = 4,272.13 = **£7,019**
- Hand total **£9,249** = engine `calcIncomeTax` £9,249 ✓ (nsnd 1,960 / savings 270 / div 7,019 components all match)

**persona-a** (rental 19,200 gross-as-net fallback; dividends 16,000; age 62 → state pension correctly excluded):
- NSND: 6,630 @ 20% = £1,326; dividends 15,500 all-basic @ 10.75% = £1,666.25 → 1,666
- Hand **£2,992** = engine £2,992 ✓

**persona-family** (salary 68,500): 37,700 @ 20% = 7,540 + 18,230 @ 40% = 7,292 → hand **£14,832** = engine £14,832 ✓

### NIC — ONE CRITICAL MISMATCH
- mrT-core salary 12,570 = primary threshold → hand £0 = engine £0 ✓
- persona-a (no salary/self-emp; rental+dividends not NICable) → hand £0 = engine £0 ✓
- **persona-family: hand Class 1 = (50,270−12,570)×8% + (68,500−50,270)×2% = 3,016.00 + 364.60 = £3,380.60 ≈ £3,381. Engine `nicsDetail` = £0** ✗ — suspect `tax-estate-engine.js:309` (reads `income.salary` only; persona carries `income.employment`). Same persona through `cashflowFlow` (fq:2882) = £3,381 ✓. → `taxThisYear.total_tax` for this persona reads £14,832 instead of £18,213. (= F-504.)

### CGT — vacuous pass
No persona has `assets.cgt.realisedThisYear` entries → hand £0 = engine `cgtDetail.tax_due` £0 on all three. Rate-selection logic (18% basic / 24% higher off marginal rate, AEA £3,000) verified by inspection against bundle; **no persona exercises the CGT path** — coverage gap for the calc audit, not an engine error.

### IHT — TWO RULE-LEVEL MISMATCHES + regime split
**persona-a, te `ihtExposure` (pre-2027 regime, SIPP 850,000 excluded):** estate 4,080,000 − 850,000 = 3,230,000 gross; − debts 180,000 − funeral 5,000 = 3,045,000 net; NRB 325,000; RNRB tapered to 0 (estate exceeds 2m by >1m); taxable 2,720,000 @ 40% = hand **£1,088,000** = engine £1,088,000 ✓ (given its regime assumption).
**persona-a, fq `ihtDynamic(includeSipp=true)` (post-2027 view):** 3,895,000 net; taxable 3,570,000 @ 40% = £1,428,000 — internally consistent, but the DE broadcasts this £1,428,000 while the Tax tab shows £1,088,000 with no regime label distinguishing them (= F-502).

### F-511 · HIGH — RNRB granted with NO direct descendant (both engines)
mrT-core's only relative is a sister (`dependants:[{type:'sibling'}]`); no children, `estate.directDescendant` absent. IHTA 1984 s8E: RNRB applies only when the home is closely inherited by direct descendants → correct RNRB = **£0**.
- te `ihtExposure` gate is `entity.estate?.directDescendant !== false` (tax-estate-engine.js:680) — **defaults to granting** when the field is absent.
- fq `ihtDynamic` (fq-calculator.js:674-691) has **no descendant check at all**.
- Hand IHT for mrT-core (te basis, RNRB removed): taxable 893,100 @ 40% = **£357,240** vs engine £287,240 → both engines understate IHT by **£70,000**. (`rnrbTaper` te:1216-1240 has the correct gate + warning, but `ihtExposure` doesn't use it.)

### F-512 · HIGH (latent) — calcANI gift-aid SIGN ERROR
`fq-calculator.js:3198`: `ani = total + giftAid * 0.25 − pensionRel − …` — gift aid **increases** ANI by 0.25×. HMRC: ANI = net income **minus** grossed-up gift aid (×1.25). Worked example: total 110,000, net gift aid 4,000 → correct ANI 105,000 (PA taper loss £2,500); engine ANI 111,000 (taper loss £5,500) → ~£1,200/yr over-tax + wrong £100k-cliff warnings. Latent today only because no persona carries `entity.giftAidAnnual`. The function's own `steps.grossedUpGiftAid: giftAid*1.25` (fq:3203) shows the intended figure that the formula then misuses.

### F-513 · MEDIUM — mrT-core fixture self-claim vs engine
Fixture declares `income.ani: 56800`; engine `calcANI` = 62,220 (Δ5,420). Cause: persona pension contributions live in `assets.pensions[]` shapes that calcANI's relief keys (`entity.pensionContribAnnual`/`pensionContribMonthly`) never read — the known silent-zero pension plumbing. Fixture also declares `marginal_rate: 0.4` vs engine 0.20-band outcome on its own base.

### F-514 · HIGH — TWO ANI relief key-sets inside the same tax path
`calcANI` (fq:3193-3197) reads `entity.giftAidAnnual / pensionContribAnnual / pensionContribMonthly / tradeLosses / qualifyingInterest`; `taxableIncomeBreakdown` (taxable-income.js:103) computes its own `ani` from `income.pensionContribs / pensionContributions / giftAid` — different keys AND no gift-aid gross-up. `calcIncomeTax` PA-taper uses breakdown.ani; `calcPSA`/`calcHICBC`/fq allowanceTracker use calcANI. An entity recording reliefs under either key-set gets a different personal allowance in the tax calc than in the PSA/HICBC/taper displays.

### F-515 · MEDIUM — RNRB taper base: gross vs net estate
te `ihtExposure` tapers RNRB on **gross** (tax-estate-engine.js:679); fq `ihtDynamic` tapers on **netEstate** (fq:690). HMRC tapers on the estate AFTER deducting liabilities (IHTA84 s8D) → te uses the wrong base; over-tapers any mortgaged estate near £2m (moot for the three test personas, real for a £2.2m-gross/£1.9m-net user: te kills £100k of RNRB that should survive = £40k phantom IHT).

### F-516 · LOW — `cashflowFlow.committed` misses nested contribution schema
persona-a saves £1,500/mo into SIPP recorded as `assets.sipp.pensions[].contribution_monthly.{personal,employer}`; cashflowFlow (fq:2894) reads only top-level `assets.pensions[].contribution_monthly_personal` → committed £0, surplus overstated by £18k/yr for persona-a. Same family of plumbing as F-510.

---

## SECTION 3 — CANONICAL ENTITY-FIELD MAP (writers → readers → capture → aliases)

Method: grepped every writer (persona fixtures in `src/rules/personas/`, the event-fold capture path `src/state/events.jsx` + `events-fold-helpers.js`) and reader (src/engine/**, src/state/**) for ~32 engine-critical fields; verified disagreements by running both aggregators via node on real + capture-shaped entities. "Capture?" = can the live UI Add-flow write this field (events.jsx is the ONLY runtime writer; everything else is fixture-only).

### 3.1 Income fields (the legacy-vs-event-fold split, measured)

| # | Field | Writers | Readers | Capture? | Alias group / hazard |
|---|---|---|---|---|---|
| 1 | `income.employment` | capture EMPLOYMENT (events.jsx:712); personas a–g | all 4 aggregators via MAX-alias (fq:3452, taxable-income.js:55, _helpers annualIncome, monthly-flow:57); risk-engine | YES | salary-alias group (MAX, never SUM) |
| 2 | `income.salary` | legacy fixtures | aggregators; **te `nicsDetail`:309 reads ONLY this key** (F-504); ask-sonu classifier | no | salary-alias |
| 3 | `individual.gross_salary` | mrT-* fixtures | fq:2883/3452, taxable-income, decision-engine.js:32 | no | salary-alias |
| 4 | `income.directorSalary` | capture DIRECTOR_SALARY (events.jsx:714) | taxable-income + calcAllIncome MAX; **NOT nicsDetail, NOT monthlyFlow** | YES | salary-alias — captured director salary pays £0 NIC on T&E |
| 5 | `income.selfEmployed` | legacy fixtures | calcAllIncome, te `_grossIncome`, uk-tax module | no | selfEmp-alias |
| 6 | `income.selfEmploymentNet` | capture SELF_EMPLOYMENT (events.jsx:713) | taxable-income MAX (line 64); calcAllIncome pushes it as a SEPARATE item (fq:3458-3459) | YES | **F-522a: entity carrying both keys → calcAllIncome £50,000 vs breakdown £25,000 (node-proven double-count)** |
| 7 | `income.directorDividends` | capture DIRECTOR_DIV (events.jsx:715) | taxable-income MAX (line 101), sa-computation, situational-taxes, te | YES | **F-522b: calcAllIncome never reads it — captured £30k divs taxed but missing from Cashflow/Home gross (proven)** |
| 8 | `income.dividends` | capture INVESTMENT_DIV — note `+=` accumulate, all other income captures `=` overwrite (events.jsx:716) | everywhere | YES | dividend-alias |
| 9 | `income.rentalIncome` / `.rental` | personas | calcAllIncome (fq:3461), monthlyFlow, risk-engine; taxable-income gross-as-net fallback (line 70) | no | rental-alias |
| 10 | `income.rentalIncomeNet` | capture RENTAL (events.jsx:717) | taxable-income (preferred, line 70), sa-computation, situational-taxes; **NOT calcAllIncome, NOT monthlyFlow** | YES | **F-522c: captured £12k rental taxed but invisible to Cashflow gross (proven: capture-shaped entity calcAllIncome £25,000 vs breakdown £67,000)** |
| 11 | `income.interest` / `.savings` / `.savingsInterest` | capture INTEREST (events.jsx:718) | taxable-income MAX-of-3 (line 84); calcAllIncome reads interest\|savingsInterest only, misses `.savings`; both fall back to bank balance×rate | YES | savings-alias |
| 12 | `income.statePension` | capture STATE_PENSION writes OBJECT `{annual, startAge:67}` (events.jsx:719-720); legacy personas numeric | taxable-income handles both (line 76); **calcAllIncome requires `.annual` (fq:3466) — legacy numeric SP invisible to Cashflow**; gating age differs per age-fn (F-508) | YES | shape split: object vs number |
| 13 | `income.employmentPartner` | persona-family.json:167 (£22k; scenario bump to £44k :358) | **NONE — zero readers in src/** | no | **F-520: partner salary invisible to every engine, score, tax and household surface** |
| 14 | `individual.net_profit_current_year` + `business.net_profit` | mrT-sole-trader fixture (£67,000) | **NONE — zero engine readers of `net_profit*`** | no | **F-521: sole-trader's entire trade profit invisible — whole-app income for this fixture = £1,176 (node-proven); third income schema (snake_case business) unmapped** |

### 3.2 / F-524 · HIGH — Relief fields: two parallel key-sets, BOTH writer-less

| # | Field | Readers | Writers | Consequence |
|---|---|---|---|---|
| 15 | `income.pensionContribs` / `.pensionContributions` / `.giftAid` | taxable-income.js:103 (reliefs → ANI → PA taper) | **NONE** (0 fixtures, no capture) | tax-path ANI reliefs always £0 |
| 16 | `entity.pensionContribAnnual` / `.pensionContribMonthly` | calcANI fq:3194-3195; cashflowFlow committed fq:2894; tax-year-state:66 | **NONE** | display-path ANI reliefs always £0 (F-513) |
| 17 | `entity.giftAidAnnual` | calcANI fq:3193 ONLY | **NONE** | F-512 sign error latent solely because writer-less |

Cross-ref F-514: even if writers appeared, the two key-sets feed different ANI definitions.

### F-523 · HIGH — Essentials/expenses: 5 readers, 4 precedence chains, and the canonical helper misses the keys fixtures actually carry
| # | Field | Writers | Readers |
|---|---|---|---|
| 18 | `expenses.essentialsMonthly` | 5 mrT fixtures (e.g. mrT-core £3,550) | `_currentEssentialsAnnual` fq:2812 ✓; accumulation-solver.js:51 ✓; **`getMonthlyEssentials` (_helpers.js:616) reads `essential_monthly` (snake) — MISSES it** |
| 19 | `expenses.annual` | mrT fixtures (£42,600) | fq:2814 ✓; **getMonthlyEssentials reads `essential_annual` — MISSES it** |
| 20 | `expenses.monthly` | **NOBODY** (0 fixtures, no capture) | monthly-flow:61, fq:2813, getMonthlyEssentials step 3, accumulation-solver |
| 21 | `entity.monthlyExpenditure` | persona-a/e only | getMonthlyEssentials step 4, canonical-metrics, MyMoney/Protection screens |
| 22 | `expenses.essential_monthly` / `essential_annual` | **NOBODY** | getMonthlyEssentials steps 1-2 — dead branches |

Node-proven: mrT-core (full expenses data) → `getMonthlyEssentials` = `{monthly:0, source:'none', isEstimate:true}` while `_currentEssentialsAnnual` = £42,600. Every getMonthlyEssentials consumer (runwayWithDrawdown _helpers.js:684 → 0-months empty state, canonical-metrics, selectors/index, MyMoney.jsx, MoneyProtection.jsx, ProtectionDrillDown, CashDrillDown, PivotView, TodayMoveCard) renders "no data / estimate" for mrT personas while Cashflow shows real essentials. ALSO: **no capture path writes ANY expenses key** — live-captured users get the 60%-of-gross heuristic forever.

### 3.3 Allowance-tracker + IHT fields — F-525: te-tracker keys are writer-less AND capture-less

| # | Field | Writers | Readers | Capture? |
|---|---|---|---|---|
| 23 | `targetIncome` | 12 personas | solvers (correct use); monthlyFlow:63 as CURRENT-spend proxy (F-500 root) | no |
| 24 | `pension.contributionsThisYear` | **NONE anywhere** | te tracker:459/547; TaxEstate.jsx:1355 | no — F-510 is structural: the key has no writer in the entire repo |
| 25 | `assets.pensions[].contribution_monthly_personal` vs `assets.sipp.pensions[].contribution_monthly.{personal,employer}` | capture SIPP writes `assets.sipp.pensions[]` (events.jsx:328-344); persona-a nested shape | cashflowFlow reads TOP-LEVEL flat key only (fq:2894-2895) | YES but wrong shelf → F-516 committed £0 |
| 26 | `assets.investments[].contribution_current_tax_year` | capture (events.jsx:366) + 13 personas | fq tracker:3569, canonical-metrics:139/522, 5 MyMoney components | YES — healthiest field in the map |
| 27 | `assets.isa.usedThisYear` | 1 fixture only; **no capture** | te tracker:424/454, fq:2351/2355, te:833/883/1009 | no → captured ISA contributions visible to fq tracker, invisible to te tracker (F-503 capture face) |
| 28 | `assets.cgt.realisedThisYear` | **NONE** (0 fixtures, no capture) | te tracker:456, sa-computation:177, timeline-engine:98 | no → CGT "used" permanently £0; Section 2 CGT pass is vacuous by construction |
| 29 | `income.realisedGains` | **NONE** | fq tracker:3569 area (CGT used) | no — same blind spot, other tracker |
| 30 | `estate.directDescendant` | **NONE** (0 fixtures, no capture) | te:680 (`!== false` default-GRANT), te:1225/1580, canonical-metrics:415 | no → F-511 RNRB over-grant is universal: the only field that could correct it is unwritable |
| 31 | `entity.dob` vs `entity.age` vs `individual.dob` | fixtures only; **no capture/onboarding write** | 5 independent age fns (F-508); calcAge dob-only → persona-a/e (age-only) → null age in fq paths | no |
| 32 | `dependants[]` vs `children[]` | fixtures; no capture | persona-normalizer.js unifies (`dependants()` export); direct readers of either shape persist elsewhere | no |

### Structural conclusions
1. **The capture path (events.jsx) and the persona fixtures write DISJOINT schemas.** Capture writes event-fold keys (`selfEmploymentNet`, `rentalIncomeNet`, `directorDividends`, SP-object); fixtures write legacy keys (`selfEmployed`, `rentalIncome`, numeric SP) or mrT snake_case. Only `taxable-income.js` reads both sides correctly; `calcAllIncome` reads a proper subset (F-522), `monthlyFlow` and `nicsDetail` read legacy-only. Any UI-captured user therefore gets correct TAX but understated CASHFLOW/INCOME surfaces.
2. **Eight engine-critical fields have zero writers** (15-17, 20, 22, 24, 28-30): every consumer renders £0/default and no test can catch it because no fixture exercises them.
3. **persona-normalizer.js exists and solves exactly this** (shape-drift overlay) but is not in the read path of calcAllIncome/monthlyFlow/nicsDetail/getMonthlyEssentials — the normaliser and the alias-MAX patterns are two competing half-solutions to the same problem.

---

## SECTION 4 — WRONG-KEY GREP SWEEP (TAX./PEN./ISA./CGT./INC. vs `_bundle.js _buildTAX`)

Method: node sweep (`audit-findings/w1e-wrongkey-sweep.mjs`) extracted every `TAX.x / PEN.x / ISA.x / CGT.x / INC.x` property read in src/ (729 TAX reads across 81 canon keys) and diffed against the live `TAX` object built by `_buildTAX` (src/engine/_bundle.js:39-181); then cross-checked every bundle path `_buildTAX` itself reads against `src/rules/UK-2026.1.1.json`.

### Headline: ZERO phantom `TAX.*` keys remain
All 729 `TAX.*` reads in src/ resolve to canon keys — the 2026-06-01 13-file wrong-key fix has held. The wrong-key problem has MOVED one layer down: it now lives (a) inside `_buildTAX`'s own bundle-path reads and (b) in tax-estate-engine's raw-section bindings.

### F-517 · HIGH — `PEN.taperedAnnualAllowanceThreshold` is a phantom bundle key (tax-estate-engine.js:497-498)
Bundle key is `pension.taperedAnnualAllowanceThresholdIncome` (=200,000); te reads `PEN.taperedAnnualAllowanceThreshold` → **undefined**. Effects in `allowanceTracker.pension_aa.current_year`: `tapered: _grossIncome(entity) > undefined` → always `false` (doubly dead — `_grossIncome` is £0 anyway, F-505), and `tapered_threshold_at: undefined` shipped to TaxEstate.jsx:1345. Tapered-AA detection in the te tracker can never fire for any user.

### F-518 · HIGH — 33 of 81 TAX keys are FALLBACK-PINNED: `_buildTAX` reads bundle paths that don't exist in UK-2026.1.1.json
For these keys every `b.x?.y` path tried is absent from the JSON, so the hardcoded `?? literal` is the ONLY source. Today the literals match 2026/27 law, so values are correct — but `setBundle()` (historical back-tests via tests/harness/snapshot.mjs, future bundle updates, live-gov sync) silently does NOT update them. This defeats the bundle-indirection contract stated in _bundle.js's own header.

**Sub-class A — value EXISTS in the bundle under a different name (wrong path; will silently diverge on first bundle edit):**

| TAX key | path tried (missing) | actual bundle key |
|---|---|---|
| cgtBasic / cgtHigher | `cgt.basicRate/higherRate` | `capitalGains.basicRate/higherRate` |
| badrRate / badrLifetimeLimit | `cgt.badr*` | `capitalGains.badr*` |
| bprCombinedCap | `iht.bprCombinedCap` | `inheritanceTax.aprBprCombinedAllowance` |
| aimBPRRate | `iht.aimBPRRate` | `inheritanceTax.aimBPRRate` |
| giftExemption / annualGiftExemption | `iht.giftAnnualExemption` | `inheritanceTax.annualGiftExemption` |
| smallGiftsExemption | `iht.smallGiftsExemption` | `inheritanceTax.smallGiftExemption` (singular) |
| weddingGiftToChild/ToGrandchild/Other | `iht.weddingGift*` | `inheritanceTax.weddingGiftParent/Grandparent/Other` |
| nicClass1Main | `nationalInsurance.class1MainRate` | `nationalInsurance.class1EmployeeRate` |
| nicClass4Main | `nationalInsurance.class4MainRate` | `nationalInsurance.class4RateLowerBand` |
| employerNICRate / employerNICThreshold | `nationalInsurance.employerRate/Threshold` | `class1EmployerRate / class1EmployerSecondaryThreshold` |
| hicbcFloor / hicbcCeiling | `income.hicbcFloor/Ceiling` | `income.highIncomeChildBenefitThreshold/TaperEnd` |
| adjustedNetIncomeCliff | `income.adjustedNetIncomeCliff` | `income.personalAllowanceTaperStart` |
| taperedAATIThreshold | `pension.taperedAATIThreshold` | `pension.taperedAnnualAllowanceThresholdIncome` |
| lsdba | `b.lsdba` | `pension.lumpSumAndDeathBenefitAllowance` |
| jisaAllowance | `isa.juniorAnnualAllowance` | `isa.juniorISAAllowance` |
| swr | `pension.safeWithdrawalRate` | top-level `safeWithdrawalRate` |
| petTaperByYear | `iht.petTaperByYear` | `inheritanceTax.taperRelief` (different encoding: per-band map vs 8-element array) |
| sdltAdditionalProperty | `sdlt.additionalPropertySurcharge` | `property.sdlt.*` (section exists, never read) |

**Sub-class B — value genuinely absent from the bundle (literal is sole source-of-truth; contradicts the never-hardcode rule):** `redundancyTaxFree` (30,000), `poaThreshold`/`poaPercentage` (no `selfAssessment` section — matches the open POA-to-bundle item), `nicClass2Annual`, `normalExpenditureFromIncome` (only a prose note exists), `paFreezeUntil`, `laCareUpperCapital` (23,250 — no `care` section), `hicbcTaperWidth`.

Consumer exposure (read counts from sweep): cgtHigher 24 reads, cgtBasic 9, annualGiftExemption 8, badrRate 7, bprCombinedCap 7, lsdba 8, hicbcFloor/Ceiling 4, adjustedNetIncomeCliff **14 reads** (the £100k-cliff warnings across screens), swr 12. All go stale the moment a non-default bundle loads.

### F-519 · MEDIUM — tax-estate-engine binds RAW bundle sections, parallel to TAX (tax-estate-engine.js:25-57)
`INC/CGT/IHT/PEN/ISA/NIC/TR` are bound straight to `b.income / b.capitalGains / b.inheritanceTax / b.pension / b.isa / b.nationalInsurance` via `onBundleChange`, with NO fallbacks and no optional-chaining — a bundle missing a section throws at subscribe time. This is a second, unguarded rules-access idiom alongside TAX; it is exactly where F-517 bred. All 24 raw-section reads verified present in UK-2026.1.1.json EXCEPT the F-517 phantom. A future bundle rename breaks te loudly (good) but breaks `_buildTAX` silently (bad) — two failure modes for the same edit.

### Non-findings (sweep noise excluded)
`ISA.Anything / CGT.The / ISA.Future / CGT.UK` etc. are prose inside string literals, not property reads. `decision-engine.js:1115-1116` defines local display objects FROM canon TAX keys — correct usage.

---

## SEVERITY ROLL-UP (W1-E complete — all 4 sections)

| Severity | Count | IDs |
|---|---|---|
| CRITICAL | 4 | F-500 (surplus sign-flip), F-501 (net worth ±£1.8m), F-502 (IHT ±£340k cross-tab), F-504 (NIC £0 on employment-key personas) |
| HIGH | 14 | F-503, F-505, F-506, F-510, F-511 (RNRB +£70k under-tax), F-512 (gift-aid sign), F-514, F-516, F-517, F-518 (33 fallback-pinned TAX keys), F-521, F-522, F-523, F-524 |
| MEDIUM | 7 | F-507, F-508, F-509, F-513, F-515, F-519, F-525 |
| LOW | 2 | F-520 (employmentPartner no-reader), PensionDrawdownPanel naming hazard |

Tally: **4 CRITICAL · 14 HIGH · 7 MEDIUM · 2 LOW** (F-500..F-525).

**Three worst:**
1. **F-500/F-501/F-502 family** — every headline number (surplus, net worth, IHT) has two live engines that disagree by sign or six figures, and the DE/Ask-Sonu composer reads the OTHER one from the screens (composer.js:69-82).
2. **F-518** — 33/81 TAX keys never read the rules bundle; the bundle-indirection layer is silently hardcoded for CGT rates, BPR cap, gift exemptions, NIC rates, £100k cliff. Every historical back-test and future bundle update is wrong for these.
3. **F-521/F-522/F-523 capture-schema split** — the live Add-flow writes keys (`rentalIncomeNet`, `directorDividends`, `selfEmploymentNet`) that Cashflow's aggregator can't see (proven £25k vs £67k), the sole-trader fixture's £67k profit is read by nothing, and the canonical essentials helper returns "no data" for fixtures that carry full expense data.

*W1-E audit complete · 2026-06-11 · runner scripts: `audit-findings/w1e-dup-runner.mjs`, `audit-findings/w1e-wrongkey-sweep.mjs`*

---
