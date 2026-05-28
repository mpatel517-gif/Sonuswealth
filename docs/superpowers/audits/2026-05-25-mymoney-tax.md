# MyMoney — UK Tax Accuracy Audit (Chartered-accountant lens)

**Audit date:** 2026-05-25
**Persona under test:** Bruce Wayne (`?demo=mrt` → `personaA`, persona-a.json)
**Tax year on screen:** UK 2026/27 (6 Apr 2026 → 5 Apr 2027)
**Auditor stance:** ICAEW/CTA — Finance Act 2026 (Royal Assent 18 Mar 2026) is in force; SIPP-into-IHT ENACTED, effective 6 Apr 2027.
**Sources cited:**
- `app-prototype/rules-uk.js` (verified 2026-05-15)
- `src/engine/modules/uk-tax-2026-1-1.js` §§2.3–2.5
- `src/engine/modules/uk-pension-2026-1-1.js` §§MPAA, PCLS
- `src/engine/modules/uk-estate-2026-1-1.js` §§5.3/5.3a
- `src/rules/personas/persona-a.json` (Bruce, age 62, **not higher-rate**)

---

## 0 — Persona facts that change the maths

`persona-a.json` lines 14–202 establish:
- `age: 62`, `lifeStage: 5 Decumulation`, drawdown plan starts 2026-10-01
- `isHigherRateTaxpayer: false`
- Income: State pension £11,973 (starts age 67, not yet in payment) + dividends £16,000 + BTL net rental £19,200 → **2026/27 receipts ≈ £35,200** (state pension N/A until age 67). Even if SP added: ~£47k. **Bruce is a BASIC-RATE taxpayer in 2026/27.** Not higher rate.
- `targetIncome: 120,000` and `drawdownPlan.targetAnnual: 96,000` — but no drawdown has started (`crystalised: 0`, `tfcTaken: 0`).

This single fact breaks half of the screen's tax-impact copy.

---

## 1 — PENSION ROOM "£60k pension room … £12.0k of tax relief gone forever"

**Claim on screen:** "£60k of pension room left this year · COST OF WAITING: £12.0k of tax relief gone forever if not used by 5 April"

**Rule check (Annual Allowance):**
- `rules-uk.js` §pension.annual_allowance = **£60,000 ENACTED** ✔ matches.
- Tapered AA bites where threshold income > £200k AND adjusted income > £260k (UK-PEN-08 in `uk-pension-2026-1-1.js`). Bruce: ANI ≈ £35–47k, well below £260k — **no taper**. Full £60k AA is correct. ✔
- MPAA = £10k (`rules-uk.js` §pension.mpaa). Bruce has NOT yet drawn flexibly (`tfcTaken: 0`, `drawdown: 0`), so MPAA is not triggered. £60k still available. ✔

**Rule check (tax relief £12k):**
£12,000 ÷ £60,000 = **20%** — basic-rate relief only.
- That maths is *internally* consistent for a basic-rate taxpayer.
- BUT it is wrong for the dominant funder profile of someone who would normally read this card (high-earner accumulator). And on this very persona it is misleading in the OTHER direction: Bruce **has zero "relievable earnings"** in 2026/27 because `income.employment = 0` and `income.selfEmployed = 0`. Under FA 2004 s189, personal contributions are restricted to **the greater of (a) £3,600 gross, or (b) UK relevant earnings**. Rental income and dividends are NOT relevant earnings. Bruce cannot put £60k in and get £12k relief — he can put in **£3,600 gross** (£2,880 net + £720 relief). The "£60k room … £12k relief" claim is **factually impossible** for this persona.

**Severity:** **BLOCK.** Founder-facing "cost of waiting £12.0k" is a number a user could act on. It (a) silently assumes basic-rate when most pension-room users will be higher/additional (relief £24k or £27k, not £12k), and (b) for the actual loaded persona it overstates by ~17× (real headroom is £3,600 gross → £720 relief, not £60k → £12k).

