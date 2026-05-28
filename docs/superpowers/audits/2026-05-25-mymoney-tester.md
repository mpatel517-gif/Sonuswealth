# MyMoney — static / calc audit (parallel pass, 2026-05-25)

**Persona under test:** `?demo=mrt` → `mrt` mapped to `personaA` (`src/rules/personas/persona-a.json`), age 62, NW £3.9m, gross assets £4.08m, monthlyExpenditure £7,000.

**Conclusion:** Wave 0.6 reported ALL_PASS for *snap success*, not *calc correctness*. At least **3 BLOCK-level math bugs** ship live numbers that are wrong by an order of magnitude. Both flagged metrics (TIME COVERED 150.3 yr, INCOME BUFFER 52.4×) reproduce exactly from the code path — they are not display glitches, the inputs are wrong. Plus three duplications, one cross-screen label divergence, one rounding bug, multiple hardcoded UK figures, and a CTA-label problem on the global header.

The repeating root cause: **`entity.monthlyExpenditure` (£7,000) is the persona's canonical essentials field, but no calc on this screen reads it**. Every essentials-dependent metric instead reads `entity.expenses.essential_monthly` / `essential_annual` (which the persona doesn't have) and falls back to `annualIncome × 0.55`. Wrong denominator everywhere essentials touch.

---

## BLOCK — calculation bugs

### B1. INCOME BUFFER 52.4× is fiction
**File:** `src/engine/canonical-metrics.js:181-183` (formula) + `src/components/MyMoney/TileGrid.jsx:148, 244` (render)

`prcPccSpread()` reads `entity?.expenses?.essential_annual || entity?.expenses?.essential_monthly * 12 || annualIncome(entity) * 0.55`. Persona-a has neither `expenses.essential_annual` nor `expenses.essential_monthly`, so it falls back to `annualIncome × 0.55 = 47,173 × 0.55 ≈ £25,945`. PCC = £25,945 × leverage(1.044) ≈ £27,089. Then `PRC = liquid + 5y_fake_surplus = 980,000 + (47,173 − 25,945)*5 = £1,086,140`. Ratio = **39.96× to ~52× depending on field rounding** — math reproduces the screen number to ±1 because the persona's real surplus is negative (essentials £84k > income £47k), but the fallback paints a fake +£21k/yr surplus and runs it for 5 years.

What the user expects "income vs commitments" to mean given the same screen says **"−£6,942 spending exceeds income this month"** is: ratio < 1×. Display says 52.4× and labels it `STRONG`. Pure contradiction on the same scroll.

**Severity:** BLOCK. Founder-facing surface metric reports the opposite of reality.
**Fix:** In `canonical-metrics.js:181`, extend the essentials lookup: `+entity?.expenses?.essential_annual || +entity?.expenses?.essential_monthly * 12 || +entity?.monthlyExpenditure * 12 || +entity?.targetIncome || annualIncome(entity) * 0.55`. Apply the same chain everywhere essentials matter (see B2). Then INCOME BUFFER on Mr T becomes: PCC = 84,000 × 1.044 ≈ £87,700; PRC = 980,000 + max(0, (47,173 − 84,000)*5) = £980,000; ratio = 11.2× → still misleadingly high because PRC includes property-adjacent liquidity but PCC is only essentials. The deeper fix is to subtract `5y_essentials_outflow_with_deficit_drawdown` from PRC, then ratio collapses to the 1-3× band the user actually feels. Short-term band rule: if `annualIncome < annualEssential`, force `band='STRETCHED'` regardless of ratio.

### B2. TIME COVERED 150.3 yr is fiction
**File:** `src/screens/MyMoney.jsx:3078-3079, 3239` + `src/components/MyMoney/TileGrid.jsx:165, 234-237`

`monthlyEssentialsForTiles = +entity?.expenses?.essential_monthly || (incomeAnnual * 0.55) / 12`. Same blind spot. Mr T: incomeAnnual = 16,000 (div) + 19,200 (rent) + 11,973 (state pension) = £47,173. Essentials = 47,173 × 0.55 / 12 = **£2,162/mo**. Then `yearsCovered = 3,900,000 / (2,162 × 12) = 150.3 yr`. **Exact match to screen.** Real essentials per persona = £7,000/mo → real years covered = 46.4 yr (still optimistic because it divides net worth — including illiquid £2.25m property + £850k locked pension — by living costs, but at least the denominator is real).

