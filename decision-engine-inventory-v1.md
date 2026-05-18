# Decision Engine — Element Inventory v1

**Screen:** Sonuswealth Decision Engine (build target: React in `src/screens/DecisionEngineV2.jsx`)
**Design baseline:** none — V2 is engine-generated; no static HTML mockup. Conformance auditor flags absence.
**Reconciliation baseline:** engine — `src/de/tree-generator.js` (Claude API, model `claude-opus-4-7`), `src/de/validator.js`, `src/de/orchestrator.js`, `src/de/composer.js`, `src/engine/fq-calculator.js`, `src/config/brand.js`, `rules-uk.js`.
**Intent reference (NOT a conformance target):** plan §Phase 4, D-DE-2, D-DE-3 — use only for state-machine names and FCA framing.
**Code-hygiene finding (header-level):** legacy `src/screens/DecisionEngine.jsx` (the original 9-step property wizard) still exists alongside V2. V2 is current per the file docstring. Legacy file is **out of scope** for this inventory but flagged as dead-code risk; auditor should confirm it is no longer routed anywhere and propose removal.
**Date:** 17 May 2026

---

## Why this file exists

This is the **fixed target** the whole audit measures against. Every interactive or
data-bearing element on Decision Engine is one numbered row. The audit does not "find
mistakes" — it walks this list and records a verdict per row.

**This file is the worksheet.** Auditor agents fill the `Verdict` columns. Do not add
or remove rows except via the "inventory drift" rule in the runbook. If the build
contains an element not listed here, that is itself a finding (`UNLISTED`).

---

## The six assertions (every row is tested against all six)

| # | Assertion | Fails when… |
|---|-----------|-------------|
| A1 | **Identified** — element exists in the build and matches this row | Element missing from build, or build has an element not in this inventory |
| A2 | **Drillable** — if it is a number, action, or nav element, interacting with it does something | Tapping is dead / no handler / no visible response |
| A3 | **Destination correct** — it resolves to the surface that **owns its subject** | A pension action lands on Cashflow; a tax number lands on Risk; etc. |
| A4 | **Destination coherent** — the landing is a usable continuation: it shows the SOURCE, an ACTION, or a DECISION | Lands on a generic modal, a dead-end, a screen top with no context, or an unrelated view |
| A5 | **Plain English** — label + any explainer readable by a non-expert in one pass; jargon translated; information-not-advice (FCA) | Unexplained jargon; advice-phrased copy; figure with no plain meaning |
| A6 | **Reconciled** — every number traces to an engine function and matches value + format everywhere it appears | Hardcoded number; `fmt()` not used; same metric shows two values/formats |

**Drill destination taxonomy (A3 + A4).** Every drillable element must resolve to one of:
- **SOURCE** — the breakdown / detail / provenance of where a number came from.
- **ACTION** — a place to *do* the thing (a panel, a flow).
- **DECISION** — a place to weigh options and commit (scenario engine, plan).

**Verdict values:** `PASS` · `FAIL` · `NA` · `UNVERIFIED` (default) · `BLOCKED` (cannot test).
**Severity (set by orchestrator on any FAIL):** `DEMO-BLOCKING` · `FUNCTIONAL` · `POLISH`.

---

## Confirmed founder decisions (auditors treat these as fixed)

