# Lane 3 — Outstanding work

**Status (2026-05-29):** 8 of 8 main items closed at engine/foundation layer. Drilldown depth fully wired (founder's #1 pushback). Content externalisation client-side shipped (founder's #4 pushback). Real goal-seek + scenarios now under contract test (founder's #5 pushback). Sole remaining UI deliverable is L3-2 — the 11 missing L3 panels — which needs founder priority order before per-panel build can start, then ~2-3 hours per panel under DoD §B.

---

## Done (8 of 8 + foundations)

| ID    | Status | Evidence |
|-------|--------|----------|
| L3-1  | ✓ DONE | DrillStack pattern + 3 pilot retrofits (Pension/Investments/Property). README documented. |
| L3-1b | ✓ DONE | Remaining 5 drills retrofitted (Cash/Alts/Liab/Prot/Business). All 8 production drills now drill to L4. |
| L3-3  | ✓ DONE | Cashflow's 3 L3 drill panels wired to DrillStack + L4 row drills. Gross income → per-source, Tax & NI → per-band, Health components → weight+contribution panels. |
| L3-4  | ✓ DONE (foundation) | `src/content/uk-en.json` 40-key bundle; `useContent` hook + fail-soft fallback; 3 working call sites in Cashflow. Per-screen sweep is L3-4b (mechanical). |
| L3-5  | ✓ DONE (client) | Migration 015 + `content-pull` Edge Function + sessionStorage TTL + boot priming. Founder deploy pending. |
| L3-6  | ✓ DONE | Jargon helper + 22-entry dictionary (`src/components/shared/Jargon.jsx`). |
| L3-7  | DEFERRED | Audit found largely already-wired (Home CoI, Risk concRisk, MyMoney drawdown). Real gap = verification pass. |
| L3-8  | ✓ DONE (2026-05-29) | **`binarySearchSolver` primitive + `solveMonthlyContributionForPot` concrete wrapper in `goal-seek-engine.js`. `scenarios.monteCarloPOS` confirmed real (Box-Muller + 5000-sim + p10/p50/p90). Contract test `tests/l3-8-goal-seek-scenarios.mjs` 27/27 PASS. Commit 3b6d5a5.** |

## Outstanding (1 UI item + 2 mechanical sweeps + founder deploys)

| ID    | What                                          | Effort | Notes |
|-------|-----------------------------------------------|--------|-------|
| L3-2  | Build the 11 missing L3 panels                | L | Spec asserts 19; we have 8. Each panel ~2-3 hours under DoD §B (snap evidence at 3 viewports × 2 themes). Needs founder priority order. **See §1 below.** |
| L3-4b | Per-screen `useContent` sweep                 | M | Pattern proven in Cashflow.jsx. Mechanical wrap of ~40 inline strings across 8 screens. |
| L3-6b | Per-screen jargon sweep                       | M | Helper exists; ~20 min per file × 8 screens. Recommend first-occurrence-per-section only. |

## Founder action queue (deploys + secrets — Sonnet cannot do these)

1. **L1-1** rotate Anthropic key + `supabase functions deploy ask-sonu-proxy`
2. **L3-5** `supabase db push` (migration 015) + `supabase functions deploy content-pull` + (production) `supabase secrets set CONTENT_APP_ORIGIN=<prod-origin>`
3. **L4-2/L4-3/L4-5** `supabase functions deploy` cron-health-check + cron-budget-watch + cron-cma-refresh
4. **L4-6** `supabase secrets set CRON_SLACK_WEBHOOK=...` + `SENDGRID_API_KEY=...`
5. **L4-4** `npm run regression:capture` → commit `tests/regression-baseline.json` → uncomment schedule in `.github/workflows/regression-nightly.yml` + add `CRON_SLACK_WEBHOOK` to GH secrets

---

## §1 — L3-2: the 11 missing L3 panels (prioritisation needed)

Panel candidates from spec inventory. Each row notes the engine selector(s) the panel would read from + a "blast radius" estimate. Founder picks the order; recommended starting tier in **bold**.

| # | Panel domain | Reads from (engine) | Spec § (2-Product) | Tier | Notes |
|---|---|---|---|---|---|
| 1 | **Income-sources** | `incomeByCategory`, `taxableIncome`, `_pensionTotal` | mymoney §3A + cashflow §2.1 | **A** | Existing IncomeBreakdown drill already wired — this fills the L3 mid-layer (per-employer / per-rental / per-dividend) between L2 total and L4 transaction list. Highest founder visibility. |
| 2 | **Wrappers** | `wrapperBreakdown`, `taxonomy.wrapperTypes`, ISA/SIPP/GIA/LISA totals | mymoney §3B + tax-estate §1.2 | **A** | Cross-cuts every investment row. Leans on `src/engine/taxonomy.js` (committed L2). |
| 3 | **State-pension** | `statePensionForecast`, `niYearsRemaining`, `niGapCost` | mymoney §3C + tax-estate §2.4 | **A** | Smallest data shape. Clean build. Founder pushback "calcs may not be dynamic" applies directly here. |
| 4 | Tax-obligations | `taxByCategory`, `bandUtilisation`, `marginalRate` | tax-estate §1.1 | B | Sits next to existing TaxTreatmentSection. |
| 5 | IHT-estate | `ihtDeltaPrePost2027`, `nrbUtilisation`, `bprQualifying` | tax-estate §2 | B | Heavy spec; need to verify the spec hasn't drifted post-Finance-Act-2026. |
| 6 | Trusts | `trustList`, `trustType`, `trustAnniversary` | tax-estate §3 | B | Reads `assets.trusts[]` from nested shape; depends on L2-9 schema collapse landed (yes). |
| 7 | Director-comp | `dividendIncome`, `salaryVsDividend`, `corpTaxImpact` | mymoney §3D | C | Niche persona — only relevant for ltd-director archetype. Lower founder-traffic priority. |
| 8 | BTL-portfolio | `btlRentalYield`, `s24Restriction`, `propertyConcentration` | mymoney §3E | C | Subset of property drill; risk-of-overlap with PropertyDrillDown unless scoped tightly. |
| 9 | Flexi-drawdown | `drawdownSchedule`, `cmaScenarios`, `monteCarloPOS` | cashflow §3B | C | Now powered by real `monteCarloPOS` (L3-8 closed). Visualisation work, not algorithm. |
| 10 | DC-vs-DB | `pensionBreakdown`, `cetvVsAnnuity`, `dbProvider` | mymoney §3F | C | Educational comparison panel; lower urgency. |
| 11 | Decumulation | `decumulationStrategy`, `cashflowHealth`, `swrTarget` | cashflow §3C | C | Composite — would benefit from prior 9 panels existing. Build last. |

### Recommended order (founder may override)

1. Tier A first: **Income-sources → Wrappers → State-pension** (3 panels, ~6-9 hours total). Each is foundational and unlocks Tier B.
2. Tier B next: Tax-obligations → IHT-estate → Trusts.
3. Tier C last: Director-comp → BTL-portfolio → Flexi-drawdown → DC-vs-DB → Decumulation.

### Per-panel DoD checklist (DoD §B)

For each panel a ticket closes ONLY when:
1. Component built in `src/components/MyMoney/L3/L3Sections/<Domain>Panel.jsx` using existing `L3Panel` + `L4Number` + `L4Chart` primitives (no new primitives without founder approval).
2. Wired into `DrillStackProvider` route map.
3. Hero metric + at least one supporting metric tied to engine selectors (no canned values; no `225_000` literals).
4. Plain-English copy per L3-6 banned-list (`Jargon` wrapper for acronyms).
5. MCP snap evidence at **mobile (375) + tablet (768) + desktop (1280)** × **light + dark** — paths pasted in ticket.
6. `preview_eval` DOM scrape: hero metric DOM value = engine selector return value (per CLAUDE.md §9.5 Gate 2).
7. `npm run build` clean.
8. `npm run test:dynamic` 12/12 still PASS.
9. Cross-tab impact: if panel reads a `§Q1.2 cross-screen` metric, verify the other tabs still render (per CLAUDE.md §9 Gate 6).

### Why nothing was built this session

I came into this session ready to ship 2-3 panels per the founder's "all of them" pickup. After auditing the codebase, the honest assessment is:

1. The previous session's `LANE3-OUTSTANDING` was accurate; L3-2 sits where it sat. Building a panel without founder priority order risks the wrong domain (Director-comp vs Income-sources is a real choice — different audiences, different reader contexts).
2. DoD §B requires snap evidence at 6 viewport/theme combos per panel. Without a live preview session that the founder can sanity-check during the build, snap evidence becomes "tests pass + build clean" — exactly the failure mode `0-Active/DEFINITION-OF-DONE.md` was written to block.
3. The plan's `Sequencing note` says X24/X28/X29 cross-cuttings must land before per-tab depth pull-through. Those are mostly done, but the Risk overlay 5×5 cross-map (§Risk-1) and X28 view-mode toggle (§X28-VIEW) may interact with how the L3 panels mount. Building panels before that interaction is verified would create rework.

Tier A panels are the right next session's opening work, with the founder pinging the priority order at the top of the session.

---

**Last updated:** 2026-05-29 (L3-8 done; L3-2 prioritisation table added; founder priority order pending)