**Severity:** BLOCK. Headline tile shows a number 3.2× too high.
**Fix (two edits, both lines need it):**
- `src/screens/MyMoney.jsx:3079` → `+entity?.expenses?.essential_monthly || +entity?.monthlyExpenditure || (incomeAnnual * 0.55) / 12`
- `src/screens/MyMoney.jsx:3239` → same chain
- Better: extract a single `getMonthlyEssentials(entity)` helper into `_helpers.js` and call it from every site (MyMoney, Cashflow, Risk all duplicate this pattern; grep for `essential_monthly ||`).

Even with the fix, "wealth ÷ annual spending = 46 yr" is misleading because £2.25m is property the user lives in. Either restrict numerator to liquid+pension (980+850 = £1.83m → 21.8 yr — matches what a planner would say) OR rename tile to "Net worth runway at current spend" with provenance footnote.

### B3. CASH "6.9 yr of essentials covered" contradicts "Liquid cash covers 22 months at this rate" — same screen, same cash pile
**File:** `src/screens/MyMoney.jsx:3148-3151` (cash tile) vs `src/screens/MyMoney.jsx:1227, 1242-1244` (runway warning)

The cash tile uses `monthlyEssentialsForTiles` (£2,162/mo ghost) → 180k / 2162 = 83.2 mo = **6.9 yr**.
The runway warning uses `Math.abs(surplus)` (the real deficit, £8,000/mo) → 180k / 8000 = 22.5 mo ≈ **22 months**.

Same screen, same cash, two answers off by 3.6×. Either both should use the real deficit (when in deficit) or the cash tile should label "essentials covered" with provenance ("essentials estimated at £2.2k/mo from 55% of income") — but the persona has the real number so it has no excuse.

**Severity:** BLOCK. Internal contradiction visible at one glance.
**Fix:** Same monthlyEssentials lookup chain as B2. Then both lines converge: 180k / 7000 = 25.7 mo. The runway warning's "at this rate" can keep using `Math.abs(surplus)` because it's specifically about the deficit-burn pace, but rename it so the relationship to the cash tile is clear ("at the current £8k/mo deficit, cash lasts 22 months — vs 26 months if you cut to essentials only").

---

## HIGH — duplications & label divergence

### H1. Wealth / Risk scores duplicated header ↔ Act 1
**Files:** `src/screens/Dashboard.jsx:471-490` (global header chip) + `src/screens/MyMoney.jsx:2868-2880` (TripleAnchor) + `src/components/shared/TripleAnchor.jsx`

`hideNetWorth={true}` is passed on MyMoney (per evidence) but the prop only suppresses the NW tile. Wealth (69) and Risk (71) still render in both the header chip and the Act 1 anchor. Founder says "the score appears 3 times" — header + body anchor + any FQ band reference = correct. Header chip is global, body anchor is screen-local; the latter is the duplicate.

**Severity:** HIGH.
**Fix:** Add `hideWealth` + `hideRisk` props to `TripleAnchor`. Pass both `true` on MyMoney (the screen-level chips already say "WEALTH SCORE / RISK SCORE" exactly what the global header says). Keep Net worth body anchor since the global header omits it on screens that own NW (per existing D-ANCHOR-1). Alternative: hide all three on MyMoney and lean entirely on the global header — the screen identity is already established by the subnav + "What you own" delimiter.

### H2. Pension £850k rendered 3× in ~200px scroll
**Files:** `src/screens/MyMoney.jsx:2969` (WrapperCompositionBar) + `src/components/MyMoney/TileGrid.jsx:323` (WHAT YOU CAN ACCESS pension chip) + `src/components/MyMoney/TileGrid.jsx` PENSIONS CategoryTile.

