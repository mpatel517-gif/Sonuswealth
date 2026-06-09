Title:         Tax & Estate — Domain Taxonomy + 2026/27 Figures Research
Version:       1.0
Date:          2026-06-09
Status:        DOCUMENTED
Cluster:       2-Product / 3-Engine (Tax & Estate)
File name:     TE-DOMAIN-RESEARCH.md
Purpose:       Research-backed drawer/tile taxonomy + verified 2026/27 UK figures so a product designer can rebuild the cluttered Tax & Estate hub into clean domain drawers.

**Summary:** A complete UK personal Tax & Estate information taxonomy — 11 proposed drawers with their tiles, a fully-cited 2026/27 figures table, a "what haven't I used yet" allowance inventory, and how best-in-class UK tools structure this view.
**Tags:** #tax-estate #taxonomy #information-architecture #2026-27 #drawers
**Updated:** 2026-06-09

---

## §0 — METHOD + SOURCES

Figures cross-checked against the canonical engine bundle `src/rules/UK-2026.1.1.json` (verified May/June 2026) AND independently re-verified against gov.uk / HMRC / DWP / House of Commons Library for this document. Where a figure could only be dated to training cutoff or a single secondary source, it is marked **verify**. Positioning constraint: Sonuswealth is **information / guidance / storage, not advice and not a filing service** — every drawer below is framed as "show + explain + store", never "do it for you" or "buy this". FCA boundary preserved throughout.

**One bundle correction surfaced by this research** (flag to engine owner, do not silently edit):
- `income.blindPersonAllowance` and `allowancesAndReliefs.*` blind person figure = **£3,070** in the bundle, but the correct **2026/27** figure is **£3,250** (uprated by SI 2026/38, *Income Tax (Indexation of Blind Person's Allowance and Married Couple's Allowance) Order 2026*). Bundle value looks like a 2-year-old figure. **Married Couple's Allowance** (over-88s / born before 6 Apr 1935) was uprated by the same SI and is **absent** from the bundle entirely. Both should be reviewed.

---

## §1 — PROPOSED DRAWER TAXONOMY

Design principle (macOS / PP-2): **the drawer label is plain-English, the drawer is a domain, each tile inside is one decision or one number the user can tap to investigate.** Internal rule IDs (UK-IHT-06 etc.) live in the drill, never on the surface. Drawers are *dynamic* — hide when the user has nothing in that domain (e.g. no dividends → no Dividends tile; Foundation life-stage → estate drawers collapse to Will & LPA only). This matches the existing spec's §Q3.4 dynamic-tile rules and avoids showing an empty 11-drawer wall to a 24-year-old renter.

