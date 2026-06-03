Title: Decumulation Research 4b — The Sequencing Meta-Algorithm (Evaluate-then-Sequence Doctrine)
Version: v1.0
Date: 2026-06-03
Status: DOCUMENTED
Cluster: 3-Engine (the per-holding decumulation solver the new model implements)
File name: 4b-sequencing-doctrine.md
Purpose: The recognised adviser "evaluate-then-sequence" process for ordering withdrawals across ALL asset types, synthesised from the published frameworks (Vanguard, FCA TR24/1, BNY/NextWealth, T. Rowe Price, Fidelity, abrdn, PWS). This is the algorithm the new solver replaces the tax-only 4-bucket model with. Aligns with and extends `~/.claude/plans/goal-engine-design.md` (do not contradict it).

**Summary:** Advisers do not sequence by tax alone — they run a 7-step pipeline: (1) strip out guaranteed-income and flagged/non-spendable holdings, (2) classify every remaining holding by feature, (3) cover the essentials floor from secure income, (4) set the cash buffer / bucket structure for sequence-of-returns risk, (5) pick the goal-weighted ordering objective, (6) fill tax bands per year within that ordering, (7) apply the post-2027 IHT overlay that can REVERSE the classic GIA→ISA→pension order for legacy/IHT-exposed clients. The single biggest correction vs tax-only ordering: secure income covers the floor and the cash buffer protects against forced selling FIRST — tax-band optimisation operates only on the residual, and the 2027 IHT rule can flip pension to first, not last.
**Tags:** #engine #decumulation #sequencing #tax-bands #sequence-risk #iht2027 #goals
**Updated:** 2026-06-03

---

## 0 — Why tax-only ordering is wrong (the thing this replaces)

The current engine sequences 4 aggregate buckets (pension/ISA/GIA/cash) by tax efficiency alone. Three published findings break that:

1. **Sequence-of-returns risk dominates early retirement** (FTAdviser; BNY; Fidelity; T. Rowe Price). Drawing from volatile assets in a down market early permanently damages the pot ("reverse pound-cost averaging"). Half of UK advisers hold a 1–2yr cash buffer specifically to avoid this; only 9% hold none (BNY/NextWealth). A tax-only order ignores WHICH market state you're in.
2. **The classic tax-efficient order (GIA→ISA→pension last) reverses post-6-April-2027** for anyone with IHT exposure, because unused DC pensions enter the estate and can be hit by IHT (40%) *and* beneficiary income tax → effective rates >60% (Fidelity; abrdn; M&G). Pension can become draw-FIRST, not last.
3. **The objective is not fixed.** "Greatest net return" and "greatest after-tax estate" are different objectives that produce different orders (T. Rowe Price). The stated GOAL must select the ordering, not a hardcoded tax rule.

So the doctrine is **evaluate-then-sequence**, goal-conditioned, market-state-aware, with an IHT overlay — not a static ladder.

---

## 1 — THE META-ALGORITHM (7 steps, in order)

### STEP 1 — Exclude guaranteed-income & flagged / non-spendable holdings
Remove from the sequenceable set, up front:
- Guaranteed income: State Pension, DB pension, lifetime annuity, purchased-life annuity (treat as income floors, not assets — see 4a §2).
- `flaggedNonSpendable` holdings: ring-fenced emergency floor, DB CETV (context only), assets the user has locked (e.g. "never sell the family home"), illiquid/penal holdings the user excludes.
- Pre-access-age pensions (cannot draw before 55, rising to 57 from 6 Apr 2028).

**Output:** `secureIncome[]` (floors) + `excluded[]` + `sequenceable[]` (the only set that gets ordered).
**Sources:** goal-engine-design.md §4.5-A; FCA TR24/1 (essential-vs-discretionary hierarchy).

### STEP 2 — Classify every sequenceable holding by feature
For each holding tag: wrapper (`pensionDC | ISA | GIA | cashTaxable | cashISA | MMF | NSI`), tax-on-withdrawal (`marginal-income | CGT-on-gain | tax-free | savings-interest`), liquidity/penalty (instant | notice | fixed-term-break-penalty | T+1 | settlement), embedded gain (for GIA CGT), return/volatility (cash vs bond vs equity), FSCS/Treasury protection, and the cash ROLE from 4a (EMERGENCY-BUFFER / SEQUENCE-RISK-RESERVE / DRAW-FIRST-LOW-RETURN).
This is the core per-holding upgrade: two "ISAs" or two "cash" holdings can sequence differently based on these features.
**Sources:** Vanguard Withdrawal Order whitepaper (per-account tax-drag differs); 4a.

