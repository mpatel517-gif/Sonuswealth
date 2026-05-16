# Opus Plan — X28 viewMode behavior + What-if scenario library

**Status:** DRAFT · awaiting founder review
**Date:** 2026-05-13
**Triggered by:** founder feedback on Home v2.3 — *"what happens to all screens when i toggle from today to future, plan and whatif? The user needs to play with the information."*

---

## §1 · What X28 is, in one sentence

X28 is a global mode toggle that morphs every primary screen between four temporal views — **Today** (what is) · **Future** (what will be if nothing changes) · **Plan** (what should be by target date) · **What-if** (what if you change something).

The mode pill is the same widget everywhere. The mechanics are different per screen. Once locked here, every tab inherits the same vocabulary.

---

## §2 · The four modes defined

### Today
- **Shows:** current state, present-tense numbers, no projection
- **Engine:** present-day values from connected accounts + manual inputs
- **Visual register:** full saturation, weight 800, vivid colors
- **Default mode.** Every cold-start lands here.

### Future
- **Shows:** trajectory continued — *"if you do nothing, here's where things go"*
- **Engine:** project current trajectory forward (default 5y horizon, configurable per-screen)
- **Visual register:** numbers desaturated ~20%, weight drop 800→700, polygon dashed, sparklines extend dashed forward
- **Honesty:** confidence bands widen with horizon — 5y high, 10y med, 20y low
- **Key UX move:** the brief paragraph rewrites to future-tense. *"By 2031 at current trajectory, your NW projects to £4.85M but CoI compounds to £612K because no action was taken."*

### Plan
- **Shows:** target state — *"where you've committed to be by a date"*
- **Engine:** read from plan store (`planFor(entity, 'wealth')`)
- **Visual register:** target overlay (gold dashed) emphasized, current state quieter
- **Empty state:** *"No active plan — set one in Plan tab →"* — gracefully degrades
- **Key UX move:** anchor values show **target → current delta**. "Score: 68 target · 47 today · 21 below target."

### What if
- **Shows:** hypothetical scenarios — *"what changes if I do X?"*
- **Engine:** scenario input → goal-seek + cascade calculations across Score / Risk / CoI / NW
- **Visual register:** drag affordances emphasized in mint, ghost polygons on drag, **cascade narration** appears after drop
- **Two entry points:**
  1. **Direct manipulation** — drag any radar node, slider, input field
  2. **Scenario library** — picked from a side-panel catalog of common scenarios (§4)
- **Apply / Reset** controls at top of screen while in this mode

---

## §3 · Per-screen behavior matrix

| Tab | Today | Future | Plan | What if |
|---|---|---|---|---|
| **Home** | 6-card snapshot | Anchor values morph to 5y projection · polygon dashes · brief rewrites future-tense | Target ring louder · anchors show target-vs-today delta | Drag radar nodes · scenario library in right panel · cascade narration |
| **My Money** | Actual balances | Projected balances (compound + contributions) | Target balances per asset class | Change contributions/withdrawals → see Score+Risk shift |
| **Cashflow** | Actual monthly flow | Projected income/spending trajectory | Target cashflow per month/year | Change income/spending → runway shift |
| **Tax & Estate** | Current year tax position | 5y projected tax + IHT burden | Optimised structure target | "Use £20K ISA", "Start drawdown", "Gift £6K" scenario buttons |
| **Risk** | 7-dim risk radar (today) | Projected risk if no action | Target risk profile | Allocation sliders → risk dim morphs |
| **Timeline** | Events past + upcoming | Events on current trajectory | Planned milestones | Simulate event shifts ("retire 5y earlier", "sell business") |
| **Ask Sonu** | Mode-aware queries — *"in Future mode, what does my pension look like at 75?"* — context injected | | | |

---

## §4 · What-if scenario library (5 buckets, by engine complexity)

### Bucket 1 — Allocation what-ifs (EASY · in-engine today)
Pure capital reallocation. Deterministic engine. Available now in Phase 1.

- Reduce equity to 40% from 70%
- Increase pension contributions by X%
- Bed-and-ISA full commodity portfolio
- Pay off mortgage early
- Switch ISA from Cash to Stocks & Shares
- Consolidate 5 pensions into 1

