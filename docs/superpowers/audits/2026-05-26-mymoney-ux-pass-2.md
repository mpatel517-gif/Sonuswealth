# MyMoney UX Pass 2 — Founder-Triggered Audit
**Date:** 2026-05-26 · **Reviewer:** UX critic · **Trigger:** founder flagged 4 basic issues I missed because no visual pass was run.

Severity: **BLOCK** = ship-stopper · **HIGH** = obvious to user · **MED** = polish · **LOW** = nit.

---

## 1 · Founder-named issues (confirmed in code)

### B1 — Redundant verdict sentence vs LAST MONTH tile [HIGH]
- **Where:** under triple anchor, `MyMoney.jsx:2893-2920` (verdict) + `TileGrid.jsx:219-225` ("Last month" TrendBox).
- **What's wrong:** sentence reads `Net worth grew £6k this month, despite a £552 deficit.` The £6k is *also* the LAST MONTH metric tile to the right. Same number, two surfaces, 6 inches apart. The verdict was the *replacement* for an earlier DeltaChip (comment at line 2884 admits "Three surfaces collapsed to two") — but the dedupe stopped one step short.
- **Fix:** kill the NW half of the sentence — keep ONLY the deficit/surplus clause (the unique info the tile doesn't carry). `Monthly deficit of £552 — your wealth still grew because investments outpaced the gap.` OR simpler: drop the sentence entirely and surface the deficit→NW reconciliation inside the CashFlowDrill where it belongs. **File:** `src/screens/MyMoney.jsx:2904-2911`.

### B2 — "WHAT YOU OWN · Assets · £988k · Tap any tile to drill" header band is dead weight [HIGH]
- **Where:** `MyMoney.jsx:2939-2944` (SectionDelimiter) immediately above `MyMoney.jsx:2946-2970` (HOW YOUR MONEY IS HELD wrapper card).
- **What's wrong:** Three redundancies on one band: (a) `Assets · £988k` repeats what the wrapper composition bar sums to and what the category-tile grid sums to; (b) "Tap any tile to drill in" duplicates the per-tile "View detail →" footer button in every CategoryTile; (c) the eyebrow "What you own" is then mirrored by "How your money is held" eyebrow 12px below — two eyebrows back-to-back.
- **Fix:** delete the SectionDelimiter. Promote "How your money is held" to a single eyebrow + total badge: `How your money is held · £988k`. The "tap to drill" hint is a one-time onboarding tooltip, not a permanent label. **File:** `src/screens/MyMoney.jsx:2938-2945`.

### B3 — Hero card asymmetry: 6 metric tiles vs single sparkline column [HIGH]
- **Where:** `TileGrid.jsx:263-442`. Left flex: NW eyebrow + 110×22 sparkline + liquidity legend + 6-px bar. Right grid: fixed `width: 180`, `gridTemplateColumns: '1fr 1fr'`, 3 rows of TrendBoxes (Plan funded, 1-yr growth, Last month, Debt ratio, Time covered, Income buffer).
- **What's wrong:** the left column has lots of vertical breathing space (sparkline ~22px tall, legend ~16px, bar 6px = ~44px of content) while the right side is a dense 6-tile grid at ~96px tall. The visual centre of mass is hard right; the NW identity feels orphaned.
- **Fix:** founder's suggestion is correct. Promote the 6 metric tiles to a full-width row ABOVE the hero card (or BELOW the liquidity bar, full-width). Hero card becomes a single horizontal band: eyebrow → sparkline → liquidity bar. Metric strip below: 6 equal cells in a 6-col grid at desktop, 3×2 at tablet, 2×3 at mobile. Removes the asymmetry AND fixes a mobile bug (see M2 below). **File:** `src/components/MyMoney/TileGrid.jsx:418-441` (right grid) and `251-443` (overall card layout).

### B4 — Category tile sparkline coverage is hardcoded asymmetric [BLOCK]
- **Where:** `MyMoney.jsx:3216-3227`. Hardcoded `SPARKLINE_CATS = ['pensions', 'investments', 'property', 'business', 'liabilities']`. Protection, cash, alternatives, obligations get NO `series` prop, so `CategoryTile.jsx:161` falls through to no sparkline.
- **What's wrong:** the founder's eye is calibrated. Code admits it openly: "Protection/cash/alternatives/obligations have no growth story to chart." That's a *content* claim, but the *visual* outcome is that 4 of 8 tiles look truncated. Inconsistent tile chrome is a worse problem than charting a near-flat line.
- **Fix:** every tile gets a series. Options: (a) cash/protection/obligations get a flat line + zero-line indicator (honest: "stable"); (b) alternatives gets the back-cast drift treatment same as investments; (c) if a category genuinely has no series, render a placeholder of the same height (e.g. a small icon badge or a "no history yet" microcopy strip) so the tile chrome is identical. **Push back on the locked decision** at line 3216-3218 — "no growth story" is not a UX reason to break visual rhythm. **File:** `src/screens/MyMoney.jsx:3216-3227`.

---

## 2 · Issues I found that the founder did NOT name

### F1 — CategoryTile heights vary because of optional rows [HIGH]
- **Where:** `CategoryTile.jsx:266-403`. Composition bar (line 266), context line (342), cost-of-waiting block (349), status chip (371), empty-state copy (396) are all conditionally rendered. Combined with `minHeight: 200` (line 130) and `flex: 1 + justifyContent: 'flex-end'` (line 341), tiles with rich content (Pensions: bar + context + CoI + chip) end up much taller than tiles with sparse content (Obligations: empty state only).
- **Fix:** lock tile height to a fixed value (e.g. 240px) or use CSS grid with `grid-auto-rows: 1fr` on the parent so every row matches the tallest tile in that row. Currently `MyMoney/TileGrid.jsx:453` uses `gridTemplateColumns: '1fr'` (single column) — change to `repeat(auto-fit, minmax(280px, 1fr))` AND `gridAutoRows: '1fr'`. **File:** `src/components/MyMoney/TileGrid.jsx:453-457`.

### F2 — Single-column tile grid on desktop [BLOCK]
- **Where:** `TileGrid.jsx:454-456`: `gridTemplateColumns: '1fr'`.
- **What's wrong:** every CategoryTile renders full-width, stacked vertically, on every viewport. Pensions tile sits alone in a 1440px-wide row. That's wasted real-estate on laptop AND forces 8 vertical taps to see all categories. Mobile is fine; desktop is broken.
- **Fix:** `gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))'` with `gridAutoRows: '1fr'`. Yields 4-up on laptop, 3-up on tablet, 1-up on mobile. **File:** `src/components/MyMoney/TileGrid.jsx:453-457`.

### F3 — Hero card flex row never wraps on mobile [HIGH]
- **Where:** `TileGrid.jsx:263` — `display: 'flex', alignItems: 'flex-start', gap: 16`. No `flexWrap`. Right grid has `width: 180, flexShrink: 0`.
- **What's wrong:** at 480px wide, the 180px-fixed right grid + 16px gap leaves ~284px for the left column. The 110×22 sparkline + liquidity legend chips will compress / overflow. Right grid stays at 180 (flex-shrink 0).
- **Fix:** add `flexWrap: 'wrap'` and let right grid become full-width at mobile via a `@media` rule or container query. Or move right grid below left at <600px. Already required by B3 fix. **File:** `src/components/MyMoney/TileGrid.jsx:263`.

### F4 — TrendBox label sizes are micro [MED]
- **Where:** `TileGrid.jsx:36-44`: label `fontSize: 8`, labelDetail `fontSize: 7`, hero value `fontSize: 11`.
- **What's wrong:** 7px and 8px fail WCAG comfortable-reading floor (16px body, 12px floor for secondary labels). On a Retina display at 100% zoom the labels are barely legible. The value at 11px isn't much better.
- **Fix:** once tiles move to a full-width strip (B3), labels go to 10-11px, values to 18-20px. Use the design system's `--font-eyebrow` / `--font-metric-sm` tokens if they exist. **File:** `src/components/MyMoney/TileGrid.jsx:36-54`.

### F5 — Liquidity legend buttons + bar segments are double-tappable but only the bar drills [MED]
- **Where:** `TileGrid.jsx:354-371` (legend chip buttons fire `onView?.(s.view)`) and `380-392` (bar segments also fire `onView?.(s.view)`).
- **What's wrong:** two separate tap targets for the same action, no visual link between them other than colour. Mobile users may tap the dot (3px diameter via `width: 8`) and miss.
- **Fix:** make the legend chip the canonical tap target; turn the bar segments into pure visual (decorative `<div>` not `<button>`). Or merge legend + bar into a single horizontal bar with text overlaid at >40% width segments. **File:** `src/components/MyMoney/TileGrid.jsx:347-395`.

### F6 — Sparkline label "12-month net worth" + percentage badge stacks under tiny chart [LOW]
- **Where:** `TileGrid.jsx:104-114`.
- **What's wrong:** label + percentage are 8px font, span: between label-left and pct-right with `justifyContent: 'space-between'`. At 110px width that's fine; but the eyebrow ABOVE already says "Net worth · forecast · 12mo". The label is duplicative.
- **Fix:** drop the label string from MiniSparkline when an eyebrow already describes the chart. Keep only the trailing percentage. **File:** `src/components/MyMoney/TileGrid.jsx:106-113`.

### F7 — "What you can access · liquidity timeline" is jargon [MED]
- **Where:** `TileGrid.jsx:350`.
- **What's wrong:** "liquidity timeline" is finance jargon; macOS principle says simple surface, depth on tap. "Liquidity" itself is borderline.
- **Fix:** `How quickly can you reach your money` or `Time to cash · liquid → locked`. Reserve "liquidity" for L2/L3 drills. **File:** `src/components/MyMoney/TileGrid.jsx:350`.

### F8 — CategoryTile icon button + card click double-fire [LOW]
- **Where:** `CategoryTile.jsx:138-155` (icon button) + `133` (card onClick).
- **What's wrong:** both call `onView()`. The icon button uses `e.stopPropagation()` so it's not a literal double-fire, but tap-target overlap is confusing — the user can't tell which is interactive. There's also a "View detail →" button in the footer (line 410-420) firing the *same* action. Three tap targets, one action.
- **Fix:** the whole card click is enough. Remove the icon button (or make it purely decorative) and remove the footer "View detail →" link OR replace it with a *different* secondary action (e.g. "Quick add" / "Compare wrappers"). **File:** `src/components/MyMoney/CategoryTile.jsx:138-155, 410-420`.

### F9 — Composition mini-bar chip buttons can hover-grow past tile bounds on mobile [LOW]
- **Where:** `CategoryTile.jsx:307-313` — chip has `minHeight: 28, padding: '4px 6px'`. Up to 3 chips + wrap. Tile is `minHeight: 200`. If a tile renders 3 chips + sparkline + value + composition bar + context + CoI + status + footer, content can exceed 200 and the tile grows unevenly (root cause of F1).
- **Fix:** cap chip count at 2 + "more" overflow; or fix tile height (see F1). **File:** `src/components/MyMoney/CategoryTile.jsx:289-336`.

### F10 — `aaHeadroomLeft` referenced but I can't see where it's rendered; check for stale code [LOW]
- **Where:** `MyMoney.jsx:3072`. Looks computed but I didn't grep for its render-site.
- **Action:** verify it's actually surfaced; if not, dead-code candidate.

---

## 3 · Self-critique — what should the UX skill have caught earlier?

I didn't run `frontend-design` or a visual-pass skill. I treated this work as a series of point edits (`HIGH-2` dedupe, `M-10` alt bucket fix, "round 6" inline-block removal) — each one a local optimisation that didn't ask the meta-question **"after this edit, does the screen *look* coherent at first glance?"** The four founder-named issues all share a single failure: **I dedupe *content* but never audit *visual rhythm***. A 30-second screenshot pass at 3 viewports × 2 themes would have caught B1/B2/B3 instantly — and would have surfaced F1, F2, F3 which I'd never have found by code-reading alone. The CLAUDE.md §9 gate ("every snap inspected at every viewport") is the literal rule I bypassed. The skill mapping in SKILLS.md says `/impeccable audit` covers a11y + broken routes; what's missing is a UX-rhythm pass — symmetry, tile height parity, redundant headers, label hierarchy. That should be a hard gate before any "shipped" claim, not a post-hoc founder catch.

**Verdict:** the founder is right. I owe the snap pass + a render-cycle test of B3's layout proposal before any of these fixes ship.