### STEP 3 — Cover the essentials floor from secure income first
Compute `netFloorIncome` = Σ net(State + DB + annuity + PLA + any rental). Subtract from total required income → `residualNeed`. Only `residualNeed` is sequenced.
- If secure income ≥ essentials → portfolio funds only discretionary spend (more sequencing freedom).
- If secure income < essentials → the shortfall is a HARD goal; consider securing it (annuity / floor) before flexing the rest (the floor+guardrail "PenFund / FlexFund" split).
**Sources:** FCA TR24/1 (essential vs discretionary); Fidelity decumulation whitepaper; goal-engine-design.md §1 (floor families).

### STEP 4 — Set the cash buffer / bucket structure (sequence-of-returns defence)
Before ordering the residual draw, establish the SoR defence:
- **Cash buffer:** 1–3 years of `residualNeed` in cash / MMF (EMERGENCY-BUFFER + SEQUENCE-RISK-RESERVE roles). Half of UK advisers use 1–2yr; T. Rowe Price/Fidelity model 2–3yr.
- **Bucket structure (optional, richer):** Bucket 1 cash (0–2yr) · Bucket 2 bonds/low-risk (3–7yr) · Bucket 3 equities (8+yr). Draw 1 → refill from 2 → refill from 3.
- **Market-state branch (this is the dynamic bit):** in a NORMAL/up year, draw per the tax-band order (Step 6). In a DOWN year, draw from the cash buffer / Bucket 1 INSTEAD of selling depressed equities; refill the buffer in strong years. Tax-free sources (ISA, PCLS) also serve as down-market draw without adding to taxable income.
**Sources:** BNY (cash buffer 1–2yr, 50% of advisers); T. Rowe Price (2–3yr buffer + bucketing + dynamic); Fidelity (3 sub-funds); Luis Paiva / freedomisntfree 2026 (1–3yr buffer, refill in good years).

### STEP 5 — Apply the goal-weighted ordering objective
The stated goal selects the base order. The recognised objective→order mapping:

| Stated goal | Objective | Base draw order (pre-IHT overlay) |
|---|---|---|
| **Income floor / never run out** | Max P(floor covered for life) | Secure the floor (annuity/natural income); draw lowest-volatility first; conservative SWR (~3–3.5% start) |
| **Minimise lifetime tax** | Min Σ(income tax + IHT) | Band-fill (Step 6); spread taxable pension across years; time PCLS; gift surplus |
| **Maximise lifetime spend** | Max sustainable net income, deplete ~life expectancy | Dynamic/guardrail SWR; GIA-first to kill tax drag; higher draw |
| **Greatest net return** | Max portfolio net return | **Deplete GIA first** (highest tax drag), then ISA/pension; annual crystallisation of gains (Vanguard) |
| **Maximise legacy / after-tax estate** | Max after-IHT estate to heirs | **Post-2027: pension can go FIRST** (shrink the IHT-exposed pot during life), preserve ISA/wrapper-transferable assets — see Step 7 |

Key published anchor (Vanguard UK Withdrawal Order): generally **deplete GIA first** (greatest tax drag; shrinking it reduces future taxable gains), then little difference ISA vs DC pot — *but IHT treatment and creditor protection mean most are better off drawing ISA before pension*. That "ISA before pension" tail is exactly what 2027 overturns for IHT-exposed clients.
**Sources:** Vanguard Withdrawal Order; T. Rowe Price (objective must be chosen); goal-engine-design.md §2 normalisation table.

### STEP 6 — Fill tax bands each year (within the goal order)
Annual tax-band optimisation on the residual:
1. **Use the personal allowance** (£12,570) with taxable pension income — especially in the pre-State-Pension bridge years when other taxable income is low.
2. **Fill the basic-rate band** (to £50,270) with pension income where the goal favours pension drawdown; STOP before the higher-rate threshold.
3. **Top up the rest of the income need from tax-free sources** — ISA withdrawals and the 25% PCLS — so total income stays under the next band.
4. **Use the starting-rate-for-savings band** (£5,000 at 0%, tapered away £1-for-£1 by non-savings income above the PA; gone by £17,570 non-savings income) and the **PSA** (£1k/£500/£0) for cash interest — draw taxable cash where these bands are unused.
5. **Phase the PCLS** rather than taking 25% in one lump (avoids parking tax-free cash in low-return cash, keeps wrapper shelter).
6. **Watch cliff edges** the band-fill must not trip: £100k PA taper, £60k HICBC end, additional-rate £125,140.
The pre-State-Pension window is the prime band-filling opportunity (more room before STP adds taxable income); once STP starts, ISA top-ups become more valuable (PWS; freedomisntfree; Luis Paiva).
**Sources:** PWS ("pension to a sensible tax level, ISA for the rest"); freedomisntfree 2026 tactical guide; Luis Paiva 2026; 4a §3 (verified bands).

