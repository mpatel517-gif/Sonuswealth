---
Title: Sonuswealth Master Audit + Build Plan
Version: 1.0
Date: 2026-05-17
Status: OPEN
Cluster: 20 Auditing
File name: MASTER-AUDIT-PLAN.md
Purpose: One sequenced plan covering audit, fix, reconcile, and enhancement waves for every Sonuswealth surface — replacing all prior screen-by-screen half-baked attempts.
---

**Summary:** Single master plan for auditing, fixing, reconciling, and enhancing all 10 primary Sonuswealth surfaces using the v2 audit kit, with severity-first fixes and explicit stopping rules.
**Tags:** #audit #plan #cross-surface
**Updated:** 2026-05-17

---

## §0 Governing rules (locked this gate)

- **FD-NAME-1:** product name is **Sonuswealth**. Caelixa is the regression target — every occurrence is a FUNCTIONAL FAIL on A5/A6.
- **FD-CROSS-1 (NEW — supersedes FD-MM-2's "drill here only" wording):** every critical action is a **surface-instance**, not a pointer. Each surface presents the *angle it owns* with its own layout and its own data evidence; cross-surface links are explicit. One canonical surface owns *the doing*; the others own attention / consequence / time / cash-effect. Angles below.
- **FD-2 / FD-MM-1:** screen layouts frozen for the audit. "More info on Home" + "What-If per bucket" are post-audit build waves, not in-audit fixes.
- **No hardcoding:** every £/% figure traces to an engine fn or `rules-uk.js`. Hardcoded numbers = A6 FAIL = DEMO-BLOCKING.

### FD-CROSS-1 — angles per surface (example: pension drawdown)

| Surface | Owns | Layout/data shown |
|---|---|---|
| Home | Attention | Headline impact + one-tap entry; no panel |
| **My Money** | **The doing** | Full 5-method drawdown panel, pot sequencing, £/month |
| Tax & Estate | Consequence | IHT £ stacking over time, 6 Apr 2027 deadline, year-by-year |
| Timeline | Time | Countdown + dependent milestones |
| Cashflow | £/month effect | Monthly inflow change + tax withholding impact |
| Risk | Shock test | Drawdown survival under market downturn / sequence risk |

Same rule applies to every critical action (ISA top-up, CGT crystallisation, will, trust, protection, gifting). One canonical surface per action; others present their own angle with their own data.

---

## §1 Scope — primary surfaces (10) + deferred surfaces (6)

**Primary (in-audit):** Home · My Money · Cashflow · Tax & Estate · Risk · Timeline · Decision Engine · Data Capture · Settings · Reports

**Deferred (audited only when reached from a primary):** Ask Sonu · Notifications · Document Vault · Onboarding · IFA practice · Manual Input

The kit's 4-stage method scales per surface (each gets its own inventory + ledger). The deferred surfaces become priority in their own pass once primaries converge.

---

## §2 Waves (sequence, not simultaneity)

### WAVE 0 — Foundation flush (today, ~15 min)

- Commit uncommitted: `tree-generator.js` + `DecisionEngineV2.jsx` + screenshot drift.
- **Revert the Caelixa rename** in `HomeScreen.jsx` `DimExplainerStub` (commit `796e7a3`). Add to fix queue: codebase-wide Caelixa→Sonuswealth sweep via Morph in Wave 4.
- Update `home-inventory-v1.md` + `mymoney-inventory-v1.md` headers: add FD-CROSS-1, replace FD-MM-2 wording.
- Single commit.

### WAVE 1 — Stage A: build 8 missing inventories (parallel)

`inventory-builder` dispatched in parallel for: **Cashflow · Tax & Estate · Risk · Timeline · Decision Engine · Data Capture · Settings · Reports**, plus completes the My Money seed.

Output: 10 inventories at repo root. **Founder gate — eyeball each** (~10 min/screen × 10 = ~90 min). Stage B does not start on any screen until that screen's inventory is signed off.

Realistic clock: builder dispatch ~30 min wall (parallel), review ~90 min. **Wave 1 done end of day 1 if started midday.**

### WAVE 2 — Stage B pass 1: 5-auditor loop, all 10 surfaces parallel

For each signed-off inventory, dispatch all 5 auditors in parallel. Each writes to `audit-findings/<screen>/pass-1/<agent>.md`. Every finding keyed to an element ID.

Merge into `audit-ledger-<screen>-pass1.md`. Coverage must equal 100% per screen — re-dispatch on any UNVERIFIED rows.

**Output: the whole iceberg, ranked, across every surface.** No more "tip of the iceberg" anywhere.

Realistic clock: day 2, full day.

### WAVE 3 — Stage C: cross-screen reconciliation

Dispatch `reconciliation-auditor` in global mode. Build the full matrix: every shared value (Net Worth, Wealth Score, Risk Score, Cost of Inaction, dimension scores, deadlines) — same engine fn, same value, same `fmt()` format on every surface it appears.

Output: `audit-ledger-reconciliation.md`. Findings feed the Wave 4 fix queue.

Realistic clock: day 2 evening or day 3 morning.

### WAVE 4 — Fix wave, severity-first across all screens

Fixer (Morph for fan-out, main thread or `general-purpose` subagent for surgical edits) works the merged queue:

1. Every DEMO-BLOCKING across every screen first (blocker anywhere breaks the demo).
2. Then FUNCTIONAL by impact.
3. POLISH → `home-audit-backlog.md`.

Every fix cites the element ID it closes. Engine smoke tests + interaction smoke run after each batch. A fix that breaks a green test is reverted, not kept.

Morph usage: Caelixa→Sonuswealth sweep, `fmt()` normalisation, hardcoded-number replacements, signed-zero handling.
Exa/Firecrawl usage: verifying live FCA wording, current tax thresholds — `domain-auditor` invokes these inside its checks, not blanket.

Realistic clock: days 3–4.

### WAVE 5 — Stage B pass 2: re-audit fixed surfaces

Per the runbook stopping rule: **two consecutive passes with zero new DEMO-BLOCKING/FUNCTIONAL at 100% coverage**.

Hard cap 6 passes per screen. If a screen hits 6 with open DEMO-BLOCKING — STOP and escalate. A cap-hit means something structural is broken; more passes won't fix it.

Realistic clock: day 5. If pass 2 is clean per screen, that screen is done. Otherwise Wave 6.

### WAVE 6 — Iterate to convergence (if needed)

Repeat Wave 4 → Wave 5 per screen still open. Most screens should converge in 3–4 passes; Cashflow likely needs more.

### WAVE 7 — Post-audit enhancement queue (after convergence per screen)

Only after a screen has hit its stopping rule:

1. **Home** — "more info" build (FD-2 lifts here). Specific additions decided from the ledger's gap list, not freeform.
2. **Every primary surface** — "What-If per bucket" build. Each bucket (Balance Sheet, Property, Pensions, ISA, Cash, etc.) gets its own What-If button + scenario engine surface, per FD-CROSS-1.
3. **Cross-surface action wiring** — per FD-CROSS-1, every critical action surfaces on every relevant screen with its own angle/layout/data. Wire from the canonical surface outward.
4. **Deferred surfaces** — Ask Sonu, Notifications, Document Vault, Onboarding, IFA practice, Manual Input get their own Stage A → Stage B per the same method.

Realistic clock: days 6–10 minimum.

---

## §3 Stopping rule (per screen, locked)

Both must hold:

1. Two consecutive passes with zero new DEMO-BLOCKING + zero new FUNCTIONAL (POLISH-only allowed in the final pass).
2. Coverage = 100% on both.

Hard cap: 6 passes. Cap-hit escalates.

---

## §4 Honest timeline

| Wave | Day | What's delivered |
|------|-----|------------------|
| 0 | D0 (today) | Foundation flush — one clean commit, all FDs locked |
| 1 | D1 | 10 founder-reviewed inventories |
| 2 | D2 | **The whole iceberg ranked across all 10 surfaces** |
| 3 | D2 evening / D3 AM | Cross-surface reconciliation matrix |
| 4 | D3–D4 | All DEMO-BLOCKING closed, FUNCTIONAL closed by impact |
| 5 | D5 | Pass-2 verifications; most screens converge |
| 6 | D6–D7 | Iterate to convergence on stragglers (Cashflow likely) |
| 7 | D8–D14 | Enhancement waves: more-info-on-Home, What-If-per-bucket, cross-surface wiring, deferred surfaces |

**2 weeks to full convergence + the enhancements you asked for.** If anyone tells you 48 hours, they are about to ship half-baked again.

---

## §5 Plugin / tool policy

- **Morph (`mcp__morph-mcp__*`)** — Wave 4 fan-out edits (renames, fmt normalisation, hardcoded-number sweep). Not for surgical 1-line fixes.
- **Exa + Firecrawl** — `domain-auditor` invokes for live FCA wording, current Budget/tax thresholds, gilt rates. Output reconciles against `rules-uk.js`; if `rules-uk.js` is stale, that itself is a finding.
- **Caveman** — main-thread output compression only. No effect on what runs.
- **Sub-agents** — auditors run in parallel via Agent tool. Fixer runs as `general-purpose` for non-trivial fixes; main thread for simple edits.

---

## §6 What this plan refuses to do

- Mix audit + build in the same wave. Audit reports; Fixer fixes; Build builds. Separate gates, separate verifications.
- Skip the founder inventory review. The cheapest gate is the most valuable.
- Add components in Waves 0–6. FD-2 / FD-MM-1 are locked until Wave 7.
- Hardcode numbers anywhere. Every £/% via engine or `rules-uk.js`.
- Move on without 100% coverage per pass. "99% confident" only means *X of Y rows verified PASS*.

---

*— end MASTER-AUDIT-PLAN.md —*
