Title: Cashflow / Wealth-Surface Money-Event & Life-Event Taxonomy (UK)
Version: 1.0
Date: 2026-06-05
Status: DOCUMENTED
Cluster: 2-Product (Cashflow) + 3-Engine (decision/scenario engines)
File name: cashflow-scenario-research-2026-06-05.md
Purpose: Exhaustive, UK-specific catalogue of the money/life events that should drive decisions on the Cashflow & wealth surface, each with decisions, tax touchpoints, "what good looks like", common mistakes, and FCA-safe framing — so the product handles the full event space, not a handful of obvious cases.

**Summary:** 30 UK money/life events across 5 families (recurring-flow, lump-sum/windfall, planned-expense, life-stage, external-shock), each scored for impact/frequency, mapped to either the existing priority-selector→scored-options→recommended engine pattern (surplus-allocation.js / decision-engine.js / scenario-engine.js / goal-engine.js) or flagged as needing NEW engine logic.
**Tags:** #cashflow #engine #decisions #uk-tax #scenarios #life-events
**Updated:** 2026-06-05

> **Figures discipline.** Every £ threshold below (IHT NRB/RNRB, ISA £20k, pension AA £60k/MPAA £10k, CGT AEA £3k, BADR lifetime £1m & rate, LSA £268,275, redundancy £30k, marriage allowance £1,260, etc.) is named for *context only*. In product, all figures come from the rules bundle (`src/engine/_bundle.js` → `TAX`, `rules-uk.js` status fields). Never hardcode. The 2027 SIPP-IHT flip is ENACTED (Royal Assent 18 Mar 2026, effective 6 Apr 2027) per memory `project_sipp_iht_enacted_2026.md`.

> **FCA stance (applies to every event).** Information & guidance, never advice. Each option is framed as *"here is the factual tax/access/risk consequence of this path"*, never *"buy X"* or *"you should"*. Mirrors the live boundary copy in `surface-allocation.js` and `decision-engine.js`. A product recommendation is permissible as *"the best-fit option for the priority you stated"* with the priority surfaced, not hidden.

---

## 0. PRIORITY / IMPACT RANKING

Impact = size of the financial swing if handled well vs badly. Frequency = how often a typical UK user hits it across a lifetime. Engine-fit = how cleanly it maps onto the existing `priority-selector → scored options → recommended` pattern.

