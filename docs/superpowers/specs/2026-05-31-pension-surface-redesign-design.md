# Pension Surface Redesign — "Have → Understand → Decide" Pattern

**Status:** DOCUMENTED
**Date:** 2026-05-31
**Cluster:** 2-Product / MyMoney + Home
**Supersedes ad-hoc pension drill in:** `src/screens/MyMoney.jsx` (inline PensionDrillDown), `src/screens/HomeScreen.jsx` (pension CategoryTile)

**Summary:** Redesign the pension surface (Home tile → drill → leaf) so aggregates reveal their composition and the drill reaches a per-pension leaf plus a withdrawal-strategy "Decide" layer that does not currently exist. This is the **exemplar**: the pattern generalises to property, investments, cash, business.
**Tags:** #mymoney #home #pensions #decumulation #exemplar-pattern
**Updated:** 2026-05-31

---

## 1. Problem

Two professional audits (IFA + UX) plus founder critique converge on one root cause, restated independently here:

**The pension surface is a display, not a decision.** A pension at retirement age exists to answer one question — *"how do I turn this into income without wrecking it on tax or leaving it exposed?"* — and the screen answers it with a Monte-Carlo probability ("100%"). The decision layer is entirely absent.

Concrete defects:

1. **Aggregate hides composition.** Home tile shows "£850k" as an atom. It is 3 pensions of different *types* (2 SIPP, 1 legacy DC). The data to show this already exists (`pensionPots`); the tile chooses to flatten it.
2. **Non-communicative chart.** The blue `TrajectoryBar` on the tile has no legend/scale — reads as cosmetic. Founder wants **3 trend-lines, one per pot**.
3. **Unlabelled metrics.** "Pension 100%" (naked Monte-Carlo POS) and "+0.2%" (no period/basis) carry no meaning. 100% in isolation reads as "do nothing" — it should prompt "you may be able to spend more."
4. **Redundant tagging, no grouping.** Three rows all tagged "Pension." The badge should carry *type*; rows should group by type (self-invested vs workplace/legacy).
5. **Drill stops too shallow.** Per-pension rows are dead-ends (name + nomination only). No per-pot drill, no per-pot performance, no per-pot role.
6. **Second drill uncategorised.** Tax treatment / charges / LSA / IHT-2027 are scattered as co-equal cards, roughly reverse of the canonical §4.5 order.
7. **No withdrawal strategy.** The legacy DC scheme (possible guarantees / protected TFC / safeguarded benefits) is not ring-fenced; tax-free-cash sequencing absent; the April-2027 IHT flip (pensions enter estate) is shown as a countdown but never connected to *what to do*.

## 2. The pattern: Have → Understand → Decide

Four layers, each answering exactly one question. Designed to generalise to every asset category.

| Layer | Question | Pensions instance | Generalises to |
|---|---|---|---|
| **L1 — Tile (Home)** | "What have I got?" | `£850k · 3 pensions · 1 needs review` + 3 micro trend-lines | every CategoryTile: aggregate + component count + "N need review" + per-component micro-trend |
| **L2 — Summary drill** | "What's the shape + what do I do?" | 3 pots grouped by type + **"Turn this into income →"** + ordered §4.5 analysis spine | components grouped by meaningful sub-type + one primary action + ordered analysis |
| **L3 — Per-item leaf** | "How's this one, and its role?" | per-pot value, projected trend, £/yr drag, TFC share, nomination + 2027 effect, sequence role, verify-flags | per-component detail + its role in the category's key decision |
| **L3 — Decide view** | "How do I act, and why?" | withdrawal strategy: guided plan + interactive sequencer | the category's key decision (property: sell/remortgage; investments: rebalance/wrapper; cash: deploy/EF) |

**Abstraction to reuse for propagation:** a category surface is `{ aggregate, components[], analysisSections[], decision }`. Pensions defines the reference; other categories supply their own `components`, `analysisSections`, and `decision`.

## 3. Layer detail

