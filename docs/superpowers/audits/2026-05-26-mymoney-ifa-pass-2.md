# MyMoney — IFA Pass 2 (Mr T Core, 35yo director)
**Auditor:** Chartered Financial Planner (15+ yrs UK private client)
**Date:** 2026-05-26
**Surface:** http://localhost:5174/?demo=mrt-core&tab=money (live DOM read via Chrome MCP)
**Authority:** 2-Product-mymoney-v2_7.md · 4-Operations/16-regulatory-and-compliance.md · hot.md
**Persona facts:** age 35 · director (`flags: ['director']`) · low salary + dividend extraction implied by £78k ANI vs £7k/mo MONTHLY INCOME · pension £206k · ISA £47k · GIA £25k · onshore bond £22k · offshore bond £19k · EIS £15k · VCT £13k · SEIS £8k · let property in £583k · business assets £163k · protection £2.67m · cash £29k · debts £357k · cashflow −£552/mo

---

## BLOCKs (must fix before ship)

### BLOCK-1 — Obligations rendered as an "asset" tile
**Surface:** OBLIGATIONS £6k tile under "How your money is held" + included in £988k total.
**Spec:** §3.5 (Domain V is a contingent liability, separate display) and §20.3: *"Domain V items have no net worth contribution (maintenance payments are cashflow; trustee/executor roles are duties)."*
**IFA verdict:** This is a £6k/yr OUTGOING (family maintenance/care), not £6k owned. Misrepresenting an obligation as wealth inflates Net Worth and is a Consumer Duty "consumer understanding" failure (§16.3.4). For a 35yo director with dependants this is exactly the kind of misread an adviser would flag.
**Fix:** Remove from `£988k held` denominator. Render Domain V as an obligation dashboard per §20.3 (active count + monthly £ outflow + protection-gap chip). If kept on MyMoney at all, place under "What you owe" or a new "Commitments" lane, not under "How your money is held".

### BLOCK-2 — Director persona, zero Domain X surfacing
**Surface:** Whole screen. ANI £78k vs MONTHLY INCOME £7k (=£84k gross) imply a salary/dividend mix, but no remuneration card, no "company pension capacity" chip, no DLA position, no BADR remaining-lifetime indicator.
**Spec:** §22 entire domain; §22.10 `calcRemunerationOptimal(company, director, bundle)` is L1/L2/L3 gated on director flag; §3.4 list item 4: "Business Assets (H + I + X — X gated on director flag)"; X24 action "Optimise my director salary".
**IFA verdict:** For a 35yo Ltd co director this is THE single highest-value planning lever — employer pension contributions vs dividend extraction can be worth ~£8–15k/yr at his profile. Showing pension "headroom £41k" without the company-contribution route (no employer NI charge, CT-deductible, no AA tapering at his earnings) is the wrong frame. Salary-sacrifice copy referenced at §22.5 / §22.9 is missing entirely.
**Fix:** Surface Domain X as a distinct L1 card ("Business: Director / Ltd Company") with remuneration card + company-pension capacity + DLA position. At minimum, swap the Pensions L1 chip from "315 days until SIPP joins IHT estate" (see BLOCK-3) to "Employer pension contribution route saves ~£X NI + CT vs equivalent salary".

### BLOCK-3 — SIPP-IHT countdown wrongly prioritised for a 35yo accumulator
**Surface:** PENSIONS tile: *"315 days until SIPP joins IHT estate (exposure ~£67k at 40%)"* with "SIPP IHT 2027" chip.
**IFA verdict:** Finance Act 2026 SIPP-IHT (effective 6 April 2027 — D-SIPP-ENACTED, hot.md) is a withdrawal-stage planning concern. A 35yo with 25+ years to retirement has zero actionable response to this — he is NOT going to liquidate his SIPP to dodge a charge that only crystallises on death. The "£67k at 40%" framing also assumes death imminent, which is not the right frame for a 35yo. For Willy Wonka (78, drawdown) this is the lead chip. For Mr T it is noise that crowds out the actually-leveraged signals (carry-forward + employer contributions + relevant earnings cap).
**Fix:** Life-stage gate the Pensions COST OF WAITING copy. Under age ~55 (or `years_to_retirement > 15`): show "£10.1k of tax relief available this tax year" + carry-forward room + employer contribution route. Over 55 or in drawdown: show SIPP-IHT countdown. The current logic seems to fire SIPP-IHT for every persona.

### BLOCK-4 — Credit-card 24.7% APR debt not prioritised
**Surface:** WHAT YOU OWE — Credit-Card £2k 24.7% sits at top numerically but the L1 chip says only "Liabilities · £357k · costs £1k/mo". No "Clear high-rate debt first" prompt.
**Spec/Reg:** Consumer Duty "consumer understanding" + COST OF DOING NOTHING rank 2 says "Debt burden · clears in 25 years · £14k/yr" but doesn't single out the avalanche move.
**IFA verdict:** This is the textbook debt-avalanche call: £2k at 24.7% is ~£490/yr in interest going down a hole, while £147k sits in ISA/GIA/onshore-bond yielding less than that on tax-adjusted basis. Clearing the card from cash is a >24% guaranteed return. Not flagging this on a screen for a 35yo with disposable assets is the kind of obvious miss an IFA would call lazy.
**Fix:** Add a Liabilities L1 chip: "Clearing your credit card from cash saves ~£490/yr in interest — equivalent to a 24.7% tax-free return." Then a debt-priority sort within the drill (rate-descending), not balance-descending.