| FD | Decision |
|----|----------|
| FD-NAME-1 | **Product name is `Sonuswealth` (D-NAME-2, locked 9 May 2026 — supersedes Caelixa and Finio).** Source of truth: `src/config/brand.js` (`BRAND.name`). Casing: logo / wordmark = `sonuswealth` (lowercase); body text, titles, aria-labels, page `<title>`, score strings = `Sonuswealth` (sentence case); marketing slogans (footer-tier only) may use ALL CAPS. Every `Caelixa` or `Finio` in user-facing strings = FUNCTIONAL FAIL (A5/A6). DE-rendered tree text (from Claude) MUST be sanitised — any brand drift in tree output is DEMO-BLOCKING. |
| FD-LOGO-1 | Brand assets live at `G:\My Drive\All Work\6.Finio\1-Clusters\Codex UI\deliverables\sonuswealth-site\assets\{favicons,logo,mascot,videos}`. Conformance-auditor checks logo variants per theme; flags faded-purple dark variant as DEMO-BLOCKING wherever below WCAG AA. |
| FD-MASCOT-1 | Mascot is **Sonnu (owl)**, 6 life-stage forms. Placement on screens is Wave 7 enhancement scope; absence is not-a-finding for this audit. |
| FD-CROSS-1 | **Decision Engine owns option weighing** — the DECISION surface where multiple paths are compared and a commit happens. Critical actions (drawdown, ISA, will, trust, gifting) route here when the user wants to compare options before doing. DE is the *terminus* for What-If flows on every other screen; it is never a pointer to a different surface for its own job. |
| FD-DE-1 | **The 4-option pattern from Home's What-If overlay (H-OVL-02) lands here.** Every What-If on every screen ultimately uses the DE tree. Pattern is: A/B/C main options + D as the "Unconsidered Path" (the option the user didn't think of), each option time-projected and bound to current financials. A tree with only 3 options or 5+ flat options without the A/B/C + D structure is a DEMO-BLOCKING fail. |
| FD-DE-2 | Tree generation is engine-mediated: Claude returns prose → `validator.js` drops any consequence the engine cannot reproduce (`Engine-pure ✓` badge requires `_validation.dropped === 0`). Any £/% figure rendered in an option's consequences MUST carry `engineValidated: true` OR show a confidence chip. Hardcoded numbers in the tree pipeline = DEMO-BLOCKING. |
| FD-DE-3 | One renderer (`DecisionTree/index.jsx`) handles all 60 ontology events. No event-specific UI branches in JSX. If an event needs custom rendering, that is itself a finding (FUNCTIONAL). |

---

## ELEMENT TABLE

> `Owns-subject destination` is the **expected** A3/A4 target — the auditor checks the
> build against this. DE is itself a DECISION surface; many rows have destination `NA`
> because the user is already at the terminus. But routes OUT (commit → plan; save →
> draft scenario; sub-decisions → other DE trees) must be coherent.

### Region 1 — Shell / header (`DecisionEngineV2.jsx` L240-269)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| DE-CHR-01 | Back arrow `←` (visible when `onClose` provided) | ACTION | calls `orc.cancel()` + `orc.reset()` + `onClose({cancelled:true})` — caller's previous surface | UNVERIFIED | Verify caller (Home/Ask/What-If chip) actually receives the callback and re-renders correctly |
| DE-CHR-02 | Title "Decision Engine" | DATA | NA (display) | UNVERIFIED | A5: is "Decision Engine" plain-English for a novice? Maybe "Weigh your options" — flag for copy review |
| DE-CHR-03 | Subtitle "60 life events · engine-pure · FCA-compliant" | DATA | NA (display) | UNVERIFIED | A5: "engine-pure" is jargon. Founder-facing language leaked to user. Likely FUNCTIONAL fail |
| DE-CHR-04 | "Cancel" button (when `isLoading`) | ACTION | aborts in-flight Claude call via `orc.cancel` | UNVERIFIED | A2: confirm AbortController actually cancels fetch; user-feedback on cancel |
| DE-CHR-05 | "New" button (when `isDone`) | ACTION | resets FSM to IDLE, clears query | UNVERIFIED | A4: does it return to IdleState with starter chips, or blank? |

### Region 2 — Idle state (`IdleState`, L152-176)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| DE-IDLE-01 | Heading "Ask any life question" | DATA | NA | UNVERIFIED | A5 |
| DE-IDLE-02 | Body copy "Describe a financial life decision in plain English. The engine produces a real decision tree — options, consequences, deadlines, risks, and the option you didn't think of." | DATA | NA | UNVERIFIED | A5: "the engine" — vague; "the option you didn't think of" is the FD-DE-1 pattern statement, must reconcile |
| DE-IDLE-03 | Starter chip — "Should I buy a second property?" → event `buy_second_home` | ACTION | DECISION — runs tree for `buy_second_home` | UNVERIFIED | A6: chip pre-binds eventId; verify event exists in `ontology.js` |
| DE-IDLE-04 | Starter chip — "Can I afford to retire in 3 years?" → event `retire` | ACTION | DECISION — runs tree for `retire` | UNVERIFIED | FD-DE-1: must produce time-projected tree (3-year horizon visible in options) |
| DE-IDLE-05 | Starter chip — "How do I reduce my IHT before April 2027?" → event `iht_planning` | ACTION | DECISION — runs tree for `iht_planning` | UNVERIFIED | A6: "April 2027" is hardcoded in chip copy; should reconcile to `rules-uk.js` SIPP-IHT effective date (memory: ENACTED 2026, effective Apr 2027) — verify alignment |
| DE-IDLE-06 | Starter chip — "I'm going part-time — what's the impact?" → event `part_time` | ACTION | DECISION — runs tree for `part_time` | UNVERIFIED | |
| DE-IDLE-07 | Starter chip — "What do I do with a large inheritance?" → event `inheritance_received` | ACTION | DECISION — runs tree for `inheritance_received` | UNVERIFIED | |
| DE-IDLE-08 | Starter chip — "Should I set up a trust for my children?" → event `setup_trust` | ACTION | DECISION — runs tree for `setup_trust` | UNVERIFIED | |
| DE-IDLE-09 | Number of starter chips (currently 6) | DATA | NA | UNVERIFIED | Verify 6 is enough; founder may expect "see more" affordance — none exists |