All three slice the same pension subtotal. The wrapper composition bar (`Property £2.25m | Pension £850k | ISA £420k | GIA £380k | Cash £180k`) and the liquidity bar (`Liquid £980k | Pension £850k | Illiquid £2.25m`) and the per-category tile (`PENSIONS £850k`) each have a defensible reason to exist but stacking all three on the same vertical stripe is the user's complaint.

**Severity:** HIGH.
**Fix:** Drop "WHAT YOU CAN ACCESS" entirely — it's a re-slicing of the same totals already in HOW YOUR MONEY IS HELD. The "liquid vs locked" lens is a worthwhile cut but it belongs as a *toggle* on the wrapper bar (segment by wrapper / segment by liquidity), not a parallel bar. If founder wants both, collapse them into one bar with a switch.

### H3. "+£7k net worth change" rendered 3× in Act 1
**Files:** `src/screens/MyMoney.jsx:2868-2880` (TripleAnchor) + Act 1 verdict sentence + `src/components/MyMoney/TileGrid.jsx:219-225` (LAST MONTH tile)

Founder evidence A.2. Same number wrapped three ways. The verdict sentence "Net worth grew £7k this month, despite a £8k deficit" is the synthesis; the chip + tile are redundant restates.

**Severity:** HIGH.
**Fix:** Keep the verdict sentence (it adds the deficit framing — the why). Drop the +£7k chip on TripleAnchor for MyMoney. The LAST MONTH tile inside BALANCE SHEET is fine because it's part of a 5-tile grid (relative position), but its standalone +£7k chip on Act 1 is the duplicate.

### H4. "12-month net worth +10.9%" vs "1-YEAR GROWTH +£154k (+4.1%)" — same window, different denominators
**File:** `src/components/MyMoney/TileGrid.jsx:77-92` (MiniSparkline.lastPct) vs `src/components/MyMoney/TileGrid.jsx:157-162` (yoyDelta/yoyPct)

Persona-a `trajectories.netWorthHistory` has **24 monthly points** (2024-06 → 2026-05). MiniSparkline calls `data.length >= 2` and normalises against `raw[0]` (24 months ago), so `lastPct = (3,904k − 3,520k)/3,520k = +10.9%`. The yoy tile calls `trajectory[length-12]` (12 months ago, 2025-05) so `yoyPct = (3,904k − 3,732k)/3,732k = +4.6%`. **Wait — evidence says 4.1%, the actual yearAgo would be 3,750k (2025-05-01).** Let me redo: `length=24`, `length-12=12`, `trajectory[12].value = 3,750,000`, `yoyDelta = 154,000`, `yoyPct = 154/3750 = +4.107%` ✓. So tile is correct, sparkline is wrong-labelled.

The MiniSparkline is labelled `"12-month net worth"` (line 307) but actually shows the full trajectory range (24 months on personas with > 12 points).

**Severity:** HIGH. User reads two pcts for the same window.
**Fix:** Slice trajectory to last 12 points before passing to MiniSparkline at `src/components/MyMoney/TileGrid.jsx:304-310`:
```js
<MiniSparkline data={Array.isArray(trajectory) ? trajectory.slice(-12) : trajectory} ... />
```
Or change the label to "since {trajectory[0].date}".

### H5. Wealth/Risk band label diverges across screens
**Files:** `src/screens/MyMoney.jsx:2705-2706` vs `src/screens/HomeScreen.jsx:290, 423` vs `src/screens/Dashboard.jsx:230, 488` (header chip)

MyMoney remaps Risk band to `fqBand(risk.total).name` → "Optimised". Home reads raw `riskData.band.name` → "Protected". Dashboard header uses `riskBand(headerRisk.total)` → "Protected". So *on the same MyMoney scroll* the global header says risk band "PROTECTED" and the Act 1 body says "Optimised" — for the same 71.

**Severity:** HIGH. The N-02 comment claims to fix divergence but only fixes it within MyMoney's Act 1 — it now diverges from the header on the *same screen*.