### BLOCK-5 — Tax-free dividends progress bar shows 7,600% utilised
**Surface:** TAX-FREE ALLOWANCES — "Tax-free dividends £38k / £500".
**IFA verdict:** £38,000 of dividends taxed against a £500 dividend allowance is correct (allowance is £500 from April 2024) — but rendering "£38k / £500" with a progress bar implies he has £500 of room and has used £38k of headroom. Either the numerator/denominator are swapped, or the visualisation needs a different state (red "exceeded by 76× — £X dividend tax liability"). At his earnings this is roughly £33,750 × 33.75% upper-rate dividend = ~£11.4k of dividend IT — a major number that the screen reports nowhere.
**Fix:** Render exceeded-allowance rows differently (red, no progress bar, show £-cost above allowance). Add an L3 drill for the dividend tax liability with cross-link to Domain X remuneration optimisation.

### BLOCK-6 — Plan-funded "29%" with no rubric
**Surface:** PLAN FUNDED · % of retirement goal · 29%.
**Spec:** §16.3.3 the FCA boundary requires every advisory-flavoured output to terminate in simulate-or-review, and disclaimers carry rules version. A bare "29% of retirement goal" is a personal-recommendation flag under COBS 9A unless drillable to its assumption set (target £, retirement age, growth %, contribution rate).
**IFA verdict:** Founder principle PP-3 (drillable to nth degree). Number with no drill is the exact bullet §16.9 lists as pending legal review: *"Does the Finio Score or Risk Score constitute a personal recommendation under FCA COBS 9A?"*
**Fix:** Make the 29% tile drillable into the assumption set (target multiple, target age, current contribution rate, projected at growth assumption) per PP-3. Confirm a `simulate-or-review` CTA terminates the drill.

---

## HIGHs

### HIGH-1 — Alternatives tile missing CGT chip + CARF flag + illiquidity signal
**Surface:** ALTERNATIVES £28k tile shows only "Other 100%" + View detail. Per §19.3 the L1 card requires: aggregate CGT exposure chip · CARF chip if crypto held · illiquidity count. Mr T's £28k Alternatives bucket (likely some mix of EIS/VCT/SEIS reliefs already represented in S&I, plus crypto/collectibles) needs the CGT chip at minimum. Currently the tile is dead.
**Fix:** Wire `calcAlternativesCGTExposure(entity, bundle)` and the CARF active flag. If composition is just collectibles, show wasting-chattel exemption status.

### HIGH-2 — −£552/mo deficit not contextualised against director extraction
**Surface:** MONTHLY CASH FLOW: "−£552 · spending exceeds income this month · liquid cash covers 51.6 months."
**IFA verdict:** For a director this is almost certainly a bookkeeping artefact — he draws low salary + periodic dividends. A monthly cashflow line that treats one month's snapshot as a deficit, without averaging across dividend distributions or flagging "Are you withholding dividend for tax efficiency?", is mis-leading. An adviser would never call this a "deficit" without knowing the extraction strategy.
**Fix:** For director personas, show a 12-month-trailing average instead of a single month, or add a chip: "You're a director — dividends are lumpy. Look at the 12-month line, not this month." Reference §22 entity.persona.flags.

### HIGH-3 — Onshore bond £22k + Offshore bond £19k present, zero chargeable-event copy
**Surface:** Bonds listed in liquidity timeline; no chip on the SAVINGS & INVESTMENTS tile flagging top-slicing relief, 5% withdrawal rule, or that offshore bonds attract 20% withholding tax on UK source income.
**IFA verdict:** For a 35yo holding ~£41k of life-assurance bonds, the segmentation strategy at encashment and the 5% cumulative allowance are core. Onshore vs offshore tax treatment difference (basic-rate credit on onshore; gross-roll on offshore) is exactly the kind of detail this screen should surface as drillable knowledge.
**Fix:** L2 bond cards per §19.x equivalent (currently absent from MyMoney v2.7 — propose adding) with 5% allowance used / remaining, deferred chargeable gain, top-slicing relief estimate.

### HIGH-4 — "Tax-free interest £0 / £500" assumes basic-rate PSA without confirming the band
**Surface:** TAX-FREE ALLOWANCES "Tax-free interest on savings £0 / £500".
**IFA verdict:** PSA is £1,000 basic-rate · £500 higher-rate · £0 additional-rate. With dividends pushing him to upper-rate dividend territory and ANI £78k, £500 is plausibly correct — but the screen never tells the user WHY it's £500. An adviser would want the band rationale visible (it influences ISA priority).
**Fix:** Drillable: "£500 because you're a higher-rate taxpayer (PSA tapers at £50,270)" — cite ITTOIA 2005 s.12B.