Two top-level **realms** (keep the existing Tax | Estate split as the top toggle — it's the cleanest mental model and already built), with drawers nested under each. A third cross-cutting realm, **"What I haven't used"**, is the headline answer to the founder's allowance-headroom requirement and should sit at the very top, above the realm toggle, as a persistent strip.

### REALM A — TAX (what you owe this year, and how to owe less legally)

**Drawer A1 — Income & Income Tax**
What it is: everything HMRC counts as your income and the tax bands it falls through.
Tiles: Total taxable income · Personal Allowance (incl. £100k taper / 60% trap) · Tax bands walk (20/40/45% stepped chart) · Adjusted Net Income (ANI) explainer — *the upstream number that drives the taper, HICBC, PSA band, marriage allowance* · Scottish/Welsh rate flag (jurisdiction-aware) · Tax code check · High-Income Child Benefit Charge (£60k–£80k taper).
2026/27 rules: PA £12,570 (frozen to 2030/31); bands £37,700 basic / £50,270 HRT / £125,140 ART; taper £100k–£125,140; Scottish 6-band structure; HICBC £60k–£80k.

**Drawer A2 — National Insurance**
What it is: the second tax on earned income, and the one that buys State Pension years.
Tiles: Class 1 employee NIC (8% / 2%) · Class 4 self-employed (6% / 2%) · Class 2 status · Voluntary Class 3 to fill State Pension gaps (£17.45/wk) · State Pension qualifying-years tracker (35 years for full).
2026/27 rules: PT £12,570; UEL £50,270; employee 8%/2%; Class 4 6%/2%; Class 3 £17.45/wk; employer 15% above £5,000 (relevant only to business-owner users).

**Drawer A3 — Savings & Dividends**
What it is: tax on money your money earns outside a pension/ISA.
Tiles: Personal Savings Allowance (£1,000 / £500 / £0) · Starting-rate-for-savings band (£5,000 @ 0%) · Dividend allowance (£500) + dividend rates (10.75 / 35.75 / 39.35%) · "Bed & ISA" / wrapper-shelter explainer (info only).
2026/27 rules: PSA basic £1,000 / higher £500 / additional £0; savings starting rate band £5,000; dividend allowance £500; dividend rates **rose** from Apr 2026 (basic 8.75→10.75%, higher 33.75→35.75%, additional 39.35% unchanged).

**Drawer A4 — Capital Gains**
What it is: tax when you sell an asset (shares, second property, crypto, business) for more than you paid.
Tiles: Annual exempt amount (£3,000) tracker · CGT rates (18% / 24%; property same) · Property 60-day reporting clock · BADR (business sale, 18%, £1m lifetime) · Investors' Relief (18%, £1m) · "30-day rule" / bed-and-spouse / bed-and-ISA explainers · Crypto CGT note (CARF reporting live Jan 2026).
2026/27 rules: AEA £3,000; main rates 18%/24%; BADR & Investors' Relief **18%** (BADR was 14% in 25/26, 10% before) — the max BADR saving fell to £60k.

**Drawer A5 — Self-Assessment & Filing** *(storage/reminder, NOT a filing service)*
What it is: deadlines, payments on account, and document storage for the user's own return.
Tiles: SA deadline timeline (31 Jan online / 31 Jan + 31 Jul payments on account) · Payments-on-account estimate · Making Tax Digital ITSA status (mandated from Apr 2026 if gross self-employed+rental >£50k) · Document vault hooks (P60, P11D, dividend vouchers, completion statements).
Boundary: Sonuswealth stores and reminds; it does not submit to HMRC.

**Drawer A6 — Property & Landlord Tax** *(dynamic — only if user has rental/second property)*
What it is: the tax rules unique to owning property you don't live in.
Tiles: Rental income & allowable expenses · Section 24 mortgage-interest restriction (20% credit, not deduction — hits higher-rate landlords) · SDLT calculator incl. 5% additional-property surcharge · Rent-a-room relief (£7,500) · Property allowance (£1,000) · FHL abolished note (Apr 2025) · ATED flag (company-held >£500k).

**Drawer A7 — Business-Owner Tax** *(dynamic — only if user is a director / sole trader)*
What it is: extracting money from your own company tax-efficiently, plus the personal side of business tax.
Tiles: Salary vs dividend split · Employer pension contributions (CT-deductible, NI-exempt — most efficient route) · Director's loan / s455 (35.75%) · Corporation-tax marginal-relief context (19% / 25%, marginal £50k–£250k) · IR35 status note · EOT / relevant life plan (info) · Carried-interest change (Apr 2026, now IT+NIC).
Boundary: corporation-tax *filing* is out of scope; only the personal-impact view is in scope.

### REALM B — ESTATE (what happens to your wealth when you die / give it away)

**Drawer B1 — Estate & Inheritance Tax**
What it is: the 40% tax on what you leave behind above your allowances.
Tiles: Estate-vs-thresholds gauge · IHT waterfall (gross estate → NRB → RNRB → taxable → IHT → family receives) · NRB £325k · RNRB £175k (+ £2m taper) · Transferable NRB/RNRB (couple up to £1m) · Reduced 36% rate (≥10% to charity) · **Pension-into-estate change 6 Apr 2027** (the single most important forward event — DC pensions join the estate; post-75 combined IT+IHT can exceed 67%) · Cost-of-Inaction odometer (scoped to estate domain per the scoped-CoI ruling).
2026/27 rules: NRB £325k & RNRB £175k both frozen to 2030/31; RNRB tapers £1-per-£2 above £2m estate; 40% standard / 36% reduced.

**Drawer B2 — Gifts & the 7-Year Clock**
What it is: giving money away now to reduce the estate later, and the rules that decide whether it works.
Tiles: Annual gift exemption (£3,000, 1-year carry-forward) · Small gifts (£250/person) · Wedding gifts (£5,000 parent / £2,500 grandparent / £1,000 other) · Normal-expenditure-out-of-income exemption (the underused powerhouse — needs documentation) · PET 7-year clock + taper-relief ring (3–7yr: 80/60/40/20%) · CLT 20% entry charge · Deed of variation (2-year window).

**Drawer B3 — Business & Agricultural Relief** *(dynamic — business/farm/AIM holders)*
What it is: reliefs that can take qualifying business or farm assets out of IHT.
Tiles: Combined APR/BPR £2.5m allowance gauge (NEW Apr 2026; 100% within, 50%/effective-20% above) · AIM 50% BPR (was 100%) · 2-year qualifying hold clock · Trust anti-fragmentation (post-30-Oct-2024) · £2.5m frozen to Apr 2031 then CPI.

**Drawer B4 — Trusts** *(dynamic)*
What it is: legal structures that hold assets outside (or partly outside) the estate, with their own tax regime.
Tiles: Discretionary trust (20% entry above NRB, 6% 10-year periodic, exit charges, 45%/39.35% income) · Bare trust · Interest-in-possession · Trust Registration Service obligation · LPA-cannot-gift safeguard note.

**Drawer B5 — Wills, LPA & Succession**
What it is: the legal scaffolding — without it, the tax planning above can't execute.
Tiles: Will status (have one? up to date?) · Lasting Power of Attorney (property+finance / health+welfare) · Intestacy explainer (£322k statutory legacy; cohabitants get nothing) · Pension Expression of Wishes / nominations · Guardianship (if minor children) · Document vault for all of the above.

**Drawer B6 — Pensions & Estate** *(bridges Tax and Estate)*
What it is: how pensions are taxed in life and how they pass on death — increasingly an estate question after Apr 2027.
Tiles: Tax relief on contributions (incl. higher/Scottish-rate reclaim via SA) · Annual Allowance + carry-forward + taper + MPAA tracker · Lump Sum Allowance (£268,275) / LSDBA (£1,073,100) · Death-before-75 (tax-free) vs after-75 (income tax + IHT from 2027) · Nominations review · Normal Minimum Pension Age (55 → 57 from Apr 2028).

### CROSS-CUTTING — RESIDENCY / DOMICILE *(dynamic — only if user flags overseas exposure)*
**Drawer C1 — Residency, Domicile & Overseas**
Tiles: Statutory Residence Test (automatic overseas → automatic UK → sufficient ties) · Split-year treatment · FIG regime (4-year new-arrival exemption, year-5 cliff) · Temporary Repatriation Facility (12%/12%/15%, closes Apr 2028) · 10-year IHT residence test (replaced deemed domicile) · Double-taxation relief note.

### CROSS-CUTTING — CHARITABLE GIVING
Fold into A3/B1 rather than its own drawer unless the user gives regularly: Gift Aid (25% gross-up; reduces ANI — a lever for the £100k taper and HICBC) · Payroll giving · 36% IHT reduced rate trigger (≥10% to charity) · gifts of shares/property to charity.

---

## §2 — 2026/27 UK FIGURES TABLE (cited)

All ENACTED for 2026/27 unless stated. £ in GBP, rates as %.

### Income Tax (rUK)
| Item | 2026/27 | Status | Source |
|---|---|---|---|
| Personal Allowance | £12,570 (frozen to 2030/31) | ENACTED | gov.uk income-tax-rates; HoC CBP-10618 |
| PA taper | £1 per £2 over £100,000; nil at £125,140 | ENACTED | gov.uk |
| Basic rate / band | 20% on next £37,700 (to £50,270) | ENACTED | HoC CBP-10618 |
| Higher rate | 40% £50,270–£125,140 | ENACTED | gov.uk |
| Additional rate | 45% above £125,140 | ENACTED | gov.uk |
| Marriage Allowance transfer | £1,260 | ENACTED | HoC CBP-10618 |
| Blind Person's Allowance | **£3,250** (bundle says £3,070 — **fix**) | ENACTED | SI 2026/38; LITRG |
| Married Couple's Allowance (b. pre-6/4/1935) | uprated by SI 2026/38 — **verify exact figure**, ~£11,270 max / £4,360 min relief 26/27 | ENACTED | SI 2026/38 (figure verify) |
| Blind/MCA — Scotland/Wales | PA is UK-wide; rates differ | ENACTED | gov.uk |

### Savings & Dividends
| Item | 2026/27 | Status | Source |
|---|---|---|---|
| Personal Savings Allowance | £1,000 basic / £500 higher / £0 additional | ENACTED | gov.uk apply-tax-free-interest |
| Starting rate for savings | £5,000 @ 0% (tapers vs non-savings income) | ENACTED | gov.uk |
| Dividend allowance | £500 | ENACTED | gov.uk tax-on-dividends |
| Dividend rates | 10.75% / 35.75% / 39.35% (basic & higher **rose** Apr 2026) | ENACTED | gov.uk; bundle _meta |

### Capital Gains
| Item | 2026/27 | Status | Source |
|---|---|---|---|
| Annual Exempt Amount | £3,000 | ENACTED | gov.uk; MHA |
| Main rates | 18% basic-band / 24% above | ENACTED | gov.uk |
| Residential property | 18% / 24% | ENACTED | gov.uk |
| BADR | 18% (£1m lifetime; was 14% in 25/26) | ENACTED | gov.uk business-asset-disposal-relief; Hawsons |
| Investors' Relief | 18% (£1m lifetime) | ENACTED | Deloitte UK Tax Policy Map |
| Property CGT reporting | 60 days | ENACTED | gov.uk |

### Pensions
| Item | 2026/27 | Status | Source |
|---|---|---|---|
| Annual Allowance | £60,000 | ENACTED | MoneyHelper; gov.uk |
| Tapered AA gateway | Threshold income >£200k; adjusted income >£260k | ENACTED | MoneyHelper |
| Taper | £1 per £2 over £260k; min £10,000 (at £360k+) | ENACTED | MoneyHelper |
| MPAA | £10,000 | ENACTED | Royal London |
| Carry-forward | 3 prior years (up to £180k single-year theoretical) | ENACTED | Royal London |
| Lump Sum Allowance (tax-free cash) | £268,275 | ENACTED | gov.uk PTM (post-LTA) |
| LSDBA | £1,073,100 | ENACTED | gov.uk PTM |
| Tax-free cash % | 25% (capped at LSA) | ENACTED | gov.uk |
| Full new State Pension | £241.30/wk = £12,547.60/yr (4.8% triple-lock) | ENACTED | DWP 2026/27 rates |
| State Pension age | 66 (→67 from 2028) | ENACTED | gov.uk |
| NMPA | 55 → 57 from 6 Apr 2028 | ENACTED | gov.uk |

### ISA family
| Item | 2026/27 | Status | Source |
|---|---|---|---|
| ISA allowance | £20,000 | ENACTED | AJ Bell; gov.uk |
| Lifetime ISA | £4,000 (within £20k); 25% bonus; 25% exit penalty | ENACTED | gov.uk LISA |
| Junior ISA | £9,000 (separate) | ENACTED | AJ Bell |
| Cash-ISA cap £12k (under-65) | **from Apr 2027 — NOT in effect 26/27** | PROPOSED (Autumn Budget 2025) | bundle; Close Brothers |

### Inheritance Tax
| Item | 2026/27 | Status | Source |
|---|---|---|---|
| Nil-Rate Band | £325,000 (frozen to 2030/31) | ENACTED | gov.uk IHT |
| Residence NRB | £175,000 (frozen to 2030/31) | ENACTED | gov.uk |
| RNRB taper | £1 per £2 over £2m estate | ENACTED | gov.uk |
| Couple max (TNRB+TRNRB) | up to £1,000,000 | ENACTED | gov.uk |
| Standard / reduced rate | 40% / 36% (≥10% to charity) | ENACTED | gov.uk |
| Annual gift exemption | £3,000 (1-yr carry-forward) | ENACTED | gov.uk |
| Small gifts | £250/recipient | ENACTED | gov.uk |
| Wedding gifts | £5,000 / £2,500 / £1,000 | ENACTED | gov.uk |
| PET 7-year rule + taper | 0–3yr full; 3–7yr taper 20/40/60/80% reduction | ENACTED | gov.uk |
| CLT entry charge | 20% above NRB | ENACTED | gov.uk |
| **Unused pensions into estate** | **6 Apr 2027** (DC pots + death benefits join estate) | ENACTED (legislated; effective 2027) | gov.uk; L&G; M&G |
| Combined APR/BPR allowance | £2.5m (100% within / 50% above), from Apr 2026, frozen to Apr 2031 | ENACTED (FA 2026) | bundle; gov.uk |
| AIM BPR | 50% (was 100%) from Apr 2026 | ENACTED | bundle; gov.uk |
| 10-year IHT residence test | replaced deemed domicile, Apr 2025 | ENACTED | gov.uk |
| Intestacy statutory legacy | £322,000 | ENACTED | gov.uk inherits-someone-dies-without-will |

### National Insurance
| Item | 2026/27 | Status | Source |
|---|---|---|---|
| Class 1 employee | 8% £12,570–£50,270; 2% above | ENACTED | gov.uk |
| Class 4 self-employed | 6% / 2% (same thresholds) | ENACTED | gov.uk |
| Class 2 | effectively abolished above SPT (£12,570) | ENACTED | gov.uk |
| Class 3 voluntary | £17.45/wk | ENACTED | gov.uk (verify weekly rate) |
| Employer (business users) | 15% above £5,000 secondary threshold | ENACTED | gov.uk |
| Employment Allowance | £10,500 | ENACTED | gov.uk |

### EIS / SEIS / VCT
| Item | 2026/27 | Status | Source |
|---|---|---|---|
| EIS income-tax relief | 30%; £1m limit (£2m knowledge-intensive); 3-yr hold; IHT-exempt after 2yr | ENACTED | gov.uk |
| EIS gross-asset limits | pre-issue £30m / post £35m (raised Apr 2026) | ENACTED | bundle; gov.uk (verify) |
| SEIS relief | 50%; £200k limit; 3-yr hold | ENACTED | gov.uk |
| VCT relief | **20%** (cut from 30% Apr 2026); £200k limit; 5-yr hold | ENACTED (FA 2026) | gov.uk; bundle |

### Property
| Item | 2026/27 | Status | Source |
|---|---|---|---|
| Section 24 | mortgage interest = 20% tax credit, not deduction | ENACTED | gov.uk |
| SDLT bands (England/NI) | 0% to £125k · 2% to £250k · 5% to £925k · 10% to £1.5m · 12% above | ENACTED | gov.uk SDLT |
| First-time buyer | 0% to £300k, 5% £300k–£500k (reverted Apr 2025) | ENACTED | gov.uk |
| Additional-property surcharge | 5% (from 31 Oct 2024) | ENACTED | gov.uk |
| Non-UK-resident surcharge | 2% | ENACTED | gov.uk |
| Rent-a-room relief | £7,500 | ENACTED | gov.uk |
| Property allowance | £1,000 | ENACTED | gov.uk |
| FHL regime | ABOLISHED Apr 2025 | ENACTED | gov.uk |

### Corporation Tax (business-owner context only)
| Item | 2026/27 | Status | Source |
|---|---|---|---|
| Small profits rate | 19% (≤£50,000) | ENACTED | gov.uk CT rates |
| Main rate | 25% (≥£250,000) | ENACTED | gov.uk |
| Marginal relief | tapers 19→25% between £50k–£250k | ENACTED | gov.uk |
| Director's loan s455 | 35.75% (linked to dividend upper rate) | ENACTED | gov.uk CTM61505 |

### Other
| Item | 2026/27 | Status | Source |
|---|---|---|---|
| Trading allowance | £1,000 | ENACTED | gov.uk |
| Marriage Allowance | £1,260 transfer | ENACTED | gov.uk |
| Gift Aid gross-up | 25% (reduces ANI) | ENACTED | gov.uk |
| FSCS deposit protection | £120,000 (from 1 Dec 2025); £240k joint | ENACTED | FSCS; bundle |
| HICBC | £60,000–£80,000 taper | ENACTED | gov.uk |
| MTD ITSA Phase 1 | gross income >£50k mandated Apr 2026 | ENACTED | gov.uk |

**Figures I could not fully confirm (verify before display):** Married Couple's Allowance exact 26/27 max/min figures (SI 2026/38 confirmed it was uprated, exact pounds not pinned here); Class 3 weekly rate £17.45 (bundle value, secondary-source consistent, not pinned to gov.uk page this pass); EIS gross-asset £30m/£35m (bundle says raised Apr 2026 — confirm commencement). Everything else above is gov.uk/HMRC/DWP-confirmed for 2026/27.

---

## §3 — "WHAT HAVEN'T I USED YET" INVENTORY (allowance headroom)

This is the founder's headline requirement and should be the top strip of the hub — a single horizontal "allowances remaining" gauge row, each segment tappable into its drawer. For each: the rule, whether unused headroom carries forward (most don't — use-it-or-lose-it by 5 April), and the lever it pulls.

