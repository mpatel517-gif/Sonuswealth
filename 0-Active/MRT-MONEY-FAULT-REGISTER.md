# Mr T · MyMoney — Architect Fault Register

**Surface:** `?demo=mrt&tab=money` — Balance Sheet (asset tiles, liability tiles, liabilities drill, leaves).
**Method:** one-mind audit across all 6 lenses (F1 IFA · F2 FCA · F3 data-viz · F4 UX/IA · F5 drillability · F6 architecture). Rendered + DOM-scraped + code-read.
**Date:** 2026-06-01. **Status:** AUDIT — awaiting founder sign-off before batch-fix.
**Rule of this pass:** find everything first, fix as one batch for Mr T, verify the whole surface, then replicate to b–g.

---

## ⓪ CONCEPTION FORK (needs your decision — I will not silently resolve it)

**FK-1 · Liabilities: 4 per-debt tiles vs ONE category tile.**
Today liabilities render as 4 separate tiles (Mortgage / BTL / Credit card / Student loan), each drilling to the *same* "What you owe" screen (FT-3 below). Assets render as ONE category tile per class (Pensions, Property…) → that class's drill. The asymmetry is the root of faults #1 and #3.

**DECISION (founder, 2026-06-01): KEEP 4 debt tiles — each drills to ITS OWN debt leaf** (not the shared screen). So: build a proper per-debt leaf as the tile destination; one real amortisation sparkline per tile; the shared "What you owe" drill stays reachable (Debt-ratio → Open liabilities) and must also be de-shambled.

**~~My recommendation: collapse the 4 debt tiles into ONE "Liabilities" category tile~~** (not chosen), structurally identical to an asset CategoryTile:
- multi-line sparkline = **one real amortisation line per debt** (→ "multiple sparklines", naturally, and *real* not back-cast);
- "across N debts" composition bar, each segment a debt;
- change% (debt shrinking) + Now→Future→Plan trajectory (paydown);
- footer `View detail → · What if ⚡ · + Add` → opens the grouped "What you owe" drill.

Why: you've said three times "make liabilities follow the asset look and feel." One category tile *is* the asset pattern. It resolves "all tiles go to the same screen" (there is one tile → one drill), and the per-debt detail lives in the drill where it belongs. **If you'd rather keep 4 tiles**, the alternative is each tile drills to *its own* debt leaf — say which and I'll build that instead.

---

## A · LIABILITY TILES

| ID | Lens | Sev | Fault | Fix |
|----|------|-----|-------|-----|
| FT-1 | F3/F6 | High | **No real sparkline.** `series` only passes when `monthly>0`, and `backcastSeries()` fabricates the principal split (`monthlyPay*0.85`/`0.55`) — a made-up line. Cards/interest-only/no-payment debts show nothing. | Build the line from real amortisation `bal·(1+r/12) − payment`; interest-only → genuinely flat (honest), labelled. Under FK-1, one line per debt on the single Liabilities tile. |
| FT-3 | F4/F5 | High | **Every tile → same screen.** `onView={() => setActiveDrill('liabilities')}` (×4). Subtitle admits it: "Tap any tile to open the liabilities drill." | Per FK-1: one tile. If 4 tiles kept: each `onView` opens *its* debt leaf. |
| FT-4 | F1 | Med | Avalanche marker only ≥8% APR — fine, but no debt shows its **payoff date / interest-this-year** on the tile (the two facts that drive a paydown decision). | Surface "£X interest/yr · clear ~YYYY" on the tile. |

## B · LIABILITIES DRILL ("What you owe") — the shambles

