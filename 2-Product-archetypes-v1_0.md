# FINIO — ARCHETYPES
**Title:** Finio Archetypes — production classification, Mr T coverage, IFA demo-fill presets
**Version:** 1.0
**Date:** 23 April 2026
**Status:** DOCUMENTED
**Cluster:** 2-Product
**File name:** `2-Product-archetypes-v1_0.md`
**Purpose:** First-principles derivation of the Finio archetype set. Each archetype carries three roles — (a) production onboarding classification target, (b) Mr T engine-branch coverage contribution, (c) optional IFA demo-fill preset. Jurisdiction-neutral. Supersedes no prior document.

---

## 0. EXECUTIVE SUMMARY

- **52 archetypes** derived from 10 archetype-producing path groups × 7 life stages (70 raw) → drops + dedupes → 45 base → + 7 cross-border = 52.
- **Phase 1 at June 2026 UK launch: 44 archetypes** (Single × 7, Couple × 7, Divorced × 4, Cohab-Sep × 2, Sole Trader × 4, Ltd Director × 4, Landlord × 4, Beneficiary × 5, plus all 7 cross-border).
- **Phase 2 post-launch: 8 archetypes** (Family Primary × 4, Aged-Out × 1, Divorced-Legacy × 1, Cohab-Sep-Transition × 1, Ltd-Director-Preservation × 1).
- **Mr T fixture obligation:** one JSON file populated such that every engine branch cited by any archetype fires at least once. Detailed mapping at rank 2 (next-but-one session).
- **Demo-fill presets: 7** — Single Accumulation (UK) · Couple Transition (UK) · Ltd Director Consolidation (UK) · Beneficiary Transition (UK) · Single Accumulation UK/IN · Couple Decumulation UK/TH · Landlord Consolidation UK/IN.
- **Seven existing demo personas map to archetypes** (not replace them). Bruce = `single-transition`; Fred & Wilma = `couple-transition`; Stark = `ltd-director-consolidation`; Hermione = `single-foundation` + `ifa-practice` organisational; Wonka = `ltd-director-preservation`; Anna = journey across 6 archetypes; Priya = `single-accumulation-uk-in`.

---

## 1. THE 8 IN-SESSION DECISIONS — LOCKED

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| DQ-57 / D1 | Life stage method | **Age from DOB with onboarding-question override** | Age is the cheap universal signal. Override needed for cases where engine-relevant events contradict age (e.g. pension already in drawdown at 55 — user is effectively in Transition/Decumulation engine-state regardless of age category). |
| D2 | Aged-Out vs Individual Foundation | **Separate archetypes** | Aged-Out at 18 carries dependant residue (still-linked family account, consent-to-link, junior ISA aging out). Individual Foundation (first Finio account, no prior family link) has clean slate. Engine config differs (family-link state, data-inheritance rules). |
| DQ-57 / D3 | Cross-age couple stage | **More-advanced partner wins** | Shorter planning horizon → higher urgency. A 68-year-old partner's SPA/RMD pressures dominate a 58-year-old partner's still-accumulating profile. Finance-first principle: treat for the constraint that bites first. |
| D4 | Couple × Legacy (85+) | **Include** | Both-partners-85+ is common enough (7-year gift clock maturing, second-death window, NRB/RNRB transfer mechanics live) and engine-distinct enough to warrant its own archetype. |
| DQ-56 / D5 | Cross-border — modifier vs separate | **Separate for UK/IN and UK/TH where engine config materially shifts; modifier flag for CA/IE/AU and the long tail** | UK/IN: DTAA, NRE/NRO, PPF/ELSS/NPS eligibility, HUF possibility. UK/TH: LTR visa, Thai tax residency rules, SSF/RMF/Provident Fund. These demand promoted archetypes. Other CB pairs are less engine-disruptive — modifier suffices. |
| D6 | Path 19 (Beneficiary) Phase | **Phase 1** | Overrides handover recommendation. The April 2027 DC pension IHT inclusion IS the inheritance scenario. Excluding the receiving-side archetype from launch breaks symmetry of the demo pivot. Engine config (2-year designation window, inherited drawdown rules, ISA APS) must ship. |
| D7 | Demo-fill preset scope | **7 presets — UK core × 3 + one inheritance + NRI × 1 + India-resident placeholder + UK/TH × 1** | Covers the IFA's most common client patterns. India-resident placeholder is a flag for post-launch; ships disabled. |
| D8 | Demo-fill state | **Reset on exit** | IFA demo mode is stateless. No persistence between pitches. Avoids cross-client leakage. Per D-AUTH-1 step-up context will still apply on sensitive actions. |