| Allowance / relief | 26/27 cap | Carries forward? | Why it matters / lever |
|---|---|---|---|
| ISA allowance | £20,000 | No (resets 6 Apr) | Tax-free growth/income forever; lost at year end |
| Lifetime ISA | £4,000 | No | + 25% gov bonus (£1,000) if eligible |
| Junior ISA (per child) | £9,000 | No | Child's tax-free pot |
| Pension Annual Allowance | £60,000 | **Yes — 3 prior years** | Biggest carry-forward lever; tax relief at marginal rate; check taper/MPAA first |
| Dividend allowance | £500 | No | First £500 dividends tax-free |
| Personal Savings Allowance | £1,000 / £500 / £0 | No | Tax-free interest band |
| Starting rate for savings | £5,000 @ 0% | No | Only if non-savings income low |
| CGT annual exempt amount | £3,000 | No | "Bed & ISA"/spouse to use it; gone at year end |
| IHT annual gift exemption | £3,000 | **Yes — 1 prior year only** | £6,000 if last year unused; estate reduction |
| Small gifts exemption | £250/recipient | No | Unlimited recipients |
| Marriage Allowance | £1,260 transfer | Backdate 4 yrs (claim) | Up to £252 tax saving for couples |
| Gift Aid headroom | n/a (relief) | — | Reduces ANI → can reclaim PA / dodge HICBC |
| Trading / property allowance | £1,000 each | No | Tax-free side/rental income |
| Rent-a-room | £7,500 | No | Tax-free lodger income |
| EIS/SEIS/VCT subscription | £1m / £200k / £200k | EIS carry-back 1 yr | Income-tax relief (30/50/20%) — high risk, info only |
| Salary-sacrifice pension room | within AA | — (uses AA) | Saves employee + employer NI |
| Normal-expenditure-out-of-income | unlimited if genuine | — | Underused; gifts from surplus income immediately outside estate |

