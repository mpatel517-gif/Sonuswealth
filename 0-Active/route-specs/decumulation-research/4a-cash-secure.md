Title: Decumulation Research 4a — Cash & Secure-Income Per-Type Table
Version: v1.0
Date: 2026-06-03
Status: DOCUMENTED
Cluster: 3-Engine (goal/decumulation engine) · cross-ref 2-Product MyMoney/Cashflow
File name: 4a-cash-secure.md
Purpose: Feature-aware per-type reference for the "cash" taxonomy (11 types) + secure-income streams, so the per-holding decumulation solver can classify each cash/secure holding by ROLE (emergency buffer / sequence-risk reserve / draw-first-low-return) and tax behaviour — not lump them into one "cash" bucket sequenced by tax alone.

**Summary:** Cash is not one thing for a drawdown solver — it splits into three functional roles (emergency floor that is never drawn for income, a 1–3yr sequence-risk reserve drawn only in down markets, and surplus low-return cash that is drawn FIRST in normal markets); secure-income streams (State/DB/annuity) are NON-spendable floors that reduce the income the portfolio must generate, never assets to deplete.
**Tags:** #engine #decumulation #cash #secure-income #taxonomy
**Updated:** 2026-06-03

---

## 0 — How the solver must treat this whole class (the headline)

Two structural rules that the old tax-only 4-bucket model gets wrong:

1. **Cash is not a single bucket.** A per-holding solver must tag each cash holding with a ROLE. The same £ of "cash" can be untouchable (emergency floor), conditionally drawn (sequence-risk reserve, only when markets are down), or drawn first (surplus low-return cash). Sequencing "cash first by tax" is wrong because it would spend the emergency floor and the sequence reserve before they have done their job.
2. **Secure income is not an asset to deplete — it is a floor that shrinks the withdrawal need.** State Pension, DB pension and lifetime annuities are guaranteed income streams. They must be SUBTRACTED from the required income before the solver sequences anything. They are explicitly flagged NON-spendable (per goal-engine-design.md §4.5-A: "DB … NEVER rendered or solved as a spendable pot"). Same for the annuity once purchased — the capital is gone, only the income remains.

---

## 1 — Cash / near-cash types (taxonomy "cash", 11)

Tax columns reference the verified 2026/27 rules in §3. "Role" uses the three-role model: **EMERGENCY-BUFFER** (untouchable floor), **SEQUENCE-RISK-RESERVE** (drawn only in down markets, 1–3yr), **DRAW-FIRST-LOW-RETURN** (surplus cash, spent first in normal markets).

