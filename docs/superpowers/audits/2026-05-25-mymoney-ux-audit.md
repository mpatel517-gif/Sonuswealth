# MyMoney — UX Audit

**Date:** 2026-05-25
**Auditor:** sonuswealth-ux-critic (running against `src/screens/MyMoney.jsx` + 5 drill panels + `TileGrid.jsx` + `CategoryTile.jsx` + `shared/TripleAnchor.jsx`)
**Scope:** Main L2 + Pension/Property/Business/Protection/Liabilities/Investments drills

---

## Priority queue — top 10 by impact-per-hour

Ranked by (user-facing impact) / (engineering hours). Numbers in brackets are subjective ICE-style — H/M/L.

| # | Issue | Where | Impact | Effort | Action |
|---|---|---|---|---|---|
| 1 | "What moved this month" waterfall lives on L2 with £1k bars dwarfed by £3.9m opening — visually unreadable and out of context | `TileGrid.jsx:448–551` | H | M | Move into the Balance Sheet hero "You own" drill (TappableNumber on `netWorth` already exists at `TileGrid.jsx:276`); render as 100%-stacked variance chart (open vs Σ deltas vs close) on relative scale, not absolute |
| 2 | Right-side trend boxes (Plan funded · 1Y · Last month · Debt ratio · Time covered · Income buffer) shoved into 180px column at `gridTemplateColumns: '1fr 1fr'` while hero takes flex:1 — boxes squeeze to 8–9px text | `TileGrid.jsx:411–434` | H | M | Promote 5 boxes to a separate row ABOVE the hero card on equal-width grid (`repeat(5,1fr)` desktop, `repeat(2,1fr)` mobile). Lift labels back to 10px, values to 14px. Free hero to use full width |
| 3 | TripleAnchor "You own" is given equal visual weight to two scores using identical Tile chrome — but founder direction (and L3 mockup) says NW is the primary anchor | `shared/TripleAnchor.jsx:48–64` | H | L | Make "You own" tile span 2/4 cols on desktop (`flex: 2` vs `flex: 1` on each score). Push hero number to clamp(36px, 5vw, 56px). Move it to top-right reading-order? — see §validation below |
| 4 | "Needs your attention" (MyMoney) duplicates "Your top priorities" (Home, HomeScreen.jsx:1483) — both surface estate, retirement, tax overlap | `MyMoney.jsx:2138–2354` vs `HomeScreen.jsx:1483` | H | L | Filter MyMoney `allTiles` to balance-sheet-domain only: debt + tax-shelter usage + (optional) safety cover. Move estate + retirement to Home where they belong with APQ |
| 5 | InvestmentsDrillDown is a flat 6-section text dump — no visual hierarchy, no chart-led summary, all tiles identical | `InvestmentsDrillDown.jsx` (whole file) | H | M | Lead with a single composition donut (ISA/GIA/EIS/Bonds/Other) + one number (total invested with %change). Push tile-grid sections below the fold. ISA bar (line 181) is the only existing visual — promote it; demote everything else |
| 6 | "Cost of doing nothing" L2 card shows 4 ranked rows but they collapse pension granularity (per-scheme), wrapper detail, and have no L3 drill | `MyMoney.jsx:2858–2928` | M | M | Add a chevron + L3 panel: per-domain CoI rows expand into per-wrapper / per-scheme breakdown using existing engine (`totalCoI.byDomain`). Show 'second screen' the founder wants |
| 7 | CategoryTile minHeight:200 + ~9 tiles in single column (line 554 `gridTemplateColumns:'1fr'`) = 1800px+ scroll wall | `TileGrid.jsx:553–581` + `CategoryTile.jsx:130` | M | L | Use `repeat(auto-fit, minmax(280px, 1fr))` for ≥768px. At mobile keep 1-col but shrink minHeight to 160 by removing the 12px footer-only padding and merging "View detail" into the icon affordance |
| 8 | "How your money is held" wrapper bar has no L3 drill — segments filter the grid below but don't open a wrapper-anatomy panel | `MyMoney.jsx:2812–2835` + `WrapperCompositionBar:781` | M | M | Add 'View wrapper detail →' button next to "Add wrapper details" → opens overlay showing wrapper tax treatment (TaxTreatmentBlock already exists), per-wrapper rows, allowance utilisation, transfer history. Do NOT merge with Cashflow |
| 9 | Mortgage rate display inconsistency: TileGrid liabilities `"Mortgage 4.5%"` vs LiabilitiesDrillDown `"APR 4.50%"` vs PriorityCards "Debt burden Clears in N yr" — three different vocabularies for one debt | `MyMoney.jsx:3082–3100` · `LiabilitiesDrillDown.jsx:202` · `MyMoney.jsx:2199` | M | L | Canonical phrasing: `"4.5% APR · clears in 23 yr"` everywhere. Add `formatMortgage()` helper in `engine/_helpers.js` |
| 10 | Drill panel pattern divergence: PensionDrillDown numbers headings 1–6 ("1 · Your pensions and who they pay out to"); Investments/Property/Business/Protection/Liabilities use "1 · [topic]" + UPPERCASE section; ProtectionDrillDown has 6 sections but skips most for personas without policies → blank panel risk | All 6 drill files | M | L | Standardise: every drill = `[OverlayShell] → [hero card: one number + one chart] → [sections: numbered + plain-English headings + tiles] → [DrillContextStub] → [Not captured yet]`. Already 80% there — close the gap |