### Region 3 — Loading indicator (`LoadingIndicator`, L78-104)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| DE-LOAD-01 | Spinner ring (CSS animated) | DATA | NA | UNVERIFIED | A2: animation runs |
| DE-LOAD-02 | Label — `ONTOLOGY_MATCH` → "Matching your question…" | DATA | NA | UNVERIFIED | A5 |
| DE-LOAD-03 | Label — `MULTI_EVENT_COMPOSE` → "Merging event contexts…" | DATA | NA | UNVERIFIED | A5: "event contexts" is jargon |
| DE-LOAD-04 | Label — `CONTEXT_GATHER` → "Reading your financial picture…" | DATA | NA | UNVERIFIED | A5 ok |
| DE-LOAD-05 | Label — `PROMPT_BUILD` → "Assembling prompt…" | DATA | NA | UNVERIFIED | A5: "prompt" is internal language; user shouldn't see this |
| DE-LOAD-06 | Label — `CLAUDE_CALL` → "Generating decision tree…" | DATA | NA | UNVERIFIED | A5/FD-NAME-1: word "Claude" appears in code state name only, not in label — verify no leak elsewhere |
| DE-LOAD-07 | Label — `VALIDATE` → "Validating with engines…" | DATA | NA | UNVERIFIED | A5 |
| DE-LOAD-08 | Label — `FOLLOW_UP` → "Processing your answers…" | DATA | NA | UNVERIFIED | A5 |

### Region 4 — Error state (`DecisionEngineV2.jsx` L282-292)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| DE-ERR-01 | Error banner — `VITE_ANTHROPIC_API_KEY not set` → "API key not configured — set VITE_ANTHROPIC_KEY in .env.local" | DATA | NA | UNVERIFIED | **A5 FAIL likely**: end-user does not control env vars; this is a developer message in a user surface. DEMO-BLOCKING |
| DE-ERR-02 | Error banner — generic `Error: {orc.error}` | DATA | NA | UNVERIFIED | A5: raw error from `tree-generator.js` (e.g. "Claude API 429: rate_limit") shown verbatim — needs plain-English mapping |
| DE-ERR-03 | Network failure path (fetch throws, AbortError, etc.) | DATA | NA | UNVERIFIED | No retry CTA, no fallback offer; seed S-04 |
| DE-ERR-04 | API key fallback chain (`VITE_ANTHROPIC_API_KEY` || `VITE_ANTHROPIC_KEY` per `tree-generator.js` L21-22) — error message references **only** `VITE_ANTHROPIC_KEY` | DATA | NA | UNVERIFIED | **Mismatch**: code prefers `VITE_ANTHROPIC_API_KEY` but error tells user to set `VITE_ANTHROPIC_KEY`. FUNCTIONAL fail. Also memory: live key was found in retirewise prototype — rotation pending |

### Region 5 — Input bar (`InputBar`, L33-76)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| DE-IN-01 | Text input field | ACTION | captures free-form query | UNVERIFIED | A2: autofocus on mount (`ref.current?.focus()`); Enter submits |
| DE-IN-02 | Placeholder — idle: "Ask any life question…" | DATA | NA | UNVERIFIED | A5 ok |
| DE-IN-03 | Placeholder — post-tree: "Ask a follow-up or try another question…" | DATA | NA | UNVERIFIED | A5 ok; verify it switches at the right moment |
| DE-IN-04 | "Go" button | ACTION | DECISION — calls `orc.run(q, {eventIds})` → triggers tree generation | UNVERIFIED | A2: disabled when empty or loading; "…" when loading |
| DE-IN-05 | Off-ontology query handling (any free-text not matching one of 60 events) | ACTION | DECISION — tree generated with `offOntology: true` flag | UNVERIFIED | Verify ontology-mismatch path doesn't silently fall through to "Ask Sonu" (seed reminder) |

