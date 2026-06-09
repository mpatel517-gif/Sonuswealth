# SP-1 — Reports framework + chrome affordance + viewer + financial-statement tree + 4 live reports

Title: Reports & Financial-Statements Hub — SP-1 spec
Version: v0.1 (DRAFT for build)
Date: 2026-06-09
Status: DOCUMENTED
Cluster: 2-Product (Reports)
File name: `docs/superpowers/specs/2026-06-09-reports-SP-1-framework-and-statements-spec.md`
Purpose: The implementable spec for SP-1 of the Reports program. Turns the `Reports.jsx` Phase-3 stub into a live, tab-aware Reports viewer next to the HORIZON control, adds the drillable financial-statement-tree component (Balance Sheet · Income Statement · Cashflow Statement) with period-comparison columns, and wires the 4 live report types (reusing the SA computation as the Tax report). Interim localStorage persistence. CT600, real Vault persistence, PDF export, IFA white-label, and the custom builder are SP-2…SP-5.

**Summary:** SP-1 wires the existing Reports stub into a live, drillable, tab-contextual statements hub reachable from one affordance next to HORIZON on every tab; all numbers are rendered (never originated) from canonical engine outputs; backward comparison columns show honest-absence until snapshots accrue.
**Tags:** #2-product #reports #financial-statements #SP-1
**Updated:** 2026-06-09

Upstream canon (authoritative):
- `0 Knowledge Base/Wiki/2-Product/2-Product-reports-v1_1.md` — 5 report types, D-RF-4 (render-on-demand → artefact), AI narrative commentary-only, viewer, scheduling.
- `0 Knowledge Base/Wiki/2-Product/2-Product-document-vault-v1_0.md` — artefact storage model, `vault_section: reports`, indefinite retention, IFA/solicitor sharing (SP-3/SP-4 home).
- `2-Product-notifications-v1_0.md` §6.6 — `NC-EX-REPORT-READY` (level 4, route `/vault/reports/[id]`).
- Design brief: `docs/superpowers/specs/2026-06-09-reports-and-financial-statements-design.md`.
- Element inventory: `reports-inventory-v1.md` (FD-CROSS-1, FD-RP-1…3 founder decisions — binding).

> **Naming guardrail (FD-NAME-1 / D-NAME-2).** The canon file is written under the dead codename "Caelixa". Product is **Sonuswealth**. Every user-facing string, report header, and score name pulls from `src/config/brand.js` (`BRAND.name`, `BRAND.scoreFull`, `BRAND.disclaimer`, `BRAND.rulesLabel()`). "Caelixa" or "Finio" in any rendered copy = regression (FD-RP-1: report headers are the highest-risk leak surface).

---

## §1 — SP-1 scope

### In scope
1. **Chrome affordance** — a single "Reports" control in the global `GlobalTaxYearChip` cluster (`src/screens/Dashboard.jsx`), next to HORIZON, present on every tab.
2. **Tab-aware Reports viewer** — opening the affordance shows the statement(s) relevant to the active tab, plus an index of all reports.
3. **Financial-statement-tree component** — Balance Sheet · Income Statement · Cashflow Statement as expandable hierarchical line items with period-comparison columns + drill. Headline new form.
4. **4 live report types** rendered from the engine:
   - Net Worth Snapshot (RPT-NW-1) ← `netWorth` + taxonomy composition + triple-anchor.
   - Cashflow Projection (RPT-CASHFLOW-1) ← `monthlySurplus` + `trajectoryData` + `fundedRatio`/`cashflowHealth`.
   - Tax Summary (RPT-TAX-1) ← **reuse `SAComputationView` / `saComputation`** (no new tax math).
   - Estate Plan (RPT-ESTATE-1) ← `ihtExposure`/`ihtDeltaPrePost2027` + `totalCoI` + `vaultHasDocument` (will/LPA).
5. **Interim persistence** — localStorage for (a) the snapshot-capture ledger and (b) a lightweight "reports generated this session" list. No Supabase.
6. **Verification** — engine tie-out tests + MCP snaps (3 viewports × 2 themes) + §9.5 Gate 2 numeric reconciliation.