---

## Validation / push-back on founder's 8 concerns

### #1 — "You own £3.90m more prominent + top-right"
**Partial agree.** More prominent: yes, the three tiles ARE flex:1 (TripleAnchor.jsx:42–47) so visually equal, which is wrong for an L2 where the anchor question is "what's my net worth?" not "what's my score?" Push back on top-right: in mobile-first reading order (375px column), top-right means the eye lands on it last, not first. Better fix is **top-left, double-width**, with the two score tiles stacked to its right at 1/4 width each. On desktop that becomes a 2:1:1 grid. The L3 mockup top-right pattern is for L3 where you already know your NW and want to compare projections — not L2 entry.

### #2 — "Sub-tiles look horrible — cramped, unequal, want above the line + equal"
**Agree, with sharper diagnosis.** The boxes are not "unequal sized" — they're forced to equal cells by `gridTemplateColumns: '1fr 1fr'` + `gridAutoRows` via `gridTemplateRows: 'repeat(rows, 1fr)'` (TileGrid.jsx:413–415). The horror is that 5–6 boxes get jammed into a **180px-wide column** (line 419 `width: 180`) next to a flex:1 hero. That gives each box ~85px width × ~40px height. At that size, the 8–9px labels (lines 37–46) become unreadable.

**Fix:** delete the inline `width:180` constraint, lift the 5 boxes into their own row above the hero card on `gridTemplateColumns: 'repeat(5, 1fr)'` desktop / `repeat(2, 1fr)` mobile. Labels go back to 10–11px. Hero takes full row beneath.

### #3 — "What moved this month — wrong scale + wrong placement"
**Agree on both.** Bar width is computed as `(value / maxVal) * 100` with `maxVal = max(|isBase ? value : value| + (isBase ? 0 : prev))` (TileGrid.jsx:505). That makes Opening (£3.9m) the maxVal, so a £1k investment delta gets 1k/3.9m = 0.026% of bar width = literally invisible.

**Fix:** waterfall should be a separate scale — drop the Opening/Closing bars from the comparison and render only the delta bars on their own max. Add a header line "Opening £3.9m → Closing £3.92m (+£20k · +0.5%)" outside the bar chart. **Placement:** yes, move into the NW drill (TappableNumber wraps NW at TileGrid.jsx:276). Drill modal shows: monthly waterfall + 12-month line chart + per-month attribution table.

### #4 — "Every number/chart should be tappable per PP-3"
**Mostly there, with gaps.** I grepped for `TappableNumber` usage in TileGrid — hero NW (line 276), Assets (379), Liabilities (401), and the 5–6 trend boxes (via TrendBox `question` prop, line 421) all wrap correctly. Liquidity split values (Liquid £X / Pension £Y / Illiquid £Z / Alt £A on lines 313–334) **are not tappable** — they're inline `<span>`s. The liquidity bar segments themselves (340–344) aren't tappable either. The sparkline (line 291) renders raw SVG with no tap target.

**Fix:** wrap the 4 liquidity totals in `<TappableNumber>` with questions like "What if I shifted more into liquid?" Make the liquidity bar a `<button>` that opens a liquidity ladder drill. Wrap the sparkline `<svg>` in a button → opens NW trajectory drill.

