Title: Master Execution Sequence — Decumulation Engine + Cashflow Visuals (autonomous run)
Version: 1.0
Date: 2026-06-03
Status: ACTIVE — execution contract
Cluster: 3-Engine (decumulation) + 2-Product (Cashflow/MyMoney)
Purpose: One dependency-ordered sequence to take every open thread from the 2026-06-03 handover to DONE without round-trips. Engine (bedrock numbers) first, then the visuals that read it, then cleanup. Records founder decisions so the run is unblocked end-to-end.

---

## Why this order (the anti-rework principle)

The founder's standing frustration: identify → fix → discover-more → re-fix, round and round. Root cause = building visuals on top of an engine whose numbers aren't yet correct. The money-map, drawdown card and draw-network **all read from the decumulation engine**. Rebuilding them before the engine is right *guarantees* rework. So: **get the engine correct and tested first, then build visuals once on top of stable output.**

Founder decisions captured this session (engine spec §9 forks):
- **Data model:** Full §3 per-holding model. (Q1 → "Full §3 model now")
- **Safeguarded features (GAR/GMP/protected-TFC/structured):** Model them; DB stays a floor. (Q3 → "Model them")
- **Growth:** Parameterise — per-asset-class growth lives in the rules bundle, nothing hardcoded. (Q "Growth" → "parameters for these, nothing hardcoded")
- **Order:** Rule-currency audit first, then engine P1. (Q "Audit order" → "Audit first")
- **Standing directive (this turn):** complete all tasks in the correct sequence autonomously; deep-research → document → generate code → then amend visuals. No ping-pong.

---

## PHASE 0 — Rule-currency audit  ✅ DONE (commit f2c8222)

Cross-checked spec §7 vs `UK-2026.1.1.json` (independently HMRC re-verified 2026-06-02). Result: bundle already current on dividend +2pp, VCT 20%, BADR 18%, S455 35.75%, AIM-BPR 50%, APR/BPR cap £2.5m/£5m, LSA £268,275, state pension £12,548, pension-IHT 2027-04-06, NMPA→57. **One stale value found: FSCS £85k→£120k** (deposit protection, from 1 Dec 2025), hardcoded across app.
- Fixed: added `cashProtection` bundle block + `pension.safeguardedBenefitAdviceThreshold` (£30k, for P1); exposed via `TAX.fscsLimit` etc.; pointed `asset-taxonomy.js` M01/M02 + Cash UI at the bundle. Left SIPP investment-FSCS at £85k (deposit-only rise).
- **Audit verdict: rule-currency thread CLOSED.** No other stale 2026/27 constants in the live bundle.

## PHASE 1 — ENGINE P1: per-holding data model + evaluate/exclude pass

Additive — keeps the 67 solver tests green behind a compat shim.
1. New `src/engine/decumulation-classify.js`: DRAW-CLASSIFICATION enum + 58-row taxonomy map (§2) + `classify(holding)` derivation (§4) + `evaluateHoldings(holdings, opts)` → `{ secureIncome, excluded, specialist, reserve, sequenceable, netFloorIncome }`.
2. New `src/engine/decumulation-holdings.js`: normalise an entity's assets/income into §3 `HoldingBase`-derived records (reads existing persona shapes; degrades gracefully where rich fields absent).
3. Extend `extractDecumulationContext` **additively**: build `ctx.holdings[]`, run `evaluateHoldings`, attach `ctx.evaluation`. Keep `ctx.pots` derived from holdings as the compat shim → existing path unchanged.
4. Tests `tests/decumulation-classify.mjs`: classification-table coverage, exclusion correctness, secure-income floor, relief-lock gating, per-holding (two GIAs different gains) not averaged.
   - Verify: build green; decumulation 67/67 still green; new suite green.

## PHASE 2 — ENGINE P2: per-holding sequencing