### HIGH-5 — "Optimised" / "Strong buffer" copy not visible but the band-name discipline still slips elsewhere
**Surface:** Footers say "Not regulated financial advice. Verify decisions with a qualified UK financial adviser." (good — §16.3.3). But the COST OF DOING NOTHING list ranks items 1–5 by £ severity with a "act on rank 1 first" instruction — that IS an implicit personal recommendation in COBS 9A terms, especially the "£999k retirement funding gap" line.
**IFA verdict:** "Act on rank 1 first" is action-instructional language. The rewrite filter (§16.3.3 item 1) should soften this to "Highest-leverage gap (by estimated £ cost)" with no instruction verb.
**Fix:** Rewrite "act on rank 1 first" → "highest-leverage gap by estimated £ cost". Remove ordinal action commands. Keep the £ ranking.

---

## MEDs

### MED-1 — "5.0 mo of essentials covered" on CASH tile vs "5.7 months" in COST OF DOING NOTHING #5
Internal inconsistency. Same metric, two values within one screen. Pick one (engine-computed) and bind both surfaces.

### MED-2 — Mortgage 3.9% and BTL mortgage 5.4% not ranked vs alternative investment yields
For a 35yo with 30+ years on the mortgage, paying down 3.9% is rarely the leveraged move (vs ISA+pension growth). For BTL at 5.4% post-S24, the answer is closer. An IFA would flag the difference. Currently both look the same.
**Fix:** Within the Liabilities drill, attach a rate-vs-alternative-return note per debt line. Inform-only, not prescriptive.

### MED-3 — Protection £2.67m shown but no needs-analysis chip
For a 35yo director with dependants implied by Domain V obligations, £2.67m life cover may be appropriate or excessive. §20.3 calls for a "protection gap" chip via `calcProtectionGap(entity)` if dependants exist. Currently the tile shows only composition (Other 72% / Trust 28%) — no gap signal either way.
**Fix:** Wire `calcProtectionGap(entity)`. Show "covered" / "gap £X" / "potentially over-insured" three-state chip.

### MED-4 — Student-Loan Plan 2 at 7.4% APR not flagged as RPI-linked
Plan 2 interest is RPI + up to 3% (depending on earnings), not a fixed contractual APR. Showing it as "7.4% APR" without that context misrepresents an interest cost that floats. Also: at ~30 years remaining, the marginal repayment economics depend heavily on expected income trajectory; for high earners Plan 2 often is best treated as a 9%-above-threshold income tax, not a debt to clear.
**Fix:** Plan-2 specific copy in the Liabilities drill: "Plan 2 student loan — repayments are 9% of income above £27,295 for 30 years then written off. Voluntary repayment is rarely optimal at your earnings."

---

## LOWs

### LOW-1 — "315 days" — exact-day countdown to a deadline 11 months out is false precision
Show as "11 months" or "from 6 April 2027".

### LOW-2 — "PROPERTY · Includes a let property — only a small slice of the mortgage interest counts against the rent" is correct but could cite the rule
S.24 ITA 2007 — 20% basic-rate tax reducer on finance costs since April 2020. Add the rule citation per §16.6 versioning discipline.

### LOW-3 — "BUSINESS ASSETS · Tax-free to your heirs after 2 years" — confirm BPR @ 100% vs the £1m cap from April 2026
Per Finance Act 2025 the £1m BPR/APR cap and 50% relief above £1m took effect 6 April 2026 (Autumn Statement 2024). Mr T's £163k is below the cap so 100% is right at his scale — but the copy reads as universally true. Add the cap caveat.

### LOW-4 — "£10.1k of pension tax relief available this tax year (capped by relevant earnings)" — the (capped by relevant earnings) parenthetical is good, but the £10.1k value itself silently assumes the director's relevant earnings = salary not dividend
A dividend-heavy director may have relevant earnings of £12,570 (basic salary) which caps personal contributions at £12,570 gross, not at the £41k AA headroom shown elsewhere. Flag the gap between AA headroom (£41k) and contributable-by-the-person (relevant earnings) — and route the surplus to employer contribution per BLOCK-2.

---

## Summary

- **6 BLOCKs** (1 spec-violation rendering obligations as assets; 1 missing entire director domain; 1 mis-prioritised IHT chip for a 35yo; 1 high-APR debt not flagged; 1 dividend allowance UI bug masking ~£11k tax liability; 1 plan-funded number without drillable rubric)
- **5 HIGHs** (Alternatives tile dead per §19.3; deficit not contextualised for director extraction; bonds invisible; PSA band silent; "act on rank 1" crosses COBS 9A boundary)
- **4 MEDs** (cash-cover inconsistency; mortgage-rate-vs-return; protection gap; Plan-2 misframing)
- **4 LOWs** (false-precision day count; missing S.24 citation; missing BPR cap caveat; relevant-earnings vs AA gap)

**Headline:** the screen still treats Mr T as a generic 35yo retail saver. The director persona switch is set but the screen doesn't act on it. Until Domain X surfaces and the IHT/dividend-allowance logic is life-stage gated, this is not an IFA-grade output.
