# MyMoney — synthesized audit (2026-05-25)

**Inputs:** 4 parallel audits (UX critic, IFA, UK tax, tester) against live Chrome capture.
Evidence pack: `2026-05-25-mymoney-live-evidence.md`
Persona: Bruce Wayne (Mr T, age 62, employment income £0, decumulation).

**Build state:** post Wave 0.6, smoke 53/53 green. Wave 0.6 "ALL_PASS" measured snap-success not calc-truth — that's why these BLOCKs survived the audit.

---

## Why the founder is still complaining after 4 asks

The Wave 0.6 audit ran 3 lenses (tester / UX / financial) and reported ALL_PASS. But it tested whether **shipped fixes landed**, not whether **the surface stopped repeating itself or computed correctly**. The fixes addressed individual bugs; they didn't change the structural pattern that creates the duplication, and they couldn't catch calc bugs that pass type-check but fail sanity-check.

Root structural problem (UX): Act 2 "WHAT YOU OWN" stacks 4 storeys that all re-slice the same £4.08m — wrapper bar (HOW YOUR MONEY IS HELD) + balance-sheet wedge (WHAT YOU CAN ACCESS) + 5 metric tiles + 7 category tiles. macOS principle violated by accretion.

Root calc problem (tester): every essentials-dependent metric reads `entity.expenses.essential_monthly`, falls through to a 55%-of-income fallback because Mr T's persona-A stores essentials at `entity.monthlyExpenditure`. One missing field-lookup poisons three metrics simultaneously.

---

## BLOCK — ship-stoppers (must fix before any new Wave 1 work)