---

## 2. DERIVATION METHOD

### 2.1 Inputs

- **10 archetype-producing path groups** from brief v1.11 § "Dimension 2 — Nineteen Onboarding Paths" (paths 3, 5, 7, 9, 13 collapse into parent paths and do not form their own archetypes):
  1. Single (Paths 1 + 7 + 9 + 13 collapse-up)
  2. Couple (Paths 2 + 3 collapse-up)
  3. Family Primary (Paths 4 + 5 collapse-up)
  4. Aged-Out (Path 6, Foundation only)
  5. Divorced/Separated (Path 14)
  6. Cohabiting Separated (Path 15)
  7. Sole Trader (Path 16)
  8. Ltd Director / Business Owner (Path 17)
  9. Landlord / Property Investor (Path 18)
  10. Beneficiary / Estate Inheritor (Path 19)

- **7 life stages** (per brief v1.11 § "Dimension 5", corrected Pass 18, bundle parameters): Foundation 18–33 · Accumulation 33–45 · Consolidation 45–57 · Transition 57–66 · Decumulation 66–75 · Preservation 75–85 · Legacy 85+.

- **Raw combinations:** 10 × 7 = **70**.

### 2.2 Drop rules applied (non-viable or engine-redundant)

| Rule | Drops |
|------|-------|
| Aged-Out is definitionally Foundation only | Aged-Out × {Accumulation…Legacy} = 6 drops |
| Family Primary role dissolves once children are independent adults | Family-Primary × {Decumulation, Preservation, Legacy} = 3 drops |
| Cohab-Separated is a transient post-split state; settles to Single/Divorced in ≤ 5 yrs; not meaningful in late life | Cohab-Sep × {Foundation, Decumulation, Preservation, Legacy} = 4 drops |
| Divorced-in-Foundation rare; Divorced-in-Preservation/Legacy collapses to late-life estate archetypes | Divorced × {Foundation, Preservation} = 2 drops (Legacy kept — distinct estate complications); net 2 drops |
| Sole Trader at Decumulation+ typically winds down | Sole-Trader × {Decumulation, Preservation, Legacy} = 3 drops |
| Ltd Director at Legacy — ownership almost always transferred by then | Ltd-Director × {Legacy} = 1 drop (Preservation retained for Wonka pattern and retained-ownership cases) |
| Landlord at Foundation rare; at Legacy typically transferred to beneficiary | Landlord × {Foundation, Legacy} = 2 drops |
| Beneficiary at Preservation/Legacy — recipient is usually bereaved-spouse Single/Couple archetype with inheritance event rather than standalone Beneficiary archetype | Beneficiary × {Preservation, Legacy} = 2 drops |
| Ltd-Director-in-Foundation rare | Ltd-Director × {Foundation} = 1 drop |

Total drops: stage-level drops tabulated above. Aged-Out's 6 non-Foundation combinations drop definitionally. Net drops from 70 raw = **25 drops**, leaving **45 base archetypes**.

### 2.3 Dedupe rules applied

No additional merge-dedupes applied at base level. Each surviving combination has genuinely distinct engine config (tax treatment, life-stage rules, relationship obligations, business-entity handling). Minor configuration overlap (e.g. Single Accumulation vs Cohab-Sep Accumulation) is preserved because engine classifies (e.g. PSO rights, property-division pending flag) differently.

Two additions reverse some drops:

| Addition | Reason |
|----------|--------|
| `beneficiary-legacy` NOT added; `beneficiary-preservation` NOT added | Recipient at 75+ is better classified as `single-preservation` / `couple-preservation` with inheritance-event flag on the event model |
| `divorced-legacy` retained | Late-life divorce residual (PSO on survivor, ex-spouse nomination, fragmented pension) is engine-distinct enough |

Net base after drops and no-dedupes: **45 base archetypes**.

### 2.4 Cross-border overlay

Per D5: separate archetypes only where engine config materially shifts AND demand exists. This produces 7 promoted CB archetypes (5 UK/IN, 2 UK/TH). All other CB situations carry a modifier flag on a base archetype.

Cross-border matrix:

