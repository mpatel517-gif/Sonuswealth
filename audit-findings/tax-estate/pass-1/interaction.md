# Tax & Estate — Interaction & Drill-down Audit · Pass 1

**Auditor:** interaction-auditor (A2/A3/A4 only)
**Component:** `src/screens/TaxEstate.jsx` + `src/components/TaxEstate/InheritanceStory.jsx` + `src/components/Estate/BeneficiarySankey.jsx`
**Drill router:** `src/engine/driver-engine.js` (`driver()` switch) + `src/screens/Dashboard.jsx` (`pushDetail` → `DetailOverlay`)
**Date:** 2026-05-18
**FD locked:** FD-CROSS-1 — T&E owns the *consequence* (IHT stacking, 2027 pension-IHT, year-by-year projection); the *doing* surface is MyMoney/Cashflow.
**Coverage:** 227 / 227 rows reviewed (every inventory row touched; sub-row groups verified jointly).

---

## §0 — Cross-cutting finding: the drill router has no handlers for the metrics T&E pushes

`Dashboard.jsx:622` resolves every drill via `driver(entity, metric)`. The switch in `src/engine/driver-engine.js:39-49` only handles:

- `netWorth`, `wealthScore`, `riskScore`, `monthlySurplus`, `coi`

Every other metric falls to `terminal(metric, 0, 'Driver tree pending')` (line 48). That means **every drill T&E pushes that is not one of those five lands on a placeholder "Driver tree pending" frame** inside DetailOverlay. That is not SOURCE, not ACTION, not DECISION — it is a describe-only dead-end. **A4 = FAIL across the board for these targets.**

Affected metrics pushed from T&E:

| Metric pushed | Pusher | Inventory IDs | Drill outcome |
|---|---|---|---|
| `plan:estate` / `plan:gift` / `plan:tax` | `PlanStalenessAccordion.onReview` (TaxEstate.jsx:2369, 2464) | TE-PLAN-05 | `terminal('plan:estate', 0, 'Driver tree pending')` |
| `beneficiaries` | *would be* pushed by `InheritanceStory` line `cta='beneficiaries'` | TE-EST-IS-10 | unreachable — see S-01 (A2 FAIL, not even pushed) |
| `netWorth`, `wealthScore` | TripleAnchor (TaxEstate.jsx:2358-2359) | TE-ANCH-01, TE-ANCH-02 | Handled — drvNetWorth / drvWealthScore PASS |

So even fixing S-01 (wiring `onDrillMetric` into `InheritanceStory`) buys an A2 PASS but still leaves an A4 FAIL because `beneficiaries` has no driver. This is the load-bearing finding for this pass.

---

## §1 — Verdict table

Columns: A2 (handler exists & fires) · A3 (lands on owns-subject surface) · A4 (coherent SOURCE/ACTION/DECISION) · Severity per FAIL · Finding · Evidence (`file:line`).
`–` = NA for that assertion (e.g. non-interactive data row → A2/A3/A4 = NA).

### Region 1 — Shell / chrome / header

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-CHR-01 | PASS | PASS | PASS | – | `onClick={onHome}` → goHome → tab='home'. Lands on Home. | TaxEstate.jsx:2324; Dashboard.jsx:294 |
| TE-CHR-02 | – | – | – | – | Display-only chip; no handler intended. | TaxEstate.jsx:2333 |
| TE-CHR-03 | UNVERIFIED-NONBLOCKING | – | – | – | X28TopBar window selector wired via setX28Window; no downstream consumer found in T&E (numbers do not change). Out of scope for interaction-auditor (reconciliation issue). | TaxEstate.jsx:2340-2347 |
| TE-CHR-04 | UNVERIFIED-NONBLOCKING | – | – | – | viewMode setter wired; no downstream effect visible in T&E component tree. | TaxEstate.jsx:2340-2347 |
| TE-CHR-05 | – | – | – | – | Display-only. | n/a |
| TE-CHR-06 / 07 | – | – | – | – | Disclaimer text. | TaxEstate.jsx:2544-2546 |

