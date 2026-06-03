Title: Per-Scheme Decumulation Decision Taxonomy — Retirement-Income Assets
Version: 1.0
Date: 2026-06-03
Status: DOCUMENTED
Cluster: 3-Engine (decumulation redesign) + asset-taxonomy
File name: 1-retirement-income.md
Purpose: Replace the engine's wrong "one aggregated pension pot, sequence by tax alone" model with a per-scheme decision taxonomy that respects costs, guarantees, constraints, and death treatment for every retirement-income asset type.

**Summary:** For each pension / retirement-income asset type, the factual factors an adviser checks before deciding whether a scheme is drawn down, annuitised, left untouched as secure income, consolidated-first, or flagged for specialist advice — so the engine stops blending guarantees and high-charge legacy pots into a single drawdown pool.
**Tags:** #engine #decumulation #pensions #taxonomy
**Updated:** 2026-06-03

> **Framing (information / guidance, NOT regulated advice).** Everything below is a list of factual factors an adviser evaluates. No "you should". The platform surfaces these as decision inputs; it does not recommend a course of action.

---

## 0 — The core error this fixes

The engine currently aggregates SIPP + workplace DC + DB + state + annuity into one notional "pension pot" and sequences withdrawals by marginal tax alone. That is wrong on five counts:

1. **DB / state / annuity are not pots** — they are guaranteed income streams. You cannot "withdraw" from them; modelling them as a spendable balance overstates liquid wealth and understates secure income.
2. **GAR pensions** carry a guaranteed annuity rate (often 9–11%, sometimes worth ~40% of fund value) that is forfeited the instant the pot is moved to drawdown.
3. **Protected tax-free cash** (>25%, common on Section 32 / RAC) breaks the universal "25% PCLS" assumption baked into a tax-only sequencer.
4. **High-charge legacy pots** (1–2%+ AMC, with-profits) should usually be drained or consolidated *before* low-charge pots — a tax-only model ignores charge drag entirely.
5. **MPAA, MVR, GMP, crystallisation status, exit penalties** are per-scheme constraints that change which pot is touched first and whether touching it has a side-effect (e.g. collapsing future contribution room to £10k).

The fix is a **DRAW-CLASSIFICATION** per scheme plus the per-scheme data fields needed to derive it.

---

## 1 — Per-type decision table

Columns: **Costs adviser checks · Key features/guarantees · Constraints/penalties · Tax on drawdown · Death/IHT treatment · DRAW-CLASSIFICATION**

