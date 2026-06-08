# Risk & Tax tab redesign — parallel-agent prompt pack

**Purpose:** drive the Risk and Tax & Estate tab redesigns in **two separate Claude Code sessions** (one VS Code tab each), to the standard set by the My Money / Cashflow / Decision-Engine work (June 2026). Each session owns ONE screen — they touch different files (`Risk.jsx` vs `TaxEstate.jsx`) so they run safely in parallel.

**How to use:**
1. Open two VS Code windows/tabs on `C:\Users\Powernet\Desktop\finio` (or run `claude` from the vault root — both work; paths below are absolute).
2. In tab 1 paste **§A (shared brief) + §B (Risk)**. In tab 2 paste **§A + §C (Tax)**.
3. Each session stages the work and STOPS between stages for you to find bugs (your standing rule).

> Cost note: two live sessions consume your plan's usage in parallel — no per-tab fee, but ~2× the burn. There is no way to "share" compute between them.

---

## §A — SHARED BRIEF (paste into BOTH sessions)

You are the **sonuswealth-product-architect** (one mind: Chartered Financial Planner + FCA compliance lead + data-viz specialist + UX director + systems architect). Invoke that skill. You are redesigning ONE screen of a UK wealth app (**Sonuswealth**, companion **Sonu**) to match the quality bar already hit on My Money, Cashflow, and the Decision Engine.

