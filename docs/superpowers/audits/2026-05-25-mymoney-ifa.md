# MyMoney — Senior IFA Audit (Bruce Wayne, 62)

**Auditor lens:** Chartered Financial Planner, 15+ yrs UK private client.
**Date:** 2026-05-25 · **Build:** post Wave 0.6
**Mandate:** does the screen represent Bruce's financial reality accurately, and does any copy cross the FCA COBS 9A advice boundary?
**Verdict in one line:** **DO NOT SHIP.** Two BLOCKs on FCA boundary, three BLOCKs on numbers that an adviser would refuse to defend, and the screen tells a "STRONG BUFFER / Optimised" story that is the opposite of Bruce's actual position (£8k/mo deficit, £180k mortgage, age 62, no obvious decumulation plan).

---

## 1. The headline framing problem (BLOCK)

The screen opens with **"Wealth 69 / 100 Optimised · Risk 71 / 100 Optimised · Net worth grew £7k this month, despite a £8k deficit."**

A senior adviser sees this and immediately distrusts the tool. Bruce is:

- 62 years old (≤5 yr from typical retirement; arguably already in late-accumulation/early-decumulation).
- Running a **£8,000/month income deficit** (income £3k vs spend £11k = burning ~£96k/yr of capital).
- Carrying a **£180k mortgage** with no visible repayment vehicle and limited earned-income capacity to service it.
- Cash buffer £180k = **~22 months at current burn** (the screen's own Cashflow act says so — see §4 below).

Labelling that position "Optimised" on both Wealth and Risk is not just a copy quibble. It is materially misleading. An adviser asked to file a fact-find with this header on top would have to write a covering note disagreeing with the platform. The label has to go before this screen sees a real user.

**Severity: BLOCK.** Action: replace `Optimised` with a defined, non-regulated-sounding state band (e.g. `Above target · 69/100` with a tap-through rubric) AND have the band reflect cashflow distress, not just static net-worth ratios.

---

## 2. The five "metric tiles" — every single one is suspect (BLOCK on three, MED on two)

| Tile | Shown value | Adviser's reaction |
|---|---|---|
| TIME COVERED | **150.3 yr** | **BLOCK.** Wealth £4.08m ÷ £120k/yr essentials ≈ 34 yr. £4.08m ÷ £132k/yr total spend ≈ 31 yr. 150.3 yr implies divisor of ~£27k/yr, i.e. the calc is using net-of-income figures or annualising something monthly that isn't monthly. Either the wrong numerator (illiquid property included in "wealth" but it's not spendable) or wrong denominator. Adviser cannot defend. |
| INCOME BUFFER | **52.4×** | **BLOCK.** Income £3k/mo vs commitments £11k/mo → buffer = 0.27×, not 52×. Almost certainly using the wrong "commitments" definition (debt service only = £1k, → £3k/£1k = 3, still not 52) or comparing annualised income to monthly commitments. Whatever the formula, the answer is wrong by two orders of magnitude. |
| DEBT RATIO | 4% | **MED.** Mathematically defensible (£180k / £4.08m). But for a 62-yr-old, the more relevant adviser frame is debt-to-liquid-net-worth (£180k / £980k = 18%) or debt-to-pension-pot, or simply months of debt service vs income. 4% understates risk because it leans on an illiquid property valuation. |
| 1-YEAR GROWTH | +£154k (+4.1%) | **MED.** Net of contributions? Net of withdrawals? Adviser cannot tell. If Bruce is in deficit £96k/yr but net worth grew £154k, the gross investment return was ~£250k = ~6.5% — a perfectly reasonable number but the user has no way to see that. Disambiguate "growth vs flows" or it's a vanity metric. |
| LAST MONTH | +£7k (+0.2%) | **LOW.** Defensible but trivially noisy. One month of mark-to-market on a £4m balance sheet is signal-poor. |

These tiles are also internally inconsistent with each other: TIME COVERED 150 yr and INCOME BUFFER 52× both shout "abundance", but the screen's own Cashflow act says **"Liquid cash covers 22.0 months"** = 1.83 yr. Three different "how long does the money last?" answers on the same scroll. An adviser would refuse to sign the fact-find.

