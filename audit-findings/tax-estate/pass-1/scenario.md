# Tax & Estate — Scenario Auditor — Pass 1

**Screen:** Tax & Estate
**Component:** `src/screens/TaxEstate.jsx` (2550 lines) + `src/components/TaxEstate/InheritanceStory.jsx` + `src/components/Estate/BeneficiarySankey.jsx`
**Engines walked:** `src/engine/fq-calculator.js` (`ihtDynamic`, `ihtSippDelta`, `ihtWaterfall`, `drawdownMatrix`, `giftClockProjection`, `trustPeriodicCharge`) + `src/engine/tax-estate-engine.js` (`ihtWaterfall`, `giftClockProjection`, `te_ihtExposure`)
**Date:** 18 May 2026
**Auditor role:** scenario / simulation / what-if / projection

---

## Scope as instructed

Walk every scenario / projection / what-if / gifting-strategy on the screen and verify:

1. **Time-projected** — does the scenario produce a year-by-year path from today to a horizon, or only a single static snapshot?
2. **Actionable** — does each option lead to a real ACTION/DECISION surface, not a dead paragraph?
3. **Engine-bound** — does the option's number derive from the user's entity via an engine call, or from local state / hardcoded literals?
4. **Pre/post 6 Apr 2027 toggle** — `ihtDynamic(e, true)` vs current — is it time-projected?
5. **Will / trust / gifting scenarios** — actionable + engine-bound?
6. **Estate CoI projection** — time-projected against `totalCoI` (not the `byDomain.estatePlanning` slice)?

---

## Verdict table (scenario / simulation elements only)