### STEP 7 — Apply the post-2027 IHT overlay (can REVERSE Step 5/6)
From **6 April 2027**, unused DC pensions and most pension death benefits enter the estate for IHT (Finance Act 2026 / ENACTED; spouse and charity exempt; death-in-service and dependants' scheme pensions excluded). For an IHT-exposed client this flips the classic order:
- Old default: GIA → ISA → **pension LAST** (pension was IHT-free, leave it growing).
- Post-2027 for IHT-exposed legacy/min-tax goals: **draw the pension DURING lifetime** within the basic-rate band, take the 25% PCLS, recycle net into ISA or **gift from surplus income** (normal-expenditure-out-of-income exemption) → shrinks the pot that would otherwise face IHT 40% + beneficiary income tax (>60% combined). Income tax and IHT become ONE optimisation.
- This is goal-conditioned: it applies when `legacy` or `min_lifetime_tax` ranks high AND the estate is IHT-exposed. For a non-IHT-exposed client, the classic ISA-before-pension order still stands.
**Sources:** L&G, Royal London, Standard Life, Rathbones, M&G, Fidelity (9 ways) adviser notes on April 2027; abrdn (pensions-IHT advice); goal-engine-design.md §1.

---

## 2 — Output contract (what the solver returns per path)
Reuse the locked contract in goal-engine-design.md §4.5-B/C. Each candidate path (goal-tuned + standard GIA-first / pension-first / ISA-first) carries: `schedule[]` (per year `{year, age, fromHolding, gross, tax, net, ihtDelta, marketState, sourceSwitch}`), `scoreBreakdown` per objective, `rationale[]` ("advisers generally…"), plus `methodology` (rules + status + assumptions, §4.6). Solver returns 2–4 comparable, selectable paths so the user can branch (e.g. "show the legacy-max one").

## 3 — The 5 withdrawal-rate methods are orthogonal to ordering
Bengen / Guyton-Klinger / Vanguard-dynamic / Bucket / Sonuswealth floor+guardrail set HOW MUCH to draw (the rate + guardrails); this doctrine sets WHERE from (the order). The active goal selects appropriate methods (legacy → lower/natural-income; max-spend → dynamic guardrail; income-floor → floor+guardrail). They compose; they are not alternatives to sequencing.

## 4 — FCA boundary
Outputs are "optimal under your stated priorities", ranges not single confident lines, framed "advisers generally…" / "illustrative under your assumptions", never "you should". The legacy / min-tax / draw-order outputs are the closest to a personal recommendation → gated by sonuswealth-compliance + ifa-auditor before ship (goal-engine-design.md §5). Info/guidance/storage stance: factual, no product surfacing, no lead-gen.

---

## 5 — Sources (status: all ENACTED rules verified June 2026; frameworks are adviser-consensus, not law)
- Vanguard UK — *Withdrawal Order: making the most of retirement assets* (GIA-first, annual crystallisation; ISA-before-pension tail).
- FCA TR24/1 — Retirement income advice thematic review (essential-vs-discretionary, withdrawal strategy, capacity for loss in decumulation).
- BNY Investments (May 2026) + BNY/NextWealth — cash buffer 1–2yr, 50% of advisers use one, 9% none.
- T. Rowe Price — *Beyond sequencing risk: dynamic withdrawals* (cash buffer 2–3yr, bucketing, dynamic).
- Fidelity Adviser Solutions — *Surviving retirement* decumulation whitepaper (3 sub-funds; tax-free cash/ISA as SoR defence).
- FTAdviser (Aug 2025) — *The art of decumulation* (SoR risk, bucketing as adviser default).
- PWS Financial (Mar 2026) — cash/ISA/pension order; "pension to a sensible tax level, ISA for the rest".
- freedomisntfree (Apr 2026); Luis Paiva (May 2026) — 2026 tactical drawdown guides (PA-fill, 1–3yr buffer).
- L&G, Royal London, Standard Life, Rathbones, M&G, abrdn, Fidelity (9 ways) — April-2027 pension-IHT adviser guidance (order reversal, >60% combined rate, gift-from-surplus-income).
- goal-engine-design.md (2026-06-02) — the existing internal plan this doctrine implements.

## 6 — Unverifiable / open
- **Exact post-2027 mechanics of estate-pension administration** (who pays, liquidity timing, PR responsibilities) are still settling — adviser notes flag operational uncertainty even though the IHT inclusion is ENACTED. Treat the *order reversal* as solid; treat *precise admin/timing* as ESTIMATED until HMRC finalises.
- **Live cash/bond/MMF market rates** are indicative, not rule-grade (read per holding; do not hardcode).