| Archetype | CB handling |
|-----------|-------------|
| `single-accumulation-uk-in` | SEPARATE — Priya pattern · NRE/NRO · DTAA · ELSS/PPF |
| `single-consolidation-uk-in` | SEPARATE — mid-career NRI · consolidated pension thinking |
| `couple-accumulation-uk-in` | SEPARATE — NRI couple |
| `couple-decumulation-uk-in` | SEPARATE — returning-to-India retirees |
| `landlord-consolidation-uk-in` | SEPARATE — NRI landlord (common pattern) |
| `single-decumulation-uk-th` | SEPARATE — retire-to-Thailand solo (LTR visa, Thai residency) |
| `couple-decumulation-uk-th` | SEPARATE — retire-to-Thailand couple |
| Any other jurisdiction pair | MODIFIER on base — `cross_border: {primary: X, secondary: Y}` flag |

Net total: **45 base + 7 cross-border = 52 archetypes**.

---

## 3. ARCHETYPE MATRIX

Each row: slug · group · life stage · phase at launch · demo-fill preset? · existing persona coverage · primary engine-branch cluster (abbreviated). Full engine-branch mapping is Mr T spec scope (rank 2).

### 3.1 Group A — Single (7 archetypes)

| Slug | Stage | Phase | Demo-fill | Persona | Primary engine branches |
|------|-------|-------|-----------|---------|--------------------------|
| `single-foundation` | 18–33 | P1 | — | Hermione (28) | Auto-enrolment · student loan · first-home deposit · emergency fund · FINIO-1.0 Cashflow+Debt+Behaviour dominant |
| `single-accumulation` | 33–45 | P1 | ✓ | — | Mortgage · ISA · auto-enrolment scaling · workplace pension match · carry-forward · RISK-1.0 Liquidity + Protection |
| `single-consolidation` | 45–57 | P1 | — | — | Peak earning · tapered AA possible · ISA maxing · pension consolidation · IHT awareness |
| `single-transition` | 57–66 | P1 | — | Bruce (62) | NMPA access · MPAA risk · pre-SPA planning · SIPP drawdown design · BPR planning |
| `single-decumulation` | 66–75 | P1 | — | — | SPA claimed · SIPP drawdown · sequencing · Monte Carlo · Cost of Inaction |
| `single-preservation` | 75–85 | P1 | — | — | Post-75 pension death benefits · IHT planning · beneficiary chain · gift clock |
| `single-legacy` | 85+ | P1 | — | Anna (89) | 7-yr gift clock maturing · RNRB · estate primary · simplified engine |

### 3.2 Group B — Couple (7 archetypes)

| Slug | Stage | Phase | Demo-fill | Persona | Primary engine branches |
|------|-------|-------|-----------|---------|--------------------------|
| `couple-foundation` | 18–33 | P1 | — | — | Joint savings · shared first-home · dual auto-enrolment · transferable MA |
| `couple-accumulation` | 33–45 | P1 | — | — | Dual mortgage · joint ISA strategy · maternity gap · spousal pension balancing |
| `couple-consolidation` | 45–57 | P1 | — | — | Dual peak earning · joint tax optimisation · joint IHT start |
| `couple-transition` | 57–66 | P1 | ✓ | Fred & Wilma (64/61) · Anna (58) | Dual NMPA · sequencing two drawdowns · transferable NRB · spousal pension |
| `couple-decumulation` | 66–75 | P1 | — | Anna (72) | Dual drawdown · second-death IHT window · RNRB transfer · joint Monte Carlo |
| `couple-preservation` | 75–85 | P1 | — | — | Post-75 both partners · second-death planning · beneficiary chain · residual gift clock |
| `couple-legacy` | 85+ | P1 | — | — | Both-partners-85 · RNRB transfer · 7-yr gift clock · bereavement-transition imminent (per D4) |

### 3.3 Group C — Family Primary (4 archetypes) — P2 except Foundation/Accumulation

| Slug | Stage | Phase | Demo-fill | Persona | Primary engine branches |
|------|-------|-------|-----------|---------|--------------------------|
| `family-primary-foundation` | 18–33 | P2 | — | — | Young parent · Junior ISA · child benefit taper · maternity · guardianship nomination |
| `family-primary-accumulation` | 33–45 | P2 | — | Anna (32, 45) | Child benefit HICBC · Junior ISA maxing · school-fees planning · life cover |
| `family-primary-consolidation` | 45–57 | P2 | — | Anna (45) — overlap | Teenage kids · university-fees planning · parental guarantor mortgages |
| `family-primary-transition` | 57–66 | P2 | — | — | Adult-ish kids · last dependant aging out · pension access · grandchildren planning |