### Region 2 — Triple anchor

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-ANCH-01 | PASS | PASS | PASS | – | `onNetWorthTap → onDrillMetric('netWorth')` → `driver()` returns `drvNetWorth` (assets + liabilities split). SOURCE. | TaxEstate.jsx:2358; driver-engine.js:54 |
| TE-ANCH-02 | PASS | PASS | PASS | – | `onWealthTap → 'wealthScore'` → `drvWealthScore` (8 dims). SOURCE. | TaxEstate.jsx:2359; driver-engine.js:73 |
| TE-ANCH-03 | PASS | PASS | PASS | – | `onRiskTap = onOpenRisk` → setShowRiskOverlay(true). Lands on Risk overlay. | TaxEstate.jsx:2360; Dashboard.jsx:504 |

### Region 3 — Plan staleness banner / accordion

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-PLAN-01 | UNVERIFIED-NONBLOCKING | – | – | – | Single-banner path renders `<PlanStalenessBanner>` — its internal CTA wiring is the shared banner, not in this file. Inventory marks NA / ACTION via Review. | TaxEstate.jsx:1539-1541 |
| TE-PLAN-02 | PASS | – | – | – | Button toggles `open` state. | TaxEstate.jsx:1547 |
| TE-PLAN-03 | – | – | – | – | Display-only label string. | TaxEstate.jsx:1572 |
| TE-PLAN-04 | PASS | – | – | – | Chevron rotates with `open`. | TaxEstate.jsx:1578 |
| TE-PLAN-05 | PASS | PASS | **FAIL** | **DEMO-BLOCKING** | `onReview={p => onDrillMetric('plan:' + p.type)}` fires, routes via Dashboard.pushDetail → driver(). `driver()` switch has no `plan:*` case → `terminal('plan:estate', 0, 'Driver tree pending')`. Lands on placeholder, not on a DECISION (plan-review surface). Affects estate / gift / tax. | TaxEstate.jsx:2369, 2464; driver-engine.js:48 |

### Region 4 — Sub-tab segmented control

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-TAB-01 | PASS | PASS | PASS | – | `onClick → onChange('tax')` → setSubTab; persists to localStorage. | TaxEstate.jsx:257; 2374-2378 |
| TE-TAB-02 | PASS | PASS | PASS | – | Same handler, value `estate`. | TaxEstate.jsx:257 |
| TE-TAB-03 | – | – | – | – | Badge is a count display, not interactive. | TaxEstate.jsx:284 |
| TE-TAB-04 | – | – | – | – | Display. | TaxEstate.jsx:284 |

### Region 5 — Sub-anchor strip

`SubAnchorStrip` only renders as a `<button>` when `cell.onTap` is a function (TaxEstate.jsx:299). Otherwise it is a div with no handler.

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-SUB-T1 | **FAIL** | – | – | **FUNCTIONAL** | `subAnchorTax.a` has no `onTap` (TaxEstate.jsx:2256). Renders as `<div>`. Inventory expects SOURCE (`te_taxThisYear` breakdown). Tap is dead. | TaxEstate.jsx:2256 |
| TE-SUB-T1a | – | – | – | – | DiffBadge is a status chip, non-interactive by design. | TaxEstate.jsx:2258 |
| TE-SUB-T2 | **FAIL** | – | – | **FUNCTIONAL** | `subAnchorTax.b` (ANI) has no `onTap`. Inventory expects drill to TE-TAX-ANI-*. Dead. | TaxEstate.jsx:2260 |
| TE-SUB-T2a | – | – | – | – | Warning sub-line. | TaxEstate.jsx:2261 |
| TE-SUB-T3 | **FAIL** | – | – | **FUNCTIONAL** | `subAnchorTax.c` (Allowances) has no `onTap`. Inventory expects drill to AllowanceDrillPanel. Dead. | TaxEstate.jsx:2262 |
| TE-SUB-E1 | **FAIL** | – | – | **FUNCTIONAL** | `subAnchorEstate.a` (IHT today) has no `onTap`. Inventory expects drill to IHTDrillPanel. The single anchor most likely to be tapped on the Estate sub-tab is dead. | TaxEstate.jsx:2286 |
| TE-SUB-E2 | **FAIL** | – | – | **FUNCTIONAL** | `subAnchorEstate.b` (Family receives) has no `onTap`. Inventory expects drill to BeneficiaryChain / IHTDrillPanel. Dead. | TaxEstate.jsx:2287 |
| TE-SUB-E3 | PASS | PASS | PASS | – | `onTap: scrollToIHTDual` → ref.scrollIntoView. Lands on IHTDualNumber card. Coherent — SOURCE in context. | TaxEstate.jsx:2294, 2166-2168 |
| TE-SUB-E3a / E3b | – | – | – | – | Status chip + sub-line. | TaxEstate.jsx:2277-2293 |