**Citation:** Finance Act 2004 s189 "relevant UK earnings"; `uk-pension-2026-1-1.js` §contributions; `rules-uk.js` §pension.

**Fix direction:**
1. Compute `relievableEarnings = max(3600, employment + selfEmployed + tradingProfit)` per FA 2004 s189.
2. Cap "room left" at `min(AA − contributionsYTD, relievableEarnings)`.
3. Apply taxpayer's actual marginal-rate relief (read `getTaxBand(entity)` not hardcode 20%).
4. Show carry-forward separately (3 prior years; UK-PEN-06).

---

## 2 — ISA "£20k of [allowance left]"

**Rule check:** `rules-uk.js` §isa.annual_allowance = **£20,000 ENACTED 2026/27** ✔. Note: the £12k Cash-ISA sub-limit for under-65s lands **6 April 2027** — does not bind 2026/27, and Bruce (62 in May 2026) will be **65 by April 2029**, so the sub-limit would apply for 2027/28 and 2028/29 then drop off. Worth a `note` in the drill, not on the card.

**Severity:** **LOW.** Headline number correct. The 2027 Cash-ISA sub-limit is a coming-soon footnote, not an error.

---

## 3 — CASH "£1,240/yr in interest tax — wrapping into an ISA would shield it"

**Persona data:** `assets.cash.total = £180,000`, `rate = 4.5%` → gross interest = **£8,100/yr**.

**Personal Savings Allowance (`uk-tax-2026-1-1.js` §2.4, lines 466–476):**
- Basic-rate PSA = £1,000; higher = £500; additional = £0.
- Bruce is basic-rate → PSA £1,000. Starting Rate for Savings (£5,000 band) tapers £1-for-£1 against non-savings non-dividend income above the Personal Allowance. Non-savings non-div = rental £19,200 (PA £12,570 absorbs first; remainder £6,630 fully consumes the £5,000 SRS band). So **SRS = £0** for Bruce.
- Taxable savings interest = £8,100 − £1,000 PSA = £7,100 at 20% = **£1,420**.

**Screen says £1,240/yr.** Discrepancy = £180. Three possible engine assumptions could give £1,240:
- (a) the engine is using a different cash balance, or
- (b) it's assuming a slightly lower rate (e.g. 4.3%: £180k × 4.3% = £7,740 − £1,000 = £6,740 × 20% = £1,348 — still not £1,240), or
- (c) it includes a partial Starting Rate for Savings (incorrect for this persona — rental income blocks it).

**Severity:** **HIGH.** Headline tax bill is off by £180 (≈ 13%). Likely a calc-engine bug where SRS isn't being properly tapered for non-savings income. Verify against `fq-calculator.js` (the actual SoT per memory `reference_uk_tax_source_of_truth.md`).

**Compliance side-note (separate FCA-boundary issue, not tax):** "wrapping into an ISA would shield it" is recommendation language, flagged in evidence pack §E20. Tax mechanics are correct (ISA interest is exempt), framing isn't.

**Fix direction:** Display computed-from-engine, not hardcoded. Show: `£8,100 × (1 − £1,000 PSA) × 20% = £1,420`. Add drill that exposes PSA, SRS, and marginal-rate inputs.

---

## 4 — PROTECTION "Life cover is held in trust — pays out to family directly, no inheritance tax on it"

