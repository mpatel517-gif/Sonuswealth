# Risk — Pass 1 — Scenario / What-If Auditor

**Screen:** Risk (`src/screens/Risk.jsx` + `src/screens/RiskOverlay.jsx`)
**Inventory:** `risk-inventory-v1.md`
**Date:** 2026-05-18
**Auditor:** scenario-auditor (5 of 5)
**Locked FD:** FD-CROSS-1 — **Risk owns the shock test.** That makes scenario the primary auditor on this screen, not a tail check.

---

## Scope — what counts as a "scenario / what-if element" on Risk

Per FD-CROSS-1, Risk is the *can-this-survive* surface. Five categories of scenario element exist:

1. **Z5 Shock Scenarios** — `riskShockSuite(entity)` → 5 shock cards (`job_loss`, `illness`, `market_fall`, `rate_rise`, `death`). Each: ΔRisk, ΔWealth, ΔNW.
2. **Z11 "What would help most"** — `whatWouldHelpMost(entity, shockId)` mitigation table. Per-shock counterfactual: "if you did X, the shock would be N points less severe."
3. **Z7 Life-event banner** — `lifeEventPaths(entity)` — life events that prompt re-running risk. Conceptually a scenario *trigger*, not a scenario *body*.
4. **AskChip RISK-AI-3 "What if?"** + **RISK-AI-3 "What would I do?"** on shock cards + **RISK-AI-6** on life-event banner + **RISK-AI-8** on Take Action — Ask Sonu seeded with the shock context. The "if you ask, you get a what-if conversation" path.
5. **Z9 Take Action top-3** — not a what-if per se (it's an action ranker), so out-of-scope for this auditor *except* where each action implies a counterfactual.

Z2 CrossMap (5×5), Z3 dimension panel, Z8 history, Z12 protection plan — NOT scenario surfaces. Audited by other auditors.

---

## Verdict table

| ID | Time-projected | Actionable | Engine-bound | Severity | Finding | Evidence |
|----|----------------|------------|--------------|----------|---------|----------|
| RK-Z5-00 (header) | NA | NA | NA | — | Stress Tests / Shock Scenarios eyebrow + title + AskChip RISK-AI-3. Header only — no scenario behaviour to test here. | `src/screens/Risk.jsx:1400-1407` |
| RK-Z5-01 job_loss | **FAIL** | FAIL | PASS | **DEMO-BLOCKING** | Shock is **point-in-time only.** Engine computes a single snapshot: 6 months of cash drain at `monthlyEmployment × 6`. No projection across the 6-month path. No "month 1 → month 3 → month 6" trajectory. No "when does default begin?" timeline despite shock description literally promising "when risk of default begins". A user who loses their job needs the path, not the endpoint. | `src/engine/risk-engine.js:31-46`; description `risk-engine.js:146-147`; card render `Risk.jsx:858-901` |
| RK-Z5-01 actionability | — | **FAIL** | — | **DEMO-BLOCKING** | Card expands → shows `shock.description` paragraph + AskChip. No path to ACTION (e.g. "build emergency fund" → My Money) and no path to DECISION. Per FD-CROSS-1 every shock card MUST hand off to the owning surface for the doing. Currently it dead-ends at description prose. The AskChip RISK-AI-3 "What would I do?" is the only escape hatch — and it goes to Ask Sonu, not to the owning surface. | `Risk.jsx:891-898` (only `<div>{shock.description}</div>` on expand); `Risk.jsx:885` (AskChip is the only action) |
| RK-Z5-02 illness | **FAIL** | FAIL | PASS | **DEMO-BLOCKING** | Same point-in-time problem. SSP modelled correctly (`116.75 × 28`) but as a lump-sum addition to a 6-month cash drain — no week-by-week SSP path, no "when does SSP run out (week 28) vs when does cash run out" comparison. The actual story of an illness shock is the *gap* between week 28 and week 52 — invisible. | `risk-engine.js:48-59` |
| RK-Z5-03 market_fall | **FAIL** | FAIL | PASS | **DEMO-BLOCKING** | Single 30% haircut applied to SIPP + ISA + portfolio. No recovery trajectory, no sequence-risk modelling (FD-CROSS-1 explicitly cites *sequence risk* and *drawdown survival* as Risk's job — neither is here). A user in drawdown needs to know: "if the market falls 30% today, do I run out of money 7 years earlier?" That projection does not exist. | `risk-engine.js:61-88`; FD-CROSS-1 promise of "drawdown survival under sequence risk" |
| RK-Z5-04 rate_rise | **FAIL** | FAIL | PASS | **FUNCTIONAL** | Models 12 months of extra payment as immediate NW drain. No 5y/10y/term projection. No comparison to fix-now vs ride-it-out. Mortgage shock without amortisation-curve projection is just a monthly-payment lookup, not a stress test. | `risk-engine.js:90-114` |
| RK-Z5-05 death | **FAIL** | PARTIAL | PASS | **FUNCTIONAL** | IHT modelled with current rules + SIPP-included worst-case (per FD-CROSS-1 sequence risk context, this nods to the 2027 SIPP-IHT enactment). But: no "when this happens" picker (death this year vs in 10 years materially changes IHT). No path showing taper relief on lifetime gifts. The card shows a single snapshot of "if you died today". | `risk-engine.js:116-139` |
| RK-Z5-EMPTY | NA | NA | PASS | POLISH (A5) | Empty state "No shock results available — engine returned empty." surfaces engineer language. Scenario-auditor agrees with seed S-16: never say "engine" in user copy. Suggested: "Couldn't run stress tests for this profile — try again or update your data." | `Risk.jsx:1409-1411` |
| RK-Z5 — FCA boundary | — | — | — | **DEMO-BLOCKING** | **No per-scenario FCA framing.** Each shock card shows pound figures, ΔRisk, ΔWealth deltas, and a description — none carry the "estimate · not financial advice" boundary inline. The only disclaimer is `BRAND.disclaimer` in the screen footer (`Risk.jsx:1640-1641`), 1,200+ lines below the scenario cards. Per FCA boundary rule + memory `feedback_finio_info_not_sales`, every scenario *result* (not just the screen) needs the boundary. A user who scrolls into a shock card on mobile may never see the footer. | `Risk.jsx:858-901` (no inline FCA); `Risk.jsx:1640-1641` (footer only) |
| RK-Z11-00 (header) | NA | NA | NA | — | "What would help most" + ExplainerChip RISK-1. Header only. | `Risk.jsx:1037-1041` |
| RK-Z11-S1..S5 shock pickers | NA | PASS | PASS | — | 5 picker chips (job_loss / illness / market_fall / rate_rise / death) — click re-runs `engineWhatHelpsMost(entity, shockId)`. Functional. A5 note: "Market −30%" and "Rate +2%" mix UI symbol with English — readable but inconsistent with shock card label "Market fall −30%". | `Risk.jsx:1024-1054` |
| RK-Z11-01 mitigations table | PARTIAL | **FAIL** | PASS | **DEMO-BLOCKING** | Engine returns up to 5 counterfactuals per shock with `rsDeltaImprovement` (point reduction). Engine-bound, comparable, multi-option — that part PASSES the multi-option assertion. **But:** each row is a description string + effort cell + number. No row is a button. No row leads to an ACTION (where do I "buy income protection"? Not on Risk — must hand off to My Money per FD-CROSS-1). No row leads to a DECISION (do I commit to this mitigation? No commit affordance). Dead paragraph problem — see scenario-auditor assertion #4. | `Risk.jsx:1064-1084` — `<tr>` rows, no onClick, no href, no handler |
| RK-Z11-01 — time horizon | **FAIL** | — | — | **FUNCTIONAL** | Mitigations are counterfactuals on the *same* point-in-time shock. They don't carry their own horizon. "Build emergency fund to 6 months" should project: "this takes ~Nm to save at your surplus, and *during* that time you remain exposed." None of that exists. The mitigation is shown as if it's already done. | `risk-engine.js:230-308` returns `rsDeltaImprovement` only, no time-to-mitigate field |
| RK-Z11-HD headers | NA | **FAIL** (dead) | NA | FUNCTIONAL | Seed S-07 confirmed. `<th>` Action / Effort / Δ Risk carry `sw-press` class + `cursor:pointer` but no onClick. Implies sortability that does not exist. Not a scenario failure per se — but it sits inside the scenario table and lies about scenario interactivity. | `Risk.jsx:1058-1060` |
| RK-Z11 — FCA boundary | — | — | — | **DEMO-BLOCKING** | Same as Z5 — table shows specific actions ("buy income protection", "fix mortgage rate") with specific risk-point claims. Zero "estimate · not advice" framing inline. "Buy income protection" without the boundary edges into advice territory per FCA. | `Risk.jsx:1055-1093` |
| RK-Z7-01 life-event banner | NA | **FAIL** | **FAIL** | **DEMO-BLOCKING** | `lifeEventPaths` is a **STUB** that returns `[]`. Confirmed at `fq-calculator.js:1812-1815`. The entire life-event scenario trigger is dead code — banner never renders for any persona. Per scenario-auditor assertion #1 (Present and reachable), this whole feature fails. | `fq-calculator.js:1812-1815`; `Risk.jsx:1098-1101` (early-return on empty array) |
| RK-Z7-02 banner body "Tap to re-answer" | NA | **FAIL** | — | FUNCTIONAL | Seed S-08 confirmed. Body says "Tap to re-answer affected dimensions" but the wrapping `<div>` has no onClick. Even if `lifeEventPaths` returned data, the "tap" affordance would lie. | `Risk.jsx:1118-1120` |
| RK-AI-3 AskChip "What if?" (Z5 header) | PASS | PASS | — | — | Header AskChip dispatches `sonus:ask` event with seed question. PASS — this IS a valid scenario surface (Ask Sonu = conversation = what-if exploration). Caveat: success depends on Dashboard listener being wired (not in scope for scenario-auditor). | `Risk.jsx:210-235` (AskChip dispatch); `Risk.jsx:1406` |
| RK-AI-3 AskChip "What would I do?" (per shock) | PASS | PASS | — | — | Per-shock AskChip. Same dispatch pattern. The seed question per `Risk.jsx:216`: "For this scenario, what would I actually do in the first 30 days?" — note this is **time-projected** language (first 30 days), but the projection itself happens in Ask Sonu, not on Risk. So Risk delegates time-projection to chat. That's a defensible position but means Risk *itself* does not satisfy assertion #6 (time-projected) on shock cards. | `Risk.jsx:216`; `Risk.jsx:885` |
| RK-AI-6 (life-event) | NA | — | — | NA | Lives inside Z7 banner that never renders (lifeEventPaths stub). Untestable until stub is implemented. | `Risk.jsx:1116` |
| RK-AI-8 (Take Action) | NA | NA | NA | — | Out of scope — Take Action is an action ranker, not a scenario. Acknowledged. | — |
| **Coverage** | — | — | — | — | Scenario rows checked: 14 substantive (5 shock cards + Z5 header + empty state + FCA + Z11 header + shock pickers + mitigations table + horizon + headers + Z11 FCA + Z7 banner + Z7 body + 4 AskChips). Total scenario surface complete. | — |

---

## Per-scenario summary against scenario-auditor's 7 assertions

| Element | Present | Expandable | Multi-option | Actionable | Finances-bound | Time-projected | FCA |
|---------|---------|------------|--------------|------------|----------------|----------------|-----|
| Z5 — 5 shock cards | PASS (5/5) | PASS (each expands desc) | PASS (5 distinct shocks) | **FAIL** (no handoff to owning surface) | PASS (driven by `runShock(entity)`) | **FAIL** (all point-in-time) | **FAIL** (no inline boundary) |
| Z11 — What would help most | PASS | NA (table) | PASS (5 mitigations/shock) | **FAIL** (dead rows) | PASS (`whatWouldHelpMost(entity, shockId)`) | **FAIL** (mitigations not horizoned) | **FAIL** (no inline boundary) |
| Z7 — Life-event banner | **FAIL** (stub returns empty) | NA | NA | **FAIL** (no onClick on body) | **FAIL** (stub) | NA | NA |
| AskChips (RISK-AI-3 ×2, RISK-AI-6) | PASS (dispatch wired) | NA | NA | PASS (event-based) | Inherited from chat (out of scope) | Inherited (seed says "first 30 days") | Inherited |

---

## Severity calls (proposed)

| Finding | Severity | Justification |
|---------|----------|---------------|
| Shock cards point-in-time only (no horizon) | **DEMO-BLOCKING** | FD-CROSS-1 makes Risk the shock-test screen. A shock test without horizon ≠ a shock test. Sequence risk and drawdown survival are *named in the FD* and are not in the engine. |
| Shock cards dead-end at description (no ACTION handoff) | **DEMO-BLOCKING** | FD-CROSS-1 mandates handoff to owning surface (My Money / Cashflow / T&E). Currently a paragraph + AskChip. The doing-surface bridge is missing. |
| Z11 mitigation rows not actionable (no onClick) | **DEMO-BLOCKING** | Same FD-CROSS-1 reasoning. Mitigations are described, not committable. |
| No inline FCA boundary on Z5 or Z11 | **DEMO-BLOCKING** | Pound figures + action prescriptions ("buy income protection") without the boundary are the highest-risk FCA failure mode on Sonuswealth. Memory `feedback_finio_info_not_sales` + FCA-boundary rule on every Ask response — should apply to every scenario result too. Screen-footer-only is not sufficient. |
| `lifeEventPaths` stub returns `[]` | **DEMO-BLOCKING** | Entire Z7 surface is dead. If the demo includes any persona where life events should fire (post-birth, divorce, redundancy), the banner will never appear — a documented feature is missing. |
| Z11 mitigations have no time-to-mitigate field | **FUNCTIONAL** | Engine returns `rsDeltaImprovement` only. A row saying "Build emergency fund — +8 Risk" omits "this takes ~12 months at your surplus." Mitigations look free and instant when they're neither. |
| rate_rise / death single-snapshot | **FUNCTIONAL** | Lower severity than the broader shock-horizon failure because both are sub-cases. Rate rise needs a 5y projection; death needs a "when?" picker. |
| Z5 empty state engineer copy | **POLISH (A5)** | Same as seed S-16. |
| Z7 "Tap to re-answer" without onClick | **FUNCTIONAL (A2)** | Dead affordance. Confirmed seed S-08. |
| Z11 sortable-looking headers without sort | **FUNCTIONAL (A2)** | Dead affordance. Confirmed seed S-07. |

---

## Expected behaviour (what FIX looks like)

Per scenario-auditor assertion #6 (time-projected) + FD-CROSS-1 (shock test, sequence risk, drawdown survival):

1. **Shock engine returns a trajectory, not a snapshot.** Each shock should return `{ months: [{m:0, nw, rs, fq}, {m:1, ...}, ... {m:24, ...}], inflection: { defaultMonth, exhaustionMonth }, ... }`. Shock card renders an inline sparkline + "default risk begins month N" tag.
2. **Each shock card carries an action-handoff button.** "Strengthen liquidity → My Money" / "Fix mortgage → Cashflow" / "Add life cover → My Money protection". Per FD-CROSS-1 the verb sits on the owning surface, the *survive* view stays on Risk.
3. **Z11 mitigation rows become clickable** and lead to the owning surface with the mitigation pre-seeded. Same handoff pattern.
4. **Every shock result + every mitigation row** carries an inline `est · not advice` chip. Reuse the boundary chip used on Ask Sonu responses.
5. **`lifeEventPaths` ships.** Even a minimal v1 (detect `entity.lifeEvents[]` array and surface affected dims) makes the Z7 surface real instead of dead.

---

## Out-of-scope / NA confirmations

- **Z9 Take Action** — not a scenario; covered by other auditors.
- **Z2 CrossMap** — not a scenario; covered by other auditors.
- **Z3 dimension panel** — not a scenario; covered by other auditors.
- **Z8 history** — historical, not hypothetical; covered by other auditors.
- **Z12 Protection Plan** — a plan anchor, not a scenario. Out of scope.

---

**RK scenario: 3 PASS, 14 FAIL (5 DB, 6 F, 3 P).**