In `CategoryTile.jsx`, the hero subtotal (line 226 `{fmt(...)}`) is **not** wrapped in TappableNumber — only `costOfInaction` (295) is. The whole tile is clickable (line 133), but PP-3 says the *number itself* should drill, and "Why is this number what it is?" is the canonical question. **Fix:** wrap subtotal in TappableNumber with question "What makes up my [category] number?"

In PensionDrillDown, the four `MetricTile` summary tiles (lines 1937, 1957, 2067) are **not** tappable. These are exactly the kind of numbers a power-user wants to interrogate ("how is reduced cap £10k computed?"). **Fix:** convert MetricTile to use TappableNumber by default.

### #5 — "Wrapper composition needs drill, don't combine with cashflow"
**Agree, push back on combine.** Cashflow is a flow view (income → spend → save → invest). Wrappers are a stock view (where money sits + tax treatment). Combining them collapses two different mental models that the user already separates. Add the L3 drill on the wrapper bar — see issue #8 in the queue.

### #6 — "Needs Your Attention duplicated on Home"
**Confirmed.** Home renders "Your top priorities" via the APQ engine (HomeScreen.jsx:1483 + the priority screen at 1493). MyMoney's PriorityCards (MyMoney.jsx:2138) computes 5 metrics — Emergency cover, Debt burden, Retirement funded, Estate efficiency, Tax shelter usage — and filters to non-good. **Three of those (Retirement, Estate, Tax shelter) are domain-spanning topics that Home's APQ already surfaces as actions**. Emergency cover and Debt burden are the only two that are pure balance-sheet domain.

**Fix:** MyMoney version filters `allTiles` to `id IN ('safety', 'debt', 'tax')` — drop Retirement (lives on Home + has its own pension drill below in MyMoney) and Estate (lives on Tax & Estate). Renames to "Balance-sheet attention" to differentiate.

### #7 — "Savings & investments drill not well designed"
**Agree — see diagnosis paragraph below.**

### #8 — "CoI list lacks pension/wrapper detail; second screen needs reorganisation"
**Confirmed and there is no second screen yet.** Looking at MyMoney.jsx:2858–2928, the CoI card maps each of 9 domains to a single string from `coiForDomain(entity, id)`, shows top 4 ranked, and the row click navigates into the relevant L3 drill — but the L3 drills (PensionDrillDown, InvestmentsDrillDown, etc.) **do not have a CoI section themselves**. So the user clicks "Pensions £X/yr" → lands on pension overview → loses the CoI context entirely.

**Fix:** every L3 drill needs a top-card "Cost of not acting" section that surfaces per-asset / per-scheme CoI breakdown. The engine has `coi.byDomain` already (line 2864), but doesn't expose per-scheme yet — work item: engine adds `coi.byPension[]` / `coi.byInvestment[]` / `coi.byPolicy[]`.

---

## Per-component critiques

---

### MyMoney L2 (main view) — `src/screens/MyMoney.jsx:2479–3502`

**What I'd change (in priority order):**

1. **Net-position banner (lines 2693–2755) competes with TripleAnchor below it.** Both surface the same urgent signal in different vocabulary. The banner has good copy but it pushes the anchor below the fold on mobile. — Merge: put the net-position sentence INSIDE the You own tile as a sub-line. — Effort: medium.

2. **Vertical density.** Reading order from top: X28TopBar → Header strip → Plan staleness banner → Screen-purpose eyebrow → Net-position banner → TripleAnchor → Delta chip → VarianceBadge → How your money is held → CliffEdgeWarning → PriorityCards → SurplusTile → CoI list → DecumulationPanel → SectionDelimiter → PivotToggle → Tile grid (9 tiles). That's **17 distinct vertical blocks before the user sees a single category tile**. On 375px viewport, that's ~3000px scroll to first useful content. — Cull or collapse: PlanStalenessBanner (already conditional), VarianceBadge (only renders in non-actual mode — fine), DecumulationPanel (gate behind investable > £100k). Move SurplusTile into the Net-position banner. — Effort: medium.

3. **SectionDelimiter "Your financial picture · Balance sheet" (line 2934) is redundant** — the screen is called "What do I own, what do I owe, and what comes in?" (line 2675). The user already knows it's a balance sheet. — Delete. — Effort: trivial.

