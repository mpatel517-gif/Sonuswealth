# Reports & Financial-Statements Hub — design brief (for a dedicated agent)

**Status:** BRIEF / not started · **Date:** 2026-06-09 · **Owner:** founder
**Delegation:** Founder directive 2026-06-09 — *"I want all options… spun into separate agents while we focus on completing the Tax & Estate tab."* This program is OWNED BY A SEPARATE AGENT. The main session is NOT building it; it stays on the T&E tab. This doc is the agent's starting brief — the agent must **plan → research → implement**, one sub-project at a time, each with its own spec.

---

## Vision (founder, 2026-06-09)

A **Reports / Financial-Statements hub**, reached from a single consistent affordance **next to the HORIZON control**, present on **every tab**, surfacing the statements relevant to that tab.

The headline new form: **tree-like financial statements** — the accounting trio rendered as expandable hierarchical line items, with **period-comparison columns** and **drill-down**:

- **Balance Sheet** (assets / liabilities / net worth)
- **Income Statement** (income − expenditure = surplus)
- **Cashflow Statement** (inflows / outflows / net)
- …and the other report types below.

**Comparison columns (founder's example):** *This month · Last month · This year · Last year · Next 5 years.* Each statement is a tree (e.g. Assets ▸ Current ▸ Cash ▸ [accounts]) where every node shows its value across those period columns, with variance.

**Interaction:** interactive + **drillable** (tap a line → its breakdown, reusing the DrillableNumber / L4NumberPanel pattern). **Exportable** (PDF/print). Other reports "designed and exportable etc."

---

## Canon alignment — READ FIRST

This is **already a DOCUMENTED canonical module** — do NOT invent a parallel system. Read:
- **`0 Knowledge Base/Wiki/2-Product/2-Product-reports-v1_1.md`** (vault) — the Reports spec: 5 report types (Estate Plan · Tax Summary · Cashflow Projection · Net Worth Snapshot · Custom), D-RF-4 (no pre-built outputs; template + engine render on demand → immutable Vault artefact), AI narrative as commentary-only, viewer + PDF + IFA white-label + scheduling, full data model + engine functions + events.
- **`2-Product-document-vault-v1_0.md`** — artefact storage + retention + IFA/solicitor sharing (the persistence home).
- **`2-Product-notifications-v1_0.md`** — `NC-EX-REPORT-READY`.
- Settings master v1.5 §S6 — Feeds & Reports controls (D-RF-1).

### Two evolutions of the canon the founder is requesting
1. **Interactive + drillable statements** vs the spec's *"reports are documents, not dashboards · static SVG charts"* (§Q2, §Q6 Weakness 1). The founder explicitly wants interactivity + drill. **Reconcile this** — likely: the in-app report VIEW is interactive/drillable; the EXPORT (PDF) is the static snapshot. Decide and write it down.
2. **Accounting-statement tree form + period comparison columns** — richer than the spec's flat section templates. Balance Sheet ≈ enriched RPT-NW-1; Income + Cashflow statements ≈ split/enriched RPT-CASHFLOW-1. CT600 (below) is net-new.

---

## Hard prerequisites / dependencies (these gate parts of the build)
1. **Real persistence is inert in demo.** Event store is in-memory; Supabase adapter no-ops; only localStorage persists. The spec's *immutable timestamped Vault artefacts* cannot exist without real persistence. Interim: localStorage; real: Supabase/Document Vault.
2. **Corporation Tax engine does not exist.** The engine computes *personal* tax only (income/CGT/IHT/NIC). A **CT600 report needs a new corporation-tax engine first** (CT main/small rates, marginal relief, associated companies, AIA/capital allowances). This is the founder's "ct something."
3. **⚠ Period-comparison columns resurrect the historical-data dependency.** "Last month / last year" columns need **actual historical position** (the `persona_snapshots` / historical-snapshot build that was explicitly deferred in the tax work). "This year / next 5 years" are projectable from the engine; "last month / last year" are NOT without historical capture. This is the SAME dependency as the original "go back 6 years" thread (see `~/.claude/plans/yes-i-want-you-sequential-elephant.md` Context). The agent must decide: capture historical snapshots, derive from the event log's timestamps, or show "no history yet" for backward columns at launch.

---

## Sub-projects (sequence — each its own spec → plan → build)

- **SP-1 — Framework + chrome affordance + viewer + live reports.** One "Reports" control next to HORIZON on every tab → opens a viewer rendering each tab's statement LIVE from the engine. Includes the **financial-statement-tree component** (Balance Sheet / Income / Cashflow) with period-comparison columns (forward columns first if history unavailable) + drill. Reuse the **SA computation** (`src/engine/sa-computation.js` + `SAComputationView.jsx`) as the Tax report. Interim localStorage persistence. **No prerequisites — start here.**
- **SP-2 — Corporation Tax engine + CT600 report.** New CT engine + report type, for company-owning personas (Mr T, Tony Stark). Depends on company data in the entity model.
- **SP-3 — Vault persistence + immutable artefacts + PDF export.** Needs Supabase/Document Vault live. Delivers the spec's archival/`data_snapshot_at` promise + real export-to-file.
- **SP-4 — IFA white-label sharing + scheduling.** Needs SP-3 + IFA workspace. Per spec §8–§9.
- **SP-5 — Custom report builder + AI narrative overlay.** Per spec §4.5, §6.

**Recommended order:** SP-1 → SP-2 → SP-3 → SP-4 → SP-5. SP-1 delivers the visible "all tabs, same place" vision + the drillable financial statements and reuses existing work; the infra-gated pieces follow.

---

## Reuse (don't rebuild)
- SA computation engine + view: `src/engine/sa-computation.js`, `src/components/TaxEstate/SAComputationView.jsx`.
- Drill pattern: `src/components/MyMoney/L3/DrillableNumber.jsx` + `L4NumberPanel.jsx`.
- Engine outputs (single-source per spec §Q1B): `netWorth()`, `ihtDynamic()`/`te_ihtExposure`, `calcIncomeTax`, cashflow-engine funcs, `calcFQ`/`calcRisk`, `allowanceTracker`, the asset/liability taxonomies.
- Chrome: `X28TopBar.jsx` / `Dashboard.jsx GlobalTaxYearChip` (where the HORIZON/RULES controls live — the new "Reports" affordance sits here).
- Carry-forward + tax-history stores (`carry-forward-state.js`, `tax-history.js`) for the Tax report.

## First agent tasks
1. Read the canon (above) + this brief. Confirm the canon-evolution reconciliations (interactive-vs-static; tree+comparison form).
2. Resolve the historical-data decision for backward comparison columns.
3. Write the SP-1 spec (`docs/superpowers/specs/`), then plan, then implement — using the project's verification gates (engine tie-out tests + MCP snap at 3 viewports × 2 themes + §9.5 numeric reconciliation).
4. Note SP-2…SP-5 as follow-on specs.