### Region 6 — NRI banner

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-NRI-01 | – | – | – | – | Static info banner; no CTA intended. | TaxEstate.jsx:358 |

### Region 7 — Tax summary

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-TAX-SUM-01 | – | – | – | – | Title. | TaxEstate.jsx:396 |
| TE-TAX-SUM-02 | – | – | – | – | Sub-line text. | TaxEstate.jsx:397 |
| TE-TAX-SUM-03 | UNVERIFIED-NONBLOCKING | – | – | – | `<ProvenanceChip>` interactivity is shared-component scope. | TaxEstate.jsx:398 |
| TE-TAX-SUM-04 | **FAIL** | – | – | **FUNCTIONAL** | StatTile with no onClick/onTap. Inventory expects drill to IncomeTaxDetail. Income-tax tile is dead. | TaxEstate.jsx:405-409 |
| TE-TAX-SUM-05 | **FAIL** | – | – | **FUNCTIONAL** | Dividend tile dead. | TaxEstate.jsx:410-414 |
| TE-TAX-SUM-06 | **FAIL** | – | – | **FUNCTIONAL** | CGT tile dead. (Note: a separate "Detail ›" L3 chip exists on the CGTDetail card lower, but the summary tile itself is not drillable, which the inventory flags.) | TaxEstate.jsx:415-419 |
| TE-TAX-SUM-07 | **FAIL** | – | – | **FUNCTIONAL** | NIC tile dead. | TaxEstate.jsx:420-424 |
| TE-TAX-SUM-08 | – | – | – | – | Total strip non-interactive in inventory. | TaxEstate.jsx:426-436 |

### Region 8 — Income tax detail

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-TAX-IT-01 | – | – | – | – | Title. | TaxEstate.jsx:462 |
| TE-TAX-IT-02 | UNVERIFIED-NONBLOCKING | – | – | – | ExplainerChip TE-1; behaviour owned by shared component. | TaxEstate.jsx:466 |
| TE-TAX-IT-03 | – | – | – | – | Banner. | TaxEstate.jsx:469 |
| TE-TAX-IT-04 | – | – | – | – | SteppedBandsChart bars have `title` tooltips only, no per-bar click. Inventory flags A2 risk; consistent with non-interactive intent of chart visualisation. Not a FAIL by itself — drill is reachable via the surrounding card. | TaxEstate.jsx:530-540 |
| TE-TAX-IT-05 | – | – | – | – | Per-band rows non-interactive; consistent with chart. | TaxEstate.jsx:493 |

### Region 9 — ANI stepwise

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-TAX-ANI-01..07 | – | – | – | – | Rows render as `<div>` only (TaxEstate.jsx:568). Inventory marks SOURCE / NA — the *card itself* is the SOURCE breakdown, so individual rows do not need their own drill. PASS for the design as inventoried. | TaxEstate.jsx:568-590 |

### Region 10 — Salary sacrifice

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-TAX-SS-01 | – | – | – | – | Title. | TaxEstate.jsx:607 |
| TE-TAX-SS-02 | – | – | – | – | Display. | TaxEstate.jsx:612 |
| TE-TAX-SS-03 | PASS | PASS | **FAIL** | **FUNCTIONAL** | Slider fires `setSac` and updates `nic = te_nicsDetail(entity, sac)` *within this card only*. Triple anchor + CoI above do not move while user slides — inventory S-26 confirms. Inventory destination is DECISION (sacrifice scenario). What renders is an in-card preview, not a scenario you can commit. Severity = FUNCTIONAL (matches S-26). | TaxEstate.jsx:600, 614-618 |
| TE-TAX-SS-04 | – | – | – | – | Conditional banner. | TaxEstate.jsx:620-633 |