### L1 — Home pension tile
- Hero stays `£850k`. Add truthful subline: **"across 3 pensions · 1 needs review."** ("N needs review" = count of pots with stale nomination > 2y OR unverified legacy guarantees.)
- Replace the single `TrajectoryBar` with **3 micro trend-lines, one per pot**, projected forward via `projection.js`/CMA. Labelled **"projected"** — NOT "past performance" (no return history exists; see §5).
- "+0.2%" → either "+0.2% projected this year" (with basis) or removed. No bare deltas.
- Tap target → L2 summary drill. Whole tile tappable; min 44×44.

### L2 — Pension summary drill
- Header: total + one-line role ("your retirement income engine").
- **Grouped by type:**
  - *Self-invested (you control)* → Vanguard SIPP £420k, Hargreaves SIPP £280k
  - *Workplace / legacy (verify first)* → Wayne Enterprises DC £150k
- Per row: name, value, mini-trend, **charge as £/yr drag** (e.g. "0.45% ≈ £1,890/yr"), nomination chip (green up-to-date / amber stale + day-count), one-line sequence hint, chevron → leaf. **No "Pension" badge** — badge slot carries type (SIPP / Legacy DC).
- **Primary CTA: "Turn this into income →"** → Decide view. Visually dominant.
- Below CTA: §4.5 analysis as an **ordered spine** (collapsible sections, in this order, not co-equal scattered cards):
  1. **Holdings** (the grouped list above is section 1)
  2. **Contributions** — AA £60k headroom, MPAA caveat if flexible income taken, carry-forward as *actionable to capture* (not blank)
  3. **Tax-free cash** — LSA £268,275 / LSDBA £1,073,100 usage, ~£212k available, phased-vs-full note
  4. **Estate (2027)** — pensions-enter-estate countdown + effect, routes to Ask
  5. **Charges** — per-pot drag rolled up
  6. **Data completeness** — what's missing, link to capture

### L3 — Per-pension leaf
Reuse `AssetDetailOverlay`. Per pot, add:
- Value + **projected** trend (this pot, via CMA growth for its asset class)
- Type + **what it means for you** (SIPP = you control drawdown; Legacy DC = verify guarantees before acting)
- Charge → **£/yr drag**
- This pot's **tax-free-cash share**
- Nomination status + **2027 effect on this specific pot**
- **Role in the sequence** ("draw third, because outside-estate until 2027…")
- **Verify-flags** (legacy: protected TFC? safeguarded > £30k? protected retirement age?)
- Keep update-value (commits `ASSET_FIELD_CORRECTED`).

### L3 — Decide view (withdrawal strategy) — guided + interactive
**Guided (engine-generated, per persona):** ordered plan with reasons:
1. *Verify the legacy Wayne DC* — may hold protected TFC / safeguarded benefits; could be worth more left alone.
2. *Take phased tax-free cash* — preserves death-benefit flexibility vs full crystallisation.
3. *Flex the two SIPPs* — your adjustable income engine.
4. *Time it against 6 April 2027* — outside-estate logic flips; draw/gift decisions change.

**Interactive (sequencer):** user sets a target income and reorders the pots; reuses `monteCarloPOS` + decumulation engine to show live **tax / estate / longevity** per ordering. Always rendered *below* the guided plan so guidance frames it.

**FCA frame on the surface:** "Information and guidance only. Not personal advice. Verify decisions with an FCA-authorised adviser before acting." No advice verbs ("you should buy/sell").

## 4. Components

| File | New/Modify | Responsibility |
|---|---|---|
| `src/engine/decumulation-plan.js` | **New** | Pure fn: `(pots[], { age, iht2027Date }) → { sequence:[{potId, order, reason}], flags[] }`. Guided-plan generator. Node-testable. |
| `src/components/MyMoney/L3/PensionSummaryDrill.jsx` | **New** | L2: grouped-by-type list + "Turn this into income" CTA + ordered §4.5 spine. |
| `src/components/MyMoney/L3/PensionLeaf.jsx` | **New** (or extend `AssetDetailOverlay`) | L3 per-pot leaf with trend, drag, TFC share, 2027 effect, sequence role, verify-flags. |
| `src/components/MyMoney/L3/DecumulationStrategy.jsx` | **New** | L3 Decide view: guided plan (from `decumulation-plan.js`) + interactive sequencer (wraps existing `DecumulationPanel`/`FlexiDrawdownPanel`/`monteCarloPOS`). |
| `src/components/Home/PensionTile*` (HomeScreen.jsx tile render) | **Modify** | L1: subline "N pensions · M need review", 3 micro trend-lines, labelled delta. |
| `src/screens/MyMoney.jsx` (inline PensionDrillDown) | **Modify/replace** | Route the existing drill into `PensionSummaryDrill`; remove scattered-card ordering. |
| `src/components/MyMoney/L3/MiniTrendLines.jsx` | **New** | Pure presentational: N projected trend-lines from `projectValue` series. Reusable across categories. |