### Read FIRST (cite at least one line from each in your first substantive reply — this proves you read it)
1. `C:\Users\Powernet\Desktop\finio\0-Active\DEFINITION-OF-DONE.md` — the pass bar (5-field evidence string, §B snaps + tie-outs, §D money-surface lens checks).
2. The screen's canonical spec (full file, not first 400 lines) — path in §B/§C below.
3. The screen's checklist at `~/.claude/plans/{screen}-checklist.md` if it exists (ask the founder before creating one).
4. The existing screen component (path in §B/§C) — the React build is the structural truth where the spec is stale.
5. `~/.claude/plans/dynamic-crunching-wall.md` (locked principles PP-1…PP-10) and memory via `grep` in `C:\Users\Powernet\.claude\projects\G--My-Drive-All-Work-6-Finio-1-Clusters\memory\`.
6. The vault navigation: `g:\My Drive\All Work\6.Finio\1-Clusters\CLAUDE.md` §8 (before touching a screen) + §9 / §9.5 (done gates).

### What "good" looks like (lessons banked from the Decision Engine / Cashflow June 2026 work)
- **Plain English on every surface.** No raw jargon (PPR, §24, BPR, MPAA, DB→DC, CGT, IHT-as-acronym). Gloss the term in place; macOS principle — plain on the surface, the technical term in parentheses only where it aids recognition. Chip labels too ("In estate" → "Left in your estate").
- **Frame the job.** Every non-trivial surface states *what it is · why it matters · what you're trying to achieve* before the controls (the Decision Engine's "Objective banner" pattern). The user should never face options they don't understand.
- **Real, not fake.** No hardcoded display numbers. Every figure traces to an engine selector or the `TAX` bundle (`src/engine/_bundle.js` → `_buildTAX`). If you show a stress/projection, COMPUTE it from the user's data. A hardcoded "−£135,000" that's identical for every persona is the exact failure we just fixed.
- **Never hardcode UK tax figures.** Read from `TAX` (e.g. `TAX.ihtRate`, `TAX.nrb`, `TAX.pensionAA`). Check the `status` field (ENACTED/PROPOSED/ESTIMATED). SIPP-in-estate = ENACTED, effective April 2027.
- **Charts obey the charting law:** label both axes with units; show past + projection with a "today" divider; net rate (after charges/inflation) stated; uncertainty as 2–3 labelled scenario lines, never one confident line; nothing that implies infinite growth; two charts of the same quantity must tie out. Reuse `src/components/Decisions/DecisionCharts.jsx` (PathComparisonChart / BeforeAfterBar) and the Cashflow chart components where they fit.
- **Drillable to bedrock.** Every number drills: aggregate → components → per-item → the rule/assumption applied. A methodology receipt (rule + legal source + status + assumptions) is the gold standard — see `generateRecommendation().methodology` in `src/engine/decision-engine.js`.
- **FCA boundary on every money surface.** Information / guidance / storage — never advice, never execution, no product/provider endorsement, no lead-gen. No "you should". Where an action legally needs regulated advice (e.g. DB transfer, equity release), say so.
- **Dynamic for thousands, not tuned to one persona.** Degrade gracefully from sparse → rich data; only render categories the user HAS; honest empty states; handle DB-vs-DC, directors, NRI, retired-vs-accumulating. Test on **Bruce (`?demo=a`, decumulator)** AND **Mr T (`?demo=mrt-core`, accumulator/all-domain)**.

### Decision Engine integration (match what Cashflow/My Money got)
The Decision Engine is built and good (40 decisions, plain English, objective framing, real stress test, charts, 4-part commit). Your screen must surface the decisions it OWNS, the same way:
- A **"Decisions" tab in the X28TopBar** view-bar (`showDecisions` / `decisionsActive` / `onDecisions` props — see `Cashflow.jsx` ~line 1660 and `MyMoney.jsx`) that swaps content for the chip-style `DecisionDrawers` (`variant="chips"`).
- Wire `onOpenDecision` through to deep-link into `DecisionEngine` (`initialDecisionId`) — already plumbed in `Dashboard.jsx` (`openDecision`).
- Ownership is defined in `src/engine/decision-catalogue.js` `DECISION_CATEGORIES`: **Risk owns `protection`** (DE-19/20/21); **Tax owns `estate`** (DE-15/16/17/18/29). Do NOT duplicate decisions — reference the catalogue.

### Workflow (rigid)
1. **Read** (above) → cite.
2. **Audit the current screen** with the Preview MCP (server `caelixa-dev`, port 5173): screenshot at 3 viewports (375 / 768 / 1280) × light+dark, on Bruce AND Mr T. List ≥10 self-found issues before proposing. Use the `screen-audit` skill's six assertions.
3. **Brainstorm** the redesign (multi-round) → propose a staged plan → get founder sign-off on the plan + any conception-level forks (surface these as questions; never silently resolve "is this the right thing to build").
4. **Parallelise the isolated pieces** with sub-agents (new component files, per-item content for all relevant items) — NOT the integration file (the screen `.jsx`), which you edit yourself to avoid conflicts. Brief each agent precisely (FCA + plain-English + no-hardcoded-figures + British English) and REVIEW its output.
5. **Integrate + verify LIVE** yourself: drive the real React handlers via `preview_eval` element `.click()` (synthetic dispatch is unreliable; the +N "misroute" you might see is a `preview_click` coordinate artifact — verify with `.click()` + screenshot). Run numeric tie-outs (`preview_eval` DOM scrape) per CLAUDE.md §9.5 Gate 2.
6. **Stage + STOP.** After each stage: `npm run build` (from `C:\Users\Powernet\Desktop\finio` — cwd reverts to vault root, so `cd` first or you get ENOENT), 3×2 snaps, tie-outs, then **run the Visual-QA checklist `C:\Users\Powernet\Desktop\finio\0-Active\VISUAL-QA-CHECKLIST.md` — including its automated detector (§G) which MUST return zero issues at every viewport** — then STOP and report for the founder to find bugs. Do not chain stages without a stop. The recurring miss is *formatting* (clipped value labels, duplicated captions, overflow); the checklist exists specifically to catch it before the founder does.
7. Commit per stage; end commit messages with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

### Gotchas (banked)
- Dev server `caelixa-dev` already runs on 5173 (serverId `2e78c929-1edf-458c-9631-b5134967be55`); use `preview_list` to confirm, don't spawn a second.
- Routing source of truth is internal `tab` state, not the URL (`?tab=` is read only on load). Don't "fix" the URL desync — it's not a user-facing bug.
- HMR doesn't recompute a mounted `useMemo` — after engine edits, **reload** before reading values, or you'll see stale numbers.
- JSX `{/* comments */}` are stripped in transpile — grep served source for rendered strings, not comments.
- An open `moreScreen` overlay (e.g. Decision Engine) stays on top when you nav underneath; reload to clear during testing.

---

## §B — RISK TAB (paste with §A into tab 1)

**Screen:** Risk. **Route:** `/risk` (`?demo=mrt-core#/risk`). **Code:** `C:\Users\Powernet\Desktop\finio\src\screens\Risk.jsx`. **Spec:** `g:\My Drive\All Work\6.Finio\1-Clusters\0 Knowledge Base\Wiki\2-Product\2-Product-risk-layer-v1_6.md` (read in full). **Checklist:** `~/.claude/plans/risk-checklist.md` (if absent, ask before creating).

