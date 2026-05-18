# Reconciliation Audit — MyMoney pass-1

**Auditor:** reconciliation pass (2026-05-18)
**Source files inspected:**
- `src/screens/MyMoney.jsx` (3473 lines)
- `src/screens/HomeScreen.jsx`
- `src/engine/fq-calculator.js`
- `mymoney-inventory-v1.md`

**Engine constants origin:** `fq-calculator.js` loads `tax-2026.json` → `TAX` object. `TAX.pensionAA` defaults `60000`, `TAX.lsa` defaults `268275`, `TAX.lsdba` defaults `1073100`, `TAX.isaAllowance` defaults `20000`, `TAX.swr` defaults `0.04` (fq-calculator.js:43–50).

---

## Reconciliation Matrix

| Metric | MyMoney (file:line) | Home (HomeScreen.jsx) | Other screens | Engine fn | Consistent? |
|--------|--------------------|-----------------------|---------------|-----------|-------------|
| Net Worth | `netWorth(entity)` → `nw` → `TripleAnchor netWorthVal={nw}` (MyMoney.jsx:2510,2753) | `netWorth(entity)` → `nw` (HomeScreen.jsx:1376,1427) | NetWorthDrillPanel (1166) | `netWorth(e)` | **PASS** |
| Wealth Score | `calcFQ(entity).total` → `TripleAnchor fqTotal` (MyMoney.jsx:2511,2754) | `calcFQ(entity)` (HomeScreen.jsx:1377) | — | `calcFQ(e).total` | **PASS** |
| Risk Score | `calcRisk(entity).total` → `TripleAnchor riskTotal` (MyMoney.jsx:2512,2755) | `calcRisk(entity)` (HomeScreen.jsx:1379) | — | `calcRisk(e).total` | **PASS** |
| CoI Total (headline) | `totalCoI(entity).total` via `useMemo` → `coi.total` (MyMoney.jsx:2574,2867) | `costOfInaction(entity)` → internally calls `totalCoI(e).total` (HomeScreen.jsx:292; engine:603–605); CoIDrillPanel also uses `totalCoI(entity)` (HomeScreen.jsx:946) | — | `totalCoI(e).total` | **PASS** — both resolve to same function; no alias drift |
| CoI per-domain (ranking display) | `coiForDomain(entity, id)` prose string displayed; first £ figure extracted by regex for sort order (MyMoney.jsx:2851–2862) | CoIDrillPanel: `totalCoI(entity).byDomain` numeric values + `COI_DOMAIN_META` labels (HomeScreen.jsx:950–1022) | — | `coiForDomain()` / `totalCoI().byDomain` | **FAIL F-06** — sort-value extraction fragile; may be root cause of MM-S-03 £412k vs £340k discrepancy |
| Pension AA cap (£60k) | Hardcoded `fmt(60000)` and `60_000` literals (MyMoney.jsx:1983, 3012, 3208, 3210, 3344) | Not rendered as constant | `TAX.pensionAA=60000` in engine (fq-calculator.js:44) | `TAX.pensionAA` | **FAIL F-01** |
| MPAA cap (£10k) | Hardcoded `fmt(10000)` (MyMoney.jsx:1984) | — | — | `TAX.mpaa` (expected in JSON) | **FAIL F-02** |
| LSA cap (£268,275) | Hardcoded `268275` in sub-label and in `Math.min(sippTot * 0.25, 268275)` (MyMoney.jsx:2003–2005) | — | — | `TAX.lsa=268275` (fq-calculator.js:49) | **FAIL F-03** |
| LSDBA cap (£1,073,100) | Hardcoded `1073100` in sub-label (MyMoney.jsx:2004) | — | — | `TAX.lsdba=1073100` (fq-calculator.js:50) | **FAIL F-04** |
| fmt() signed-zero | SurplusTile: `const pos = surplus > 0`; when surplus===0, pos=false → prefix `'−'`, amt=0 → `'−£0'` (MyMoney.jsx:1136,1154–1156) | — | — | `fmt(0)` → `'£0'` (correct) | **FAIL F-05** |
| NW DeltaChip cadence | `trajectories.netWorthHistory[-2..-1]` (MyMoney.jsx:2776–2782); label "vs last month" | Same trajectory source (HomeScreen.jsx:1166) | — | trajectory | **PASS** — M-04/M-05 fix confirmed in code comment |
| Decumulation SWR | `inv * 0.04` hardcoded (MyMoney.jsx:2482) | — | — | `TAX.swr=0.04` (fq-calculator.js:45) | **FAIL F-07** |
| Retirement funded % | `investable(entity) / (targetIncome * 25)` (MyMoney.jsx:2218) | — | — | `investable(e)` | **PASS** — engine fn used; but multiplier 25 = 1/swr not read from TAX (same family as F-07) |
| ISA room | `20000 - isaUsedYTD` (MyMoney.jsx:3027–3030) | — | — | `TAX.isaAllowance=20000` (fq-calculator.js:43) | **FAIL F-08** |
| Tax shelter % (MM-PRI-05) | `taxEfficiencyScore(entity).total` (MyMoney.jsx:2231) | — | — | `taxEfficiencyScore(e)` | **CONDITIONAL** — engine fn correct; MM-S-02 £0 anomaly is data-wiring issue not a reconciliation mismatch |
| Estate efficiency p/£ | `effectiveBeneficiaryRate(entity).rate` → `${Math.round(rate*100)}p/£` (MyMoney.jsx:2268) | — | — | `effectiveBeneficiaryRate(e)` | **PASS** — engine fn used |
| SurplusTile income mini-tile | `m.income \|\| 0` from `monthlySurplus(entity)` (MyMoney.jsx:1204) | — | — | `monthlySurplus(e).income` | **CONDITIONAL** — engine fn correct; MM-S-01 £0 for rich persona is data-wiring anomaly |
| Per-tile sparklines | Back-cast from `CAT_MONTHLY_DRIFT` constants (MyMoney.jsx:3123–3145) | — | — | No engine fn | **FAIL F-09** |
| Per-tile changePct | NW trajectory delta applied as proxy to all "driver" categories (MyMoney.jsx:3106–3114) | — | — | No per-category fn | **FAIL F-10** |