### Region 11 — CGT detail

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-TAX-CGT-01 / 02 | – | – | – | – | Title + bar. | TaxEstate.jsx:648-657 |
| TE-TAX-CGT-03 / 04 | **FAIL** | – | – | **FUNCTIONAL** | Tiles non-interactive. Inventory expects drill to CGTDrillPanel — only reachable via the screen-level "Detail ›" chip, not by tapping the figure itself. | TaxEstate.jsx:659-660 |
| TE-TAX-CGT-05 | – | – | – | – | Static chip. | TaxEstate.jsx:663 |
| TE-TAX-CGT-06 | **FAIL** | – | – | **FUNCTIONAL** | "Bed-and-ISA opportunity" rendered via `<Chip>` with no onClick. Inventory expects ACTION (bed-and-ISA flow). Status chip pretending to be a CTA. Matches seed S-20. | TaxEstate.jsx:665 |
| TE-TAX-CGT-07 | **FAIL** | – | – | **FUNCTIONAL** | "Spousal transfer headroom" chip non-interactive. Should drill. | TaxEstate.jsx:668 |
| TE-TAX-CGT-08 | PASS | PASS | PASS | – | `setDrillView('cgt')` → renders CGTDrillPanel as full-screen overlay. Coherent SOURCE. | TaxEstate.jsx:2397-2408 |

### Region 12 — Dividend detail

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-TAX-DIV-01..06 | – | – | – | – | Static rate chips + display. (Reconciliation flagged elsewhere as S-14.) | TaxEstate.jsx:694-704 |
| TE-TAX-DIV-07 | **FAIL** | – | – | **FUNCTIONAL** | "Move to ISA saves £X" is a `<div>` info banner, no onClick. Inventory expects ACTION (move-to-ISA flow). Banner pretending to be a CTA. Matches seed S-20. | TaxEstate.jsx:706-716 |

### Region 13 — Allowances strip

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-TAX-ALL-01..06 | – | – | – | – | Card-level drill exists (TE-TAX-ALL-08); per-row tap not required by inventory. | TaxEstate.jsx:736-754 |
| TE-TAX-ALL-07 | – | – | – | – | Horizon banner static. | TaxEstate.jsx:756 |
| TE-TAX-ALL-08 | PASS | PASS | PASS | – | `setDrillView('allowances')` → AllowanceDrillPanel. SOURCE. | TaxEstate.jsx:2414-2425 |

### Region 14 — Self Assessment

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-TAX-SA-01 / 02 / 03 | – | – | – | – | Display tiles. SA has no drill destination inventoried beyond display. | TaxEstate.jsx:778-784 |

### Region 15 — Drawdown matrix

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-TAX-DD-01 / 02 | – | – | – | – | Title + sticky header. | TaxEstate.jsx:799-815 |
| TE-TAX-DD-03 | **FAIL** | – | – | **FUNCTIONAL** | Rows render `<div>` (TaxEstate.jsx:824), no onClick. Inventory says SOURCE — drawdown scenario projection; A2 expects rows to be tappable. Dead. (Note: per FD-CROSS-1 the *doing* surface is MyMoney/Cashflow — even so, T&E rows should at least drill to scenario detail or hand off to the canonical surface; currently they do neither.) | TaxEstate.jsx:824 |
| TE-TAX-DD-04..08 | – | – | – | – | Visual highlights / chip / column values. | TaxEstate.jsx:830-854 |

### Region 16 — Non-Dom

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-TAX-ND-01..03 | – | – | – | – | Display blocks only; inventory marks SOURCE without per-block tap requirement. | TaxEstate.jsx:872-898 |

### Region 17 — Inheritance Story

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-EST-IS-01..09 | – | – | – | – | Narrative lines without `cta` — non-interactive by component design. | InheritanceStory.jsx:38-113 |
| TE-EST-IS-10 | **FAIL** | – | – | **DEMO-BLOCKING** | Line has `cta='beneficiaries'`, but parent renders `<InheritanceStory entity={entity} />` with **no `onDrillMetric` prop** (TaxEstate.jsx:2438). Button's onClick is `() => l.cta && onDrillMetric?.(l.cta)` — optional-chains to undefined → no-op. Tap dies. **Confirms seed S-01.** Even if wired, A4 would fail (driver-engine has no `beneficiaries` handler → "Driver tree pending"). Two-layer dead. | TaxEstate.jsx:2438; InheritanceStory.jsx:144; driver-engine.js:48 |
| TE-EST-IS-11 | – (copy) | – | – | – | Footer hint promises "tap any line" — misleading given S-01. A5 finding (out of scope here). | InheritanceStory.jsx:181-183 |