### Deferred (named so SP-1 stays bounded)
- **Custom report (RPT-CUSTOM-1)** — section-picker UI. Tile present but routes to "coming in the custom builder" (SP-5). SP-1 does not build the picker.
- **Corporation Tax / CT600** — SP-2 (needs a CT engine that does not exist).
- **Immutable Vault artefacts + PDF/CSV export** — SP-3 (needs real persistence).
- **IFA white-label + scheduling** — SP-4.
- **AI narrative overlay** — SP-5. SP-1 ships the **deterministic templated** narrative only (resolves O-RF-3 for v1.0: deterministic primary, AI overlay later).

---

## §2 — Canon-evolution decisions (RESOLVED in SP-1)

The brief flags three reconciliations. All three are decided here. **D-RPT-SP1-C is the one founder-relevant fork — decided by agent, override welcome** (it ties to the "go back 6 years" historical-data thread).

### D-RPT-SP1-A — Interactive view, static artefact
The spec says "reports are documents, not dashboards" (§10, §Q6 W1). The founder wants interactive + drillable. **Reconciliation:** the **in-app report VIEW is the live, interactive, drillable cockpit**; the **exported artefact (SP-3 PDF/print) is the frozen, immutable snapshot** at `data_snapshot_at`. This is exactly FD-CROSS-1 ("every report is a frozen view of one or more other surfaces; Reports never originates a number, it renders one") — the *frozen* noun is the export, the *render* verb is the view. The viewer reuses `DrillableNumber` + `L4NumberPanel` + `DrillStack`; the export (later) flattens the same data to static SVG/print. §Q6 W1's "tap the live chart" caption inverts: the live view IS the dashboard, the PDF carries the static caption.

### D-RPT-SP1-B — Statement-tree form is additive presentation, zero new math
The accounting trio (Balance Sheet / Income / Cashflow) is a **new presentation layer over existing canonical outputs** — it computes nothing (single-source contract §Q1B). Mapping:

| Statement | Tree root → branches | Engine source (rendered, not originated) |
|---|---|---|
| **Balance Sheet** | Assets ▸ {pensions, investments, property, cash, alternatives, business} ▸ holdings · Liabilities ▸ classes ▸ debts · **Net Worth** | `netWorth(e)`, `_helpers` category totals, `asset-taxonomy`/`liability-taxonomy` classify, `ihtDynamic` for estate treatment tags |
| **Income Statement** | Income ▸ sources · less Tax ▸ bands · less Expenditure ▸ categories ▸ **Surplus** | `calcIncomeTax(e,bundle).byBand`, `monthlySurplus(e,bundle)` |
| **Cashflow Statement** | Inflows ▸ sources · Outflows ▸ {essential, committed, debt service, tax} ▸ **Net cashflow** + forward trajectory | `monthlySurplus`, `trajectoryData(e)`, `fundedRatio` |

The three statements are the **headline form**; the canonical 5 report types remain the catalogue. Balance Sheet ≈ enriched RPT-NW-1; Income + Cashflow statements ≈ split/enriched RPT-CASHFLOW-1.

### D-RPT-SP1-C — Backward comparison columns = honest-absence + capture hook (decided by agent)
**Constraint (verified in code):** no historical-position store exists. `netWorthHistory`/`scoreTrajectory`/`riskTrajectory`/`getTimeSeries` synthesise **backward fiction at LOW confidence** when `entity.trajectories.*` is absent — and **every demo persona lacks those arrays**. The Supabase event-store adapter no-ops in demo. There is no `persona_snapshots` table; `carry-forward-state.js` and `tax-history.js` both explicitly say they are *not* the historical-snapshot build.

**Therefore the columns split by direction:**

| Column | SP-1 behaviour | Source |
|---|---|---|
| **This month** | LIVE | engine at current `effective_date` |
| **This year** | LIVE | engine, tax-year/calendar window (X28) |
| **Next 5 years** | LIVE (projection, flagged "projected") | `trajectoryData`, `ihtDeltaPrePost2027`, forward engine |
| **Last month** | **"No history yet — capturing from today"** | none until snapshots accrue |
| **Last year** | **"No history yet"** | none until snapshots accrue |