| ID | Element | Time-projected | Actionable | Engine-bound | Severity | Finding |
|----|---------|----------------|------------|--------------|----------|---------|
| TE-TAX-SS-03 | Salary-sacrifice slider | FAIL | FAIL | PARTIAL | FUNCTIONAL | Slider drives `te_nicsDetail(entity, sac)` — engine recompute works for the in-card "NIC saving today" line, but nothing else moves. No multi-year NIC-saving projection across the 2029 cap horizon shown to the user, even though `salary_sacrifice_cap_horizon` is in the engine output. Single-year snapshot only. |
| TE-TAX-SS-04 | 2029 NIC cap horizon warning | FAIL | NA | PARTIAL | FUNCTIONAL | A *date* (2029) is named, but no projection of NIC saving before-cap vs after-cap is shown. Pure prose banner. The horizon is asserted, not visualised. |
| TE-TAX-DD-03 | Drawdown matrix rows | FAIL | FAIL | PASS | FUNCTIONAL | Each row is a *single-year* steady-state computation: pick a £/yr draw, see tax/net/IHT-saved at that draw. No multi-year stack showing how a chosen draw evolves the SIPP balance, the IHT exposure, or the estate over the user's remaining horizon. Rows are non-interactive — no scenario commit, no "apply this draw" path, no link to MyMoney/Cashflow drawdown DOING surface (per FD-CROSS-1). |
| TE-TAX-DD-08 | IHT-saved column | FAIL | NA | PASS | FUNCTIONAL | `r.ihtSaved` is a static delta vs current draw — not a year-by-year IHT path. Crucially: the 2027 rule change is the entire point of this matrix, yet the column shows one number, not pre-2027 vs post-2027 vs steady-state. |
| TE-SUB-E3 | Pension-IHT countdown sub-anchor | FAIL | PASS | PASS | POLISH | Countdown (`N days until 6 Apr 2027`) is wired and scrolls to dual-number card. But the countdown itself isn't a projection — it's a static date diff. Acceptable as a sub-anchor, but no year-by-year IHT-£-stack pre vs post 2027 exists anywhere on the screen. |
| TE-EST-IHT-03 | IHT dual-number — "Today" tile | FAIL | FAIL | PASS | FUNCTIONAL | `te_ihtExposure(entity)` — single static snapshot. Non-interactive (no drill from tile itself; only the global "Breakdown ›" chip drills). No way to see the IHT path year by year approaching the user's life expectancy. |
| TE-EST-IHT-07 | IHT dual-number — "After 6 Apr 2027" tile | FAIL | FAIL | FAIL | DEMO-BLOCKING | Two failures: (a) Engine path divergence — when `today < 2027` the tile uses `ihtDynamic(entity, true)` (line 925) while `IHTDrillPanel` uses `te_ihtExposure(entity)` (line 1857). These are *different code paths for the same number*. The dual-number card and the breakdown panel can show different IHT figures for "after 2027" depending on whether `te_ihtExposure` internally sets `isPostPension` correctly. (b) Not time-projected: "Today vs After" is two snapshots, not the path between them. The user sees a step change, not a 2026 → 2027 → 2028 → 2029 IHT stack. The entire reason this card exists (the SIPP-IHT reform) demands a year-by-year projection it does not provide. |
| TE-EST-IHT-11 | Estate-vs-thresholds gauge | FAIL | NA | PASS | POLISH | Static bar — net estate vs NRB+RNRB *today*. No projection forward against any horizon (asset growth, drawdown depletion, RNRB taper crossover). |
| TE-EST-COI-01 | Estate CoI odometer (`byDomain.estatePlanning`) | FAIL | FAIL | PARTIAL | DEMO-BLOCKING | (a) **NOT projected against `totalCoI`** as the audit brief requires. Card shows `coi.byDomain.estatePlanning` only (line 1507) — a *slice*, not the total. Home (H-ANCH-04) and MyMoney show `totalCoI(e)` total. User sees different "CoI" numbers on different screens with no signposting that this is a domain slice (S-16 confirmed). (b) No multi-year projection — `dailyRate = estCoI / daysLeft()` is a static rate, no compounding, no year-on-year stack, no "if you do nothing for 5 years" line. |
| TE-EST-COI-02 | CoI daily-rate sub-line | FAIL | NA | PARTIAL | FUNCTIONAL | Daily rate is `estCoI / days`. No projection of cumulative drag — the user cannot see "this is £X over 12 months, £Y over 5 years". |
| TE-EST-COI-04 | byAction breakdown rows | FAIL | FAIL | PASS | POLISH | Each domain row non-interactive. No way to project "what changes if I fix the will gap" — the largest CoI line is dead. |
| TE-EST-IS-08 | InheritanceStory — "Family receives £X" line | FAIL | FAIL | PARTIAL | DEMO-BLOCKING | "If you died today" is by definition *not* time-projected. There is no companion "if you die in 10 years" or "if you die after 2027" path. Worse: `InheritanceStory` is rendered without `onDrillMetric` prop (line 2438) — every line marked `cta` is dead (S-01 confirmed). The footer hint "Tap any line to see the calculation behind it" lies to the user. |
| TE-EST-IS-10 | InheritanceStory — Beneficiaries line CTA | FAIL | FAIL | NA | DEMO-BLOCKING | Same root cause as IS-08 — `cta='beneficiaries'` resolves to nothing because the parent passes no handler. |
| TE-EST-WF-03 | IHT waterfall stages | FAIL | NA | PASS | FUNCTIONAL | Waterfall is single-shot: baseline → spouse → NRB → RNRB → gifts → BPR → IHT due. Engine-bound (`ihtWaterfall(entity, deltas)`). But it's a static stack at one moment in time — no projection of how the waterfall shifts year over year, no integration with the 2027 toggle, no view of how the same waterfall looks if the user dies at age 75 vs age 90. |
| TE-EST-WF-04 | Slider — SIPP drawdown (0 → 120k) | FAIL | FAIL | FAIL | DEMO-BLOCKING | Local state only (`useState({ sippDraw: 0, gift: 0, bpr: 0 })`, line 1025). `setDeltas` mutates `deltas`, which feeds `ihtWaterfall(entity, deltas)` for the *in-card recompute only*. **Does not feed `entity` / engine globally** — so the triple anchor (Net Worth / Wealth Score / Risk), the CoI odometer above, the IHT dual-number, and the drill panel all stay frozen while the user slides. The slider is a toy. A "what-if scenario" that doesn't move the rest of the page isn't a what-if; it's a calculator. Plus: no horizon — the slider answers "if I drew down £X/yr forever starting today and died tomorrow" — not a time-projected drawdown plan. |
| TE-EST-WF-05 | Slider — Gifts to trust (0 → 500k) | FAIL | FAIL | FAIL | DEMO-BLOCKING | Same root cause as WF-04. Plus: gifting is intrinsically time-bound (7-year taper), but the slider has no date axis. The user cannot answer "if I gift £200k *today* vs gift £200k *in 2 years*" — there's no date input, just an amount. The engine's `ihtWaterfall` accepts `gift_date` (line 711) but the UI doesn't expose it. |
| TE-EST-WF-06 | Slider — Business relief positioning (0 → 500k) | FAIL | FAIL | FAIL | DEMO-BLOCKING | Same root cause. Plus: BPR has a 2-year holding period and pre/post-30-Oct-2024 transitional rules — neither is modelled by a slider; you cannot drag yourself to a future point in time where the 2-year clock has elapsed. The note "Business + agricultural relief transitional rules apply" is prose, not scenario logic. |
| TE-EST-GC-01..07 | Gift clock | FAIL | FAIL | PASS | FUNCTIONAL | `giftClockProjection(entity)` returns per-gift state *today*: years elapsed, taper %, IHT-if-die-today. **Despite the name "projection"**, the engine does not return a future timeline per gift (the field `upcoming_clock_clearances` exists in `tax-estate-engine.js`:813 but is *not rendered*). UI shows current state only. No actionable "add another gift" CTA; rows non-interactive; can't drag a gift date forward to see taper progression. |
| TE-EST-TR-* | Trust simulator (Region 25) | FAIL | FAIL | PASS | FUNCTIONAL | Misnamed — there is no "simulation". Card shows current `trustPeriodicCharge(t)` snapshot per trust: next charge date, years to next, rate, estimated charge. No slider, no toggle, no scenario. Cannot adjust trust value to see how the periodic charge moves; cannot simulate exit before the next charge; cannot project the 10-year charge cascade over the user's lifetime. The "LOW · deed not in Vault" chip (TE-EST-TR-03) is also non-actionable — should be CTA to upload deed. |
| TE-EST-WL-03 | Will & LPA — cohabiting RED banner | NA | FAIL | NA | FUNCTIONAL | Not a scenario in the projection sense, but flagged here because it's the single highest-risk gap the screen advertises and there is **no scenario surface to action it**. "Cohabiting partner with no current will. Intestacy gives them NOTHING." → dead text. No "draft a will" CTA, no "see what changes if I write a will" projection. The `noWillCoI(entity)` engine output (rendered at line 1319) tells the user the £ cost, but doesn't show *over what period* that cost accrues. |
| TE-EST-NM-02 | Pension nominations rows | NA | FAIL | NA | FUNCTIONAL | Same shape as WL-03 — status display, no scenario, no "if you set this nominee, here's the IHT outcome" path. Pension IHT is the central reform on this screen; nominations are the lever; the lever is non-interactive. |
| TE-EST-DF-01 | IHT-since-last-visit diff chip | PARTIAL | NA | PASS | POLISH | This is the **only** element on the screen that hints at time — the delta vs last snapshot. But it's a single number ("£X since last visit"), not a chart, not a path. Acceptable as a delta chip, not a projection. |