**Severity: BLOCK on TIME COVERED + INCOME BUFFER; MED on the others.** Action: fix the formulas (see §10) AND restrict the divisor used in the "duration" tile to *liquid* assets, not gross balance sheet, otherwise the figure is meaningless for retirement-runway questions.

---

## 3. PENSION tile — accurate on the headline, but the "carry-forward" question is unanswered (HIGH)

**Quoted copy:** *"£60k of pension room left this year · COST OF WAITING: £12.0k of tax relief gone forever if not used by 5 April."*

**Adviser view:**

- £60k = the standard Annual Allowance (Finance Act 2023; £60,000 since 6 April 2023, confirmed for 2026/27 per `rules-uk.js`). Headline number is correct **only if** Bruce's adjusted income is below £260k (else tapered AA applies — `calcTaperedAA` per spec §4.5/461) AND he has not triggered MPAA via UFPLS/FAD (else cap drops to £10k — `calcMPAA` per spec §4.5/463). Neither flag appears on the tile. Spec §4.5/616 says AA breach should surface carry-forward chip; absence here means either the engine hasn't run those checks or Bruce is in the simple base case. **Tile should display the gating logic** — "assuming standard AA, no MPAA, ANI < £260k" — or the figure is unsafe for the 62-yr-old segment most likely to have triggered MPAA already.
- "£12.0k tax relief gone forever" assumes Bruce contributes the full £60k AND is a 40% taxpayer. At 45% (additional rate) it's £27k; at 20% it's £12k; at 0% (already retired, no relevant earnings) it's **£0 because he has no relevant UK earnings to relieve against** (FA 2004 s188–s189: tax relief capped at 100% of relevant UK earnings or £3,600 gross, whichever higher). Bruce's income £3k/mo = £36k/yr earned (if employment) → relief is capped at £36k contribution, not £60k. The £12k figure is wrong for the most common version of this persona.
- "Gone forever if not used by 5 April" is **factually wrong**. Carry-forward exists: unused AA from the prior three tax years can be brought forward (FA 2004 s228A), subject to having been a member of a registered scheme in those years. So it's not "gone forever" — it's "gone after three years if also not used then." The copy is urgency-language masking a misstatement of the rule.
- Spec §4.5/462 explicitly calls `calcCarryForward(entity, bundle)` to "3 prior years; total available." The tile has it, the engine should have it. The copy ignores it.

**Severity: HIGH.** Action: tile must (a) state the AA basis (standard / tapered / MPAA), (b) show carry-forward room or explicitly state "none available", (c) anchor the "tax relief" claim to Bruce's actual marginal rate AND relevant UK earnings cap, (d) replace "gone forever" with "tax relief on this year's AA expires 5 April; £X of carry-forward remains until [year]."

---

## 4. CASH tile — the "STRONG BUFFER" label is the most defensible-sounding error on the screen (BLOCK)

**Quoted copy:** *"£180k · 6.9 yr of essentials covered · COST OF WAITING: £1240/yr in interest tax — wrapping into an ISA would shield it · STRONG BUFFER."*

Three problems, in increasing severity:

1. **"6.9 yr of essentials"** assumes essentials = £180k / 6.9 ≈ £26k/yr = £2,170/mo. The screen's own Cashflow says essentials are **£10k/mo = £120k/yr**, giving £180k / £120k = **1.5 yr**, not 6.9. The Cashflow act explicitly says **"Liquid cash covers 22.0 months at this rate"** = 1.83 yr (close to 1.5, the difference being whether you count debt service). The tile is using a wrong definition of "essentials" (likely a default per-month figure baked in, not Bruce's actual).
2. **"STRONG BUFFER"** at 1.5–1.8 yr of essentials, against a £96k/yr deficit and no visible decumulation strategy, is wrong. Adviser benchmark for a 62-yr-old approaching retirement: 12–24 months *expenses* (not just essentials) is **minimum prudent**, not "strong." Strong would be 3–5 yr OR cash equal to the gap between guaranteed income (state pension + DB) and total spend over the period before SP/DB starts. By that test, with state pension ~5 yr away and £8k/mo gap, Bruce needs ~£480k of cash/short-bond ladder, not £180k. The label should be **AT MINIMUM** or **GAP**, not STRONG.
3. **"wrapping into an ISA would shield it"** — this is the line that crosses the FCA line. See §8.