Display rule: show **remaining**, not just used (e.g. "£14,200 of £20,000 ISA left · 39 days to 5 April"). Pension AA tile must show the 3-year carry-forward stack, not just current year. Flag the two that *do* carry forward (pension AA, IHT annual exemption) distinctly — that's a genuine planning insight most users miss.

---

## §4 — HOW BEST-IN-CLASS TOOLS ORGANIZE THIS

**HMRC Personal Tax Account** — task-and-record oriented, not planning oriented. Top-level cards: Pay As You Earn (tax code + estimate), Self Assessment, National Insurance, State Pension, Marriage Allowance, Tax credits, Child Benefit. Lesson: HMRC groups by *HMRC process*, which is exactly the clutter to avoid — it's organized for the tax authority, not the citizen's mental model. Sonuswealth should group by *life domain* (income / property / estate), not by HMRC form.

**Voyant-style cashflow planners** — organize around the *person and time*, not the tax line. A single timeline projects income, expenditure, assets, liabilities, and overlays tax/IHT as a consequence layer. Tax & estate appears as "what this costs you over the plan" and "what your estate looks like at death", not as a list of allowances. Lesson: lead with the user's *position and trajectory* (estate-vs-threshold, lifetime tax drag), and make the allowance list a *drill*, not the front page.