### Region 18 — Estate plan badge

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-EST-PB-01 / 02 | – | – | – | – | Static. | TaxEstate.jsx:1605-1614 |
| TE-EST-PB-03 | **FAIL** | – | – | **FUNCTIONAL** | "No plan yet" chip rendered as static `<Chip tone='warn' outline>` (line 1616) with no onClick. Inventory: NA / ACTION (CTA to create plan). Render-level dead. | TaxEstate.jsx:1616 |

### Region 19 — Estate CoI odometer

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-EST-COI-01 | UNVERIFIED-NONBLOCKING | – | – | – | `<CoIOdometer>` rendered without explicit onClick prop from this surface. Drill behaviour, if any, is owned by the shared component. Reconciliation issue (S-16) sits with reconciliation-auditor. | TaxEstate.jsx:1518-1525 |
| TE-EST-COI-02..05 | – | – | – | – | Sub-lines / visuals. | TaxEstate.jsx:1517 |

### Region 20 — IHT dual-number card

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-EST-IHT-01 / 02 | – | – | – | – | Title + ExplainerChip (shared comp scope). | TaxEstate.jsx:951-954 |
| TE-EST-IHT-03 | **FAIL** | – | – | **FUNCTIONAL** | "Today" tile is a `<FadeInOnMount>` div with no onClick. The big animated IHT-due number is the most-stareable element on the Estate sub-tab — and it is dead. Drill is reachable only via the "Breakdown ›" chip in the top-right of the card. | TaxEstate.jsx:959-998 |
| TE-EST-IHT-04..06 | – | – | – | – | Sub-tile contents. | TaxEstate.jsx:987-997 |
| TE-EST-IHT-07 | **FAIL** | – | – | **FUNCTIONAL** | "After 6 Apr 2027" tile likewise has no onClick. Same finding as TE-EST-IHT-03. | TaxEstate.jsx:959-998 |
| TE-EST-IHT-08..10 | – | – | – | – | Sub-content. | TaxEstate.jsx:987-997 |
| TE-EST-IHT-11 | – | – | – | – | Gauge bar. | TaxEstate.jsx:1003-1018 |
| TE-EST-IHT-12 | PASS | PASS | PASS | – | `setDrillView('iht')` → IHTDrillPanel. SOURCE. | TaxEstate.jsx:2444-2455 |

### Region 22 — Will & LPA

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-EST-WL-01 / 02 | – | – | – | – | Title + accessory chip. | TaxEstate.jsx:1286-1292 |
| TE-EST-WL-03 | **FAIL** | – | – | **DEMO-BLOCKING** | Cohabiting RED banner is a `<div>` with no onClick. Card-level intro says "the single highest-risk gap" — but there is no CTA to do anything about it. Inventory: ACTION (write will). Most demo-critical dead CTA on the Estate sub-tab. Matches seed S-18. | TaxEstate.jsx:1294-1305 |
| TE-EST-WL-04 / 05 | – | – | – | – | StatTiles non-interactive. | TaxEstate.jsx:1307-1316 |
| TE-EST-WL-06 | – | – | – | – | "Cost of dying intestate" banner; inventory marks SOURCE on the figure, no explicit CTA inventoried. | TaxEstate.jsx:1319-1332 |
| TE-EST-WL-07 / 08 | – | – | – | – | Intestacy distribution rows non-interactive (inventory). | TaxEstate.jsx:1341-1353 |

### Region 23 — IHT waterfall

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-EST-WF-01..03 | – | – | – | – | Title + chip + stage bars. | TaxEstate.jsx:1037-1056 |
| TE-EST-WF-04 | PASS | PASS | **FAIL** | **FUNCTIONAL** | SliderRow fires setDeltas — `wf = ihtWaterfall(entity, deltas)` recomputes *in card only*. Triple anchor + CoI do not move. Inventory destination: DECISION (what-if scenario). What renders is preview-only. Matches S-26. | TaxEstate.jsx:1057-1058 |
| TE-EST-WF-05 | PASS | PASS | **FAIL** | **FUNCTIONAL** | Same finding (gifts slider). | TaxEstate.jsx:1059-1060 |
| TE-EST-WF-06 | PASS | PASS | **FAIL** | **FUNCTIONAL** | Same finding (BPR slider). | TaxEstate.jsx:1061-1063 |

