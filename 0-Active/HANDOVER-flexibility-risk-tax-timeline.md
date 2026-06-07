# HANDOVER — Flexibility/Interactivity/Drillability hardening: Risk · Tax & Estate · Timeline

**Status:** DOCUMENTED · **Date:** 2026-06-07 · **Author:** prior session (Cashflow + Choices hardening)
**Summary:** Paste-ready prompt for a new session to fire 3 parallel agents (one per tab) that apply the same "everything flexible, nothing hard-coded, drills to source, ties out, verified in pixels" treatment already done on Cashflow (/flow) and Choices (/decisions).
**Tags:** #handover #flexibility #risk #tax-estate #timeline
**Updated:** 2026-06-07

---

## PASTE THIS INTO THE NEW SESSION

You are orchestrating a 3-agent parallel build to harden three tabs of Sonuswealth — **Risk**, **Tax & Estate**, and **Timeline** — to the same bar a prior session already hit on **Cashflow (/flow)** and **Choices (/decisions)**. Read this whole brief, do the read-first order, then spawn 3 agents (one per tab) in parallel, then run a verification pass before declaring anything done.

### The principle the founder is enforcing (this is the whole point)
"**Everything on any screen should be flexible and not hard-coded.**" Every value the user could reasonably set must be **directly adjustable and visible** — a slider/control the user sees and grabs, not a figure that only *looks* fixed, not a control buried behind a tap/drawer, not a number tuned to a demo persona. The recurring failure this kills: a number reads as hard-coded because the control that drives it is hidden, far away, or absent. On Choices we made each comparison **bar itself a slider** (drag the bar). Do the equivalent wherever a displayed number is driven by an input.

Second principle (macOS): **simple surface, depth on tap.** Don't dump complexity on the top layer; make it drillable. But the *primary* drivers must be reachable and adjustable, not hidden.

### What "the work" concretely means per tab — apply ALL of these
1. **Audit from an inventory, not from examples.** Walk every interactive + data-bearing element on the tab (and its drill panels), row by row. The founder pointing at one thing is a symptom, not the scope. (Use the `screen-audit` skill methodology if available.)
2. **Make every input directly adjustable + visible.** Sliders/controls surfaced, not behind a tap. Where a bar/number is driven by a value, make it draggable in place (see reference components below). Nothing hard-coded to Mr T/Bruce.
3. **Every number ties out to the engine.** Same value + same format everywhere it appears; each figure traces to an engine selector or a named rule. NO hardcoded UK tax figures — read from the `TAX` bundle (`src/engine/_bundle.js` `_buildTAX`, exported via `src/engine/fq-calculator.js`). A wrong key silently returns NaN/fallback — this bug class has shipped before. **Also check display COPY for hardcoded tax** (e.g. "40% IHT" written into a sentence) — that's a known bug class.
4. **Drill to source / action / decision.** Every aggregate drills to its components → per-item holdings → per-holding facts + performance over time → the rule/assumption applied. A number that dead-ends before bedrock is broken.
5. **Charts obey the charting standard:** both axes labelled with units; show history *and* projection with a "today" divider; compound the NET rate (after charges/inflation) and state it; uncertainty as 2–3 labelled scenario lines or a range, never one confident line; nothing implying infinite growth (decumulating assets turn over); two visuals of the same quantity must reconcile (scrape both endpoints).
6. **FCA boundary:** information/guidance/storage, never advice. No "you should buy/sell/transfer", no named products, no lead-gen. Projections are "your assumption, not a forecast."
7. **Dynamic for thousands, not the demo:** degrade gracefully sparse→rich; honest empty states for a thing the user *has*; do NOT render a whole category the user holds nothing in. Test BOTH personas: **Mr T `?demo=mrt-core`** (director/accumulator) and **Bruce `?demo=a`** (decumulator).
8. **No fake interactivity.** If an affordance is wired but has no data path, label it "data pending" or remove it. Never label something "interactive" when it's dead.

### Per-tab assignments (one agent each)