### Region 6 — Validation summary strip (`DecisionEngineV2.jsx` L298-305)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| DE-VAL-01 | "{N} engine-validated consequences" label | DATA | NA (or SOURCE — validation report) | UNVERIFIED | A5: "engine-validated consequences" is jargon. A2: not clickable but probably should be (drill into what was validated) |
| DE-VAL-02 | "⚠ {N} dropped" warning (when `report.dropped > 0`) | DATA | SOURCE — what was dropped and why | UNVERIFIED | **A2/A4 FAIL likely**: warning shown but no drill to see WHICH consequences dropped. User has to trust opaquely. FUNCTIONAL |

### Region 7 — DecisionTree renderer (`components/DecisionTree/index.jsx`)

#### 7.1 — Compound event chips (L23-46)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| DE-TREE-01 | Compound chip — event ID (e.g. "buy second home") | DATA | NA (display) | UNVERIFIED | A5: `id.replace(/_/g, ' ')` — raw event ID with underscores stripped. Likely not plain-English (e.g. "iht planning" instead of "IHT planning"). FUNCTIONAL |
| DE-TREE-02 | Chip × (remove) button (only when >1 event) | ACTION | re-runs tree without that event | UNVERIFIED | A2: `onDropEvent(id)`; verify re-run actually fires |

#### 7.2 — Decision header (L160-183)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| DE-TREE-03 | Decision question heading (`tree.decision`) | DATA | NA | UNVERIFIED | A5/FD-NAME-1: tree text is LLM-generated — verify no Caelixa/Finio/FQ Score string drift; verify plain-English |
| DE-TREE-04 | Contextual statement (`tree.statement`) | DATA | NA | UNVERIFIED | A5/A6: must bind to user's actual financials; check via `composer.js` what context is injected |
| DE-TREE-05 | "COMBINED IMPACT" band + `tree.compoundStatement` (when isCompound) | DATA | NA | UNVERIFIED | A5: only visible when >1 event; A6: figures must reconcile to engine |

#### 7.3 — Status badges (L186-207)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| DE-TREE-06 | "Engine-pure ✓" badge (when `_validation.dropped === 0`) | DATA | NA | UNVERIFIED | A5: phrase "engine-pure" again — internal jargon. POLISH→FUNCTIONAL |
| DE-TREE-07 | "⚠ {N} consequences dropped" badge | DATA | NA | UNVERIFIED | Duplicate-ish of DE-VAL-02 — A6: same number shown twice; reconcile |
| DE-TREE-08 | "Partial confidence" badge (when `_partialConfidence`) | DATA | NA | UNVERIFIED | A5: doesn't say WHY partial. No drill |

#### 7.4 — Deadline chips (L48-68)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| DE-TREE-09 | Deadline chip — conflict.with + " — {days}d" | DATA | SOURCE — deadline detail | UNVERIFIED | A2: not clickable; should drill to which event/deadline. A6: `daysRemaining` must reconcile to a date engine, not hardcoded |
| DE-TREE-10 | Deadline chip colour — red <90d, gold <365d, grey ≥365d | DATA | NA | UNVERIFIED | A5: colour semantics not explained |

#### 7.5 — Conflict bands (L70-96)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| DE-TREE-11 | High-severity conflict band (rendered above options) | DATA | NA (descriptive) | UNVERIFIED | A2/A4: not clickable; potentially should be a drill |
| DE-TREE-12 | Medium/low-severity conflict bands (rendered below options) | DATA | NA | UNVERIFIED | A4: placement split is intentional but undocumented to user |
| DE-TREE-13 | Cross-conflict badge `(eventA × eventB)` when `conflict.between` is array | DATA | NA | UNVERIFIED | A5 |
| DE-TREE-14 | Severity uppercase label (`HIGH` / `MEDIUM` / `LOW`) | DATA | NA | UNVERIFIED | A5: technical labels |