Note: existing "Nice-to-have" status in brief v1.11 paths table is respected — P2 at launch; capable of being attempted in P1 if capacity permits. Family Primary × Foundation and × Accumulation flagged as "first P2 candidates if P1 gate moves".

### 3.4 Group D — Aged-Out (1 archetype)

| Slug | Stage | Phase | Demo-fill | Persona | Primary engine branches |
|------|-------|-------|-----------|---------|--------------------------|
| `aged-out-foundation` | 18 (entry) | P2 | — | — | Transitioning from family-link child account · Junior ISA maturity · consent-to-link retention · inherited data envelope · auto-enrolment start-up |

### 3.5 Group E — Divorced/Separated (5 archetypes)

| Slug | Stage | Phase | Demo-fill | Persona | Primary engine branches |
|------|-------|-------|-----------|---------|--------------------------|
| `divorced-accumulation` | 33–45 | P1 | — | — | PSO rights · maintenance flows · RNRB review · child custody financial allocation · ex-spouse nomination removal |
| `divorced-consolidation` | 45–57 | P1 | — | — | Late PSO settlement · pension split · rebuilt savings trajectory · remarriage flag |
| `divorced-transition` | 57–66 | P1 | — | — | Pension Sharing Orders · NMPA access post-split · IHT re-planning without spousal exemption |
| `divorced-decumulation` | 66–75 | P1 | — | — | Divorce-in-retirement · PSO allocation in drawdown · IHT re-planning · widow(er) vs ex-spouse nomination |
| `divorced-legacy` | 85+ | P2 | — | — | Ex-spouse nomination residue · fragmented pension legacies · RNRB re-computation |

### 3.6 Group F — Cohabiting Separated (3 archetypes)

| Slug | Stage | Phase | Demo-fill | Persona | Primary engine branches |
|------|-------|-------|-----------|---------|--------------------------|
| `cohab-sep-accumulation` | 33–45 | P1 | — | — | NO PSO rights · property division (TOLATA) · child custody · no transferable NRB · unprotected pension |
| `cohab-sep-consolidation` | 45–57 | P1 | — | — | Same constraints in mid-life · higher asset stakes · no automatic spousal pension rights |
| `cohab-sep-transition` | 57–66 | P2 | — | — | Pre-retirement cohab-sep — unprotected · no pension rights carry-over · solo retirement planning |

### 3.7 Group G — Sole Trader (4 archetypes)

| Slug | Stage | Phase | Demo-fill | Persona | Primary engine branches |
|------|-------|-------|-----------|---------|--------------------------|
| `sole-trader-foundation` | 18–33 | P1 | — | — | Self-assessment · Class 2/4 NI · payments on account · Making Tax Digital · no employer pension · SIPP |
| `sole-trader-accumulation` | 33–45 | P1 | — | — | Scaled self-assessment · losses/averaging · pension funding · BPR on trading assets |
| `sole-trader-consolidation` | 45–57 | P1 | — | — | Peak trading · potential incorporation decision · pension catch-up · exit strategy formation |
| `sole-trader-transition` | 57–66 | P1 | — | — | Winding down · NMPA access · sale-of-goodwill · trading-income to pension shift |

### 3.8 Group H — Ltd Director / Business Owner (5 archetypes)

| Slug | Stage | Phase | Demo-fill | Persona | Primary engine branches |
|------|-------|-------|-----------|---------|--------------------------|
| `ltd-director-accumulation` | 33–45 | P1 | — | — | Salary/dividend/pension split · corporation tax · employer pension contributions · extraction strategy |
| `ltd-director-consolidation` | 45–57 | P1 | ✓ | Stark (48) | Tapered AA · SSAS · BPR-qualifying shares · BADR entry · peak extraction · pension carry-forward |
| `ltd-director-transition` | 57–66 | P1 | — | — | Exit-planning · BADR utilisation · SSAS drawdown · succession · company-owned pension |
| `ltd-director-decumulation` | 66–75 | P1 | — | — | Sold or retained ownership · dividend-to-income shift · IHT on retained shares · BPR residue |
| `ltd-director-preservation` | 75–85 | P2 | — | Wonka (78) | Retained ownership at 75+ · succession urgency · BPR on company shares · IHT strategy |