**SA software (TaxCalc / FreeAgent / GoSimpleTax)** — organized by *return schedule* (employment, self-employment, property, dividends, capital gains, pensions). Clean because each schedule maps to one income source. Lesson: A1–A7 above mirror this schedule structure, which is both familiar to anyone who's filed and naturally non-overlapping.

**Estate-planning tools (Octopus/Whitehall, will-writers)** — organize estate around the *waterfall and the clock*: net estate → reliefs → IHT due → beneficiaries, plus the 7-year gift timeline. Lesson: B1's waterfall + B2's gift clock are the two signature visuals; keep them central.

**Good IA synthesis for Sonuswealth:**
1. **One headroom strip up top** ("what you haven't used") — answers the founder requirement and gives an immediate reason to engage.
2. **Two realms (Tax | Estate)** as the primary toggle — already built, keep it.
3. **Drawers, not a flat tile wall** — collapse the current long scroll into ~6 tax + ~6 estate labelled drawers, closed by default, opened on tap. This directly fixes the "cluttered" complaint: the user sees ~12 calm labels, not ~30 tiles.
4. **Dynamic visibility** — hide drawers with no underlying data (no business → no A7; Foundation life-stage → estate collapses to Will & LPA).
5. **Each tile drills to: the number → the rule + legal source + status → plain-English formula → "what you could do" (info/guidance, never a product) → related hops.** This is the existing "drill panels are knowledge halls" pattern; the taxonomy just gives it a clean shelf to live on.
6. **Signature visuals per realm:** Tax = stepped marginal-rate chart + allowances strip; Estate = IHT waterfall + 7-year gift clock + pension-2027 forward marker.