**Forbidden:** rendering synthetic backward extrapolation as if it were captured history (violates honest-absence; matches the precedent already set by carry-forward + tax-history). A backward cell is either a real captured snapshot or the honest-absence chip — never fiction.

**Capture hook (SP-1 lays the foundation so backward columns fill over time):** on opening any statement view, write a deduped-per-day position snapshot to `localStorage['sonuswealth.snapshots']` keyed by `personaId` → `{ date, netWorth, ihtToday, wealthScore, riskScore, assets, liabilities, surplus }`. Once ≥1 prior-period snapshot exists for a persona, the matching backward column renders the real delta with `confidence:'HIGH'` and a "captured" provenance chip. **Real backfill** (event-log replay / Supabase snapshot table / the "go back 6 years" build) is **SP-3**, not SP-1.

> Rationale for deciding rather than asking: the infra reality (inert persistence, no snapshot store) makes honest-absence the *only* shippable SP-1 path regardless of preference; the sole live sub-choice — "lay the capture hook now" — is cheap, strictly additive, and starts the clock. Founder may override to (i) drop backward columns entirely from SP-1 UI, or (ii) prioritise the real backfill into SP-1 (pulls SP-3 persistence forward).

---

## §3 — Architecture

### §3.1 Chrome affordance — `Dashboard.jsx`
- Add a **Reports pill** to the global control cluster rendered with `GlobalTaxYearChip` (Dashboard.jsx ~785, the row that already holds HORIZON + RULES). It is the single consistent affordance "next to HORIZON" on every tab.
- Tap → opens the **Reports viewer overlay** (reuse `OverlayShell`, the same pattern the More-sheet Reports entry uses at Dashboard.jsx ~1088), seeded with the **active tab's default statement** (see §3.4 map).
- Keep the existing "More ⋯ → Reports" entry working (it routes to the same viewer index). The disabled-stub `Reports.jsx` screen is replaced by the live viewer.
- Affordance copy: label "Reports", icon consistent with existing chip iconography; aria-label "Open reports and financial statements".

### §3.2 Reports viewer — new `src/screens/ReportsViewer.jsx` (replaces stub body of `Reports.jsx`)
Two-pane on tablet/desktop, stacked on mobile (per spec §10 viewer):
- **Index rail** — the 3 financial statements (Balance Sheet · Income · Cashflow) + the 4 report types (NW Snapshot · Cashflow Projection · Tax Summary · Estate Plan) + Custom (→ SP-5 placeholder). Active item highlighted; tab-context preselects.
- **Content pane** — renders the selected statement-tree or report.
- **Header** — `← back`, report/statement name + `data_snapshot_at` date, `BRAND.rulesLabel()` strip (fixes inventory S-02/S-03), HORIZON window echo.
- **Footer action bar** — Export (disabled, "PDF export — SP-3"), Share (disabled, "Share with adviser — SP-4"), and the FCA disclaimer via `FCADisclaimerFooter` (fixes inventory S-01: Reports currently has no trust line).