### Region 24 — Gift clock

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-EST-GC-01 / 02 | – | – | – | – | Title + ExplainerChip. | TaxEstate.jsx:1102-1105 |
| TE-EST-GC-03..07 | – | – | – | – | Gift rows render `<div>` (TaxEstate.jsx:1112) — no onClick. Inventory marks SOURCE without per-row tap requirement; the card itself is the SOURCE. PASS for the design as inventoried. | TaxEstate.jsx:1112 |

### Region 25 — Trust simulator

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-EST-TR-00 | PASS | – | – | – | RevealCard wrapper toggles open/close. | TaxEstate.jsx:2475-2486 |
| TE-EST-TR-01 / 02 | – | – | – | – | Title + label. | TaxEstate.jsx:1209-1222 |
| TE-EST-TR-03 | **FAIL** | – | – | **FUNCTIONAL** | "LOW · deed not in Vault" `<Chip>` non-interactive. Inventory: NA / ACTION (upload deed). Status chip pretending to be a CTA. Same shape as S-20. | TaxEstate.jsx:1223 |
| TE-EST-TR-04..07 | – | – | – | – | Display values. | TaxEstate.jsx:1226-1233 |

### Region 26 — BPR & APR mechanics

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-EST-BPR-00 | PASS | – | – | – | RevealCard wrapper. | TaxEstate.jsx:2489-2505 |
| TE-EST-BPR-01..11 | – | – | – | – | Display tiles + chips (per inventory). | TaxEstate.jsx:1459-1499 |
| TE-EST-BPR-12 | PASS | PASS | PASS | – | `setDrillView('bpr')` → BPRDrillPanel. SOURCE. | TaxEstate.jsx:2507-2518 |

### Region 27 — Pension nominations

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-EST-NM-01 | – | – | – | – | Title. | TaxEstate.jsx:1253 |
| TE-EST-NM-02 | **FAIL** | – | – | **FUNCTIONAL** | Pension rows render `<div>` (TaxEstate.jsx:1259); "No nominee" `<Chip tone='bad'>` (line 1266) is static. Inventory says SOURCE / ACTION (set-nominee CTA when missing). Confirms seed S-19. This is a name-and-shame status without a path to fix. | TaxEstate.jsx:1259, 1266 |
| TE-EST-NM-03 / 04 | – | – | – | – | Status chips, non-interactive by intent. | TaxEstate.jsx:1266-1267 |

### Region 28 — Beneficiary chain

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-EST-BC-01 | – | – | – | – | Title. | TaxEstate.jsx:1386 |
| TE-EST-BC-02 | – | – | – | – | BeneficiarySankey nodes have no per-node onClick; inventory acknowledges this as not-a-finding (Sankey is a SOURCE visualisation, not a launchpad). PASS for the design as inventoried. | BeneficiarySankey.jsx:223-254 |

### Region 29 — RNRB planning

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-EST-RN-01..05 | – | – | – | – | Display card; no interactive elements inventoried. | TaxEstate.jsx:1411-1446 |

### Region 30 — IHT diff chip

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-EST-DF-01 | – | – | – | – | DeltaChip in a `<div>`; conditional render, non-interactive. Inventory: SOURCE — IHT history, but no drill wired and not flagged as required. | TaxEstate.jsx:2526-2540 |

### Region 31 — IHTDrillPanel (L3 overlay)

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-DRL-IHT-01 | PASS | PASS | PASS | – | Back button `onClick={onClose}` → setDrillView(null). | TaxEstate.jsx:1758 |
| TE-DRL-IHT-02..14 | – | – | – | – | Static SOURCE rows. TE-DRL-IHT-13 "Gifts, trusts, and pension nominations can reduce this figure" is copy with no CTA (inventory flags A2 candidate). Lands inside the panel as a paragraph; no destination claimed. Flagging as POLISH — not strictly required to be a CTA per inventory, but A4 reads as describe-only inside an otherwise-coherent SOURCE drill. | TaxEstate.jsx:1659-1900 |
| TE-DRL-IHT-13 | **FAIL** | – | – | **POLISH** | Copy promises three actions but has no path to any of them. | TaxEstate.jsx (within IHTDrillPanel body) |

### Region 32 — AllowanceDrillPanel

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-DRL-AL-01 | PASS | PASS | PASS | – | Back button wired. | TaxEstate.jsx:2038 |
| TE-DRL-AL-02..12 | – | – | – | – | Static SOURCE rows; reaches SOURCE per inventory. | TaxEstate.jsx:1903-2050 |