4. **PivotToggle (line 2941)** — Balance Sheet / Income / Insurance / Bonds. Insurance and Bonds as top-level pivots is wrong information architecture. Insurance is a category (already a tile). Bonds is a wrapper (already a "How your money is held" segment). — Reduce pivots to: Balance Sheet · Income · By Wrapper. — Effort: low.

5. **Director intelligence section (lines 3267–3352)** — well-designed cards with real CTAs (post-2026-05 fix). But it surfaces for non-directors too if `hasPersonaFlag(entity, 'director')` is wrongly set. Worth a quick visual: 4 stacked cards × ~140px = 560px of director-only content for a user who happens to have a side LLC. — Add user toggle "Hide director tools" when only 1–2 items show. — Effort: low.

**What's working well:**
- The CoI list (2858–2928) is the strongest pattern on the screen: ranked by money, top-4 only, "Total est. £X/yr" badge, row-tap routes to the right drill. This is the model the rest of MyMoney should follow.
- Net-position bridge clause ("but markets and contributions added £5k so net worth still rose") — actually nuanced copywriting that respects users with deficit + growing NW.

**One thing that would double perceived quality:**
**Halve the vertical blocks to 8 max.** Strict rule: anchor + 1 attention card + 1 CoI card + balance sheet hero + wrapper bar + tile grid + 1 tax card + disclaimer. Everything else is collapsed by default or gated behind viewMode/persona.

---

### Balance Sheet hero (TrendBoxes + hero number) — `TileGrid.jsx:246–436`

**What I'd change (in priority order):**

1. **Trend boxes get 180px of width split 2-col for 5–6 boxes.** Result: 85×40px boxes with 8px labels. Founder's "horrible" is the right word. — Promote boxes above the hero on dedicated `repeat(auto-fit, minmax(120px, 1fr))` row. — Effort: medium.
2. **Liquidity split (lines 303–347)** is genuinely good information but visually too small. The 8px swatch + 9px label "Liquid" + 10px number is below the readable floor on mobile. — Use 11px label, 14px number, 12px swatch. — Effort: trivial.
3. **The 12-month sparkline** (line 291) at 110×22px has no value labels, no hover. It's decorative. — Either drop it from the hero (waterfall + tile sparklines already convey trend) or give it value labels at endpoints. — Effort: low.
4. **Hero card itself uses radial mint gradient + box-shadow glow** — fine for L2 hero but every CategoryTile below has its own gradient + glow too. Visual noise compounds. — Demote tile glows to flat surfaces; reserve glow for the L2 hero only. — Effort: low.

**What's working well:** The Assets / Liabilities pair below the hero number, with MoM trend arrows in the eyebrow, is the cleanest unit on the screen.

**One thing that would double perceived quality:** Move the 5 trend boxes ABOVE the hero, full-width grid. Hero card then has room to breathe.

---

### CategoryTile — `src/components/MyMoney/CategoryTile.jsx`

**What I'd change (in priority order):**

1. **Subtotal hero number (line 226) is not TappableNumber** — entire tile is click-to-drill but PP-3 says the number itself should answer "why is this number what it is?" — Wrap in TappableNumber with the canonical "what makes up X?" question. — Effort: trivial.
2. **`minHeight: 200` (line 130) × 9 tiles × 1-col mobile = 1800px** scroll wall. — Drop to 160; remove the dedicated footer (View detail + Add buttons) and use icon-click + long-press for Add. Or: at ≥600px viewport switch to 2-col with `repeat(auto-fit, minmax(280px, 1fr))`. — Effort: low.
3. **The icon (line 138) is a button AND the whole tile clicks** — same action. Founder principle macOS: simple surface → tap anywhere. — Remove icon button wrapper; keep icon as decoration. Single tap target = whole tile. — Effort: trivial.
4. **"View detail →" + "+ Add" footer** (lines 340–367) adds 50px of vertical chrome to every tile. — Move + Add to a tile-level long-press OR a single floating + (already exists via UniversalAddButton). — Effort: low.
5. **Sparkline at 64×22px** in the top-right (line 159) is decorative. The "+0.5%" change pill says the same thing in less space. — Pick one. Sparkline wins on signal-per-pixel; drop the change pill OR drop the sparkline. — Effort: trivial.