### Bucket 2 — Income/spending what-ifs (MEDIUM · in-engine today)
Shift cashflow inputs. Propagates to Score + Risk + runway.

- Increase salary 10% / receive £50K bonus
- Lose income for 6 months
- Increase spending 15%
- Retire 5 years early (age 60 instead of 65)
- Take a 1-year sabbatical
- Drop to 4-day week

### Bucket 3 — Tax structure what-ifs (MEDIUM · partially in-engine)
Touches tax engine + IHT calc. Some present in current code, some need extension.

- Start pension drawdown at £25K/yr (currently £37,700 modeled)
- Use £20K ISA allowance
- Gift £6K to family (annual + carryover)
- Set up trust for life cover
- Convert dividends to salary (or vice versa)
- Stop salary sacrifice / max it out

### Bucket 4 — Life-event what-ifs (AI-powered · Phase 1 via Ask Sonu)
Household composition changes. AI handles the modeling for v1; deterministic engine comes later.

- Marriage / civil partnership
- Divorce
- Birth of child
- Partner predeceases me
- Take care of parents
- Inherit £200K
- Buy a second property

### Bucket 5 — Geographic / lifestyle what-ifs (AI-powered · Phase 1 via Ask Sonu)
**Founder overrule (2026-05-13):** geographic scenarios ship Phase 1. They are core to the product, not deferred. The architecture answer is AI, not engine extension.

- *Move to Kenya* — cost of living, UK-Kenya tax position, currency exposure, residency
- Move to Portugal (NHR scheme)
- Buy second home abroad (FX, foreign tax credits)
- Take 1-year sabbatical abroad
- Retire abroad permanently

---

## §4.5 · Engine vs AI — when each is used

The locked split:

| Property | Engine route (Bucket 1-3) | AI route (Bucket 4-5) |
|---|---|---|
| **Powered by** | `fq-calculator.js` + scenario inputs | Ask Sonu (Claude with full session context) |
| **Latency** | Instant (<200ms) | Conversational (2-5s) |
| **Precision** | Deterministic, audit-trailed | Estimate, range-bounded |
| **Labeled as** | Calculation result | *"Estimate · not advice"* with confidence |
| **Re-run** | Idempotent | Variable (Claude re-reasons each time) |
| **Editable inputs** | Sliders, drag, number fields | Natural language ("what if I move to a cheaper city?") |
| **Cascade impact** | Numbers update on Home, MyMoney, Tax, Risk | AI narrates impact + suggests follow-up scenarios |
| **Example output** | "Reducing equity 70→40%: Score 47 → 41, Risk 56 → 48" | "Moving to Nairobi: cost of living ~40% of UK. £40K/yr likely sufficient if you keep UK pension income. UK-Kenya DTA means pension taxed in UK only…" |

**Why this works:** Claude already has world knowledge on cost-of-living, tax treaties, residency rules. We don't need to build data partnerships before shipping. The "Estimate · not advice" label honors the FCA boundary. As proper data sources connect (cost-of-living API, DTA tables), AI route progressively gets replaced by engine route — same UX, deeper accuracy.

**Bucket 1-3 stays engine route.** Buying-and-selling-ISA math is deterministic. Drag a radar node → instant cascade. AI would be slower and less precise for these.

**Bucket 4-5 goes AI route.** "Move to Kenya" is a 5-paragraph conversation, not a numeric answer. AI is the right medium.

---

## §5 · Implementation phasing (rev 2 · 2026-05-13)

### Phase 1 — NOW (Home only, all 4 modes)
- **Today** mode fully wired on Home ✓ (Sonnet built v2.0; v2.4 chrome refinements queued)
- **Plan** mode wired on Home: target ring louder, anchor "target vs today" deltas, empty state copy when no plan
- **Future** mode wired on Home: 5y projection engine, polygon dashes, anchor values morph to projected, sparklines extend forward dashed
- **What-if** mode wired on Home, **both routes:**
  - **Engine route** (Bucket 1-3) — drag radar nodes, slider inputs, cascade narration component shows "Apply / Reset"
  - **AI route** (Bucket 4-5) — side-panel scenario library with both kinds of scenarios; clicking a Bucket 4-5 scenario opens an Ask Sonu conversation pre-seeded with the question. Geographic scenarios (Kenya, Portugal NHR) ship here on day 1.