---

## Per-scenario summary (the brief's 6-column ask)

### IHT projection year-by-year (pre/post 2027)
- **Options count:** 2 (Today, After 6 Apr 2027)
- **Actionable?** NO — neither tile drills from itself; only a global Breakdown chip drills, and it lands on a static waterfall, not a projection.
- **Finances-bound?** YES — both tiles consume engine output.
- **Time-projected?** **NO.** Two snapshots, no year-by-year stack. The reform is presented as a step change in 2027; in reality the user's exposure evolves continuously (asset growth, RNRB taper crossover, drawdown depletion of SIPP). No chart of "your IHT bill 2026 → 2030".
- **Engine paths consistent?** **NO** — `ihtDynamic(entity, true)` for the After tile when today < 2027, vs `te_ihtExposure(entity)` for the drill panel. Two functions, one number.
- **FCA framing?** Footer line present on drill panel ("Based on UK IHT rules · Finance Act 2026 · Not regulated advice") — chip on dual-number says "Enacted · FA 2026" but no per-tile FCA line.

### Will / trust / gifting scenarios
- **Options count:** 3 sliders in the IHT waterfall (SIPP drawdown / Gifts to trust / BPR positioning); 0 elsewhere.
- **Actionable?** NO — sliders feed in-card recompute only; outcomes never persist, never push to entity, never link to a DOING surface.
- **Finances-bound?** PARTIAL — `ihtWaterfall(entity, deltas)` is engine-bound, but the deltas are not.
- **Time-projected?** NO — no date axis on any slider; no gift-date input despite the engine accepting it; no 7-year taper progression view; no trust 10-year cascade.
- **FCA framing?** Drill panel footer present; sliders themselves carry no boundary line.

