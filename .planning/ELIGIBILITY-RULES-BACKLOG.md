# Eligibility Rules — Backlog (45 deferred)

**v0 done (15 rules):** NI-QUAL-YEARS, PA-TAPER, HICBC, RNRB-DESCENDANT, RNRB-TAPER, PET-7YR-CLOCK, MPAA, MARRIAGE-ALLOWANCE, SDLT-FTB, BPR-2YR-HOLDING, CHARITY-10-PCT, SRT-RESIDENCE, PPR, CARRY-FORWARD-AA, UK-DOMICILE.

**Build effort scoring:** S = small (~30 min), M = medium (~1 hr), L = large (~2-3 hr), XL = 4+ hr / cross-cutting.

**Impact scoring:** % of 92 personas materially affected if rule is correctly implemented.

---

## PHASE 8C — Round 2 (next 15 — for IFA-grade accuracy)

| Rule ID | Title | Effort | Impact | Notes |
|---|---|---|---|---|
| LIFETIME-ISA-AGE | Lifetime ISA age limits (18-39 open, 60+ penalty-free) | S | 5% | Foundation personas, junior savers |
| JUNIOR-ISA | Junior ISA — under 18, parent opens, becomes adult ISA at 18 | S | 8% | Personas with dependants |
| PENSION-CREDIT | Pension Credit — income top-up to £218.15/wk single, £332.95 couple | M | 6% | Foundation + low-income decumulation |
| UC-CAPITAL-LIMIT | Universal Credit capital limits (£6k tapered, £16k cutoff) | S | 4% | Foundation personas |
| AUTO-ENROLMENT | Auto-enrolment qualifying earnings (£6,240 lower, £10,000 trigger, £50,270 upper) | M | 35% | Every employed persona |
| VOLUNTARY-NI-CLASS-3 | Voluntary Class 3 NIC (£907.40/yr 2025/26) — buy back years | S | 20% | Augments NI-QUAL-YEARS |
| SCOTTISH-RESIDENT | Scottish income tax (different bands and rates) | M | 8% (if any Scottish personas) | Needs persona.jurisdiction field |
| SPLIT-YEAR-CASES | Split-year treatment (8 cases) | XL | 5% | Cross-border personas |
| GIFT-WITH-RESERVATION | Gifts with Reservation of Benefit (GWR) — still in estate | M | 12% | Estate planners |
| POAT | Pre-Owned Asset Tax | M | 3% | Edge case but blocks PEt+GWR |
| TNRB | Transferable NRB % from predeceased spouse | M | 15% | Widow/widower personas |
| AGRICULTURAL-RELIEF | Agricultural Relief — qualifying land use | M | 2% | Landlord/farming personas |
| LETTING-RELIEF | Letting Relief restricted to shared occupation post-2020 | S | 5% | Landlord personas |
| LISA-PENALTY | Lifetime ISA 25% penalty for early withdrawal | S | 3% | Foundation savers |
| TAX-FREE-CHILDCARE | Tax-Free Childcare — eligibility (working £167/wk min, under £100k each) | M | 8% | Working parents |
| BLIND-PERSONS-ALLOWANCE | Blind Person's Allowance £3,070 extra | S | 1% | Edge but easy |

**Subtotal effort:** ~18 hours

---

## PHASE 8D — Round 3 (15 rules — for cross-border + business depth)

| Rule ID | Title | Effort | Impact | Notes |
|---|---|---|---|---|
| FIG-REGIME | Foreign Income & Gains 4-yr regime (from Apr 2025) | XL | 4% | persona-g critical |
| DEEMED-DOMICILE | Deemed domicile 15/20 yrs | M | 4% | Cross-border |
| LTR-REGIME | Long-Term Resident regime (from Apr 2025) | XL | 4% | New regime |
| INDIA-NRE-NRO | India NRE/NRO/EPF UK reporting + DTA | XL | 3% | persona-g |
| DTA-POSITIONS | Double Taxation Agreements (per-country) | XL | 5% | Multi-jurisdiction |
| LTA-PROTECTION | LTA protection schemes (FP14/16, IP14/16) | M | 2% | High earners |
| EIS-QUALIFYING | EIS qualifying co. ≤7yrs old | M | 3% | High-NW investors |
| SEIS-QUALIFYING | SEIS qualifying smaller co. | M | 2% | Same |
| VCT-5YR-HOLDING | VCT income relief held ≥5 yrs | S | 3% | Same |
| BADR-ELIGIBILITY | BADR ≥5% shareholder + officer 2yrs (10% CGT, £1M lifetime) | M | 4% | Ltd directors |
| EMI-OPTIONS | EMI option qualifying co. + employee | M | 2% | Tech employees |
| RD-TAX-CREDITS | R&D tax credits SME vs RDEC | M | 2% | Ltd directors only |
| DIRECTORS-NI-BASIS | Director's NI annual basis vs monthly | M | 5% | Ltd directors |
| NMPA-PROTECTED | Protected NMPA age (some keep 55, others move to 57 from 2028) | M | 8% | Decumulation personas |
| BENEFICIARY-DRAWDOWN | Beneficiary drawdown pre/post 75 death tax | M | 6% | Estate planners |