### 3.9 Group I — Landlord / Property Investor (4 archetypes)

Sub-types per brief v1.11 path table (18A/18B/18C) handled as `sub_type` modifier on base archetype — not separate archetypes.

| Slug | Stage | Phase | Demo-fill | Persona | Primary engine branches |
|------|-------|-------|-----------|---------|--------------------------|
| `landlord-accumulation` | 33–45 | P1 | — | — | Section 24 finance-cost cap · SDLT 3% surcharge · portfolio growth · property LLC consideration |
| `landlord-consolidation` | 45–57 | P1 | — | — | Peak-portfolio phase · CGT on disposal · incorporation trade-off · SDLT extended surcharges |
| `landlord-transition` | 57–66 | P1 | — | — | Pre-retirement portfolio rationalisation · CGT PPR residue · pension-vs-property trade-off |
| `landlord-decumulation` | 66–75 | P1 | — | — | Rental income as retirement cashflow · CGT crystallisation planning · IHT on property-rich estate |

### 3.10 Group J — Beneficiary / Estate Inheritor (5 archetypes)

| Slug | Stage | Phase | Demo-fill | Persona | Primary engine branches |
|------|-------|-------|-----------|---------|--------------------------|
| `beneficiary-foundation` | 18–33 | P1 | — | — | Inherited from parent/grandparent · 2-yr designation window · inherited drawdown · ISA APS |
| `beneficiary-accumulation` | 33–45 | P1 | — | — | Parental inheritance · BPR-inherited shares · inherited SIPP management |
| `beneficiary-consolidation` | 45–57 | P1 | — | — | Common inheritance window · multiple estate sources · IHT on own second-death projection |
| `beneficiary-transition` | 57–66 | P1 | ✓ | — | Inheritance during own retirement onset · consolidated estate planning · double-SIPP scenarios |
| `beneficiary-decumulation` | 66–75 | P1 | — | — | Late inheritance · compressed planning horizon · inherited drawdown coordination with own |

### 3.11 Cross-Border Archetypes (7)

| Slug | Base | Stage | CB pair | Phase | Demo-fill | Persona | Distinct engine branches |
|------|------|-------|---------|-------|-----------|---------|---------------------------|
| `single-accumulation-uk-in` | Single | 33–45 | UK/IN | P1 | ✓ | Priya (38) | NRE/NRO · DTAA · PPF ineligibility · ELSS · NPS Tier-I/II · Indian pension scheme nominee · Indian source-income reporting |
| `single-consolidation-uk-in` | Single | 45–57 | UK/IN | P1 | — | — | Dual residency test · Indian mutual-fund CGT · HNW NRI ceiling on NRE interest · ESOPs from Indian employer |
| `couple-accumulation-uk-in` | Couple | 33–45 | UK/IN | P1 | — | — | Dual NRE/NRO · HUF possibility · Indian property purchase rules · gift tax INR 50k threshold |
| `couple-decumulation-uk-in` | Couple | 66–75 | UK/IN | P1 | — | — | Returning-to-India residency transition · double-taxation on UK pension · Senior Citizen scheme · NRI-to-resident reclassification |
| `landlord-consolidation-uk-in` | Landlord | 45–57 | UK/IN | P1 | ✓ | — | UK rental + Indian property · TDS on NRI rent · FEMA · RBI repatriation caps · dual CGT |
| `single-decumulation-uk-th` | Single | 66–75 | UK/TH | P1 | — | — | LTR visa eligibility · Thai tax residency threshold · pension remittance · 10-year LTR tax holiday · SSF/RMF |
| `couple-decumulation-uk-th` | Couple | 66–75 | UK/TH | P1 | ✓ | — | Dual LTR · Thai Provident Fund · retiree tax shelter · UK residency cessation decision · dual-state pension transfer |

---

## 4. PHASE DISTRIBUTION

| Phase | Archetype count | Share |
|-------|-----------------|-------|
| **Phase 1 — June 2026 UK launch** | **44** | 85 % |
| Phase 2 — post-launch | 8 | 15 % |
| Total | 52 | 100 % |