| Type (taxonomy ID) | Costs adviser checks | Key features / guarantees | Constraints / penalties | Tax on drawdown | Death / IHT treatment | DRAW-CLASSIFICATION |
|---|---|---|---|---|---|---|
| **SIPP** | Platform fee, OCF of underlying funds, dealing/FX, drawdown admin fee, adviser ongoing fee | Wide investment choice; usually no guarantees | Crystallisation status; flexible income triggers MPAA (£10k); NMPA 57 from Apr 2028 unless protected | 25% PCLS up to LSA £268,275; rest marginal income tax | In estate for IHT **from 6 Apr 2027** (ENACTED, FB 2025-26); pre-75 death = tax-free to beneficiary, post-75 = beneficiary's marginal rate | **DRAW-DOWN** |
| **SSAS** | Scheme admin/actuary fees, investment costs, property running costs | Director control; can loan ≤50% to sponsoring employer; can hold commercial property | Illiquid if property-heavy; complex wind-down; MPAA on flexible access | As DC: 25% PCLS / marginal | In estate from 6 Apr 2027; pre/post-75 split as above | **DRAW-DOWN** (liquidity-constrained — flag if property-dominated) |
| **WORKPLACE_DC** | Default-fund AMC (often capped 0.75% under charge cap), self-select OCF | Possible employer match if still contributing; sometimes a small protected TFC tranche | MPAA on first flexible withdrawal; check small-pot eligibility (£10k, unlimited if occupational) | 25% PCLS / marginal | In estate from 6 Apr 2027; pre/post-75 split | **DRAW-DOWN** (check small-pot route first if <£10k) |
| **GPP** | Provider AMC/OCF, any legacy commission loading | Individual contract; rarely guaranteed | MPAA; NMPA 57 from 2028 | 25% PCLS / marginal | In estate from 6 Apr 2027 | **DRAW-DOWN** |
| **MASTER_TRUST** (NEST/People's) | Default-fund charge (NEST has contribution charge + AMC), limited fund menu | Multi-employer occupational DC; no guarantees | Limited drawdown functionality in-scheme (often must transfer to draw); MPAA | 25% PCLS / marginal | In estate from 6 Apr 2027 | **DRAW-DOWN** (may need transfer to a drawdown-capable provider) |
| **STAKEHOLDER** | Charge-capped (max 1.5% first 10yr, 1% after) — relatively low | Flexible stops/starts; capped charges; no guarantee | MPAA | 25% PCLS / marginal | In estate from 6 Apr 2027 | **DRAW-DOWN** |
| **PERSONAL_PENSION** (retail) | AMC/OCF; **older retail contracts may carry exit penalties + with-profits MVR** | **Possible GAR, protected TFC, with-profits guaranteed bonus** on older contracts | Exit penalty; MVR; MPAA — **always check for GAR/protected TFC before any move** | 25% PCLS (or protected %) / marginal | In estate from 6 Apr 2027 | **CONSOLIDATE-OR-DRAW-FIRST** if high-charge/with-profits; **ANNUITISE-DONT-DRAW** if GAR present |
| **DC_DEFERRED** (dormant) | Often legacy high AMC; possible policy fee | **High GAR / protected-TFC probability — the classic "hidden gem" pot** | Exit penalty; MVR; crystallisation unknown until checked | 25% PCLS (or protected %) / marginal | In estate from 6 Apr 2027 | **CONSOLIDATE-OR-DRAW-FIRST** (if plain high-charge) **/ ANNUITISE-DONT-DRAW** (if GAR) **/ SPECIALIST-ADVICE-FLAG** (if protected TFC or safeguarded element) |
| **DB** (final salary) | N/A to member (scheme-funded); adviser checks CETV transfer cost only | Guaranteed inflation-linked income for life + survivor pension | **Safeguarded — transfer needs FCA-permitted advice if CETV >£30k**; CETV is NOT spendable | Income taxed as pension via PAYE | **Outside estate** (held in trust); survivor pension continues | **GUARANTEED-INCOME-NOT-A-POT** |
| **DB_CARE** (career average) | N/A to member | Guaranteed CPI/RPI-revalued income; survivor pension | Safeguarded; transfer rare and advice-gated >£30k | Income taxed as pension | Outside estate; survivor benefit | **GUARANTEED-INCOME-NOT-A-POT** |
| **DB_PUBLIC** (NHS/Teachers/LGPS/etc.) | N/A | Guaranteed, often index-linked; survivor pension; some are unfunded (no CETV / no transfer, e.g. NHS unfunded) | Most **cannot be transferred** (unfunded); high earners hit Annual Allowance | Income taxed as pension | Outside estate; survivor benefit | **GUARANTEED-INCOME-NOT-A-POT** |
| **DB_HYBRID** (DB+DC) | Check DC-element charges | DB element guaranteed; DC element investable | **Split for modelling**: DB = entitlement (safeguarded, >£30k advice), DC = fund | DB income taxed as pension; DC 25%/marginal | DB outside estate; DC in estate from 6 Apr 2027 | DB part = **GUARANTEED-INCOME-NOT-A-POT**; DC part = **DRAW-DOWN** |
| **RAC_S226** (pre-1988 retirement annuity) | Often legacy high AMC / policy fee | **Frequently carries GAR + protected TFC ≠ 25%** | Exit penalty; safeguarded if GAR present (>£30k advice); TFC % is contract-specific | TFC at protected % tax-free; rest marginal | In estate from 6 Apr 2027 (DC); if annuitised under GAR → outside | **ANNUITISE-DONT-DRAW** (if GAR) / **SPECIALIST-ADVICE-FLAG** (protected TFC) |
| **SECTION_32** (buyout) | Provider/policy fee | **May contain GMP** (priority liability) + possible protected TFC; deferred-annuity guarantee | **GMP must be underpinned at 60 (F)/65 (M)**; pot must exceed GMP cost to transfer; **safeguarded — >£30k advice**; GMP restricts TFC and early access | Income taxed as pension; protected-TFC % tax-free | In estate from 6 Apr 2027 if DC; GMP/annuity element outside | **SPECIALIST-ADVICE-FLAG** (GMP + safeguarded) |
| **QROPS** (overseas) | Overseas scheme admin fees; FX | Jurisdiction-dependent benefits | 25% Overseas Transfer Charge if outside EEA/member's country of residence; 5/10-year reporting; rules vary by jurisdiction | Jurisdiction-dependent; UK source rules may apply | Jurisdiction-dependent ("in" per taxonomy) | **SPECIALIST-ADVICE-FLAG** (cross-border, OTC) |
| **STATE** (state pension) | None | Full new State Pension **£241.30/wk = £12,548/yr (2026/27)**; triple lock (4.8% Apr 2026); deferral uplift ~1% per 9 weeks deferred (≈5.8%/yr); 35 qualifying NI years | Cannot be drawn early; not a pot; taxable via PAYE coding | Taxed as income (PAYE coding) | **Outside estate**; limited inheritance of additional/protected element only | **GUARANTEED-INCOME-NOT-A-POT** |
| **FAD** (flexi-access drawdown) | Platform/drawdown admin fee, fund OCF, adviser fee | Already crystallised; flexible income; no guarantee | **Already triggered MPAA** (£10k) on first income; residual fund in estate | PCLS already taken (or available on uncrystallised tranche); income marginal | Residual in estate from 6 Apr 2027; pre/post-75 split | **DRAW-DOWN** |
| **UFPLS** | Same as drawdown provider | Each lump = 25% tax-free / 75% taxable | **Triggers MPAA**; TFC element counts against LSA £268,275 | 25% tax-free / 75% marginal **per withdrawal** | In estate from 6 Apr 2027 | **DRAW-DOWN** (lump-sum mode) |
| **ANNUITY** (standard) | One-off purchase cost (built into rate) | Guaranteed income for life; optional guarantee period / survivor % | **Irreversible** once purchased; ceases on death unless guarantee/survivor selected | Income taxed via PAYE | **Outside estate** (income stream); value-protection/guarantee payments may be in scope | **GUARANTEED-INCOME-NOT-A-POT** |
| **ANNUITY_ENHANCED** | Purchase cost; requires medical underwriting | Up to ~40% more income for health/lifestyle; otherwise as standard annuity | Irreversible; underwriting required | Income taxed via PAYE | Outside estate (as standard annuity) | **GUARANTEED-INCOME-NOT-A-POT** |

---

## 2 — The five key questions

### (1) Why a GAR pension should usually NOT be drawn down
A Guaranteed Annuity Rate locks in an annuity purchase rate set in the 1980s/90s — commonly **9–11%, occasionally higher** — versus open-market rates that are far lower. Losing a GAR can cost the equivalent of **~40% of the fund's value**. The GAR is forfeited the moment the pot is transferred to drawdown or any non-GAR vehicle. So the factual driver is: a GAR pot's value is realised by **exercising the guarantee (annuitising on the GAR terms)**, not by flexible drawdown. Drawing it down throws away the single most valuable feature it has. Engine must therefore classify a GAR pot as **ANNUITISE-DONT-DRAW** and exclude it from the flexible-drawdown pool. (Provider is legally required to flag a GAR near retirement; a GAR is a *safeguarded benefit*, so moving it where the pot >£30k requires FCA-permitted advice.)

### (2) Why DB / state / annuity must be excluded from the drawdown pot and modelled as secure income
These are **income streams, not capital balances**. A DB CETV is a transfer *price*, not a spendable amount; state pension and an in-payment annuity have no fund at all. Modelling them as a pot:
- overstates liquid/drawable wealth (double-counting income you can't capitalise),
- understates secure baseline income (the figure that determines how much *sequencing risk* the rest of the plan can take),
- mis-models death (DB/state/annuity are **outside the estate**; a DC pot is **in** from Apr 2027), and
- mis-models tax (secure income is taxed as it arrives at marginal rate; it has no 25% PCLS).

Correct treatment: model DB + state + annuity as a **guaranteed-income floor**; the drawdown engine then only sequences the genuine pots (SIPP, DC, FAD, UFPLS) on top of that floor. This is what lets the platform answer "how much secure income covers essential spend vs. how much flexible pot is at sequencing risk".

### (3) How protected TFC (>25%) changes the tax-free-cash strategy
Scheme-Specific Protected Tax-Free Cash (SSPTFC) exists where a member had a >25% lump-sum entitlement on **5 April 2006** (A-Day) — common on **Section 32 buyouts and pre-1988 RAC/S226** and some old occupational transfers. Consequences for strategy:
- The "take 25% PCLS" assumption is **wrong** for these schemes — the protected % can be much higher (sometimes approaching 100% in extreme legacy cases).
- The protection is **lost on transfer** unless transferred as a block under the specific protected-transfer rules — so consolidating a protected-TFC pot into a SIPP can **destroy** the extra tax-free cash.
- Under the post-LTA-abolition regime, only **25% of the crystallised value** is deducted from the £268,275 Lump Sum Allowance (not the actual larger lump sum paid), so a protected-TFC pot is **disproportionately efficient to crystallise first** for tax-free cash.
Engine impact: capture `protectedTfcPct` and `protectedTfcType`; never apply a flat 25% to these; flag transfer as protection-destroying → **SPECIALIST-ADVICE-FLAG**.

### (4) When a high-charge legacy pension should be drawn / consolidated first
A legacy pot with AMC of ~1–2%+ (old retail personal pensions, with-profits, dormant workplace pots) bleeds value every year relative to a modern 0.15–0.40% platform. Ordering logic an adviser uses:
- If the pot is **plain high-charge with no guarantees / no penalties** → consolidate into a low-cost wrapper, or draw it down ahead of cheaper pots, to stop charge drag (**CONSOLIDATE-OR-DRAW-FIRST**).
- **BUT first rule out**: GAR, protected TFC, GMP, with-profits guaranteed bonus, and **exit penalty / MVR**. A with-profits **MVR** can wipe out the charge saving on exit; though note MVRs are typically **not applied at the plan's normal retirement / annuitisation date** — so timing the move to that date can avoid the MVR. An exit penalty similarly may make "draw it down in place" better than "transfer then draw".
So the rule is conditional: high charge → consolidate/draw-first **only if** no guarantee and the exit cost (penalty/MVR) is less than the charge saving or can be timed away.

### (5) Small-pot rules that avoid triggering MPAA
A **small-pot lump sum** lets you take a pot **≤£10,000** in full (25% tax-free / 75% taxable) **without triggering the MPAA**, because HMRC treats it as a distinct authorised payment, **not** a flexible designation to drawdown. Limits:
- **Personal pensions: max 3** small-pot lump sums (each ≤£10k).
- **Occupational schemes: unlimited** number of ≤£10k small pots.
This matters because a normal UFPLS or first flexible drawdown income **collapses the annual allowance to the £10k MPAA**, killing future contribution room. Using small-pots to access modest pots preserves the full £60k annual allowance for someone still contributing. Engine must flag any pot ≤£10k as small-pot-eligible and warn that the alternative (UFPLS/FAD) is an **MPAA trigger**.

---

## 3 — Proposed per-scheme data fields (engine must capture)

Replaces the single aggregated balance with a per-scheme record:

```
// Identity / value
schemeId, type (taxonomy ID), provider, value            // value = fund (DC) OR null for DB/state/annuity
isPot: bool                                              // false => guaranteed income, exclude from drawdown pool

// Guaranteed income (DB / state / annuity)
guaranteedAnnual                                         // for DB/state/annuity
inflationLinked: 'CPI' | 'RPI' | 'fixed' | 'none'
survivorPct, guaranteePeriodYears
isSafeguarded: bool                                      // DB, GAR, GMP => true
cetv                                                     // DB transfer price (NOT spendable)

// Charges
amc, ocf, platformFee, exitPenaltyPct, adviceFeePct

// Guarantees on DC/legacy pots
gar: bool, garRate                                       // guaranteed annuity rate
protectedTfcPct, protectedTfcType                        // SSPTFC / primary / enhanced; null => standard 25%
withProfits: bool, mvrApplies: bool, mvrFreeDate         // date MVR not applied (NRD/annuitisation)
guaranteedBonus: bool
gmp: bool, gmpAge                                        // Section 32: 60(F)/65(M) underpin

// Access / status
crystallised: bool, pclsTakenSoFar
mpaaTriggered: bool                                      // true if FAD income / UFPLS already taken
smallPotEligible: bool                                   // value <= 10000
protectedPensionAge                                      // <57 right if joined pre-4 Nov 2021
normalRetirementDate                                     // for MVR-free timing

// Tax / estate
lsaUsedSoFar                                             // counts toward £268,275
estateTreatment: 'in-from-2027' | 'outside'
```

The **DRAW-CLASSIFICATION** is then derived, not stored:
```
if (!isPot)                         => GUARANTEED-INCOME-NOT-A-POT
else if (gar)                       => ANNUITISE-DONT-DRAW
else if (gmp || protectedTfcPct>0.25 || isSafeguarded || (isSafeguarded && cetv>30000))
                                    => SPECIALIST-ADVICE-FLAG
else if (amc high && no guarantee && exitCost<charge saving)
                                    => CONSOLIDATE-OR-DRAW-FIRST
else                                => DRAW-DOWN
```

---

## 4 — Sources (URL + status)

- MPAA £10,000 (2026/27) — MoneyHelper / Royal London — **ENACTED**
  https://www.moneyhelper.org.uk/en/pensions-and-retirement/tax-and-pensions/money-purchase-annual-allowance-mpaa
  https://adviser.royallondon.com/technical-central/pensions/contributions-and-tax-relief/money-purchase-annual-allowance/
- Lump Sum Allowance £268,275 (2026/27) — PocketWise — **ENACTED**
  https://pocketwise.co.uk/pensions-and-retirement/pension-allowance-2026-27/
- Small-pot lump sums (3×£10k personal, unlimited occupational; no MPAA trigger) — Quilter / M&G / Aberdeen Techzone — **ENACTED**
  https://www.quilter.com/help-and-support/technical-insights/technical-insights-articles/small-pots-and-triviality/
  https://www.mandg.com/wealth/adviser-services/tech-matters/pensions/lump-sum-options/pension-small-pots
  https://techzone.aberdeenadviser.com/public/pensions/Guide-triviality-small-pots
- Pensions in estate for IHT from 6 April 2027 — GOV.UK / Royal London — **ENACTED** (Finance Bill 2025-26; spousal & charity exemptions retained; death-in-service excluded)
  https://www.gov.uk/government/publications/inheritance-tax-unused-pension-funds-and-death-benefits/inheritance-tax-unused-pension-funds-and-death-benefits
  https://adviser.royallondon.com/technical-central/pensions/death-benefits/inheritance-tax-on-pension-death-benefits-from-april-2027/
- Full new State Pension £241.30/wk = £12,548/yr (2026/27), triple lock +4.8%, 35 NI years — Standard Life / MSE / House of Commons Library — **ENACTED**
  https://www.standardlife.co.uk/articles/article-page/state-pension-changes-202627
  https://commonslibrary.parliament.uk/research-briefings/cbp-10403/
- GAR (9–11%, ~40% of fund value at stake; lost on transfer to drawdown) — L&G / Unbiased — **ENACTED (contractual feature)**
  https://www.legalandgeneral.com/retirement/pension-annuity/guides/guaranteed-annuity-rates/
  https://www.unbiased.co.uk/discover/pensions-retirement/managing-a-pension/guaranteed-annuity-rates-what-are-they-how-do-they-work
- NMPA rising to 57 from 6 April 2028; protected pension age if right held pre-4 Nov 2021 — GOV.UK / People's Pension / Royal London — **ENACTED**
  https://www.gov.uk/government/publications/increasing-normal-minimum-pension-age/increasing-normal-minimum-pension-age
  https://adviser.royallondon.com/technical-central/pensions/benefit-options/increase-in-normal-minimum-pension-age-in-2028/
- Safeguarded benefits >£30k require FCA-permitted advice (covers DB, GAR, GMP) — Royal London / FCA FG21/3 — **ENACTED**
  https://adviser.royallondon.com/technical-central/pensions/transfers/safeguarded-benefits/
  https://www.fca.org.uk/publication/finalised-guidance/fg21-3.pdf
- Scheme-Specific Protected TFC (>25% at A-Day; lost on transfer; only 25% of crystallised value deducted from LSA) — Aberdeen Techzone / M&G — **ENACTED**
  https://techzone.aberdeenadviser.com/public/pensions/Tech-guide-scheme-specific-tfc
  https://www.mandg.com/wealth/adviser-services/tech-matters/pensions/lump-sum-options/scheme-specific-protected-tax-free-cash
- With-profits MVR (reduction on early exit; NOT applied at NRD/annuitisation date; distinct from exit fee) — ReAssure / ABI / Zurich — **ENACTED (contractual feature)**
  https://www.reassure.co.uk/market-value-reduction-mvr-for-with-profits-policies/
  https://www.abi.org.uk/products-and-issues/choosing-the-right-insurance/with-profits-funds/
- Section 32 GMP (underpin at 60 F / 65 M; pot must exceed GMP cost to transfer; restricts TFC & early access) — Aberdeen Techzone / M&G / pensionsandannuities — **ENACTED**
  https://techzone.aberdeenadviser.com/public/pensions/Tech-guide-guaranteed-min-pen
  https://www.mandg.com/wealth/adviser-services/tech-matters/pensions/types-of-arrangement/section-32
  https://pensionsandannuities.co.uk/section-32-policies

### Could not fully verify
- **State pension deferral uplift** stated as ~1% per 9 weeks (≈5.8%/yr) from general knowledge of the post-2016 new-State-Pension rules; the 2026/27 searches did **not** return a primary GOV.UK figure confirming the rate still stands unchanged. Treat as **ESTIMATED** until a GOV.UK deferral page is fetched.
- **QROPS Overseas Transfer Charge** (25%) cited from taxonomy text; not independently re-verified against a 2026 HMRC page this session — treat the 25% rate and EEA-scope conditions as **ESTIMATED / needs HMRC confirmation** (note: the OTC scope was tightened at Autumn Budget 2024 to remove the EEA/Gibraltar exemption — verify current scope before relying on it).
