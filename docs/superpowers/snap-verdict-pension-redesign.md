# Snap Verdict — Pension Surface Redesign (§9.5 Gate)

**Date:** 2026-05-31 · **Persona:** Bruce Wayne (age 62, NW £3.90m) · **Server:** caelixa-dev :5173
**Spec:** docs/superpowers/specs/2026-05-31-pension-surface-redesign-design.md
**Verdict:** CORE SURFACES VERIFIED — partial gate (see Gaps). Founder review pending before full done-claim.

## Surfaces verified (desktop 1280, app default theme)

### L2 — Pension summary drill ("Your pensions")
- Header: **"£850,000 ACROSS 3 PENSIONS · 1 NEED REVIEW"** — composition revealed ✓
- Grouped: SELF-INVESTED (Vanguard SIPP £420k, Hargreaves SIPP £280k) · WORKPLACE/LEGACY·VERIFY FIRST (Wayne DC £150k) ✓
- Type badges (SIPP / Workplace DC), no redundant "Pension" tag ✓
- Per-pot: value, £/yr fees, nomination state (green/amber), per-pot trend-line ✓
- "Turn this into income →" CTA + ordered §4.5 spine (Contributions→Tax-free cash→Estate 2027→Charges→Data) ✓
- FCA frame present ✓
- **Tie-out:** 420k + 280k + 150k = 850k = header total ✓

### L3 — Decide view ("Turn your pensions into income")
- Guided 4-step plan with reasons: verify legacy → phased tax-free cash → flex SIPPs → time vs 6 Apr 2027 ✓
- Flags: "1 workplace/legacy scheme needs checking", "Pensions enter your estate … in 310 days" ✓
- Interactive: £34,000/yr slider → **"77% · Chance it lasts to 95"** (labelled, real engine, clamped 0–100) ✓
- "4.0% % of pot/yr", "income tax applies above your allowance", Add to my Plan ✓
- **Old "Pension 100%" naked-number bug = GONE** (now labelled + clamped) ✓

### L3 — Per-pot leaf ("Wayne Enterprises DC (legacy)")
- VALUE TODAY £150,000 + Workplace DC badge ✓
- PROJECTED TO RETIREMENT (age 67) trend + "assumption — not past performance" honesty ✓
- ANNUAL CHARGE 0.65% ≈ £975/yr ✓ (tie-out 150k×0.65% = 975 ✓)
- TAX-FREE CASH up to £37,500 ✓ (tie-out 150k×25% = 37,500 ✓)
- WHO INHERITS + 2027 effect ✓
- ITS ROLE: "Step 1: Check your Wayne … (legacy) first" + reasoning ✓
- Update value + FCA frame ✓

### L1 — Home NW-breakdown overlay
- Pension row gains "across N pensions · M need review" + per-pot MiniTrendLines (code verified, build clean; visual snap pending)

## Tests
- decumulation-plan 15/15 · projection (incl projectSeries) 24/24 · build exit 0

## Gaps (NOT yet done — honest)
1. **Viewport/theme matrix incomplete.** Only desktop + app-default theme captured. Mobile 375 / tablet 768 and dark-mode snaps outstanding (app theme does not flip via prefers-color-scheme; needs the in-app theme toggle).
2. **`+0.2%` / `Pension 100%` tile labels** on MyMoney category tiles + a Home button remain unlabelled — pre-existing surfaces NOT touched by this work. Need founder to confirm which tile before fixing.
3. **800-line dead inline `PensionDrillDown`** in MyMoney.jsx superseded but not excised (pending sign-off).
4. **Home tile trend-lines** rendered in code, not yet snap-confirmed at viewport.