**Subtotal effort:** ~22 hours

---

## PHASE 8E — Round 4 (15 rules — long tail / edge cases)

| Rule ID | Title | Effort | Impact | Notes |
|---|---|---|---|---|
| LSDBA-LIMIT | Lump Sum and Death Benefit Allowance £1,073,100 | M | 2% | Apr 2024 onwards |
| BCE-PRE-2024 | Crystallisation events (BCE 1-13) | XL | 1% | Historical, pre-2024 only |
| PENSION-RECYCLING | Pension recycling anti-avoidance | M | 1% | Edge avoidance |
| ATTENDANCE-ALLOWANCE | Attendance Allowance over SPA + care need | S | 3% | Elderly personas |
| CARERS-ALLOWANCE | Carer's Allowance 35+ hrs care | S | 2% | Family care personas |
| TRADING-ALLOWANCE | Trading Allowance £1,000 | S | 4% | Side-hustle personas |
| PROPERTY-ALLOWANCE | Property Allowance £1,000 | S | 5% | Mini-landlords |
| RENT-A-ROOM | Rent-a-Room £7,500 tax-free | S | 6% | Lodger income |
| STARTING-RATE-SAVINGS | Starting Rate for Savings £5,000 @ 0% if non-savings income < £17,570 | M | 4% | Low-income retirees |
| HICBC-EXEMPTION-CHOICE | HICBC — opt out of CB instead of paying charge | S | 3% | High-earner parents |
| SDLT-3PCT-SURCHARGE | SDLT 3%/5% surcharge for additional property | S | 8% | BTL purchases |
| SDLT-NON-RES-2PCT | SDLT non-resident 2% surcharge | S | 2% | Cross-border purchases |
| LBTT-SCOTLAND | LBTT (Scottish SDLT) | M | 1% | Scottish only |
| LTT-WALES | LTT (Welsh SDLT) | M | 1% | Welsh only |
| ANNUAL-EXEMPTION-CGT-CARRY | CGT AEA cannot carry forward | S | 4% | Investors realising gains |

**Subtotal effort:** ~14 hours

---

## TOTAL EFFORT SUMMARY

| Phase | Rules | Effort | Cumulative |
|---|---|---|---|
| 8A (v0, done) | 15 | done | done |
| 8C | 16 | ~18 hours | 18 hours |
| 8D | 15 | ~22 hours | 40 hours |
| 8E | 15 | ~14 hours | 54 hours |
| **Total** | **61 rules** | **~54 hours** | — |

---

## RULES INTENTIONALLY NOT IN BACKLOG

These exist in UK law but don't meet our threshold for inclusion:

- **Married Couple's Allowance** (only for those born pre-6-Apr-1935 — vanishing population)
- **Capacity assessment via LPA** — legal not tax; affects gifting validity, not tax
- **Trust tax regimes** (RPT, IIP, BMT, etc.) — handle at trust-level not eligibility
- **Tax planning around mini-Budget Sep 2022** — was reversed
- **Stamp Duty Land Tax holiday (Jul 2020 - Sep 2021)** — historical only
- **Furnished Holiday Let qualifying conditions pre-Apr-2025** — abolished
- **Help to Buy ISA** — closed scheme; existing holders only
- **Workplace Childcare Voucher Scheme** — closed scheme
- **Pension Lifetime Allowance (LTA)** — abolished Apr 2024

---

## ENGINE INTEGRATION TODO (for Phase 8B)

When the temporal-rules engine refactor lands (Phase 8B), eligibility rules need to:

1. **Accept `asOfDate` param uniformly** — already done in v0
2. **Use year-specific thresholds** — NRB has been £325k since 2009 but RNRB introduced 2017; need year tables
3. **Couple-aware NRB/RNRB** — already partial; needs spouse-date-of-death for TNRB
4. **Integrate with engine's `calcStateP()`** — replace its internal default years calc with `getRule('NI-QUAL-YEARS').predicate(p, asOfDate)`
5. **Integrate with engine's `ihtDynamic()`** — apply RNRB-DESCENDANT + RNRB-TAPER gates
6. **Integrate with engine's `incomeTax()`** — apply PA-TAPER + Scottish bands
7. **Expose to Optimiser screen** — eligibility hooks become Optimiser tiles

---

*v1 authored 2026-05-21. Update as rules ship.*