### BLOCK-1 · Three metric tiles are wrong by orders of magnitude
**Surface:** BALANCE SHEET row — `TIME COVERED 150.3 yr`, `INCOME BUFFER 52.4×`, plus `CASH tile · 6.9 yr essentials covered` (contradicts the same screen's `Liquid cash covers 22.0 months` banner).
**Cause:** `canonical-metrics.js:181` + 3 call sites in `MyMoney.jsx:3079, 3148, 3239` look up `entity.expenses.essential_monthly`; Mr T stores it at `entity.monthlyExpenditure` (£7k/mo). Fallback returns 55% × income → divisor collapses.
**Real values per IFA cross-check:** TIME COVERED ~32–46 yr · INCOME BUFFER ~0.27–1× · CASH cover ~1.8 yr.
**Source:** tester audit §1; IFA audit §1.
**Fix:** extract `getMonthlyEssentials(entity)` helper into `_helpers.js`; replace 3 call sites.

### BLOCK-2 · Pension tile overstates relief by ~17×
**Surface:** PENSIONS tile · `£60k of pension room left this year` + `£12.0k of tax relief gone forever if not used by 5 April`.
**Cause:** assumes 20% basic-rate relief on full £60k AA. Persona is age 62, retired, employment income £0 → **zero relievable earnings under FA 2004 s189**. Real headroom = £3,600 gross / £720 relief. Card also ignores tapered AA (ANI>£260k) and MPAA (£10k cap if FAD/UFPLS taken).
**Source:** tax audit §1; IFA audit §3.
**Fix:** route through engine with relievable-earnings cap + MPAA flag; relabel "tax relief gone forever" as urgency-as-advice (BLOCK-4 below).

### BLOCK-3 · FCA boundary breach in 2 places
**Surface (a):** CASH tile · `wrapping into an ISA would shield it`.
**Boundary:** personal recommendation under COBS 9A.
**Fix:** reframe as informational guidance — "ISAs shield interest from income tax up to £20k/yr" with no second-person verb.

**Surface (b):** PENSIONS tile · `£12.0k of tax relief gone forever if not used by 5 April`.
**Boundary:** urgency-as-advice + factually wrong (BLOCK-2).
**Fix:** reframe to factual statement of allowance + deadline, no "forever" framing.
**Source:** IFA audit §FCA-1/2; tax audit §1.

### BLOCK-4 · "Optimised" / "STRONG BUFFER" labels are regulated-sounding without rubric
**Surface:** WEALTH SCORE 69 · `Optimised` · RISK SCORE 71 · `Optimised` · CASH tile · `STRONG BUFFER`.
**Conflict:** Home shows the same scores as `ON TRACK` and `PROTECTED`. Same engine output, different verbal labels per screen.
**Cause:** N-02 state-copy remap landed on MyMoney but not on Home/header chip.
**Fix:** single source of state-copy → `getScoreState(score) → 'ON TRACK' | 'AT RISK' | ...`. Kill "Optimised" entirely (regulated-sounding). Kill "STRONG BUFFER" until rubric defined; replace with neutral count "1.8 yr of essentials at current burn".
**Source:** all 4 audits.

### BLOCK-5 · SIPP £850k tile silent on IHT-2027 on MyMoney while Home shouts it
**Surface:** PENSIONS tile shows £850k with NO IHT chip. Home shows `SIPP joins IHT estate · 315 days until 6 April 2027 · exposure £340k` for the same data.
**Cause:** Wave 0.5 chip rollout pending (master plan item #2). Cross-tab inconsistency on Bruce's largest IHT event.
**Source:** IFA audit §5; tax audit §3.
**Fix:** Wave 0.5 IHT chip on SIPP/property/business CategoryTiles — promote ahead of Wave 1.

---

## HIGH — duplication / redundancy kill-list (the founder's named complaint)

### HIGH-1 · Wealth + Risk score duplicated header→body
**Where:** header chip top-right (`69 WEALTH | 71 RISK`) AND Act 1 body (`WEALTH SCORE 69/100 · RISK SCORE 71/100`).
**Cause:** D-ANCHOR-1 OVERRIDE hid NW (`hideNetWorth={true}`) but Wealth + Risk still render in body anchor.
**Fix:** extend prop set to `hideWealth` + `hideRisk` and apply on every screen with header chip (MyMoney, Cashflow, TaxEstate). Body anchor on those screens degrades to a coral-flag list ("2 dims below target →") and a date stamp — no score chips.
**Pushback:** locked D-ANCHOR-1 OVERRIDE may need amending. UX critic recommends promoting to full body-anchor suppression on non-Home screens.

### HIGH-2 · £850k Pension tripled in one scroll
**Where:** wrapper bar `Pension · £850k` + WHAT YOU CAN ACCESS row `Pension £850k` + PENSIONS category tile `£850k`.
**Fix:** kill WHAT YOU CAN ACCESS at L1 — make liquid/illiquid breakdown a tap-state of the wrapper bar (the same £4.08m sliced differently is exactly what tap-to-pivot is for).

### HIGH-3 · +£7k net-worth delta tripled in Act 1
**Where:** big sentence + summary line + LAST MONTH metric tile.
**Fix:** single sentence ("Net worth +£7k this month despite £8k cashflow deficit") + LAST MONTH tile. Kill the standalone `+£7,000 net worth change vs last month` headline.

### HIGH-4 · Two growth metrics for same period that disagree
**Where:** sparkline `12-month net worth +10.9%` vs metric tile `1-YEAR GROWTH +£154k (+4.1%)`.
**Cause:** sparkline labelled "12-month" but renders the full 24-point trajectory (tester §3).
**Fix:** slice trajectory `.slice(-12)` for sparkline; one growth metric per period.

### HIGH-5 · Cashflow content on the wrong tab
**Where:** Act 4 — MONTHLY CASH FLOW banner + spending chart + 3 cashflow tiles.
**Cause:** per MyMoney v2.7 §1 scope, cashflow detail lives on the Cashflow tab; MyMoney shows the one-line teaser only.
**Fix:** kill the chart + 3 tiles on MyMoney. Keep one-line surplus/deficit summary with `View cashflow →`.
**Pushback:** the 6-act restructure introduced cashflow as a full act inside MyMoney — that decision needs revisiting against v2.7 §1.

---

## MED

- **MED-1 · Composition % rounds to 101%** — ISA 53% + GIA 48% in SAVINGS tile. Fix: pin last segment to `100 − Σ(rest)` in `CategoryTile`. (tester)
- **MED-2 · Cashflow chart title contradicts bars** — title says `£3K/MO income`, bars label £11k spend. Fix: change title to spending total. (tester, UX)
- **MED-3 · Subnav redundancy** — `NOW` pill + `Today` tab are the same concept; `← Home` back arrow on top-level nav is dead/meaningless. (all)
- **MED-4 · 6 hardcoded UK figures violate rules-uk SoT rule** — `£20k`, `£60k`, `£100k`, `40%`, `47%` in MyMoney render strings. Route through `TAX` from `fq-calculator.js`. (tester)
- **MED-5 · CASH "£1,240/yr interest tax" off by £180** — should be £1,420 (£180k × 4.5% − £1k PSA). Likely SRS taper bug. (tax)
- **MED-6 · PROTECTION tile omits trust nuance** — `no inheritance tax on it` is accurate for life cover in trust but ignores 7-yr clock + settlor-interested rules + discretionary-trust periodic charges. (IFA, tax)
- **MED-7 · `Tax year ▼ UK tax 2026/27`** — label says "Tax year", value repeats "tax". Fix: value reads `2026/27` only. (UX)

---

## LOW

- LOW-1 · Wrapper bar repeats explicit values that are already encoded as proportional widths.
- LOW-2 · ALTERNATIVES tile shows `—` placeholder + chattels copy; either populate from entity or kill until populated.
- LOW-3 · Some `+ Add` and `View detail →` CTAs may not yet route to a real surface (need full route map).

---

## Why Wave 0.6 missed all of this

1. **Snap audit ≠ calc audit.** Snap tests presence + visual; doesn't validate that 150.3 yr is sane.
2. **FCA rewrite filter not wired for new copy.** The "tax relief gone forever" and "wrapping into an ISA" strings landed without going through the COBS 9A check.
3. **No persona-vs-spec-intent diff.** Spec §180 calls for SIPP-IHT chip on the £850k tile for Bruce; nobody checked that constraint as a contract.
4. **State-copy not centralised.** Same score gets different labels per screen because there's no `getScoreState()` single source.
5. **Audit reports ALL_PASS when fixes shipped, not when behavior is correct.** A `2026-05-25-mymoney-financial-pre-ship-results.md` style green-check is too easy to confuse with "the screen is right".

---

## Recommended lanes — pick one or all (founder decides order)

**Lane A — BLOCK sweep (highest leverage, ~half day):**
- BLOCK-1 (calc helper) → BLOCK-2 (pension relief cap) → BLOCK-3 (FCA reframe of 2 strings) → BLOCK-4 (state-copy single source) → BLOCK-5 (SIPP IHT chip).
- Output: every number on MyMoney is defensible; no FCA boundary breach.

**Lane B — Duplication kill (the named complaint, ~half day):**
- HIGH-1 (extend hide-props to Wealth/Risk on non-Home screens) → HIGH-2 (kill WHAT YOU CAN ACCESS as L1, demote to tap-state) → HIGH-3 (collapse 3× +£7k to 1) → HIGH-4 (12-month sparkline slice + reconcile growth metrics) → HIGH-5 (kill cashflow act on MyMoney, demote to teaser).
- Output: the macOS principle restored on MyMoney; surface area ~30% smaller; founder stops asking.

**Lane C — MED cleanup (~2 hours):**
- MED-1 through MED-7 in a single commit.

**Lane D — Add to plan, don't fix yet:**
- LOW items + Wave 1 InvestmentsDrillDown rebuild (master plan §Wave 1).

---

**My recommendation:** Lane A first (BLOCK-1 alone makes the screen honest), then Lane B (which is what the founder actually keeps asking for), then Lane C in one sweep, then resume Wave 1.

**Pushback for founder:**
1. **D-ANCHOR-1 OVERRIDE should escalate to full body-anchor suppression on non-Home screens.** Half-suppressing (NW only) was the source of HIGH-1.
2. **The 6-act restructure put cashflow content on MyMoney.** Per v2.7 §1 that belongs on Cashflow. Reopen that decision before fixing the chart title — the chart shouldn't be on MyMoney at all.
3. **"ALL_PASS" needs a stricter definition** — should require: (a) snap visual, (b) calc sanity check against persona, (c) FCA boundary regex, (d) duplication grep across the rendered DOM. Today it's only (a).

---

**Maintainer:** Claude + founder. Audit run 2026-05-25.
**Detail files:**
- UX: `2026-05-25-mymoney-ux-critic.md`
- IFA: `2026-05-25-mymoney-ifa.md`
- Tax: `2026-05-25-mymoney-tax.md`
- Tester: `2026-05-25-mymoney-tester.md`
- Evidence: `2026-05-25-mymoney-live-evidence.md`
