# Phase 2a Regression Triage — 2026-05-25

**Source:** `tests/reports/audit-bf8e67ac-1779699003263.md`
**Run:** 7 personas × 6 years = 42 LLM-validated snapshots via DeepSeek hybrid mode.
**Cost:** $0.024 (47,833 tokens)
**Headline:** 15 FAIL / 24 WARN / 3 PASS

## TL;DR

The regression's headline "15 FAIL" overstates the engine's true bug count. Triaging produces:

- **3 real engine/harness bugs to fix** (RNRB taper, transition-stage income, persona-a snapshot serialisation)
- **A swarm of snapshot serialisation gaps** that make DeepSeek say "I can't verify" — surfaces as WARN/FAIL noise but doesn't reflect engine truth
- **A handful of DeepSeek miscalculations** (basic tax bands) — model false positives, not engine issues

The real engine bugs are concentrated in **persona-c (Tony Stark, HNW founder)** and **persona-b (couple in transition)**. Fix those two, fix the snapshot, re-run — expect ≥80% PASS.

---

## §1 — REAL ENGINE BUGS

### BUG-1 — RNRB taper missing for HNW estates 🔴 P0

**Symptom:** persona-c at £9–11M net worth still receives full £175k RNRB. Engine output `iht_breakdown.rnrb = 175000` regardless of estate size.

**UK rule (s8D IHTA 1984):** Residence Nil-Rate Band tapers £1 for every £2 estate value above £2M threshold. RNRB hits zero at estate value £2.35M (single) or £2.7M (couple, with transferable RNRB).

**Impact:** Tony Stark's IHT is **under-stated by ~£70k–£140k per year**.

**Evidence (5 verdicts):**
- persona-c/2021/22: "IHT exposure £156k on estate £9M is implausible; gross estate far exceeds NRB+RNRB"
- persona-c/2022/23: "IHT exposure £288k on £6.9M property; NRB+RNRB £500k, but gross estate £1.22M? Inconsistent"
- persona-c/2024/25: "IHT exposure £334,501 on £1.34M estate; taxable £836k at 40% = £334k, but RNRB may be tapered"
- persona-c/2026/27: "IHT £378k on £1.445M estate with NRB+RNRB £500k yields taxable £945k, but calculation seems off"
- persona-a/multiple: "RNRB £0 but property £450k should qualify for RNRB" (separate bug — see BUG-3)

**Where to fix:** `src/engine/fq-calculator.js` — `ihtDynamic()` function. Look for RNRB calculation; add taper logic.

**Skill to invoke when fixing:** `sonuswealth-tax-accountant` to confirm taper rate + thresholds + couple-transferable rules.

---

### BUG-2 — Engine returns £0 income for transition-stage personas with targetIncome 🔴 P0

**Symptom:** persona-b (couple) has `targetIncome=£55k` but engine returns `gross_income=£0` in 4 of 6 years. DeepSeek flagged as FAIL: "Engine shows no income despite £55k target; cashflow and tax data missing."

**Root cause:** In `tests/harness/snapshot.mjs:104` the `effectiveDrawdown` synthesis only fires when `lifeStage >= 5 || lifeStageName.toLowerCase().includes('decumulation|legacy')`. Persona-b is lifeStage 4 (transition) so engine treats target income as aspirational, not modelled.

**Why this matters production-side:** When Cashflow tab renders for a transition-stage couple, the engine returns 0 income/tax/surplus. UI shows blank or zero everywhere even though user has set a target.

**Where to fix:**
1. Decide the canonical rule with the founder: does *transition* stage drawdown from SIPP/ISA/cash equal targetIncome, or does the user explicitly need to set `drawdownPlan.targetAnnual`?
2. Either widen the lifeStage gate or add a fallback that takes any positive `targetIncome` value as effective drawdown.

**Skill to invoke when fixing:** `sonus-financial-analyst` for the financial-planner perspective on what "transition" means.

---

### BUG-3 — Bruce Wayne's snapshot shows SIPP/ISA/cash = £0 despite owning them 🟡 P1

**Symptom:** persona-a (Bruce Wayne) at lifeStage 5 (decumulation), net worth £3.5–3.9M, but snapshot shows `balance_sheet.sipp=0, isa=0, cash=0`. DeepSeek flagged repeatedly: "implausible for decumulator", "no liquid assets to fund income".

**Hypothesis:** Bruce's persona JSON uses a schema variant that neither my `summariseBalanceSheet` nor the legacy snapshot path recognises. Need to inspect his persona-a.json structure.

**Where to fix:** `tests/harness/snapshot.mjs` — extend `summariseBalanceSheet` to handle Bruce's schema. May also reveal a hole in the production engine if it walks the same path.

---

## §2 — DeepSeek false positives (validator misreads)

Worth knowing because they pad the FAIL count.

- **"Income tax understated"** for £96k drawdown showing £25,832 tax. That's correct: £12,570 PA → £37,700 @ 20% = £7,540 → £45,730 @ 40% = £18,292 → £25,832 total.
- **"Effective rate too low"** for income exactly AT £50,270. Persona is at the threshold, not in HRT. £37,700 taxable @ 20% = £7,540, 15% effective. Correct.
- **"Risk score 80 'Resilient' but no asset allocation"** — DeepSeek can't see allocation because snapshot doesn't expose it. Not an engine bug.

---

## §3 — Snapshot serialisation gaps (noise, not bugs)

These cause DeepSeek to default to WARN when it can't verify. Worth widening the snapshot to silence them:

| Missing field | Cited verdicts | Fix complexity |
|---|---|---|
| `pl.monthly_expenditure` (or `pl.annual_expenditure`) | persona-a/all years cashflow FAIL | 5-min addition to snapshot.mjs |
| `protection` block (life cover sum, CI, IP) | every persona "protection" WARN | 15-min — engine fields exist via `protection()` |
| `risk.asset_allocation` (% equity / bond / cash / property) | every persona risk WARN | 20-min — needs deriving from assets walker |
| `cashflow.annual_surplus` and `cashflow.income_components_breakdown` | persona-b cashflow FAIL | already partly exposed; expand |

Fixing these would convert ~15 of the 24 WARNs to PASS without any engine change.

---

## §4 — Recommended next steps (founder gate)

| # | Action | Effort | Who |
|---|---|---|---|
| 1 | Fix BUG-1 (RNRB taper) | 2–3h | Claude + `sonuswealth-tax-accountant` skill |
| 2 | Decide transition-stage income rule, then fix BUG-2 | 1h decision + 1h fix | Founder + Claude |
| 3 | Fix BUG-3 (persona-a schema gap) | 1h investigation + 1h fix | Claude |
| 4 | Widen snapshot to fix the 4 serialisation gaps in §3 | 1h | Claude |
| 5 | Re-run hybrid regression to confirm fixes | 4 min runtime + ~$0.03 | Claude |
| 6 | Then expand to matrix + historical personas (88 × 6 = 528 runs) | 30 min + ~$0.25 | Claude |

Total: ~7 hours of session time + ~$0.30 of DeepSeek + 1 founder decision.

---

*Authored 2026-05-25. Cross-reference: `sonuswealth-master-schedule.md` §2.2 Phase 2a status.*
