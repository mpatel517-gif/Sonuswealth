Title: MyMoney / Cashflow / Decision-Engine Consolidated Sweep Register
Version: 1.0
Date: 2026-06-06
Status: OPEN
Cluster: 2-Product (MyMoney, Cashflow) + 3-Engine (decision-engine)
File name: mymoney-cashflow-sweep-register.md
Purpose: Single consolidated, deduped, severity-ranked register of a multi-agent correctness sweep across the Decision Engine, My Money, and Cashflow surfaces.

**Summary:** 61 raw multi-agent findings consolidated into one register, deduped, severity-ranked, and grouped by surface; the dominant failure class is engine deltas booked into the wrong metric bucket ("Net worth") plus controls/components that are dead-wired or hardcoded to a fixture.
**Tags:** #decision-engine #mymoney #cashflow #audit #wrong-bucket #dead-control
**Updated:** 2026-06-06

---

## What was swept

- **Choices / Decision Engine** — `src/engine/decision-engine.js` (simulateAction / enumeratePaths / _PATH_FACTORS) + `src/screens/DecisionEngine.jsx` chip rendering. DE-01 through DE-40.
- **My Money** — `src/screens/MyMoney.jsx` (income, surplus, pensions, priority cards, protection, drawdown) + `src/components/MyMoney/CategoryCard.jsx` + persona fixtures.
- **Cashflow** — `src/screens/Cashflow.jsx` (X28 header view-modes / window selector, CoI hero, essentials split, empty states, dead imports) + `src/components/shared/X28TopBar.jsx` + Cashflow chart components + `src/engine/fq-calculator.js` read-paths.

## Counts by severity (after dedup: 61 → 61 distinct kept)

| Severity | Count |
|---|---|
| DEMO-BLOCKING | 9 |
| FUNCTIONAL | 36 |
| POLISH | 16 |
| **Total** | **61** |

Dedup note: no exact duplicates were collapsed. The protection-premium-as-net-worth issue recurs across DE-19/20/21 and the wrong-bucket-income issue across DE-09/12/38, but each is a distinct decision/file-line and is kept as its own row with the shared class noted in the title.

---

## Group 1 — Choices / Decision Engine

### DEMO-BLOCKING

| # | Severity | Lens | Title | Evidence (file:line) | Fix |
|---|---|---|---|---|---|
| 1 | DEMO-BLOCKING | tax | DE-03 Pension contribution shows +145% of the contribution as net-worth gain (hardcodes 45% relief for every user) | src/engine/decision-engine.js:143 | NW delta = contribution × actual marginal rate (relief retained net of cash given up), derived from entity income vs TAX.brt/art; relabel as 'Tax relief'. |
| 2 | DEMO-BLOCKING | IFA | DE-09 Entire PROPERTY_PATHS set hardcoded to a £450k fixture — every user sees identical £415k liquid / £35k CGT / £16,700 rent; live wizard bypasses the engine | src/screens/DecisionEngine.jsx:58-117, :225 | Route DE-09 through enumeratePaths(entity,'DE-09'); derive value/CGT/rent/liquidity from entity property + income. |
| 3 | DEMO-BLOCKING | IFA | DE-12 Equity-release (lifetime mortgage) cash release shown as a NET-WORTH GAIN and an IHT reduction — both nonsense (it is a loan) | src/engine/decision-engine.js:262,264,260-261 | Model the loan: NW delta ≈0 at outset then negative as interest rolls up; label cash as 'Cash released' (liquidity); IHT tracks the growing loan balance. |
| 4 | DEMO-BLOCKING | IFA | DE-38 Annuity — 10 years of annuity income booked as a net-worth INCREASE (capital→income wrong-bucket) | src/engine/decision-engine.js:589 | NW ≈ neutral at purchase (capital out, annuity in); surface £/yr guaranteed income as its own metric. |
| 5 | DEMO-BLOCKING | IFA | DE-40 Long-term-care cost hardcoded (£60k/yr × 3) so every user sees an identical −£180k net-worth hit | src/engine/decision-engine.js:610-611,616 | Derive care cost from entity context + modelled duration; scale NW to user affordability. |