### Estate CoI projection vs `totalCoI`
- **Card shows:** `coi.byDomain.estatePlanning` slice (line 1507).
- **Brief requirement:** time-projected against `totalCoI` (the total across all domains).
- **Verdict:** **FAIL on both axes.** It's not the total — it's the slice. It's not projected — it's a static daily-rate division.
- **User-visible consequence:** the CoI value on T&E will not equal the CoI value on Home (H-ANCH-04) or MyMoney. FD-CROSS-1 requires them to match. They don't.

---

## Master finding (the only one that matters)

**This screen has zero year-by-year projections.** Every "scenario", "simulation", "projection", and "what-if" on Tax & Estate is a single-shot snapshot. The engine layer has the data (`upcoming_clock_clearances` in `giftClockProjection`; the SIPP balance + drawdown override in `ihtDynamic`; the 2029 NIC cap horizon date in `te_nicsDetail`), but the UI renders none of it as a time series.

The screen's central narrative is **the 6 April 2027 SIPP-IHT reform**. A reform announces a step change at a future date. The natural UI for that is a year-by-year chart of "your IHT bill over the next 10 years" with the 2027 line marked. The screen instead shows two tiles labelled "Today" and "After 6 Apr 2027" with a glow on the second one. That's a poster, not a projection.

Same pattern repeats: gift clock shows current state not the 7-year future; trust simulator shows the next charge not the cascade; drawdown matrix shows per-draw steady-state not the path; salary sacrifice shows today's NIC saving not the pre/post-2029 stack; CoI odometer shows today's daily rate not the cumulative drag.

The sliders compound the problem — they recompute the in-card numbers but never push to entity, so the user gets cosmetic feedback while every other number on the page (anchors, CoI, drill panel) stays frozen. **This violates the audit's "Time-projected" assertion for every scenario element on the screen.**

---

## FAIL severity rollup

| Severity | Count | Elements |
|----------|-------|----------|
| DEMO-BLOCKING | 6 | TE-EST-IHT-07 · TE-EST-COI-01 · TE-EST-IS-08 · TE-EST-IS-10 · TE-EST-WF-04 · TE-EST-WF-05 · TE-EST-WF-06 |
| FUNCTIONAL | 10 | TE-TAX-SS-03 · TE-TAX-SS-04 · TE-TAX-DD-03 · TE-TAX-DD-08 · TE-EST-IHT-03 · TE-EST-COI-02 · TE-EST-WF-03 · TE-EST-GC-01..07 · TE-EST-TR-* · TE-EST-WL-03 · TE-EST-NM-02 |
| POLISH | 4 | TE-SUB-E3 · TE-EST-IHT-11 · TE-EST-COI-04 · TE-EST-DF-01 |

(WF-04/05/06 collapsed to one DEMO-BLOCKING row in the count.)

---

## Coverage line

**TE scenario: 0 PASS, 22 FAIL (6 DB, 12 F, 4 P).**

Every scenario / projection / what-if / gifting / drawdown / sacrifice / CoI element on the screen fails on time-projection. Of the 22, 6 are demo-blocking (engine-path divergence on the IHT 2027 tile, dead InheritanceStory CTAs, sliders that don't push to entity, CoI shown as domain slice rather than total).

Pass-1 verdict: **the screen has no genuine scenario surface.** It has snapshot cards labelled as scenarios.