**Fix:** Pick one vocabulary and put it in `riskBand()` so every consumer (Home, MyMoney, Dashboard, Risk screen) hits the same function. Don't apply screen-local relabels. If the user-research insight is "risk and wealth need to use the same words so they're comparable", apply it globally — which probably means renaming `fqBand`'s "Optimised" to "Established" or similar and forcing risk to map too.

---

## MED — visual & data integrity

### M1. ISA 53% + GIA 48% = 101%
**File:** `src/components/MyMoney/CategoryTile.jsx:282, 332`

`composeWrappers()` returns `share = v / total` (0.5238 for ISA, 0.4762 for GIA). Renderer does `Math.round(w.share * 100)` per slice independently. Both happen to round up → 53 + 48 = 101.

**Severity:** MED. Cosmetic but caught by every reviewer.
**Fix:** Use largest-remainder method, or pin the last segment to `100 - Σ(rest)`:
```js
const pcts = wrappers.map(w => Math.round(w.share * 100))
const drift = 100 - pcts.reduce((s, p) => s + p, 0)
if (drift !== 0) pcts[pcts.length - 1] += drift  // sink rounding into the smallest
```

### M2. Cashflow chart title says income but bar shows spending
**File:** `src/screens/MyMoney.jsx:1120` (`How your income is spent · ${fmtK(income)}/mo`) + the bar at 1101 sums Essentials + Debt + Committed + Shortfall = £19k display width

Title "How your income is spent · £3k/mo" sits on top of a bar whose total is £19k. The bar reads as "how spending breaks down" not "how income breaks down" — but the title says income. Founder evidence A.6.