**What's working well:** Wrapper composition mini-bar (lines 234–272) is the best in-class explainer of "where this category's money sits by wrapper" — top-3 + Other, color-coded, lay-readable labels.

**One thing that would double perceived quality:** Make each tile **half as tall** by removing the dedicated footer and the inline + Add.

---

### TripleAnchor — `src/components/shared/TripleAnchor.jsx`

**What I'd change (in priority order):**

1. **Three tiles all `flex: 1`** (line 178) — visually treats "You own £3.90m" with the same weight as "Wealth Score 71/100". The anchor is NW; scores are secondary indicators. — Change to 2:1:1 weighting (`flex: 2` on Net Worth tile, `flex: 1` on score tiles). On <600px, make NW full-width row 1, scores split row 2. — Effort: trivial.
2. **ArcGauge** (lines 86–168) has 70 lines of half-finished comments doing arc math by hand. The needle dot doesn't add information that the colored arc fill doesn't already convey. — Replace with a SemiCircleProgress + score label centered. Drop the needle dot. — Effort: low.
3. **HeroNumber `--fs-hero`** — on 375px viewport, "£3.90m" with hero fontSize fits, but "£3,902,471" (full precision on hover) wouldn't. — Set TappableNumber `display` to show both: header shows "£3.90m", tap reveals "£3,902,471 · made up of [X]". — Effort: low.
4. **Score band labels** ("Optimised", "Protected") are tiny chips below the gauge — and the rkBandObj remap at MyMoney.jsx:2521 explicitly aligns vocabulary across both scores. Good. But the comparison "is 71 Optimised better or worse than 78 Protected?" is still unclear at a glance. — Add a tiny `78 > 71` indicator OR show both scores on a shared 0–100 ruler. — Effort: medium.

**What's working well:** The `rkBandObj` vocabulary unification (MyMoney.jsx:2514–2521) is a thoughtful fix to a real comparison problem.

**One thing that would double perceived quality:** 2:1:1 weighting + larger NW number.

---

### PensionDrillDown — `MyMoney.jsx:1749–2099`

**What I'd change (in priority order):**

1. **6 numbered sections, no chart-led summary card up top.** Spec-by-spec wall of text. — Add a hero card: "Pension pot £X · drawing £Y/yr · projected to last until age Z · IHT saving £A". One sentence, one chart (the balance trajectory at line 2046 already exists — promote it). — Effort: medium.
2. **MetricTile components (lines 1937, 1957, 2067)** are not TappableNumber. Numbers like "Reduced cap £10,000" need "why £10k?" drill. — Wrap. — Effort: trivial.
3. **Drawdown schedule editor (line 1987)** is a 5-row inline list with raw `<input type=number>`. No slider, no preset comparison side-by-side. The 4 preset chips (1974) and the inline rows live in different chunks. — Either: (a) presets render comparable cards "Take nothing vs Basic-rate vs Safe vs Smooth" with stat preview, then user picks one; OR (b) the schedule editor goes in a modal triggered from a preset choice. — Effort: rewrite.
4. **Inheritance tax saved tile** (line 2070) shows "—" when delta is 0 or negative. That's the user's most-asked question. — Always show; if negative, show "+£X tax instead" with bad tone. — Effort: trivial.
5. **Schedule commit button** (line 2080) is "Commit DRAWDOWN_SCHEDULE_SET" — engineering vocabulary at the user surface. Macos principle violation. — Change to "Save this plan". — Effort: trivial.

**What's working well:** The Term + ExplainerChip pattern (lines 1879–1882) in the intro text — chips inline with key words — is the right way to teach financial vocabulary without a glossary detour.

**One thing that would double perceived quality:** Add a chart-led hero card at the top showing pension trajectory under the current schedule.

---

### InvestmentsDrillDown — `src/components/MyMoney/InvestmentsDrillDown.jsx`

**What I'd change (in priority order):**