#### 7.6 — Options grid (L218-235) — FD-DE-1 4-option pattern

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| DE-OPT-00 | Options grid container — `mainOptions = options.filter(o => o.id !== 'D')` | DATA | NA | UNVERIFIED | **FD-DE-1 enforcement**: must be exactly A/B/C (3 main) + D (unconsidered) = 4 total. Trees with 2 or 5+ violate the pattern. DEMO-BLOCKING if violated |
| DE-OPT-01 | OptionCard — Option A (typically recommended) | ACTION | DECISION — expand / commit / save | UNVERIFIED | See sub-rows DE-OPT-CARD-* below |
| DE-OPT-02 | OptionCard — Option B | ACTION | DECISION — expand / commit / save | UNVERIFIED | |
| DE-OPT-03 | OptionCard — Option C | ACTION | DECISION — expand / commit / save | UNVERIFIED | |
| DE-OPT-04 | "+ Show the option you didn't think of" toggle (when D exists or `tree.unconsidered` exists) | ACTION | reveals OptionCard D OR static unconsidered block | UNVERIFIED | A2: `setShowUnconsidered(true)`; A4: irreversible toggle, no collapse-back path |
| DE-OPT-05 | OptionCard — Option D (Unconsidered Path, when present) | ACTION | DECISION — same actions as A/B/C | UNVERIFIED | Dashed border per OptionCard L52 |
| DE-OPT-06 | Static unconsidered block (legacy `tree.unconsidered` shape, when no D OptionCard) | DATA | NA | UNVERIFIED | A2: not actionable — divergence from D OptionCard. FUNCTIONAL: two shapes for the same concept |

#### 7.7 — OptionCard internals (`OptionCard.jsx`) — applies to A/B/C/D

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| DE-OPT-CARD-01 | Letter badge (A/B/C/D) | DATA | NA | UNVERIFIED | A5 ok |
| DE-OPT-CARD-02 | "RECOMMENDED" pill (when `option.id === tree.recommendation.pathId`) | DATA | NA | UNVERIFIED | A6: must reconcile with `tree.recommendation` block (DE-TREE-22) |
| DE-OPT-CARD-03 | "UNCONSIDERED PATH" pill (when `isUnconsidered`) | DATA | NA | UNVERIFIED | A5 |
| DE-OPT-CARD-04 | Irreversibility pin — Reversible / Semi-reversible / Hard to reverse | DATA | NA | UNVERIFIED | A5/A6: colour map (teal/gold/coral) consistent with rest of UI; verify |
| DE-OPT-CARD-05 | Option name | DATA | NA | UNVERIFIED | A5/FD-NAME-1: LLM-generated; brand-drift risk |
| DE-OPT-CARD-06 | Collapsed rationale (sliced to 100 chars + "…") | DATA | NA | UNVERIFIED | A4: truncation may cut mid-sentence; verify ellipsis quality |
| DE-OPT-CARD-07 | Expand chevron `▾` (rotates on toggle) | ACTION | toggles expanded state | UNVERIFIED | A2 |
| DE-OPT-CARD-08 | Consequence chip — metric label | DATA | NA | UNVERIFIED | A5 |
| DE-OPT-CARD-09 | Consequence chip — value (`c.value`) | DATA | SOURCE — engine calc | UNVERIFIED | **FD-DE-2 critical**: every value must trace to engine via validator; hardcoded values = DEMO-BLOCKING |
| DE-OPT-CARD-10 | ConfidenceChip — "engine ✓" pill (when `c.engineValidated`) | DATA | NA | UNVERIFIED | A5: "engine ✓" — concise; ok-ish |
| DE-OPT-CARD-11 | ConfidenceChip — percentage % (when not engine-validated) | DATA | NA | UNVERIFIED | A5: meaning of "67%" — confidence in what? Needs tooltip/drill |
| DE-OPT-CARD-12 | Expanded full rationale | DATA | NA | UNVERIFIED | A5/A6 |
| DE-OPT-CARD-13 | "For" (pros) list | DATA | NA | UNVERIFIED | A5: LLM-generated bullets |
| DE-OPT-CARD-14 | "Against" (cons) list | DATA | NA | UNVERIFIED | A5: LLM-generated bullets |
| DE-OPT-CARD-15 | "Sequence" numbered step list | DATA | NA | UNVERIFIED | A5/A6: action verbs; should reconcile to real flows. A4: steps don't link to where to do them |
| DE-OPT-CARD-16 | "Risks" bulleted list | DATA | NA | UNVERIFIED | A5 |
| DE-OPT-CARD-17 | "Before committing" sub-decisions panel | DATA | DECISION — opens another DE tree? | UNVERIFIED | **A2/A4 critical**: each sub-decision has `{id, q}` shown as plain text — NOT clickable. Should probably spawn a child tree. FUNCTIONAL |
| DE-OPT-CARD-18 | "Commit to this path" button | ACTION | DECISION — `orc.commit(pathId)` → returns planId, closes screen with `{committed: true, planId, pathId}` | UNVERIFIED | A4: where does the caller route on commit? Verify it lands on the plan view (Timeline plan strip / "Set plan" destination) |
| DE-OPT-CARD-19 | "Save as scenario" button | ACTION | DECISION — `orc.saveScenario(pathId)` → returns draftId, closes screen | UNVERIFIED | A4: where do saved scenarios live? Likely Timeline scenarios or a draft list. Verify the destination exists |