**Rule check (IHTA 1984 s5 + s49; HMRC IHTM10082):**
- Life policy written in trust at inception (Bruce's `protection.lifeInsurance.inTrust: true`) is correctly OUTSIDE the deceased's estate. ✔
- Pays directly to trustees, bypasses probate, no IHT on settlor's death. ✔ on the basic fact.

**What's missing — chartered-accountant nuance:**
1. **Periodic & exit charges.** If the trust is **discretionary** (Bruce's `trustGifts.trustType: "Discretionary"` suggests his other trust is discretionary; the life-policy trust type is not specified in JSON — risk that it is too), the trust suffers 10-year periodic charges (up to 6%) and exit charges under IHTA 1984 s64–s65. Bare/absolute trusts avoid this. The screen makes a blanket "no IHT" claim without flagging trust-type matters.
2. **Settlor-related risk.** If premiums were paid as gifts that exceed exemptions and the settlor dies within 7 years, the *premiums* (not the sum assured) may attract IHT (PETs/CLT mechanics). Bruce's premium is £185 — exempt under "regular gifts from income" (IHTA s21) almost certainly, but the principle should be footnoted.
3. **Gift with reservation of benefit.** Not relevant here (settlor has no benefit from a life policy on own life), but worth covering in the drill for couple/joint-life cases.

**Severity:** **MED.** Headline accurate; absence of nuance pushes toward "advice" territory and could mislead. Add a "what would change this" footer in the drill (trust type / premium gifting / 7-year clock).

---

## 5 — SIPP £850k — cross-tab IHT consistency

**Rule check (`rules-uk.js` §pension.sipp_iht):** ENACTED, effective 6 Apr 2027. Finance Act 2026 Royal Assent 18 Mar 2026. ✔ already correctly framed elsewhere ("D-SIPP-ENACTED" in hot.md).

**Evidence pack shows Home displays:** "315 days until 6 April 2027 · exposure £340k". On MyMoney the £850k SIPP appears on the PENSIONS tile with NO IHT exposure chip and NO countdown.

**Why this matters from a tax perspective:**
- £850k SIPP entering the chargeable estate from Apr 2027 is the single largest IHT event in Bruce's plan.
- Bruce's existing NRB+RNRB = £500k (frozen to 2031, `rules-uk.js` §iht). Net estate before SIPP ≈ residence £1.8m + ISA £420k + GIA £380k + cash £180k + BTL £450k − BTL mortgage £180k − reliefs = ~£3.05m. Adding £850k SIPP → ~£3.9m. At 40% over £500k = **~£1.36m IHT**. Without the SIPP entering: ~£1.02m. **Marginal IHT cost of inaction = ~£340k** — which is exactly the figure Home is showing.
- MyMoney is silent on this on a screen that explicitly displays the £850k value. That's a tax-presentation inconsistency: Home says "exposure £340k" while MyMoney's PENSIONS tile reads as if the £850k is safely ring-fenced.

**Severity:** **HIGH** (cross-tab consistency). Not a wrong number on MyMoney — a missing one that exists on Home for the same data. T&E spec §Q1.2 should canonicalise the chip placement.

**Fix direction:** Render the same `sippIhtExposure` ribbon on the PENSIONS tile (read from canonical-coi or tax-estate-engine). Don't recompute.

---

## 6 — ALTERNATIVES "Chattels under £6k disposal: no CGT"

**Rule check (TCGA 1992 s262):** Chattels exemption £6,000 per asset on disposal. **Limit unchanged for 2026/27.** ✔
- More precisely: gain fully exempt if proceeds ≤ £6,000; marginal relief (gain capped at 5/3 × (proceeds − £6,000)) if proceeds between £6k and ~£15k. The screen's shorthand "no CGT under £6k disposal" is accurate but incomplete.
- Wasting chattels (≤50-year life: clocks, racehorses, machinery) are exempt under TCGA 1992 s45 regardless of value — not mentioned. For an "Alternatives" category that includes wine, this matters (wine = wasting chattel by HMRC concession).
- AEA (annual exempt amount) is £3,000 (`rules-uk.js` §cgt). For chattels falling outside s262, the AEA is the next line of defence — also not mentioned.

**Severity:** **LOW.** Headline correct. Drill should explain: (a) chattels exemption + marginal relief, (b) wasting-chattels rule for wine, (c) AEA fallback, (d) CGT rates 18%/24% (FA 2024-25 from 30 Oct 2024 onwards).

---

## 7 — PROPERTY (drill not captured; spec referenced)

Without the actual drill render I can't audit numerals, but I can pre-flight the rules that MUST be present given `persona-a.json` shows a £450k BTL with £180k mortgage and £24k gross / £19.2k net rental:

- **S24 finance-cost restriction** — mortgage interest relief is 20% basic-rate tax credit only, not deductible. Bruce's £1,100/mo × 12 × ~80% interest portion = ~£10,560 finance cost → £2,112 tax credit. Engine must NOT deduct interest from gross rental.
- **Wear & tear** — abolished 2016; replaced by replacement-of-domestic-items relief.
- **SDLT on BTL purchase** — Bruce purchased 2018, so historical 3% surcharge applied. Current SDLT surcharge on additional dwellings is **5%** since 31 Oct 2024 — relevant if drill says "if you bought today".
- **CGT on disposal** — residential rate 24% higher / 18% basic (`rules-uk.js` §cgt.rates). Bruce basic-rate but a £140k gain (£450k − £310k base cost) would push him into higher rate for that disposal. Engine must stack the gain on top of taxable income for band calc.

**Severity:** **HIGH** pending drill capture. These are the items chartered accountants get queried on most.

---

## 8 — HEADER "UK tax 2026/27"

**Rule check:**
- 2026/27 = 6 Apr 2026 → 5 Apr 2027 ✔.
- Persona `dataLastUpdated: 2026-05-18`, screen rendered 2026-05-25 → in-year is correct.
- `rulesVersion: "UK-2026.1"` matches `rules-uk.js _meta.tax_year`.

**Severity:** **LOW.** Correct. (Founder-feedback: the label "Tax year ▼ UK tax 2026/27" still has the redundancy issue noted in evidence pack §B9.)

---

## 9 — DIVIDEND TAX (not surfaced on card, but persona has £16k)

Bruce's £16k dividends should be taxed in the drill. New Finance Act 2026 rates per `uk-tax-2026-1-1.js` line 443:
- **10.75% basic / 35.75% higher / 39.35% additional** (was 8.75% / 33.75% / 39.35% pre-FA2026; +2pp on basic and higher per hot.md "Finance Act 2026 changes: dividend rates +2pp").
- Dividend Allowance = £500.

Bruce, basic-rate, £16k dividends: (£16,000 − £500) × 10.75% = **£1,666** dividend tax.
On screen: not currently shown on MyMoney top level. Should be a chip in the drill alongside PSA.

**Severity:** **MED** (missing rather than wrong). Surfacing the +2pp FA 2026 increase is exactly the kind of in-year news a tax-accuracy product should put forward.

---

## Severity summary

| # | Item | Severity | Rule source |
|---|------|----------|------------|
| 1 | "£12k tax relief" — relievable earnings + marginal rate ignored | **BLOCK** | FA 2004 s189; `uk-pension-2026-1-1.js`; `rules-uk.js` |
| 3 | "£1,240/yr interest tax" — likely SRS misapplied → real ≈ £1,420 | **HIGH** | `uk-tax-2026-1-1.js` §2.4 |
| 5 | SIPP £850k IHT exposure missing on MyMoney (shown on Home) | **HIGH** | `rules-uk.js` §pension.sipp_iht |
| 7 | Property drill: S24, SDLT 5%, CGT band-stacking — not yet audited | **HIGH** (pending) | TCGA 1992; FA 2024-25 |
| 4 | Life cover in trust — discretionary periodic charges nuance missing | **MED** | IHTA 1984 s64–s65 |
| 9 | Dividend tax @ FA2026 10.75% basic not surfaced | **MED** | `uk-tax-2026-1-1.js` §2.3 line 443 |
| 2 | ISA £20k correct; Cash-ISA sub-limit 2027 footnote missing | **LOW** | `rules-uk.js` §isa |
| 6 | Chattels £6k correct; wasting chattels/marginal relief missing | **LOW** | TCGA 1992 s262, s45 |
| 8 | Header "UK tax 2026/27" correct | **LOW** | `rules-uk.js` _meta |

**Two BLOCK/HIGH items must move before this screen is presented as "tax-accurate":** the pension-relief number and the cash-interest tax number. Both are headline figures a user could act on, and both are wrong for the displayed persona.
