# CAELIXA — CLAUDE CODE PROJECT FILE

> **Read this file before doing anything.** It is auto-loaded into every Claude Code session in this repo. It is the operating contract for every agent — human or AI — that touches this codebase.

---

## §0 — HARD GATE BEFORE ANY UI / SCREEN EDIT

**You are forbidden from editing any file under `src/screens/` or `src/components/` until you have done ALL of the following in the current conversation. No exceptions. The founder has had to reopen the same conversations to point at the same gaps. Stop doing that.**

### §0.1 — Read these files FIRST, in this order, in full:

1. `C:/Users/Powernet/.claude/projects/g--My-Drive-All-Work-6-Finio-1-Clusters/memory/MEMORY.md` — index of every memory
2. `C:/Users/Powernet/.claude/projects/g--My-Drive-All-Work-6-Finio-1-Clusters/memory/feedback_read_prior_first.md` — the rule that you are breaking right now if you skip this
3. `C:/Users/Powernet/.claude/projects/g--My-Drive-All-Work-6-Finio-1-Clusters/memory/feedback_screen_work_audit_first.md` — audit-before-fix protocol
4. `C:/Users/Powernet/.claude/plans/` — read the most-recent plan file relevant to the screen you're touching. Currently active:
   - `i-going-to-say-fuzzy-turing.md` — Phase 2 plan + wow list
   - `mymoney-checklist.md` — MyMoney requirements ledger (tick state)
   - `dynamic-crunching-wall.md` — historical founder direction
   - `sonuswealth-handover-2026-05-11.md` — operating discipline rules
5. The canonical spec file for the screen — `g:/My Drive/All Work/6.Finio/1-Clusters/2-Product/2-Product-<screen>-v<latest>.md`
6. **Cite at least 3 of these files in your first substantive response** so the founder knows you read.

### §0.2 — Audit-before-fix protocol:

Reactive QA is forbidden. "Fix what you pointed at and stop" wastes the founder's time. The protocol is:

1. Run the screen's snap script (e.g. `node scripts/snap-mymoney-rebuild.mjs`).
2. **Read the snap yourself.** Look at it as if you were a user, not the engineer who built it.
3. **List 10+ self-found issues.** Mix structural (info hierarchy, redundancy, missing context) with cosmetic (contrast, spacing, copy). Include things the founder did NOT point at.
4. **Cross-check vs the active plan's wow list.** What was planned? What shipped? What is still flat? Name each gap.
5. **Identify what would be NEW content** — beyond spec, beyond fix. At least one candidate "today's move / cost of inaction / freedom date / cross-tile interaction" idea per session.
6. Surface the audit list, wow gap, and new content idea to the founder BEFORE editing. Get a yes/no per item.
7. Only then start editing.

### §0.3 — No engineering-speak in user-facing strings:

Run this match-and-refuse on every string you write:

- ❌ "AA Headroom" → ✅ "pension room"
- ❌ "RNRB qualifying" → ✅ "outside IHT up to £175k extra"
- ❌ "S24 mortgage relief restricted" → ✅ "20% tax credit only on interest"
- ❌ "Section C · Balance sheet" → ✅ "Composition · Balance sheet"
- ❌ "D-WRAPPER-FIRST-1" → ✅ no spec code ever appears in UI
- ❌ "Tap to filter" → ✅ either visual affordance or no caption
- ❌ Engineering-bracket reference codes like (UK-IT-19), (MM-2), (§3.4) in user-facing prose

Specs use codes. The UI doesn't.

### §0.4 — Invoke the impeccable skill for UI work:

When the founder asks you to work on a screen, **before editing**, invoke:

```
Skill: impeccable
Command: audit <screen-name>
```

The skill has formal gates (context → product → command → shape → image → mutation). Use it. Don't shortcut.

### §0.5 — Every screen must surface its REASON FOR BEING

Every primary screen (Home · MyMoney · Cashflow · Tax & Estate · Risk · Timeline · Ask) has a canonical purpose statement in its `2-Product-<screen>-v<latest>.md` spec, usually in §1.1. The screen MUST render this statement visibly at the top, in plain English, so a first-time user knows why this tab exists in one sentence.

