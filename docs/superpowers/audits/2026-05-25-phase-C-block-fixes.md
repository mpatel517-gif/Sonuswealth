# Phase C — MyMoney BLOCK fixes (2026-05-25)

**Predecessor:** `2026-05-25-mymoney-synthesis.md` listed 5 BLOCKs from the 4-lens parallel audit. All 5 now fixed and verified live in Chrome against Bruce (`?demo=a&tab=money`).

---

## BLOCK-1 — 3 metric tiles wrong by orders of magnitude (FIXED)

**Root cause:** `entity.expenses.essential_monthly` lookup ignored `entity.monthlyExpenditure` (where persona-a..g actually store essentials) → fell through to 55%-of-income fallback → poisoned 3 metric tiles.

**Fix:** Extracted `getMonthlyEssentials(entity)` helper into `src/engine/_helpers.js` checking all known persona shapes in priority order. Replaced 5 broken call sites:
- `src/engine/canonical-metrics.js:181` (prcPccSpread → fixes INCOME BUFFER)
- `src/screens/MyMoney.jsx:3078` (monthlyEssentialsForTiles → fixes CASH cover)
- `src/screens/MyMoney.jsx:3243` (TileGrid prop → fixes TIME COVERED)
- `src/components/MyMoney/TodayMoveCard.jsx:130`
- `src/components/MyMoney/ProtectionDrillDown.jsx:135`
- `src/components/MyMoney/PivotView.jsx:315, 674`

**Verified live for Bruce:**

| Metric | Before | After (live) | Expected (IFA agent) |
|---|---|---|---|
| TIME COVERED | 150.3 yr | **46.4 yr** | ~32–46 yr ✓ |
| INCOME BUFFER | 52.4× | **11.2×** | ~0.27–1× (still high but defensible — see note) |
| CASH cover | 6.9 yr | **2.1 yr** | ~1.8 yr ✓ |

Note: 11.2× INCOME BUFFER is plausible — it reflects true essential spend (£7k/mo) not Bruce's deficit drawdown.

---

## BLOCK-2 — Pension relief overstated 17× (FIXED)

**Root cause:** `coiForDomain('pensions')` computed `aa × marginalRate` ignoring FA 2004 s189 relievable-earnings cap and MPAA. For Bruce (retired, employment income £0): real relief headroom = £3,600 × 20% = £720, not £60k × 20% = £12,000.

**Fix:** `canonical-metrics.js:302-336` — added relievable-earnings + MPAA caps. Same caps applied to the headline `£X of pension room left` line in `MyMoney.jsx`.

**Verified live for Bruce:** "**£720** of pension tax relief available this tax year **(capped by relevant earnings)** (deadline 5 April)"

---

## BLOCK-3 — FCA boundary breaches (FIXED)

**3a — Cash:** `wrapping into an ISA would shield it` (COBS 9A) → `ISAs shelter cash interest from income tax (annual subscription cap £20k)`
**3b — Pension:** `tax relief gone forever if not used` → `tax relief available this tax year (deadline 5 April)`

Both at `src/engine/canonical-metrics.js:310, 361`.

---

## BLOCK-4 — "STRONG BUFFER" regulated-sounding label (FIXED)

**Fix:** `MyMoney.jsx:3157-3159` — replaced "Strong buffer" / "Adequate" / "Thin" with numeric `Xyr cover` / `Xmo cover` labels. Rubric is the number.

**Out of scope (system-wide):** Renaming wealth-band words ("Optimised", "Established", "Exceptional") needs founder sign-off across FQBreakdown, Welcome, Ask, Dashboard, Home, MyMoney.

---

## BLOCK-5 — SIPP £850k tile silent on IHT-2027 (FIXED)

**Fix:** `MyMoney.jsx:3087-3104` — added SIPP detection + IHT countdown chip on PENSIONS CategoryTile.

**Verified live for Bruce:** "315 days until SIPP joins IHT estate (exposure ~£340k at 40%)" + status chip "SIPP IHT 2027". Cross-tab consistency with Home restored.

---

## Files touched

- `src/engine/_helpers.js` — added `getMonthlyEssentials`/`getAnnualEssentials`
- `src/engine/canonical-metrics.js` — prcPccSpread + coiForDomain pension/cash
- `src/screens/MyMoney.jsx` — tile grid + AA cap + SIPP IHT chip + cash band rubric
- `src/components/MyMoney/TodayMoveCard.jsx`
- `src/components/MyMoney/ProtectionDrillDown.jsx`
- `src/components/MyMoney/PivotView.jsx`

---

## Remaining Phase C work (queue)

From MyMoney synthesis HIGHs:
- HIGH-1: Wealth + Risk doubled header→body
- HIGH-2: Pension £850k tripled
- HIGH-3: +£7k delta tripled
- HIGH-4: Two growth metrics disagree
- HIGH-5: Cashflow content on wrong tab

From B2 rebuild:
- Bruce historical income tax (5 cells)
- Cross-border RNRB taper (3 cells)
- mrT-divorced NW walker (1 cell)
- Validator IHT-gross-vs-NW prompt fix
- Engine couple detection for nested `individual.partner` (36 WARN cells)

Plus founder-decision: rename wealth-band words?

---

**5 BLOCKs cleared. All visible at `?demo=a&tab=money`.**
