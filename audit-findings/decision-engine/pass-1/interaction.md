---
Title: Decision Engine — Interaction Audit (A2/A3/A4)
Version: 1.0
Date: 2026-05-18
Status: DOCUMENTED
Cluster: 10-All Clusters / Audit
File name: interaction.md
Purpose: A2=real handler?  A3=routes to canonical owning surface?  A4=SOURCE/ACTION/DECISION coherence. Multi-option distinct. Options comparable and actionable.
---

**Summary:** 6 interactive elements traced fully. 3 DEMO-BLOCKING routing failures (Ask bypass, commit no Timeline, DE-ENT-01 missing Home entry). Sub-decisions dead (FUNCTIONAL). Unconsidered card misses commit/save (FUNCTIONAL).

---

## A2 — Real handler verification

Every clickable element: does it have an actual function, or a no-op / TODO?

| Element | Handler | Real? | Verdict |
|---------|---------|-------|---------|
| Close button (DE-CHR-01) | `onClose({cancelled:true})` | YES — prop passed from parent, modal closes | PASS |
| Starter chips (DE-IDLE-04/06/07/08) | Sets `currentQuery` + calls `handleSubmit()` | YES — real submit | PASS |
| Submit button (DE-INP-03) | `handleSubmit` → `orc.generate(query)` | YES | PASS |
| Abort button (DE-LOAD-04) | `abortController.abort()` | YES | PASS |
| Option card expand chevron (DE-OPT-CARD-07) | `setExpanded(!expanded)` | YES — local state toggle | PASS |
| "Commit to this path" (DE-OPT-CARD-18) | `handleCommit(pathId)` → `orc.commit(pathId)` → returns `{committed, planId}` → calls `onCommit(result)` | YES — real orchestrator call | PASS |
| "Save as scenario" (DE-OPT-CARD-19) | `handleSaveScenario(pathId)` → `orc.saveScenario(pathId)` → returns `{saved, draftId}` → calls `onSaveScenario(result)` | YES — real orchestrator call | PASS |
| "Before committing" sub-decisions (DE-OPT-CARD-17) | Static `<p>{d.q}</p>` — NO onClick | **NO — dead affordance** | FAIL — FUNCTIONAL |
| Deadline chip click (DE-DDL-02) | onClick is undefined | **NO — dead** | FAIL — FUNCTIONAL |
| Conflict "Resolve" button (DE-CON-04) | onClick is `// TODO` comment | **NO — dead** | FAIL — FUNCTIONAL |
| Dropped consequences detail | No expand/click affordance | **NO — count only** | FAIL — FUNCTIONAL |

---

## A3 — Canonical owning surface routing

Decision Engine is a DECISION surface. Routing OUT must land on the right canonical surface.

### On commit

- `orc.commit(pathId)` returns `{committed: true, planId, pathId}`
- Caller receives `onCommit({committed, planId})`
- **Expected:** caller navigates to Timeline plan strip showing new plan
- **Actual:** modal overlay closes. No navigate() call. No Timeline update. No confirmation surface.
- **Verdict: FAIL — DEMO-BLOCKING** (Seed S-16)
- FD-CROSS-1 requires each option leads to canonical owning surface for "the doing." Commit is the paradigmatic exit; it fails.

### On save scenario

- `orc.saveScenario(pathId)` returns `{saved: true, draftId}`
- Caller receives `onSaveScenario({saved, draftId})`
- **Expected:** Timeline scenarios list or a named draft surface showing the saved scenario
- **Actual:** modal closes. No destination for draft scenarios exists in Timeline.jsx (no scenario inbox found).
- **Verdict: FAIL — FUNCTIONAL**

### On close (cancel)

- `onClose({cancelled: true})`
- Returns to whichever surface opened DE
- **Verdict: PASS** — appropriate for cancellation

### Ask.jsx intent='act' routing

- `classifyIntent` returns intent including `'act'` category
- Handler block `if (action === 'act →' || action === 'act')` → sets `showActionChips = true`
- `showActionChips` renders inline action chip suggestions inside Ask panel
- **Expected per FD-CROSS-1:** decision-shaped 'act' intent should open DE tree
- **Actual:** Ask inline answer shown; DE never opened
- **Verdict: FAIL — DEMO-BLOCKING** (Seed S-13)

