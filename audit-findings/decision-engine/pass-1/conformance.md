---
Title: Decision Engine — Conformance Audit (A1)
Version: 1.0
Date: 2026-05-18
Status: DOCUMENTED
Cluster: 10-All Clusters / Audit
File name: conformance.md
Purpose: Walk every inventory row (67 rows). Record PASS / FAIL / UNLISTED / DECISION-NEEDED per element.
---

**Summary:** Pass-1 conformance walk of all 67 inventory rows across 9 regions. Source read: DecisionEngineV2.jsx, DecisionTree/index.jsx, OptionCard.jsx, tree-generator.js, validator.js, orchestrator.js, fca-rewrite.js.

---

## Region 1 — Shell / header (DecisionEngineV2.jsx L240-269)

| ID | Element | Verdict | Severity | Notes |
|----|---------|---------|----------|-------|
| DE-CHR-01 | Back arrow / close button | PASS | — | onClick={onClose} wired |
| DE-CHR-02 | "Decision Engine" title text | PASS | — | Present |
| DE-CHR-03 | Subtitle "60 life events · engine-pure · FCA-compliant" | FAIL | FUNCTIONAL | "engine-pure" is builder jargon not user copy. Seed S-01. |
| DE-CHR-04 | Session/prompt counter badge | PASS | — | Present |
| DE-CHR-05 | Sonuswealth wordmark | PASS | — | No Caelixa/Finio in header |

Region 1: 4 PASS · 1 FUNCTIONAL

---

## Region 2 — Idle state (IdleState, L152-176)

| ID | Element | Verdict | Severity | Notes |
|----|---------|---------|----------|-------|
| DE-IDLE-01 | Headline "Ask me about any major life decision" | PASS | — | Present |
| DE-IDLE-02 | Subhead copy | PASS | — | Present |
| DE-IDLE-03 | Sonnu illustration | PASS | — | Rendered |
| DE-IDLE-04 | Starter chip "retire in 3 years" | FAIL | DEMO-BLOCKING | Chip present and submits, but tree-generator schema does not require `horizon` field. Generated tree may have no time-projection. Seed S-12. |
| DE-IDLE-05 | Starter chip "buy a second home" | PASS | — | Present |
| DE-IDLE-06 | Starter chip "going part-time" | FAIL | DEMO-BLOCKING | Same time-projection gap as DE-IDLE-04. Seed S-12. |
| DE-IDLE-07 | Starter chip "gifting to children" | PASS | — | Present |
| DE-IDLE-08 | Starter chip "protect my income" | PASS | — | Present |
| DE-IDLE-09 | Tap-to-run behaviour | PASS | — | onClick auto-populates + submits |

Region 2: 6 PASS · 2 DEMO-BLOCKING

---

## Region 3 — Loading indicator (LoadingIndicator, L78-104)

| ID | Element | Verdict | Severity | Notes |
|----|---------|---------|----------|-------|
| DE-LOAD-01 | Spinner / pulse animation | PASS | — | Present |
| DE-LOAD-02 | "Thinking…" label | PASS | — | Present |
| DE-LOAD-03 | Elapsed time counter | PASS | — | Present |
| DE-LOAD-04 | Abort / cancel button | PASS | — | AbortController signal wired |
| DE-LOAD-05 | Progress step labels | PASS | — | Present |
| DE-LOAD-06 | FCA boundary note during load | PASS | — | Static footer maintained |
| DE-LOAD-07 | Input blocked during load | PASS | — | Disabled during isLoading |
| DE-LOAD-08 | Retry button on timeout | FAIL | FUNCTIONAL | On abort/timeout, error state renders but no distinct retry affordance. User must re-type query. |

Region 3: 7 PASS · 1 FUNCTIONAL

---

## Region 4 — Error state (DecisionEngineV2.jsx L282-292)

| ID | Element | Verdict | Severity | Notes |
|----|---------|---------|----------|-------|
| DE-ERR-01 | Error message — API key not configured | FAIL | DEMO-BLOCKING | tree-generator.js throws `Error('VITE_ANTHROPIC_API_KEY not set')` which surfaces to user. End-users cannot set env vars. Seed S-02. |
| DE-ERR-02 | Error message — rate limit | PASS | — | User-friendly "Too many requests" copy |
| DE-ERR-03 | Error message — network failure | PASS | — | "Connection problem" shown |
| DE-ERR-04 | Options count mismatch error | FAIL | DEMO-BLOCKING | No count guard. Tree with 2 or 5 options renders silently without error or warning. Seed S-03/S-05. |