5. Per-asset-class growth as bundle params (`growthAssumptions` block) + `TAX.growthByClass`; `simulatePath` grows each holding at its class/holding rate (not one `ctx.growth`).
6. `simulatePath`: per-line CGT (per-holding embedded gain, not one `giaGainFraction`), relief-lock exclusion, cash-role + market-state branch, bond 5%/top-slicing, protected-TFC ≠ flat 25%, model GAR-annuitised + DB net income into the floor.
7. `generateCandidatePaths`: per-holding-aware ordering (charge, embedded-gain ascending, cash role) preserving the Step-5 goal mapping.
8. Migrate persona fixtures (Bruce persona-a full §3; Mr T = stress case) + affected tests.
   - Verify: build green; migrated suites green; numbers tie out vs hand calc for Bruce + Mr T.

## PHASE 3 — ENGINE P3: network drill-down + secure node

9. `buildNetwork`: two-level (type → holding) nodes + **SECURE-INCOME node** (state+DB+annuity+rental) + excluded/flagged-but-shown nodes (relief countdown, illiquid, specialist) + per-edge `taxCost`.
   - Verify: build green; network tests green.

## PHASE 4 — VISUALS (consume the corrected engine)

> **Verification constraint (discovered this session):** the snap scripts cannot run here — the Playwright chromium download is blocked by the environment network policy, and Cashflow.jsx pulls browser-only imports so SSR smoke tests aren't feasible either. So Phase-4 items are verified by `npm run build` + runtime engine-data checks ONLY — **not** visually. Items done blind are flagged for a visual pass.

10. ✅ DONE (`e72bd28`) Drawdown-card honesty + compaction:
    - Priorities "DRAG #1" label → "#1 ranks first (reorder with ▲▼)" (matches control).
    - Routes-considered strip → compact wrapping chips; detail only for selected.
11. ◑ PARTIAL (`bcec33a`) Money-map: ✅ SECURE-INCOME floor node (mint, with streams) + ✅ calendar years beside ages + caption. STILL TODO: per-pot "why" line (needs per-edge reason data) + per-holding drill-down (needs P3 type→holding expansion). Map scales by TYPE ✅ (confirmed, 4 pot IDs).
12. ◑ PARTIAL: ✅ headline band (`1545b12`, evolved PurposeStatement → "lasts to age X", §0.5) + ✅ adaptive drawdown-tile question (`025658f`). STILL TODO (needs a VISUAL pass — block-surgery in a 4.3k-line file is reckless blind): §A "Now" → tile move + inline removal; §C "Costs" → tile move + inline removal; Methods extracted to its own tile.
13. TODO Full §9.5 snap matrix — **blocked**: needs a browser (chromium download blocked here). Run in an environment where Playwright installs.

## PHASE 5 — CLEANUP

14. Fragment-className console flood (~34/load, app-wide).
15. `l3-2-decumulation` persona-e (Willy) onTrack expectation — reconcile vs P2 funded-ratio (stale expectation, predates session).

---

## Decisions I am taking without a round-trip (founder said: complete autonomously)
- **§A granularity:** keep §A summary on the surface AND add an "Am I OK now?" tile (additive, reversible).
- **Headline band:** evolve `PurposeStatement`, do not add a second band (matches prior discovery).
- **Cash buffer default:** 2 years of `residualNeed`, editable, larger for income_floor goal (spec §9.4 midpoint).
- **Market-state branch:** deterministic illustration + user-toggle, honest-labelled (spec §9.5).
- **2027-IHT overlay:** present BOTH orders side-by-side, not an auto-flip (FCA-safe; spec §9.6 + compliance lean).
- **Illiquid/relief-locked:** excluded-and-displayed with countdown; opt-in only as a late capital-raise (spec §9.7).
Any of these is a one-line reversal if the founder disagrees on review.

## Verify discipline at every step (the directive)
Build green is necessary not sufficient. Per step: run the suite, drill ≥1 headline number to bedrock (user fact or named rule), tie out, atomic commit `[engine-Pn]/[visual] §x: …`. Surface any newly-unravelled fact as a logged line here, do not silently chase or bury it.