**Phase 1 breakdown (44):**
- Single × 7
- Couple × 7
- Divorced × 4 (Accumulation, Consolidation, Transition, Decumulation — Legacy deferred)
- Cohab-Sep × 2 (Accumulation, Consolidation — Transition deferred)
- Sole Trader × 4
- Ltd Director × 4 (Accumulation, Consolidation, Transition, Decumulation — Preservation deferred)
- Landlord × 4
- Beneficiary × 5
- Cross-border × 7

**Phase 2 breakdown (8):**
- Family Primary × 4
- Aged-Out × 1
- Divorced-Legacy × 1
- Cohab-Sep-Transition × 1
- Ltd-Director-Preservation × 1

**O2 flag (below) proposes promoting `ltd-director-preservation` to P1 to support Wonka demo.** If accepted, split becomes 45 P1 / 7 P2.

---

## 5. MR T FIXTURE COVERAGE — REQUIREMENT MAP

Mr T is one JSON fixture covering every engine branch across all 51 archetypes. Detailed field-by-field spec belongs to rank 2. This section states the coverage obligation.

**Engine modules Mr T must exercise:**

| Module | Branches required | Archetypes driving requirement |
|--------|-------------------|--------------------------------|
| TAX-2026.1 Income Tax | PA full + tapered + lost · basic/higher/additional · savings nil-rate · dividend allowance · BR/HR/AR rates | Single, Couple across all active stages |
| TAX-2026.1 NI | Class 1 primary/secondary · Class 2 (until 2024 abolition residue) · Class 3 · Class 4 · voluntary contributions · NIC upper rate | Sole Trader, Ltd Director, Employee (collapsed) |
| TAX-2026.1 CGT | Annual exempt amount · BR/HR rate split · BADR · PPR · Section 24 landlord | Landlord, Sole Trader, Ltd Director |
| TAX-2026.1 IHT | NRB · RNRB · RNRB taper · transferable allowances · 7-yr gift clock · 14-yr clock · taper relief bands · BPR 100%/50% · APR · spousal exemption · charity exemption · trust IHT (10-yr + exit) | Single/Couple Transition+, Ltd Director, Beneficiary, all Preservation+ |
| TAX-2026.1 Pension | AA · tapered AA · carry-forward · MPAA · LSA/LSDBA · NMPA · SPA · state pension · auto-enrolment · employer match · SSAS mechanics · SIPP · workplace · Expression of Wish | All stages — essentially every archetype |
| TAX-2026.1 Wrappers | ISA sub-limits (cash/S&S) · JISA · LISA · GIA · EIS/SEIS/VCT · Offshore bond · onshore bond · Premium Bonds | Single Foundation–Consolidation heavy |
| TAX-2026.1 Post-Finance-Act-2026 | DC pension IHT inclusion from 6-Apr-2027 · scheduled activation · pre/post scenarios | Transition+ archetypes, Beneficiary |
| FINIO-1.0 | All 7 dimensions · momentum multiplier · amplifiers · band transitions | All archetypes |
| RISK-1.0 | All 7 dimensions · amplifiers · confidence bands · DS-1 insufficient-data paths | All archetypes |
| COHORT-UK | Lookup by (age, life-stage, asset-band) · missing-data behaviour · cohort percentile calc | All archetypes |
| Monte Carlo | Longevity stub (100 runs) · 500-run config OPEN · male/female split · joint-life | Decumulation+ archetypes |
| Gauss-Seidel solver | Circular dependency resolution · convergence test · divergence alert | All archetypes with bidirectional inputs |
| TAX-IN-2026.1 (stub) | Indian FY start 1 April · NRE/NRO taxation · TDS on rent · DTAA UK/IN · PPF/ELSS/NPS · LTCG on equities · HUF entity | UK/IN cross-border archetypes |
| TAX-TH-2026.1 (stub) | Thai FY calendar year · LTR visa tax treatment · Provident Fund · SSF/RMF · remittance taxation rule post 2024 | UK/TH cross-border archetypes |
| RULES MGMT (Part 9) | Rule activation · impact scorer · APQ generation · notification dispatch · bundle version transition | All archetypes (system-wide) |

**Mr T build deliverable (rank 3):** `/tests/fixtures/mrT.json` populated such that running the regression suite against it fires at least one assertion per row above.

---

## 6. DEMO-FILL PRESETS (7)

Per D7, 7 presets for IFA demo mode. Selected to maximise IFA conversation coverage.

