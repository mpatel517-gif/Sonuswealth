# MyMoney — LIVE Chrome capture for parallel audit (2026-05-25)

**Persona:** Mr T = Bruce Wayne (`?demo=mrt`, age 62)
**URL:** http://localhost:5174/?demo=mrt#mymoney → clicked "My Money" in sidebar
**Build:** post Wave 0.6 (230 modules, smoke 53/53, ripple 103/103, time-series 29/29)
**Container:** `.screen` div, scrollH=3367px, clientH=1026px

---

## Raw page text (top → bottom, scrolled)

```
[HEADER SUBNAV]
◷ Tax year ▼ UK tax 2026/27
NOW | Today | Future | Plan | What if    ← Home

[ACT 1 — anchor]
WEALTH SCORE 69/100 Optimised
RISK SCORE 71/100 Optimised
+£7,000 net worth change vs last month
Net worth grew £7k this month, despite a £8k deficit.

[ACT 2 — WHAT YOU OWN — Assets · £4.08m]
Tap any tile to drill in · tap a wrapper segment to filter

HOW YOUR MONEY IS HELD (i)
Property · £2.25m | Pension · £850k | ISA · £420k | GIA · £380k | Cash · £180k

BALANCE SHEET
NET WORTH | 12-month net worth +10.9%
WHAT YOU CAN ACCESS:
  Liquid £980k | Pension £850k | Illiquid £2.25m

[5 metric tiles row]
1-YEAR GROWTH — net worth change — +£154k (+4.1%) ⚡
LAST MONTH — net worth change — +£7k (+0.2%) ⚡
DEBT RATIO — debt as % of assets — 4% ⚡
TIME COVERED — wealth ÷ annual spending — 150.3 yr ⚡
INCOME BUFFER — income vs commitments — 52.4× ⚡

[Category tiles — wrapper grid]
⌂ est. PENSIONS +0.2% £850k ⚡
   Pension 100%
   £60k of pension room left this year
   COST OF WAITING: £12.0k of tax relief gone forever if not used by 5 April
   PENSION ROOM AVAILABLE (i)  | View detail →  + Add

◈ est. SAVINGS & INVESTMENTS +0.2% £800k ⚡
   ISA 53% | GIA 48%
   £20k of [truncated]

◐ PROTECTION £2.00m ⚡
   Trust 75% | Other 25%
   Life cover is held in trust — pays out to family directly, no inheritance tax on it
   View detail → + Add

£ CASH £180k ⚡
   Cash 100%
   6.9 yr of essentials covered
   COST OF WAITING: £1240/yr in interest tax — wrapping into an ISA would shield it
   STRONG BUFFER

✦ ALTERNATIVES —
   Crypto, wine, art, gold, P2P, private equity — anything that doesn't fit the standard wrappers lives here. Chattels under £6k disposal: no CGT.

⚖ OBLIGATIONS £0
   Other 0%

[ACT 3 — WHAT YOU OWE — Liabilities · £180k · costs £1k/mo]
Tap any row to open the liabilities drill
Mortgage Btl  £1k/mo  £180k

[ACT 4 — MONTHLY CASH FLOW]
◆ Your data · Apr 2026
− £6,942 spending exceeds income this month
⏱ Liquid cash covers 22.0 months at this rate
You have breathing room, but the deficit needs addressing

HOW YOUR INCOME IS SPENT · £3K/MO
[bars] £10k | £8k
Essentials £10k | Debt £1k | Shortfall £8k

[3 cashflow tiles]
MONTHLY INCOME £3k ⚡
ESSENTIALS £10k ⚡
DEBT PAYMENTS £1k ⚡

[ACT 5 — Tax (likely below; truncated)]
[ACT 6 — Decisions (likely below; truncated)]

[FOOTER]
... financial adviser.
UK-2026.1 · April 2026
```

---

## Header chip (global, top-right of Dashboard.jsx — visible on all screens):
```
£3.90m  YOU OWN  |  69  WEALTH  |  71  RISK
```

---

## Preliminary issues already visible (for auditor confirmation/expansion)

### A — DUPLICATIONS (founder's main complaint)
1. **Wealth/Risk score duplicated** — header chip shows `69 WEALTH | 71 RISK`, Act 1 body shows `WEALTH SCORE 69/100 Optimised | RISK SCORE 71/100 Optimised`. D-ANCHOR-1 OVERRIDE hid NW from body anchor (`hideNetWorth={true}`) but Wealth + Risk still duplicate.
2. **"+£7k net worth change" appears 3× in close proximity**:
   - Big tile `+£7,000 net worth change vs last month` (Act 1)
   - Sentence `Net worth grew £7k this month, despite a £8k deficit.` (Act 1)
   - Metric tile `LAST MONTH +£7k (+0.2%)` (BALANCE SHEET row)