### §3.3 Financial-statement tree — new `src/components/Reports/StatementTree.jsx`
- Renders a `StatementNode` recursively: `{ label, values: {thisMonth, thisYear, next5y, lastMonth?, lastYear?}, children?, drill? }`.
- Expand/collapse per node; indentation = accounting hierarchy. Totals roll up visually (display only — value comes from the engine total, never summed in the component, to avoid the §9.5 hero-drift bug class).
- Every value cell is a `DrillableNumber` → `onDrill` pushes an `L4NumberPanel` via `DrillStackProvider` (the existing fixed-overlay drill stack). Leaf drill shows formula + source + provenance, reusing the canonical drill pattern.
- Number format: **exact GBP** for statement line items (mirror `SAComputationView`'s `money()` — accountant-facing, not compact `fmt()`); the comparison delta badge uses `Num` diff.
- Backward columns render the honest-absence chip per D-RPT-SP1-C when no snapshot exists.

### §3.4 Tab → default statement map
| Active tab | Default on open | Also in index |
|---|---|---|
| Home / My Money | Balance Sheet | NW Snapshot, all |
| Cashflow | Cashflow Statement | Income Statement, Cashflow Projection, all |
| Tax | Tax Summary (SA reuse) | Income Statement, all |
| Risk / Timeline | Reports index (no canonical statement for these) | all |

### §3.5 Persistence (interim) — `src/state/report-snapshots.js` (new)
- `captureSnapshot(personaId, entity, bundle)` — dedupes per calendar day, writes to `localStorage['sonuswealth.snapshots']`.
- `getSnapshots(personaId)` / `priorPeriodSnapshot(personaId, period)` — read for backward columns.
- `recordReportGenerated(personaId, reportType)` — appends to `localStorage['sonuswealth.reportlog']` so the viewer can show "last generated" without Vault. **Not** the immutable artefact — that is SP-3. No `VAULT_REPORT_SAVED` event fires in SP-1 (demo gate D-DEMO-HIDDEN-1; event store inert).

### §3.6 Reuse map (do not rebuild)
| Need | Reuse |
|---|---|
| Tax Summary report | `SAComputationView.jsx` (`{entity, personaId, onCommit}`) + `saComputation()` |
| Drillable numbers | `DrillableNumber.jsx`, `L4NumberPanel.jsx`, `DrillStack.jsx` (`DrillStackProvider`, `useDrillStackContext`) |
| Overlay shell | `OverlayShell` (Dashboard pattern) |
| Number format | local `money()` (exact, mirror SAComputationView) + `Num`/`fmt` for compact/diff |
| Engine outputs | `netWorth`, `ihtDynamic`/`ihtExposure`/`ihtDeltaPrePost2027`, `totalCoI`/`costOfInaction`, `calcIncomeTax`, `monthlySurplus`, `trajectoryData`, `fundedRatio`, `cashflowHealth`, `calcFQ`, `calcRisk`, `allowanceTracker`, `asset-taxonomy`, `liability-taxonomy`, `vaultHasDocument` |
| Brand/disclaimer | `src/config/brand.js`, `FCADisclaimerFooter.jsx` |

---

## §4 — §9.5 Gate 2 numeric reconciliation contract (build-blocking)

Every figure in a report MUST equal the same figure on its source surface, same value, same format (inventory A6 / "RECONCILE: source surface"). Tie-outs to assert via `preview_eval` DOM scrape + an engine tie-out test:

| Surface | Must equal |
|---|---|
| Balance Sheet Net Worth total | `netWorth(entity)` and the Home/MyMoney hero NW |
| Balance Sheet Assets total | sum of category totals from `_helpers` (engine), and MyMoney hero Assets |
| Balance Sheet Liabilities total | `liabilitiesTotal(entity)` and MyMoney hero Liabilities |
| Net Worth = Assets − Liabilities | exact tie-out (kills the §9.5 £698k/£670k/£357k bug class) |
| Income Statement tax line | `calcIncomeTax(entity,bundle).tax` and the Tax tab figure |
| Income Statement surplus | `monthlySurplus(entity,bundle).surplus − .deficit` (NET, per cashflow memo) |
| Tax Summary | `saComputation(...).computation.*` exactly equals `SAComputationView` on the Tax tab |
| Estate Plan IHT | `ihtDeltaPrePost2027(entity).today` and the T&E IHT figure |
| Estate Plan CoI | `totalCoI(entity,bundle)` (numeric `costOfInaction`, NOT the string-builder per memory `project_scoped_coi_ruling`) |
| Triple-anchor (NW Snapshot §C) | `netWorth`, `calcFQ().total`, `calcRisk().total` match the tab anchors |

---

## §5 — Files

### New
- `src/screens/ReportsViewer.jsx` — viewer shell + index + content router.
- `src/components/Reports/StatementTree.jsx` — recursive tree + comparison columns + drill.
- `src/components/Reports/statements/balanceSheet.js` — builds the Balance Sheet node tree from engine outputs (pure mapper).
- `src/components/Reports/statements/incomeStatement.js` — Income Statement mapper.
- `src/components/Reports/statements/cashflowStatement.js` — Cashflow Statement mapper.
- `src/components/Reports/reports/*` — NW Snapshot, Cashflow Projection, Estate Plan render modules (Tax = SAComputationView reuse).
- `src/components/Reports/deterministicNarrative.js` — templated narrative (FCA-rewrite-passed) per report. AI overlay = SP-5.
- `src/state/report-snapshots.js` — localStorage snapshot ledger + report log.

### Edited
- `src/screens/Dashboard.jsx` — add Reports affordance to the global control cluster; route to `ReportsViewer` with tab context; pass `entity`, `personaId`, current HORIZON window.
- `src/screens/Reports.jsx` — replace the disabled stub body with `ReportsViewer` (keep export name so More-sheet wiring holds), or redirect the More entry to the viewer. Remove the "Coming next — Phase 2" disabled buttons (they become live or honestly-deferred per §1).

---

## §6 — Verification plan (CLAUDE.md §9 / §9.5)

1. **Engine tie-out tests** (`*.test.js`) — assert every §4 reconciliation against ≥3 personas (Bruce/a, Tony Stark/c, Mr T) so company + multi-asset shapes are covered.
2. **MCP preview** — `preview_start`; open the Reports affordance from each tab; `preview_resize` mobile 375×812 / tablet 768×1024 / desktop 1280×800 × `colorScheme` light+dark; `preview_screenshot` all 6 per key surface (viewer index, Balance Sheet tree expanded, a drill panel, Tax Summary).
3. **Numeric reconciliation** — `preview_eval` DOM scrape of the Balance Sheet hero vs MyMoney hero; assert NW = Assets − Liabilities and cross-surface equality. Write `.snap-verdict` per §9.5 Gate 1.
4. **CTA honesty** — every affordance either works or is honestly labelled with its SP (no "interactive" lie). Export/Share disabled + labelled SP-3/SP-4. Backward columns labelled honest-absence.
5. **Naming grep** — no "Caelixa"/"Finio" in any rendered string; report headers pull `BRAND.scoreFull`.
6. **Drill journey** — tap a Balance Sheet leaf → L4 panel → Back/Home all present (drill-overlay memory).

Done only when: tie-outs pass, 6×4 snaps clean both themes, no naming leak, drill journey works, and at least the 3 statements + 3 live reports (NW/Cashflow/Tax) + Estate render real data. Custom + Export + Share are honestly deferred, not broken.

---

## §7 — Forward notes (SP-2…SP-5)

- **SP-2 — Corporation Tax + CT600.** New `src/engine/corporation-tax.js` (CT main 25% / small-profits 19% / marginal relief, associated companies, AIA/capital allowances) + CT600 report module + `CTComputationView` mirroring `SAComputationView`. Gated on company data in the entity model (Mr T, Tony Stark hold companies). Own spec.
- **SP-3 — Vault persistence + immutable artefacts + PDF/CSV export.** Real Supabase/Document Vault: `VAULT_REPORT_SAVED` event, artefact model (§7 of reports canon), `data_snapshot_at` immutability, PDF/CSV export (D-RPT-EXPORT-1). Enables real backward-column backfill (the "go back 6 years" build). Resolves vault open items B-1 (IFA download scoping for reports), B-2/B-3 (NC payload + channel).
- **SP-4 — IFA white-label + scheduling.** Branding fields (O-RF-6), L2 step-up share, solicitor 7-day link; weekly/monthly scheduler (D-REP-2) on the Rules daily scheduler.
- **SP-5 — Custom builder + AI narrative overlay.** Section-checklist picker (O-REP-1), incoherent-combination warning (§Q6 W2); AI synthesis overlay opt-in (D-REPORTS-NARRATIVE-V1.1) over the deterministic base.

---

## §8 — Open items / founder veto points
- **OV-1 (D-RPT-SP1-C):** backward comparison columns = honest-absence + capture-hook in SP-1; real backfill = SP-3. Override if you want backward columns dropped from the SP-1 UI, or the real backfill pulled forward.
- **OV-2:** NW Snapshot FCA disclaimer — inventory FD-RP-3 flags it "borderline, founder ruling needed." SP-1 default: **include** the disclaimer on all four reports (safer). Override to drop on NW-only.
- **OV-3:** affordance placement — SP-1 adds the Reports pill into the HORIZON cluster AND keeps the More-sheet entry. Override if you want the More-sheet entry removed once the pill ships.