| # | Preset slug | Archetype | IFA conversation primary use |
|---|-------------|-----------|------------------------------|
| 1 | `demo-uk-single-mid-career` | `single-accumulation` | Typical mid-career professional client · first pension consolidation · ISA vs SIPP · emergency fund build |
| 2 | `demo-uk-couple-pre-retire` | `couple-transition` | "We're thinking about retiring" — sequencing two drawdowns · transferable NRB · IHT onset |
| 3 | `demo-uk-business-owner` | `ltd-director-consolidation` | Owner-operator client · salary/dividend/pension split · tapered AA · BPR · exit thinking |
| 4 | `demo-uk-inheritor` | `beneficiary-transition` | "I'm about to inherit" · 2-yr designation window · combining with own drawdown · IHT flows |
| 5 | `demo-nri-single` | `single-accumulation-uk-in` | NRI client · DTAA · NRE/NRO · Indian instruments · UK pension with Indian retirement planning |
| 6 | `demo-retiree-thailand` | `couple-decumulation-uk-th` | Retire-to-Thailand couple · LTR visa · residency cessation · dual-state pension transfer |
| 7 | `demo-nri-landlord` | `landlord-consolidation-uk-in` | NRI property portfolio · FEMA · TDS · dual CGT · cross-border IHT |

All 7 presets ship at P1 UK launch. Per D8, each preset resets on exit.

---

## 7. DEMO PERSONA → ARCHETYPE MAPPING (the 7 retained personas)

Per D-PERSONAS-REV (23 Apr), the 7 narrative personas remain at launch as IFA demo fixtures. They map into the archetype system — they are not replaced by it.

| Persona | Primary archetype | Life-stage notes |
|---------|-------------------|------------------|
| Bruce Wayne (62, UK) | `single-transition` | Pre-retirement, high-asset, no direct heirs · BPR considerations on Wayne Enterprises residue |
| Fred & Wilma Flintstone (64/61, UK) | `couple-transition` | Joint pre-retirement · stage determined by older partner per D3 |
| Tony Stark (48, UK) | `ltd-director-consolidation` | Peak-earning business owner · tapered AA · SSAS · BPR |
| Hermione Granger (28, UK) | `single-foundation` + `ifa-practice` | Dual account: personal archetype `single-foundation`; professional account `ifa-practice` (organisational, not archetype-producing) |
| Willy Wonka (78, UK) | `ltd-director-preservation` | Retained ownership at 75+ · succession urgency (promoted P2→P1 for Wonka support is OPEN — see §9) |
| Anna Finch (22→89, UK) | Journey: `single-foundation` (22) → `family-primary-accumulation` (32) → `family-primary-consolidation` (45) → `couple-transition` (58) → `couple-decumulation` (72) → `single-legacy` (89) | Lifetime-arc persona exercises 6 archetypes serially |
| Priya Sharma (38, UK/IN) | `single-accumulation-uk-in` | NRI · DTAA · NRE/NRO |

---

## 8. DOWNSTREAM IMPACTS

### 8.1 Part 6 (Onboarding) — v0.5 scope additions

Onboarding v0.5 must emit an `archetype_assignment` event at end of flow. Classifier logic:

```
classify(
  path,                       // from §0 path selection
  life_stage,                 // DOB + override
  relationship_status,        // RH-1a
  cross_border_flag,          // precursor + cross-border catcher (DQ-26)
  employment_type,            // sole trader / ltd / employee / retired / other
  landlord_flag,              // separate question
  beneficiary_flag            // "inheriting in next 24 months?" question
) → archetype_slug
```

**New onboarding questions required to disambiguate:**
- Employment type (5-option question) — drives Single/Sole-Trader/Ltd-Director/Landlord/Beneficiary collision resolution
- Landlord flag (Y/N) — can combine with any employment type
- Beneficiary "inheriting soon" flag (Y/N/Already-inherited) — drives Beneficiary archetype promotion
- Cross-border primary/secondary country (with NRE/NRO flag for UK/IN, LTR-visa flag for UK/TH)

### 8.2 Part 4 (Personas) — three-jobs integrity

Job 1 (Mr T) is one file. Job 2 (7 narrative personas) maps per §7. Job 3 (archetypes) is this document. No persona is deleted. Screens do NOT refactor to archetype-keyed reads at launch — per D-SCREENS-1 and D-ENTRY-1, screens stay single-mode per session. Archetype-keyed reads are needed only for *new* users entering via the Real User mode of the entry picker.

### 8.3 Part 24 (Language) — archetype-independent