## 5. Data reality (honest constraints)

- `pensionPots` carries `name / value / provider / type / charge / nominationDate` (HomeScreen.jsx ~1689/1703). **No return time-series.**
- "How each performs" = **forward projection** (CMA growth per asset class) + charge drag, labelled "projected." We will NOT fabricate historical returns. Real history is a separate data-capture workstream.
- Figures verified against in-repo source (`TAX` from `fq-calculator.js` / rules-uk): LSA £268,275, LSDBA £1,073,100, AA £60k, MPAA £10k, pensions-enter-estate 6 Apr 2027. Always read from `TAX`, never hardcode.

## 6. Reuse map
- **Data:** `pensionPots`.
- **Projection:** `src/engine/projection.js` + `src/engine/cma.js` (`getActiveCMA`).
- **Leaf:** `AssetDetailOverlay`, `L3PanelHost`, `DrillStack`.
- **Sequencer engine:** `monteCarloPOS` (scenarios.js), `DecumulationPanel`, `FlexiDrawdownPanel`.
- **Events:** `ASSET_FIELD_CORRECTED`, `SCENARIO_SAVED` (save a chosen sequence as a Plan fork — ties into #18 temporal track).

## 7. Acceptance criteria

Functional:
- [ ] Home pension tile shows component count + "N need review" + 3 projected trend-lines; no bare unlabelled delta.
- [ ] L2 drill groups pots by type; no "Pension" badge; each row drills to a leaf; charge shown as £/yr.
- [ ] "Turn this into income →" CTA opens the Decide view.
- [ ] §4.5 analysis renders in canonical order (Holdings→Contributions→TFC→Estate→Charges→Data).
- [ ] Per-pension leaf shows trend, drag, TFC share, 2027 effect, sequence role, verify-flags; update-value works.
- [ ] Decide view shows guided plan (≥4 ordered steps with reasons) AND interactive sequencer with live tax/estate/longevity.
- [ ] Monte-Carlo POS is labelled with its question and clamped [0,100]; 100% surfaces "may be underspending" hint.
- [ ] FCA frame present on Decide view; no advice verbs anywhere.

Tests (Node):
- [ ] `tests/decumulation-plan.mjs` — sequence ordering + flags (legacy ring-fenced first; 2027 timing step present; MPAA flag when flexible income taken).

§9.5 snap gates (MANDATORY before "complete"):
- [ ] MCP screenshots: Home tile, L2 drill, L3 leaf, Decide view × {mobile 375, tablet 768, desktop 1280} × {light, dark}.
- [ ] Numeric tie-outs: sum of 3 pot values = £850k tile total; sum of per-pot TFC shares = total TFC available; sequencer terminal income reconciles to engine.
- [ ] `.snap-verdict-pension-redesign.md` written with per-criterion yes/no.

## 8. Out of scope (this spec)
- Real historical per-pension returns (data-capture workstream).
- Propagating the pattern to property/investments/cash — **follows after founder approves the pension exemplar** (mechanical application of §2 abstraction).
- Tax-document upload module (#17) and full temporal Now/Future/Plan wiring (#18) — resume after exemplar lands.

## 9. Generalisation note (for the propagation pass)
When applying to another category, supply only:
- `components[]` (the sub-items + their grouping sub-type)
- `analysisSections[]` (category-appropriate ordered spine)
- `decision` (the category's key action view — property: sell/remortgage/BTL-yield; investments: rebalance/wrapper-efficiency; cash: deploy/emergency-fund adequacy)
The L1/L2/L3 shells (`MiniTrendLines`, grouped summary drill, leaf, Decide host) are reused unchanged.
