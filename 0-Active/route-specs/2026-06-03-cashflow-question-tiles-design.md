---
Title: Cashflow Question-Tiles — IA Redesign Design Spec
Version: 1.0
Date: 2026-06-03
Status: DOCUMENTED
Cluster: 2-Product / Cashflow
File name: 2026-06-03-cashflow-question-tiles-design.md
Purpose: Restructure the Cashflow tab from a long inline scroll into a headline-answer band + a grid of question-tiles that each open a full-screen drawer-page, mobile-first, with toggles/progressive disclosure. Settles container model, scope, tile set, page grammar, and the three content fixes the founder raised.
---

**Summary:** Cashflow becomes a one-glance "headline answer" band over seven question-tiles (each a tile→drawer-page reusing §A's in-file fixed-panel pattern), mapped 1:1 to the spec's §1.7 question inventory, with the back-solve/money-map drawdown plan as the centerpiece page.
**Tags:** #cashflow #IA #redesign #decumulation #mobile
**Updated:** 2026-06-03

---

## 1. Goal

Kill the §B long-scroll. Today Cashflow renders ~20 cards in three inline sections (§A Now, §B Trajectory RevealStagger, §C Depth reveal). On mobile this is unusable. Founder direction (2026-06-03): "this whole set of screens should be called from a drawer or tile like the assets on the balance sheet"; "get the display, toggle and information correct first." Reorganise the **whole tab** into question-tiles, each opening its own drawer-page, under one dominant headline answer.

## 2. Locked decisions (this session)

- **Container model:** several tiles, each its own full-screen page (NOT one drawer with inner toggles). Methods is its own drawer.
- **Scope:** the whole Cashflow tab, not just the trajectory section. One tile→page grammar across the tab.
- **Surface anchor:** ONE dominant headline-answer band above the tile grid (honours the locked "funded gauge is the universal anchor / not everyone wants a drawdown").
- **Tile set:** seven question-tiles (below), validated against the canonical spec §1.7 Question Inventory.

## 3. Coverage map — spec §1.7 questions → tiles

| # | Spec §1.7 question | Tile |
|---|---|---|
| 1 | How much am I spending vs earning? | Am I OK right now? |
| 2 | Am I on track for retirement? | Will my money last? (+ headline band) |
| 3 | Probability of not running out? | What could break it? (Monte-Carlo PoS) |
| 4 | Cost of doing nothing? | What's it costing? (CoI) |
| 5 | Is my capital working harder than it costs? | What's it costing? (PRC/PCC, efficient frontier) |
| 6 | What would change my picture the most? | What would change it most? (goal-seek / what-if) |
| 7 | How sustainable under stress? | What could break it? (sequence / Guyton-Klinger) |

Plus two founder-direction decumulation tiles that extend the spec's inventory: **How do I draw it down?** (the goal-engine drawdown plan) and **How fast can I spend?** (the 5 withdrawal methods — founder's dedicated methods drawer).

## 4. Surface layout

```
Sub-nav chips (Balance Sheet · Income Statement · Cashflow · Tax · Protection · Trusts)  [keep]
P&L / simple↔accountant view toggle  [keep — spec §2.3, director-mandated]
X28 time-window selector (Now · Future · Plan)  [keep — spec §X28]
┌──────────────────────────────────────────────┐
│ HEADLINE ANSWER BAND                          │
│ "On these assumptions, your money lasts to     │
│  age 94"  + compact funded-ratio gauge         │
│ Adaptive: accumulator → "On track to FI ~58"   │
│ Override chip: Auto · Drawing income · Building │
└──────────────────────────────────────────────┘
TILE GRID  (1-col mobile · 2-col desktop)
 1. Am I OK right now?      surplus £X/mo · runway N mo
 2. Will my money last?     funded 1.2× · to age 94
 3. How do I draw it down?  Pension-first · to 94
 4. How fast can I spend?   ~£68k/yr (Bengen)
 5. What could break it?    sequence risk: moderate
 6. What would change it most?  top lever: retire +2y
 7. What's it costing?      charges £X/yr
Disclaimer + rules-version footer
```

Each tile: question label · headline metric · one-line sub · chevron. Tap → full-screen drawer-page.

## 5. Tile → page contents (each wraps existing components)

