# Settings Screen — Scenario & What-If Audit (Pass 1)

**Auditor:** scenario-auditor (5 of 5)
**Date:** 2026-05-18
**Inventory:** `settings-inventory-v1.md` (99 rows)
**Component:** `src/screens/Settings.jsx` + `src/screens/Account.jsx`
**Method note (from orchestrator):** Settings has no classic what-if. Auditor evaluates (a) destructive-action previews ("if you delete… / if you export…") as quasi-scenarios, (b) feature-flag toggles that change product behavior, and (c) the Account.jsx FQ "preview." Most rows NA.

---

## §1 — Verdict table (scenario-relevant rows only)

Six tests per row: Present · Expandable · Multi-option · Actionable · Finances-bound · Time-projected · FCA framing. NA where not applicable.

| ID | Element | Time-projected | Actionable | Engine-bound | Severity | Finding | Evidence |
|----|---------|----------------|------------|--------------|----------|---------|----------|
| ST-PERS-03 | Theme pill toggle (Dark/Light) | NA | PASS | NA | NA | Behavior toggle, not a scenario. Visual preview is the live render — no projected state needed. | `Settings.jsx:847-870` `onThemeChange(next)` |
| ST-PERS-06 | Hide-balances toggle | NA | PASS | NA | NA | Behavior toggle. The "preview" is the screen itself once flipped — no horizon. Not a what-if. | `Settings.jsx:878-905` writes `sonus.settings.hideBalances` |
| ST-PLAN-04..06 | Longevity pills (85/88/92) | **FAIL** | PARTIAL | **FAIL** | **DEMO-BLOCKING** | This IS a scenario in everything but name: user picks how long to plan for, expecting Cashflow/Timeline/Risk projections to redraw across the chosen horizon. Currently writes `localStorage` only; engine support flagged "comes in s02a" (seed S-06). No preview of what changes, no propagation, no horizon visualization. Pill press is a DECISION with no rendered consequence on this surface OR downstream. Founder rule §9: "interactive-looking-but-dead = FAIL." | `Settings.jsx:911-950`; inventory ST-X-03 "engine support pending"; seed S-06 |
| ST-DATA-02 | Document vault (Phase-2 stub) | NA | NA | NA | NA | Phase-2 stub. No scenario preview required pre-launch. But: Vault.jsx exists elsewhere (seed S-11) — inconsistency is a reconciliation-auditor concern, not scenario. | `Settings.jsx` PhaseRow |
| ST-DATA-03 | Export & delete (Phase-2 stub) | **FAIL (latent)** | NA | NA | **FUNCTIONAL** (Phase-2 backlog) | This is the classic "if you delete this happens / if you export this is what's included" scenario the orchestrator named. Currently a flat Phase-2 row with no preview, no scope-of-export list, no irreversibility warning, no confirmation modal spec referenced. Acceptable as Phase-2 stub pre-launch IF the Phase-2 ticket explicitly requires: (a) export-contents preview, (b) delete-consequences preview ("you will lose X, Y, Z"), (c) confirmation modal. Flagging because the stub label gives no hint any of this is coming — destructive-action honesty thin. | `Settings.jsx` PhaseRow; seed S-07 covers FD-ST-1; no seed covers preview-spec |
| ST-OUT-01 | Sign Out (destructive) | **FAIL** | PARTIAL | NA | **FUNCTIONAL** | Sign Out is destructive — quasi-scenario expectation: "if you sign out, your session ends and unsynced data X happens." Current implementation fires `window.location.href = '/'` with NO confirmation, NO preview of what's lost, NO "sign back in here" affordance. Even pre-auth-wired (FP-5), the affordance should preview the consequence. | `Settings.jsx` SignOut row; seed S-05 (already flagged on destination-coherence side — scenario angle adds "no preview of consequence") |
| ST-ACCT-05 | Account.jsx FQ preview tile (score number) | **FAIL** | NA | **FAIL** | **DEMO-BLOCKING** | This IS positioned as a scenario ("here's what your dashboard would show"). It claims to project the user's Wealth Score from their onboarding inputs (age, focus, setup). It is NOT bound to the engine — score is `Math.round(20 + (age/85)*25 + (focus.length/8)*15 + (setup.length/6)*10)` clamped 18-72, with no relationship to `calcFQ()`. Worse: it is presented as the user's actual estimated number, then on real signup `calcFQ()` will produce a different number. The "preview" is a lie about a future state. No FCA framing on the tile. | `Account.jsx:31-51` local formula; `src/engine/fq-calculator.js` is the actual engine — never called; seed S-03 |
| ST-ACCT-07 | Account.jsx FQ band/stage/age line | **FAIL** | NA | **FAIL** | **DEMO-BLOCKING** | Same problem as ST-ACCT-05. Local `fqBand()` and `stageFor()` duplicate engine logic with different cutoffs (seed S-03). The "scenario" — what your dashboard would look like — uses a different rulebook than the dashboard itself. | `Account.jsx:31-58`; seed S-03 |
| ST-ACCT-01..02 | Account.jsx blurred-preview block | NA | NA | NA | **POLISH** | The blurred dashboard image is a visual "scenario hint" but it's decorative — three blurred bars, not real data. Acceptable as illustration provided FCA framing on the FQ tile is intact (it isn't — see ST-ACCT-05). Not a scenario in the audit sense. | `Account.jsx:72-81` |
| ST-CHR-* through ST-FOOT-02 | All other Settings rows | NA | NA | NA | NA | Chrome, identity, profile read-outs, financial details read-outs, tax-rules info, about info, footer. None present a hypothetical. Read-only data display or single-action navigation. | inventory rows |
| ST-X-01..10 | Cross-screen reconciliation hooks | NA | NA | NA | NA | These are propagation obligations (theme, hide-balances, longevity, plan staleness, currency, notifications, withdrawal cadence, export schedule, account closure, jurisdiction). Reconciliation-auditor's territory, not scenario. EXCEPT: ST-X-03 (longevity propagation) is the engine-binding half of the ST-PLAN-04..06 FAIL above — already counted. | inventory Region 17 |