**AGENT 1 — RISK tab**
- Spec (read in full): `0 Knowledge Base/Wiki/2-Product/2-Product-risk-layer-v1_6.md`. Checklist: `~/.claude/plans/risk-checklist.md` if it exists (don't create without founder sign-off).
- Screen file: find it (`src/screens/Risk*.jsx` or similar) + its chart/radar components. Route: discover via nav (likely `/risk`).
- Scope: 7-dimension risk layer, the 3-view toggle, the radar/spider chart, Risk Score, shock/stress trajectory, CMA assumptions, What-If. Make every assumption the user can hold (shock size, horizon, allocation) directly draggable; ranges not single lines; tie the Risk Score and every dimension to an engine selector.
- **Known bug to avoid:** the "radar-green" bug (memory `feedback_session_2026_05_13_mistakes.md`) — verify the radar renders real per-dimension values, not a flat green ring.

**AGENT 2 — TAX & ESTATE tab** (route `/tax`)
- Spec (read in full): `0 Knowledge Base/Wiki/2-Product/2-Product-tax-estate-v1_6.md`. Authority resolver: `1-Foundation/AUTHORITY-MAP.md`.
- Screen file: `src/screens/TaxEstate*.jsx` (+ trusts/protection/business sub-routes `/money/trusts`, `/money/protection`, `/money/business`).
- Scope: IHT projection (pre/post **April 2027** unused-pension-into-estate — SIPP IHT is now ENACTED, Royal Assent 18 Mar 2026, effective Apr 2027; memory `project_sipp_iht_enacted_2026.md`), Cost of Inactivity (CoI lives HERE; Home reads it — cross-tab tie-out), gifting/PET taper, trusts, BPR, estate waterfall, allowances (NRB/RNRB/taper). EVERY £ figure from `TAX` bundle + named-rule provenance ("Lump Sum Allowance, FA 2023" style). Make gift amounts, growth, time-to-death assumptions directly adjustable.
- **Known bug class:** hardcoded tax in display copy + TAX wrong-key → NaN fallback (memories `reference_tax_key_mismatch_pattern.md`, `project_temporal_drilldown_audit_2026_06_02.md`). Surface methodology/provenance to the user (memory `feedback_surface_methodology_to_user.md`).

**AGENT 3 — TIMELINE tab**
- Spec (read in full): `0 Knowledge Base/Wiki/2-Product/2-Product-timeline-v1_3.md`. Checklist if exists.
- Screen file: `src/screens/Timeline*.jsx`. Route: discover (likely `/timeline`).
- Scope: life-event timeline, the bill calendar (lives HERE per founder), milestone projections, drillable hero numbers. Make event dates/amounts and projection assumptions directly adjustable; hero numbers must drill.
- **Known P1 bug to FIX:** the forecast/projection on the temporal view GROWS debt (£410k→£606k) via **3 disagreeing projection models** — unify to one projection path. Hero numbers currently don't drill. (Memory `project_temporal_drilldown_audit_2026_06_02.md`, file `0-Active/temporal-drilldown-audit-2026-06-02.md`.)

### Reference exemplars — copy these proven patterns (do not reinvent)
- `src/screens/DecisionEngine.jsx`:
  - `BarSlider` — a horizontal bar that IS a slider (visual fill + thumb over a transparent native range; theme-var styled; drags in light/dark; keyboard-accessible).
  - `PropertyOptionsCompare` + `propertyBarDriver` / `propertyBarOutcome` / `propertySecondarySpecs` — pattern for "each option's own driver lives ON its bar, finer drivers as compact sliders beneath, live outcome on the right."
- `src/components/Decisions/DecisionCharts.jsx`:
  - `PathComparisonChart` with the `scrub` prop + `startScrub` + `BarGrip` — pattern for "options share ONE input: drag any bar (relative pointer-drag, no jump) to scrub the shared amount, all bars rescale, a labelled slider stays as the precise/keyboard control."
- Choose the right one per case: **per-option independent inputs → per-bar sliders** (PropertyOptionsCompare); **options sharing one input, differing in outcome → scrub bars** (PathComparisonChart `scrub`). Don't fake a per-bar value slider when the bar is an outcome of a shared input.

### Verification gates — MANDATORY before any "done" (CLAUDE.md §9.5)
Build-green + tests-green are necessary, NOT sufficient. Each agent MUST, before reporting complete:
1. Drive the preview MCP — server **caelixa-dev**, serverId **`888ef998-6cfa-426e-bf38-d59791399eb8`**, port 5173. (`mcp__Claude_Preview__preview_*`.)
2. Navigate to its tab for **both** personas. `preview_resize` mobile (375×812) / tablet (768×1024) / desktop (1280×800), toggle light + dark, `preview_screenshot` at each.
3. `preview_eval` to **drag every new control** and confirm the driven number changes independently (and isn't chained to the wrong input) — and to scrape DOM **numeric tie-outs** (the displayed figure == the engine value, and == the same figure on any other surface).
4. Write a `.snap-verdict-<tab>.md` in `0-Active/` with screenshot paths + per-acceptance-criterion yes/no + tie-out results.
- Build/test from `/c/Users/Powernet/Desktop/finio` (`cd` first — cwd otherwise reverts to the vault and ENOENTs): `npm run build`. Drive React via `.click()` + native-setter `input` dispatch in `preview_eval`. In-wizard "Back" goes back one step; reset by reloading `location.href` with a `&_t=<n>` cache-buster.

### Hard constraints (do not violate)
- **NEVER hardcode UK tax figures** — `TAX` bundle only; verify each key exists in `_bundle.js`.
- **Product is Sonuswealth / companion Sonu.** "Caelixa" or "Finio" in user-facing copy = regression. (`caelixa` package name + `finio-` file prefix are technical conventions — leave them.)
- **FCA:** information/guidance, never advice; no named products.
- **The calculation correctness audit is a SEPARATE, EXTERNAL, launch-blocking gate.** Agents fix STRUCTURE / UI / data-binding / display tie-out and may label engine output "PENDING PROFESSIONAL SIGN-OFF" — they do **not** certify the arithmetic. Flag any magnitude/sign that looks wrong for the external reviewer + golden vectors; do not guess a tax formula. (Memory `project_independent_calc_audit_required.md`.)
- **Don't pause for permission** on normal reads/writes/snaps/builds (founder pre-approved). Pause only for destructive ops or genuine product-conception forks — and for those, surface a recommendation, don't silently resolve.
- **Pushback-first / no glazing.** Lead with diagnosis + evidence, not validation.
- Commit messages (only if the founder asks to commit) end with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

### Orchestration
- Spawn the 3 agents **in parallel**, each with `isolation: "worktree"` (they may touch shared engine/component files — worktrees prevent collisions; unchanged worktrees auto-clean).
- Each agent returns: a severity-ranked findings register + the list of controls made flexible + tie-out evidence + screenshot paths + a BUILD-READY / NOT-READY verdict.
- After all three return, **you (orchestrator) run one verification pass per tab** (snap each route 3 viewports × 2 themes, re-run tie-outs, drag-test) before declaring done. If NOT-READY, re-brief that agent with the findings; don't ship on the agent's confident summary alone (confident summaries from agents that didn't open the screen are the exact failure mode §9.5 exists to stop).

### Read-first order (CLAUDE.md §1 + §8, before spawning)
1. Vault root `CLAUDE.md` (esp. §8 before-touching-a-screen, §9 done-gate, §9.5 phase gates), `hot.md`, `index.md`.
2. `SKILLS.md` — pick the right skill (this is `sonuswealth-product-architect` for money-surface convergence + `screen-audit` for inventory audit; don't reach for `/impeccable` as a substitute).
3. The per-tab 2-Product spec (full, not first-400-lines) + checklist + the per-tab known-bug memories named above.
4. Grep memory (`.../memory/`) and `~/.claude/plans/` for the tab before editing; cite at least one line per file you read in the first substantive response.

End of brief.