1. **The whole panel is a stack of Section blocks with `auto-fit minmax(120px, 1fr)` tile grids.** 6 sections, all visually identical, no narrative arc. The user lands on this after tapping "Savings & Investments" expecting to see WHERE their investments are — they get a wall of tax-treatment tiles. — Lead with a single composition donut/treemap: ISA 55% / GIA 30% / EIS 8% / Bonds 7% / Other. Total in middle. Tax-treatment tiles drop to section 4. — Effort: medium.
2. **Section 1 'wrapper composition' (line 151)** uses 5 tiles in a 5-col grid. At 375px viewport, that's 60px wide tiles — barely fit the value. — At ≤600px, fold into a stacked list with progress bars. — Effort: low.
3. **Section 6 'All holdings' (line 297)** is buried at the bottom — but for users with 3+ investments this IS the primary content. — Move to top, below the donut. — Effort: low.
4. **Bond 5% allowance bar (line 265)** is good visual but only renders if `bondItems.length > 0`. Most personas don't have bonds. For them, Sections 4 + 5 disappear entirely — making the panel feel sparse. — Add empty-state knowledge cards for missing sections ("You don't have any EIS/SEIS/VCT — these higher-risk schemes give 30–50% income tax relief"). — Effort: low.
5. **"All holdings" rows** use ` › ` chevron + dot but no value-as-button — line 303 has the whole row as `<button>`. Good. But the row content (name, provider, wrapper) is tiny 13/10px — at 375px viewport reads as a label list, not a tappable detail list. — Lift to 14/11px and add a small wrapper-color stripe on the left edge of each row. — Effort: trivial.

**What's working well:** ISA bar (line 181) is the single useful visual on the panel — promote it as a hero stat.

**One thing that would double perceived quality:** Lead with a composition donut + total + 12-month change. Everything else is detail behind that.

---

### PropertyDrillDown — `src/components/MyMoney/PropertyDrillDown.jsx`

**What I'd change (in priority order):**

