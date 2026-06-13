Title: Master Item Tracker — every item raised, one place
Version: 1.0
Date: 2026-06-13
Status: OPEN
Cluster: All
File name: 0-Active/MASTER-ITEM-TRACKER.md
Purpose: The single consolidated list of every item the founder raised across this
chat and prior ones, with honest status. Supersedes scattered tracking (task list,
memory, review-issues/*). Update as items close.

**Summary:** one tracker covering the original 13-item UX list, the import/validation
work, the "themes not yet fixed" set, and older registers needing re-verification.
**Tags:** #all-clusters #tracking
**Updated:** 2026-06-13

Status key: ✅ done+verified · 🔄 partial · ☐ open · ↗ engine/data-layer · ⟳ needs re-verify vs current build

---

## AUTONOMOUS RUN LOG (2026-06-13) — completed, committed, pushed

| Item | Outcome |
|------|---------|
| #50 (P1) | Pension AA silent-£0 honesty added on MyMoney (T&E already had it). Verified: mrT contributions=0 → provisional fires. |
| #49 (P1) | `classifyAsset` separator-normalised → fixed real wrong-account bugs (`premium bonds→EMI`, `cash isa→NULL`). Write-path classifier audit clean (only strict-gated importer touches free text). |
| F5 | Cashflow tiles verified live: render + tie-out (−£900=Home) + no console errors + no mobile overflow. Full dark pixel-matrix blocked by screenshot wedge. |
| #44 | Confirmed satisfied — every primary surface drawered (Settings=Sections, Cashflow=tiles, MyMoney=DomainCards, Risk=views, T&E/SA/Timeline=drawers). |
| #53 Theme F | All 11 side-stripe borders → full borders (grep-clean). Typography half RECLASSIFIED: 268 sub-11px (not ~29), mostly intentional chart micro-labels → needs per-surface design pass, not a blanket bump. |
| #52 (P1) | Life-event log completed 10→16 subtypes on Home (logging+fold+dim-reopen already worked; added the 6 incl. bereavement). Verified live: 16 chips render. |

| #51 Z1.5 | Home Capital Efficiency sub-anchor strip BUILT (reuses canonical prcPccSpread). Verified live: mrT "7.9× Strong". |
| #51 Z5 | Score Journey chart BUILT — NW+Wealth+Risk shared-axis, COEXISTS with radar (founder decision). Caught+fixed a silent-drift bug: trajectory readers preferred stale stored seeds (mrT chart showed £484k vs £1.75m canonical) → now anchor endpoint to live canonical (NW rescale, score shift) + null guards. Verified: chart shows £1.75m, golden vectors 9/9. |

### Continuation run (2026-06-13, session 2 — parallel Risk session active, Risk files OFF-LIMITS)

| Item | Outcome | Commit |
|------|---------|--------|
| #49 classifier | Bare generic asset words ('isa'/'pension'/'bond'/'share'/'loan'/'account'/'investment') → null not a specific holding (was: 'share'→ISA_SS wrapper, 'loan'→DLA asset). `_BY_ID` id shortcut for write path. | `40c153f` |
| #49 parsed VTM | Null-wrapper parsed £ amount classifies its label vs canonical taxonomy (exact-match) before silent-cash; rejects fuzzy ('pe' in 'pension'). Spreadsheet already full-VTM; manual=picker(safe). | `34237bc` |
| #49 liability audit | Clean — only the importer WRITES via classify, and it's `{strict}`. All other callers classify held debts for display. | (audit) |
| F3 pension AA | Ask Sonu tax-year-state + decision-engine composer routed through canonical `pensionContributionsThisYear`; mrT-couple £0→£19.8k used. `usedProvisional` honest-absence flag threaded into LLM summary + AA chip. | `cd56941` |
| Home dead code | Removed orphaned DeficitBanner/DeficitBannerView/SippIhtCountdown (~190 lines, superseded by HomeAlertsPanel). | (pushed) |
| D-register verify | 3 items confirmed already-RESOLVED (punt copy, monthly-flow mismatch, see rows in §D); drill-label = founder brand-decision. |  |
| Theme B/C drills | Wired all non-Risk driver-tree stub-hitters: `netWorth:<category>`, `will`, `gaps` (honest target-shortfall via canonical `gapDims`). Retirement/IHT confirmed covered natively. | `e7e1ee1`/`1ec8db0`/`c158b9b` |

**Deferred this run (blocked, not skipped):** Theme A targetIncome (4 sites in risk-engine.js = Risk-locked, 6 in fq-calculator.js = blast-radius + parallel tie-outs, no golden-vector coverage yet); F5 live-snap (drives shared preview browser → would disrupt founder's Risk session).

**Remaining — all genuinely founder-decision or focused-engine-session work (NOT skippable-by-rushing):**
- **#51 Z5 Score Journey** — ⚠️ DECISION: spec makes it the canonical PRIMARY Home chart *replacing the radar*, but founder previously rejected hiding the radar (memory `feedback_session_2026_05_13_mistakes`). Radar-vs-ScoreJourney is a founder call, not a blind build. Engine fns exist (trajectoryData/scoreTrajectory/riskTrajectory).
- **#51 Z13/Z12 (AI narrative/synthesis)** — real build, LLM via ask-sonu-proxy (key-gated). **Z14 Drive-to-Update** — needs new `updateStreakCheck` + realistic asset captured_at dates (fixtures lack them). **Z15 Milestone pin** — needs new `milestoneCheck` + baseline-crossing detection. **Z6** — founder-gated (O-HOME-1 thresholds).
- **Theme A targetIncome default (30000 vs 50000)** — engine projection math; golden-vectors PASS but do NOT cover the targetIncome path. Needs: audit `_targetIncome` resolution → add golden-vector coverage for fiRatio/retirement path → canonical consolidation → then unify default. Do NOT change blind.
- **Theme F typography** — 268 sub-11px (mostly intentional chart micro-labels) → per-surface design pass.
- **Theme B/C** — methodology+decision-path roll-out onto hero numbers (design).
- **Tier 4 Phase-2** — Open Banking, Vault uploads, Reports PDF export, rules-admin, real-user persistence — need vendor/architecture decisions.

Gap-analysis agent claims corrected where wrong (life-event log, cashflow-Q5, home-Q2 were already built).

---

## A. The original 13-item list (+ import, item 14)

| # | Item | Status | Where |
|---|------|--------|-------|
| 1 | Horizon shows last 5 years (per-year tax record) | ✅ | `TaxYearHistory.jsx` in T&E; ties to SA £9,249 |
| 2 | Reports hard to reach | ✅ | Chrome "⎙ Reports" chip + Dashboard route (#41) |
| 3 | Tax rules 2026/27 hardcoded in copy | ✅ | tax-copy sweep → `TAX.taxYear` (#39) |
| 4 | Dead Today/Future/Plan/WhatIf tabs | ✅ | X28 `modes` prop; per-tab pruning (#38) |
| 5 | Logical drawers, not long lists | 🔄 | T&E/SA/Timeline drawered; **remaining long lists open (#44)** |
| 6 | Everything drill-downable | 🔄 | hero/most surfaces drill; **sweep remaining (#44)** |
| 7 | Risk + Timeline reviewed properly | ✅ | Risk (#42) + Timeline drawers (#43) real passes |
| 8 | Reports formatted terribly | ✅ | `@media print` Theme F + ReportsViewer printable (#41) |
| 9 | Can't make decisions from the info | ✅ | decision-path pattern (#45) |
| 10 | What's the correct decision path | ✅ | DeficitBanner → options → "see what each does" (#45) |
| 11 | Blue Ask pill + −£900 hero dominates Home | ✅ | calm search prompt + compact DeficitBannerView (#36) |
| 12 | Data capture — see functions on screen | ✅ | promoted out of More menu; chrome chip (#12/#37) |
| 13 | Self-assessment layout → collapsible | ✅ | SectionDrawer per SA page (#40) |
| 14 | Import buttons dead + taxonomy validation | ✅ | VTM engine + spreadsheet mapping grid + grouping (#47/#48) |

## B. Import / data-integrity (founder's "no number to the wrong account")

| Item | Status | Where |
|------|--------|-------|
| Validation engine (classify→target→validate→commit) | ✅ | `import-validation.js`; strict classifier (isa→loan hazard fixed) |
| Spreadsheet → mapping-review grid | ✅ | `SpreadsheetImport.jsx`; verified live (gate holds, junk blocks) |
| Liability target dedup (no duplicate mortgage) | ✅ | `resolveTarget` scans liabilities (verified: matched) |
| Key activation for real parsing | ✅ | env-driven, zero source edits; `KEY-ACTIVATION-STEPS.md` (founder runs) |
| Share VTM gate across manual + parsed FP-5 paths | ✅ | #49 — spreadsheet=full VTM grid; **parsed**=null-wrapper now classifies label vs canonical taxonomy (exact-match) before silent-cash (`40c153f`/`34237bc`); manual=taxonomy **picker** (no free text → inherently safe). Full per-field mapping-review *inside* the FP-5 modal deferred (needs event-infra work the Risk session currently holds). |
| `classifyAsset('isa')` → null (ISA is a wrapper) | ✅ | #49 — generalised: ALL bare generics ('isa','pension','bond','share','loan','account','investment') → null (force disambiguate); canonical ids resolve via `_BY_ID` shortcut. Verified golden 9/9, wrappers 27/27, income 28/28. |
| Audit non-strict `classifyLiability` write-path callers | ✅ | #49 — **clean.** Only the importer WRITES via classify and it uses `{strict:true}`. All other `classifyLiability` callers (MyMoney.jsx:431, LiabilitiesDrillDown, DebtDecisions) classify ALREADY-HELD debts for display/labelling — loose catch-all is correct there. `events.jsx` asset-routing receives canonical ids from the Add-menu, not free text. |

## C. "Themes reported and not fixed" — deferred from P1–P7 / earlier audits

| Theme | Item | Status |
|-------|------|--------|
| A | `targetIncome` `||30000` vs `||50000` inconsistency | ☐ ↗ needs golden-vector + tie-out run |
| B/C | methodology drill + decision-path onto hero numbers (NW, IHT, retirement) | ✅(mostly) ↗ — infra IS the methodology surface: `DrillableNumber`/`onDrillMetric` → `driver-engine.js` `driver()` → `DetailOverlay` (formula+source+confidence+driver tree). 2026-06-13 wired ALL non-Risk stub-hitters: `netWorth:<category>` composition sub-drills (`e7e1ee1`), `will` estate-readiness (`1ec8db0`), `gaps`=honest target-shortfall via canonical `gapDims` (`c158b9b`). **NW✓ (tree+composition), IHT✓ (native TaxVsHMRC/InheritanceStory + drvPlanEstate), retirement✓ (native two-lens on Cashflow — richer than a generic node, intentionally NOT duplicated).** Genuinely-remaining: `risk:${dim}` stub (Risk-domain — leave to Risk session); `est-iht`/`income` are TaxEstate-LOCAL subtab nav that open the breakdown tile (acceptable, not a stub). |
| D | live-path audit of dead-pathed Liabilities/Pensions modellers | ☐ (memory: built but possibly unreachable) |
| F | ~17 inline side-stripe borders + ~29 sub-11px typography elements | 🔄 (de-striped several; full sweep open) |
| — | Risk a11y: 0 semantic headings / 11 eyebrow-divs | ☐ per-instance pass |

## D. Older registers — re-verify against current build (⟳)

These predate recent work and may be partly resolved. Each needs a live check before action.

| Source | Item | Status |
|--------|------|--------|
| `_extracted-issues.txt` | "Move choices next to money sections — looks bare" | ⟳ |
| `_extracted-issues.txt` | 2 info-only tiles should be drillable | ⟳ (overlaps #6/#44) |
| `_extracted-issues.txt` | Drill → "back to MyMoney to see details" | ✅ RESOLVED 2026-06-13 — no user-facing punt copy remains (grep clean; only code comments). Drills render detail inline. |
| `_extracted-issues.txt` | Only 6 cashflow tiles — research more; correct sequence; sparklines on all | ⟳ |
| `_extracted-issues.txt` | "Monthly flow −11k vs cashflow −7k don't match" | ✅ RESOLVED 2026-06-13 — both Home + Cashflow now source the SAME `monthlySurplus()` reading NET=surplus−deficit (two-lens redesign e813911). Probed: mrT-core NET=−£900 identical on both. |
| `_extracted-issues.txt` | Unify "dig in" / "view detail" label across screens | ⚠️ FOUNDER-DECISION — "Dig in ›" is the dominant rendered CTA (8 sites), "View detail" is the asset-leaf overlay term (7). Which wins is a brand-voice call, not a bug; deferred to founder rather than guessed. |
| `mymoney-cashflow-sweep-register.md` | open rows | ⟳ |
| `temporal-drilldown-audit-2026-06-02.md` | P1 projection-unify, P2 tax-copy, P3 drillability, P4 leaks | 🔄 (P0 fixed; rest queued) |

## E. Founder-gated / external (not mine to close)

| Item | Status |
|------|--------|
| Rotate exposed Supabase service_role + DeepSeek keys | ☐ founder |
| Set ANTHROPIC_API_KEY secret + deploy parse-document | ☐ founder |
| Open-banking vendor decision (TrueLayer/Yapily) | ☐ founder decision |

---

## F. Scope-doc gap analysis (2026-06-13, 4-agent sweep vs live code)

Compared the canonical scope docs — `~/.claude/plans` schedule + nice-to-haves + audit-findings, the six 2-Product specs, the route-specs + coverage-matrix, and the vault Master backlog v1.8/v1.9 + remaining-work view — against the actual codebase. **Headline: the docs are ~95% stale — almost every "open" row is already built.** The genuine gaps below were each verified against code.

### F1 — Home screen (densest real gap: ships a Radar-centric layout missing 6 spec'd zones)
| Item | Spec | Status | Note | Pri |
|------|------|--------|------|-----|
| Z5 Score Journey multi-line trajectory (NW+Wealth+Risk, confidence band, plan line) | home-v1_4 §Z5 | ☐ missing on Home | analogue exists in Timeline §B → **placement** gap | P1 |
| Z13 AI Weekly Narrative + Z12 AI Synthesis chip | home-v1_4 §Z12/13 | ☐ no impl anywhere | genuine build | P2 |
| Z14 Drive-to-Update stale-asset prompt (`updateStreakCheck`) | home-v1_4 §Z14 | ☐ no impl anywhere | genuine build | P2 |
| Z1.5 Sub-Anchor PRC/PCC "Capital Efficiency" strip | home-v1_4 §Z1.5 | ☐ missing on Home | exists in MyMoney/Cashflow → placement | P2 |
| Z15 Milestone / Pride pin | home-v1_4 §Z15 | ☐ missing on Home | exists in Timeline §F → placement | P3 |
| Z6 Reality Engine three-ring | home-v1_4 §Z6 | ☐ (thresholds O-HOME-1 open) | stub acceptable; founder-spec gated | P3 |

### F2 — Capture / backend (mostly inert-by-design or true Phase 2)
| Item | Status | Pri |
|------|--------|-----|
| Open Banking / aggregator pull (Connect channel — TrueLayer/Plaid) | ☐ Phase 2 (vendor + keys) | P2 |
| Document Vault Phase 2 — uploads, permission matrix, version history | ☐ (read-only catalogue today) | P2 |
| Reports PDF/CSV export engine (button disabled "SP-3") | ☐ | P2 |
| Event-store persistence for real users (UI runs in-memory) | ↗ inert by design | P2 |
| Rules-management admin UI (rules are static JSON, no editor) | ☐ | P2 |
| Supabase live read path (defaults to JSON fallback) | ↗ Phase 2 contract | P2 |

### F3 — Engine
| Item | Status | Pri |
|------|--------|-----|
| Pension current-year contribution canonical reader (AA "used" silently £0) | ✅ ↗ | **P1** — reader `pensionContributionsThisYear` (F-004) already existed; the residue was TWO bypassers: `ask-sonu/tax-year-state.js` (scalar-only hand-read → missed per-pot → mrT-couple showed £0/full-£60k headroom; now £19.8k/£40.2k) and `de/composer.js` (dead nested read). Both routed through the canonical reader; added `usedProvisional` honest-absence flag (mrT-core: £0 used + pots → flagged provisional, not asserted headroom) threaded into the LLM summary + AskSonuFlow chip. Build green, decision-smoke 40/40, golden 9/9. |
| 16 life-event log + recompute (inheritance, business sale, partner death…) | ☐ matrix-only, no logging UI/ripple | P1 |
| Full `goalSeek` multi-metric solver (only pot-contribution real today) | 🔄 ↗ | P2 |
| Decumulation network type→holding drill-down + per-edge taxCost | ☐ | P2 |
| Per-line CGT (lowest-embedded-gain-first) as solver default | 🔄 ↗ | P2 |
| Solver-vs-fundedRatio reconciliation ("£96k to 95" vs 0.48 funded) | 🔄 ↗ memory-flagged | P2 |

### F4 — Cashflow / Timeline
| Item | Status | Pri |
|------|--------|-----|
| Cashflow Bill calendar — data path (renders empty-state only) | 🔄 | P2 |
| Cashflow Subscription tracker — manual entry | 🔄 (Phase 1.2) | P3 |
| Timeline scenario compare (side-by-side) | ☐ | P2 |
| Timeline AI re-explain modal | ☐ | P3 |

### F5 — Verification / hygiene debt
| Item | Status | Pri |
|------|--------|-----|
| §9.5 snap matrix + compliance/IFA skill pass on Cashflow tiles (no `.snap-audit` on disk) | ☐ unverified | P1-verify |
| `<DepthCard>` shared primitive never extracted (local copy in Cashflow) | 🔄 | P3 |

**Not gaps (excluded):** nice-to-haves register (all ⚪ unreviewed, out of scope); India/Thailand/jurisdiction-regen (explicitly post-launch in the docs); founder-blocked CF items (PRC-anchored SWR 5th regime, Reality Engine factorisation — need founder spec, already in §E).

## G. Doc-staleness verdict (action: retire/refresh, don't re-audit)

The 4-agent sweep verified these docs are **pre-build snapshots** — treat their "open" lists as historical:
- `finio-product-audit-findings.md` (2026-05-28): ~7 BLOCKER/MAJOR rows already RESOLVED (hardcoded key, Home↔T&E CoI, MyMoney↔Cashflow drawdown, onboarding save/resume, persona persistence, goal tracker, NW history).
- Master backlog v1.8/v1.9 + remaining-work view (Apr 2026): ~95% DONE-NOW (all 6 screens, canonical engine fns, Num/TripleAnchor, 5×5 cross-map, persona fixtures, Reports framework, X21-23).
- `hot.md` (2026-05-25): stale — predates W0–W8 + P1–P7 + the 13-item overhaul. **Refresh recommended.**

Action: do NOT re-audit these. Mark superseded; refresh `hot.md`; the genuine residue is captured in §F above.

## Proposed order (P1 integrity first, then placement, then themes, engine-risk serial)

**Tier 1 — P1 integrity / correctness (do first):**
1. **F3 pension contribution canonical reader** — ends the silent-£0 AA class; same taxonomy-consolidation pattern as assets/liabilities. (memory `reference_pension_contribution_plumbing`)
2. **#49** share VTM gate across manual + parsed paths + isa-wrapper — finishes the import-integrity story.
3. **F5 §9.5 snap-matrix on Cashflow tiles** — one verification pass; cheap, closes an unproven claim.

**Tier 2 — finish the founder's 13-list + Home placement gaps:**
4. **#44** drawers/drill sweep on remaining long lists (closes 13-list #5/#6).
5. **F1 Home zones** — Score Journey chart + Sub-Anchor + Milestone pin are placement (analogues exist elsewhere — reuse, don't rebuild); AI Narrative + Drive-to-Update are genuine builds.
6. **D-register re-verify** (⟳ pass) — one live sweep; fold real-opens here.

**Tier 3 — themes + polish:**
7. **Theme F** side-stripe + typography sweep · **Theme B/C** methodology roll-out onto hero numbers.
8. **Theme A** targetIncome reconciliation (engine; golden-vectors + tie-out gate) · **F3 solver/fundedRatio reconcile** · **F3 per-line CGT default**.
9. **Theme D** dead-path modeller audit + Risk a11y headings.

**Tier 4 — Phase 2 / founder-gated (scope, not bugs):** F2 Open Banking, Vault Phase 2, Reports export, rules-admin UI, event-store persistence; F3 16 life-event log+recompute; F4 bill-calendar data path + Timeline scenario-compare. Most need a founder decision (vendor, persistence model) — surface at the next decision memo, don't start unprompted.

Each step: build green + live MCP verify + commit/push per CLAUDE.md §9 / §9.5.

**Doc hygiene (quick, do alongside):** refresh `hot.md`; mark Master backlog v1.8/v1.9, remaining-work view, and audit-findings as SUPERSEDED (pointer to this tracker).