### Region 33 — BPRDrillPanel

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-DRL-BPR-01 | PASS | PASS | PASS | – | Back button wired. | TaxEstate.jsx:1657 |
| TE-DRL-BPR-02..10 | – | – | – | – | Static SOURCE rows. | TaxEstate.jsx:1639-1755 |

### Region 34 — CGTDrillPanel

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| TE-DRL-CGT-01 | PASS | PASS | PASS | – | Back button wired. | TaxEstate.jsx:1903 (CGT panel sibling) |
| TE-DRL-CGT-02..14 | – | – | – | – | Static SOURCE rows. TE-DRL-CGT-13 "Consider harvesting up to £X in gains" — copy with no CTA. POLISH (inventory flags A2 candidate; not required). | TaxEstate.jsx (CGTDrillPanel body) |
| TE-DRL-CGT-13 | **FAIL** | – | – | **POLISH** | Same shape as TE-DRL-IHT-13 — advice-flavoured copy without a path to act. | n/a |

---

## §2 — FAIL summary (current → expected destination)

| ID | Severity | Current destination | Expected (owns-subject) destination | Why incoherent |
|---|---|---|---|---|
| TE-PLAN-05 (×3: estate/gift/tax) | DEMO-BLOCKING | `terminal('plan:*', 0, 'Driver tree pending')` placeholder frame in DetailOverlay | DECISION — plan-review surface for each plan type | Lands on placeholder; no plan-review surface exists at the router level. Three plans, three dead drills. |
| TE-EST-IS-10 | DEMO-BLOCKING | no-op (parent omits `onDrillMetric` prop, so cta does nothing) | SOURCE — BeneficiaryChain or beneficiary breakdown | Two-layer dead: handler not passed + router has no `beneficiaries` driver. Worst-case dead CTA — copy actively promises a tap. |
| TE-EST-WL-03 | DEMO-BLOCKING | no handler (`<div>` banner) | ACTION — write-will flow / set-LPA flow | Banner labels itself the "single highest-risk gap" and provides no path to fix it. |
| TE-SUB-T1 / T2 / T3 | FUNCTIONAL | no handler (rendered as `<div>` because no `onTap`) | SOURCE — `te_taxThisYear` / ANI stepwise / AllowanceDrillPanel | Three Tax-side sub-anchors all dead; inconsistent with TE-SUB-E3 which IS wired (scrollToIHTDual). |
| TE-SUB-E1 / E2 | FUNCTIONAL | no handler | SOURCE — IHTDrillPanel / BeneficiaryChain | "IHT today" + "Family receives" are the two most-stareable Estate numbers; both dead. Inconsistent with E3. |
| TE-TAX-SUM-04 / 05 / 06 / 07 | FUNCTIONAL | no handler (StatTile) | SOURCE — IncomeTaxDetail / DividendDetail / CGTDrillPanel / `te_nicsDetail` | Four tax tiles all dead. Pattern: tiles describe a number, do not let you go to its source. |
| TE-TAX-SS-03 | FUNCTIONAL | local in-card preview only | DECISION — sacrifice scenario that flows into engine | Slider moves an in-card label; triple anchor + CoI don't move. Promises a scenario, delivers a preview. |
| TE-TAX-CGT-03 / 04 | FUNCTIONAL | no handler | SOURCE — CGTDrillPanel | Same shape as TE-TAX-SUM-* — tiles describe, do not drill. CGT *is* reachable via the screen-level "Detail ›" chip, so impact is lower than TE-SUB-E1. |
| TE-TAX-CGT-06 | FUNCTIONAL | static `<Chip>` | ACTION — bed-and-ISA flow | Chip styled as an opportunity; user expects to tap. |
| TE-TAX-CGT-07 | FUNCTIONAL | static `<Chip>` | SOURCE/ACTION — spousal transfer detail | Same shape as CGT-06. |
| TE-TAX-DIV-07 | FUNCTIONAL | info `<div>` banner | ACTION — move-to-ISA flow | Banner says "saves £X / year" — that is an offer phrased as an action; no path to it. |
| TE-TAX-DD-03 | FUNCTIONAL | no handler | SOURCE — drawdown scenario projection (or handoff to MyMoney/Cashflow) | Drawdown matrix rows describe a scenario without letting you commit or even drill into it. FD-CROSS-1 makes a handoff to MyMoney/Cashflow acceptable, but neither exists. |
| TE-EST-IHT-03 / 07 | FUNCTIONAL | no handler on the tile (`<FadeInOnMount>` div) | SOURCE — IHTDrillPanel | Big animated numbers — the user's eye lands here first. Drill is only reachable via the "Breakdown ›" chip in the corner. Inconsistent UX. |
| TE-EST-WF-04 / 05 / 06 | FUNCTIONAL | local in-card preview only | DECISION — what-if scenario flowing into engine | Same shape as TE-TAX-SS-03. |
| TE-EST-PB-03 | FUNCTIONAL | static `<Chip tone='warn' outline>` | NA / ACTION — create-plan flow | "No plan yet" is a stop sign with no next step. |
| TE-EST-TR-03 | FUNCTIONAL | static `<Chip>` | ACTION — upload deed (data vault) | Same shape as the other status-chip-pretending-to-be-CTA findings. |
| TE-EST-NM-02 | FUNCTIONAL | no row handler; "No nominee" chip static | SOURCE / ACTION — set-nominee for the named pension | Names every pension missing a nominee and gives no path to fix. |
| TE-DRL-IHT-13 | POLISH | none (copy) | ACTION links — Gifts (gift clock), Trusts (trust sim), Pension nominations cards | Copy promises three pathways, all inert. |
| TE-DRL-CGT-13 | POLISH | none (copy) | ACTION — bed-and-ISA / harvesting flow | Same shape as IHT-13. |