### HomeScreen → DE

- No `navigate()` or modal open pointing to `DecisionEngineV2` found in HomeScreen.jsx
- "Ask any life question" button in Home routes to Ask panel, not DE
- **Verdict: FAIL — DEMO-BLOCKING** (Seed S-15, DE-ENT-01)

### Cross-screen entries that PASS

| From | Via | Verdict |
|------|-----|---------|
| What-If cinema chip | `initialEventIds` prop, DE auto-runs | PASS |
| Cashflow drawdown comparison | Entry exists | PASS |
| T&E gifting/trust/will | Entry exists | PASS |
| Timeline scenario edit | Entry exists | PASS |

---

## A4 — SOURCE / ACTION / DECISION coherence

FD-CROSS-1 categorisation: Decision Engine is a DECISION surface. Every option must be comparable and lead to action (not describe-only).

### Multi-option distinct rendering

- `mainOptions.map()` renders each option as a separate `OptionCard` with unique letter badge
- Options A/B/C/D are visually distinct — **PASS**
- But: no count guard. If LLM returns only 2 options, DE silently renders as a 2-card screen. This breaks the "multi-option comparable" requirement. **FAIL — DEMO-BLOCKING** (Seed S-03/S-05)

### Options comparable (same consequence dimensions across options)

- Each option has `consequences[]` array with metric labels and values
- Different options may have different consequence sets (LLM-generated) — no schema enforcement that all options expose the same dimensions
- **Verdict: FAIL — FUNCTIONAL** — comparability is LLM-luck, not structural

### Options actionable (lead to "the doing")

- "Commit to this path" button present on each main option card — **PASS** for intent
- But commit routing fails (see A3 above) — the "doing" surface never opens
- "Before committing" sub-decisions are static text, not drillable decisions — **FAIL — FUNCTIONAL**
- Sequence steps do not link to the surface where the action is performed (e.g., pension contribution step has no link to MyMoney settings)

### Describe-only detection

- DE-OPT-CARD-17 "Before committing" items: rendered as `<p>{d.q}</p>`. These are decision questions that should spawn child DE trees. Currently describe-only. **FAIL — FUNCTIONAL**
- Consequence chips with LLM-generated values (not engine-validated): these are assertions, not comparable figures anchored to user data. Describe-only risk. **FAIL — DEMO-BLOCKING** (Seed S-07)

### RECOMMENDED framing

- OptionCard shows "RECOMMENDED" pill when `option.id === tree.recommendation.pathId`
- This is a DATA label (marks which option LLM flagged), not directive advice ("Option A is better for you")
- Presentation is neutral — the pill doesn't say "choose this" in body text
- **Verdict: PASS** — FCA framing preserved at UI layer (assuming fca-rewrite covers recommendation rationale text — see domain.md)

---

## Summary table — A2/A3/A4

| Finding | Severity | Seed |
|---------|----------|------|
| Ask intent='act' bypasses DE — silent bypass | DEMO-BLOCKING | S-13 |
| HomeScreen has no DE entry | DEMO-BLOCKING | S-15/DE-ENT-01 |
| Commit exits with no Timeline plan confirmation | DEMO-BLOCKING | S-16 |
| Options count not enforced (2 or 5 render silently) | DEMO-BLOCKING | S-03/S-05 |
| Consequence values from LLM not fully engine-verified | DEMO-BLOCKING | S-07 |
| Sub-decisions (before committing) static, not clickable | FUNCTIONAL | S-08 |
| Unconsidered option bypasses commit/save buttons | FUNCTIONAL | S-06 |
| Options may lack comparable consequence dimensions | FUNCTIONAL | new |
| Save scenario has no destination surface | FUNCTIONAL | DE-ENT-09 |
| Deadline chip onClick dead | FUNCTIONAL | DE-DDL-02 |
| Conflict resolve button no-op | FUNCTIONAL | DE-CON-04 |
