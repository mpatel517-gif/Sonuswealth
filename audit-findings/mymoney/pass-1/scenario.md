# Scenario Audit — MyMoney pass-1

**Date:** 2026-05-18
**Auditor:** Scenario & What-If Auditor (pass-1 rerun with full code trace)
**Files traced:**
- `src/screens/MyMoney.jsx`
- `src/components/shared/X28TopBar.jsx`
- `src/engine/fq-calculator.js`
- `mymoney-inventory-v1.md`
**Method:** Traced PensionDrillDown (overlay editable schedule + projection + commit), 5-method DrawdownFrameworkPanel, DrawdownMatrixPanel, DecumulationPanel, X28 view-mode pills, CliffEdgeWarning, CoI ranked panel, Director-intelligence cards. Each scenario element scored against the 7-point method: present · expandable · multi-option · actionable · finances-bound · time-projected · FCA-framed.
**Locked FDs:** FD-MM-1 (no new components), FD-CROSS-1 (MM owns canonical pension/drawdown surface). Per-bucket What-If is a Wave 7 deliverable — flagged FUTURE WORK, not audit FAIL.

---

## Verdict table

| ID | Time-projected | Actionable | Engine-bound | Severity | Finding | Evidence |
|----|----------------|------------|--------------|----------|---------|----------|
| MM-X28-01 (7 windows) | YES (windowYears drives `netWorthAtWindow`) | YES (state change) | PARTIAL — only `MM-BS-00` reads `projection.value`; MM-SCR-01 (Net Worth anchor) reads raw `nw`, per-tile sparklines back-cast from `CAT_MONTHLY_DRIFT` | FUNCTIONAL | Future-mode is **partially wired**: pivot the X28 to +5y / +10y / retirement and the Net Worth anchor + sparklines do NOT move with it — only the BalanceSheet hero does. User cannot trust the projection is consistent across the screen. Confirms seed MM-S-21. | `MyMoney.jsx:2527-2530` (projection bound to BS only); `:3165` (`netWorth={projection.value}` on BS only); MM-SCR-01 uses `nw` raw |
| MM-X28-02 (4 view-mode pills: Actual / Forecast / Plan / Scenario) | NA — selector itself, not scenario | YES (state change) | YES (re-keys cascade; `VarianceBadge` reads mode1/mode2) | DEMO-BLOCKING | The "Scenario" mode pill is **present and reachable** but has **no scenario-library UI behind it**. Selecting it only enables `VarianceBadge` deltas vs actual — no list of saved scenarios, no "create scenario", no scenario picker. The 4-mode taxonomy from spec (Actual/Forecast/Plan/Scenario) is surfaced as labels with no destination. Pre-launch CTA-honesty violation. | `:2604-2608` (pills wired); `:2682` (re-key only); no scenario list component found |
| MM-X28-HDR-02 (FORECAST · variance overlay active pill) | NA (state indicator) | NA | YES | PASS-CONDITIONAL | Renders honest "variance overlay active" — but only because no scenario content exists to show. Once Wave 7 lands, this pill needs to name *which* scenario is active, not just the mode. | `:2626-2632` |
| MM-CLF-01/02/03 — CliffEdgeWarning ("£100k income cliff", pension-to-solve copy) | NO — single static snapshot ("£Xk from cliff"). No "if I contribute £Y, ANI in N years would be Z" projection across a horizon. | PARTIAL — surfaces a recommended pension contribution number but no button. Copy is prose, not a tap target. | YES — `calcANI(entity).ani`, `entity.income`, AA headroom from engine | DEMO-BLOCKING | Cliff-edge is a **scenario in spec** ("solve the cliff by contributing X to pension") but rendered as static prose. No "Apply £X to pension" CTA, no projection of taxable income after the contribution, no link to PensionDrillDown to enact it. A4 (actionable) + 6 (time-projected) FAIL. | `MyMoney.jsx:964` (component start); no `<button>` inside the recommendation text |
| MM-COI-01/02 — Cost of doing nothing ranked panel (£412k pension drawdown row, etc.) | NO — single-year aggregate. "£/yr" is a flat number, not a path across 5/10/20 years showing CoI compounding. | NO — the top row reads "Critical action — Start pension drawdown (£412k)" but the row itself is **not a button**. No tap, no route to PensionDrillDown. | YES — `totalCoI(entity)` + `coiForDomain(entity, id)` | DEMO-BLOCKING | CoI is a **decision-engine output by design** (each row IS the recommended scenario vs status quo) — but the rows are inert text. The top item, "Start pension drawdown", should route to MM-OVL-03 (PensionDrillDown). It doesn't. Confirms FD-CROSS-1 broken at the most visible scenario row. Also confirms seeds MM-S-03 (£412k vs Home £340k mismatch) and MM-S-08 (must route to same overlay). | `:2891-2908` — each row is a `<div>` with no onClick |
| MM-DEC-01..05 — Decumulation panel (GIA → ISA → Pension sequencing) | NO — shows ordered list with £ per pot + "At 4% SWR £Y/yr" footer, but no projection of *when* each pot exhausts, no horizon path | PARTIAL — three rows each carry a tax note but no "Try drawing this way" CTA | YES — pulls `giaValue / isaValue / pensionValue` from `entity.assets` | FUNCTIONAL | Sequencing is the right scenario surface but renders as **advice prose** ("draw GIA first") with no simulation. Should allow user to flip the sequence (ISA first? Pension first?) and see lifetime tax delta. Currently one prescribed answer, not multi-option. A3 (multi-option) + A4 (actionable) + A6 (time-projected) FAIL. | `:2380-2480`; sequences hardcoded `order: 1/2/3` |
| MM-DEC-06 — Empty-state CTA "Set up your drawdown plan →" | NO | NO — `<span>` not `<button>`, no onClick. Confirms seed MM-S-11. | NA | DEMO-BLOCKING | Pre-launch CTA-honesty rule violation. Looks tappable, isn't. | `:2393-2395` — `headerAccessory` is a `<span>` |
| Drawdown 5-method panel (DrawdownFrameworkPanel) — 5 cards: Bengen / GK / Bucket / Floor-Upside / CoI | PARTIAL — each card shows Year-1 income + 30-year end value, but only as a snapshot. Synthesis bar compares Year-1 income only. No multi-year path per method visualised. | PARTIAL — "Drill-down ›" header button routes to overlay (`onOpenDrillDown` → opens PensionDrillDown). But the 5 cards themselves are **not selectable** as scenarios — `cursor: 'default'` is set explicitly. User cannot pick "I want to model Floor+Upside" and apply it. | YES — each card pulled from `bengenProjection`, `guytonKlingerPath`, `bucketAllocation`, `floorUpsideSplit`, `coiCashflowVariants` | FUNCTIONAL | The 5 methods are displayed as **comparable read-only summaries**, not selectable scenario presets. PensionDrillDown then exposes only 4 presets (Take nothing / Basic-rate band / SWR / GK) — Bengen, Bucket, Floor-Upside have no apply path. **Bengen, Bucket, Floor-Upside are dead surfaces** for the user — you can read them but cannot enact them. A4 FAIL. Also note the method-set named in the task ("UFPLS / Flexi-access / Phased / Capped / Annuity") is the **HMRC mechanism taxonomy** — what is shipped is the **withdrawal-strategy taxonomy** (Bengen / GK / Bucket / Floor-Upside / CoI). These are two different decompositions. The spec calls for both; only one is present. | `:1428-1554`; `cursor: 'default'` at `:1514`; presets at `:1814-1819` |
| Drawdown 5-method panel — engine-derived claim | YES for SWR/Guard preset (`guardrail(entity)` and `Math.round(investable(entity) * 0.045)` in PensionDrillDown). | NA | YES | PASS | Both "guard" and "gk" presets are derived from engine fns, not hardcoded. | `:1817-1818` |
| Drawdown 5-method panel — UFPLS / Flexi-access / Phased / Capped / Annuity | NO | NO | NO | DEMO-BLOCKING (per task) | The **HMRC drawdown mechanism taxonomy** (UFPLS, Flexi-access, Phased, Capped, Annuity) is **NOT IMPLEMENTED** anywhere on the screen. Audit grepped both `MyMoney.jsx` and `src/components/MyMoney/*.jsx` for those terms — zero hits except the engine spec comment at file head. The task brief says each must be engine-derived, not static. They are absent. A1 (present) FAIL. | grep `UFPLS\|Flexi-access\|Phased\|Capped\|Annuity` in MyMoney.jsx + MyMoney/* — zero matches |
| MM-OVL-03 PensionDrillDown — Section 4 schedule editor (year-by-year amount inputs + 4 presets + add/remove year) | YES — schedule rows = per-year `(age, amount)`; user explores a hypothetical path | YES — Commit button fires `DRAWDOWN_SCHEDULE_SET`, presets mutate state, addYear/removeYear mutate state | YES — `sippProjection`, `sippProjectionSeries`, `ihtDynamic` all called with the user's `entity` + edited schedule | PASS | This is the canonical scenario surface for the screen — and it works as advertised: editable schedule, engine-bound projection, time-projected (default 5 rows = 5 years, user can extend), commit path, dirty-check on the commit button (no-op when not dirty). | `:1805-2137`; preset list `:1814-1819`; commit `:2126-2136` |
| MM-OVL-03 §5 Projected impact — sparkline + 4 tiles (Pot value · Total drawn · IHT with plan · IHT saved) | YES — `sippProjectionSeries` returns balance points over the schedule's `yearsAhead` | NA (display) | YES — `ihtDynamic` called twice (with + without schedule); delta computed | PASS | Time-projected, engine-bound, shows the path not a snapshot. | `:2074-2117` |
| MM-OVL-03 §4 four presets (Take nothing / Basic-rate band / SWR / GK) | YES (each preset applies to whole schedule) | YES (state mutation) | YES for SWR + GK (engine fns); HARDCODED for "basic-rate band" (£37,700 literal — not pulled from `rules-uk.js` / engine `TAX` constants) | FUNCTIONAL | £37,700 basic-rate band is **hardcoded in JSX**, not traced to rules. When the Budget moves the basic-rate band threshold, this preset will silently drift. Audit confirms seed MM-S-16/17 pattern extends to the schedule-editor presets. | `:1816` — `amount: 37700` literal |
| MM-OVL-03 §2 AA / MPAA / Carry Forward — 3 tiles (£60k / £10k MPAA / carryForward3yr) | NA (allowance display, not scenario) | NA | PARTIAL — `carryForward3yr` from entity, but £60k AA and £10k MPAA are hardcoded literals not traced to engine constants. Confirms seed MM-S-17. | FUNCTIONAL | Affects scenario correctness because `applyPreset('basic')` and the user's manual entries are sense-checked against these caps mentally — if they drift, the scenario is misleading. | `:1983-1987` |
| MM-OVL-03 §3 LSA / LSDBA / PCLS — 3 tiles (£268,275 / £1,073,100) | NA | NA | NO — hardcoded literals. Confirms seed MM-S-16. | FUNCTIONAL | Same drift risk as §2. | `:2003-2005` |
| DrawdownMatrixPanel — 0–£100k @ £5k step grid with 60% cliff chip | YES (each row is an annual £ withdrawal scenario; computes tax + IHT-saved + net for each level) | NO — table is read-only. No "pick this level → apply to schedule" handoff to PensionDrillDown. | YES — `drawdownMatrix(entity, ...)` | FUNCTIONAL | Genuinely engine-bound multi-scenario comparison — but the "Best fit £X" hint is decorative. User cannot select a row to seed the schedule editor. A4 (actionable) FAIL. | `:1561-1614` |
| Director-intelligence cards (MM-DIR-01..04 — pension headroom / salary-vs-dividend / S24 BTL / BPR clock) | NO — each surfaces a single recommended action without horizon path | YES — each card has a real `<button>` action (per FD-DIR-01 fix in inventory: `onNav('tax', {sub: 'ani'})`, `onNav('ask', {prefill: ...})`) | YES — derived from `aaLeft`, `salaryTooHigh`, `hasBTL`, `bprAssets` | PASS-CONDITIONAL | Buttons exist (good) but cards don't show "if you do X, your ANI/extraction-mix/IHT in 3 years would be Y". They are recommendations, not scenarios. Acceptable as a *priority list* but does not satisfy scenario-method rubric (no horizon). | `MyMoney.jsx` lines per inventory MM-DIR-* |
| FCA framing across all scenario surfaces (PensionDrillDown footer, screen footer) | NA | NA | NA | PASS | `BRAND.disclaimer` = "Not regulated financial advice. Verify decisions with a qualified UK financial adviser." renders inside PensionDrillDown at `:2139-2141` and at the screen footer. No "you should" phrasing found inside scenario panels. CliffEdgeWarning copy uses "would" / "by contributing X" — directional, not directive. Decumulation copy says "The optimal order for most people:" — borderline, since "optimal" implies advice; recommend softening to "the order most tax-efficient for most people" per FCA boundary. | `:2139-2141`; `:2447` ("optimal order" copy — soften) |

---

## Per-scenario breakdown (rubric)

**1. X28 view-mode "Scenario" pill (MM-X28-02)**
- options count: 0 (no scenario list)
- actionable? selector works; destination empty
- finances-bound? n/a — no content
- time-projected? n/a — no content
- FCA line? n/a
- **VERDICT: FAIL** — present-and-reachable trigger with no destination behind it (CTA honesty)

**2. CliffEdgeWarning (MM-CLF-01..03)**
- options: 1 implied scenario ("contribute to pension to fall below £100k")
- actionable? prose only — no button
- finances-bound? yes (ANI + AA from engine)
- time-projected? no — snapshot
- FCA line? yes (parent screen disclaimer)
- **VERDICT: FAIL** — needs CTA + projection

**3. CoI ranked panel (MM-COI-01/02)**
- options: top-4 ranked rows (decision-engine output)
- actionable? rows are not buttons; no route to owning surfaces
- finances-bound? yes (`totalCoI(entity)`)
- time-projected? no — £/yr static
- FCA line? parent screen disclaimer
- **VERDICT: FAIL** — A4 + A6 fail; also FD-CROSS-1 violation on top row

**4. DecumulationPanel (MM-DEC-01..06)**
- options: 1 prescribed order (GIA → ISA → Pension)
- actionable? no flip-the-order CTA; empty-state accessory is `<span>` not `<button>`
- finances-bound? yes
- time-projected? no
- FCA line? parent screen disclaimer; "optimal order" copy borderline
- **VERDICT: FAIL** — A3 (multi-option) + A4 + A6 fail

**5. DrawdownFrameworkPanel 5 cards (Bengen/GK/Bucket/Floor-Upside/CoI)**
- options: 5
- actionable? "Drill-down ›" header opens PensionDrillDown; cards themselves inert (`cursor: 'default'`)
- finances-bound? yes (5 engine fns)
- time-projected? 30-year aggregate per card; no per-method path chart
- FCA line? parent screen disclaimer
- **VERDICT: PARTIAL FAIL** — A4 fail (cards not selectable as presets)

**6. DrawdownMatrixPanel**
- options: ~20 rows (£0..£100k @ £5k)
- actionable? read-only table; "Best fit" hint not selectable
- finances-bound? yes (`drawdownMatrix(entity, ...)`)
- time-projected? per-row is annual snapshot, not a 30-year path
- FCA line? parent + `CausalityStripe sources={['Your data', BRAND.rulesVersion]}`
- **VERDICT: PARTIAL FAIL** — A4 fail

**7. PensionDrillDown §4 schedule editor + §5 projected impact (MM-OVL-03g/h/i)**
- options: 4 presets + free-form per-year edit + add/remove year
- actionable? yes — Commit fires `DRAWDOWN_SCHEDULE_SET`
- finances-bound? yes
- time-projected? yes — sparkline over `schedule.length` years, IHT delta
- FCA line? yes
- **VERDICT: PASS** — this is the scenario surface that works

**8. UFPLS / Flexi-access / Phased / Capped / Annuity (HMRC mechanism taxonomy)**
- options: 0 (absent)
- actionable? n/a
- finances-bound? n/a
- time-projected? n/a
- FCA line? n/a
- **VERDICT: FAIL** — A1 (present) fail; task brief explicitly required these 5 methods to be engine-derived not static, but they don't render at all

---

## Severity summary

- **DEMO-BLOCKING (4):**
  1. UFPLS/Flexi-access/Phased/Capped/Annuity absent (task-brief requirement)
  2. X28 "Scenario" mode pill has no content behind it (CTA honesty)
  3. CoI ranked panel rows are inert text not action buttons (FD-CROSS-1 violation on top row)
  4. CliffEdgeWarning has no enact-CTA + no projection
  5. MM-DEC-06 empty-state accessory is `<span>` (seed MM-S-11 confirmed)

- **FUNCTIONAL (6):**
  1. X28 future-mode only moves BS hero, not anchors/sparklines (MM-S-21)
  2. DecumulationPanel — prescribed order not multi-option scenario; no flip; no horizon
  3. DrawdownFrameworkPanel — 5 cards inert, only 4 of 5 methods reachable as presets in PensionDrillDown (Bengen, Bucket, Floor-Upside have no apply path)
  4. DrawdownMatrixPanel — read-only, no "select this row → seed schedule" handoff
  5. PensionDrillDown §4 "basic-rate band £37,700/yr" preset hardcoded — not engine-bound (drift risk)
  6. AA/MPAA/LSA/LSDBA literals hardcoded in §2/§3 metric tiles (MM-S-16/17 confirmed)

- **PASS (3):**
  1. PensionDrillDown §4 schedule editor + §5 projected impact (the working scenario surface)
  2. Director-intelligence card action buttons (real `<button>`, real `onNav` destinations)
  3. FCA framing — `BRAND.disclaimer` renders inside scenario overlay + screen footer; minor "optimal" softening recommended in DecumulationPanel copy

---

## Expected behaviour (for FAIL items)

| FAIL | Expected |
|------|----------|
| UFPLS/Flexi-access/Phased/Capped/Annuity missing | A "How would you take it?" panel inside PensionDrillDown that lets the user pick one of the 5 HMRC mechanisms; each derives projected tax + cashflow shape from the engine (not 5 prose paragraphs). Distinct surface from the withdrawal-strategy panel (Bengen / GK / Bucket / Floor-Upside / CoI). Spec calls for both. |
| X28 "Scenario" pill empty | Either (a) hide the pill until Wave 7 ships the scenario library, or (b) on tap show "No scenarios saved · Create one →" empty-state with a button that opens PensionDrillDown or a generic scenario builder. Currently the pill flips view-mode with no destination — broken promise. |
| CoI rows inert | Top row "Start pension drawdown (£412k)" → `<button>` → opens PensionDrillDown. Every other row routes to its owning surface (investments → InvestmentsDrillDown, etc.). Per FD-CROSS-1. |
| CliffEdgeWarning has no CTA | Add `<button>` "Model a £X contribution" → opens PensionDrillDown with a pre-filled schedule that drops ANI below £100k. Show 3-year ANI projection inside the warning, not a single snapshot. |
| MM-DEC-06 `<span>` accessory | Change to `<button>` with onClick that opens AddItemSheet pre-filtered to investment categories (so the user can add the first wrapper that unlocks the panel). |
| Future-mode partial wiring | All NW-displaying elements (MM-SCR-01 anchor, MM-BS-0c sparklines) must read `projection.value` not raw `nw` when `isProjected === true`. Currently only the BS hero hooks up. |
| DecumulationPanel single-answer | Add a sequence toggle ("GIA→ISA→Pension" vs "ISA→Pension→GIA" vs "Pension→ISA→GIA") that recomputes lifetime tax for each. Show 30-year horizon, not snapshot. |
| 5-method cards inert | Either (a) make each card a button that pre-loads the matching preset into the schedule editor (extend the 4-preset list to 5 by adding Bucket and Floor-Upside engine outputs as schedule patterns), or (b) link each card to a method-specific drill-down. |
| Matrix rows not selectable | Each row → onClick that fires `setSchedule(allRowsAt(r.drawdown))` and scrolls to PensionDrillDown §4. |
| £37,700 / £60k / £10k / £268,275 / £1,073,100 hardcoded | Pull from `rules-uk.js` or `TAX` constants exported from `src/engine/fq-calculator.js`. Same fix pattern as the other hardcoded literals. Status field on each constant ensures Budget updates flow through. |

---

## Coverage

Scenario rows checked: 12 distinct scenario surfaces (X28 windows, X28 view-mode, CliffEdgeWarning, CoI panel, DecumulationPanel, DrawdownFrameworkPanel, DrawdownMatrixPanel, PensionDrillDown §4 schedule, PensionDrillDown §5 projection, PensionDrillDown 4-preset bar, Director-intelligence 4 cards, FCA framing across all).
Total scenario surfaces on screen: 12.
**Coverage: 12 / 12 = 100% verified.**

Note on Wave 7: per-bucket What-If (lifting What-If from the Pension overlay onto every category tile) is documented as a Wave 7 deliverable. Its absence is FUTURE WORK, not a Pass-1 audit FAIL.

---

---

## Pass-1 rerun additions (2026-05-18 full code trace)

The prior pass identified the correct verdicts. This rerun adds two confirmed findings from tracing `fq-calculator.js` and `X28TopBar.jsx`:

**New finding A — `varianceFor` silent zero for forecast/scenario modes**

`varianceFor(entity, 'actual', 'scenario', window)` at `fq-calculator.js:1647–1671`:
- Only handles `mode2 === 'plan'` in its branch at line 1659.
- For `mode2 === 'forecast'` or `mode2 === 'scenario'`, falls through to `v2 = v1` → variance = 0.
- `VarianceBadge` at `MyMoney.jsx:260` returns null when variance = 0.
- Result: switching to Forecast or What-if mode produces **no badge, no number change** — visually identical to Today.
- This compounds MM-X28-02 FAIL: it isn't just that there's no scenario content, it's that even the variance badge that *should* signal mode difference silently disappears.
- Severity: DEMO-BLOCKING (extends MM-X28-02 finding).

**New finding B — X28 auto-switch logic is one-directional**

`pickWindow()` at `X28TopBar.jsx:127–139` auto-switches viewMode when the window's `defaultMode` differs from current mode. This means selecting "Lifetime" auto-switches to "plan" mode. However there is no reverse: switching mode back to "actual" does NOT reset the window. If user lands in "Lifetime + Plan", switches back to "Today", the window stays "Lifetime" — contradictory state. Minor UX defect; severity FUNCTIONAL.

---

## Return string

**MM scenario: 3 PASS, 11 FAIL + 2 new findings (4 DB, 6 F, 1 P). Confirmed 12/12 scenario surfaces covered.**