1. **Same flat-Section pattern as Investments.** Compositon row (line 113) is 4 tiles. — Lead with a hero: "[Total property value] across [N homes + N BTL] · [Total equity] · [Total annual rent]". Chart: equity vs debt stacked bar per property. — Effort: medium.
2. **PropertyMapStub (line 234)** — the DrillContextStub knowledge-hall pattern is the best part of this panel and the founder's "drill panels are knowledge halls" memory says this should be richer. — Promote map preview to a real lazy-loaded tile (LeafletJS at <50kb gz). — Effort: rewrite. Defer.
3. **'Not captured yet' (line 246)** shows 10 dashed pill chips for unrecorded property types. Visually it's the loudest section because of the chip count. — Hide behind an `<details>` "+ Add another type". — Effort: trivial.
4. **BTL section tile grid (line 202)** with 6 tiles per BTL — at 375px viewport each tile is 60–70px wide, value gets truncated. — At ≤600px, switch to 2-col grid for sub-tiles. — Effort: trivial.
5. **Chip overload on each BTL** (line 195) — 5 chips: S24 / No PPR / No BPR / 60-day CGT / +5% SDLT. All NEGATIVE chips. Cognitive load = high, but actionability = zero (they're just facts). — Collapse into a single chip "5 tax considerations →" that opens a drawer. — Effort: low.

**What's working well:** PPR/RNRB explainer chips inline with the section subtitle copy (line 144) — same Term pattern as Pension drill.

**One thing that would double perceived quality:** A composition chart at the top (residence £X equity vs BTL £Y equity) so the user sees the structural picture before the tax detail.

---

### BusinessDrillDown — `src/components/MyMoney/BusinessDrillDown.jsx`

**What I'd change (in priority order):**

1. **Section 2 BPR position visualisation (line 142)** — single-bar with green-orange split for £1m cap utilisation. Good. But that's the strongest insight on the panel and it's buried in section 2. — Promote to a hero card with one number: "[£X of £1m BPR cap used · £Y excess at 50% relief]". — Effort: low.
2. **Per-company chip stack (line 183)** — Trading / BPR eligible / BADR 5%+ / Corp tax 19/25%. The "Corp tax 19/25%" chip is informational noise — every UK Ltd has this. — Drop the corp tax chip; it's the floor, not a signal. — Effort: trivial.
3. **Share schemes section (line 212)** treats EMI / CSOP / SAYE / SIP / unapproved with case-specific tax copy in `tax` variable (217) — but renders as plain text below the title. For a director who has EMI options, this is THE content. — Make it a 3-row layout: scheme name + value + tax-treatment chip group. — Effort: low.
4. **DLA section (line 262)** mixes asset-credit and liability-debit in one component. For credit (asset) it shows green + "In credit"; for debit it shows red + S455 + BIK chips. The mental model swap mid-component is confusing. — Split into two row types with different layouts. — Effort: low.

**What's working well:** The 2026 BPR change (£1m cap + 50% above) gets visible UI treatment — section 2 title literally says "(April 2026)". This is the kind of rules-awareness Sonuswealth needs everywhere.

**One thing that would double perceived quality:** Promote the BPR utilisation bar to the hero card position.

---

### ProtectionDrillDown — `src/components/MyMoney/ProtectionDrillDown.jsx`

**What I'd change (in priority order):**

1. **Coverage 4-pillar tile (line 149) buries the binary insight.** "2/4 pillars · 1 of 2 in trust" should be the headline. — Lead with a 4-quadrant grid (Life · CI · IP · PMI) where filled quadrants are green and empty ones are red with "Add cover →". — Effort: medium.
2. **PolicyRow (line 75)** — when a policy doesn't exist it renders "No cover in place" with a small "Gap" chip and a — value. Visually identical to existing policies just with — values. — Empty policies should render very differently: dashed border, "Add this cover" CTA, estimated premium range. — Effort: low.
3. **Months of cover stat (line 153)** depends on `entity.expenses.essential_monthly` fallback to 2500. For a £1m NW user with £8k/mo essentials, this default produces a wrong "6.2 months covered" when the truth is 1.9 months. — Either hide the tile when essentials data is missing OR show explicit "(estimate based on £2.5k essentials — set your real number)". — Effort: trivial.
4. **'Not captured yet' (line 291)** lists 14 cover types — visually as noisy as the actual covers above. — Hide behind disclosure. — Effort: trivial.

**What's working well:** The PolicyRow uses Chip patterns consistently (Active / In trust / Gap) — the only drill panel that has a consistent row vocabulary.

**One thing that would double perceived quality:** A 4-quadrant pillars grid as the hero. Filled = green policy summary, empty = "add cover" with estimated cost.

---

### LiabilitiesDrillDown — `src/components/MyMoney/LiabilitiesDrillDown.jsx`

**What I'd change (in priority order):**

1. **LTV section (line 150) only renders when there's a residence.** For renters with personal loans only, the panel jumps from composition (section 1) straight to per-loan (section 3). — Always render section 2 with appropriate empty state ("No residence captured — LTV not applicable"). — Effort: trivial.
2. **Per-loan chip stack (line 204)** — for a BTL: category + rateType + "Remortgage soon" + "Estate-deductible" + S24 chip with separate ExplainerChip wrapper. 5+ visual elements per loan row. — Promote rate-type fix expiry to a sub-line (consistent with mortgage display elsewhere); reduce chips to 2 max per row. — Effort: low.
3. **Total debt tile (line 142) uses `tone="bad"`** — coral coloring on the topline number. But debt isn't inherently bad — a £500k mortgage on a £2m house is healthy. — Use neutral tone for total; reserve coral for stretched LTV or high-cost APR. — Effort: trivial.
4. **APR formatting** uses `pct(rate)` which gives "4.50%" but main MyMoney uses `"4.5%"` (single decimal). — Standardise on one decimal place. — Effort: trivial.

**What's working well:** Per-loan section title "Each debt in detail" with sub-copy explaining fix expiry as a remortgage trigger — exactly the kind of plain-English actionable framing the rest of the app needs.

**One thing that would double perceived quality:** Add a Schedule of payments chart (12-month forward view of monthly debt cost). The data is there (`monthly_payment` per loan); this would convert a static list into a forward-looking signal.

---

## Cross-panel pattern observations

**The underlying problem: no two drill panels share a layout.** They share the OverlayShell wrapper, fmt helper, and Tile + Chip + Section atoms (copy-pasted into each file, not imported from a shared component) — but the composition of those atoms differs every time:

| Panel | Lead element | Sections | Has chart? | Has knowledge stub? |
|---|---|---|---|---|
| Pensions | Tax-treatment block | 6 numbered text-heavy | Yes (balance trajectory) | Yes (DrillContextStub) |
| Investments | Wrapper composition tiles (5) | 6 numbered + tax block | No (only ISA bar) | Yes (SectorMixStub) |
| Property | Composition tiles (4) | 4 numbered | No | Yes (PropertyMapStub) |
| Business | Composition tiles | 6 numbered | Single BPR bar | Yes (BusinessActivityStub) |
| Protection | Coverage tiles (4) | 6 numbered | No | Yes (ClaimsPaidStub) |
| Liabilities | Composition tiles (4) | 4 numbered | LTV bar | **No** ← only panel without |

**Concrete inconsistencies:**

1. **Section title format varies.** PensionDrill: "1 · Your pensions and who they pay out to" (full plain English). Investments: "1 · Where your investments sit by tax wrapper" (plain English). Business: "1 · Composition" (engineering label). Liabilities: "1 · What you owe" (plain English). Property is mixed. — Standardise to plain English questions: "What you own" / "Where it sits" / "What it costs you" / "How much tax it triggers".

2. **Tile/Chip/Section/fmt are duplicated 5×** across the 5 component drill files (PropertyDrillDown.jsx:29–84, BusinessDrillDown.jsx:30–85, ProtectionDrillDown.jsx:18–73, LiabilitiesDrillDown.jsx:27–87, InvestmentsDrillDown.jsx:25–101). Each copy has slight variations in spacing/coloring. — Lift to `src/components/MyMoney/drillKit.jsx` with `<DrillSection>` / `<DrillTile>` / `<DrillChip>` / `formatMoney()`. Saves ~280 LoC and locks visual consistency.

3. **No drill has a CoI section** even though founder principle says CoI should live everywhere money decisions live. — Add `<CostOfWaiting domain={id}/>` sub-component pulling from `coiForDomain(entity, id)`; render as standard 4th section in every drill.

4. **DrillContextStub knowledge halls (Property=Map, Business=Activity, Investments=SectorMix, Protection=ClaimsPaid)** are well-designed but inconsistent in placement — sometimes second-to-last, sometimes after composition. — Always place immediately after the hero card, before the detail sections.

5. **`OverlayShell subtitle` formatting differs.** Pensions: `${fmt(sippTot)} across ${pensionCount} pensions`. Investments: `${fmt(total)} · ${items.length} holdings`. Property: `${fmt(totalPropertyValue)} GMV · ${fmt(totalPropertyEquity)} equity`. Business: `${fmt(total)} · ${companies.length} co · ${shareSchemes.length} scheme`. Liabilities: `${fmt(totalDebt)} total · ${allLoans.length} loans`. Protection: `${coreCount}/4 core · ${fmt(totalLifeCover)} life cover`. — Standardise on `{primary stat} · {secondary detail}` pattern.

6. **'Not captured yet' chip clouds** appear in 4 of 6 drills (Property, Business, Protection, Liabilities). They're the visually loudest sections because of the dashed-border chip count. — Either: (a) collapse behind disclosure consistently across all 4; (b) drop the section entirely and surface a single "+ Add another type" CTA next to the section header.

---

## Diagnosis paragraph — InvestmentsDrillDown

**Founder is right: the page isn't well designed.** The structural problem is that it's **organised by tax-rule rather than by asset story**. The user arrives wanting to know "what do I have, what's it worth, and what's it doing" — instead they get a Tax 101 dump: section 1 (wrapper composition tiles), section 1b (tax treatment per wrapper), section 2 (ISA allowance), section 3 (CGT on GIA), section 4 (EIS/SEIS/VCT clawback), section 5 (bond 5% withdrawal), section 6 (the actual holdings, buried). The 5-tile wrapper composition row at the top (`InvestmentsDrillDown.jsx:152`) tries to be a hero but at 5-col on narrow viewports each tile is 60px wide with truncated values. Sections 4 and 5 only render conditionally (most personas don't have EIS or bonds), creating "this panel feels empty" risk. The DrillContextStub for sector mix (line 282) is the most interesting piece on the panel — promised look-through sector exposure, currency split, factor tilts, top-10 concentration — but it's a stub, second-to-last in reading order. **The fix: invert the panel.** Lead with one composition chart (donut or treemap, ~120px tall) showing wrapper split with total + 12-month % change in the middle. Section 2 = holdings list (currently section 6). Section 3 = sector mix knowledge hall (currently the stub — needs to become real). Section 4 = tax treatment per wrapper (current sections 1b–5 collapsed into a 'tax detail' accordion). The current six-section text-tile pattern works in spec form because the spec is organised by tax rule; it fails in UI because the user's mental model is organised by money.

---

**End of audit.**
