# A2/A3/A4 — Interaction Audit · Reports · Pass 1
**Date:** 2026-05-18
**Auditors:** A2 (real handler), A3 (destination correct), A4 (destination coherent)
**Source:** `src/screens/Reports.jsx` (201 lines) · `src/screens/Dashboard.jsx` (onGenerate wiring)

---

## Overview

Reports.jsx is a Phase-3 STUB. All action buttons (`Generate`, `Schedule`) are:
- `disabled` at the HTML attribute level
- `aria-disabled="true"` set explicitly
- `cursor: not-allowed` applied
- `opacity: 0.65` applied
- Labels read "Coming next — Phase 2" / "Schedule — Phase 2"

No `onClick` handlers are present on any button. The `onGenerate` prop is received and immediately voided (`void onGenerate` line 66). This is the **correct** CTA-honest stub pattern per FD-RP-2.

---

## A2 — Real handler present?

### RP-CHR-01 — Back button
- **Handler:** `onClick={onBack}` (line 72)
- **Real?** PASS. `onBack` prop passed from Dashboard as `() => setMoreScreen(null)` (Dashboard line 694).
- **Verdict:** PASS

### RP-EST-05, RP-TAX-05, RP-CF-05, RP-NW-05, RP-CUS-05 — Generate buttons (×5)
- **Handler:** NONE. `disabled` attribute; no `onClick`.
- **Expected per FD-RP-2:** Correct — stub phase requires no handler.
- **Verdict:** BLOCKED (intentional). NOT a dead-handler defect.
- **Phase 2 risk:** When Phase 2 wires, handler must call `onGenerate?.(r.id, 'now')`. The current Dashboard prop is `console.log` stub — must be replaced with real generation function before Phase 2 launch.

### RP-EST-06, RP-TAX-06, RP-CF-06, RP-NW-06, RP-CUS-06 — Schedule buttons (×5)
- **Handler:** NONE. `disabled`; no `onClick`.
- **Verdict:** BLOCKED (intentional per FD-RP-2).
- **Phase 2 risk:** Handler must call `onGenerate?.(r.id, 'schedule')`.

### RP-PER-02/03/04 — Period radios (×3)
- **Handler:** NONE. `disabled` fieldset.
- **Verdict:** BLOCKED (intentional).

### Summary — A2
| Verdict | Count |
|---------|-------|
| PASS | 1 (back button) |
| BLOCKED (correct stub) | 13 (all generate/schedule/period) |
| FAIL | 0 |

---

## A3 — Destination correct?

**Principle (from inventory):** An action drills to the surface that *owns* the action, not the surface that owns its consequence.

### RP-CHR-01 — Back button
- **Expected destination:** Home screen (via Dashboard `setMoreScreen(null)`)
- **Actual:** Dashboard line 694 — `onBack={() => setMoreScreen(null)}` closes the Reports overlay, returning user to Dashboard/Home.
- **Verdict:** PASS. Destination is correct.

### All Generate/Schedule buttons — BLOCKED
- **Expected destinations (Phase 2):**
  - Generate → vault write + PDF/CSV download (D-RPT-EXPORT-1)
  - Schedule → schedule-config panel (not yet spec'd in component)
- **Current:** no navigation (disabled). No destination to audit.
- **Verdict:** BLOCKED.
- **Phase 2 risk (A3):** The inventory notes generate → "vault" and schedule → schedule panel. Neither destination exists in codebase yet. When Phase 2 wires, both must route to coherent destinations. Current Dashboard `onGenerate` is `console.log` — must not ship.

### RP-G-07 — Vault promise in intro
- **Copy:** "Saved to your vault with a timestamp" (line 104)
- **Actual:** No vault list, no link, no entry point on screen.
- **A3 verdict:** FAIL. A promise of a destination (vault) with no way to reach it. CTA-honesty violation. FUNCTIONAL.

---

## A4 — Destination coherent?

### RP-CHR-01 — Back button
- **Landing:** Dashboard root. Shows all screens/nav.
- **Coherent?** PASS. User returns to a meaningful surface.

### Generate buttons (Phase 2 forward-look)
- **Expected landing:** A generated report (PDF/CSV export + in-app preview per D-RPT-EXPORT-1).
- **FD-CROSS-1 check:** Reports owns the *artifact* — exportable frozen view. The report must render all figures sourced from their respective screens. It does not originate numbers.
- **A4 verdict (Phase 2 concern):** Each of the 5 report types must have its own distinct layout and data (FD-CROSS-1). A generic list or a single template for all 5 = FAIL. The stub's 5-item `REPORT_TYPES` array with distinct `id` values (estate/tax/cashflow/nw/custom) suggests distinct rendering is intended — but no renderer exists yet.

### Schedule buttons (Phase 2 forward-look)
- **Expected landing:** Schedule-configuration panel (weekly/monthly, per spec).
- **No panel in codebase.** Phase 2 concern only.

---

## A3/A4 — FD-CROSS-1 report-type distinctness

FD-CROSS-1 requires each report type to have its own distinct layout and data — "not a generic list."

| Report type | Distinct layout in stub? | Distinct data contract in header comment? | Verdict |
|-------------|--------------------------|------------------------------------------|---------|
| Estate plan | No (generic tile template) | Yes — ihtDynamic, costOfInaction, IHT | BLOCKED |
| Tax summary | No (generic tile template) | Yes — incomeTax, allowances | BLOCKED |
| Cashflow projection | No (generic tile template) | Yes — cashflowHealth, trajectoryData | BLOCKED |
| Net Worth snapshot | No (generic tile template) | Yes — netWorth | BLOCKED |
| Custom report | No (generic tile template) | Partial — "sections from above" | BLOCKED |

**Assessment:** Stub phase — all tiles share one template by design. The spec and header comment document distinct data sources for each. FD-CROSS-1 obligation falls on Phase 2 renderer. Not a current defect, but must be enforced at Phase 2 cutover.

---

## New findings (interaction-specific)

| ID | Finding | Severity |
|----|---------|---------|
| INT-01 | Dashboard `onGenerate` is `console.log('TODO Generate', id, mode)` — a `console.log` stub. Must be replaced with real generation function before Phase 2 launch. If forgotten, all 5 report types silently do nothing at launch. | FUNCTIONAL |
| INT-02 | No `aria-live` region for generation status/feedback. When Phase 2 wires generation, user needs accessible progress feedback. | POLISH (Phase 2 concern) |
| INT-03 | Back button guard (`{onBack && ...}`) means user has no in-screen escape if prop is not passed. Defensive fallback (e.g. `onBack = () => history.back()`) safer. | POLISH |

---

## Summary

- **A2 PASS:** 1 (back button)
- **A2 BLOCKED:** 13 (all stub buttons — correct per FD-RP-2)
- **A3 FAIL:** 1 (RP-G-07 vault promise with no destination)
- **A4 concern (Phase 2):** FD-CROSS-1 distinctness not enforced until Phase 2 renderer ships
- **New findings:** INT-01 FUNCTIONAL, INT-02/INT-03 POLISH