Canonical purpose lines (from current specs):

| Tab | Purpose (from spec §1.1) |
|---|---|
| MyMoney | "What do I own, what do I owe, and what comes in?" (v2.7 §1.1) |
| Cashflow | "Will my money last?" (canonical X25 purpose) |
| Tax & Estate | "What will I owe the taxman, and what will I leave behind?" |
| Risk | "How resilient am I to shocks?" |
| Timeline | "Where am I heading — and what changes if I act?" |
| Home | "Where do I stand right now?" |

If a screen doesn't render its purpose, fix it. If the canonical purpose isn't in the spec, ASK the founder before guessing. Brand tagline ("Intelligence without the noise") is NOT a substitute — that's the company line, not the tab's reason.

### §0.6 — Do not declare work "done" without:

- Running the snap script
- Reading the snap personally
- Self-listing 5+ issues found in your own output that you'd want fixed if you were the user
- Stating which planned wow moments shipped and which didn't
- A measured stop criterion (not "no console errors" — that's a build pass, not a quality pass)

---

## §1 — WHAT CAELIXA IS

Caelixa is a lifetime financial intelligence platform. It shows users their complete financial picture — assets, liabilities, scores, projections, tax exposure, estate planning — across their entire life. Trading entity: MBKR Limited.

**May 20 directive (binding):** Full first-version build by **20 May 2026**. No scope cuts. No deferral. No "ships later" tables. Every spec section in every v1.3 (or higher) per-tab spec is in scope. Time is a constraint, not a suggestion.

---

## §2 — REPO LAYOUT

```
/Users/MP/Desktop/finio/
├── CLAUDE.md                    ← you are here
├── BUILD-PLAN.md                ← RETIRED. Historical record of Waves 0–2.
│                                  Do not execute from it. Use per-tab specs +
│                                  AUTHORITY-MAP.md instead.
├── parts/                       ← SYMLINK to Google Drive Caelixa folder
│   ├── 0 Project/               founder skill, tracker
│   ├── 1-Foundation/            foundation, X28 design, AUTHORITY-MAP.md
│   ├── 2-Product/               per-tab specs (cashflow, home, mymoney, etc.)
│   ├── 3-Engine/                engine architecture, fixtures, schema
│   ├── 4-Operations/            tracker, batch plan, master remaining work
│   ├── 10-All Clusters/         architecture master, master backlog
│   ├── 100-Chat transfers/      session handovers, dated
│   └── 200 Project Updates/     SSR, folder-refresh changelogs
├── src/
│   ├── App.jsx
│   ├── index.css                design tokens — CSS variables
│   ├── engine/
│   │   ├── fq-calculator.js     financial engine — PROTECTED, EXTEND ONLY
│   │   ├── simulator.js         score simulator — PROTECTED, EXTEND ONLY
│   │   └── eventStore.js        Supabase event store adapter (D-EVENTSTORE-1)
│   ├── rules/                   tax bundles, life stages, personas
│   ├── components/              shared + per-tab sub-components
│   └── screens/                 one file per primary tab
├── tests/
└── package.json                 Vite + React, plain JavaScript (NOT TypeScript)
```

---

## §3 — SPEC AUTHORITY

Every spec frontmatter cites one or more authority documents (Foundation v1.8, Skill v1.3, Tracker v5.42, etc.). All of those files **exist** in this repo, but they live in `parts/200 Project Updates/` — not in the cluster folder their content family suggests. The cross-cutting content the specs depend on (X24 / X28 / X29 etc.) is canonical in foundation v1.8 §3.5; deeper engineering detail lives in the Architecture Master v1.3 and the X28 standalone design v1.1.

**The resolver is `parts/1-Foundation/AUTHORITY-MAP.md`.** Read it before acting on any authority citation. If a spec says "Foundation v1.8 §3.5.X24", AUTHORITY-MAP.md tells you to read `parts/200 Project Updates/finio-foundation-v1_8.md` §3.5.X24 (primary) plus arch master §32 (supplementary). If a citation is not covered by AUTHORITY-MAP.md, stop and flag — do not fabricate.

**Order of precedence when sources conflict:**
1. Per-tab spec at its current version (v1_3 or higher) — the construction contract for that tab
2. Foundation v1.8 — cross-cutting authority for X1–X29 + strategic / persona / life-stage
3. Architecture master v1.3 — supplementary engineering detail for X1–X29
4. X28 design v1.1 — deepest engineering contract for temporal views; supersedes arch master §36 where they disagree
5. Skill v1.3 — operating discipline (challenge-first, collision-recovery, Phase 0)
6. Older versions — audit-retained only; do not build from these

---

## §4 — NAMING (D-NAME-1)

The product is **Caelixa**. The score is **Caelixa Wealth Score**. The risk score is **Caelixa Risk Score**.

| Banned in user-facing strings | Use instead |
|---|---|
| "Finio" (anywhere a user can see it) | "Caelixa" |
| "Finio Score" / "FQ Score" | "Caelixa Wealth Score" |
| "Risk Score" alone (ambiguous) | "Caelixa Risk Score" |
| `{{PRODUCT_NAME}}` placeholder | "Caelixa" (D-NAME-1 closed at v1.2) |

Filenames keep the historical `finio-` prefix where it already exists (`fq-calculator.js`, `finio-foundation-v1_2.md`). **Do not rename files** to "caelixa-". This is a deliberate split between filename history and user-facing brand.

---

## §5 — STATUS VOCABULARY (six states · "built" is banned)

Every spec, plan, agent report, and commit message uses exactly one of these six states. The word "built" is **banned** because it conflates four distinct states.

| State | Meaning | Where it applies |
|---|---|---|
| **DOCUMENTED** | Spec exists at a versioned form. No code yet, or code does not yet match the spec. | Per-tab specs, design docs |
| **CODED** | Code matches the DOCUMENTED spec for the surface in question. Builds without errors. Renders. Not yet wired into integrations. | Per-tab screen files, components |
| **INTEGRATED** | CODED + connected to its dependencies (engine, sibling tabs, event store, auth). End-to-end paths work. | Cross-tab flows, end-to-end journeys |
| **PRODUCTION** | INTEGRATED + deployed + live with real data + observed in use. | Vercel deploy, post-launch |
| **DECIDED** | A design or scope question is closed. Carries a D-tag. | Decisions log entries |
| **OPEN** | A design or scope question is unresolved. Carries an O-tag. | Open items log |

**Examples of correct usage:**
- "Cashflow §A waterfall is DOCUMENTED in v1.3, not yet CODED."
- "TripleAnchor is CODED and INTEGRATED across Home, Cashflow, and MyMoney."
- "PRC/PCC computation home — DECIDED at T&E, CF renders only."
- "Materiality threshold per life stage — OPEN (O-CF-X29-1)."

If you find yourself writing "built", stop and pick the right state.

---

## §6 — BANNED SHORTCUTS

These are non-negotiable. Every line of code must comply.

1. **Do not rebuild `fq-calculator.js`.** It is the financial engine. Extend at the bottom only. Never modify or rewrite an existing exported function. If a function does the wrong thing, add a new function alongside and migrate callers — do not edit in place. **Wave 1A exception (D-QUALITY-BAR-1):** the 9 X28 stubs at lines 1298+ marked "STUB: implement at s02a" are explicitly unblocked for stub-body-to-real-impl replacement. This is a one-time exception with founder go-ahead. The 7 chart-rendering function param expansions in Wave 1B remain strictly additive — new optional params with defaults, never modifying existing call shape.
2. **Do not hardcode tax rates, allowances, thresholds, band boundaries, growth assumptions, or SWR rates.** All come from the bundle JSONs (`src/rules/tax-2026.json`, CMA bundles when wired). If you write `325000`, you are doing it wrong.
3. **Do not rewrite `TripleAnchor`, `TimeWindowSelector`, `CostOfInactionStrip`.** They are shared. Every primary screen imports them. If you need new behaviour, extend the existing component or wrap it — do not fork. **Wave 1C exception (D-QUALITY-BAR-1):** `TimeWindowSelector` window-ID refactor (current IDs → X28 canonical) is an atomic in-place rename across engine consumers + UI callers + Cashflow.jsx state strings + tests in **one coordinated commit**. No shim-and-migrate pattern. No backward-compat aliases.
4. **`HomeV2.jsx` is superseded (D-HOMEV2-1, 4 May 2026).** HomeV2.jsx has been replaced by the radar component on `HomeScreen.jsx`. Home agents proceed normally on `HomeScreen.jsx` without a Jit coordination guard. **Exception:** the radar component within `HomeScreen.jsx` (rendered via `<DimensionRadar />` and adjacent compositions) remains Jit's domain — extend it through props (the existing `onWealthTap` / `onRiskTap` / `onNetWorthTap` pattern) or wrap it; do not modify its internals. If a Wave-1E Home task requires changes inside the radar component, escalate to founder before starting.
5. **Agents do not push to git or deploy.** Local commits are encouraged (atomic, per task, with the message format in §7). `git push` and Vercel deploys are founder-only actions — never run them, never propose them as a next step. If a commit needs to land remotely, hand it to the founder.
6. **Do not introduce a TypeScript file, a Next.js convention, a Tailwind class, or a CSS module.** This is plain JavaScript + Vite + React + CSS variables in `src/index.css`.
7. **Do not exceed 300 lines per component.** Split into sub-components if you do.
8. **Do not write inline financial calculations.** All math goes through engine functions. If the function doesn't exist, add a stub in `fq-calculator.js` with `// STUB: needs implementation` and import it.
9. **Do not use `eval()`, `Function()`, or `dangerouslySetInnerHTML` without explicit founder approval.**
10. **Do not log PII or financial values to the console in production builds.**
11. **Do not use `localStorage`, `sessionStorage`, `IndexedDB`, or any browser-local persistence as an event store, plan store, or financial-data store (D-EVENTSTORE-1, 4 May 2026).** The event store is **Supabase from Wave 1A onwards**. All `PLAN_COMMITMENT`, `LIFE_EVENT`, `DIFF_ACKNOWLEDGED`, `FORECAST_SNAPSHOT`, `BUNDLE_ACTIVATED`, and other event reads/writes go through `src/engine/eventStore.js` which wraps the Supabase events table per schema at `parts/3-Engine/3-Engine-supabase-event-store-schema-v1_0.md`. UI ephemera (collapsed/expanded card state, last-viewed-tab) may use sessionStorage; financial state may not.

---

## §7 — AGENT CONTRACT (every screen-builder agent)

Before writing a single line of code, every agent assigned to a per-tab screen must complete this checklist. **Refuse to start coding until every item is done.**

### Reading checklist (in this order)

1. Read `CLAUDE.md` (this file) in full.
2. Read `parts/1-Foundation/AUTHORITY-MAP.md` in full.
3. Read the per-tab spec at its current version (v1_3 or higher) **in full**, end to end.
4. For every authority cited in the spec frontmatter, resolve it via AUTHORITY-MAP.md and read the resolved file/section.
5. Read `src/engine/fq-calculator.js` to know which engine functions already exist. Note which the spec needs that don't yet exist.

### Walk-through checklist

For every numbered section of the spec (e.g. §3.1, §3.2, §3A, §3B, §4.1, …, §X28.1, §M3.1, etc.), state one of:

- **WILL-BUILD** — section is in scope this wave; describe the component(s) to be created.
- **KNOWN-STUB-ENGINE** — section depends on an engine function that is currently a stub; will render the UI surface and call the stub; flag the stub as needing real implementation.
- **NOT-THIS-WAVE** — section is out of scope for the current wave; explain why and what wave should pick it up. (Note: under the May 20 directive, the answer is almost never "not this wave" for a v1.3 spec section.)

Output the checklist as a markdown table before writing code. Founder reviews and approves before build starts.

### During the build

- Atomic commits, one per task. Commit message format: `[Wave-X][Agent-Y] §<spec-§>: brief change description`.
- Before editing an existing screen file, copy it to `backups/<screen>-<YYYYMMDD-HHMMSS>.jsx` first.
- Every Take-Action / data-write event includes `correlation_id` (uuid) per the event envelope.
- Numbers via `<Number />` primitive or `fmt()`; CSS via `var(--…)` tokens; no inline hex.

### After the build

- Run `npm run build` — must pass with zero errors.
- Walk through the spec section-by-section in the browser with at least Bruce Wayne and Hermione Granger personas. Confirm each WILL-BUILD section renders.
- Update the relevant tracker / handover / SSR file (see §9 below).

---

## §8 — MAY 20 DIRECTIVE (BINDING)

Demo on **20 May 2026**. Full first-version build of every per-tab v1.3 spec. No scope cuts. No "Phase 2" deferrals. No "ships later" tables in agent reports.

**What this means in practice:**
- The 95%+ of Cashflow v1.3 not yet CODED is in scope for this run.
- All cross-cuttings (X24 mode 3, X28 view modes + variance overlays + plan staleness, X29 six-layer diff, X25 purpose statements, X26 pride layer, X27 estate-readiness) must reach CODED before May 20.
- Engine stubs reach real implementation, not stay as placeholders.
- The Risk overlay reaches CODED (currently untracked in git).
- All five primary tabs reach INTEGRATED (cross-tab flows working) before May 20.

**What is not in scope for May 20:**
- PRODUCTION (live deploy with real users) — that is post-demo.
- Open Banking integration beyond manual entry — Phase 1.1/1.2 phasing in spec stands.
- Jurisdictions other than UK — UK-2026.1 only at demo.

**Quality bar (D-QUALITY-BAR-1, 4 May 2026):** First-round build target is **85–90% ready, not "demo-grade quick"**. Atomic refactors over shims. Configure properly over expedience. Time pressure does not lower the quality bar.

If a tradeoff arises between depth-of-feature and surface-coverage, founder decides — never the agent.

**Sequencing note (build order to May 20):**
1. **Cross-cuttings first.** X24 (goal-seek + "I want this different" affordance), X28 (4-mode view toggle, variance overlays, plan staleness card, plan commit flow), and X29 (six-layer diff layer + `--c-diff` token + DeltaChip / CausalityStripe / PulseRing components) land before per-tab depth pull-through. Every primary tab consumes them; building tabs first and bolting cross-cuttings on second produces rework.
2. **Engine real-impl in parallel.** The Wave-0 stubs (`goalSeek`, `commitPlan`, `planStaleness`, `varianceFor`, `diffSet`, `causalityChain`, `cashflowHealth`, `fundedRatio`, `probabilityOfSuccess`, etc.) get real implementations on a parallel track to the cross-cutting UI work. Engine and UI converge before any per-tab depth wave starts. **Event store is Supabase from Wave 1A onwards (D-EVENTSTORE-1) — no localStorage stub at any tier.**
3. **Per-tab depth pull-through after cross-cuttings + engine are stable.** Cashflow §A waterfall / bill calendar / surplus allocator, §B funded-ratio gauge / PoS / MC fan / G-K corridor / 5 scenarios, §C PRC/PCC / Reality Engine / efficient frontier; MyMoney L1/L2/L3 drill-downs; Tax & Estate full IHT + CoI + gift clock; Timeline trajectory + plan-builder; Risk overlay 5×5 cross-map + radar + protection-gap. Per-tab agents follow §7 reading + walk-through checklist before starting.
4. **INTEGRATION wave last.** Cross-tab event flows, correlation_id tracing, plan-vs-actual variance overlays end-to-end, persona walkthroughs (Bruce / Hermione / Tony / Fred & Wilma / Wonka). Reach INTEGRATED on all five primary tabs before May 20.

If steps 1–2 slip, freeze new per-tab work — depth without cross-cuttings is rework. Founder is the only one who can re-sequence.

---

## §9 — WHERE TO LOG

| Artefact | Location |
|---|---|
| Daily / session tracker entries | `parts/200 Project Updates/finiotracker-v5_42.md` (current; check 200 Project Updates/ for newer versions before writing) |
| Operating discipline / session protocol | `parts/200 Project Updates/finio-skill-v1_3.md` |
| Folder-refresh changelogs | `parts/200 Project Updates/finio-folder-refresh-changelog-v50.md` (current) |
| Session handovers (chat transfers, end-of-session notes) | `parts/100-Chat transfers/<MMDD>/` |
| Status snapshot reports (SSR) | `parts/200 Project Updates/` (alongside latest tracker) |
| Master remaining work | `parts/4-Operations/4-Operations-master-remaining-work-view-v1_0.md` |
| Decisions / open items log | inside the relevant per-tab spec, plus `parts/10-All Clusters/10-AllClusters-master-backlog-v1_8.md` (+ `v1_8-to-v1_9-patch.md`) |

**File location rule:** foundation, skill, tracker, and changelog files all live in `parts/200 Project Updates/` — not in `parts/1-Foundation/` or `parts/4-Operations/`, even though their content family suggests those folders. Always check `parts/200 Project Updates/` first when looking for the latest authority or operational file. See AUTHORITY-MAP.md §5.

---

## §10 — QUICK REFERENCE

| Need | File |
|---|---|
| Engine functions registry | `src/engine/fq-calculator.js` (current) + arch master v1.3 §30 (canonical queue) |
| Event store adapter | `src/engine/eventStore.js` (Supabase wrapper · D-EVENTSTORE-1) |
| Event store schema | `parts/3-Engine/3-Engine-supabase-event-store-schema-v1_0.md` |
| Design tokens | `src/index.css` |
| Tax rules bundle | `src/rules/tax-2026.json` (UK-2026.1) |
| Persona test data | `src/rules/personas/persona-{a..g}.json` |
| Authority resolver | `parts/1-Foundation/AUTHORITY-MAP.md` |
| Per-tab specs | `parts/2-Product/2-Product-{cashflow|home|mymoney|tax-estate|timeline|risk-layer|settings-master|onboarding}-v1_X.md` (use highest version) |
| Architecture master | `parts/10-All Clusters/10-AllClusters-architecture-master-v1_3.md` |
| X28 build plan | `parts/4-Operations/X28-build-plan-v1_1.md` (current; v1.0 audit-retained) |

---

## §11 — DECISIONS LOG (operating-contract level)

Decisions that affect this file directly. Spec-level decisions live in their per-tab spec or master backlog.

| ID | Date | Decision | Affects |
|---|---|---|---|
| D-NAME-1 | 2 May 2026 | Caelixa is the user-facing name. Filenames keep `finio-` prefix. | §4 |
| D-HOMEV2-1 | 4 May 2026 | HomeV2.jsx superseded by radar component on HomeScreen.jsx. Home agents proceed normally on HomeScreen.jsx; radar internals remain Jit's domain. | §6 bullet 4 |
| D-EVENTSTORE-1 | 4 May 2026 | Supabase event store from Wave 1A. No localStorage shortcuts at any tier. Schema at `parts/3-Engine/3-Engine-supabase-event-store-schema-v1_0.md`. | §6 bullet 11 · §10 quick reference |
| D-QUALITY-BAR-1 | 4 May 2026 | First-round build target 85–90% ready. Atomic refactors over shims. Time pressure does not lower the bar. TimeWindowSelector window-ID refactor is atomic in-place. fq-calculator.js Wave 1A stub-replacement is one-time founder-approved exception to the EXTEND-ONLY rule. | §6 bullets 1, 3 · §8 quality bar |

---

**Status:** CLAUDE.md is DOCUMENTED · maintained alongside AUTHORITY-MAP.md
**Last updated:** 2026-05-04 (D-HOMEV2-1 · D-EVENTSTORE-1 · D-QUALITY-BAR-1 patches applied)