---

## §5 — 10-LINE SUMMARY

1. Proposed structure: a top **"What you haven't used"** allowance strip, then two realms.
2. **TAX realm drawers:** A1 Income & Income Tax · A2 National Insurance · A3 Savings & Dividends · A4 Capital Gains · A5 Self-Assessment & Filing (storage, not filing) · A6 Property/Landlord (dynamic) · A7 Business-Owner (dynamic).
3. **ESTATE realm drawers:** B1 Inheritance Tax · B2 Gifts & 7-Year Clock · B3 Business/Agricultural Relief (dynamic) · B4 Trusts (dynamic) · B5 Wills/LPA/Succession · B6 Pensions & Estate (bridge).
4. **Cross-cutting:** C1 Residency/Domicile/Overseas (dynamic); Charitable Giving folded into A3/B1.
5. Fixes "cluttered" by collapsing ~30 flat tiles into ~12 labelled, closed-by-default, dynamically-hidden drawers.
6. Most figures gov.uk/HMRC/DWP-confirmed for 2026/27 and match the engine bundle.
7. **Bundle correction found:** Blind Person's Allowance is £3,250 (26/27), bundle has £3,070; Married Couple's Allowance missing from bundle entirely — flag to engine owner.
8. **Couldn't fully pin (verify):** exact 26/27 Married Couple's Allowance £ figures; Class 3 weekly £17.45; EIS £30m/£35m gross-asset commencement.
9. Headline forward event to feature prominently: **DC pensions enter the IHT estate from 6 April 2027** (post-75 combined rate can exceed 67%).
10. IA lesson from best-in-class: organize by **life domain + trajectory** (Voyant/SA-schedule model), not by HMRC process (the PTA clutter trap).