**Severity:** MED.
**Fix:** Two clean options:
- Keep the bar (it's the more informative visual) and retitle: `Spending breakdown · ${fmtK(totalBarV)}/mo · income £${fmtK(income)}/mo`
- Or actually slice income (3k allocated to essentials → not all essentials covered) — but that's the same data the runway warning already shows. The bar is right, the title is wrong.

### M3. CTA "← Home" on a top-nav screen
**File:** `src/screens/MyMoney.jsx:2805-2811`

The button is wired (`onClick={onHome}`), but a back-arrow on a screen reachable from sidebar is a UX antipattern. Users with a sidebar already have Home one tap away.

**Severity:** MED.
**Fix:** Remove it. The "view-mode hint" pill on the right side of the same row can claim the strip alone. If founder wants a quick-home gesture, sidebar already provides it; if there's a specific journey ("user opened MyMoney from a deep-link and needs to escape"), wire it only conditionally on `document.referrer` or a route flag.

### M4. NOW pill + Today tab are the same concept
**Files:** `src/components/shared/X28TopBar.jsx:243-258` (NOW pill) + `src/components/shared/X28TopBar.jsx:67-72` (VIEW_MODES with `actual → 'Today'`)

NOW = "snap back to current period" (a one-shot button). Today = the actual viewmode (a sticky tab). On `current-period` window with `actual` mode, both light up and look identical. Founder evidence B.7.

**Severity:** MED.
**Fix:** Dim NOW to 0.45 whenever window+mode are both already "now/actual" — which the code already does for plan/scenario mode (`nowDimmed`) but not when actual+current-period is the active state. Or just remove NOW: a sticky `Today` tab makes the snap-back redundant.

### M5. "Tax year ▼ UK tax 2026/27" — label and value both say "tax"
**File:** `src/components/shared/X28TopBar.jsx:232-238`

Rules-version chip label `UK tax 2026/27` sits next to the window selector defaulted to `Tax year`. Reads "Tax year / UK tax 2026/27" — repetitive.

**Severity:** LOW.
**Fix:** Rename rules chip to `Rules: UK 2026/27` or `2026/27 rules` so it doesn't echo the window selector.

### M6. Hardcoded UK figures still scattered through MyMoney text
**File:** `src/screens/MyMoney.jsx` lines 1003, 1015, 1016, 1441, 2386, 2404, 3041, 3043, 3412

`£20k` (ISA allowance), `£60k` (CB threshold + pension AA), `£100k` (PA taper), `60p after 40% tax relief`, `up to 47% in tax relief`. These should resolve from `TAX.isaAllowance`, `TAX.pensionAA`, `TAX.personalAllowanceTaper`, `TAX.childBenefitChargeThreshold`. The current numbers happen to be right for 2026/27 but every Budget breaks them silently.

Per global memory rule "Always check rules-uk.js before citing any UK figure" — these are violations.

**Severity:** MED (correct today, will rot).
**Fix:** Replace each literal with the engine constant + a `useMemo` for the formatted string. Add an ESLint rule or grep test that flags `£\d+k` in any user-facing JSX string under `src/screens/`.

---

## LOW — provenance gaps

### L1. The "Optimised" verbal label has no rubric on hover
Evidence E.19. The score is shown with a band name but no tooltip / drill explaining the band thresholds. Drillable principle (PP-3) says every number must surface source + formula on tap. The band IS a derived value.

**Fix:** Wire the band span to an Explainer with the bucket boundaries (`<20 Exposed · <40 Building · <60 Established · <80 Optimised · ≥80 Exceptional`) — that comment block already exists at MyMoney.jsx:2704.

### L2. PENSIONS tile says `Pension 100%` for composition
Tile composition reads "100% pension" because `composeWrappers()` runs on rows that are all wrapper=PENSION. Technically correct, visually pointless — it adds a row and a bar that say nothing. Founder evidence C.13.

**Fix:** Suppress the composition row in `CategoryTile.jsx:118` render when `wrappers.length === 1`.

### L3. CASH "STRONG BUFFER" status hinges on broken month math
**File:** `src/screens/MyMoney.jsx:3153-3155`. Status band depends on `months >= 6` where months is computed from ghost essentials. Same root cause as B2 — once B2 is fixed, this band re-evaluates and may flip to "Adequate" (180k / 7000 = 25.7 mo, still > 6, still "Strong" — survives). Flag because the bands are wired to a value that's wrong by 3×.

---

## Severity roll-up

| ID | Severity | One-line |
|---|---|---|
| B1 | BLOCK | INCOME BUFFER 52.4× — wrong essentials denominator |
| B2 | BLOCK | TIME COVERED 150.3 yr — wrong essentials denominator |
| B3 | BLOCK | Cash "6.9 yr covered" contradicts "22 months at this rate" |
| H1 | HIGH | Wealth/Risk score duplicated header ↔ body |
| H2 | HIGH | Pension £850k rendered 3× on same scroll |
| H3 | HIGH | "+£7k delta" rendered 3× in Act 1 |
| H4 | HIGH | Sparkline +10.9% vs YoY tile +4.1% — same label, different windows |
| H5 | HIGH | Risk band "Optimised" on MyMoney vs "Protected" on Home + global header |
| M1 | MED  | Wrapper composition rounds to 101% |
| M2 | MED  | "How your income is spent · £3k" titles a £19k spending bar |
| M3 | MED  | "← Home" back arrow on a top-nav screen |
| M4 | MED  | NOW pill + Today tab redundant when both active |
| M5 | LOW  | "Tax year / UK tax 2026/27" label echo |
| M6 | MED  | Hardcoded UK figures (£20k ISA / £60k CB / £100k PA) |
| L1 | LOW  | Band labels lack on-hover rubric |
| L2 | LOW  | "Pension 100%" composition row on single-wrapper tile |
| L3 | LOW  | Cash status band derived from broken essentials math |

---

## Single-line root cause

Every essentials-dependent calc on MyMoney reads `entity.expenses.essential_monthly` and falls through to a 55%-of-income fallback when missing. The actual persona field is `entity.monthlyExpenditure`. **One missing field-name in three calls is the source of three BLOCK-level wrong numbers.** Fix the field lookup chain in one helper and ship — that's a single-day patch, not a redesign.

---

**Auditor:** parallel static + calc pass.
**Cross-references for the founder:** `src/engine/canonical-metrics.js:179`, `src/screens/MyMoney.jsx:3078-3079, 3239, 3148-3151`, `src/components/MyMoney/TileGrid.jsx:148, 165, 304-310, 282`, `src/screens/Dashboard.jsx:471-490`, `src/screens/HomeScreen.jsx:290`.