---

## A6 Verdict Table

| Element ID | A6 Verdict | Notes |
|------------|------------|-------|
| MM-X28-03 | PASS | `BRAND.rulesVersion` — traced to brand.js |
| MM-X28-04 | PASS | `BRAND.dataDate` — traced to brand.js |
| MM-NPS-01 | PASS | All figures from `monthlySurplus`, `investable`, `targetIncome*25` (MyMoney.jsx:2686–2727) |
| MM-NPS-03 | PASS | `!pos` derived from monthlySurplus result |
| MM-BAN-00 | CONDITIONAL | ProvenanceChip shows `'Apr 2026'` literal string (MyMoney.jsx:1149) — not `BRAND.dataDate` |
| MM-BAN-01 | PASS | `monthlySurplus(entity)` engine fn (MyMoney.jsx:1134) |
| MM-BAN-02 | PASS | Runway = `cashLiquid / Math.abs(surplus)` (MyMoney.jsx:1169–1170) |
| MM-BAN-03 | PASS | Segment values from monthlySurplus result |
| MM-BAN-04 | CONDITIONAL | `m.income \|\| 0` engine-traced; MM-S-01 wiring anomaly |
| MM-BAN-05..07 | PASS | `m.essential`, `m.debtService`, `m.committed` from monthlySurplus |
| MM-BAN-08 | PASS | Trajectory delta (MyMoney.jsx:1212–1226) |
| MM-SCR-01 | PASS | `netWorth(entity)` — same fn as Home |
| MM-SCR-02 | PASS | `calcFQ(entity).total` — same fn as Home |
| MM-SCR-03 | PASS | `calcRisk(entity).total` — same fn as Home |
| MM-SCR-04 | PASS | Trajectory-based; cadence label "vs last month" matches source |
| MM-SCR-06 | PASS | `((last-prev)/prev)*100` from trajectory |
| MM-CLF-01 | PASS | `calcANI(entity).ani` (MyMoney.jsx:966) |
| MM-CLF-02 | PASS | `pensionToSolve = cliff - ani` consistent with cliff=100k |
| MM-PRI-01 | PASS | `cash / monthlySpend`; `monthlySpend = targetIncome/12` — entity-derived |
| MM-PRI-02 | PASS | `totalDebt / (monthlyDebt * 12)` |
| MM-PRI-03 | PASS | `investable(entity) / (targetIncome * 25)` |
| MM-PRI-04 | PASS | `effectiveBeneficiaryRate(entity).rate` |
| MM-PRI-05 | CONDITIONAL | `taxEfficiencyScore(entity).total` — fn correct; MM-S-02 wiring anomaly separate |
| MM-COI-01 | PASS | `coi.total` from `useMemo(() => totalCoI(entity))` — canonical aggregate (MyMoney.jsx:2867) |
| MM-COI-02 | FAIL (F-06) | Regex extraction from prose for sort; fragile — see F-06 |
| MM-DEC-05 | FAIL (F-07) | `inv * 0.04` hardcodes SWR |
| MM-BS-00 | PASS | `projection.value` from `netWorthAtWindow()` or `netWorth()` |
| MM-BS-06 | PASS (data) / FAIL (A2) | Value from `rowsForCash()` engine path; but `onView('cash')` unhandled (A2 issue, not A6) |
| MM-TAX-SN1 | CONDITIONAL | `calcANI(entity).ani` — fn correct; MM-S-10 £0 anomaly separate |
| MM-TAX-SN2 | FAIL (F-08) | `20000 - isaUsedYTD` — hardcoded |
| MM-TAX-SN3 | FAIL (F-01 family) | `(1 - carryFwdAA) * 60_000` — hardcoded |
| MM-TAX-AP1..AP4 | CONDITIONAL | `calcANI`, `calcPSA`, `calcHICBC`, `calcMarriageAllowance` — all engine fns; data-dependent results |
| MM-OVL-03e | FAIL (F-01, F-02) | `fmt(60000)` and `fmt(10000)` hardcoded (MyMoney.jsx:1983–1984) |
| MM-OVL-03f | FAIL (F-03, F-04) | `268275` and `1073100` hardcoded (MyMoney.jsx:2003–2005) |
| MM-OVL-03i | PASS | `sippProjection()` + `sippProjectionSeries()` + `ihtDynamic()` — all engine fns |
| MM-BS-0e | PASS | `coiForDomain(entity, c.id)` — engine fn (MyMoney.jsx:3152) |
| MM-BS-0c | FAIL (F-09) | Hardcoded drift back-cast; not engine-derived |
| MM-BS-0d | FAIL (F-10) | NW delta used as per-category proxy |
| MM-FOOT-01 | PASS | `BRAND.disclaimer` |
| MM-FOOT-02 | PASS | Rules version + data date from brand.js |