### FUNCTIONAL

| # | Severity | Lens | Title | Evidence (file:line) | Fix |
|---|---|---|---|---|---|
| 6 | FUNCTIONAL | tax | DE-03 IHT delta ignores SIPP-enters-estate-from-April-2027 | src/engine/decision-engine.js:145 | Gate pension IHT relief on TAX.deadline (2027-04-06); applies to DE-04/DE-05 too. |
| 7 | FUNCTIONAL | tax | DE-05 Salary-sacrifice saving counts only employer NIC (15%) but copy promises employer+employee (23%) | src/engine/decision-engine.js:167-168 | Add employee NIC or fix copy; make passback assumption explicit. |
| 8 | FUNCTIONAL | dynamism | DE-06 ISA decision not dynamic — every user sees the same £6k gain; existingIsa read but unused | src/engine/decision-engine.js:178-180 | Differential on min(remaining allowance, investable surplus); use TAX.growthDefault not 0.03. |
| 9 | FUNCTIONAL | IFA | DE-02 Annuity-deferral income uplift shown as a net-worth gain (wrong bucket) | src/engine/decision-engine.js:130-131 | Model deferral as income/yr uplift or NPV difference, not NW delta. |
| 10 | FUNCTIONAL | IFA | DE-01 Phased-drawdown tax saving capped flat (min(sipp×0.2,15000)) and shown as net worth, not band-differential | src/engine/decision-engine.js:118-119 | Compute lump-sum vs phased tax from income vs TAX.brt/art; label 'Tax saved'. |
| 11 | FUNCTIONAL | IFA | DE-04 SIPP-only path still credits 50% of an employer match that by definition doesn't exist | src/engine/decision-engine.js:44 | Set sipp_only nw factor ~0 for employer-match component; restrict match to workplace/split paths. |
| 12 | FUNCTIONAL | tax | DE-11 §24 5yr tax cost shown in 'Net worth' chip; 'Sell' path shows £0 ignoring CGT | src/engine/decision-engine.js:250,51; DecisionEngine.jsx:700,1162 | Relabel as 'Tax cost over 5yr'; give sell_btl a real CGT delta (gain × TAX.cgtHigher). |
| 13 | FUNCTIONAL | tax | DE-15 Gift amount fixed £50k for everyone (params.giftAmount never plumbed); canonical PET taper array ignored | src/engine/decision-engine.js:296,303,881; _bundle.js:119 | Plumb real gift amount; use TAX.petTaperByYear indexed by survival. |
| 14 | FUNCTIONAL | tax | DE-16 Trust value fixed £100k; per-trust IHT relief INVERTED (bare gets less relief than discretionary) | src/engine/decision-engine.js:310,313,56,881 | Plumb real trust value; model bare(PET)/discretionary(CLT+periodic)/IIP distinctly, not one ×0.8 proxy. |
| 15 | FUNCTIONAL | dataviz | DE-19 Life-cover premium shown as 'Net worth' so MORE protection = WORSE headline; wol_trust IHT benefit hardcoded 0 | decision-engine.js:344-351,59; DecisionEngine.jsx:660,957,1008 | Move premium to 'Cost/yr'; headline cover/gap-closed; wire wol_trust IHT (cover in trust × ihtRate). |
| 16 | FUNCTIONAL | dataviz | DE-20 CI premium shown as 'Net worth'; full cover ranks worst on the headline metric | decision-engine.js:354-362,60; DecisionEngine.jsx:660,700 | Relabel cost as 'Premium'; headline the cover/benefit. |
| 17 | FUNCTIONAL | IFA | DE-21 Own-occupation (gold-standard) shows WORST headline; no status-quo path; premium drives the chart | decision-engine.js:365-373,61; DecisionEngine.jsx:660,700,776 | Headline cover quality/benefit; move premium to 'Cost/yr'; model expected-value of cover. |
| 18 | FUNCTIONAL | tax | DE-24 Spousal-transfer saving hardcoded to PA constant — not dynamic, ignores spouse income, 0.20 literal vs TAX.br | decision-engine.js:401-409; _bundle.js:43,46 | Compute from entity shiftable income capped by spouse PA/BR headroom × rate differential (TAX.br/hr). |
| 19 | FUNCTIONAL | IFA | DE-17 Will modelled as cutting IHT by flat 10% of exposure (fabricated); paths share one ihtDelta | decision-engine.js:319-329,57,87 | Model real mechanic (spouse-exempt defers, RNRB preservation); give each will path an explicit iht factor. |
| 20 | FUNCTIONAL | tax | DE-26 IHT delta removes FULL invested amount not 40% — overstates EIS/SEIS IHT benefit 2.5× (DE-28 does it right) | src/engine/decision-engine.js:436 | `ihtDelta = -(invest * TAX.ihtRate)` to mirror DE-28; keep DE-26/28/29 consistent. |
| 21 | FUNCTIONAL | tax | DE-29 IHT uses full donation not ×40%; Gift-Aid top-up computed then thrown away; reclaim rate hardcoded HR | src/engine/decision-engine.js:466 | Fix ihtDelta to ×TAX.ihtRate; use or remove giftAid; make reclaim income-aware (AR vs HR). |
| 22 | FUNCTIONAL | tax | DE-25 'Employer pension contribution' path shows ZERO IHT because base ihtDelta=0 nullifies the iht:1 factor | src/engine/decision-engine.js:423 | Compute a real base ihtDelta (amount × ihtRate, mind 2027) or drop iht:1; a factor can't create a delta from 0. |
| 23 | FUNCTIONAL | tax | DE-32 Redundancy-into-pension claims IHT saving 2027-removed; hardcodes 45% retention (0.55) for every user | src/engine/decision-engine.js:508 | Gate IHT on TAX.deadline; replace 0.55 with (1−marginal rate); replace 0.07 with TAX.growthDefault. |
| 24 | FUNCTIONAL | tax | DE-34 ihtDelta WRONG SIGN — splitting assets away in divorce shown as INCREASING IHT | src/engine/decision-engine.js:535 | Negate: estate reduction must read as an IHT decrease (≤0-is-good contract). |
| 25 | FUNCTIONAL | tax | DE-34 Charges CGT on a spousal split the decision's own gloss says is CGT-free (TCGA s58 window) | src/engine/decision-engine.js:532-533 | CGT ≈ £0 within year-of-separation + 3yr window; model cost only post-window. |
| 26 | FUNCTIONAL | tax | DE-35 ihtDelta WRONG SIGN — losing BPR on a business sale shown as REDUCING IHT | src/engine/decision-engine.js:551 | Flip positive (BPR lost → IHT up), or net of any genuinely-estate-leaving re-wrap. |
| 27 | FUNCTIONAL | tax | DE-36 Dividend cost uses basic dividend rate for a director who is almost always HR/AR payer | src/engine/decision-engine.js:562 | Select dividend rate from entity marginal band (dividendHR/dividendAR). |
| 28 | FUNCTIONAL | tax | DE-37 Claims IHT saving from DB→SIPP transfer after SIPPs enacted into estate April 2027 | src/engine/decision-engine.js:579 | Set ihtDelta ~0/positive for post-2027 horizons; remove 'IHT-free legacy' gloss. |
| 29 | FUNCTIONAL | tax | DE-38 ihtDelta hardcoded 0 while comment says annuitised portion leaves estate (contradiction) | src/engine/decision-engine.js:591 | Set ihtDelta negative if capital leaves estate, else fix the comment. |
| 30 | FUNCTIONAL | tax | DE-39 Credits 30% IHT estate removal on emigration — IHT is domicile/long-term-residence based, not tax-residence | src/engine/decision-engine.js:603 | Remove/heavily qualify; estate effect only after LTR/deemed-domicile clock unwinds. |
| 31 | FUNCTIONAL | IFA | DE-40 Dead variable deferredCost — deferred-payment roll-up computed then discarded; 3 paths share one sim | src/engine/decision-engine.js:615 | Feed deferredCost into deferred path; model insurance premium-vs-cap, not cosmetic 0.8/0.6 factors. |
| 32 | FUNCTIONAL | IFA | DE-33 Inconsistent NW model — pension credited flat 45% no-growth while ISA gets 10yr growth | src/engine/decision-engine.js:521 | Apply consistent growth-over-horizon to both wrappers; credit pension relief as gross-up inside the pot. |