**Severity: BLOCK** (on the false "STRONG BUFFER" label specifically; the underlying number error is the proximate cause).

---

## 5. PROTECTION tile — "no inheritance tax on it" is the kind of half-truth that gets a firm fined (HIGH)

**Quoted copy:** *"Life cover is held in trust — pays out to family directly, no inheritance tax on it."*

Half right, dangerously framed. Things the copy ignores that an adviser would never let pass:

- **"In trust"** is doing all the work in that sentence. If the policy is held in a properly drafted, not settlor-interested discretionary trust written at inception, then yes, proceeds fall outside the estate for IHT (IHTA 1984 ss58–s89 trust regime, with periodic/exit charges; for whole-of-life held in a relevant-property trust, charges are usually negligible). If the trust is settlor-interested or the policy was assigned into trust within 7 years of death, the **gift-with-reservation rules (FA 1986 s102)** and the **7-year clock** can pull proceeds back into the estate. The tile doesn't say which structure Bruce has.
- Premiums paid into the trust are **transfers of value**. Usually covered by the £3,000 annual exemption or "normal expenditure out of income" (IHTA 1984 s21), but neither is automatic — needs evidencing.
- For term cover with no surrender value and premiums covered by s21, the IHT-free outcome is robust. For whole-of-life or investment-linked plans, much more nuanced.
- "Pays out to family directly" implies fast payment; trustees still have to claim, identify beneficiaries, and (in some trust deeds) exercise discretion. Practically faster than probate, yes; "directly" oversells it.

**Severity: HIGH.** Action: caveat with structure dependency. Minimum acceptable copy: *"If your policy is held in a properly drafted discretionary trust, proceeds typically fall outside your estate for IHT. Trust structure, premium funding, and 7-year clocks affect this — confirm with the trust deed and an adviser."* Information/guidance posture preserved.

---

## 6. The decumulation plan is invisible (BLOCK on the persona, not the tile)

Bruce is 62. The single most important question for him from a senior adviser's seat is: **how is the £8k/mo gap funded between now and full state pension + any DB drawdown?**

Things an IFA would expect to see on this screen, or signposted from it:

- **Order-of-withdrawal plan.** Cash → GIA (within CGT AEA / dividend allowance) → ISA → Pension (pre-April 2027) → Pension (post-April 2027, when in estate for IHT). The Sonuswealth spec §4.8 explicitly defers Drawdown Efficiency Ratio as OPEN, and §8 (Domain B) covers FAD/UFPLS, but **none of it surfaces on MyMoney as a "your decumulation plan" preview**, which is the inter-tab tease Cashflow is meant to do.
- **State pension countdown.** Bruce reaches SPA at 67 (~5 yr away). Tile should show "State Pension £X/wk from 2031." Domain A01/A02 per spec §4.3/393 covers this. Not visible.
- **DB pension(s).** If any, capitalised value and projected income, with the IHT/transfer-warning gate per spec §4.5/508 ("transfers from DB £30k+ require regulated advice"). Not visible.
- **SIPP-IHT countdown.** Finance Act 2026 (Royal Assent 18 March 2026) brings DC pensions inside the estate from 6 April 2027. Bruce has £850k of DC pension. Spec §4.3/395–396 mandates a countdown chip "£X enters estate April 2027" for DC value > £500k. **Not visible on the pension tile.** This is the single most important planning fact for this persona this year and it's missing.
- **BPR planning?** Bruce age 62, £4m balance sheet, mortgage suggests business interests historically (BTL property is shown). Whether BPR-qualifying assets are appropriate is decision territory, but the *visibility* of "you have no BPR-qualifying assets; here are the relevant rules" is information-stance and should appear. Currently silent.

**Severity: BLOCK** for a screen aimed at the 60-and-up segment. Action: add a "decumulation tease" panel that links to Cashflow's drawdown methods and Tax & Estate's SIPP-IHT exposure card. Even a placeholder is better than silence.

---

## 7. The IHT signal is silent on the screen for the persona where it matters most (BLOCK)

Bruce: £4.08m gross, £850k DC pension, age 62. From April 2027, the £850k pension joins the estate. Even before that, his estate is materially above the NRB+RNRB:

- NRB £325k (frozen) + RNRB £175k (frozen, tapered for estates > £2m — Bruce's estate > £2m so RNRB tapers £1 per £2 above £2m; full £4.08m gross estate → RNRB likely **£0** after taper, unless spousal RNRB is available).
- Estate £4.08m − liabilities £180k = ~£3.9m taxable. Less reliefs/exemptions ≈ £3.5m above NRB at 40% = **~£1.4m IHT bill on death today.**
- Post-April 2027 with pension included: estate ~£4.75m → ~£1.7m+ IHT.

Spec §4.3/395–396 says this card MUST render the SIPP-IHT signal. It doesn't. Founder's persona mapping in spec §180 **explicitly names Bruce as "SIPP IHT April 2027 warning prominent."** Missing this on a Bruce-fixture render is a regression against the persona's own design intent.

**Severity: BLOCK.** Action: render the IHT card per spec §4.3 with countdown chip on pension tile, and surface a Tax & Estate cross-link.

---

## 8. FCA boundary review — line-by-line (BLOCK on two lines, HIGH on one)

| # | Quoted copy | FCA boundary verdict |
|---|---|---|
| 1 | **"wrapping into an ISA would shield it"** (CASH tile) | **BLOCK.** This is a personal recommendation in form: it (a) identifies a specific regulated wrapper (ISA), (b) tells the user it "would" produce a better outcome, (c) appears alongside the user's actual asset balance making it persona-specific. Per COBS 9A.1.4, a personal recommendation is a recommendation presented as suitable for the person. Even with disclaimer, this is over the line. **Information-stance rewrite:** "Interest above the £1,000/£500 PSA is taxable. An ISA is one wrapper available for cash; eligibility £20,000/yr (2026/27). See guidance." Information about the rule; let the user infer the action. |
| 2 | **"COST OF WAITING: £12.0k of tax relief gone forever if not used by 5 April"** (PENSION tile) | **BLOCK.** Three concurrent problems: (a) the number is wrong (see §3), (b) it ignores carry-forward (a factual error, separately a misstatement of FA 2004 s228A), and (c) the urgency framing ("gone forever") is sales-shaped, not information-shaped. FCA Consumer Duty (PRIN 2A, "consumer understanding" outcome) requires communications that support good decisions, not pressure-shaped ones. Rewrite to factual: "Standard Annual Allowance £60,000 for 2026/27. Unused AA can be carried forward up to 3 years subject to the relevant rules. Year-end 5 April." |
| 3 | **"pays out to family directly, no inheritance tax on it"** (PROTECTION tile) | **HIGH.** Not a recommendation, but a definitive tax statement without the structural qualifier (see §5). Risk is misleading the user, not boundary-crossing per se. Add the trust-structure caveat. |
| 4 | "STRONG BUFFER" label | **MED on FCA, BLOCK on accuracy** (see §4). It's not advice, but it's a value judgment. Per Consumer Duty "consumer understanding", labels asserting subjective adequacy must be defensible against a rubric. None is shown. |
| 5 | "Optimised" on Wealth/Risk scores | **MED on FCA, BLOCK on accuracy** (see §1). Same issue: subjective label, no rubric, sounds regulated, applied to a persona for whom it isn't true. |
| 6 | "Net worth grew £7k this month, despite a £8k deficit." | **LOW.** Factual, non-recommendation. Defensible. |

The first two are the ones that would not pass a Phase-1 compliance pass under Sonuswealth's own §16.3.3 "FCA rewrite filter." That filter is meant to deterministically rewrite prohibited language before delivery. Either it didn't run, or it doesn't catch these patterns. **Either way it's a failure mode the launch posture depends on.**

---

## 9. Inter-tab integrity an adviser would expect (MED)

Spec §Q1.2 (cross-screen data validation) requires shared metrics to render the same on every screen. From the evidence pack:

- **Liquid coverage** shows as "6.9 yr of essentials" (CASH tile) AND "22.0 months" (Cashflow act). Same screen. Different numbers. Cross-screen failure on the same screen.
- **Net worth growth** shows as "12-month net worth +10.9%" AND "1-YEAR GROWTH +4.1%" on the same anchor. Same period, different rates.
- **Wealth/Risk state band** is "Optimised" on MyMoney, "ON TRACK"/"PROTECTED" on Home (per evidence pack §C-11). Cross-screen failure with Home.

**Severity: MED for an adviser** (the user can usually triangulate). **High for the founder** as a build-discipline signal.

---

## 10. What I would actually do — in priority order (single fact-find pass)

1. **Fix TIME COVERED + INCOME BUFFER formulas** before anything else. They are the two most-cited tiles and both are wrong by an order of magnitude. Likely root causes: divisor confusion (annual vs monthly), inclusion of illiquid property in a runway calc. (BLOCK.)
2. **Fix CASH "6.9 yr" + "STRONG BUFFER".** Recompute essentials from Cashflow actuals, not a default. Re-band the label against an explicit rubric the user can tap to see. (BLOCK.)
3. **Render SIPP-IHT countdown** on pension tile per spec §4.3/395–396. (BLOCK — persona design intent.)
4. **Rewrite the two FCA-crossing lines** ("wrapping into ISA would shield", "tax relief gone forever"). (BLOCK.)
5. **Add carry-forward + AA-basis context to PENSION tile** — `calcCarryForward` + `calcTaperedAA` + `calcMPAA` results, even if unchanged. The tile cannot stand alone for a 62-yr-old without these. (HIGH.)
6. **Replace "Optimised" label** on Wealth + Risk with a defined band, surfaced rubric, reflecting cashflow distress not just static net-worth. Reconcile with Home's "ON TRACK / PROTECTED". (BLOCK.)
7. **Qualify the trust IHT line** with structure-dependency caveat. (HIGH.)
8. **Add decumulation-plan tease** linking to Cashflow drawdown methods + Tax & Estate IHT card. Even a placeholder. (HIGH.)
9. **Disambiguate "+£154k 1-YEAR GROWTH"** as "before contributions/withdrawals" so the +£7k LAST MONTH and +10.9% 12-month numbers can be reconciled. (MED.)
10. **Audit every numeric tile for divisor sanity** before next ship. If two of five are wrong by orders of magnitude on a known-good persona fixture, more are likely wrong elsewhere. (MED, but a process gate.)

---

## 11. What the prior Wave 0.6 audit missed (founder's actual question)

Pattern-fitting the founder's complaint, my read on why a "passed" audit didn't stop this:

- **Wave 0.6 likely tested presence (does the tile render? does the chart paint?) not correctness (is the number defensible?).** Snap-based audits are pixel-accurate but numerically blind. Two tiles wrong by 100× would pass a snap test.
- **It didn't run a persona-vs-persona-design-intent diff.** Spec §180 explicitly says Bruce must show SIPP IHT prominently. The auditor didn't check that the rendered Bruce screen matches Bruce's spec'd render. This is the easiest mechanical check available and it would have caught the missing IHT card immediately.
- **The FCA rewrite filter (§16.3.3) is either not wired or its rule set is too narrow.** Both BLOCK-level boundary crossings ("wrapping into ISA", "gone forever") use very common sales-language patterns. A regex-grade filter should catch both. A senior-adviser-grade filter definitely would.
- **State-band copy ("Optimised", "STRONG BUFFER") was not subjected to a rubric audit** — does the label have a defined threshold, is the persona inside that threshold, does it match what other screens say for the same scores? Three different mechanisms (threshold definition, persona check, cross-screen consistency) — none seem to have run.

**The corrective gate:** every metric tile, before ship, has to clear (a) calc-defensibility against a written formula, (b) cross-screen consistency against §Q1.2, (c) persona-design-intent match against spec §180, (d) FCA rewrite filter on every label, (e) state-band rubric with a tap-through. If Wave 0.6 didn't have all five, it wasn't an audit, it was a smoke test.

---

**File:** `C:\Users\Powernet\Desktop\finio\docs\superpowers\audits\2026-05-25-mymoney-ifa.md`
**Adviser sign-off:** I would not file a fact-find with the current MyMoney screen on top. Two BLOCKs on FCA boundary, three BLOCKs on calc, two BLOCKs on persona-design-intent miss. Re-audit after items 1–6 are fixed.