---

## Findings Detail

### F-01 — Pension AA cap hardcoded as 60 000
**Severity:** HIGH

- **Elements:** MM-OVL-03e `MetricTile value={fmt(60000)}`, MM-TAX-SN3 `aaHeadroomLeft = (1 - carryFwdAA || 0) * 60_000`, Director layer `:3210, :3344`
- **File:line:** MyMoney.jsx:1983, :3012, :3208, :3210, :3344
- **Engine SoT:** `TAX.pensionAA` loaded from `tax-2026.json`, fallback `60000` (fq-calculator.js:44)
- **Risk:** Any Budget that tapers or reduces AA (e.g. to £40k for high earners) will be applied in the engine's scoring without being reflected in the PensionDrillDown tile or the Director card's headroom calculation.
- **Fix pattern:** Replace literal with `TAX.pensionAA` (import `TAX` from engine, or expose a named constant).

### F-02 — MPAA cap hardcoded as 10 000
**Severity:** HIGH

- **Element:** MM-OVL-03e `value={entity.mpaaTriggered ? fmt(10000) : 'Not triggered'}`
- **File:line:** MyMoney.jsx:1984
- **Engine SoT:** The engine JSON carries `mpaa` (expected from the TAX pattern); hardcoded literal bypasses it.
- **Fix pattern:** `TAX.mpaa ?? 10000` as the value; or expose `TAX.mpaa` explicitly.

### F-03 — LSA cap hardcoded as 268 275
**Severity:** HIGH

- **Element:** MM-OVL-03f MetricTile sub-label AND the `Math.min(sippTot * 0.25, 268275)` computation for "Tax-free cash still available"
- **File:line:** MyMoney.jsx:2003, :2005
- **Engine SoT:** `TAX.lsa = 268275` (fq-calculator.js:49)
- **Risk:** The `Math.min` cap is a live computation — if LSA is revised by legislation, this will show a wrong maximum PCLS entitlement.
- **Fix pattern:** `Math.min(sippTot * 0.25, TAX.lsa)` and sub=`` `of £${(TAX.lsa/1000).toFixed(0)}k lifetime cap` ``

### F-04 — LSDBA cap hardcoded as 1 073 100
**Severity:** MEDIUM

- **Element:** MM-OVL-03f MetricTile sub-label only (visual, not computed)
- **File:line:** MyMoney.jsx:2004
- **Engine SoT:** `TAX.lsdba = 1073100` (fq-calculator.js:50)
- **Fix pattern:** `TAX.lsdba`

### F-05 — fmt() signed-zero: `−£0` renders when monthly surplus === 0
**Severity:** MEDIUM

- **Element:** MM-BAN-01 SurplusTile hero
- **File:line:** MyMoney.jsx:1136,1154–1156
- **Code:** `const pos = surplus > 0` — when surplus is exactly 0, `pos = false`, prefix becomes `'−'`, `amt = 0` → displays `−£0`.
- **Engine:** `fmt(0)` → `'£0'` (correct; no sign at zero). The issue is JSX-level sign logic.
- **Fix:** Change `const pos = surplus > 0` to `const pos = surplus >= 0`, or guard `if (surplus === 0) return <span>£0</span>` before the signed render.