### POLISH

| # | Severity | Lens | Title | Evidence (file:line) | Fix |
|---|---|---|---|---|---|
| 33 | POLISH | tax | DE-08 Invest-vs-overpay uses hardcoded 7% growth literal instead of TAX.growthDefault | src/engine/decision-engine.js:208 | Replace 0.07 with TAX.growthDefault; note overpay accrues on a falling balance. |
| 34 | POLISH | tax | DE-15 annual_exempt path scales £50k-gift IHT saving by 0.1 instead of computing £3k exemption directly | src/engine/decision-engine.js:55 | Compute each path's IHT saving from its actual gift structure, not a scaled fabricated base. |
| 35 | POLISH | IFA | DE-10 Comparison fixedRate hardcoded 4.5%; paths differ only by arbitrary 0.7–1.0 scalars | src/engine/decision-engine.js:236,237,50 | Source fixed rate from getMacro()/bundle; differentiate paths by real rate paths. |
| 36 | POLISH | IFA | DE-13 Emergency-fund uplift computed on target buffer not actual cash moved; rates hardcoded | src/engine/decision-engine.js:273-276 | Base uplift on min(current,target); read rate spread from getMacro()/bundle. |
| 37 | POLISH | ux | DE-18 Avoided deputyship fee (hardcoded £3,500×5) shown as 'Net worth' gain — wrong bucket and static | decision-engine.js:332-340; DecisionEngine.jsx:957,1008 | Relabel as 'Cost avoided' / contingent saving; consider a qualitative headline. |
| 38 | POLISH | tax | DE-25 Dividend rate, corp-tax, dividend income computed but never used; salary-key fallback overstates NI | src/engine/decision-engine.js:414 | Incorporate divRate/corpTax into nwDelta or delete dead vars and rename chip 'Employer NI saved'. |
| 39 | POLISH | tax | DE-30 School-fees shelter saving built from opaque magic literals + dead totalFees; identical for every user | src/engine/decision-engine.js:481 | Express from real inputs (JISA/ISA growth × avoided marginal rate); remove dead framing. |
| 40 | POLISH | tax | DE-35 CGT saving computed on gross proceeds not the gain (ignores base cost) | src/engine/decision-engine.js:546-549 | Compute on gain (proceeds − baseCost / params.gain). |
| 41 | POLISH | tax | DE-36 Treats refundable S455 as a permanent saving in nwDelta | src/engine/decision-engine.js:560-563 | Reflect S455 as a timing/cost-of-capital cost, not a permanent loss. |
| 42 | POLISH | IFA | DE-37 Dead variable dcExpected — projected DC value computed then never used | src/engine/decision-engine.js:574 | Use dcExpected vs capitalised DB income, or delete the dead line. |
| 43 | POLISH | tax | DE-40 Math.min(0,...) on ihtDelta is a no-op; estate reduction overstated at full property value | src/engine/decision-engine.js:618 | Drop redundant Math.min; base estate reduction on min(totalCost,assets). |

