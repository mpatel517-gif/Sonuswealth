---
Title: HANDOVER — Cashflow redesign + decumulation engine redesign
Version: 1.0
Date: 2026-06-03
Status: ACTIVE — read first next session
Cluster: 2-Product/Cashflow + 3-Engine/decumulation
Purpose: Lossless handover. Captures the operating directive, everything shipped this session, the spec that gates the next work, and the FULL register of unravelled-but-open threads so nothing is dropped.
---

**Summary:** A long Cashflow session that started as UI polish and unravelled into a fundamental decumulation-engine correctness gap; the engine redesign is researched + specced (awaiting founder decisions) and must be done before more drawdown-UI work.
**Tags:** #cashflow #decumulation #engine #handover #calc-audit
**Updated:** 2026-06-03

---

## 0. OPERATING DIRECTIVE (founder, end of session) — read this first

**"Leave no stone unturned."** This session repeatedly showed that one detailed step unravels another hidden fact *even though everything had been checked beforehand*. The cascade: truncated drawdown table → hid that GIA/ISA/Cash are ever used → revealed a ~£47k/yr **secure-income floor** the map omitted → revealed Bruce has **multiple pensions** rolled into one box → revealed the **solver aggregates** them and ignores per-scheme costs/guarantees → revealed **stale 2026/27 tax figures** app-wide.

The productive form of the directive:
- **Exhaustive verification** — never trust a green `build`/passing tests. Check the LIVE path (preview_eval/screenshot), drill every number to bedrock (user fact or named rule), tie out every figure. Every confident summary is a signal verification is missing.
- **Explicit scoping** — when a step unravels a new fact, SURFACE it as a logged decision; don't silently chase it (that's how scope goes infinite) and don't silently bury it (that's how this session's bugs survived prior "checks").

This pairs with the standing memory directives: `feedback_verify_live_path_not_just_component`, `project_independent_calc_audit_required`, `feedback_surface_methodology_to_user`, `feedback_done_means_domain_complete_not_just_built`.

---

## 1. SHIPPED + PUSHED THIS SESSION (all on main, build-green)

| Commit | What |
|---|---|
| `c397601` | Back-solve hero — drag the income, plan/tax/runway/map all re-solve live |
| `bec6494` | Money-map shows per-pot £/yr + start age; follows the SELECTED route |
| `409b23f` | Runway headline ("lasts to age X") + Assumptions/methodology panel (`solve.methodology`: assumptions + 6 named rules w/ plain-English+source+status) + path-vs-amount caption |
| `c029858` | Cashflow question-tiles **design spec** |
| `0c23525` | Cashflow question-tiles **10-task build plan** |
| `521e7a8` | **§B trajectory scroll → 4 question-tiles** (lastability / drawdown / resilience / whatif), each a full-screen page wrapping existing components |
| `38c2cd0` | Fix: tile-page overlay couldn't scroll (DrillStackProvider nesting was inverted vs §A pattern) |
| `3f76aa9` | Drawdown table → transition years + **Secure** income column (resolves "why are ISA/GIA/cash always £0") |
| `d5466dd` | **Decumulation engine redesign: research (4 files) + consolidated SPEC** |

Verified live (Bruce desktop+mobile, node suites green: decumulation 67/67, withdrawal-methods 19/19). **NOT yet done:** full §9.5 snap matrix (3 personas × 3 viewports × 2 themes) on the new tiles.

---

## 2. THE GATE — decumulation engine redesign (do this BEFORE more drawdown UI)

**Spec:** `0-Active/route-specs/2026-06-03-decumulation-engine-redesign-SPEC.md` (backed by `decumulation-research/{1-retirement-income,2-investment-wrappers,3-property-business-alt,4a-cash-secure,4b-sequencing-doctrine}.md`).

**The problem (founder, correct):** `decumulation-solver.js` aggregates all assets into 4 buckets (`ctx.pots` = pension/isa/gia/cash) and sequences by tax alone. It ignores, per holding: charges/OCF, **GARs** (~40% of fund → annuitise-don't-draw), **DB/state/annuity = income floor not a pot** (root bug), **protected TFC >25%**, exit penalties, small-pot rules, crystallisation, with-profits, **per-holding GIA embedded gain/CGT**, **EIS/SEIS/VCT relief-locks**, BPR business (don't-sell-early), illiquid alternatives (last-resort). The network diagram is downstream — fixing it without the engine is lipstick.

**The redesign:** per-holding **evaluate-then-sequence** — 58-row draw-classification taxonomy → exclude guaranteed-income/GAR/relief-locked/not-income → cover essentials from secure income → cash buffer for sequence risk → goal-weighted order → fill tax bands per year → 2027-IHT overlay. Per-asset-class growth (founder chose **"B"**) lives at holding level.

**BEFORE coding, founder must settle §9 Open Decisions:**
- How granular must the persona data model get (per-holding arrays w/ attributes vs partial)?
- Flag-and-exclude vs attempt-to-model GAR/DB/safeguarded?
- Per-asset-class growth defaults (equity ~5–7%, cash ~1–2%, bonds ~3%) — confirm the numbers.

**Phasing (in spec):** P1 data model + eval/exclusion pass (behind a shim keeping the 67 solver tests green) → P2 per-holding sequencing → P3 network drill-down + secure-income node. **Top risks:** `extractDecumulationContext` collapse-to-4-pots is load-bearing; persona fixtures must become per-holding (Mr T = stress case); `simulatePath` single growth + single giaGainFraction → per-holding.

---

## 3. OPEN-THREAD REGISTER (every unravelled fact — nothing dropped)