**Mission:** bring Risk to the My Money / Cashflow standard. It currently lags (founder: "Tax & risk tabs need redesigning altogether to match the mymoney and cashflow tabs"). Specifically:
- Match the chrome: X28TopBar with `showWindowRow={false}`, NO duplicated "Next year / UK tax" strip, the global tax-year chip only.
- Add the **Decisions tab** (Risk owns **Protection** — DE-19 life cover, DE-20 critical illness, DE-21 income protection) via `DecisionDrawers screen="risk" variant="chips"` + `onOpenDecision`.
- Risk score (7 dimensions per spec v1.6) must be plain-English explained, drillable to its inputs, and not radar-green-bugged.
- Protection gap analysis should be real (computed from the entity's cover vs need), with a chart, and FCA-safe ("information", not "you need £X of cover").
- Empty states for users with no protection (don't render empty cover tiles as if they exist).

**First reply must cite:** one line from the risk spec, one from DEFINITION-OF-DONE, one from `Risk.jsx`, and your ≥10-issue audit of the live screen on Bruce + Mr T.

---

## §C — TAX & ESTATE TAB (paste with §A into tab 2)

**Screen:** Tax & Estate. **Route:** `/tax` (`?demo=mrt-core#/tax`). **Code:** `C:\Users\Powernet\Desktop\finio\src\screens\TaxEstate.jsx`. **Spec:** `g:\My Drive\All Work\6.Finio\1-Clusters\0 Knowledge Base\Wiki\2-Product\2-Product-tax-estate-v1_6.md` (read in full). **Checklist:** `~/.claude/plans/tax-estate-checklist.md` (if absent, ask before creating).

**Mission:** the founder flagged Tax as the worst-off tab ("TAx tab is so wrong"). Bring it to standard:
- Fix the chrome: X28TopBar `showWindowRow={false}`, remove the duplicated tax-year strip, drop the bottom-stranded `DecisionDrawers` panel and instead add a proper **Decisions tab** (Tax owns **Estate, gifts & IHT** — DE-15 gifting, DE-16 trusts, DE-17 wills, DE-18 power of attorney, DE-29 charitable giving) via `DecisionDrawers screen="tax" variant="chips"` + `onOpenDecision`.
- The IHT picture must be real and drillable: NRB/RNRB/TNRB, the **April 2027 pension-in-estate flip** (ENACTED — read `TAX`, don't hardcode), gifts/PET taper, charity 36% rate. Show pre/post-2027 as a labelled comparison chart that ties out to `ihtDeltaPrePost2027(entity)`.
- CoI (cost of inaction) lives on T&E and Home reads it — verify the cross-screen contract (`§Q1.2` in the spec) still holds.
- Plain English throughout (this tab is the most jargon-dense: domicile, RNRB taper, BPR/APR, GWR). Gloss everything.

**First reply must cite:** one line from the tax-estate spec, one from DEFINITION-OF-DONE, one from `TaxEstate.jsx`, and your ≥10-issue audit of the live screen on Bruce + Mr T.

---

**Maintainer note:** this pack encodes the June 2026 Decision-Engine session lessons. If the architecture moves (X28 props, catalogue ownership, chart components), update §A.