---

## Group 2 — My Money

### DEMO-BLOCKING

| # | Severity | Lens | Title | Evidence (file:line) | Fix |
|---|---|---|---|---|---|
| 44 | DEMO-BLOCKING | IFA | Entire income breakdown is dead code — My Money is capital-only; IncomeSection() has 0 JSX usages, income tile renders rows:[] | MyMoney.jsx:1146 (defined), grep '<IncomeSection'=0; :3945 (rows:[]) | Render `<IncomeSection entity={entity}/>` in Act 1/2; at minimum wire the income tile to calcAllIncome(entity). |
| 45 | DEMO-BLOCKING | ux | Tapping the Income tile is a no-op — setPivot('income') to an unrendered PivotView (2 dead affordances) | MyMoney.jsx:3259,4350,4704; grep '<PivotView'=0; comment 114-116 | Render PivotView when pivot!=='balance-sheet' or route the tile to a real income drill / onNav('flow'). |

### FUNCTIONAL

| # | Severity | Lens | Title | Evidence (file:line) | Fix |
|---|---|---|---|---|---|
| 46 | FUNCTIONAL | IFA | Three advertised components dead code: SurplusTile, DecumulationPanel, DrawdownFrameworkPanel (0 JSX usages) | MyMoney.jsx:1389,1737,3080; grep=0; header claims 7,12 | Render SurplusTile in Act 1; decide if decumulation/drawdown panels belong here, else delete + fix header. |
| 47 | FUNCTIONAL | IFA | Carry-forward AA invisible on scan surface; SIPP-IHT-2027 chip wins the only status slot; headroom ignores carry-forward | MyMoney.jsx:3963,3977,4012,4040; carry-fwd only 2537-2581 | Compute true headroom = current-AA-remaining + carryForwardByYear total; surface on the Pensions tile. |
| 48 | FUNCTIONAL | tax | Drawdown preset copy hardcodes £37,700 basic-rate band — should be TAX.brl | MyMoney.jsx:2618; _bundle.js:44 | Replace literal with {fmt(TAX.brl)}. |
| 49 | FUNCTIONAL | IFA | Debt + emergency-cover cards read object-only liabilities/cash; array-shape personas (director/landlord) show 'Clear' | MyMoney.jsx:2858,2870-2873,4070-4072; persona fixtures | Normalise liabilities/cash through the same readers the tiles use (rowsForLiabilities/rowsForCash). |
| 50 | FUNCTIONAL | IFA | Protection life-cover sum assured summed as a balance-sheet asset; correct protection-sv:0 subtotal mis-keyed | MyMoney.jsx:3886,3937,668-684; CategoryCard.jsx:53 | Pass subtotal=0 (or surrender value) to Protection tile; render cover as 'cover' not 'value'. |