| Type | Return (2026, indicative) | Tax | Penalty / access | Protection | Default solver role |
|---|---|---|---|---|---|
| **Instant-access savings** | ~4.0–5.0% AER variable | Interest taxable; covered by PSA then starting-rate band; marginal-rate above | None — instant | FSCS £120k per banking licence | DRAW-FIRST-LOW-RETURN (and host of EMERGENCY-BUFFER) |
| **Fixed-term bond / fixed-rate saver** | ~4.5–4.87% AER, term-locked | Interest taxable (PSA/starting rate) | **No automatic right to break.** If permitted: loss of 60–180 days' interest (commonly 90); some only on death/terminal illness. 14-day cooling-off at open. | FSCS £120k | SEQUENCE-RISK-RESERVE if maturity ladders to need; else DRAW-FIRST once matured. Penalty must gate early draw. |
| **Notice account** | ~4.0–4.8% AER variable | Interest taxable (PSA/starting rate) | Must give notice (7–180d, commonly 30/60/90) before release; some allow no early withdrawal, rare early access loses interest | FSCS £120k | SEQUENCE-RISK-RESERVE (notice lag = not emergency-grade); DRAW-FIRST if surplus |
| **Cash ISA** | ~4.5–4.67% AER (fix) / variable | **Interest tax-FREE** (inside wrapper) | Fixed cash ISA must by law allow early access for an interest penalty; instant-access cash ISA none | FSCS £120k | DRAW-LATER among cash (tax-free shelter — see §0 of 4b: don't waste it early). Can serve EMERGENCY-BUFFER if instant-access. |
| **NS&I Income Bonds** | 3.01% gross / 3.05% AER, interest paid monthly | Interest taxable (PSA/starting rate) | Instant access, no penalty | **100% HM-Treasury backed, NO upper limit** (not FSCS-capped) | DRAW-FIRST-LOW-RETURN (low yield); useful EMERGENCY-BUFFER for >£120k holders (no FSCS cap) |
| **NS&I Direct Saver** | 3.05% gross/AER variable | Interest taxable (PSA/starting rate) | Instant access | 100% Treasury-backed, no limit | DRAW-FIRST-LOW-RETURN; large-balance safe harbour |
| **Premium Bonds (NS&I)** | Prize fund 3.30% (Apr 2026 draw) → **3.80% from July 2026 draw**; odds 22,000→1 then 23,000→1; expected return is a MEDIAN, most holders earn less | **Prizes tax-FREE** (income tax + CGT exempt) | Instant (cash out, ~next working days) | 100% Treasury-backed, no limit | DRAW-FIRST-LOW-RETURN (no guaranteed yield, lumpy); tax-free attraction for additional-rate savers who've used PSA |
| **Current account** | ~0–3% (some reward accounts) | Interest taxable (PSA/starting rate) | Instant | FSCS £120k | EMERGENCY-BUFFER (working float) + DRAW-FIRST surplus |
| **Money-market fund (MMF)** | ~4.50–4.75% net of fees (tracks BoE base ~3.75% gross) | Held in GIA → interest/yield taxable; in ISA/SIPP → sheltered. Platform fee can shave ~0.2% | T+1 settle (next business day) + 1–2d to bank | **NOT FSCS-protected** (fund structure); underlying very low risk; small gating risk in crisis | SEQUENCE-RISK-RESERVE (ISA/SIPP cash leg, large pots beyond FSCS); NOT emergency-grade (T+1 + crisis-gating risk) |
| **Sharia (profit-share) account** | Expected profit rate (not interest) ~ comparable to savings | Profit treated as savings income for tax (PSA/starting rate apply) | Per product (instant / fixed-term equivalents exist) | FSCS £120k (UK-authorised) | Mirror conventional equivalent by access type |
| **Foreign-currency cash** | Local-currency interest | Interest taxable; **FX gain/loss + CGT on non-£ cash disposals possible**; reporting | Per account | FSCS only if UK-authorised £-equivalent; FX risk uninsurable | LAST-RESORT for income (FX + tax friction); flag as not a clean income source |

### Per-type notes that change sequencing
- **Fixed-term break penalty is a first-class solver input**, not a footnote. Drawing from a fixed bond mid-term can destroy more value (lost interest) than the tax saved by drawing it "first". The solver must compare net-of-penalty proceeds against the next-best holding.
- **Cash ISA is tax-free cash** — it sits LATER in the cash draw order than taxable cash (spend the taxable, lower-return cash first; preserve the tax-free shelter), unless it is the only instant-access pot available for the emergency floor.
- **NS&I (Income Bonds, Direct Saver, Premium Bonds) escapes the FSCS £120k cap** — for households above £120k per bank, NS&I is the natural large-balance safe harbour and can hold the emergency floor without splitting across licences.
- **MMFs are not FSCS-protected and settle T+1** — good for the sequence-risk reserve inside a wrapper, wrong for the true emergency floor.

---

## 2 — Secure / guaranteed-income streams (cross-ref; NON-spendable)

These are NOT assets in the withdrawal sequence. They are floors. The solver subtracts their net income from the required income, then sequences the remaining (flexible) need across the spendable pots.

| Stream | Nature | Tax | In withdrawal sequence? | Role |
|---|---|---|---|---|
| **State Pension** | Guaranteed lifetime, triple-locked; full new STP ~£12,548/yr 2026/27 (DWP) | Taxable income, **paid gross** — uses personal allowance, so reduces headroom for tax-band-filling from pensions | NO — floor | Covers essentials floor; its START AGE creates the pre-STP "bridge" window where pension drawdown into low bands is most valuable |
| **DB / final-salary pension** | Guaranteed income for life (+ spouse %) | Taxable income (PAYE) | **NO — never solved as a spendable pot.** CETV shown for context only | Essentials floor; reduces flexible need. CETV transfer = advice-only, out of scope |
| **Lifetime annuity** | Guaranteed income for life bought with pension capital | Taxable income | NO — capital already gone, only income remains | Essentials floor; the floor+guardrail "PenFund" piece |
| **Purchased-life annuity (PLA)** | Bought with non-pension capital | **Split: capital element tax-free, only interest element taxed** (favourable vs lifetime annuity) | NO — income stream | Floor; tax-efficient secured income from non-pension money |
| **Rental income** | Property-derived income (cross-ref property taxonomy) | Taxable (property income, mortgage-interest restricted to 20% credit); not NIC | NO — income stream, not depleted unless property sold | Floor / discretionary-income layer; property sale is a separate liquidity event |

**Engine consequence:** floor income is computed FIRST → required portfolio income = total need − net floor income → only that residual is sequenced across cash + spendable pots. The State Pension start age defines the bridge window that makes pre-STP pension-band-filling valuable (§4b step 5).

---

## 3 — Verified UK 2026/27 rules (cite + status)

| Rule | Value 2026/27 | Status | Source |
|---|---|---|---|
| Personal Savings Allowance | £1,000 basic / £500 higher / **£0 additional-rate** | ENACTED | HL PSA guide 2026/27; LITRG |
| Starting rate for savings | £5,000 band at 0%; **tapered £1-for-£1 by non-savings income above the £12,570 personal allowance**; fully gone once non-savings income ≥ £17,570. **Frozen 2026/27→2030/31** | ENACTED (freeze confirmed) | LITRG; MSE; taxesdoneright (freeze) |
| Cash ISA subscription limit | £20,000/yr (all-ISA combined) | ENACTED | PWS; HL |
| **FSCS deposit protection** | **£120,000 per person per banking licence** (raised from £85,000 on **1 Dec 2025**) | ENACTED — *corrects the brief's stated £85k* | FSCS; MSE; PRA final rules |
| NS&I protection | 100% HM-Treasury backed, **no upper limit** (not FSCS-capped) | ENACTED | NS&I; Go.Compare |
| Premium Bonds prize rate | 3.30% (Apr 2026 draw) → **3.80% from July 2026 draw**; odds 23,000→1 then 22,000→1; prizes tax-free | ENACTED (July rise announced May 2026) | NS&I Corporate; MSE |
| NS&I Income Bonds | 3.01% gross / 3.05% AER (variable), monthly interest, taxable | ENACTED (as at June 2026) | NS&I product page |
| NS&I Direct Saver | 3.05% gross/AER variable | ENACTED (as at June 2026) | NS&I |
| Full new State Pension | ~£12,548/yr (£241.30/wk × 52) | ENACTED | DWP 2026/27 (tax-2026.json correction log) |

**Data-freshness caveat:** instant-access / fixed-bond / notice / MMF / Cash-ISA market rates move continuously — the % figures above are indicative June-2026 market levels, NOT fixed rules. The solver should read live rates per holding (or the user's actual product rate), not hardcode these. Only the tax rules, allowances, FSCS limit and NS&I rates are rule-grade.

---

## 4 — Data fields the engine needs per cash/secure holding

To classify role and sequence per-holding (replacing the aggregate "cash bucket"):

**Cash holdings:**
- `type` (from the 11 above) · `balance` · `ccy`
- `rate` (live or user-stated AER/gross) · `rateType` (fixed | variable | prize)
- `access`: `{ kind: instant | notice | fixedTerm, noticeDays?, termEnd?, breakPenaltyDays?, earlyAccessAllowed? }`
- `taxWrapper`: `none | cashISA | sippCashLeg | giaCashLeg`
- `protection`: `{ scheme: FSCS | NSI_TREASURY | NONE, licenceId (for FSCS £120k aggregation), capped: bool }`
- `roleHint` (user/engine): `EMERGENCY-BUFFER | SEQUENCE-RISK-RESERVE | DRAW-FIRST-LOW-RETURN`
- `flaggedNonSpendable` (bool) — e.g. ring-fenced emergency floor

**Secure-income streams:**
- `streamType` (state | DB | lifetimeAnnuity | PLA | rental)
- `grossAnnual` · `taxTreatment` (`fullyTaxable | capitalElementExempt | propertyIncome`)
- `startAge` / `inPayment` (bool) · `escalation` (e.g. triple-lock, RPI, level)
- `survivorPct` (DB/annuity spouse continuation)
- `flaggedNonSpendable: true` (always — these never enter the sequence)
- `cetv` (DB only, context display, never sequenced)

**Derived (engine):**
- `netFloorIncome` = Σ net secure-income → drives required-portfolio-income residual
- `fscsHeadroom` per licence (alert if a single-licence cash holding > £120k)
- `effectiveRoleOrder` for cash within a year (down-market vs normal-market branch)
