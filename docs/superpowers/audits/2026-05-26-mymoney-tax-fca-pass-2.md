# MyMoney — Pass-2 Tax & FCA Audit (Mr T Core)

**Date:** 2026-05-26 · **Persona:** mrt-core (35yo director, salary £12,570 + dividends £38k + rental £15k gross / £9.8k net)
**Reviewer:** UK Chartered Accountant (ICAEW/ATT/CTA) + FCA compliance
**Live URL:** http://localhost:5174/?demo=mrt-core&tab=money (DOM captured 2026-05-26)
**Authority:** UK-2026.1.1 bundle · `canonical-metrics.js` · `_helpers.js::annualIncome`

---

## CRITICAL (block ship)

### F1 — Income double-count breaks marginal-rate inference for every director persona
**Surface:** All COW lines · ANI £78k panel
**File:** `src/engine/_helpers.js::annualIncome` (lines 228–242)
**Bug:** `annualIncome` adds *both* `individual.gross_salary` (£12,570) AND `income.employment` (£12,570) AND `income.dividends` (£38k) AND `income.rentalIncome` (£15k) → returns £78,140. Salary counted twice. Persona schema deliberately mirrors salary in both fields for backwards compatibility — engine must take MAX, not SUM.
**Knock-on:** Mr T flips from basic-rate (real NSND income £27,570) to higher-rate in `marginalRate()`. This poisons: pension relief CoI, S24 drag, cash interest tax, ANI panel header.
**Fix:** `total += Math.max(+ind.gross_salary || 0, +inc.employment || 0, +inc.salary || 0)` then add dividends/rental/other once.