---

## §2 — Per-scenario detail (the three FAILs)

### F1. Longevity pills (ST-PLAN-04 / ST-PLAN-05 / ST-PLAN-06) — DEMO-BLOCKING

**What is wrong**
- The longevity choice IS a scenario: "plan to age 85 vs 88 vs 92" is a horizon decision that should redraw retirement projections.
- Current build writes `localStorage` only. Engine consumption is queued "comes in s02a." No surface (Cashflow, Timeline, Risk) is verified to read this key live.
- No on-surface preview of what changes when the band flips. User taps "Optimistic (92)" — nothing visibly happens beyond pill state.
- Pill labels show ages (85/88/92), not band names — A5/scenario-clarity miss (also POLISH seed S-13).
- No FCA framing on the longevity row ("longevity is an estimate, not a guarantee").

**Expected behaviour**
- On flip: emit `SETTINGS_TEMPORAL_PREFS_CHANGED` to `EventsProvider` (spec §S7.5).
- On-surface micro-preview: a one-line "Pots last to age 87 → age 92 (+5 years horizon)" or similar, computed from `calcFQ()` / `planFor()` against the entity.
- Downstream surfaces (Cashflow ROD chart, Timeline horizon line, Risk longevity stress) must re-render against the new band.
- FCA boundary line: "Longevity is an estimate. Not financial advice."

**Severity rationale:** DEMO-BLOCKING because (a) it's the only true scenario control on Settings, (b) it's wired to LS but disconnected from the engine, and (c) founder rule §9 forbids interactive-looking-but-dead.

### F2. Export & delete (ST-DATA-03) — FUNCTIONAL (Phase-2 backlog)

**What is wrong**
- Destructive scenario with no preview. Phase-2 stub label gives no hint that the stub will include consequence preview + confirmation modal + scope-of-export list.

**Expected behaviour (Phase-2 ticket)**
- Export: preview of what's included (entities, transactions, plans, documents) before download. Plain-English scope list.
- Delete: "If you delete your account, you will lose: [list]. This is irreversible." Two-step confirm (type "delete" or 5-second hold).
- Both: FCA-neutral copy ("you will lose X" — describing consequence, not advising).

**Severity rationale:** FUNCTIONAL — Phase-2 stub is OK pre-launch per FD-ST-2, but the missing preview spec is a backlog gap that should be on the Phase-2 ticket now.

### F3. Account.jsx FQ preview (ST-ACCT-05 / ST-ACCT-07) — DEMO-BLOCKING

**What is wrong**
- Two scoring engines: Account.jsx's local formula and `src/engine/fq-calculator.js`'s `calcFQ()`. Onboarding shows one number; signed-in dashboard will show a different number.
- The "preview" claims to be the user's estimated FQ — that is a projection of a future state (their dashboard). It is not bound to current finances (it uses onboarding metadata length as a proxy: `focus.length`, `setup.length`).
- No FCA framing on the tile. "Your estimated FQ" with no "estimate · not financial advice" line.
- Compounds seed S-02 (legacy "FQ" / "Financial Quotient" naming).

**Expected behaviour**
- Either: call `calcFQ()` with the onboarding inputs (even if sparse) so the preview matches the real dashboard.
- Or: remove the numeric preview entirely and show a non-numeric teaser ("Personalised guidance based on what you shared").
- FCA boundary line on the tile regardless: "Estimate · not financial advice."

**Severity rationale:** DEMO-BLOCKING. A scenario that lies about the user's future state is worse than no scenario. Compounds with the "Sonuswealth is information not advice" positioning (memory `feedback_finio_info_not_sales`) — projecting a number that will move on signup undermines the boundary.

---

## §3 — What was confirmed clean

- Theme toggle (ST-PERS-03) and hide-balances (ST-PERS-06) correctly handled as behavior toggles, not scenarios. Live render IS the preview. No horizon, no projection needed.
- No spurious what-if blocks invented elsewhere in Settings. Component author resisted the temptation to add scenario-y chrome where it doesn't belong.
- Phase-2 stubs (Households, Connected, Security, Notifications, Help, Subscription, Compliance) correctly do not pretend to preview hypotheticals.

---

## §4 — Coverage line

**Scenario-relevant rows checked: 11 of 99 inventory rows.**
- 88 rows: NA (no scenario surface) — chrome, identity, read-only profile/financial/tax-rules/about info, footer, Phase-2 stubs without destructive preview obligation, reconciliation hooks owned by reconciliation-auditor.
- 11 rows scenario-evaluated:
  - 3 PASS-as-NA (theme, hide-balances, blurred-preview decorative)
  - 1 NA (vault stub, no scenario obligation)
  - 4 FAIL (Longevity ×3 counted as one scenario unit, Sign Out preview, Export/Delete preview, Account FQ preview ×2 counted as one scenario unit) → reported as 3 distinct scenario FAILs
  - 3 of 11 already covered by orchestrator seeds (S-03, S-05, S-06, S-13) — confirmed and severity assigned

**Scenario verdict: 3 PASS · 4 FAIL · 4 NA (within scenario-relevant subset).**

---

*— end audit-findings/settings/pass-1/scenario.md —*