#### 7.8 — Tail elements (L284-322)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| DE-TREE-22 | "SONUSWEALTH PERSPECTIVE" recommendation band + rationale | DATA | NA | UNVERIFIED | A5/A6: must echo recommended option (DE-OPT-CARD-02). FD-NAME-1: label uses correct casing — verify |
| DE-TREE-23 | "ADVISER REVIEW SUGGESTED" CTA (when `tree._adviserCTA.show`) | DATA | NA (info-only, FCA boundary) | UNVERIFIED | A4: no link/route — by design (info/guidance/storage stance, per memory). Verify copy doesn't direct to a broker |
| DE-TREE-24 | "Sources ({N})" toggle | ACTION | expands sources list | UNVERIFIED | A2: `setOpen(o => !o)`; chevron rotates |
| DE-TREE-25 | Sources list — `[rules-uk.js]` items (teal) | DATA | NA | UNVERIFIED | A6: verify the cited fact actually exists in current rules-uk.js |
| DE-TREE-26 | Sources list — non-rules items (gold) | DATA | NA | UNVERIFIED | A5: unclear what gold means; needs legend |
| DE-TREE-27 | FCA disclaimer footer — "Not regulated financial advice — verify with a qualified FCA-authorised adviser before acting." | DATA | NA | UNVERIFIED | A5: present per FCA boundary requirement (memory: info/guidance/storage not sales). Must appear on every tree |
| DE-TREE-28 | Empty-tree fallback ("No decision tree to display.") | DATA | NA | UNVERIFIED | A4: should never be reached if FSM is correct; if shown, it's a state-machine bug |

### Region 8 — Follow-up panel (`FollowUpPanel`, L106-150)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| DE-FU-01 | "Round {N} of 3 — a few more details" header | DATA | NA | UNVERIFIED | A5: "3" is hardcoded max-rounds; reconcile to follow-up.js config |
| DE-FU-02 | Question label (per question) | DATA | NA | UNVERIFIED | A5/A6: LLM-generated |
| DE-FU-03 | Text input (per question) | ACTION | captures answer | UNVERIFIED | A2: free-text only; no typed inputs (number, select) — may be a limitation for £ answers |
| DE-FU-04 | "Refine tree" button | ACTION | DECISION — `orc.answerFollowUp(...)` → re-runs tree | UNVERIFIED | A2: disabled until all answers filled |
| DE-FU-05 | Behaviour after 3 rounds (no more follow-up offered) | DATA | NA | UNVERIFIED | Verify there is a graceful end-state, not infinite-loop UI |

### Region 9 — Entry points / cross-screen reconciliation