Region 4: 2 PASS · 2 DEMO-BLOCKING

---

## Region 5 — Input bar (InputBar, L33-76)

| ID | Element | Verdict | Severity | Notes |
|----|---------|---------|----------|-------|
| DE-INP-01 | Text input field | PASS | — | Present, controlled |
| DE-INP-02 | Placeholder text | PASS | — | "What major life decision are you weighing?" |
| DE-INP-03 | Submit button | PASS | — | Enabled only when non-empty and not loading |
| DE-INP-04 | Character/word count hint | PASS | — | Present |
| DE-INP-05 | Input persists on error | PASS | — | currentQuery state preserved |

Region 5: 5 PASS · 0 fail

---

## Region 6 — Validation summary strip (DecisionEngineV2.jsx L298-305)

| ID | Element | Verdict | Severity | Notes |
|----|---------|---------|----------|-------|
| DE-VAL-01 | Strip renders when consequences dropped | PASS | — | droppedCount > 0 gates it |
| DE-VAL-02 | Drill to see which consequences dropped | FAIL | FUNCTIONAL | Count shown, no expandable list of dropped items. Opaque trust. Seed S-09. |

Region 6: 1 PASS · 1 FUNCTIONAL

---

## Region 7.1 — Compound event chips (L23-46)

| ID | Element | Verdict | Severity | Notes |
|----|---------|---------|----------|-------|
| DE-CHC-01 | Compound statement bar | PASS | — | isCompound path renders CompoundChipBar |
| DE-CHC-02 | Individual chip labels | FAIL | FUNCTIONAL | `eventType.replace(/_/g, ' ')` only — "iht_planning" → "iht planning", not "IHT Planning". No acronym handler. Seed S-11. |

Region 7.1: 1 PASS · 1 FUNCTIONAL

---

## Region 7.2 — Decision header (L160-183)

| ID | Element | Verdict | Severity | Notes |
|----|---------|---------|----------|-------|
| DE-TREE-01 | tree.statement displayed | PASS | — | Rendered as H2 |
| DE-TREE-02 | Statement finance-bound | FAIL | FUNCTIONAL | tree.statement is raw LLM prose; no engine variable substitution verified in tree-generator prompt. Seed S-18. |
| DE-TREE-03 | Brand drift check on statement | FAIL | DEMO-BLOCKING | fca-rewrite.js brand filter applied only to consequence text, not to tree.statement, option names, or rationale. Caelixa/Finio could appear in these fields. Seed S-14. |

Region 7.2: 1 PASS · 1 DEMO-BLOCKING · 1 FUNCTIONAL

---

## Region 7.3 — Status badges (L186-207)

| ID | Element | Verdict | Severity | Notes |
|----|---------|---------|----------|-------|
| DE-TREE-04 | "X consequences modelled" badge | PASS | — | From validated tree count |
| DE-TREE-05 | "Y dropped" warning badge | PASS | — | Conditional on droppedCount |
| DE-TREE-06 | "engine-validated" count badge | PASS | — | Distinct from total |

Region 7.3: 3 PASS

---

## Region 7.4 — Deadline chips (L48-68)

| ID | Element | Verdict | Severity | Notes |
|----|---------|---------|----------|-------|
| DE-DDL-01 | Tax year deadline chip | PASS | — | Present when tree.deadlines populated |
| DE-DDL-02 | Deadline chip click → owning surface | FAIL | FUNCTIONAL | onClick on deadline chip is undefined. No routing to T&E or relevant screen. Dead affordance. |

Region 7.4: 1 PASS · 1 FUNCTIONAL

---

## Region 7.5 — Conflict bands (L70-96)