3. **Pension £850k appears 3× on same scroll**:
   - HOW YOUR MONEY IS HELD bar segment `Pension · £850k`
   - WHAT YOU CAN ACCESS row `Pension £850k`
   - PENSIONS category tile `£850k`
4. **WHAT YOU CAN ACCESS partitions the same £4.08m** that HOW YOUR MONEY IS HELD already partitioned just above. Two different slicings of identical totals, stacked.
5. **Two growth metrics for the same period that disagree**: `12-month net worth +10.9%` vs `1-YEAR GROWTH +£154k (+4.1%)`. Same window, different numbers (and percentages 10.9% vs 4.1% — neither obviously wrong, but presented as both).
6. **Spending shown 3 ways adjacent**: chart bars label "Essentials £10k | Debt £1k | Shortfall £8k", below that 3 cashflow tiles repeat "ESSENTIALS £10k | DEBT PAYMENTS £1k", and the chart title says "£3K/MO" which contradicts (income £3k vs spending £11k).

### B — REDUNDANCY
7. Subnav has both `NOW` pill AND `Today` tab — same concept.
8. `← Home` back-arrow on a primary nav screen — there's nothing to go back from.
9. `Tax year ▼ UK tax 2026/27` — label says "Tax year", value repeats "tax".
10. Multiple `+ Add` and `View detail →` per tile (acceptable pattern, but verify whether both are needed).

### C — STATE / LABEL INCONSISTENCY
11. Wealth 69 + Risk 71 both labelled `Optimised`. On Home today the same scores showed `ON TRACK` (Wealth) and `PROTECTED` (Risk). Different state copy per screen for identical scores.
12. SAVINGS & INVESTMENTS tile shows `ISA 53% | GIA 48%` = 101%. Either rounding or genuinely broken.
13. PENSIONS tile shows `Pension 100%` (composition) but the explanatory line says `£60k of pension room left this year` — "100%" of what?

### D — NUMERIC INCONSISTENCY
14. **Header £3.90m = Net Worth** but body **Assets = £4.08m**. Founder-facing user sees "YOU OWN £3.90m" in header, then sees "Assets £4.08m" in body. NW vs gross — needs disambiguation.
15. **TIME COVERED 150.3 yr** — wealth ÷ annual spending. If essentials £10k/mo = £120k/yr, then £3.9m / £120k ≈ 32.5 yr. 150 yr implies dividing by ~£26k/yr. Likely a calc bug or wrong denominator.
16. **INCOME BUFFER 52.4×** — income vs commitments. With £3k/mo income vs £11k/mo spend (deficit), buffer should be <1, not 52. Likely using wrong income or wrong commitment definition.
17. **CASH tile says "6.9 yr of essentials covered"** but CASH FLOW says `Liquid cash covers 22.0 months at this rate`. 22 months ≈ 1.83 yr, not 6.9 yr. Two different mechanisms with no reconciliation copy.
18. **Chart title "£3K/MO"** contradicts the bars (£11k spend) — should be "spending £11k vs income £3k" or similar.

### E — FCA / IFA boundary
19. **`Optimised` label** on Wealth + Risk scores without rubric — sounds regulated. Needs definition or relabel.
20. **`wrapping into an ISA would shield it`** on CASH tile — recommendation language, not informational guidance. Compliance boundary risk.
21. **`COST OF WAITING: £12.0k of tax relief gone forever`** — urgency-as-advice. Tax-accountant + compliance both need to weigh in on whether this crosses the FCA line.
22. **`pays out to family directly, no inheritance tax on it`** — accurate for life cover in trust BUT framed without nuance (settlor-related risks, 7-year clock). Needs qualifier.

### F — Engine/data unknowns (for tester)
23. INCOME BUFFER 52.4× looks impossible given deficit — calc inputs to inspect.
24. TIME COVERED 150.3 yr same.
25. 12-month +10.9% vs 1-YEAR +4.1% — which is the truth?
26. Allowance % > 100% in SAVINGS tile.

---

**Next:** parallel skill audits should each expand their lens, find what this list missed, and rank fixes. Then founder picks order before any edits.