| Tile | Page contents (existing components moved into the drillView panel) |
|---|---|
| 1 Am I OK now? | cashflowFlow Sankey + waterfall · surplus/deficit · liquidity buffer · essentials-v-discretionary · subscription tracker · income by source/band |
| 2 Will my money last? | funded-ratio gauge workings · FI progress · drill to source/formula/confidence (PP-3) |
| 3 How do I draw it down? | **back-solve hero + runway** · money-map · routes-considered strip · year-by-year table · **assumptions panel** |
| 4 How fast can I spend? | the 5 withdrawal-methods comparison (`compareMethods`) |
| 5 What could break it? | sequence-of-returns stress · Monte-Carlo PoS fan · Guyton-Klinger corridor |
| 6 What would change it most? | goal-seek ranked levers (`goalSeek`) + what-if ripple (X24 mode-3) |
| 7 What's it costing? | CoI odometer · CF CoI variants · max-drawdown · efficient frontier · PRC/PCC + Reality stubs |

## 6. Adaptive face (decumulator vs accumulator)

Driven by existing `inferLifeStage`/`inferBranch` + the `PREFERENCE_SET` override (already built). 
- **Decumulator:** tiles 3 (draw down) and 4 (methods) prominent; headline = "lasts to age X".
- **Accumulator/preserver:** tile 3 → "Am I on track? (FI)" (FIProgressTile); tile 4 hidden or labelled preview; headline = "on track to FI by ~X". Never pushes a non-drawer to draw.

## 7. Page grammar (every drawer-page)

Reuse §A's in-file fixed-panel pattern (`setDrillView('<key>')` → early-return fixed panel → `DrillStackProvider` wraps inner; back/home header). Keys: `now · lastability · drawdown · methods · resilience · whatif · costs`. Each page follows the doctrine order: **answer → chart (why) → decision (save plan / model what-if / ask Sonu) → assumptions footer.**

## 8. The three content fixes (founder, 2026-06-03)

- **Runway (#3a):** funds-to-age is a prominent secondary stat in the drawdown hero — "£129k/yr → lasts to age 81" — updating live on back-solve (already computes 94→76→…). Also drives the headline band.
- **Assumptions (#3b):** a collapsible Assumptions panel on the drawdown page rendering the engine's `solve.methodology` (growth % nominal, no further contributions, inflation %, drawn-to-age, current UK bands, 2027 pension-IHT applied). Surface methodology to user (memory: feedback_surface_methodology_to_user).
- **Path-vs-amount legibility (#2):** one-liner by the money-map — "Dragging income changes WHEN each pot is used; reorder priorities (or pick another route) to change the ORDER" — plus the route-name label already on the map. (Verified: amount re-routes timing/ages live; order is priority-driven. Not a bug.)

## 9. Build mechanics

- File: `src/screens/Cashflow.jsx` (single inline house-pattern file). Do NOT split into section files.
- One reusable `QuestionTile({ icon, question, headline, sub, onClick })`.
- Tile-pages wrap **whole existing component blocks** moved into `drillView` panels (low-regression; never retype props).
- Surface render replaces the §A inline cards + §B RevealStagger + §C reveal with: headline band + tile grid. The existing components are NOT rewritten — they move into pages.
- Keep `MoneyXDrawer` sub-nav, the P&L/accountant toggle, X28 selector, triple-anchor.

## 10. Compliance (FCA boundary)

Decisions a page may offer: save-as-plan / model what-if / ask Sonu — never "do X". Goal-seek levers framed as "what changes the picture", illustration-not-forecast. Methods framed as general approaches, recommended badge = "fits your #1 priority", never "best". Disclaimer on every action path. Run `sonuswealth-compliance` + `sonuswealth-ifa-auditor` before ship.

## 11. Verification (CLAUDE.md §9 / §9.5)

- Snap matrix: Bruce `?demo=a` (decumulator) · Mr T `?demo=mrt-core` (accumulator) · Willy `?demo=e` (preserver) × {375, 768, 1280} × {light, dark}.
- Per tile: surface headline ties to its selector; page opens, renders, closes; back/home work.
- Mobile: 1-col tiles, full-screen pages, no horizontal scroll.
- DOM tie-outs: headline-band funds-to-age === drawdown route depletedAtAge; tile headlines === their engine values.
- Adaptive: override chip flips headline + tiles 3/4 in both auto and pinned states.
- Zero console errors all three personas (pre-existing Fragment-className flood tracked separately).

## 12. Risks

1. Dropped props during the move (monolith hazard) — move whole blocks; tie-out gate is the net.
2. Adaptive QA doubling — check every tile in both faces.
3. Seven tiles + headline band is a lot of surface — keep tiles compact; headline must read in one glance.
4. Goal-seek tile (#6) is the least-built page — `goalSeek` exists but the ranked-lever + ripple UI is new work, not just a move.