Archetype set is language-neutral. Content strings per archetype (advice tone, default narratives, APQ surface language) become translation keys under Part 24 bundle. Explicit fork at Part 24 design session.

### 8.4 Part 14 (Testing) — Mr T regression harness

Regression baseline files extend: `baseline-FINIO-1.0-UK-2026.1-{archetype-slug}.json` for every P1 archetype. Baseline generation at rank 2 (Mr T spec) → rank 3 (build) → rank 8 (baseline re-key).

### 8.5 Cluster 3 rules-management system (Part 9 / rank 13)

Each archetype carries a `rule_bundle_subscription` — the set of rule keys this archetype's engine path depends on. When a rule changes (e.g. AA tapered threshold), the rules management system's impact scorer reads archetype subscriptions to decide whom to alert. Schema addition:

```sql
archetype_rule_subscriptions (
  archetype_slug text,
  rule_key text,
  PRIMARY KEY (archetype_slug, rule_key)
)
```

Content population during Part 9 / rules management build (rank 13).

---

## 9. OPEN ITEMS

| # | Item | Action |
|---|------|--------|
| O1 | `ltd-director-preservation` P1 vs P2 — currently P2 but needed for Wonka demo; see §4 note | Founder decision — promote to P1 or accept Wonka as non-classified narrative-only persona |
| O2 | Cross-age couple override for Stage tiebreak (D3 rule) — does the *younger* partner's stage ever win? (e.g. large age gap where younger partner's accumulation trajectory dominates joint planning) | Edge-case spec in Onboarding v0.5 |
| O3 | Beneficiary-Decumulation at P1 or P2 — I placed at P1 but it's a late-life inheritance edge | Low-priority; default P1 stands |
| O4 | Dual-archetype personas (Hermione, Anna) — is `archetype_assignment` a set or a single value for the primary user record? | If set, onboarding emits multiple assignments; if single, IFA practice account is separate user record. Recommend: single primary with secondary flags; practice account is separate record |
| O5 | Landlord sub-types (18A/18B/18C from brief) — handled as `sub_type` modifier rather than separate archetypes. Sub-type enumeration needs Part 2 bundle schema | Defer to Part 2 regeneration (rank 12) |
| O6 | `ifa-practice` organisational record (Path 8 collapsed) — not an archetype but needs a record class | Part 10 entity-model: Organisation entity type (IFA-Practice, Employer, Trust, Pension-Scheme) as separate entity class, linked to user via role relationships |
| O7 | India-resident preset (not UK/IN but IN-primary) for IFA Indian adviser use case — deferred per D7 | Track for post-May India show-and-tell outcome |

---

## 10. RELATIONSHIPS TO OTHER DOCUMENTS

| Document | Dependency |
|----------|------------|
| `finio-brief-v1_11.md` §Dimension 2 (19 paths) · §Dimension 5 (7 life stages) | This document's input |
| `finio-index-v0_9.md` Part 6 row · Part 4 row · Part 14 row | This document updates status of Part 6 classifier, Part 4 persona mapping, Part 14 fixture requirement |
| `1-Foundation-paths-and-stages-validated-v2_0.md` | This document's authoritative path/stage source |
| `3-Engine-rules-management-system-v1_0.md` | Consumers this document's archetype slugs as subscription keys |
| `100-ChatTransfers-handover-23apr2026-session-close-v1_0.md` | This document resolves handover §5's 8 decisions + the 3 flags from this session open |
| `10-AllClusters-master-backlog-v1_0.md` | Rank 1 item — this document closes that rank |

---

## 11. CHANGELOG

### v1.0 — 23 April 2026
- Initial derivation. 52 archetypes (45 base + 7 CB). 10 archetype-producing groups × 7 life stages with drop and dedupe rules stated. 8 in-session decisions locked. 3 flags from session open resolved (Path 19 Phase 1 override; scope shape; cluster filing). 7 demo-fill presets specified. 7 narrative personas mapped to archetypes. Mr T fixture coverage stated at engine-module level; field-level spec deferred to rank 2. 7 open items flagged.

---

*Finio Archetypes v1.0 · 23 April 2026 · Cluster 2-Product · Confidential*
*Next session: Mr T fixture spec (rank 2) — consumes this document's engine-branch map and archetype list.*
*Closes rank 1 of 10-AllClusters-master-backlog-v1_0.md.*