**RECONCILE: all source screens.** Every What-If launched from Home / MyMoney / Cashflow / Tax & Estate / Timeline must reach the DE tree with 4 time-projected options bound to current financials. Auditor walks each source.

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| DE-ENT-01 | Entry — HomeScreen "Ask any life question" → opens DE with empty `initialQuery` | NAV | DE idle state | UNVERIFIED | RECONCILE: Home |
| DE-ENT-02 | Entry — `Ask.jsx` when `intent === 'act' \| 'model'` → DE with `initialQuery` set | NAV | DE auto-runs with caller's query | UNVERIFIED | RECONCILE: Ask; verify intent classifier hands off cleanly; verify no silent bypass that lands on Ask answer instead of DE tree |
| DE-ENT-03 | Entry — What-If cinema chip → DE with `initialEventIds: [eventId]` | NAV | DE auto-runs, skipping ontology match | UNVERIFIED | RECONCILE: Home H-OVL-02; FD-DE-1 — must produce 4 options; verify time-projection visible |
| DE-ENT-04 | Entry — MyMoney drill (e.g. "Start drawdown" action) | NAV | DE for drawdown event | UNVERIFIED | RECONCILE: MyMoney; per FD-CROSS-1 drawdown lives on Cashflow but option-weighing belongs here |
| DE-ENT-05 | Entry — Cashflow drawdown method comparison | NAV | DE for drawdown event | UNVERIFIED | RECONCILE: Cashflow |
| DE-ENT-06 | Entry — Tax & Estate gifting / trust / will actions | NAV | DE for `setup_trust` / `iht_planning` etc. | UNVERIFIED | RECONCILE: T&E |
| DE-ENT-07 | Entry — Timeline scenario edit / plan creation | NAV | DE for relevant event | UNVERIFIED | RECONCILE: Timeline |
| DE-ENT-08 | Exit — `onCommit` → `{committed, planId, pathId}` returns to caller | NAV | Caller's plan view (Timeline?) | UNVERIFIED | A4: caller must land on a coherent surface that shows the new plan, not just close the modal |
| DE-ENT-09 | Exit — `onSaveScenario` → `{saved, draftId, pathId}` returns to caller | NAV | Caller's scenarios list | UNVERIFIED | A4: where do draft scenarios appear in UI? |
| DE-ENT-10 | Exit — `onClose({cancelled: true})` (header back arrow) | NAV | Caller's previous surface | UNVERIFIED | A4 |

---

## SEED FINDINGS (pre-identified — agents start with these, then extend)