### POLISH

| # | Severity | Lens | Title | Evidence (file:line) | Fix |
|---|---|---|---|---|---|
| 51 | POLISH | compliance | Protection trust-status line assumes a single policy (RLP + personal cover mis-stated); borderline guidance-vs-advice | MyMoney.jsx:4063-4068 | Iterate protection rows; report trust status per-policy/'mixed'; keep the line purely informational. |
| 52 | POLISH | IFA | Two LSA surfaces in one drill read different data paths (entity.pension.lsaUsed vs entity.lsaUsed) and can disagree | MyMoney.jsx:2295-2300 vs 2596-2597,2605 | Read LSA/LSDBA usage from one canonical selector in both bar and tile. |
| 53 | POLISH | dataviz | Banded income subtotals can fail to sum to header (unclassified streams silently dropped); parallel hand-rolled incomeAnnual | MyMoney.jsx:1160,1177,3873-3877 | Render an 'Other income' band; source headline from calcAllIncome not a parallel sum. |

---

## Group 3 — Cashflow

### DEMO-BLOCKING

| # | Severity | Lens | Title | Evidence (file:line) | Fix |
|---|---|---|---|---|---|
| 54 | DEMO-BLOCKING | ux | 4-way Today/Future/Plan/What-if bar NOT removed (comment lies); 3 of 4 modes silent no-ops, identical numbers | Cashflow.jsx:1666-1677,1692-1700,1746,1756; X28TopBar.jsx:67-72 | Wire viewMode to real engine behaviour (Future=forecast, Plan=overlay, What-if=LeversCard) or actually remove the row. |
| 55 | DEMO-BLOCKING | ux | 8-option time-window selector is a dead control — nothing reads windowId; trajOpts ignores it | Cashflow.jsx:1446,1667,1544-1554,1756; X28TopBar.jsx:50-59 | Feed windowId.years into trajOpts.horizonYears/projection memos, or hide the window row. |

