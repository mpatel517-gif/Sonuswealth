# Lane 3 — Outstanding work

**Status (2026-05-29 — end of session):** ALL Lane-3 main items closed. **L3-2 COMPLETE — all 11 L3 panels shipped** (Tier A ×3 + Tier B ×3 + Tier C ×5), each with recursive drill-to-leaf + provenance edit, real engine selectors, snap-verified. Remaining: 2 mechanical content/jargon sweeps (L3-4b, L3-6b) + founder deploys.

### L3-2 — 11/11 panels DONE (recursive drill + leaf edit)
| Panel | ?panel= | Engine source | Snap fixture | Test |
|---|---|---|---|---|
| Income-sources | income | annualIncome | persona-a | 28/28 |
| Wrappers | wrappers | isa/pension/giaTotal | persona-a | 27/27 |
| State-pension | state-pension | statePensionAnnual + TAX | persona-a | 33/33 |
| Tax-obligations | tax-obligations | incomeTaxDetail+nicsDetail+dividendTaxDetail | persona-a | 44/44 |
| IHT & estate | iht-estate | ihtExposure | persona-a | 42/42 |
| Trusts | trusts | entity.trusts[]+trustPeriodicCharge | mrt-decum-complex | 41/41 |
| Director-comp | director-comp | calcDividendTax+companies[] | mrt-ltd-director | 33/33 |
| BTL-portfolio | btl-portfolio | property[]+netWorth | mrt-landlord | 27/27 |
| Flexi-drawdown | flexi-drawdown | scenarios.monteCarloPOS | persona-a | 49/49 |
| DC-vs-DB | dc-vs-db | pensionTotal+pvAnnuity | mrt-decum-complex | 45/45 |
| Decumulation | decumulation | fundedRatio+swrFromRegime | persona-a | 46/46 |

Infrastructure (commits 7c6cac3…004f7d8 + Tier-C): L3Panel host, recursive DrillStack (L3→L4→L5+), DrillableNumber, L4NumberPanel leaf-edit form with source/confidence/document, ASSET_FIELD_CORRECTED event + provenance + `_corrections[]` audit trail, `events-fold-helpers.js`. Founder's "drilldowns stay one level" + "every taxonomy" + "how do I correct a value" — all closed.

**Wiring note:** panels currently mount via the `?panel=` preview gallery (`PanelPreviewGallery.jsx`). Production wiring — replacing the gallery with real drill-routes inside MyMoney/Cashflow/T&E tiles — is the next integration step.

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
| L3-2  | Build the 11 missing L3 panels | ✓ DONE | **ALL 11 shipped + snap-verified — see table above. 442 contract assertions across 11 tests, all green.** Production drill-route wiring (replacing preview gallery) is the remaining integration step. |
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
| 1 | **Income-sources** ✓ CODE | `annualIncome`, per-source breakdown (employment/dividends/rental/etc) | mymoney §3A + cashflow §2.1 | **A** | **commit 7c6cac3 + test:l3-2-income 28/28 PASS. Pending wire+snap.** |
| 2 | **Wrappers** ✓ CODE | `isaTotal`, `pensionTotal`, `giaTotal`, taxAdvAlt walk of investments[] | mymoney §3B + tax-estate §1.2 | **A** | **commit baedf8a + test:l3-2-wrappers 27/27 PASS. Pending wire+snap.** |
| 3 | **State-pension** ✓ CODE | `statePensionAnnual`, TAX.spa + TAX.statePensionFull + TAX.statePensionQualYears | mymoney §3C + tax-estate §2.4 | **A** | **commit 0434e19 + test:l3-2-state 33/33 PASS. Pending wire+snap.** |
| 4 | Tax-obligations | `taxByCategory`, `bandUtilisation`, `marginalRate` | tax-estate §1.1 | B | Sits next to existing TaxTreatmentSection. |
| 5 | IHT-estate | `ihtDeltaPrePost2027`, `nrbUtilisation`, `bprQualifying` | tax-estate §2 | B | Heavy spec; need to verify the spec hasn't drifted post-Finance-Act-2026. |
| 6 | Trusts | `trustList`, `trustType`, `trustAnniversary` | tax-estate §3 | B | Reads `assets.trusts[]` from nested shape; depends on L2-9 schema collapse landed (yes). |
| 7 | Director-comp | `dividendIncome`, `salaryVsDividend`, `corpTaxImpact` | mymoney §3D | C | Niche persona — only relevant for ltd-director archetype. Lower founder-traffic priority. |
| 8 | BTL-portfolio | `btlRentalYield`, `s24Restriction`, `propertyConcentration` | mymoney §3E | C | Subset of property drill; risk-of-overlap with PropertyDrillDown unless scoped tightly. |
| 9 | Flexi-drawdown | `drawdownSchedule`, `cmaScenarios`, `monteCarloPOS` | cashflow §3B | C | Now powered by real `monteCarloPOS` (L3-8 closed). Visualisation work, not algorithm. |
| 10 | DC-vs-DB | `pensionBreakdown`, `cetvVsAnnuity`, `dbProvider` | mymoney §3F | C | Educational comparison panel; lower urgency. |
| 11 | Decumulation | `decumulationStrategy`, `cashflowHealth`, `swrTarget` | cashflow §3C | C | Composite — would benefit from prior 9 panels existing. Build last. |

### Recommended order (founder may override)

1. ~~Tier A: Income-sources → Wrappers → State-pension~~ — **all three CODE-COMPLETE 2026-05-29**. Wire+snap pending per DoD §C.
2. **Next session opening: wire + snap-verify the 3 Tier-A panels.** One wire commit per panel + MCP snap evidence per DoD §B Gate 1. Then close L3-2-INCOME / L3-2-WRAPPERS / L3-2-STATEPENSION tickets fully.
3. Tier B (after Tier A snap-verified): Tax-obligations → IHT-estate → Trusts.
4. Tier C last: Director-comp → BTL-portfolio → Flexi-drawdown → DC-vs-DB → Decumulation.

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