### Phase 2 — Next 2-3 weeks (mode propagation to other tabs)
- Today + Plan + Future modes on My Money, Cashflow, Tax & Estate, Risk, Timeline
- What-if mode on Cashflow (sliders) and Tax & Estate (scenario buttons) — engine route only
- Engine-route What-ifs available across all tabs via global "Active scenario" badge

### Phase 3 — Quarter ahead (deepening)
- AI-route What-ifs upgraded as proper data sources connect
- Engine for marriage/divorce/death modeling (Bucket 4 graduating from AI to engine)
- Confidence-bands tighten as engine displaces AI for specific scenarios

### Phase 4 — Later (data partnerships)
- Cost-of-living API per country
- DTA tables for major UK migration destinations
- Currency exposure modeling
- Bucket 5 graduating from AI estimate to engine-calculated

---

## §6 · UI patterns reused across modes

### Mode pill (4 segmented buttons)
- Top right of masthead on **every tab**
- Active state: mint background, dark text
- Sequence locked: Today · Future · Plan · What if
- Click cycles via fade-and-replace transitions, not abrupt swap

### Projection register (Future + Plan)
- Numbers: opacity 0.55, color shifts to `--c-text-projected` (#8b9bb3 dark, #99948c light)
- Strokes: dashed `4 4` or `5 5`
- Sparklines: solid for past, dashed continuation forward
- Polygon: stroke `stroke-dasharray: 5 5`, fill alpha drop to 0.04
- Animations: 600ms easeOutExpo on mode change (already in DESIGN.md)

### Drag affordance (What-if only)
- Dashed handle ring around each draggable element appears at 70% opacity
- On `dragstart`: ghost polygon (50% opacity) follows the dragged node
- On `drop`: cascade narration component shows for 5s
- Apply / Reset buttons appear in masthead next to the active "What if" pill

### Cascade narration component
Reusable across radar, sliders, scenario buttons. Format:

> **"Reducing your Debt dimension from 71 → 50 means:**
> Wealth Score 47 → 43 · Risk 56 → 61 · CoI £340K → £385K
> Confidence: high · based on current pension allocation
> [Apply this change] [Reset]"

Single sentence. Three deltas. Confidence chip. Two buttons.

### Scenario library panel (What-if mode, side panel)
Replaces the Actions accordion when in What-if mode. Same shape, different content:

- Category headers: Allocation · Income · Tax · Life Events (· Geographic deferred)
- 3-6 scenarios per category visible
- Click → guided flow opens overlay
- Each scenario card: name + impact estimate ("+£8K NW", "Score +6") + duration ("5 min")

---

## §7 · Open questions for founder

These need answers before Phase 2 implementation begins:

1. **Default Future horizon** — 5 years? 10? Configurable per user? Default for mock: 5y.
2. **Plan empty state on screens other than Home** — same "Set one in Plan tab" or different per-screen?
3. **Apply / Reset persistence** — does Apply commit to the plan store, or just stay session-local? I'd default to session-local with explicit "Save to plan" button.
4. **Scenario library default seeding** — start with 12 scenarios (Bucket 1-3) or fewer? More risks paradox-of-choice; fewer risks feeling thin.
5. **Kenya bucket** — accept Phase 4 deferral? If you want sooner, we need to scope the partnership/data work separately.

---

## §8 · What this plan does NOT cover

- **Aesthetic / theme** — owned by Stitch, separate workstream
- **Persona switching mechanics** — orthogonal to mode switching
- **AI mode context injection** — covered briefly in §3 row 7 but full Ask Sonu architecture is its own spec
- **Notifications / alerts when projections change materially** — Phase 3+

---

**Next:** Founder reviews this plan. If approved, the Phase 1 wiring (Plan mode on all tabs + Today refinements) becomes Sonnet's next dispatch. Phase 2 gets its own dispatch with the Future-mode engines + cascade narration component.