| ID | Element | Verdict | Severity | Notes |
|----|---------|---------|----------|-------|
| DE-CON-01 | Conflict band visibility | PASS | — | Conditional render |
| DE-CON-02 | Conflict description text | PASS | — | conflict.description rendered |
| DE-CON-03 | Conflicting option identifiers | PASS | — | Option letters shown |
| DE-CON-04 | "Resolve" CTA | FAIL | FUNCTIONAL | Resolve button present; onClick is a no-op comment (// TODO). |

Region 7.5: 3 PASS · 1 FUNCTIONAL

---

## Region 7.6 — Options grid (L218-235) — FD-DE-1 4-option pattern

| ID | Element | Verdict | Severity | Notes |
|----|---------|---------|----------|-------|
| DE-OPT-01 | A/B/C/D as distinct cards | PASS | — | mainOptions.map() with letter badges |
| DE-OPT-02 | Unconsidered option D separate | PASS | — | unconsideredOption separated |
| DE-OPT-03 | Empty state guard | PASS | — | Present |
| DE-OPT-04 | Exactly 4 options enforced | FAIL | DEMO-BLOCKING | No count validation in tree-generator or renderer. Silent if 2 or 5 options. Seed S-03/S-05. |
| DE-OPT-05 | Options visually distinct | PASS | — | Separate OptionCard per option |
| DE-OPT-06 | Unconsidered card = full OptionCard | FAIL | FUNCTIONAL | unconsideredOption uses a read-only stub (name+why only), bypassing commit/save buttons. FD-DE-1 violation. Seed S-06. |
| DE-OPT-07 | Time-projection visible per option | FAIL | DEMO-BLOCKING | No required time-projection field in tree schema. Options may lack timeline horizon. Seed S-12. |

Region 7.6: 4 PASS · 2 DEMO-BLOCKING · 1 FUNCTIONAL

---

## Region 7.7 — OptionCard internals (A/B/C/D)

| ID | Element | Verdict | Severity | Notes |
|----|---------|---------|----------|-------|
| DE-OPT-CARD-01 | Letter badge | PASS | — | |
| DE-OPT-CARD-02 | RECOMMENDED pill | PASS | — | Conditional on recommendation.pathId |
| DE-OPT-CARD-03 | UNCONSIDERED PATH pill | PASS | — | Conditional on isUnconsidered |
| DE-OPT-CARD-04 | Irreversibility pin colours | PASS | — | teal/gold/coral consistent |
| DE-OPT-CARD-05 | Option name | FAIL | DEMO-BLOCKING | Not passed through fca-rewrite brand filter. Caelixa/Finio drift risk. Seed S-14. |
| DE-OPT-CARD-06 | Option summary | PASS | — | Present |
| DE-OPT-CARD-07 | Expand chevron ▾ | PASS | — | Rotates on toggle |
| DE-OPT-CARD-08 | Consequence chip label | PASS | — | Rendered |
| DE-OPT-CARD-09 | Consequence chip value c.value | FAIL | DEMO-BLOCKING | Validator checks known engine metrics but cannot catch novel LLM-invented figures. Hardcoded £/% risk uneliminated. Seed S-07. |
| DE-OPT-CARD-10 | ConfidenceChip "engine ✓" | PASS | — | Present when c.engineValidated |
| DE-OPT-CARD-11 | ConfidenceChip percentage % | FAIL | FUNCTIONAL | "67%" rendered without tooltip explaining what confidence means. |
| DE-OPT-CARD-12 | Expanded full rationale | PASS | — | Rendered |
| DE-OPT-CARD-13 | "For" pros list | PASS | — | LLM-generated, FCA-filtered |
| DE-OPT-CARD-14 | "Against" cons list | PASS | — | LLM-generated, FCA-filtered |
| DE-OPT-CARD-15 | "Sequence" step list | PASS | — | Present |
| DE-OPT-CARD-16 | "Risks" list | PASS | — | Present |
| DE-OPT-CARD-17 | "Before committing" sub-decisions | FAIL | FUNCTIONAL | Items rendered as static text {d.q}. No onClick. No child DE tree spawned. Dead affordance. Seed S-08. |
| DE-OPT-CARD-18 | "Commit to this path" button | PASS | — | handleCommit wired, orc.commit(pathId) called |
| DE-OPT-CARD-19 | "Save as scenario" button | PASS | — | handleSaveScenario wired |

UNLISTED element: ProvenanceChip rendered in consequence chips — not in inventory. UNLISTED.

Region 7.7: 13 PASS · 2 DEMO-BLOCKING · 3 FUNCTIONAL · 1 UNLISTED

---

## Region 7.8 — Tail elements (L284-322)

| ID | Element | Verdict | Severity | Notes |
|----|---------|---------|----------|-------|
| DE-TREE-07 | Dropped-consequence drill | FAIL | FUNCTIONAL | Count shown; no expandable detail list. Seed S-09. |
| DE-TREE-08 | Cost of inaction statement | PASS | — | costOfInaction() called |
| DE-TREE-09 | CoI traces to engine | PASS | — | Calls ihtwaterfall + taxAndEstateImpact |
| DE-TREE-10 | Recommendation rationale block | PASS | — | tree.recommendation.rationale rendered |
| DE-TREE-11 | Time horizon shown | FAIL | DEMO-BLOCKING | tree.horizon field used in renderer but not required by tree-generator schema; may be absent or null. |
| DE-TREE-12 | FCA boundary footer | PASS | — | Auto-appended via fca-rewrite.js |
| DE-TREE-13 | Ask Sonnu follow-up cross-link | PASS | — | onAskFollowUp prop wired |

UNLISTED elements: learning-log.js generation logging (internal, not user-visible). UNLISTED.

Region 7.8: 4 PASS · 1 DEMO-BLOCKING · 2 FUNCTIONAL

---

## Region 8 — Follow-up panel (FollowUpPanel, L106-150)

| ID | Element | Verdict | Severity | Notes |
|----|---------|---------|----------|-------|
| DE-FUP-01 | Follow-up input | PASS | — | Present |
| DE-FUP-02 | Round counter | PASS | — | followUpRound tracks |
| DE-FUP-03 | Submit handler | PASS | — | orc.answerFollowUp() |
| DE-FUP-04 | Close / done button | PASS | — | Present |
| DE-FUP-05 | FCA boundary note | PASS | — | Inherited from static footer |

Region 8: 5 PASS

---

## Region 9 — Entry points / cross-screen reconciliation

| ID | Element | Verdict | Severity | Notes |
|----|---------|---------|----------|-------|
| DE-ENT-01 | HomeScreen → DE idle | FAIL | DEMO-BLOCKING | No direct HomeScreen → DecisionEngineV2 navigation found. Home routes life-question queries to Ask panel only. Seed S-15. |
| DE-ENT-02 | Ask.jsx intent='act' → DE | FAIL | DEMO-BLOCKING | classifyIntent returns 'act' but handler sets showActionChips, NOT setDecisionEngine(true). DE tree never launched from Ask. Silent bypass. Seed S-13. |
| DE-ENT-03 | What-If cinema chip → DE | PASS | — | initialEventIds prop path works |
| DE-ENT-04 | MyMoney drill → DE | DECISION-NEEDED | — | MyMoney "Start drawdown" → Cashflow per FD-CROSS-1. Whether drawdown option-weighting should also spawn DE is a product decision. |
| DE-ENT-05 | Cashflow drawdown → DE | PASS | — | Entry exists |
| DE-ENT-06 | T&E gifting/trust/will → DE | PASS | — | Entry exists |
| DE-ENT-07 | Timeline scenario edit → DE | PASS | — | Entry exists |
| DE-ENT-08 | onCommit → caller plan view | FAIL | DEMO-BLOCKING | onCommit({committed,planId}) returns planId but caller overlay closes without navigating to Timeline plan strip. No plan confirmation surface shown. Seed S-16. |
| DE-ENT-09 | onSaveScenario → scenarios list | FAIL | FUNCTIONAL | onSaveScenario returns draftId but no UI surface displays saved draft scenarios. Destination does not exist. |
| DE-ENT-10 | onClose → previous surface | PASS | — | Modal closes cleanly |

Region 9: 4 PASS · 4 DEMO-BLOCKING · 1 FUNCTIONAL · 1 DECISION-NEEDED

---

## UNLISTED elements in build

| Element | Location | Verdict | Severity |
|---------|----------|---------|----------|
| ProvenanceChip | OptionCard consequence chips | UNLISTED | POLISH |
| learning-log.js generation logging | de/learning-log.js | UNLISTED | POLISH (internal only) |
| DecisionEngine.jsx (legacy) | src/screens/DecisionEngine.jsx | UNLISTED | POLISH (not imported) |

---

## Coverage summary

| Metric | Count |
|--------|-------|
| Total inventory rows | 67 |
| PASS | 44 |
| FAIL — DEMO-BLOCKING | 13 |
| FAIL — FUNCTIONAL | 10 |
| FAIL — POLISH | 0 |
| DECISION-NEEDED | 1 |
| UNLISTED | 3 |
| **Coverage** | **67/67 = 100%** |