| Seed | Element(s) | Issue | Likely severity |
|------|-----------|-------|-----------------|
| S-01 | DE-CHR-03 | Header subtitle "60 life events · engine-pure · FCA-compliant" leaks builder jargon ("engine-pure") into the user surface. Plain-English fail. | FUNCTIONAL |
| S-02 | DE-ERR-01 | "API key not configured — set VITE_ANTHROPIC_KEY in .env.local" is a developer message shown to end-users. End-users cannot set env vars. | DEMO-BLOCKING |
| S-03 | DE-ERR-04 | `tree-generator.js` reads `VITE_ANTHROPIC_API_KEY \|\| VITE_ANTHROPIC_KEY`, but the user-facing error tells them to set `VITE_ANTHROPIC_KEY` only. Mismatched variable names. | FUNCTIONAL |
| S-04 | DE-ERR-02 / DE-ERR-03 | Raw Claude API errors (`Claude API 429: rate_limit`, AbortError, network failures) surfaced verbatim with no retry CTA, no fallback, no plain-English translation. | DEMO-BLOCKING |
| S-05 | DE-OPT-00 / DE-OPT-04 / DE-OPT-05 | FD-DE-1 4-option pattern (A/B/C + D unconsidered) is filter-based (`o.id !== 'D'`). Nothing enforces that the tree actually returns exactly A/B/C/D. Tree with 2 options or 5+ flat options renders silently. | DEMO-BLOCKING |
| S-06 | DE-OPT-06 | Two divergent shapes for "unconsidered": OptionCard D (full card) vs `tree.unconsidered` (read-only block with just `name` + `why`). The fallback path bypasses commit/save buttons — FD-DE-1 violation when it triggers. | FUNCTIONAL |
| S-07 | DE-OPT-CARD-09 | Engine reconciliation depends entirely on `validator.js` dropping bad consequences and the renderer trusting `c.engineValidated`. If validator misses a hardcoded number from Claude, it renders as truth. Auditor must spot-check several trees and confirm every £/% appears in `rules-uk.js` or `fq-calculator.js` output. | DEMO-BLOCKING |
| S-08 | DE-OPT-CARD-17 | "Before committing" sub-decisions are rendered as static prose. They are *decisions* and should spawn child DE trees on click. Currently dead. | FUNCTIONAL |
| S-09 | DE-VAL-02 / DE-TREE-07 | Dropped-consequences count shown twice (validation summary strip + status badge) with no drill to see *which* consequences were dropped. User must trust opaquely. | FUNCTIONAL |
| S-10 | DE-IDLE-05 | Starter chip text "before April 2027" is hardcoded; the SIPP-IHT effective date sits in `rules-uk.js` (memory notes ENACTED 2026, effective Apr 2027). If rules-uk.js changes, this chip drifts silently. | POLISH→FUNCTIONAL |
| S-11 | DE-TREE-01 | Compound event chip label is raw event ID with underscores replaced by spaces (`iht_planning` → "iht planning"). Lowercased, no acronym handling. Plain-English fail. | FUNCTIONAL |
| S-12 | DE-IDLE-04 / DE-IDLE-06 | Starter chip "retire in 3 years" and "going part-time" must produce time-projected options (per FD-DE-1 + Home seed S-11). Verify the generated tree shows the 3-year path, not static A/B/C. | DEMO-BLOCKING |
| S-13 | DE-ENT-02 | Ask intent classifier hand-off to DE: verify intent === 'act' \| 'model' actually routes here. Risk of "Ask Sonu" silently answering a decision-shaped query without spawning the DE tree (bypass per founder reminder). | DEMO-BLOCKING |
| S-14 | DE-TREE-03 / DE-OPT-CARD-05 / DE-OPT-CARD-13 / DE-OPT-CARD-14 | LLM-generated tree prose may contain brand drift (Caelixa / Finio / FQ Score). FD-NAME-1 requires every user-facing string to be `Sonuswealth`; no post-generation sanitiser is visible in `tree-generator.js` or `fca-rewrite.js`. Audit must grep tree outputs from `_smoke.mjs` or a sample run. | DEMO-BLOCKING |
| S-15 | DE-CHR-04 | "Cancel" button calls `orc.cancel()` which is wired to AbortController. Verify the in-flight fetch actually aborts (no API-cost leak) and the FSM cleanly returns to IDLE. | FUNCTIONAL |
| S-16 | DE-OPT-CARD-18 / DE-OPT-CARD-19 / DE-ENT-08 / DE-ENT-09 | Commit and Save callbacks return `planId` / `draftId` but DE itself does not show the user what happens next. The caller is responsible. Risk: caller closes the modal and lands the user back on the source screen with no acknowledgement; no Timeline plan-strip update visible. A4 coherence fail. | DEMO-BLOCKING |
| S-17 | legacy `src/screens/DecisionEngine.jsx` | Original 9-step property wizard still on disk. V2 is current per docstring. Auditor should grep for any remaining import of the legacy file; if found, route the import to V2 or remove the legacy file. Code-hygiene only — not user-visible unless a stale entry point still loads it. | POLISH (DEMO-BLOCKING if still routed) |
| S-18 | DE-TREE-04 | `tree.statement` claims to be bound to "your financial picture" — verify `composer.js` actually injects entity context (NW, age, dependants, current pension/ISA, etc.) and not just the event ID. If the prompt is generic, every user sees the same tree for the same event. | DEMO-BLOCKING |
| S-19 | global | API key memory: live `VITE_ANTHROPIC_KEY` found in retirewise prototype (per memory `project_api_key_rotation_needed.md`). Even though `tree-generator.js` is read-only here, the key needs rotation. Out-of-audit-scope but flagged for the dev-ops sweep. | DEMO-BLOCKING (security) |
| S-20 | DE-FU-03 | Follow-up answers are free-text strings only. £ figures or yes/no flags get coerced through string parsing in `follow-up.js`. Verify follow-up.js handles "around £50k" / "fifty thousand" / "50000" gracefully. | FUNCTIONAL |

---

## COVERAGE MATH (this replaces "99% confident")

Total inventory rows: 67 (Region 1: 5 · Region 2: 9 · Region 3: 8 · Region 4: 4 · Region 5: 5 · Region 6: 2 · Region 7.1: 2 · Region 7.2: 3 · Region 7.3: 3 · Region 7.4: 2 · Region 7.5: 4 · Region 7.6: 7 · Region 7.7: 19 · Region 7.8: 7 · Region 8: 5 · Region 9: 10).

```
Coverage  = (rows with verdict ≠ UNVERIFIED) / (total rows)
Pass rate = (rows PASS) / (rows PASS + rows FAIL)
```

A pass is **complete** only when Coverage = 100% (every row has a verdict).
The audit **terminates** per the runbook stopping rule — not at a round number.
"99% confident" is only a legitimate claim when Coverage = 100% and it is restated as:
*"X of Y rows verified PASS; Z FAIL, all POLISH-severity and backlogged."*

---

*— end decision-engine-screen-element-inventory-v1.md —*