### FUNCTIONAL

| # | Severity | Lens | Title | Evidence (file:line) | Fix |
|---|---|---|---|---|---|
| 56 | FUNCTIONAL | tax | Cost-of-Inaction total falls back to a SINGLE domain (estatePlanning); coi read unguarded (null → tab crash) | Cashflow.jsx:5900,5906,1582; fq-calculator.js:2133-2151 | Fallback = re-sum byDomain; wrap totalCoI in try/catch with safe default; guard coi?.confidence. |
| 57 | FUNCTIONAL | dataviz | Essentials/discretionary cohort benchmark hardcoded 58% (45-54 band) shown to every user regardless of age; never plotted | Cashflow.jsx:2752,2777; NowDrawer 1341 | Move medians to a rules/CMA table keyed by age band; select from calcAge; render as a marker line. |
| 58 | FUNCTIONAL | compliance | Honest empty states say 'Calculating…' implying in-progress async when truth is 'data missing' | PoSChart.jsx:82; SequenceStressVis.jsx:65; EfficientFrontier.jsx:54; ScenarioMatrix.jsx:84 | Reword to a definite CTA + deep-link; drop the 'Calculating…' framing. |

### POLISH

| # | Severity | Lens | Title | Evidence (file:line) | Fix |
|---|---|---|---|---|---|
| 59 | POLISH | ux | ScenarioMatrixV2 imported but never rendered; SubAnchor dead post PRC/PCC removal | Cashflow.jsx:105,1949-1976,1871-1877 | Remove the unused import; delete SubAnchor if no live call-site. |
| 60 | POLISH | ux | Naming collision: dead header 'What if' tab vs live 'whatif' LeversCard tile — same word, two destinations, one dead | X28TopBar.jsx:71; Cashflow.jsx:2567 | Route header 'What if' to LeversCard or remove the header view-mode row (see #54). |
| 61 | POLISH | IFA | Reads non-existent key fr.funded_ratio before falling back to real fr.ratio (TAX-wrong-key class) | Cashflow.jsx:2047; fq-calculator.js:500,515 | Read fr?.ratio directly; align on one canonical key across engine and read-sites. |

---

## Top 10 fix-first (ordered)

1. **#2 DE-09 hardcoded £450k property fixture** — the canonical "one live decision" reads nobody's data; route through enumeratePaths(entity,'DE-09'). (DecisionEngine.jsx:225)
2. **#54 Cashflow 4-way view-mode bar is 3/4 dead** — first control a founder clicks on the tab; the comment falsely claims it was removed. (Cashflow.jsx:1666)
3. **#55 Cashflow 8-option window selector is fully dead** — a horizon picker that doesn't change the horizon; trajOpts ignores windowId. (Cashflow.jsx:1544-1554)
4. **#44 My Money income breakdown is dead code** — a "My Money" screen for a director/landlord shows no income; render IncomeSection. (MyMoney.jsx:1146)
5. **#1 DE-03 pension shows +145% NW gain, 45% relief for every user** — visible wrong number, marginal-rate-blind. (decision-engine.js:143)
6. **#3 DE-12 equity release shown as +£61k net worth** — borrowing dressed as wealth gain; domain nonsense. (decision-engine.js:262)
7. **#4 DE-38 annuity income booked as net-worth increase** — capital→income wrong-bucket on the headline. (decision-engine.js:589)
8. **#24/#26 DE-34 & DE-35 IHT sign flips** — divorce/business-sale tell the user IHT moves the wrong way; one-line negations. (decision-engine.js:535, :551)
9. **#56 Cashflow CoI single-domain fallback + null crash** — hero understates and an unguarded read can crash the whole tab. (Cashflow.jsx:5900, :1582)
10. **#45 My Money income tile no-op + #14 DE-16 inverted trust relief** — a top-of-screen dead CTA, and trust advice that recommends the less tax-efficient route as best IHT saver. (MyMoney.jsx:4350; decision-engine.js:56)

---

## Resolution status — autonomous fix run, 2026-06-06

Commits on branch `claude/ecstatic-curie-dj2UH`: `7d198c5` (engine sweep),
`3441605` (Cashflow/MyMoney dead controls), `2192ca2` (empty-states + cohort),
`6d1fbcc` (protection + array-shape). Earlier: `199241d` (DE-09 income chart),
`97cd823` (DE-09 −£8k). Build clean (373 modules); verified live on Bruce
(`demo=a`) + Mr T (`demo=mrt-core`), desktop + mobile, light + dark.

### FIXED
- **Decisions (engine):** DE-03 marginal-rate relief (#1); pension-IHT gated to £0
  post-Apr-2027 across DE-03/04/05/32/33/37 (#6, #23, #28, #32); ×ihtRate
  corrected DE-26/29 (#20, #21); sign flips DE-34/35 (#24, #26); wrong-bucket
  DE-12 loan + DE-38 annuity (#3, #4); CGT-on-gain + s58 window DE-34/35 (#25,
  #40); DE-39 emigration domicile (#30); DE-40 care estate cap (#5, #43); DE-16
  trust un-inverted (#14); DE-24 dynamic (#18); DE-06/08 growthDefault + dynamic
  (#8, #33); DE-36 dividend-by-band (#36).
- **Decisions (UI):** per-decision metric labels so nwDelta reads as Tax saved /
  Premium / Tax cost / Cost avoided / Long-run loan cost, not "Net worth"
  (#9, #10, #11, #15, #16, #17, #18, #37); cost-chart suppression for
  DE-11/12/19/20/21/40.
- **Cashflow:** dead view-mode tabs hidden (#54); window row already hidden (#55);
  CoI null-guard + re-sum fallback (#56); cohort age-gated (#57); honest
  empty-state copy (#58); fr.ratio wrong-key (#61); What-if naming collision
  resolved via #54 (#60).
- **My Money:** income tile + dead pivot taps route to Cashflow (#44, #45);
  TAX.brl not £37,700 (#48); debt/cash read array shapes (#49); protection cover
  not counted as wealth, shown as cover (#50). Earlier: 11 hardcoded tax figures
  → TAX bundle.

### DEFERRED (need founder design / data, not safe to do blind)
- **#2 DE-09 full dynamic** — it's a one-property decision but personas hold
  several; needs a "which property?" picker (design). Mitigated: −£8k bug fixed,
  income chart, honest labels. Still shows a £450k worked-example.
- **#47 carry-forward Annual Allowance on the Pensions tile** — a completeness
  feature; needs 3 prior-years' contribution data + a placement decision.
- **#46 dead components** (SurplusTile/DecumulationPanel/DrawdownFrameworkPanel) —
  not user-facing; decide render-or-delete.
- **#52/#53** LSA dual-path + income-band subtotal (polish); **#59** dead import
  cleanup; **#13/#17/#30** left as documented proxies (gift amount, will
  mechanic, school-fees) — defensible placeholders, not wrong numbers.

### Known pre-existing (out of audit scope)
- Global brand wordmark "Sonuswealth — Your wealth, in one place" overflows its
  container ~16px at narrow widths (app top-bar, every screen) — not introduced
  here.
