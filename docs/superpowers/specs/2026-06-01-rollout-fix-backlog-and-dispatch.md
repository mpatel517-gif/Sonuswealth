# MyMoney Blueprint Rollout — Fix Backlog & Agent Dispatch

**Date:** 2026-06-01
**Status:** DOCUMENTED — actionable backlog for the "deploy Sonnet agents to fix all" pass.
**Cluster:** 2-Product / MyMoney (+ shared chrome)
**Owner:** founder + Claude (product-architect)

**Summary:** The two display bugs the founder flagged on 2026-06-01 (Add-sheet right-edge clip; inert TAX YEAR placeholder), their root causes, plus the discrete, agent-ready work-items to roll the tile blueprint across personas/tabs — with the live-server contention constraint that decides what parallelises.
**Tags:** #mymoney #rollout #dispatch #bugfix
**Updated:** 2026-06-01

Companion: [component inventory + blueprint](2026-06-01-money-surface-component-inventory.md) (the WHAT). This doc is the HOW/WHO (dispatch).

---

## 0. Fixed this turn

| # | Bug | Root cause | Fix | Verified |
|---|---|---|---|---|
| **B1** | Add-item sheet clipped on the right — "right edge cannot see the scroll bar and the edge" | `.sheet-panel` centred via `transform:translateX(-50%)`, but the entry animation `.sw-fade-in-up` (`sw-fade-up` keyframe, fill `both`) ends on `transform:translateY(0)` — clobbering the centering. Panel left edge pinned at viewport centre, extending its full 680px off the right (desktop: right edge at 1209px vs vw 1057). | `src/index.css` `.sheet-panel`: centre via `left:0; right:0; margin-inline:auto` (+ `overflow-x:hidden`). Transform now free for the keyframe. Fixes **every** `.sheet-panel` sheet, not just Add. | ✅ desktop 1057 (x189/right869, symmetric) + tablet 768 (x44/right724, symmetric), hOverflow 0, full taxonomy text + button visible |

## 1. Backlog — discrete work-items

Each item is independently shippable. `GATE` = CLAUDE.md §9.5 (snap 3 viewports × 2 themes + numeric tie-out) before complete.

### W1 — TAX YEAR / horizon select is inert (founder "placeholder… does nothing")
- **Where:** `src/screens/Dashboard.jsx:130` `GlobalTaxYearChip` (native `<select>` of `TIME_WINDOWS`) + `src/components/shared/X28TopBar.jsx` (window pill + Today/Future/Plan/What-if toggle).
- **Root cause:** `handleChange` *does* persist `window` to `sonusvealth.temporal` and dispatch `sonus:taxyear`, and the rules-version chip shifts — but **no MyMoney surface re-projects tile values off `ty.window`/`viewMode`**. So picking "Next year / 10-year / Lifetime" changes nothing the user can see → reads as a dead placeholder.
- **Also:** two temporal controls coexist (native select *and* X28TopBar) — redundant, conflicting. **CONCEPTION QUESTION for founder:** collapse to one? Recommend the X28TopBar window-pill + mode-toggle is canonical; the Dashboard native select should either drive the same store and re-project, or be removed. Do not silently delete.
- **Fix:** consume `ty.window.years` + `viewMode` in MyMoney tile computation so the headline number + TrajectoryBar `active` lens follow the selected horizon/mode (Today→now, Future→future, Plan→plan; horizon `years` feeds `projectValue` years). Wire one store, dedup the control per founder decision.
- **GATE:** switching TAX YEAR → tile headline + bar visibly move; Σ tile Futures still == NW Future at each horizon.

### W2 — Per-persona correctness (a–g)
- **Why:** founder: "you havent fixed all personas." Blueprint lives in shared CategoryTile/TileGrid so most inherits, but each persona has different data shape (DB pots, empty categories, sparse vs rich, holding-name-leak risk in the data).
- **Per persona check:** held-category filter (only what they hold; no empty Business/Alternatives tile), TrajectoryBar present where future>now with a REAL plan only where contributions exist, DB/legacy rendered as guaranteed-income+CETV not a £0 pot, **no holding names on the tile surface** ([[feedback_no_holding_names_on_tiles]]), liability tile reads (`l.rate`), numeric tie-outs hold.
- **Fix scope:** data-only gaps → patch that persona's own JSON. Shared-code regressions → report to W1 owner (do not edit shared files in parallel).

### W3 — Extend blueprint to other tabs (Home, Cashflow, Tax & Estate, Risk, Timeline)
- **NOT a blind-swarm item.** Each tab is a product-architect design pass (doctrine + visual convergence loop + per-tab spec), sequenced one at a time with founder in the loop. Spawning agents to "do all tabs" at once reproduces the stapled-half-baked failure mode. Sequence AFTER W1+W2 land. Lead tab = founder's pick.

### W4 — Per-item what-if (tier 3)
- Upgrade the `What if ⚡` entry from topic-seeded Ask to an inline mini-what-if (drag retire/contribution in place) bound to the shared scenario engine. Follows W1 (shares the temporal/scenario plumbing).

## 2. Parallelisation constraint (why the swarm is shaped this way)

The Preview MCP dev server is a **single shared browser context**. N agents driving `preview_*` simultaneously collide on persona/viewport/theme/localStorage. Therefore:

- **Live visual snaps = SERIAL** (orchestrator runs them; not parallelised across agents).
- **Parallel-safe agent work:** code reasoning, Node-engine computation (tie-outs computed by requiring the engine in node), and edits to **disjoint files**.

### Dispatch
| Agent | Task | Isolation | Touches |
|---|---|---|---|
| A-temporal | W1 wiring + control dedup | **worktree** (own build) | MyMoney.jsx, TileGrid, CategoryTile, X28TopBar, Dashboard.jsx |
| A-persona-{b,c,d,e,f,g} | W2 static+Node audit of one persona; patch only that persona JSON | none (disjoint files, no vite build) | `persona-{x}.json` only |

Orchestrator (me): final serial live-snap pass per persona on the shared server; W3 sequencing; surface W1 conception question to founder.