| ID | Lens | Sev | Fault | Fix |
|----|------|-----|-------|-----|
| FD-1 | F1 | **Crit** | **"~5637 months at current minimums" = 470 yrs** on the BTL (interest-only → principal≈0 → nonsense). Same class of bug on any interest-only debt. | Detect interest-only (payment ≈ interest) → show "Interest-only — balance not reducing; £X interest/yr" not a fake payoff. |
| FD-2 | F4 | High | **Unit is months.** "439 months", "1496 months", "5637 months" — unreadable for multi-decade debt. | Years (1 dp), or "clears ~2039". |
| FD-3 | F1/F4 | High | **£215k printed 4×**: Section 1 tile + Section 2 tile + Section 3 group header + row. £357k total printed 2× (header + Section 1). £142k "other loans" + estate-deductible repeated as tile *and* per-row chip. | Collapse to one statement of each number. Drop Section-1/Section-2 number tiles that the grouped Section 3 already carries; keep LTV bar only. |
| FD-4 | F4 | High | **Single-debt groups = pure duplication.** Every group holds exactly 1 debt, so "Residential mortgage · 1 debt · −£215k" headers an identical "Residential mortgage › −£215k" row. The grouping wrapper adds a layer and zero information when N=1. | Only render a group *header* when the group has ≥2 debts; a lone debt renders as a single row under a thin type label. |
| FD-5 | F3 | High | **No trend/trajectory anywhere** in the drill — no paydown line, no "balance over time", despite this being the one screen about clearing debt. | Add a per-debt paydown line (balance now→future at current payment) + the contributed-vs-interest split. Honest flat line for interest-only. |
| FD-6 | F4 | Med | **Two different categorisations of the same debts on one screen**: Section 1 splits "Mortgage / Other loans"; Section 3 groups "Residential / BTL / Student / Credit". Reader can't reconcile. | One taxonomy. Section 3's type groups are canonical; Section 1 mortgage/other split goes. |
| FD-7 | F4 | Med | **Low density, long scroll** of big chunky cards — 4 debts shouldn't need 2½ screens. | Tighten to a dense per-debt row table with the leaf on tap; supporting context (LTV, sources-to-pay) as compact panels, not full sections. |
| FD-8 | F2 | Low | "Estate-deductible / Not in estate" is correct and useful — keep, but as one chip per row, not also a Section-1 number tile. | Dedup (covered by FD-3). |

## C · CROSS-CUTTING

| ID | Lens | Sev | Fault | Fix |
|----|------|-----|-------|-----|
| FC-1 | F6 | High | **Asset/liability inconsistency** (the founder's #1). Assets: real multi-line sparkline + composition + trajectory + drill-to-source. Liabilities: none of it. Same tile component should serve both. | Implement FK-1 so liabilities use the asset tile grammar. |
| FC-2 | F5 | Med | Liability drill rows open `AssetDetailOverlay` (generic) — verify it bottoms at the **debt's** source facts (lender, rate, fix-end, statement) with add/modify, per R13. | Confirm/ъwire the leaf to debt fields. |

## D · CARRIED-OPEN (already known, not regressions of this pass)

| ID | Sev | Fault | Note |
|----|-----|-------|------|
| FO-1 | High | **Hero tie-out:** Assets £1.20m − Liab £357k = £843k ≠ NW £698k. `_heroBaseAssets` hand-sum (incl. DB `cetv`) diverges from canonical `netWorth()`. | Engine reconciliation across all 7 personas — separate careful pass; blind fix regresses Tony Stark/Wonka. |
| FO-2 | Low | **Property/Business sparklines coincide** (2 lines, 1 shape) — same growth assumption, honest. | Only a real split is via seeded per-holding history. |

---

## Fix order (one batch for Mr T) — STATUS

- [x] **New `debtMath.amortise()`** — single correct calc (status: amortising / interest-only / no-payment). Kills FD-1 (470-yr bug) everywhere it's used.
- [x] **FT-1 / FC-1** — liability tiles now show a REAL amortisation sparkline + 12-mo change% + paydown trajectory bar. Root cause was a field-mapping bug: 3 of 4 debts store the payment as `monthly_payment`/`repayment_from_salary_monthly`, tile read only `monthlyPayment` → £0 → no line. Fixed.
- [x] **FT-3** — each tile `onView` → its own `DebtLeaf` (new component), not the shared screen.
- [x] **`DebtLeaf`** — clean per-debt screen: labelled paydown chart (years axis, today→clear, interest-only honest-flat), drill-to-source facts (R13, balance editable at resolved path), debt-type context. Replaces the shambles as the primary destination.
- [x] **FD-1/2** — shared drill payoff now via `debtMath` → "clears in ~23 yr" / "over 40 yr — mostly interest", never raw months.
- [x] **FD-3/6** — shared drill Section 1 reduced to the one non-redundant insight (estate-deductible vs not). £215k went 4 prints → 2 (LTV context + its row).
- [x] **FD-4** — single-debt group headers collapsed (no header repeating its lone row).
- [x] **Type-detector underscore bug** — `buy_to_let_mortgage` was mis-classed as residential (showed a home LTV on the BTL). Normalised `[_-]` before matching.
- [ ] **FD-5 (partial)** — paydown trajectory is on the tile + leaf; shared drill still lists payoff as text, no per-debt mini-line. Polish.
- [ ] **Part-to-whole composition viz** in the shared drill (debt-by-type bar) — not added. Polish.
- [ ] **FO-1 hero drift**, **FO-2 property/business coincidence** — carried open (separate passes).

**Verified on Mr T (dark, desktop, screenshots + DOM):** 4 tiles with sparklines + trajectory; tile→leaf; leaf chart + facts; shared drill de-shambled; payoffs sane (2.9/23/32/40+ yr); subtotals tie to £357k.

**Next:** founder approval → replicate (debtMath / tile-mapping / DebtLeaf are persona-agnostic; verify each of b–g).