### F2 — Pension CoW £10.1k is mathematically wrong for Mr T
**Surface:** PENSIONS tile — "£10.1k of pension tax relief available this tax year (capped by relevant earnings) (deadline 5 April)"
**File:** `canonical-metrics.js::coiForDomain('pensions')` lines 302–337
**Math:** Cap correctly set to relevant earnings £12,570. Used = £0 (no `annual_contribution` field set on any pension in persona — schema gap). Headroom £12,570 × marginalRate(40% wrong, should be 20%) = £5,028 (and even that overstates real economic relief — a personal contribution of £12,570 gross by a basic-rate payer gets 0% additional relief beyond the relief-at-source 20%, because Mr T's NSND tax is exhausted by PA).
**Real CoW for Mr T director:** salary route is dead — **employer contribution via the Ltd Co** is the live planning path (CT-deductible, no NI, AA cap £60k, no relevant-earnings cap because contributions go in pre-tax via the company). Engine ignores this entirely. Spec MyMoney v2.7 §2.3 expects director path to be surfaced.
**Fix:** Detect `persona.flags.includes('director')` → switch CoW to employer-contribution framing with CT saving calc (£60k × 25% small-profits CT = £15k CT relief). Hide personal-contribution number when relevant earnings < £15k.

### F3 — Property S24 CoW £1.4k/yr inflated because of F1
**Surface:** PROPERTY tile — "£1.4k/yr in extra tax because mortgage interest no longer fully offsets rental income"
**Math:** BTL interest £124k × 5.4% = £6,696. Engine applies S24 drag = interest × (marg − basic) = £6,696 × (40% − 20%) = £1,339 ≈ £1.4k. With correct marg (Mr T sits in basic rate on NSND), drag = £0. The line should disappear entirely or pivot to: "Rental income £15k gross taxed at 20% basic; £1.3k tax credit on mortgage interest fully offsets the IT on interest at your current rate. Watch for higher-rate threshold."
**Citation:** ITA 2007 s274A; HMRC PIM2054.

### F4 — Cash interest tax £712/yr triple-counted
**Surface:** CASH tile — "£712/yr in interest tax"
**Math:** `cashTotal()` reads `assets.cash.total £28,500` AND `assets.bank[]` (£6,200 + £14,800 + £7,500 = £28,500) → returns £57,000. Tile header shows £29k. Engine uses £57k × 4% = £2,280, − PSA £500 (higher band, wrong) = £1,780 × 40% = £712. Every number wrong: cash double-counted, PSA wrong band, rate wrong (Mr T basic 20% on £29k × 4.5% − £1,000 PSA = £61/yr real).
**Fix:** `cashTotal` should resolve duplication (sum bank[] OR cash.total, not both); PSA selection must use marginalRate().

---

## HIGH

### F5 — Bond chargeable-gain mechanics absent
**Surface:** SAVINGS & INVESTMENTS tile — Onshore bond £22k (15%) + Offshore bond £19k visible only as percentage chips.
**Gap:** Persona has `withdrawal_5pct_used_pct` (0.4 onshore, 0.2 offshore) — engine has the data, screen surfaces nothing. Onshore bond chargeable-event gain top-slicing relief (ITTOIA 2005 s535) and offshore bond no-credit treatment never appear. For Mr T, taking >5%/yr from the onshore bond would trigger a chargeable event taxed at marginal rate above basic-rate band — material planning fact.
**Fix:** Add CoW line conditional on bonds present: "Onshore bond — you've used 40% of the 5% tax-deferred allowance. Cumulative excess withdrawals would be a chargeable event taxed at your marginal rate above basic (top-slicing relief may apply)."

### F6 — EIS/SEIS/VCT income tax relief invisible
**Surface:** SAVINGS tile shows EIS £15k / VCT £13k / SEIS £8k as bar segments. ALTERNATIVES £28k tile blank below the value.
**Gap:** `income_tax_relief_claimed`: EIS £4,500 + SEIS £4,000 + VCT £3,750 = £12,250 already banked, not displayed. Two-year hold to IHT exemption status, three-year (EIS/SEIS) / five-year (VCT) minimum hold, withdrawal-of-relief-on-early-exit mechanic — none surfaced.
**Fix:** Domain CoW for tax-advantaged investments: "EIS Octopus Titan — 3-yr minimum hold runs to 2027 · IHT-exempt after 2 years (Apr 2026) · withdrawing relief if sold early"; analogous lines for SEIS/VCT. Citation: ITA 2007 Pt 5 (EIS), Pt 5A (SEIS), Pt 6 (VCT).

### F7 — BPR £58k figure correct but headline copy violates FCA boundary
**Surface:** BUSINESS ASSETS tile — "Tax-free to your heirs after 2 years of qualifying ownership · Inheritance tax fully sheltered: £58k saved at current values · **protect the 2-year qualifying hold**"
**Math:** £145k × 40% = £58k ✓ (within £2.5m allowance from 6 Apr 2026, UK-BPR-02). Two-year hold ✓.
**Compliance:** "protect the 2-year qualifying hold" is imperative and presumes the user *should* protect it — that's a recommendation. Reframe: "BPR qualifies after 2 years held continuously. Disposal restarts the clock."
**Citation:** IHTA 1984 s105–106.

---

## MEDIUM — FCA boundary sweep

| Surface | Wording | Issue | Fix |
|---|---|---|---|
| PENSIONS panel header | "PENSION HEADROOM £41k · **Contribute now** for 40%+ tax relief at your rate" | Imperative + personal rate = personal recommendation under COBS 9A.2.4R | "Annual allowance unused: £41k. Contributions inside AA receive tax relief at your marginal rate." |
| TAX & ALLOWANCES panel | "This allowance resets 6 April · unused room **disappears forever**" | Urgency-as-advice; flagged in engine memo BLOCK-3 yet still rendered | "ISA allowance is annual — unused capacity does not carry forward." |
| CoST OF DOING NOTHING header | "**act on rank 1 first**" | Imperative direction | "Severity ranking — highest annual £ impact at the top." |
| SAVINGS CoW | "£0.2k/yr of tax saved if you **shelter** £10k into your ISA" | "shelter into" is borderline action verb. Engine BLOCK-3 already reframed this — keep watch. | Acceptable as mechanic statement; consider "if £10k were held inside the ISA wrapper". |
| LIABILITIES rows | Credit card 24.7% APR shown but no copy on prioritisation | Not a violation but missed signal | Optional informational chip: "Highest-rate debt: snowball/avalanche mechanics — not a recommendation." |

---

## MEDIUM — Tax accuracy details

### F8 — Dividend allowance bar unreadable at 7,600% utilisation
**Surface:** "Tax-free dividends £38k / £500"
**Issue:** Bar visualization implied "used £38k of £500" — not meaningful. Missing the c.£4,031 dividend tax computation (£500 free + £37,500 × 10.75% basic-rate dividend rate 2026/27 = £4,031). Director-extraction planning relies on showing this number.
**Fix:** Cap bar at 100% with overflow indicator; add Dividend Tax computed: "£4.0k dividend tax estimated at 10.75% basic-rate dividend band (Finance Act 2026 s23)".

### F9 — Director-extraction planning absent from Cashflow section
**Surface:** MONTHLY CASH FLOW
**Gap:** £7k/mo income shown without breakdown across salary (£1,048/mo) vs dividend (£3,167/mo) vs rental (£817/mo). For a director persona, the salary–dividend–pension-contribution split is the #1 planning surface. Mr T currently extracts £12,570 salary + £38k dividends + zero pension — the highly suboptimal default. Scenario `scen-corporate-pension` exists in persona JSON but is not surfaced.
**Fix:** Director persona unlock — extraction-mix breakdown tile with current CT/IT/NI cost and corporate-pension scenario hook to Cashflow tab.

### F10 — SIPP IHT exposure line accurate but materially understates
**Surface:** "315 days until SIPP joins IHT estate (exposure ~£67k at 40%)"
**Math:** £167,500 × 40% = £67k ✓. Effective date 6 April 2027 confirmed by Royal Assent 18 March 2026 (Finance Act 2026).
**Improvement:** Add the post-75 stacking note for completeness — IT on drawdown + IHT on residual stack effectively above 67% effective rate per bundle `pensionIHTInclusionNote`. Not urgent but completes the picture.

### F11 — "PLAN FUNDED 29%" no calculation transparency
**Surface:** Balance-sheet metric pill
**Issue:** Drillable but the 25× target is not stated alongside. Founder principle PP-3 (drillable to the nth degree).
**Fix:** Inline subtext: "29% of 25× annual essentials (£X target)".

---

## Severity summary

| # | Severity | Surface | Verdict | Fix lever |
|---|---|---|---|---|
| F1 | CRITICAL | All COW (income double-count) | Wrong | `_helpers.js::annualIncome` MAX vs SUM |
| F2 | CRITICAL | PENSIONS CoW £10.1k | Wrong | Director-employer pension path |
| F3 | CRITICAL | PROPERTY S24 £1.4k | Wrong | Fix F1, then S24 drag = £0 for Mr T |
| F4 | CRITICAL | CASH £712/yr | Wrong | `cashTotal` dedupe + PSA from marg |
| F5 | HIGH | Bond chargeable-gain absent | Missing | Bond domain CoW |
| F6 | HIGH | EIS/SEIS/VCT relief absent | Missing | Alt-investment CoW |
| F7 | HIGH | BPR copy ("protect the hold") | Boundary | Reframe descriptive |
| F8 | MED | Dividend bar 7,600% | UX + tax | Cap + add dividend tax computation |
| F9 | MED | Director extraction tile | Missing | Persona-flag unlock |
| F10 | MED | SIPP IHT exposure | Incomplete | Add post-75 stacking note |
| F11 | MED | PLAN FUNDED 29% | Drillability | Inline subtext |
| FCA | MED | "Contribute now / disappears forever / act on rank 1" | Boundary | Descriptive reframes per table |

---

## Net verdict
Pass 2 confirms the structural error (F1) cascades into 3 numerical COW lines (F2/F3/F4). Until `annualIncome` is fixed, every director persona has wrong marginal-rate inference and four headline tax numbers on MyMoney are wrong. Bond mechanics (F5) and EIS/SEIS/VCT relief (F6) are missing entire spec surfaces. FCA boundary breaches (F7 + table) are imperative-mood drift — fixable with descriptive reframes already proven in BLOCK-3.

**Last pass found 4 errors; pass 2 finds 11 (4 critical, 3 high, 4 medium) — the director persona is more complex than the engine assumes.**
