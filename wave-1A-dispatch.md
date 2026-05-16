# WAVE 1A — DISPATCH PROMPT

**For:** Claude Code agents (3 parallel)
**Date:** 2026-05-04
**Wave:** 1A — Engine s02a-tier + Supabase event store
**Authority:** `X28-build-plan-v1_1.md` §A (functions) · §D Wave 1A (sequencing) · §G (approval)
**Operating contract:** `CLAUDE.md` (root) · `parts/1-Foundation/AUTHORITY-MAP.md`
**Gate to next wave:** all 6 functions return real values from real entity reads + real Supabase event reads. PLAN_COMMITMENT round-trip (write → read → render) demonstrable end-to-end. `npm run build` zero errors.

---

## §1 — READING CHECKLIST (every agent · do this before any code)

Refuse to write code until every item is checked.

| # | File | Purpose |
|---|---|---|
| 1 | `CLAUDE.md` | Operating contract. Read in full. Note §6 banned shortcuts (especially #1 fq-calculator EXTEND-ONLY + Wave 1A exception, #11 no localStorage). |
| 2 | `parts/1-Foundation/AUTHORITY-MAP.md` | Resolves authority citations to physical file paths. |
| 3 | `parts/4-Operations/X28-build-plan-v1_1.md` §A and §D | Function-by-function contracts + Wave 1A sequencing. |
| 4 | `parts/200 Project Updates/finio-foundation-v1_8.md` §3.5.X28 | Cross-cutting authority for X28 (4-mode views, plan as first-class, supersession, conflict). |
| 5 | `parts/1-Foundation/1-Foundation-X28-temporal-view-design-v1_1.md` §1–§4, §6 | Deepest engineering contract. Function contracts at §4.1. Migration helper at §6. |
| 6 | `parts/10-All Clusters/10-AllClusters-architecture-master-v1_3.md` §30, §36 | Engine function registry (canonical queue) + per-tab summary. |
| 7 | `parts/3-Engine/3-Engine-supabase-event-store-schema-v1_0.md` | Events table schema authority. RLS policies. Event envelope shape. **D-EVENTSTORE-1.** |
| 8 | `src/engine/fq-calculator.js` lines 1298–1352 | The 9 X28 stubs. Read every signature. Note return shapes. |
| 9 | `src/rules/tax-2026.json` | UK-2026.1 jurisdiction bundle. `getTimeWindow` reads `taxYear` block from here. |

---

## §2 — WAVE 1A SCOPE (locked)

| # | Function / artefact | Owner | Depends on |
|---|---|---|---|
| 0 | **Pre-task: Supabase event store wire-up** (`events` table + `src/engine/eventStore.js` adapter) | Agent α | — |
| 1 | `getTimeWindow` real-impl | Agent β | jurisdiction bundle |
| 2 | `applyTimeWindow` real-impl | Agent β | (1) |
| 3 | `getViewMode` real-impl | Agent β | (5) — mutual stub OK during wave |
| 4 | `commitPlan` real-impl | Agent α | (0) |
| 5 | `planFor` real-impl | Agent α | (0) |
| 6 | `migrateTemporalPreferences` real-impl | Agent γ | — |

**Out of scope this wave:** anything in §B (UI components), §C (per-tab integration), Wave 1B engine functions (`forecastFor`, `varianceFor`, `planStaleness`, `planConflicts`, parameter expansion), X29, X24. If you find yourself reaching for any of these, stop — surface it to founder.

---

## §3 — AGENT α — Supabase event store + plan write/read path

### Task 0 (gating · pre-task) — Supabase event store wire-up

**Goal:** events table live in Supabase + `src/engine/eventStore.js` adapter callable + PLAN_COMMITMENT round-trip demonstrable end-to-end.

1. **Create Supabase `events` table** per schema at `parts/3-Engine/3-Engine-supabase-event-store-schema-v1_0.md`. Confirm table created via Supabase dashboard before writing adapter.
2. **RLS policies live from day one.** `auth.uid() = user_id` on SELECT and INSERT. No exceptions. UPDATE and DELETE: deny by policy (events are append-only).
3. **Indexes** on `(entity_id, event_type, created_at)` and `(entity_id, plan_type, is_active)` per schema doc.
4. **Implement `src/engine/eventStore.js`** exposing exactly this surface:
   - `writeEvent(event)` — inserts row; throws if `correlation_id` missing or `entity_id` empty.
   - `readEvents(entityId, filters?)` — `filters` shape: `{ eventType?, planType?, isActive?, since? }`. Returns events ordered by `created_at` desc.
   - `subscribeEvents(entityId, callback)` — Supabase realtime subscription on filtered rows. Returns unsubscribe handle.
   - `getLatestEvent(entityId, eventType, filters?)` — convenience: returns first matching event by `created_at` desc, or `null`.
5. **No localStorage anywhere.** No `window.localStorage`, no `sessionStorage` for financial data, no IndexedDB. CLAUDE.md §6 #11 enforced.
6. **Test fixture:** write a dummy `PLAN_COMMITMENT` event for Bruce Wayne entity, read it back via `getLatestEvent`, render planId in console. Demonstrable end-to-end before Tasks 4 and 5 start.

**Commit:** `[Wave-1A][Agent-α] Pre-task: Supabase event store + eventStore.js adapter`

### Task 4 — `commitPlan` real-impl

Replace stub body at `src/engine/fq-calculator.js` line ~1318. Contract from X28 design v1.1 §4.1 + §4.6:

- Validate inputs:
  - `targets` array nonempty
  - every `targets[i].byDate` is ≥ today
  - if `planType === 'custom'`, `targets[i].label` required (non-empty string)
- Look up prior active plan of same `planType` via `eventStore.getLatestEvent(entityId, 'PLAN_COMMITMENT', { planType, isActive: true })`. If found, plan being committed gets `supersedes: priorPlanId`; prior plan's `is_active` flag flips to false in a separate event row (audit trail preserved — never UPDATE existing rows).
- Generate `correlation_id` (uuid v4) — every related event in this commit chain shares it.
- Generate `reviewByDate` from `planType` default thresholds (retirement +24mo · estate +36mo · cashflow +12mo · debt +12mo · gift +6mo · protection +12mo · tax +12mo · custom +24mo).
- `eventStore.writeEvent({ event_type: 'PLAN_COMMITMENT', entity_id, plan_type, targets, assumptions, byDate, supersedes, is_active: true, correlation_id, ... })`.
- If `supersedes` was found, also `writeEvent` for the supersession (`event_type: 'PLAN_SUPERSEDED'` with `correlation_id` shared).
- Return `{ planId, status: 'active', committedAt, reviewByDate, supersedes, correlationId }`.

**No localStorage path. No fallback. If Supabase write fails, throw — caller handles UI error.**

**Commit:** `[Wave-1A][Agent-α] §4.1 commitPlan: real-impl + Supabase write + supersession`

### Task 5 — `planFor` real-impl

Replace stub body at `src/engine/fq-calculator.js` line ~1322. Contract from X28 design v1.1 §4.1:

- If `planType === 'all'`: read all active PLAN_COMMITMENT events for `entityId` via `eventStore.readEvents(entityId, { eventType: 'PLAN_COMMITMENT', isActive: true })`. Return array of `{ plan, staleness }`.
- Else: `eventStore.getLatestEvent(entityId, 'PLAN_COMMITMENT', { planType, isActive: true })`. If null, return `null`.
- If `window` filter passed, intersect plan's targets timeline with window range; drop plans that don't touch the window.
- For each returned plan, call `planStaleness(plan.id, entity, bundles)` — at Wave 1A this is still a stub returning `{ stale: false, severity: 'none' }`; that's fine. Wave 1B lifts it.
- Return `{ plan, staleness }` shape (or array of same when `planType='all'`).

**Commit:** `[Wave-1A][Agent-α] §4.1 planFor: real-impl + Supabase read`

---

## §4 — AGENT β — Time window + view mode resolvers

### Task 1 — `getTimeWindow` real-impl

Replace stub body at `src/engine/fq-calculator.js`. Contract from X28 design v1.1 §1.1–§1.3 + §4.1:

- Accept `(windowId, jurisdiction, referenceDate?, longevityConfig?)`.
- Resolve any of 7 canonical windows: `CURRENT_MONTH` · `LAST_30_DAYS` · `TAX_YEAR` · `CALENDAR_YEAR` · `LAST_12_MONTHS` · `CUSTOM` · `LIFETIME`.
- `TAX_YEAR` boundaries jurisdiction-dependent. UK: 6 Apr–5 Apr. Read from `src/rules/tax-2026.json` `taxYear` block. Other jurisdictions throw "not implemented" at v1.0.
- `LIFETIME` endpoint from `longevityConfig.band`: `'conservative' → 85`, `'median' → 88` (default), `'optimistic' → 92`, or numeric custom override.
- `CUSTOM` requires `referenceDate` to be `{ start, end }` object.
- Return `{ id, start, end, label, jurisdiction, isPastOnly, isFutureOnly }`.
  - `isPastOnly: true` for `LAST_30_DAYS`, `LAST_12_MONTHS`, `CURRENT_MONTH` (when reference date is end-of-month), past-section of `TAX_YEAR` / `CALENDAR_YEAR`.
  - `isFutureOnly: true` for `LIFETIME` (always future from reference date).
- Pure compute. No side effects.

**Commit:** `[Wave-1A][Agent-β] §1.1 getTimeWindow: real-impl + 7 canonical windows`

### Task 2 — `applyTimeWindow` real-impl

Replace stub body. Contract from X28 design v1.1 §4.1:

- Accept `(dataArray, window, viewMode, aggregation?)`.
- Filter `dataArray` to entries whose timestamp is within `[window.start, window.end]`.
- Apply `aggregation`:
  - `'sum'` → reduce to single number
  - `'average'` → reduce to single number
  - `'end-of-period'` → return value at `window.end` (last entry on or before)
  - `'time-series'` (default) → return filtered array unchanged in shape
- Missing data: carry-forward at v1.0 (per O-X28-2). If a date in the window has no entry, use the most recent prior entry.
- Pure compute.

**Commit:** `[Wave-1A][Agent-β] §4.1 applyTimeWindow: real-impl + 4 aggregation modes`

### Task 3 — `getViewMode` real-impl

Replace stub body. Contract from X28 design v1.1 §2.1–§2.2 + §4.1:

- Accept `(windowId, referenceDate?, hasActivePlan?)`.
- Default mode by window per §2.2 matrix:
  - `LIFETIME` → default `'plan'` (Plan-primary; Forecast overlay band fading in over first ~2 years)
  - All others → default `'actual'` for past portion, `'forecast'` for future portion
- Availability:
  - `actual: true` if window has any past portion
  - `forecast: true` if window has any future portion
  - `plan: hasActivePlan === true` (greyed if false)
  - `scenario: hasActiveScenario === true` (greyed if false; scenario param not yet wired — pass `false` at Wave 1A)
- Return `{ defaultMode, availability: { actual, forecast, plan, scenario } }`.
- Pure compute. **`hasActivePlan` is a parameter, not an internal lookup** — caller resolves via `planFor('all', window).length > 0`. This avoids circular dependency.

**Commit:** `[Wave-1A][Agent-β] §2.1 getViewMode: real-impl + default-by-window + availability`

---

## §5 — AGENT γ — Schema migration

### Task 6 — `migrateTemporalPreferences` real-impl

Create new file `src/engine/temporalPreferences-migrations.js`. Contract from X28 design v1.1 §6:

- Pure function. No side effects.
- Accept `prefsV1` (object with `schemaVersion: 1`).
- Add `plansPreferences` block with defaults:
  - `defaultPlanView: 'forecast-vs-plan'`
  - `stalenessNotificationCadence: 'session-start'`
  - `stalenessSeverityThreshold: 'review-due'`
  - `timeElapsedThresholds: { retirement: 24, estate: 36, cashflow: 12, debt: 12, gift: 6, protection: 12, tax: 12, custom: 24 }` (months)
  - `conflictDetectionEnabled: true`
- Increment `schemaVersion: 2`.
- Idempotent: if input already has `schemaVersion: 2`, return unchanged.
- Idempotent: if `schemaVersion` field absent, treat as v1.

**Test cases (write inline tests in the file):**
- v1 prefs → v2 prefs with all defaults present
- v2 prefs → v2 prefs unchanged
- Missing schemaVersion → v2 prefs with all defaults
- v1 prefs with partial `plansPreferences` already set → v2 prefs preserving user values, filling missing with defaults

**Commit:** `[Wave-1A][Agent-γ] §6 migrateTemporalPreferences: real-impl + idempotent + 4 test cases`

---

## §6 — WALK-THROUGH CHECKLIST (each agent · before code)

Before writing any code, output the table below filled in for your assigned tasks. Founder reviews and approves before build starts.

| Task | Status | Notes |
|---|---|---|
| (your task #) | WILL-BUILD / KNOWN-STUB / NOT-THIS-WAVE | If WILL-BUILD: list functions/files. If KNOWN-STUB: list dependencies that aren't real yet. If NOT-THIS-WAVE: justify (almost never the answer for Wave 1A scope). |

For Agent α: rows for Tasks 0, 4, 5.
For Agent β: rows for Tasks 1, 2, 3.
For Agent γ: row for Task 6.

---

## §7 — DURING BUILD — DISCIPLINE

- **Atomic commits** — one per task, format `[Wave-X][Agent-Y] §<spec-§>: brief change description`.
- **fq-calculator.js stub-replacement is one-time founder-approved exception (D-QUALITY-BAR-1).** Replace stub bodies in place at lines 1298+. Do NOT rewrite or modify any other exported function. Do NOT add new functions outside the existing 9 stub locations. Do NOT modify call shapes.
- **No localStorage anywhere** — financial data goes through `eventStore.js` to Supabase. UI ephemera (collapsed/expanded card state) may use sessionStorage; nothing in scope this wave needs it.
- **No hardcoded financial values.** Read from bundles. If a value isn't in a bundle, surface it before adding.
- **Use `fmt()`** for any currency rendering (not in this wave's scope but stated for completeness).
- **`correlation_id` (uuid v4) on every event write.** All events in a logical commit chain share it.
- **No git push, no Vercel deploy.** Local commits only. Founder pushes.
- **Do not exceed 300 lines per file.** Split if needed.

---

## §8 — COMPLETION CRITERIA (gate to Wave 1B)

| # | Criterion | How verified |
|---|---|---|
| 1 | All 6 functions return real values (no stub returns) | Inspect each function body; confirm no `return { stub: true }` patterns remain |
| 2 | PLAN_COMMITMENT round-trip end-to-end | Write a plan via `commitPlan` → query Supabase events table → read back via `planFor` → console-log returned plan object |
| 3 | Supersession chain works | Commit two plans of same `planType` in sequence; confirm second has `supersedes: firstId`; confirm first's `is_active` is false; confirm `planFor` returns the second |
| 4 | RLS isolation | Two test users; user A's plan invisible to user B via direct Supabase query |
| 5 | Migration idempotent | Run `migrateTemporalPreferences` twice on same input; identical output |
| 6 | `getTimeWindow` returns correct UK TAX_YEAR boundary | Reference date 1 July 2026 → start = 6 Apr 2026, end = 5 Apr 2027 |
| 7 | `getViewMode` LIFETIME defaults to plan when hasActivePlan true | Returns `defaultMode: 'plan'` |
| 8 | `npm run build` | Zero errors, zero warnings introduced |
| 9 | Console clean | No PII or financial values logged in production-build inspection |
| 10 | No localStorage / sessionStorage / IndexedDB usage for financial data | grep `localStorage\|sessionStorage\|IndexedDB` across `src/engine/` and `src/screens/` — only allowed hits are non-financial UI ephemera |

When all 10 pass, agent reports completion to founder. Founder smoke-tests, then unblocks Wave 1B.

---

## §9 — INTER-AGENT COORDINATION

| Touchpoint | Who | When |
|---|---|---|
| Agent α completes Task 0 (event store) | Agent α → Agent β + γ | Before Tasks 4, 5 start. Agent β can start Tasks 1, 2 in parallel; Task 3 waits on Task 5 stub being callable. Agent γ runs in parallel from start. |
| Stub-of-stub during wave | All | Agent β Task 3 (`getViewMode`) calls `hasActivePlan` resolved by caller — does not directly call `planFor`. Wave 1A allows mutual-stub patterns; both lift to real-impl in this wave. |
| Conflict on file edits | All | `fq-calculator.js` lines 1298–1352 only touched by agents owning those specific stub locations. Agent α: lines 1318, 1322. Agent β: lines TBD per stub layout. Agent γ: new file, no conflict. |
| Anything not covered | All | Stop. Surface to founder. Do not improvise. |

---

## §10 — OUT OF SCOPE (do not start)

Surface to founder if any of these arise during build:

- Wave 1B functions: `forecastFor`, `varianceFor`, `planStaleness` real-impl, `planConflicts` real-impl
- Wave 1B parameter expansion (7 chart-rendering functions)
- UI components: `ViewModeToggle`, `VarianceOverlay`, `PlanStalenessCard`, `PlanCommitFlow`, `PlanConflictBanner`, `NowPill`, `AsAtPill`
- TimeWindowSelector window-ID refactor (Wave 1C task 12)
- Per-tab integration (Wave 1E)
- X29 visual diff layer
- X24 goal-seek
- CMA bundle creation (`src/rules/cma-uk-2026-1.json`) — Wave 1B
- PLSA bundle creation (`src/rules/plsa-uk-2026.json`) — Wave 1E

---

**Dispatch ready. Founder go-ahead required to start.**