| # | Event | Family | Impact | Frequency | Engine fit | Notes |
|---|---|---|---|---|---|---|
| 1 | **Persistent surplus — where to deploy** | Recurring | High | Very high | ✅ EXISTS (`surplus-allocation.js`) | The flagship. Already built. |
| 2 | **Persistent deficit — how to close** | Recurring | High | High | 🔶 ADAPT (mirror of #1) | Inverse selector: which lever closes the gap. |
| 3 | **Approaching/entering retirement (decumulation start)** | Life-stage | Very high | High | ✅ EXISTS (`decumulation-solver.js`, `goal-engine.js`) | Biggest single decision cluster. |
| 4 | **Redundancy payment** | Windfall | High | Medium | ✅ FITS pattern | £30k rule + pension carry-forward; clean scored-options. |
| 5 | **Inheritance windfall** | Windfall | Very high | High | 🔶 ADAPT + NEW | Multi-asset; inherited pension/ISA-APS/CGT-uplift each need logic. |
| 6 | **Tax-year-end (use-it-or-lose-it)** | External | Medium-High | Annual | 🔴 NEW (allowance-sweep engine) | Recurring deadline; allowance gap detector. |
| 7 | **Bonus / income rise** | Windfall/Recurring | Medium-High | High | ✅ FITS pattern | Same selector as surplus + cliff-edge (£100k taper, £60k HICBC). |
| 8 | **Bereavement — death of spouse** | Life-stage | Very high | Medium | 🔴 NEW (entity-merge + checklist) | Spousal exemption, TNRB, APS, pension nomination, income reshape. |
| 9 | **Pension tax-free lump sum (PCLS) decision** | Windfall | High | Medium | ✅ FITS (`decision-engine.js` DE-01) | Lump vs phased; LSA cap; MPAA trigger. |
| 10 | **Business sale (exit)** | Windfall | Very high | Low | 🔶 ADAPT + NEW | BADR timing/anti-forestalling; £1m lifetime cap; reinvest. |
| 11 | **Share-scheme vesting (RSU/EMI/SAYE)** | Windfall | Medium-High | Medium | 🔶 ADAPT + NEW | Sell-to-cover vs hold; Section 104 pool; bed & ISA. |
| 12 | **Market crash (in/near drawdown)** | External | Very high | Medium | 🔴 NEW (sequence-risk guard) | Pound-cost ravaging; cash-buffer / spend-flex levers. |
| 13 | **New child** | Life-stage | Medium | High | 🔶 ADAPT (checklist + selector) | HICBC, JISA, protection gap, will, budget reshape. |
| 14 | **Divorce / separation** | Life-stage | Very high | Medium | 🔴 NEW (split + offset model) | Pension sharing vs offset; no-gain/no-loss window. |
| 15 | **House deposit goal** | Planned-expense | High | High | ✅ EXISTS (`goal-engine.js` house_deposit) | LISA, de-risk-as-date-nears glide. |
| 16 | **Income fall (not redundancy)** | Recurring | Medium-High | Medium | 🔶 ADAPT (#2 deficit) | Reduce contributions, buffer drawdown, restructure. |
| 17 | **Interest-rate change** | External | Medium | Medium | 🔴 NEW (rate-sensitivity scan) | Remortgage vs overpay vs save; debt-vs-invest re-score. |
| 18 | **Budget rule change** | External | Medium-High | ~Annual | 🔴 NEW (rules-diff propagator) | Re-run affected events when bundle changes. |
| 19 | **Starting a business** | Life-stage | Medium-High | Low-Med | 🔶 ADAPT | Salary/dividend mix, buffer, protection, pension via company. |
| 20 | **New job** | Life-stage | Medium | High | ✅ FITS pattern | Pension match, salary-sacrifice, share scheme opt-in. |
| 21 | **Marriage / civil partnership** | Life-stage | Medium | Medium | 🔶 ADAPT (merge-lite) | Marriage allowance, spousal exemption, joint planning, ISA/CGT inter-spouse transfers. |
| 22 | **Divorce settlement received (cash)** | Windfall | High | Medium | 🔶 ADAPT (#5/#1) | Re-deploy lump; rebuild pension after sharing. |
| 23 | **Serious illness / loss of capacity** | Life-stage | High | Medium | 🔴 NEW (protection + LPA gap) | Critical-illness/IP gap, LPA, care reserve. |
| 24 | **Inheritance windfall in retirement** | Life-stage | High | Medium | 🔶 ADAPT (#5 + decumulation) | IHT-on-IHT; gift-down vs spend-down post-2027. |
| 25 | **Downsizing proceeds** | Windfall | Medium-High | Low-Med | 🔶 ADAPT (#1/#5) | RNRB downsizing addition; deploy lump. |
| 26 | **Maturing investment / bond / fixed-term** | Windfall | Medium | Medium | ✅ FITS (#1) | Reinvest selector; chargeable-event gain on bonds. |
| 27 | **Life-insurance / compensation payout** | Windfall | Medium-High | Low | 🔶 ADAPT (#1/#5) | Usually tax-free; trust-vs-estate; deploy. |
| 28 | **Big planned purchase (car, wedding, trip, renovation)** | Planned-expense | Medium | High | ✅ EXISTS (`goal-engine.js` big_purchase) | Save-vs-borrow; date-glide. |
| 29 | **School / university fees** | Planned-expense | High | Medium | ✅ EXISTS (`goal-engine.js` education_fund) | Long-horizon goal; grandparent gifting route. |
| 30 | **Emigration / becoming non-resident** | Life-stage | High | Low | 🔴 NEW (residence-aware re-base) | Temporary-non-residence CGT/pension claw-back; SRT. |

**Top 8 to build first** (impact × frequency × engine-fit): **#1 surplus (done), #3 retirement, #4 redundancy, #5 inheritance, #6 tax-year-end, #7 bonus/income-rise, #2 deficit, #9 PCLS.** These four map *cleanly* onto the existing pattern with little/no new engine: **#4 redundancy, #7 bonus, #9 PCLS, #26 maturing investment** (all are "lump arrives → score the homes → recommend", a direct re-skin of `surplus-allocation.js`/`decision-engine.js`). The ones needing genuinely NEW engine logic: **#6 (allowance-sweep), #8 (bereavement entity-merge), #12 (sequence-risk guard), #14 (divorce split/offset), #17 (rate-sensitivity), #18 (rules-diff), #23 (protection/LPA gap), #30 (residence re-base).**

---

# FAMILY 1 — RECURRING-FLOW EVENTS

## 1. Persistent surplus — where should my next £1 go?
**(a) What it is.** Income consistently exceeds outgoings for several months; the question is deployment, not whether one exists. Already implemented in `src/engine/surplus-allocation.js` (priority `grow|flex|derisk` → factor weights → scored candidate homes → recommended waterfall allocation).
**(b) Key decisions.** (1) Clear high-interest debt vs invest? (2) Top up emergency buffer to ~6 months? (3) Pension (relief now, locked) vs ISA (flexible) vs GIA (taxed)? (4) Claim full employer match first? (5) How much to each, in what order?
**(c) Tax / allowance touchpoints.** Pension AA (£60k) + carry-forward + marginal-rate relief; ISA allowance (£20k); CGT AEA (£3k) for GIA; the £100k personal-allowance taper and 60% effective band; employer match = guaranteed uplift; high-interest debt clearance = guaranteed tax-free "return".
**(d) What good looks like.** Waterfall: (i) clear debt costing more than expected investment return, (ii) emergency buffer to floor, (iii) full employer match, (iv) then ISA vs additional pension by marginal rate and access need — pension wins for higher-rate; ISA wins on flexibility (kaeltripton, 2026). Surface the *why* and the trade-offs.
**(e) Common mistakes.** Leaving surplus in a current account earning nothing; over-paying low-rate mortgage while ignoring pension relief; investing before clearing a credit card; not claiming employer match.
**(f) FCA framing.** "Here's where your spare £X/month could go and what each does to your tax, access and growth — scored on the priority you picked. Not a recommendation to buy any product." (Live copy already in module.)
**Impact: HIGH · Frequency: VERY HIGH.**

## 2. Persistent deficit — how do I close the gap?
**(a) What it is.** Outgoings exceed income persistently (the inverse of #1). Note the engine gotcha (memory `reference_cashflow_engine_gotchas.md`): `monthlySurplus` clamps surplus ≥ 0, so read NET = surplus − deficit or Home/Cashflow disagree.
**(b) Key decisions.** (1) Cut discretionary vs essential spend? (2) Pause/reduce pension or savings contributions (and the relief lost)? (3) Draw from buffer (and how to refill)? (4) Restructure debt (refinance/consolidate)? (5) Increase income (side income, benefits check)?
**(c) Tax / allowance touchpoints.** Pausing pension contributions forfeits relief + employer match; benefits entitlement (UC, Child Benefit); debt interest is not deductible for individuals; marriage allowance (£1,260) if one spouse underuses personal allowance.
**(d) What good looks like.** Close the gap in the *least-damaging order*: discretionary spend → refinance expensive debt → temporary contribution pause (keep employer match) → buffer as last resort. Protect the long-term engine (pension match) before short-term comfort.
**(e) Common mistakes.** Funding lifestyle on credit; stopping the matched pension first; ignoring benefits; raiding the emergency buffer with no refill plan.
**(f) FCA framing.** "These levers each close £X of the gap — here's what each costs you elsewhere (lost relief, lost match, higher interest)." Rank by least damage, user chooses.
**Impact: HIGH · Frequency: HIGH.** Engine: mirror of #1 — same scored-lever pattern, sign flipped.

## (2b) Income rise / fall (sub-events of recurring-flow)
**Income rise** → routes to #7 (bonus/surplus) plus cliff-edge checks (£100k taper, £60k–£80k HICBC). **Income fall** → routes to #2 with the additional question of whether it's temporary (ride the buffer) or structural (reset the plan). Both should re-run the surplus/deficit selector automatically when the canonical income changes — this is exactly what `scenario-engine.js` TEST mode does (pin the income lever, re-measure everything).

---

# FAMILY 2 — LUMP-SUM / WINDFALL EVENTS

## 4. Redundancy payment
**(a) What it is.** Termination package = statutory/enhanced redundancy pay + holiday pay + PILON + possibly bonus. First £30k of the *genuine redundancy* element is income-tax & NI free; the excess is fully taxable and sits high in the order of taxation (Aberdeen techzone; GOV.UK).
**(b) Key decisions.** (1) How much of the taxable excess to redirect into pension to avoid income tax? (2) Hold cash as a runway vs invest? (3) If over 55, bridge into early retirement with existing pots? (4) Recover personal allowance / child benefit by dropping ANI below £100k/£60k? (5) Spouse pension contribution if own relevant earnings insufficient?
**(c) Tax / allowance touchpoints.** £30k exemption (excluded from *relevant UK earnings* — Royal London adviser); only the excess above £30k counts as relevant earnings for personal pension relief; pension AA £60k + 3-yr carry-forward; employer can pay PILON/excess straight to pension with no PAYE/NIC (but PENP rules — Lewis Silkin); dropping ANI below £100k restores the personal allowance (≥60% effective relief).
**(d) What good looks like.** Model how long the payout funds living costs; sacrifice the taxable excess into pension where affordable to neutralise income tax and rebuild allowances; keep a cash runway; if 55+, treat as a potential bridge (Charles Stanley).
**(e) Common mistakes.** Treating the whole sum as tax-free; spending the lump then facing a January tax bill; over-contributing beyond relevant earnings (only excess-over-£30k counts); locking away cash needed for the job gap.
**(f) FCA framing.** "Of your £X package, ~£30k is tax-free and £Y is taxable. Redirecting £Z into a pension would remove income tax on it and lock it until 57 — here's the runway each choice leaves you." No product named.
**Impact: HIGH · Frequency: MEDIUM. CLEAN ENGINE FIT** — lump → scored homes (cash runway / pension / ISA) with a tax-saving overlay.

## 5. Inheritance windfall
**(a) What it is.** Receipt of cash, property, pensions, ISAs, shares from an estate. IHT is paid *by the estate* before you receive — the recipient generally does not pay income tax on the capital. The decisions are about *what to do with it* and the *embedded tax features* of each inherited asset.
**(b) Key decisions.** (1) Deploy lump (debt/buffer/pension/ISA) — routes to #1. (2) Inherited ISA: if surviving spouse, claim **APS** (extra allowance = value at death, on top of £20k) to re-shelter (GOV.UK APS guidance; cash-ISA cuts from Apr 2027 make APS more valuable). (3) Inherited investments/property: note the **CGT base-cost uplift** to market value at date of death (s62 TCGA) — sell soon = little/no CGT (uktaxdrag; Farra). (4) Inherited pension: pre-6 Apr 2027 often outside IHT and under-75 tax-free to beneficiary; **post-2027 unused DC pensions enter the estate** (Farrer) — changes the keep-vs-draw calculus. (5) Use a Deed of Variation (within 2 yrs) to redirect for IHT/family efficiency.
**(c) Tax / allowance touchpoints.** Spousal exemption (unlimited between spouses/CPs); APS; CGT uplift; inherited-pension income-tax treatment by age-at-death (pre/post 75) and the 2027 estate-inclusion flip; income tax on any post-death income (rent, interest) before distribution.
**(d) What good looks like.** Don't rush; park in cash short-term, then deploy per #1. Spouse: claim APS to lock the tax shelter. Use the CGT uplift window. Re-examine "spend non-pension first" — post-2027 the old rule reverses (Farrer; kaeltripton).
**(e) Common mistakes.** Letting an inherited ISA lose its shelter (not claiming APS); holding inherited shares for years then paying CGT on post-death growth that the uplift could have avoided if sold early; assuming an inherited pension is always tax-free (age-75 and 2027 rules); leaving the windfall idle.
**(f) FCA framing.** "Here's what each inherited asset carries with it — the ISA can be re-sheltered via APS, these shares were re-based at the date of death, this pension's treatment depends on the 2027 rules. Here's the consequence of holding vs selling vs deploying." Storage/info, never "invest in fund X".
**Impact: VERY HIGH · Frequency: HIGH.** Engine: deploy = #1; the *inherited-asset features* (APS, CGT uplift, pension flip) are NEW per-asset logic.

## 9. Pension tax-free lump sum (PCLS / UFPLS) decision
**(a) What it is.** At 55 (57 from 2028) a DC saver can take up to 25% tax-free — as a single PCLS up front (rest into drawdown, 100% taxable) or via UFPLS (each chunk 25% tax-free / 75% taxable), capped by the LSA (£268,275). Already partly modelled in `decision-engine.js` DE-01.
**(b) Key decisions.** (1) Take all 25% now vs phased? (2) PCLS-only (does **not** trigger MPAA) vs any taxable drawdown (**triggers MPAA**, AA drops to £10k for life — retirementexpert). (3) Use lump to clear mortgage / fund the 60–67 bridge? (4) Leave 25% untouched for flexibility/inheritance?
**(c) Tax / allowance touchpoints.** 25% tax-free; LSA cap; MPAA trigger on first taxable payment/UFPLS; emergency-tax on first withdrawal; income-tax banding of the taxable 75%; post-2027 IHT inclusion of unused pot.
**(d) What good looks like.** Take only what's needed; phased UFPLS to spread the taxable 75% across bands; take PCLS-only if still contributing heavily (preserve £60k AA); use tax-free cash for the State-Pension bridge (pensionbible).
**(e) Common mistakes.** Taking the full 25% with no use for it (loses tax-free growth, may waste it in cash); triggering MPAA while still wanting to pension a future bonus/redundancy; emergency-tax shock; ignoring the LSA cap.
**(f) FCA framing.** "Taking £X now is tax-free but triggering taxable drawdown caps future pension saving at £10k/yr. Here's the lifetime-tax and flexibility consequence of each route." 
**Impact: HIGH · Frequency: MEDIUM. CLEAN ENGINE FIT** (DE-01 already exists; extend with MPAA/LSA/phasing).

## 10. Business sale (exit)
**(a) What it is.** Disposal of a trading company/sole-trade/partnership interest. BADR cuts CGT on the first £1m of qualifying *lifetime* gains; rate **14% (to 5 Apr 2026) → 18% (from 6 Apr 2026)** (GOV.UK HS275; Brodies). Anti-forestalling rules block artificial pre-rate-change disposals.
**(b) Key decisions.** (1) Timing relative to 6 Apr 2026 (14% vs 18%) and tax-year (defer CGT payment up to 12 months). (2) Qualify for BADR — 5% holding + officer/employee + 2-yr trading, at date of disposal (BDO). (3) Use *both spouses'* £1m limits where jointly held (Saffery). (4) Reinvest proceeds: pension carry-forward, then deploy per #1. (5) Consider BPR/IHT planning on retained value (Brodies).
**(c) Tax / allowance touchpoints.** BADR rate & £1m lifetime cap; standard CGT 18%/24% above it; anti-forestalling for unconditional contracts; claim deadline (31 Jan, ~22 months after tax-year end); spousal limit doubling; BPR transition.
**(d) What good looks like.** Plan ≥2 years ahead to secure eligibility; don't accelerate an exit purely to save the diminished 4-point rate if it harms the deal (max saving now ~£60k vs £140k pre-2025 — Brodies); spread gains/use both limits; reinvest into pension + diversified holdings (concentration risk gone).
**(e) Common mistakes.** Losing BADR by dropping below 5% or changing role before sale; missing the 2-yr/3-yr windows; assuming the old 10% rate; concentration risk by leaving wealth tied up; missing the claim deadline.
**(f) FCA framing.** "Selling before vs after 6 Apr changes the BADR rate from 14% to 18%; here's the tax difference and the eligibility conditions. After sale, here's where the proceeds could go." Never "structure the deal as…".
**Impact: VERY HIGH · Frequency: LOW.** Engine: timing/eligibility = NEW; reinvest = #1.

## 11. Share-scheme vesting (RSU / EMI / SAYE / Sharesave)
**(a) What it is.** Equity comp crystallising. **RSU**: value at vest = employment income, taxed via PAYE + NI (TaxRadar). **EMI/SAYE**: tax-advantaged — usually no income tax on exercise if conditions met (GOV.UK HS305). **CGT** applies later on gain *above* the vest/exercise value, using the **Section 104 pool** average cost (salarytax; CompVerdict).
**(b) Key decisions.** (1) Sell-to-cover vs sell-all vs hold? (2) Diversify (single-stock concentration risk) vs hold for upside? (3) Bed & ISA / bed & pension to shelter from future CGT. (4) Spread sales across tax years to use multiple £3k AEAs. (5) S431 election where restrictions remain (TaxRadar).
**(c) Tax / allowance touchpoints.** Income tax + NI at vest (RSU); CGT on post-vest gain; Section 104 pooling across tranches; £3k AEA; same-day & 30-day bed-&-breakfast rules; SA registration if disposals > £50k or gains > AEA.
**(d) What good looks like.** Sell enough to cover tax + reduce concentration (advisers commonly say keep single-stock < ~10–20% of wealth); immediately move proceeds into ISA/pension; track cost basis per tranche; use the AEA each year.
**(e) Common mistakes.** Spending the gross value then facing a January bill (employer didn't withhold enough); holding a large single-stock position out of loyalty; mis-tracking the Section 104 pool across years; missing SA filing triggers.
**(f) FCA framing.** "At vest you owe income tax/NI on £X; selling now realises little/no CGT, holding exposes you to single-company risk and future CGT above your £3k allowance. Here's each path's consequence." No "sell" instruction.
**Impact: MEDIUM-HIGH · Frequency: MEDIUM.** Engine: tax-at-vest + Section 104 = NEW; deploy = #1.

## 22 / 25 / 26 / 27 — Other lump-sum sub-events (compressed; all route to #1 + a tax overlay)
- **#22 Divorce settlement (cash received).** Usually capital, not taxable income. Rebuild pension if a sharing order reduced yours; deploy per #1. Watch: temptation to over-spend the lump.
- **#25 Downsizing proceeds.** Sale of main home is CGT-exempt (PRR). **RNRB downsizing addition** can preserve the residence band if you've moved to a less valuable home/no home. Deploy per #1; consider gifting (7-yr PET) for IHT.
- **#26 Maturing investment / bond / fixed term.** Reinvest selector (#1). **Investment bonds**: chargeable-event gain taxed via top-slicing; 5%/yr tax-deferred withdrawals. Fixed-rate savings maturing → sweep to best rate / ISA before tax-year-end (#6).
- **#27 Life-insurance / compensation payout.** Life policies in trust pay outside the estate (no IHT, no probate delay); on own life not in trust → into estate. Most personal-injury compensation is tax-free. PPI/mis-selling redress may carry taxable interest. Deploy per #1/#5.

---

# FAMILY 3 — PLANNED-EXPENSE / GOAL EVENTS

These map directly onto `goal-engine.js` (`house_deposit`, `education_fund`, `big_purchase`) — taxonomy already present; the work is data-wiring + the de-risk-as-date-nears glide constraint.

## 15. House deposit
**Decisions:** save vs invest by horizon; **LISA** (£4k/yr, 25% govt bonus, but counts toward £20k ISA and has withdrawal penalty outside first-home/age-60); de-risk as completion nears; gift from family (PET). **Tax:** LISA bonus, ISA shelter, SDLT first-time-buyer relief, gift 7-yr rule. **Good:** money needed < ~5 yrs → low-risk/cash, not equities; max LISA bonus if eligible. **Mistakes:** investing a 2-yr deposit in equities; LISA penalty on non-qualifying withdrawal. **Impact: HIGH · Freq: HIGH.**

## 28. Big planned purchase (car, wedding, big trip, home renovation)
**Decisions:** save vs finance (0% vs cash); timing vs other goals; how much to ring-fence. **Tax:** minimal; keep within ISA/cash; gift exemptions for wedding (parents £5k, grandparents £2.5k, others £1k). **Good:** date-glide to cash; don't derail higher-priority goals (lexicographic ordering in `goal-engine.js`). **Mistakes:** raiding pension/long-term ISA for a depreciating asset; expensive finance when cash available. **Impact: MEDIUM · Freq: HIGH.**

## 29. School / university fees
**Decisions:** long-horizon investment vs cash; **grandparent route** (gifts out of surplus income are immediately IHT-exempt — a powerful school-fee strategy, Farrer); JISA for the child; bursary/loan interplay. **Tax:** gifts-from-surplus-income exemption, JISA £9k, IHT planning via education funding. **Good:** start early, invest the long-horizon portion, de-risk near each fee date; use grandparent surplus-income gifting. **Mistakes:** under-estimating total cost; cash-only for a 15-yr horizon (inflation drag). **Impact: HIGH · Freq: MEDIUM.**

## (Planned sub-events) Sabbatical / career break, big trip
Treated as a *temporary deficit goal* — fund a runway, plan contribution pauses, model the cashflow hole. Routes to #2 + `goal-engine.js big_purchase`.

---

# FAMILY 4 — LIFE-STAGE TRANSITIONS

## 3. Approaching / entering retirement (decumulation start)
**(a) What it is.** The shift from accumulation to drawing income. Largest decision cluster in the app. Already served by `decumulation-solver.js`, `goal-engine.js` (income_floor, bridge, max_lifetime_spend), `withdrawal-methods.js`.
**(b) Key decisions.** (1) Annuity vs drawdown vs UFPLS vs hybrid? (2) Withdrawal rate (3–3.5% baseline)? (3) **Wrapper sequencing** — which pot first (SIPP/workplace/ISA/GIA), now reshaped by 2027 IHT flip? (4) Fund the **State-Pension bridge** (e.g. 60–67)? (5) Secure-income floor for essentials (annuitise to floor, draw the rest — freedomisntfree)? (6) Cash-buffer / bucketing for sequence risk?
**(c) Tax / allowance touchpoints.** 25% tax-free / LSA; MPAA; income-tax banding of withdrawals; State Pension (£12,548 26/27 context) timing; **2027 IHT-on-pensions flip** reverses "spend non-pension first"; CGT on GIA; ISA tax-free top-ups.
**(d) What good looks like.** Layer: State Pension + annuity/DB to cover essentials → flexible drawdown for discretionary → 1–3 yrs cash buffer for sequence-risk defence → band-smoothed withdrawals using personal allowance/basic band first; revisit sequencing for 2027 (BNY; freedomisntfree).
**(e) Common mistakes.** Over-drawing early (sequence risk); annuitising everything (loses flexibility/legacy) or nothing (longevity risk); triggering MPAA needlessly; ignoring the 2027 flip; no cash buffer.
**(f) FCA framing.** "At a 3.5% rate your pot lasts ~X years under these returns; annuitising £Y covers your essentials for life; here's the lifetime-tax and legacy consequence of each route." (`goal-engine.js` constraints already framed this way.)
**Impact: VERY HIGH · Frequency: HIGH. ENGINE EXISTS.**

## 8. Bereavement — death of spouse
**(a) What it is.** Most financially disruptive life-stage event. Income reshapes, assets transfer, IHT/CGT features activate, admin cascade.
**(b) Key decisions.** (1) Claim **APS** on the deceased's ISA (re-shelter). (2) Claim **transferable NRB (TNRB)** and **transferable RNRB** — combined up to £1m couple threshold (IHT402; Tax Confident). (3) Pension **nomination/death-benefit** — beneficiary drawdown vs lump; age-75 & 2027 rules. (4) Re-plan income (lost spouse's State Pension/income; Bereavement Support Payment, claim within 21 months). (5) Probate vs joint-asset automatic transfer. (6) Re-base inherited assets for CGT (spousal uplift). (7) Update own will/LPA/nominations.
**(c) Tax / allowance touchpoints.** Spousal exemption (unlimited); TNRB + transferable RNRB; CGT spousal uplift at death; APS; pension death-benefit treatment; Bereavement Support Payment; marriage allowance ceases.
**(d) What good looks like.** Immediate: secure cashflow (joint accounts continue; ask bank for funeral release). 0–21 months: claim BSP, APS, pension benefit. Estate: claim TNRB/RNRB. Then: re-plan income and re-base inherited assets; refresh own estate plan.
**(e) Common mistakes.** Missing the 21-month BSP window; not claiming APS (ISA shelter lost); not claiming TNRB on second death; rushing pension death-benefit into a taxable lump; failing to update own nominations/will.
**(f) FCA framing.** A guided checklist with consequences: "Claiming APS preserves £X of tax-free shelter; the unused NRB transferable to you is £Y; your pension nomination determines who inherits and how it's taxed." Information + storage, not advice.
**Impact: VERY HIGH · Frequency: MEDIUM. NEW ENGINE** (entity-merge of two parties + sequenced checklist + IHT recompute).

## 13. New child
**Decisions:** claim Child Benefit (even if high earner — NI credits + child's NINO); manage **HICBC** (£60k–£80k taper; pension contribution can drop ANI below threshold — PKF); open **JISA** (£9k); review **protection** (life/IP — new dependant); make/update **will & guardianship**; reshape budget (childcare can double cost-of-child to ~£251k — Royal London); Tax-Free Childcare (£2k/yr). **Tax:** HICBC, JISA, marriage allowance, Tax-Free Childcare, pension-contribution ANI reduction. **Good:** always register for Child Benefit; use pension to dodge HICBC where it bites; protection gap closed; will done. **Mistakes:** not claiming Child Benefit (lost NI credits); ignoring HICBC; no life cover; no will. **FCA:** "A new dependant changes your protection gap and benefits; here's what each affects." **Impact: MEDIUM · Freq: HIGH.** Engine: checklist + protection-gap detector + #1/#2 budget reshape.

## 14. Divorce / separation
**(a) What it is.** Division of assets including pensions (often the largest). Pensions cannot be ignored (Pension Advisory Group).
**(b) Key decisions.** (1) **Pension sharing order** (clean break, transfers a % into recipient's own pension) vs **offsetting** (keep pension, give other assets) vs **attachment** (share future income). (2) Clean break vs ongoing maintenance. (3) Family home: keep/sell/Mesher. (4) Rebuild own pension after a sharing order. (5) Update will, nominations, LPA post-split.
**(c) Tax / allowance touchpoints.** Pension sharing is tax-neutral; **no-gain/no-loss CGT window** on inter-spouse transfers extended to the earlier of 3 tax years after separation or the final order (CG22420); PRR on the home; loss of spousal IHT exemption after divorce; SDLT on property transfers.
**(d) What good looks like.** Value pensions properly (CETV may understate DB — consider a PODE); sharing order usually cleanest for a true clean break (Royal London); transfer assets within the no-gain/no-loss window; rebuild pension; refresh estate docs.
**(e) Common mistakes.** Ill-considered offsetting (the #1 source of negligence claims — Pension Advisory Group) — £1 of pension ≠ £1 of cash; ignoring pensions; missing the CGT window; forgetting to update nominations (ex-spouse still inherits).
**(f) FCA framing.** "Sharing transfers £X into a pension in your name (clean break); offsetting keeps the pension but you give up £Y elsewhere — but pension value ≠ cash value. Here's the consequence of each." Strongly signpost a solicitor/PODE.
**Impact: VERY HIGH · Frequency: MEDIUM. NEW ENGINE** (asset-split + offset-equivalence + entity-fork).

## 23. Serious illness / loss of capacity
**Decisions:** check **income protection / critical-illness** cover gap; set up **LPA** (property & finance + health) before capacity lost; build a **care reserve** (`goal-engine.js fund_care` exists); access pension early on ill-health grounds; review will. **Tax:** most IP/CIC payouts tax-free; care costs not deductible; gifting before care to avoid deliberate-deprivation rules. **Good:** protection + LPA in place *before* the event; care reserve modelled. **Mistakes:** no LPA (court of protection delay/cost); under-insured; raiding pension uncovered. **FCA:** "Without an LPA, no one can manage your finances if you lose capacity; here's your protection gap." **Impact: HIGH · Freq: MEDIUM. NEW ENGINE** (protection-gap + LPA-status + care reserve).

## 24. Inheritance windfall in retirement
Combines #5 with the decumulator's calculus: an inherited estate may push the recipient's *own* estate over the threshold (IHT-on-IHT risk). **Post-2027**, gifting down or spending the now-larger estate (incl. drawing pensions) can reduce a future IHT bill (Farrer). Routes to #5 (inherited-asset features) + `decumulation-solver.js` legacy/min_lifetime_tax goals. **Impact: HIGH · Freq: MEDIUM.**

## 19. Starting a business
**Decisions:** salary/dividend mix (director); pension via company (employer contribution, no NI, corp-tax relief); larger emergency buffer (irregular income); protection (relevant life, income protection); incorporate vs sole trader. **Tax:** dividend allowance & rates, employer pension contributions, corporation tax, BADR eligibility clock starts (2-yr), VAT threshold. **Good:** bigger buffer; pension via company; protection; clean salary/dividend optimisation. **Mistakes:** no buffer; ignoring pension; no protection; missing BADR qualification. **Impact: MEDIUM-HIGH · Freq: LOW-MED.** Engine: ADAPT (selector for salary/dividend/pension mix).

## 20. New job
**Decisions:** opt into pension at full **employer match** (top priority — kaeltripton); salary sacrifice (NI saving); join share scheme (SAYE/share-purchase); consolidate old pensions (Moneybox/PensionBee model); reset budget. **Tax:** pension relief + employer NI saving via sacrifice; share-scheme tax-advantage. **Good:** max match, sacrifice if beneficial, don't lose track of old pots. **Mistakes:** opting out of pension; ignoring match; orphaned old pensions. **Impact: MEDIUM · Freq: HIGH. CLEAN FIT.**

## 21. Marriage / civil partnership
**Decisions:** claim **marriage allowance** (£1,260 transfer, £252 saving) if one is a non/basic-rate payer; plan jointly (unlimited spousal IHT exemption now available); use **inter-spouse no-gain/no-loss transfers** to equalise CGT allowances and use both £3k AEAs / both ISA allowances; update wills/nominations. **Tax:** marriage allowance, spousal exemption, inter-spouse transfers, double allowances. **Good:** equalise assets to use both sets of allowances/bands; claim marriage allowance; joint estate plan. **Mistakes:** not claiming marriage allowance; holding all taxable assets in the higher-rate spouse's name; stale nominations. **Impact: MEDIUM · Freq: MEDIUM.** Engine: ADAPT (merge-lite — two entities, shared allowances).

## 30. Emigration / becoming non-resident
**Decisions:** establish residence under the **SRT**; time disposals (CGT) and pension withdrawals around departure; beware **temporary non-residence** claw-back — gains/flexible-drawdown taken while non-resident are taxed in the year of return if you were UK-resident 4 of the prior 7 years and return within 5 years (GOV.UK HS278); consider the destination's tax + any DTA; QROPS/leave pension in UK; State Pension uprating abroad. **Tax:** SRT, temporary-non-residence rules, DTA, withholding on UK rental/pension, loss of personal allowance for some non-residents, IHT domicile/long-term-residence rules. **Good:** plan disposals/withdrawals around the residence timeline; check the DTA; don't trigger claw-back by returning within 5 years. **Mistakes:** crystallising gains/pension while "temporarily" non-resident then returning (claw-back); ignoring the destination tax/DTA; assuming non-residence ends all UK tax (rental, gilts, pensions still in scope). **FCA:** "Leaving the UK changes which gains/withdrawals are taxable and when; here's the temporary-non-residence trap." **Impact: HIGH · Freq: LOW. NEW ENGINE** (residence-aware re-base of CGT/pension events).

---

# FAMILY 5 — EXTERNAL-SHOCK EVENTS

## 6. Tax-year-end (use-it-or-lose-it)
**(a) What it is.** The 5 April deadline. Most allowances reset and *cannot* be carried forward — a recurring, predictable, high-value nudge window (ii; Rathbones; Evelyn).
**(b) Key decisions.** (1) Top up ISA (£20k) before reset. (2) Use pension AA (£60k) + carry-forward of prior 3 years. (3) Realise gains within the £3k CGT AEA (bed & ISA / bed & spouse). (4) Use the £3k gift exemption (carry forward 1 yr). (5) JISA £9k. (6) Marriage allowance claim. (7) Pre-empt the **Apr 2027 cash-ISA cut** (£12k for under-65s) — front-load now (taxyz; JPM).
**(c) Touchpoints.** ISA, pension AA + carry-forward, CGT AEA, gift exemption, JISA, dividend allowance, marriage allowance, 2027 cash-ISA cut.
**(d) What good looks like.** A personalised gap report: "you have £X ISA headroom, £Y unused pension AA + £Z carry-forward, £W CGT AEA unused — here's what using each saves and the deadline." Act before 5 April.
**(e) Mistakes.** Leaving allowances unused (lost forever); leaving the ISA decision so late it doesn't process; same-day/30-day bed-&-breakfast trap when realising gains; forgetting carry-forward.
**(f) FCA framing.** "Here are the allowances you haven't fully used this tax year and what each is worth — the deadline is 5 April. Information, not a recommendation to buy."
**Impact: MEDIUM-HIGH · Frequency: ANNUAL. NEW ENGINE** (allowance-sweep / gap detector reading current usage vs bundle caps; this is high-leverage and recurring).

## 12. Market crash (in / near drawdown)
**(a) What it is.** A sharp fall while you're drawing income — **sequence-of-returns risk / "pound-cost ravaging"**: selling more units at depressed prices early in retirement can permanently shrink the pot (BNY; Brewin; Charles Stanley).
**(b) Key decisions.** (1) Draw from the **cash buffer** instead of selling equities. (2) **Reduce/flex withdrawals** in the bad year. (3) Take only natural income (dividends/interest), not units (Telegraph). (4) Rebalance / refill buffer on recovery. (5) Resist panic-selling.
**(c) Touchpoints.** Withdrawal rate sustainability; cash buffer (1–3 yrs essentials); gilt ladder for predictable short-term funding; tax banding of reduced withdrawals.
**(d) What good looks like.** Hold 1–3 yrs essentials in cash *before* the crash; draw from cash in the downturn; flex discretionary spend; refill buffer when markets recover (freedomisntfree). Accumulators: a crash is a *buying* opportunity — keep contributing.
**(e) Mistakes.** Maintaining a fixed £ withdrawal through the crash (ravaging); panic-selling to cash and missing the rebound; no buffer; same rigid plan for accumulator and decumulator (opposite responses).
**(f) FCA framing.** "Drawing your usual £X this year means selling N% more units than last year; drawing from your cash buffer instead preserves the pot to recover. Here's the consequence of each." 
**Impact: VERY HIGH (decumulators) · Frequency: MEDIUM. NEW ENGINE** (sequence-risk guard + buffer/spend-flex levers — life-stage-aware).

## 17. Interest-rate change
**Decisions:** remortgage/fix vs variable; **overpay mortgage vs invest vs save** (re-scores when rates move — the debt "return" in #1 changes); move cash to higher-rate accounts/notice/ISA (Optiml/Count model this); review variable debt. **Tax:** PSA (savings interest), ISA shelter as rates rise, no relief on mortgage interest (residential). **Good:** when savings rate > mortgage rate after tax, save; when mortgage rate > expected investment return, overpay; sweep idle cash. **Mistakes:** leaving cash in a 0% account when rates are high; overpaying a cheap fix instead of investing; not re-running the debt-vs-invest decision when rates move. **Impact: MEDIUM · Freq: MEDIUM. NEW ENGINE** (rate-sensitivity re-score — feeds #1's debt-vs-invest factor).

## 18. Budget / rule change
**Decisions:** re-run every affected event when the rules bundle changes (e.g. 2027 SIPP-IHT flip, BADR rate rise, cash-ISA cut). Surface "this change affects your plan: here's what moved." **Tax:** whatever changed. **Good:** proactive re-computation + a plain-English "what changed for *you*" note (memory `live-gov-data-sync-monitor`; `reference_rules_uk_fixture`). **Mistakes:** acting on stale rules; hardcoded figures in display copy (memory: tax-copy bug class). **Impact: MEDIUM-HIGH · Freq: ~ANNUAL. NEW ENGINE** (rules-diff propagator — when `_bundle.js` changes, flag affected events per user).

## (External sub-event) Job loss
Routes to #4 (redundancy if a package) or #2 (deficit) + buffer drawdown + benefits check. Inflation spike → routes to #2 (real-terms deficit) + #12 (real returns in drawdown) + index-linked income review.

---

# HOW LEADING UK TOOLS SURFACE THESE (from searches)

- **Moneybox (Aurora engine):** goals framed as *life events* ("rainy day fund, big life events"), LISA-led for first home, pension consolidation; "Financial plans are guidance, not financial advice… you're in control" — same FCA stance Sonuswealth uses.
- **J.P. Morgan Personal Investing (ex-Nutmeg):** "free wealth planner — build total wealth view, get tailored suggestions, **test simulated scenarios for each suggestion**, progress tracker." This is *exactly* the scenario-engine TEST mode pattern — validates the suggestion→scenario→track loop.
- **PensionBee:** retirement-centric — consolidate, contribute, withdraw, annuity option; "plans by life stage"; human "BeeKeeper" backstop. Strong on the retirement/PCLS cluster, weak on the broader event space.
- **Optiml & Count:** the closest to Sonuswealth's surplus engine — "save vs overpay debt vs pension" optimisation, daily rate-sweeping, AI chat *explaining why* a decision is good (or why *not* to act). Count is in the FCA Innovation Sandbox as an "automated financial adviser" — a regulatory path to watch.
- **Gap in the market:** none of these handle the *windfall/bereavement/divorce/share-vesting* event space with decision depth. That's where Sonuswealth's event-driven Cashflow surface can differentiate — the breadth of #4/#5/#8/#10/#11/#14 with FCA-safe consequence framing.

---

# ENGINE-MAPPING SUMMARY (for the build)

**Already built (reuse):** #1 surplus (`surplus-allocation.js`), #3 retirement (`decumulation-solver.js` + `goal-engine.js`), #9 PCLS (`decision-engine.js` DE-01, extend), #15/#28/#29 goals (`goal-engine.js`). Scenario re-measurement for income rise/fall via `scenario-engine.js` TEST mode.

**Clean fit on the existing pattern (priority-selector → scored options → recommended) — build next, low new logic:**
- **#4 Redundancy** — lump → {cash runway, pension (excess-over-£30k), ISA} scored by priority + tax-saving overlay.
- **#7 Bonus / income rise** — identical to #1 with cliff-edge (£100k taper, £60k HICBC) flags.
- **#9 PCLS** — extend DE-01 with MPAA/LSA/phasing options.
- **#26 Maturing investment / #20 new job / #27 payout** — all "lump or change arrives → re-score homes".

**Need NEW engine logic:**
- **#6 Tax-year-end allowance-sweep** — gap detector: current usage vs bundle caps, deadline-aware. High leverage, recurring, relatively contained to build.
- **#8 Bereavement** — entity-merge of two parties + sequenced checklist + IHT/APS/TNRB recompute.
- **#12 Market-crash sequence-risk guard** — life-stage-aware; buffer-draw vs spend-flex levers; only fires for decumulators.
- **#14 Divorce** — asset-split + pension-offset-equivalence + entity-fork.
- **#17 Rate-sensitivity** — re-score #1's debt-vs-invest factor when rates move.
- **#18 Rules-diff propagator** — on `_bundle.js` change, flag affected events per user (pairs with `live-gov-data-sync-monitor`).
- **#23 Protection/LPA gap** + **#30 residence-aware re-base** — more specialised, lower frequency.

**Shared infrastructure all events want:** (1) the **methodology/provenance block** (memory `feedback_surface_methodology_to_user.md`) — rule applied + legal source + status + plain-English formula; (2) the **FCA consequence framing** already standardised in `surplus-allocation.js`/`decision-engine.js`; (3) figures strictly from `TAX`/bundle (accuracy-auditor gate).

---

# KEY SOURCES (current, UK, 2026/27)
- GOV.UK HS275 BADR 2026 (rate 14%→18%); GOV.UK BADR eligibility; Brodies "BADR what's changing 6 Apr 2026" (anti-forestalling); Saffery/BDO BADR.
- GOV.UK redundancy tax; Royal London adviser "redundancy → pension"; Aberdeen techzone redundancy planning; Lewis Silkin termination FAQs; Charles Stanley redundancy planning.
- GOV.UK APS guidance; uktaxdrag CGT inherited-assets 2026/27 (s62 uplift); Farra ISA-after-death APS; Farrer "IHT planning after reforms" (2027 flip, spousal CGT re-base); kaeltripton pension-vs-ISA 2026.
- GOV.UK HS305/HS287 employee shares; salarytax Section 104; TaxRadar/CompVerdict RSU UK 2026/27.
- MoneyHelper + Royal London pensions-on-divorce; GOV.UK CG22420 (no-gain/no-loss window); Pension Advisory Group guide (offsetting negligence); judiciary "Sorting Out Finances on Divorce".
- uktaxdrag + pensionbible + retirementexpert + freedomisntfree drawdown/annuity/UFPLS/MPAA/LSA 2026/27; MoneyHelper multiple-lump-sums.
- GOV.UK death-of-partner tax/benefits; Tax Confident "losing a partner"; IHT402 (TNRB); Farra "spouse died what to do".
- Rathbones/ii/Deloitte/Evelyn/JPM tax-year-end checklists 2026/27 (incl. 2027 cash-ISA cut).
- BNY/Brewin/Charles Stanley/Telegraph sequence-risk & pound-cost ravaging.
- GOV.UK HS278 temporary non-residence; LITRG leaving-the-UK; GOV.UK tax-on-UK-income-abroad.
- PocketWise/Royal London/PKF new-parent & family planning 2026 (HICBC, JISA, marriage allowance, gifts-from-surplus-income).
- Moneybox, J.P. Morgan Personal Investing, PensionBee, Optiml, Count (competitor surfacing patterns).
