Title: Cashflow Tab — Live Behavioural Audit
Version: 1.0
Date: 2026-06-05
Status: DOCUMENTED
Cluster: 2-Product / Cashflow
File name: cashflow-audit-2026-06-05.md
Purpose: Severity-ranked register of every Cashflow component tested by actually clicking through the LIVE app (Preview MCP) for Mr T (mrt-core, accumulator) and Bruce (demo=a, decumulator) at desktop + mobile. Behavioural test, not a code read.

**Summary:** The Cashflow tab is far more functional than "everything is dead" — tiles, drawers, nested drills and most sliders genuinely work and tie out. But the top page-level Sankey is NOT drillable (dead onClick + no cursor affordance), the Today/Future/Plan/What-if control is decorative (Future/Plan show "coming soon" banners; What-if is a silent no-op), and there are real broken sub-controls (tile-5 levers don't move the headline age; Bruce "Will my money last?" longevity slider is dead) plus a copy bug calling a deficit a "surplus".
**Tags:** #cashflow #audit #behavioural #mrt #bruce
**Updated:** 2026-06-05

---

## Tile inventory

### Mr T (mrt-core, accumulator) — 6 tiles, render order
1. Am I OK right now? — "In deficit" / −£944/mo · spend, buffer & income
2. Am I on track? (FI) — "27% to FI" / progress to financial independence
3. Where my income will come from — "£114k/yr" / pots projected to age 67, plus State Pension
4. What if markets fall? — "Stress-tested" / a bad run of markets early on
5. What would change it most? — "Top levers" / rank the levers by impact
6. What's it costing? — "£97k" / value at stake · charges · efficiency

### Bruce (demo=a, decumulator) — 7 tiles, render order
1. Am I OK right now? — "In deficit" / −£391/mo · spend, buffer & income
2. Will my money last? — "To age 95" / plan + 48% funded on investments
3. Where my income comes from — "£31k + £65k" / secure income + pots, tax-smart order
4. What if markets fall? — "Stress-tested" / a bad run of markets early on
5. What would change it most? — "Top levers" / rank the levers by impact
6. How fast can I spend? — "£60k–£82k/yr" / five ways to pace it — steady ↔ flexible
7. What's it costing? — "£427k" / value at stake · charges · efficiency

Persona adaptation is correct: Bruce drops the accumulator FI tile and adds two decumulation tiles ("Will my money last?", "How fast can I spend?"); tile order is sensible (status → trajectory → income → risk → levers → cost).

---

## Today / Future / Plan / What-if — per-segment verdict (BOTH personas, identical behaviour)

| Segment | Active toggles? | What changes on screen | Verdict |
|---|---|---|---|
| Today | yes | baseline; money map + 6/7 tiles | Works (it's the default view) |
| Future | yes | adds ONE banner line "● Showing today's figures — forward-modelled spend isn't on this tab yet (coming soon). See Timeline." Money map + tiles UNCHANGED | **No-op + honest placeholder** |
| Plan | yes | adds ONE banner line "● Showing today's figures — plan-vs-actual variance isn't on this tab yet (coming soon)." Money map + tiles UNCHANGED | **No-op + honest placeholder** |
| What if | yes | NOTHING. No banner, no data change. Identical to Today. | **SILENT DEAD no-op** |

Founder's claim "they do nothing" is essentially correct. Future/Plan at least self-label as coming-soon; What-if is the worst because it gives zero feedback that it's unimplemented — a user clicks it and assumes the tab is broken.

---

## Chart drillability matrix

| Chart | Location | Drillable? | Detail |
|---|---|---|---|
| Top "MONEY FLOW · THIS YEAR" Sankey | Cashflow page body | **NO** | Links (paths) carry an onClick handler but invoking it (and dispatching real click events) does nothing — no drawer, no nav, no body change. Nodes (rects) have NO handler at all. cursor:default everywhere = no affordance. 30 `<title>` hover tooltips exist. |
| Tile-1 drawer Sankey (L2 "Where your money flows") | Am I OK drawer | partial | Reached via nested drill row; renders Sankey + P&L waterfall. Not click-drillable itself. |
| Tile-2 FI projection chart | Am I on track drawer | NO | static SVG, no onClick, no pointer, no tooltips |
| Tile-3 income network diagram | Where income drawer | NO (static by design) | nodes are HTML divs, SVG only draws 4 connector paths; not clickable |
| Tile-4 crash-vs-calm chart | Markets fall drawer | NO | static SVG |
| Tile-6 "How fast" charts (Bruce) | drawer | NO | 5 SVGs render, static |

Founder's "all charts must be drillable" goal is NOT met. The headline Sankey is the most visible offender.

---

## Findings register (severity-ranked)

| ID | Persona | Viewport | Component | What I did | Expected | Actual | Severity | Evidence |
|---|---|---|---|---|---|---|---|---|
| CF-01 | Both | Desktop+Mobile | "What if" segment | Clicked What-if | Show what-if scenarios OR a coming-soon banner | Nothing changes; no banner; identical to Today. Silent dead control. | DEMO-BLOCKING | body text diff Today==What-if exactly; active class toggles but content identical |
| CF-02 | Both | Desktop+Mobile | Top MONEY FLOW Sankey | Clicked nodes + links; invoked React onClick; dispatched real click events | Drill into a flow / node breakdown (founder wants all charts drillable) | No overlay, no nav, zero body change. Link onClick is a no-op; nodes unwired; cursor:default (no affordance) | FUNCTIONAL | overlayOpened:false, bodyDelta:0 on both handler-call and event-dispatch |
| CF-03 | Mr T | Desktop | Tile 5 "What would change it most?" | Dragged all 4 levers to max | Copy promises "watch your independence age move"; headline age should update | Per-lever "X yrs sooner" figures update, but the displayed independence "age 62" NEVER changes | FUNCTIONAL | changed:true on lever figures, but age regex stays "age 62" before/after |
| CF-04 | Bruce | Desktop | Tile 2 "Will my money last?" — 4th slider (range 67–105, longevity/"live to age") | Dragged to max (105) | Should re-run longevity / shift the "lasts to age 95" answer | No content change at all — dead slider | FUNCTIONAL | sliders 0,1,2 changed:true; slider 3 changed:false even at max |
| CF-05 | Both | Desktop+Mobile | Future + Plan segments | Clicked each | Forward-modelled / plan-vs-actual data | Only a "coming soon" banner; money map + tiles do not change | FUNCTIONAL | banner text captured; money-map region byte-identical to Today |
| CF-06 | Mr T | Desktop | Tile-1 → L2 "Where your money flows" P&L waterfall | Opened nested drill | Deficit labelled as deficit | Header reads "£-11k SURPLUS" and Net surplus row "−£11k / 14% of gross" — a deficit is labelled "surplus" | FUNCTIONAL | screenshot of P&L waterfall panel |
| CF-07 | Both | Desktop+Mobile | Tile-2/3/4 charts | Probed for onClick/pointer/tooltips | Drillable per founder goal | All static; no onClick, no pointer, no `<title>` | POLISH | chartClickable:false across all |
| CF-08 | Bruce | Mobile | WEALTH badge ("BW"/score) | Loaded mobile header | Clean badge | "BW"/wealth pill visually overlaps the avatar circle top-right | POLISH | mobile screenshot |
| CF-09 | All | All | App-wide console | Watched console during walkthrough | Clean | Only "Missing Supabase environment variables" (benign for demo); no JS crashes | POLISH | preview_console_logs |

---

## What WORKS (verified, not assumed)

- **Top anchors** NW / Wealth / Risk / CoI render in a dedicated header strip below the username row, full-width, 4 columns. Values tie to persona body data exactly:
  - Mr T: NW £1.75m · Wealth 86 · Risk 79 · CoI £97k ✓
  - Bruce: NW £3.90m · Wealth 67 · Risk 71 · CoI £427k ✓
  - Anchors persist + reflow correctly at mobile for both personas.
- **All 6/7 tiles open a drawer** with rendered content (no empty/broken drawers) for both personas, desktop and mobile.
- **Sliders that work** (move the numbers live):
  - Tile-1 "Trim spending" → −£944/mo deficit flips to +£2k/mo surplus (math ties: −944 + 2899 ≈ +£2k). "Extra income" slider also present.
  - Tile-2 all 4 sliders move FI age (default age 62 → age 50 after favourable drags).
  - Tile-3 both sliders move projected income: age 67→75 = £114k→£169k/yr; growth 5%→8% = £413k/yr; State-Pension floor £13k stays fixed (correct).
  - Tile-4 crash-severity slider moves independence age 71→82.
  - Tile-5 levers move per-lever "years sooner" figures (but see CF-03 — headline age doesn't follow).
  - Bruce "Will my money last?" sliders 0–2 work (see CF-04 for the dead 4th).
- **Nested drill works**: Tile-1 → "Where your money flows" pushes an L2 panel (zIndex>500) with a full Sankey + P&L waterfall. Multi-level drill within drawers is real.
- **Numeric tie-outs that pass**:
  - Tile-6 face £97k == CoI anchor £97k (Mr T); Bruce tile-7 £427k == CoI anchor £427k.
  - Tile-3 face £114k/yr == drawer default £114k/yr; drawer monthly £9,461/mo ≈ £114k/12 (£9,500).
  - Tile-1 in £7k / out £7k consistent with −£944/mo draw.
- **Mobile (375×812)**: drawers fit viewport width exactly (375==375), sliders operable, segmented control + anchors reflow. No horizontal overflow observed.
- **Money map footer math** reads as a clean equation: £79k gross − £17k tax&NI − £11k pension − £47k essentials − £14k debt − £2k protection = −£11k net deficit (ties).

---

## Test coverage notes

- Personas: Mr T (mrt-core) + Bruce (demo=a). Viewports: desktop (1280×800) + mobile (375×812).
- Method: React props inspection for handlers, native value-setter + input/change dispatch for sliders, fixed/zIndex==500 overlay detection for drawers, body-text diffing for segment changes.
- Not exhaustively re-tested at mobile: every individual slider in every tile (spot-checked tile-1 Bruce and tile-3 Mr T on mobile — both work). Desktop slider coverage is complete per the register.