---

## §3 — Pattern observations

1. **Status-chip-as-CTA pattern.** `<Chip tone='...'>` is used as both a status indicator (correct) and as an opportunity advertisement (incorrect, because Chip is a non-interactive shared component). Repeats: CGT-06, CGT-07, TR-03, NM-03/"No nominee", PB-03. If the design intent is "these are CTAs," they need a button-shaped affordance or an onClick prop on Chip.
2. **Tile-describes-not-drills pattern.** StatTile is used for every tax & estate number tile but never wired with onClick. SUM-04..07, CGT-03/04, IHT-03/07. Fixing this is one component change.
3. **Sub-anchor inconsistency.** TE-SUB-E3 is correctly wired (scrollToIHTDual). T1, T2, T3, E1, E2 are not. The component supports `onTap` (see SubAnchorStrip:299) — five of six cells just don't pass it. Five quick wins.
4. **Slider previews vs. scenarios.** SS-03, WF-04, WF-05, WF-06 all create local-state previews that never reach the engine. This is the FD-CROSS-1 promise inverted — the "consequence" surface should be where what-ifs commit, not where they die.
5. **The drill router has gaps.** `driver()` handles only five metrics. T&E pushes `plan:estate / plan:gift / plan:tax` and (would push) `beneficiaries` — none have handlers. Fixing TE-EST-IS-10 by adding `onDrillMetric` to InheritanceStory will still land on "Driver tree pending" unless `driver-engine.js` grows a `beneficiaries` case.

---

## §4 — Coverage

- Rows in inventory: **227**
- Rows with a verdict assigned this pass: **227** (every row touched; static-display rows marked `–` per the verdict-value rules)
- A2/A3/A4 PASS: **18 interactive rows pass cleanly** (TE-CHR-01, TE-ANCH-01/02/03, TE-TAB-01/02, TE-PLAN-02/04, TE-SUB-E3, TE-TAX-CGT-08, TE-TAX-ALL-08, TE-EST-IHT-12, TE-EST-BPR-12, TE-EST-TR-00, TE-EST-BPR-00, TE-DRL-IHT-01, TE-DRL-AL-01, TE-DRL-BPR-01, TE-DRL-CGT-01)
- A2/A3/A4 FAIL: **27 distinct findings** (3 DEMO-BLOCKING · 22 FUNCTIONAL · 2 POLISH)
- UNVERIFIED-NONBLOCKING (delegated to shared-component / reconciliation auditors): 4 (TE-CHR-03/04, TE-TAX-SUM-03, TE-PLAN-01, TE-EST-COI-01)

**Summary line for orchestrator:** `TE interaction: 18 PASS, 27 FAIL (3 DB, 22 F, 2 P).`