### Engine / calc-audit (highest stakes)
- [ ] **Decumulation redesign** — §2 above. Gated on founder §9 decisions.
- [ ] **Rule-currency verification (app-wide, NOT just decumulation).** Research flagged stale 2026/27 figures — verify each vs `rules-uk.js` / the `TAX` bundle (`fq-calculator.js`), status-field discipline, BEFORE any use: FSCS £85k→**£120k** (1 Dec 2025); dividend tax **+2pp** (basic 10.75%); VCT relief 30%→**20%**; AIM-BPR 100%→**50%** but BPR/APR cap £1m→**£2.5m**; **BADR 18%**; **S455 35.75%**. All marked verify-before-use in the spec. This is `project_independent_calc_audit_required` territory.
- [ ] **`asset-taxonomy.js` M01/M02 prose** still says FSCS £85k (display-only but stale).
- [ ] **Growth model "B"** (per-asset-class) — approved; folds into the engine redesign. Today the solver applies a flat 5% to ALL pots (incl cash — wrong) and overrides per-fund rates (e.g. FTSE Global 6.8% → 5%).

### Cashflow question-tiles (whole-tab redesign — plan `0c23525`, §B done)
- [ ] **§A "Now" → tile** + **§C "Costs" → tile** (Tasks 3/7 — mechanical moves of existing cards into pages).
- [ ] **Headline-answer band** (Task 9) — **discovery: evolve the existing `PurposeStatement`** (already a 10-second answer banner at ~L1207), do NOT add a duplicate band. *Founder to confirm.*
- [ ] **Methods as its own tile** (Task 5) — founder explicitly wants the 5 withdrawal methods as a dedicated drawer; currently nested inside the drawdown page.
- [ ] **Adaptive face** (Task 9 Step 3) — accumulator swaps (drawdown tile → "Am I on track? (FI)"; methods hidden). Confirm Mr T (accumulator) never sees priorities/drawdown.
- [ ] **Full §9.5 snap matrix** (Task 10) — Bruce/Mr T/Willy × {375,768,1280} × {light,dark} on the new tiles. Not yet run.
- [ ] **§A granularity fork** (founder, unanswered): collapse §A into one "Am I OK now?" tile, or keep partly on surface?

### Drawdown-card detail (founder review points, this session)
- [ ] **Priorities "drag" label LIES** — says "DRAG #1 TO THE TOP" but it's ▲▼ buttons. Either wire real drag-and-drop or fix the label. (Honesty fix.)
- [ ] **Routes-considered strip too bulky** — compact to small selectable chips ("#1 Pension-first · to 94"), detail only for selected. Keep the interactivity.
- [ ] **Money-map needs:** calendar **years** beside ages; a **"why" line per pot** (the rule that put it there); a **SECURE-INCOME node** (state pension + DB + annuity) feeding income (currently omitted — implies all income from pots, false); **per-holding drill-down** (tap pot → its schemes/funds). Most of this folds into engine P3.
- [ ] **Map scales by TYPE** (4 boxes) not per-holding, so it won't explode for complex personas — confirm this holds after the per-holding redesign.

### Pre-existing (not from this session)
- [ ] **Fragment-className console flood** (~34/load, app-wide) — already spawned as a separate task.
- [ ] **`l3-2-decumulation` persona-e (Willy) onTrack=true** test fails — predates this session (stale funded-ratio expectation).

---

## 4. KEY FILES
- `src/screens/Cashflow.jsx` (~4250 lines, single inline house file — do NOT split). New: `QuestionTile`, `CashflowTrajectoryTiles` (~L1912), `AssumptionsPanel`, `DrawNetworkDiagram` (~L3066), `ScenarioForwardSummary` (~L3134, the drawdown plan).
- `src/engine/decumulation-solver.js` (the redesign target — `extractDecumulationContext`, `generateCandidatePaths`, `simulatePath`, `buildNetwork`, `solveDecumulation`).
- `src/engine/asset-taxonomy.js` (115 types, 7 cats — the classification keys).
- `src/engine/fq-calculator.js` (`TAX` bundle), `src/rules-uk.js` (rule SoT for the currency audit).
- `src/rules/personas/persona-a.json` (Bruce — `sipp.pensions[]` + `funds[]`, `income.statePension` £11,973@67).
- Plan: `0-Active/route-specs/2026-06-03-cashflow-question-tiles-plan.md`. Spec: `...-design.md`. Engine spec + research: `...redesign-SPEC.md` + `decumulation-research/`.

## 5. ENV / OPS REMINDERS
- CWD resets to vault root each turn → prefix `cd /c/Users/Powernet/Desktop/finio &&`.
- Build: `npm run build` (necessary not sufficient). Tests: `node tests/<file>.mjs` (no `npm test` script). Dev server / Preview MCP for live verify.
- Direct commit+push to main is authorised. Never put secrets in chat. Founder-only: edge-function redeploys, key rotation (Morph/Exa).
- Node scripts: import personas as `from './src/rules/personas/persona-a.json' with { type: 'json' }`; goalSpec is `import { goalSpec as buildGoalSpec }`.

## 6. SUGGESTED FIRST ACTIONS NEXT SESSION
1. Read this file + the engine SPEC §9 Open Decisions; get founder's answers on the 3 forks.
2. Decide order: founder gated the engine redesign ahead of more drawdown UI. The §A/§C tile migration (Tasks 3/7) is independent of the engine and could proceed in parallel if desired.
3. Before ANY tax figure is touched: run the rule-currency verification (§3) — it affects live numbers app-wide.
4. Carry the operating directive (§0): verify the live path, drill to bedrock, surface every unravelled fact as a logged decision.