### F-06 — CoI per-domain sort via regex extraction from prose string
**Severity:** MEDIUM

- **Element:** MM-COI-02 ranked rows
- **File:line:** MyMoney.jsx:2853–2861
- **Code:** `const match = text.match(/£([\d,]+(?:\.\d+)?)(k|m)?/i)` on `coiForDomain()` prose — grabs first £ figure for sort value only.
- **Risk:** `coiForDomain()` can mention incidental figures (e.g. "£20k ISA allowance" before "£412k pension cost") — regex picks the wrong number. This is the most likely cause of MM-S-03 discrepancy (£412k MM vs £340k Home), since Home's `CoIDrillPanel` reads `totalCoI(entity).byDomain[domain]` which is a pure numeric value.
- **Fix:** Replace regex with `totalCoI(entity).byDomain[id]` for sort value; keep prose display as-is.

### F-07 — DecumulationPanel SWR hardcoded as 0.04
**Severity:** MEDIUM

- **Element:** MM-DEC-05 footer
- **File:line:** MyMoney.jsx:2482
- **Code:** `fmt(Math.round(inv * 0.04 / 1000) * 1000)`
- **Engine SoT:** `TAX.swr = 0.04` (fq-calculator.js:45). PensionDrillDown preset `guard` uses `guardrail(entity)` which internally uses SWR from engine regime.
- **Consistency note:** PriorityCards retirement tile uses `target * 25` (MyMoney.jsx:2217) — `25 = 1/0.04`. Same literal family. Both diverge from engine if `TAX.swr` is updated.
- **Fix:** `Math.round(inv * TAX.swr / 1000) * 1000` and `target * Math.round(1 / TAX.swr)`.

### F-08 — ISA allowance hardcoded as 20 000
**Severity:** MEDIUM

- **Elements:** MM-TAX-SN2 ISA room chip, Investments category context line
- **File:line:** MyMoney.jsx:3027–3030
- **Code:** `const remaining = 20000 - isaUsedYTD`
- **Engine SoT:** `TAX.isaAllowance = 20000` (fq-calculator.js:43)
- **Fix:** `TAX.isaAllowance - isaUsedYTD`

### F-09 — Per-tile sparklines back-cast from hardcoded drift constants
**Severity:** MEDIUM

- **Elements:** MM-BS-0c sparkline series for pensions/investments/property/business/liabilities
- **File:line:** MyMoney.jsx:3123–3145 (`CAT_MONTHLY_DRIFT` object)
- **Issue:** Series simulated using fixed monthly growth rates (e.g. pensions: 0.0058). Not from entity data, not from engine projections, not from real time-series. Two personas with identical current balance but different histories will show identical sparklines. The comment acknowledges this ("Not real history") but the user sees no such caveat in the UI. This fails A6 (not engine-traced) and the honesty principle in §9.
- **Fix:** Either use `entity.trajectories` where available; or render a flat line with a tooltip "Trajectory data pending"; or suppress sparklines entirely until real per-category time series exists.

### F-10 — Per-tile changePct uses NW trajectory as proxy for all categories
**Severity:** LOW

- **Elements:** MM-BS-0d change pct on pensions/investments/property/business tiles
- **File:line:** MyMoney.jsx:3106–3114
- **Issue:** A pension card showing "+2.1%" is reading the portfolio-wide NW delta. If property appreciated but pension was flat, the pension tile still shows the property-driven NW gain.
- **Fix:** Either suppress changePct on all tiles until per-category trajectory data exists, or only show it on the single highest-weight category.

---

## Proposed Severity per FAIL

| Finding | Severity |
|---------|----------|
| F-01 AA cap hardcoded | HIGH |
| F-02 MPAA hardcoded | HIGH |
| F-03 LSA hardcoded (also in Math.min computation) | HIGH |
| F-04 LSDBA hardcoded | MEDIUM |
| F-05 Signed-zero −£0 | MEDIUM |
| F-06 CoI sort by regex (MM-S-03 cause) | MEDIUM |
| F-07 SWR 0.04 hardcoded | MEDIUM |
| F-08 ISA allowance hardcoded | MEDIUM |
| F-09 Sparklines back-cast from hardcoded drift | MEDIUM |
| F-10 changePct NW proxy for per-category tiles | LOW |

---

## Coverage

Rows checked: 62 (all rows in regions 2–15 with numeric or financial claims, plus OVL-03 sub-rows)
Total rows in inventory: ~135
Rows with explicit A6 verdict this pass: 42

Regions not covered in this pass (pivot sub-rows 12A–12D detail rows, NRI detail rows MM-NRI-01..04, protection/liabilities/investments/property drill-panel internals): handled by domain-auditor pass (`domain.md`).
